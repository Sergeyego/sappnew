const db = require('../../../postgres.js');
const autorest = require('../../../autorest/autorest.js');
var bodyParser = require('body-parser');

module.exports = function (app) {

    app.get("/docs/variants/get/:id_doc", async (req, res) => {
        try {
            const query = `select ev.nam as nam, ev.id as id, 
                not exists (select zsd.id_var  from zvd_sert_disable zsd where zsd.id_sert = $1 and zsd.id_var=ev.id) as stat
                from elrtr_vars ev order by ev.id`;
            const header = ["id", "Вариант", "Статус"];
            const param = {
                id: { "width": -1 },
            };
            const data = await autorest.getRoData("Конфигурация варианта", query, [Number(req.params["id_doc"])], header, 1, param);
            res.json(data);
        } catch (error) {
            res.status(500).type("text/plain").send(error.message);
        }
    });

    app.patch("/docs/variants/patch/:id_doc", bodyParser.json(), async (req, res) => {
        try {
            const id_var = req.body.id;
            let query;
            if (req.body.value) {
                query = "delete from zvd_sert_disable where id_sert = $1 and id_var = $2";
            } else {
                query = "insert into zvd_sert_disable (id_sert, id_var) values ($1, $2) ON CONFLICT DO NOTHING";
            }

            const data = await db.tx(async t => {
                await autorest.setSqlContext(t, req);
                return await t.any(query, [Number(req.params["id_doc"]), Number(id_var)]);
            });

            res.json(data);
        } catch (error) {
            res.status(500).type("text/plain").send(error.message);
        }
    });

    app.delete("/docs/variants/delete/:id_doc", async (req, res) => {
        try {
            const data = await db.tx(async t => {
                await autorest.setSqlContext(t, req);
                const query="delete from zvd_sert_disable where id_sert = $1";
                return await t.any(query, [Number(req.params["id_doc"])]);
            });

            res.json(data);
        } catch (error) {
            res.status(500).type("text/plain").send(error.message);
        }
    });

    app.post("/docs/variants/post/:id_doc", bodyParser.json(), async (req, res) => {
        try {
            const data = await db.tx(async t => {
                await autorest.setSqlContext(t, req);
                const query = "insert into zvd_sert_disable (id_sert, id_var) (select $1, ev.id from elrtr_vars ev) ON CONFLICT DO NOTHING";
                return await t.any(query, [Number(req.params["id_doc"])]);
            });

            res.json(data);
        } catch (error) {
            res.status(500).type("text/plain").send(error.message);
        }
    });
}