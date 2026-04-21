const restinfo = require('./restinfo.js');
const locale = require('../locale.js');
//const autorest = require('./../../../autorest/autorest.js');
const db = require('../postgres.js');

module.exports = function (app) {
    app.get("/autorest/tableinfo/:tablename", async (req, res) => {
        if (restinfo.tables.has(req.params["tablename"])) {
            res.json(restinfo.tables.get(req.params["tablename"]));
        } else {
            res.status(404).type('text/plain');
            res.send("Не найдена таблица '" + req.params["tablename"] + "'");
        }
    });

    app.get("/autorest/relations/:name", async (req, res) => {
        if (restinfo.rels.has(req.params["name"])) {
            let like = req.query.like;
            const rel = restinfo.rels.get(req.params["name"]);
            const lim = (rel.lim===null) ? "" : String(rel.lim);
            const limit = locale.isEmptyStr(like) ? lim : "30";
            let query = "SELECT " + rel.col_id + " AS key, " + rel.col_val + " AS disp FROM " + rel.tablename;
            if (!locale.isEmptyStr(rel.flt) || !locale.isEmptyStr(like)){
                query+=" WHERE ";
                if (!locale.isEmptyStr(rel.flt)) {
                    query += rel.flt;
                    if (!locale.isEmptyStr(like)){
                        query+=" AND ";
                    }
                }
                if (!locale.isEmptyStr(like)){
                    query+=rel.col_val+" ILIKE '"+like+"%' ESCAPE '/'";
                }
            }

            if (!locale.isEmptyStr(rel.sort)) {
                query += " ORDER BY " + rel.sort;
            }
            if (!locale.isEmptyStr(limit)) {
                query += " LIMIT " + limit;
            }
            //console.log(query);
            db.any(query)
                .then((data) => {
                    res.json(data)
                })
                .catch((error) => {
                    console.log('ERROR:', error);
                    res.status(500).type('text/plain');
                    res.send(error.message);
                })
        } else {
            res.status(404).type('text/plain');
            res.send("Не найдено отношение '" + req.params["name"] + "'");
        }
    });
}