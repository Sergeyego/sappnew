const db = require('../../../../postgres.js');
const autorest = require('../../../../autorest/autorest.js');
//const sql = require('../../../../sql.js');
var bodyParser = require('body-parser');

//const queryTu = sql('routes/api/elrtr/parti/tu.sql');

const getPartState = async function (filter, param) {
    const query = `select p.id as id, ( 
        (case when p.ok then 1 else 0 end) +
        (select case when exists(select id_chem from sert_chem where id_part=p.id) then 2 else 0 end ) +
        (case when exists(select id_mech from sert_mech where id_part=p.id) then 4 else 0 end ) 
        ) as stat 
        from parti p ${filter}`;
    const data = await db.any(query, param);
    const mapStat = new Map();
    for (let i = 0; i < data.length; i++) {
        let color = "#FFFFFF";
        const r = Number(data[i].stat);
        if (r == 6 || r == 7) {
            color = "#AAFFAA";
        } else if (r == 2 || r == 3) {
            color = "#808080";
        } else if (r == 4 || r == 5) {
            color = "#FFFF00";
        } else if (r == 1) {
            color = "#FFC864";
        } else {
            color = "#FFAAAA";
        }
        mapStat.set(data[i].id, color);
    }
    return mapStat;
};

module.exports = function (app) {

    app.get("/wire/parti/note/:id_part", async (req, res) => {
        try {
            const query = `select p.prim, p.prim_prod, p.ok from parti as p where p.id = $1`;
            const data = await autorest.getRoData("Примечания", query, [Number(req.params["id_part"])]);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.patch("/wire/parti/patch/:id_part", bodyParser.json(), async (req, res) => {
        try {
            const allowedFields = ['ok', 'prim', 'prim_prod'];

            let setParts = [];
            let returningFields = ['id']; // ID возвращаем всегда, чтобы фронтенд знал, какая строка обновилась
            let params = [req.params.id_part]; // \$1 — это всегда id_part
            let paramIndex = 2; // Переменные для SET начинаются с \$2

            // Обходим разрешенные поля
            const body = req.body || {};
            allowedFields.forEach(field => {
                if (body[field] !== undefined) {
                    setParts.push(`${field} = $${paramIndex}`);
                    returningFields.push(field);
                    params.push(body[field]);
                    paramIndex++;
                }
            });

            // Если клиент не передал ни одного разрешенного поля
            if (setParts.length === 0) {
                return res.status(400).type('text/plain').send('Нет данных для обновления или поля недопустимы');
            }

            // Выполняем обновление в транзакции
            const data = await db.tx(async t => {
                // Контекст для триггеров
                await autorest.setSqlContext(t, req);

                // Собираем SQL-запрос с динамическим SET и динамическим RETURNING
                const query = `UPDATE parti SET ${setParts.join(', ')} WHERE id = $1 RETURNING ${returningFields.join(', ')};`;

                return await t.oneOrNone(query, params);
            });

            // Если запись не найдена в БД
            if (!data) {
                return res.status(404).type('text/plain').send('Партия с указанным ID не найдена');
            }

            // Клиент получит объект, содержащий только id и измененные им поля
            res.json(data);

        } catch (error) {
            console.error("Ошибка при обновлении примечаний партии:", error);
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/wire/parti/ship/:id_part", async (req, res) => {
        try {
            const query = `select o.id as id, s.nom_s as num, s.dat_vid as dat, 
                p.short as buyer, o.massa as kvo, rp.short as buyer_real, o.ds_status as ds
                from otpusk as o 
                inner join sertifikat as s on o.id_sert=s.id 
                inner join poluch as p on s.id_pol=p.id 
                inner join poluch as rp on o.id_pol=rp.id 
                where o.id_part = $1 order by s.dat_vid, s.nom_s`;
            const header = ["id", "Номер", "Дата", "Получатель", "К-во, кг", "Реальный получатель", "Подп."];
            const param = {
                id: { "width": -1 },
            };
            const data = await autorest.getRoData("Отгрузки партии", query, [Number(req.params["id_part"])], header, 1, param);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.post("/wire/parti/copychem/:id_part", async (req, res) => {
        try {
            const id_part = Number(req.params["id_part"]);
            const data = await db.tx(async t => {
                await autorest.setSqlContext(t, req);
                return await t.oneOrNone(`select * from gen_chem($1)`, [id_part]);
            });
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/wire/parti/color/:id_part", async (req, res) => {
        try {
            const id_part = Number(req.params["id_part"]);
            const filter = "where p.id = ${id}";
            const fltObj = {
                id: id_part
            };

            const mapStat = await getPartState(filter, fltObj);
            const color = mapStat.get(id_part) || "#FFFFFF";

            res.json({ id: id_part, color: color });
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/wire/parti/list/:d1/:d2", async (req, res) => {
        try {
            // Базовый объект параметров, который гарантированно заполнен
            const fltObj = {
                d1: req.params["d1"],
                d2: req.params["d2"]
            };

            let filter = "where wpm.dat between ${d1} and ${d2} ";

            // Проверяем id_el
            const id_prov = Number(req.query.id_prov);
            if (id_prov && id_prov > 0) {
                filter += "and wpm.id_provol = ${id_prov} ";
                fltObj.id_prov = id_prov; // Добавляем в объект только если прошел проверку

                // Проверяем diam (работает, если diam пришел как строка или число)
                if (req.query.diam !== undefined && req.query.diam !== null && req.query.diam !== "") {
                    filter += "and d.diam = ${diam} ";
                    fltObj.diam = Number(req.query.diam); // Приводим к числу для соответствия типу в БД
                }
            }

            const header = ["id", "Партия", "Дата", "Источник", "Марка", "Диам.", "Носитель","Вариант"];
            const param = {
                id: { "width": -1 },
                n_s: { "width": 55 },
                dat_part: { "width": 85 },
                srcnam: { "width": 95 },
                marka: { "width": 145 },
                diam: { "width": 50 },
                spool: { "width": 170 },
                varnam: { "width": 90 }
            };

            let query = `select wp.id as id, wpm.n_s as n_s, wpm.dat as dat_part, ws.nam as srcnam, p.nam as marka, d.diam as diam, 
                  wpk.short ||' ('||wp2.mas_ed ||' кг)' as spool, ev.nam as varnam, 
                  pb.str as buht, wp3.str as src_prov, we.snam as rab, wl.snam as line, wpm.kvo as kvo, 
                  wp.id_m as id_m, wpm.id_provol as id_prov, wpm.comment as note, wpm.id_buht as id_buht
                  from wire_parti wp 
                  inner join wire_parti_m wpm on wpm.id = wp.id_m 
                  inner join wire_source ws on ws.id = wpm.id_source 
                  inner join provol p on p.id = wpm.id_provol 
                  inner join diam d on d.id = wpm.id_diam 
                  inner join wire_pack_kind wpk on wpk.id = wp.id_pack 
                  inner join wire_pack wp2 on wp2.id = wp.id_pack_type 
                  inner join elrtr_vars ev on ev.id = wp.id_var 
                  inner join prov_buht pb on pb.id = wpm.id_buht 
                  left join wire_podt wp3 on wp3.id = wpm.id_podt 
                  left join wire_empl we on we.id = wpm.id_empl 
                  inner join wire_line wl on wl.id = wpm.id_type 
                  ${filter}
                  order by date_part('year',wpm.dat), wpm.n_s, wpm.dat, wpk.short`;

            // fltObj содержит ТОЛЬКО те свойства, которые реально есть в строке filter
            const data = await autorest.getRoData("Партии проволоки", query, fltObj, header, 1, param);
            /*const mapStat = await getPartState(filter, fltObj);

            for (let i = 0; i < data.rows.length; i++) {
                const row = data.rows[i];
                const id = row["id"]?.edit_role;
                const color = mapStat.get(id) || "#FFFFFF";

                for (let j = 0; j < data.fields.length; j++) {
                    const fieldName = data.fields[j].nam;
                    if (row[fieldName]) {
                        row[fieldName].background_role = color;
                    }
                }
            }*/

            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });
}