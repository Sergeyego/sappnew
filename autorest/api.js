const restinfo = require('./restinfo.js');
//const autorest = require('./../../../autorest/autorest.js');
//const db = require('../../../postgres.js');

module.exports = function (app) {
    app.get("/autorest/tableinfo/:tablename", async (req, res) => {
        if (restinfo.tables.has(req.params["tablename"])){
            res.json(restinfo.tables.get(req.params["tablename"]));
        } else {
            res.status(404).type('text/plain');
            res.send("Не найдена таблица '"+req.params["tablename"]+"'");
        }
    })
}