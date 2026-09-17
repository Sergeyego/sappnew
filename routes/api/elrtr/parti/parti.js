const db = require('../../../../postgres.js');
const autorest = require('../../../../autorest/autorest.js');
const sql = require('../../../../sql.js');

const queryTu = sql('routes/api/elrtr/parti/tu.sql');

let getPartState = async function (filter, param) {
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
    app.get("/elrtr/parti/insmark/:id_rcp", async (req, res) => {
        try {
            const data = await db.any("select rn.id_el from rcp_nam rn where rn.id = $1", [Number(req.params["id_rcp"])]);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/elrtr/parti/insprovol/:id_el", async (req, res) => {
        try {
            const data = await db.any("select e.id_gost as id_pr from elrtr e where e.id = $1", [Number(req.params["id_el"])]);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/elrtr/parti/inspack/:id_el/:diam", async (req, res) => {
        try {
            const data = await db.any("select p.id_pack, p.id_long, p.id_var, count(p.id_pack) as stat " +
                "from parti p " +
                "where p.dat_part >= (CURRENT_DATE-365) and p.id_el = $1 and p.diam = $2 " +
                "group by p.id_pack, p.id_long, p.id_var order by stat desc", [Number(req.params["id_el"]), Number(req.params["diam"])]);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/elrtr/parti/tu/:id_part", async (req, res) => {
        try {
            const data = await autorest.getRoData("Нормативная документация",queryTu,[Number(req.params["id_part"])],["Наименование"]);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/elrtr/parti/note/:id_part", async (req, res) => {
        try {
            const query = `select p.prim, p.prim_prod, p.ok from parti as p where p.id = $1`;
            const data = await autorest.getRoData("Примечания",query,[Number(req.params["id_part"])]);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/elrtr/parti/ship/:id_part", async (req, res) => {
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
            const data = await autorest.getRoData("Отгрузки партии",query,[Number(req.params["id_part"])],header,1,param);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/elrtr/parti/list/:d1/:d2", async (req, res) => {
        try {
            // Базовый объект параметров, который гарантированно заполнен
            const fltObj = {
                d1: new Date(req.params["d1"]),
                d2: new Date(req.params["d2"])
            };

            let filter = "where p.dat_part between ${d1} and ${d2} ";

            // Проверяем id_el
            const id_el = Number(req.query.id_el);
            if (id_el && id_el > 0) {
                filter += "and p.id_el = ${id_el} ";
                fltObj.id_el = id_el; // Добавляем в объект только если прошел проверку

                // Проверяем diam (работает, если diam пришел как строка или число)
                if (req.query.diam !== undefined && req.query.diam !== null && req.query.diam !== "") {
                    filter += "and p.diam = ${diam} ";
                    fltObj.diam = Number(req.query.diam); // Приводим к числу для соответствия типу в БД
                }
            }

            const header = ["id", "Партия", "Дата", "Марка", "Источник", "Рецептура", "Вариант"];
            const param = {
                id: { "width": -1 },
                n_s: { "width": 55 },
                dat_part: { "width": 85 },
                marka: { "width": 165 },
                srcnam: { "width": 90 },
                rcpnam: { "width": 125 },
                varnam: { "width": 160 }
            };

            let query = `select p.id as id, p.n_s as n_s, p.dat_part as dat_part, 
                e.marka||' ф '||cast(p.diam as varchar(3)) as marka, i.nam as srcnam, 
                r.nam as rcpnam, ev.nam as varnam
                from parti p 
                inner join elrtr e on e.id=p.id_el 
                inner join istoch i on i.id=p.id_ist 
                left join rcp_nam r on r.id=p.id_rcp 
                inner join elrtr_vars ev on ev.id = p.id_var 
                ${filter}
                order by p.yea, p.n_s`;

            // fltObj содержит ТОЛЬКО те свойства, которые реально есть в строке filter
            const data = await autorest.getRoData("Партии электродов", query, fltObj, header, 1, param);
            const mapStat = await getPartState(filter, fltObj);

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
            }

            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });
}