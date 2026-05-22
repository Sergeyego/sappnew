const db = require('../../../../postgres.js');
const autorest = require('../../../../autorest/autorest.js');
const sql = require('../../../../sql.js');
//const locale = require('../../../../locale.js');

const sqlByPart = sql('routes/api/elrtr/glass/partCons.sql');
const sqlConsStat = sql('routes/api/elrtr/glass/consStat.sql');
const sqlConsStatPar = sql('routes/api/elrtr/glass/consStatPar.sql');

module.exports = function (app) {

    app.get("/elrtr/glass/:id_part/:id_cons", async (req, res) => {
        try {
            const id_part = Number(req.params["id_part"]);
            let data = {};
            let parData = {};
            const cons = await db.any(sqlByPart,[id_part, Number(req.params["id_cons"])]);
            if (cons.length){
                const id_load = cons[0].id;
                data = await autorest.getRoData("",sqlConsStat,[id_load]);
                parData = await autorest.getRoData("",sqlConsStatPar,[id_load, id_part]);
                //console.log(parData);
            }
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain');
            res.send(error.message);
        }
    });
}