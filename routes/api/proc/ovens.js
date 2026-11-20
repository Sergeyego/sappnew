const db = require('../../../postgres.js');
const autorest = require('../../../autorest/autorest.js'); 
const bodyParser = require('body-parser');
const locale = require('../../../locale.js');

module.exports = function (app) {

    app.get("/proc/ovens/rab/:dbeg/:dend", async (req, res) => {
        try {
            const is_el = req.query.mode == "e";
            const header = ["id", "Печь", "Дата-время", "Парт.", "Марка-диам.", "Программа", "t0", "w0", "Замес", "Загр.,кг", "Окончание", "W,кВт*ч", "Рабочий"];
            const param = {
                id: { "width": -1 },
                num: { "width": 85 },
                dt_beg: { "width": 125 },
                n_s: { "width": is_el ? 70 : -1 },
                marka: { "width": is_el ? 165 : -1 },
                prog_nam: { "width": is_el ? -1 : 200 },
                t0: { "width": -1 },
                w0: { "width": -1 },
                zms: { "width": -1 },
                kvo: { "width": -1 },
                dt_end: { "width": -1 },
                energ: { "width": -1 },
                rab: { "width": -1 },
                id_o: { "width": -1 }
            };
            const filter = is_el ? "and o2.id_group <> 17" : "and o2.id_group = 17";
            const query = `select o.id as id, o2.num as num, o.dt_beg as dt_beg, o.n_s as n_s, de.fnam as marka, o.prog_nam as prog_nam, 
                o.t0 as t0, o.w0 as w0, o.zms as zms, o.kvo as kvo, o.dt_end as dt_end, o.energ as energ, rr.snam as rab, o.id_owen as id_o
                from owens_rab as o
                inner join owens o2 on o2.id = o.id_owen 
                left join dry_els de on de.ide = o.id_eldim 
                left join rab_rab rr on rr.id = o.id_rab 
                where o.dt_beg between $1 and $2 ${filter}
                order by o.dt_beg `;

            const data = await autorest.getRoData("Прокалки", query, [req.params.dbeg, req.params.dend], header, 1, param);

            for (let i = 0; i < data.rows.length; i++) {
                const row = data.rows[i];
                const color = row["dt_end"].edit_role === null ? "#FFFFFF" : "#AAFFAA";
                for (let j = 0; j < data.fields.length; j++) {
                    const fieldName = data.fields[j].nam;
                    if (row[fieldName]) {
                        row[fieldName].background_role = color;
                    }
                }
            }
            res.json(data);
        } catch (error) {
            res.status(500).type("text/plain").send(error.message);
        }
    });

    // PATCH: редактирование параметров прокалки
    app.patch("/proc/ovens/rab/:id", bodyParser.json(), async (req, res) => {
        try {
            const id = Number(req.params.id);
            if (isNaN(id)) {
                return res.status(400).type('text/plain').send("Неверный id");
            }

            const { zms, kvo, w0, t0 } = req.body;

            // Валидация числовых полей
            const numKvo = Number(kvo);
            const numW0 = Number(w0);
            const numT0 = Number(t0);

            if (!Number.isFinite(numKvo) || !Number.isFinite(numW0) || !Number.isFinite(numT0)) {
                return res.status(400).type('text/plain').send("Параметры kvo, w0, t0 должны быть числами");
            }

            const data = await db.tx(async (t) => {
                await autorest.setSqlContext(t, req);
                return await t.oneOrNone(
                    `UPDATE owens_rab 
                    SET zms = $1, kvo = $2, w0 = $3, t0 = $4 
                    WHERE id = $5 
                    RETURNING id, zms, kvo, w0, t0`,
                    [zms !== undefined ? String(zms) : null, numKvo, numW0, numT0, id]
                );
            });

            if (!data) {
                return res.status(404).type('text/plain').send("Прокалка не найдена");
            }

            res.json(data);
        } catch (error) {
            console.error('[PATCH rab]', error);
            res.status(error.status || 500).type('text/plain').send(error.message);
        }
    });

    // DELETE: удаление незавершённой прокалки
    app.delete("/proc/ovens/rab/:id", async (req, res) => {
        try {
            const id = Number(req.params.id);
            if (isNaN(id)) {
                return res.status(400).type('text/plain').send("Неверный id");
            }

            const result = await db.tx(async (t) => {
                await autorest.setSqlContext(t, req);

                const rab = await t.oneOrNone(
                    'SELECT id, dt_end FROM owens_rab WHERE id = $1',
                    [id]
                );

                if (!rab) {
                    const e = new Error("Прокалка не найдена");
                    e.status = 404;
                    throw e;
                }

                if (rab.dt_end !== null) {
                    const e = new Error("Нельзя удалить завершённую прокалку");
                    e.status = 400;
                    throw e;
                }

                // Удаляем только запись из owens_rab, данные каналов остаются
                await t.none('DELETE FROM owens_rab WHERE id = $1', [id]);

                return { id };
            });

            res.json(result);
        } catch (error) {
            console.error('[DELETE rab]', error);
            res.status(error.status || 500).type('text/plain').send(error.message);
        }
    });

    app.get("/proc/ovens/list", async (req, res) => {
        try {
            const header = ["id", "Номер", "Группа", "Мощность"];
            const param = {
                id: { "width": -1 }
            };

            const query = `select o.id as id, o.num as num, g.nam as group, o.pwr||'+'||o.pwr_cool||' kW' as pwr 
                from owens as o 
                inner join owens_groups as g on o.id_group=g.id 
                order by o.num`;

            const data = await autorest.getRoData("Печи", query, [], header, 1, param);
            res.json(data);
        } catch (error) {
            res.status(500).type("text/plain").send(error.message);
        }
    });

    app.get("/proc/ovens/profile/:dbeg/:dend", async (req, res) => {
        try {
            const header = ["Час", "Мощность, кВт"];

            const query = `WITH hourly_channel_power AS (
                -- Шаг 1: Находим среднюю мощность для каждого канала внутри конкретного часа каждого дня
                SELECT 
                    d.dat_time::date AS date_day,
                    EXTRACT(HOUR FROM d.dat_time) AS hour_of_day,
                    d.id_channel,
                    AVG(coalesce(d.pwr,0) * c.pwr) AS avg_channel_kw
                FROM 
                    public.owens_data_new d
                JOIN 
                    public.owens_trm_channel c ON d.id_channel = c.id
                WHERE 
                    -- Укажите нужный вам период времени
                    d.dat_time >= $1::date
                    AND d.dat_time < ($2::date+1)
                GROUP BY 
                    d.dat_time::date,
                    EXTRACT(HOUR FROM d.dat_time),
                    d.id_channel
            ),
            total_power_per_hour AS (
                -- Шаг 2: Складываем средние мощности всех каналов за этот час
                SELECT 
                    date_day,
                    hour_of_day,
                    SUM(avg_channel_kw) AS total_kw_h
                FROM 
                    hourly_channel_power
                GROUP BY 
                    date_day,
                    hour_of_day
            )
            -- Шаг 3: Считаем средний профиль общей мощности и округляем до целых кВт
            SELECT 
                to_char(hour_of_day, 'FM00') AS hour_of_day,
                ROUND(AVG(total_kw_h))::int AS avg_total_power_kw
            FROM 
                total_power_per_hour
            GROUP BY 
                hour_of_day
            ORDER BY 
                hour_of_day;`;

            const title = "Профиль мощности с "+locale.insDate(req.params.dbeg)+" по "+locale.insDate(req.params.dend);
            const data = await autorest.getRoData(title , query, [req.params.dbeg, req.params.dend], header);
            res.json(data);
        } catch (error) {
            res.status(500).type("text/plain").send(error.message);
        }
    });

    app.post("/proc/ovens/prog/paste/:id/:id_grp", bodyParser.json(), async (req, res) => {
        try {
            const id = Number(req.params.id);
            const id_grp = Number(req.params.id_grp);
            if (isNaN(id) || isNaN(id_grp)) {
                return res.status(400).type('text/plain').send("Неверные параметры id, id_grp");
            }

            const { id_src, id_grp_src} = req.body;

            // Валидация числовых полей
            const numIdSrc = Number(id_src);
            const numIdGrp = Number(id_grp_src);

            if (!Number.isFinite(numIdSrc) || !Number.isFinite(numIdGrp)) {
                return res.status(400).type('text/plain').send("Параметры id_src, id_grp_src должны быть числами");
            }

            const data = await db.tx(async (t) => {
                await autorest.setSqlContext(t, req);
                return await t.oneOrNone(
                    `insert into dry_prog (id, step, tra, tim, id_grp) 
                    (select $1, p.step, p.tra, p.tim, $2 from dry_prog as p where p.id = $3 and p.id_grp = $4)`,
                    [id,id_grp,numIdSrc,numIdGrp]
                );
            });
            res.json(data);
        } catch (error) {
            console.error('[PATCH rab]', error);
            res.status(error.status || 500).type('text/plain').send(error.message);
        }
    });

    app.post("/proc/ovens/updeldim", bodyParser.json(), async (req, res) => {
        try {
            const data = await db.tx(async (t) => {
                await autorest.setSqlContext(t, req);
                return await t.any(
                    `select * from rx_els()`,
                    []
                );
            });
            res.json(data);
        } catch (error) {
            console.error('[PATCH rab]', error);
            res.status(error.status || 500).type('text/plain').send(error.message);
        }
    });

    app.get("/proc/ovens/plotdata", async (req, res) => {
        try {
            const id_owrab = req.query.id_owrab ? Number(req.query.id_owrab) : null;
            const id_oven = req.query.id_oven ? Number(req.query.id_oven) : null;
            const dBeg = req.query.dBeg ? new Date(req.query.dBeg) : null;
            const dEnd = req.query.dEnd ? new Date(req.query.dEnd) : null;
            const ost = req.query.ost === 'true';
            const maxPoints = req.query.limit ? Number(req.query.limit) : 1500; // Лимит точек на канал

            let channels = [];
            let dataRows = [];

            if (id_owrab) {
                const rab = await db.oneOrNone('select id_owen, dt_beg, dt_end from owens_rab where id = $1', [id_owrab]);
                if (!rab) {
                    return res.status(404).type('text/plain').send("Прокалка не найдена");
                }

                // Ищем каналы
                channels = await db.any(`
                    select distinct c.id, c.number, c.nam, c.color_ust, c.color_val, c.is_main
                    from owens_data_new n
                    inner join owens_trm_channel c on c.id = n.id_channel
                    where n.id_ow_rab = $1 order by c.number
                `, [id_owrab]);

                if (channels.length === 0) {
                    channels = await db.any(`
                        select c.id, c.number, c.nam, c.color_ust, c.color_val, c.is_main
                        from owens_trm_channel c
                        where c.id_owen = $1 and c.is_enabled = true order by c.number
                    `, [rab.id_owen]);
                }

                if (channels.length > 0) {
                    const chIds = channels.map(c => c.id);
                    const startLimit = new Date(rab.dt_beg);

                    // 1. Всегда ищем начало следующей прокалки, чтобы не захватить чужие данные
                    const nextRab = await db.oneOrNone(`
                        select min(dt_beg) as next_beg 
                        from owens_rab 
                        where id_owen = $1 and dt_beg > $2
                    `, [rab.id_owen, rab.dt_beg]);

                    let nextBegDate = (nextRab && nextRab.next_beg) ? new Date(nextRab.next_beg) : null;

                    // 2. Определяем базовый конец
                    let endLimit;
                    if (!rab.dt_end) {
                        endLimit = new Date(); // Прокалка еще идет, берем текущее время
                    } else {
                        endLimit = new Date(rab.dt_end);
                    }

                    // 3. Если запрошено остывание — добавляем 6 часов (только если прокалка завершена)
                    if (ost && rab.dt_end) {
                        endLimit = new Date(endLimit.getTime() + 6 * 60 * 60 * 1000);
                    }

                    // 4. ЖЕСТКИЙ ОГРАНИЧИТЕЛЬ: если есть следующая прокалка, не заходим в ее время
                    if (nextBegDate && endLimit > nextBegDate) {
                        endLimit = nextBegDate;
                    }

                    // 5. Не уходим в будущее
                    const now = new Date();
                    if (endLimit > now) {
                        endLimit = now;
                    }

                    dataRows = await db.any(`
                        select id_channel, ust, val, dat_time, pwr
                        from owens_data_new
                        where dat_time between $1 and $2 and id_channel in ($3:csv)
                        order by dat_time
                    `, [startLimit, endLimit, chIds]);
                }
            } else if (id_oven && dBeg && dEnd) {
                // ... (логика для произвольного периода остается без изменений)
                channels = await db.any(`
                    select distinct c.id, c.number, c.nam, c.color_ust, c.color_val, c.is_main
                    from owens_data_new n
                    inner join owens_trm_channel c on c.id = n.id_channel
                    where c.id_owen = $1 and n.dat_time between $2 and $3
                    order by c.number
                `, [id_oven, dBeg, dEnd]);

                if (channels.length > 0) {
                    const chIds = channels.map(c => c.id);
                    dataRows = await db.any(`
                        select id_channel, ust, val, dat_time, pwr
                        from owens_data_new
                        where dat_time between $1 and $2 and id_channel in ($3:csv)
                        order by dat_time
                    `, [dBeg, dEnd, chIds]);
                }
            } else {
                return res.status(400).type('text/plain').send("Не указаны параметры");
            }

            // Группируем данные по каналам
            const dataMap = new Map();
            for (const row of dataRows) {
                if (!dataMap.has(row.id_channel)) dataMap.set(row.id_channel, []);
                dataMap.get(row.id_channel).push(row);
            }

            // ПРОРЕЖИВАНИЕ (Downsampling): применяем к каждому каналу отдельно
            for (const [chId, rows] of dataMap.entries()) {
                if (rows.length > maxPoints) {
                    const step = Math.ceil(rows.length / maxPoints);
                    const sampled = [];
                    for (let i = 0; i < rows.length; i += step) {
                        sampled.push(rows[i]);
                    }
                    // Обязательно добавляем последнюю точку, чтобы график не обрывался раньше времени
                    if ((rows.length - 1) % step !== 0) {
                        sampled.push(rows[rows.length - 1]);
                    }
                    dataMap.set(chId, sampled);
                }
            }

            const result = channels.map(ch => ({
                id: ch.id,
                number: ch.number,
                nam: ch.nam,
                color_ust: ch.color_ust,
                color_val: ch.color_val,
                is_main: ch.is_main,
                data: dataMap.get(ch.id) || []
            }));

            res.json(result);
        } catch (error) {
            console.error('[PLOTDATA]', error);
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/proc/ovens/sensorinfo/:id_owen/:date", async (req, res) => {
        try {
            const id_owen = Number(req.params.id_owen);
            const dateStr = req.params.date;

            if (isNaN(id_owen)) {
                return res.status(400).type('text/plain').send("Неверный id_owen");
            }

            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                return res.status(400).type('text/plain').send("Неверный формат даты (ожидается YYYY-MM-DD)");
            }

            const query = `
                select otc.nam as channel_nam, 
                    otcs.nam as sensor_nam, 
                    otcs.num as sensor_num, 
                    otcs.dat_pov, 
                    otcs.dat_end
                from owens_trm_channel_sensor otcs
                inner join (
                    select otcs2.id_channel, max(otcs2.dat) as dat
                    from owens_trm_channel_sensor otcs2
                    where otcs2.dat <= $1
                    group by otcs2.id_channel
                ) as z on z.dat = otcs.dat and z.id_channel = otcs.id_channel
                inner join owens_trm_channel otc on otc.id = otcs.id_channel
                inner join owens o on o.id = otc.id_owen
                where otc.is_enabled = true and o.id = $2 and otcs.dat_end >= $1
                order by otc.number
            `;

            const rows = await db.any(query, [dateStr, id_owen]);

            let html = "";
            for (const row of rows) {
                const endDate = new Date(row.dat_end);
                const d = String(endDate.getDate()).padStart(2, '0');
                const m = String(endDate.getMonth() + 1).padStart(2, '0');
                const y = endDate.getFullYear();

                html += `<br>${row.channel_nam}: датчик ${row.sensor_nam} №${row.sensor_num} поверка до ${d}.${m}.${y};`;
            }

            res.json({ html: html });
        } catch (error) {
            console.error('[SENSORINFO]', error);
            res.status(500).type('text/plain').send(error.message);
        }
    });
}