const db = require('../../../../postgres.js');
const autorest = require('../../../../autorest/autorest.js');
//const sql = require('../../../../sql.js');
//var bodyParser = require('body-parser');

module.exports = function (app) {

    app.get("/elrtr/variants/list/:id_el", async (req, res) => {
        try {
            const query = `select ev2.id as id, ev2.nam as nam from el_var ev 
                inner join elrtr_vars ev2 on ev2.id = ev.id_var 
                where id_el = $1 order by ev.id_var`;
            const header = ["id", "Наименование"];
            const param = {
                id: { "width": -1 },
            };
            const data = await autorest.getRoData("Варианты марки", query, [Number(req.params["id_el"])], header, 1, param);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/elrtr/variants/get/:id_el/:id_var", async (req, res) => {
        try {
            const query = `select znam, descr, proc, descrtu, id_gost_type from el_var where id_el = $1 and id_var = $2`;
            const data = await autorest.getRoData("Вариант марки", query, [Number(req.params["id_el"]), Number(req.params["id_var"])]);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });
}