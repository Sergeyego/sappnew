const db = require('../../../../postgres.js');
const autorest = require('../../../../autorest/autorest.js');
const sql = require('../../../../sql.js');

const sqlByPart = sql('routes/api/elrtr/glass/partCons.sql');
const sqlConsStat = sql('routes/api/elrtr/glass/consStat.sql');
const sqlConsStatPar = sql('routes/api/elrtr/glass/consStatPar.sql');
const sqlKorrPar = sql('routes/api/elrtr/glass/korrPar.sql');

module.exports = function (app) {

    app.get("/elrtr/glass/:id_part/:id_cons", async (req, res) => {
        try {
            const id_part = Number(req.params["id_part"]);
            let data = {};
            const cons = await db.any(sqlByPart, [id_part, Number(req.params["id_cons"])]);
            if (cons.length) {
                const id_load = cons[0].id;
                const korrPar = await db.any(sqlKorrPar, [id_load]);
                let id_korr_load = -1;
                let korrStr = "";
                if (korrPar.length) {
                    id_korr_load = korrPar[0].id_load;
                    korrStr = "Параметры корректора :";
                    for (let i = 0; i < korrPar.length; i++) {
                        korrStr += "\n" + korrPar[i].str;
                    }
                }
                const param = {
                    id_korr_load: { "width": -1 },
                    id_sump_load: { "width": -1 }
                };
                data = await autorest.getRoData("Стекло", sqlConsStat, [id_load], ["%", "Стекло", "Парт.гл.", "Модуль", "id_korr_load", "id_sump_load"], 1, param);
                for (let i = 0; i < data.rows.length; i++) {
                    const id_l=data.rows[i]["id_korr_load"].edit_role;
                    for (let j = 0; j < data.fields.length; j++) {
                        if (id_l === id_korr_load) {
                            data.rows[i][data.fields[j].nam].tooltip_role = korrStr;
                        }
                    }
                }
            }
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/elrtr/glasspar/:id_part/:id_cons", async (req, res) => {
        try {
            const id_part = Number(req.params["id_part"]);
            const id_cons = Number(req.params["id_cons"]);
            let parData = {};
            const cons = await db.any(sqlByPart,[id_part, id_cons]);
            if (cons.length){
                const id_load = cons[0].id;
                const param = {val : {"dec" : 3}};
                parData = await autorest.getRoData("Параметры стекла",sqlConsStatPar,[id_load, id_part],["Параметр", "Значен.", "Тизм.,°С", "Дата"],1,param);
            }
            res.json(parData);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });
}