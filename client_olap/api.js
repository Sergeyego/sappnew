const db = require('../postgres.js');
const autorest = require('../autorest/autorest.js');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json({ limit: '10mb' });

module.exports = function (app) {

    app.get("/olap/prog/:progname", async (req, res) => {
        db.any("select o.id as id, o.nam as nam from olaps_prog op " +
            "inner join olaps o on o.id=op.id_olap " +
            "where op.prog = $1 order by o.nam", [String(req.params["progname"])])
            .then((data) => {
                res.json(data);
            })
            .catch((error) => {
                console.log('ERROR:', error);
                res.status(500).type('text/plain');
                res.send(error.message);
            })
    });

    app.get("/olap/info/:id", async (req, res) => {
        db.one("select nam as nam, array_to_json(columns) as columns, dc as dec, query as qu from olaps where id = $1", [Number(req.params["id"])])
            .then((data) => {
                res.json(data);
            })
            .catch((error) => {
                console.log('ERROR:', error);
                res.status(500).type('text/plain');
                res.send(error.message);
            })
    });

    app.post("/olap/data", jsonParser, async (req, res) => {
        try {
            let data = await autorest.getRoData(req.body.nam, req.body.qu, [], req.body.columns, req.body.dec);
            res.json(data);
        } catch (error) {
            console.error(error);
            res.status(500).send(error.message);
        }
    });
}