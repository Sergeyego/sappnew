const db = require('../../../../postgres.js');
const autorest = require('../../../../autorest/autorest.js');
const otk = require('../../../../otk.js');
const bodyParser = require('body-parser');

const getChemBuhtTu = async function (id_buht) {
    const query = `
        select c.id_chem, c.min, c.max from wire_chem_tu as c where c.id_provol = 
        (select COALESCE(pr.id_base, pp.id_pr) from prov_buht as b inner join prov_prih as pp on b.id_prih=pp.id 
        inner join provol as pr on pp.id_pr=pr.id where b.id = $1 )
    `;
    const state = await db.any(query, [id_buht]);
    const mapStat = new Map();
    for (let i = 0; i < state.length; i++) {
        mapStat.set(state[i].id_chem, { min: state[i].min, max: state[i].max });
    }
    return mapStat;
}

const getChemPartTu = async function (id_m) {
    const query = `
        select c.id_chem, c.min, c.max from wire_chem_tu as c where c.id_provol = 
        (select COALESCE(pr.id_base, p.id_provol) from wire_parti_m as p inner join provol as pr on p.id_provol=pr.id where p.id = $1 )
    `;
    const state = await db.any(query, [id_m]);
    const mapStat = new Map();
    for (let i = 0; i < state.length; i++) {
        mapStat.set(state[i].id_chem, { min: state[i].min, max: state[i].max });
    }
    return mapStat;
}

const getPartState = async function (filter, param) {
    const query = `select wpm.id as id, 
        (select case when exists(select id from wire_parti_chem where id_part=wpm.id) 
        then 1 else 0 end 
        + 
        case when exists(select id from wire_parti_mech where id_part=wpm.id) 
        then 2 else 0 end ) as stat from wire_parti_m as wpm ${filter}`;
    const data = await db.any(query, param);
    const mapStat = new Map();
    for (let i = 0; i < data.length; i++) {
        let color = "#FFFFFF";
        const r = Number(data[i].stat);
        if (r == 0) {
            color = "#FFAAAA";
        } else if (r == 1) {
            color = "#FFFF00";
        } else if (r == 2) {
            color = "#808080";
        } else {
            color = "#AAFFAA";
        }
        mapStat.set(data[i].id, color);
    }
    return mapStat;
};

module.exports = function (app) {

    app.use("/wire/parti/chem/buth", autorest.parseFilterMiddleware("prov_chem"), bodyParser.json(), async (req, res) => {
        const tableName = "prov_chem";
        try {
            let data = await autorest.getData(tableName, req);
            await otk.processTuColoring(data, tableName, getChemBuhtTu, "id_chem", "id_buht");
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.use("/wire/parti/chem/part", autorest.parseFilterMiddleware("wire_parti_chem"), bodyParser.json(), async (req, res) => {
        const tableName = "wire_parti_chem";
        try {
            let data = await autorest.getData(tableName, req);
            await otk.processTuColoring(data, tableName, getChemPartTu, "id_chem", "id_part");
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });
    
    app.get("/wire/parti/note/:id_part", async (req, res) => {
        try {
            const query = `select wp.prim_prod as prim_prod from wire_parti wp where wp.id = $1`;
            const data = await autorest.getRoData("Примечания", query, [Number(req.params["id_part"])]);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.patch("/wire/parti/patch/:id_part", bodyParser.json(), async (req, res) => {
        try {
            const allowedFields = ['prim_prod'];

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
                const query = `UPDATE wire_parti SET ${setParts.join(', ')} WHERE id = $1 RETURNING ${returningFields.join(', ')};`;

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

    app.get("/wire/parti/tusrc/:id_prov", async (req, res) => {
        try {
            const query = `select g.nam as nam from wire_gost as w 
                inner join gost_new as g on w.id_gost = g.id 
                where w.id_provol = $1 order by g.nam`;
            const header = ["Наименование"];
            const data = await autorest.getRoData("Нормативная документация проволоки", query, [Number(req.params["id_prov"])], header);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/wire/parti/ship/:id_part", async (req, res) => {
        try {
            const query = `select d.id as id, s.nom_s as num, s.dat_vid as dat, 
            p.short as buyer, d.m_netto as kvo, rp.short as buyer_real, d.ds_status as ds 
            from wire_shipment_consist as d 
            inner join sertifikat as s on s.id=d.id_ship 
            inner join poluch as p on s.id_pol=p.id 
            inner join poluch as rp on d.id_pol=rp.id 
            where d.id_wparti = $1 order by s.dat_vid`;
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

    app.get("/wire/parti/mechcats/get", async (req, res) => {
        try {
            const query = `select id, id_wire_cat from mech_tbl order by id`;
            const data = await autorest.getRoData("Категории механики", query);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.post("/wire/parti/copytu/:id_m", async (req, res) => {
        try {
            const id_part = Number(req.params["id_m"]);
            const data = await db.tx(async t => {
                await autorest.setSqlContext(t, req);
                return await t.any(`insert into wire_parti_gost (id_parti, id_gost) 
                    (select $1, g.id_gost from wire_gost as g where g.id_provol = (select wpm.id_provol  from wire_parti_m wpm where wpm.id = $1 ) )`, [id_part]);
            });
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.post("/wire/parti/copychem/:id_m", async (req, res) => {
        try {
            const id_part = Number(req.params["id_m"]);
            const data = await db.tx(async t => {
                await autorest.setSqlContext(t, req);
                return await t.any(`insert into wire_parti_chem (id_part, id_chem, value ) 
                    (select $1, pr.id_el, pr.kvo from prov_chem as pr 
                    where pr.id_buht=(select p.id_buht from wire_parti_m as p where p.id= $1 ))`, [id_part]);
            });
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/wire/parti/color/:id_m", async (req, res) => {
        try {
            const id_part = Number(req.params["id_m"]);
            const filter = "where wpm.id = ${id}";
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

            // Проверяем id_prov
            const id_prov = Number(req.query.id_prov);
            const id_diam = Number(req.query.id_diam);
            if (id_prov && id_prov > 0) {
                filter += "and wpm.id_provol = ${id_prov} ";
                fltObj.id_prov = id_prov; // Добавляем в объект только если прошел проверку

                if (id_diam && id_diam>0) {
                    filter += "and wpm.id_diam = ${id_diam} ";
                    fltObj.id_diam = Number(req.query.id_diam); // Приводим к числу для соответствия типу в БД
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
                varnam: { "width": 90 },
                buht: { "width": -1 },
                podt: { "width": -1 },
                rab: { "width": -1 },
                line: { "width": -1 },
                kvo: { "width": -1 },
                id_m: { "width": -1 },
                id_prov: { "width": -1 },
                note: { "width": -1 },
                id_buht: { "width": -1 }
            };

            let query = `select wp.id as id, wpm.n_s as n_s, wpm.dat as dat_part, ws.nam as srcnam, p.nam as marka, d.diam as diam, 
                  wpk.short ||' ('||wp2.mas_ed ||' кг)' as spool, ev.nam as varnam, 
                  pb.str as buht, wp3.str as podt, we.snam as rab, wl.snam as line, wpm.kvo as kvo, 
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
            const mapStat = await getPartState(filter, fltObj);

            for (let i = 0; i < data.rows.length; i++) {
                const row = data.rows[i];
                const id = row["id_m"]?.edit_role;
                const color = mapStat.get(id) || "#FFFFFF";

                for (let j = 0; j < data.fields.length; j++) {
                    const fieldName = data.fields[j].nam;
                    if (row[fieldName]) {
                        row[fieldName].background_role = color;
                    }
                }
            }
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });
}