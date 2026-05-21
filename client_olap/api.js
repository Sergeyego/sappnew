const db = require('../postgres.js');

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
        db.one("select nam as nam, array_to_json(columns) as columns, dc as dec from olaps where id = $1", [Number(req.params["id"])])
            .then((data) => {
                res.json(data);
            })
            .catch((error) => {
                console.log('ERROR:', error);
                res.status(500).type('text/plain');
                res.send(error.message);
            })
    });
}