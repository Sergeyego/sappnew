const locale = require('../locale.js');
const autorest = require('./autorest.js');
const db = require('../postgres.js');
const bodyParser = require('body-parser');

module.exports = function (app) {
    
    app.get("/autorest/upddata", async (req, res) => {
        const upd = await autorest.updData();
        if (upd.ok){
            res.status(200).type('text/plain');
            res.send("Обновлено успешно");
        } else {
            res.status(404).type('text/plain');
            res.send(upd.error);
        }
    });

    app.get("/autorest/tableinfo/:tablename", async (req, res) => {
        try {
            data = await autorest.getTblInfo(req.params["tablename"]);
            res.json(data);
        } catch (error) {
            res.status(404).type('text/plain');
            res.send(error.message);
        }
    });

    app.get("/autorest/relinfo/:name", async (req, res) => {
        try {
            data = await autorest.getRelInfo(req.params["name"]);
            res.json(data);
        } catch (error) {
            res.status(404).type('text/plain');
            res.send(error.message);
        }
    });

    app.use("/autorest/tables/:tablename", bodyParser.json(), async (req, res) => {
        autorest.getData(req.params["tablename"], req)
            .then((data) => {
                res.json(data)
            })
            .catch((error) => {
                //console.log('ERROR:', error);
                res.status(500).type('text/plain');
                res.send(error.message);
            })
    });

    app.get("/autorest/relations/:name", async (req, res) => {
        try {
            const rel = await autorest.getRelInfo(req.params["name"]);
            let like = req.query.like;
            const key = req.query.key;
            let limit = "";
            if (!locale.isEmptyStr(like)){
                like=like.replace(/'/g,"''");
                like=like.replace(/\//g,"//");
                like=like.replace(/%/g,"/%");
                like=like.replace(/_/g,"/_");
                limit="30";
            } else {
                limit = (rel.lim===null) ? "" : String(rel.lim);
            }
            let query = "SELECT " + rel.col_id + " AS key, " + rel.col_val + " AS disp FROM " + rel.tablename;
            if (!locale.isEmptyStr(rel.flt) || !locale.isEmptyStr(like) || !locale.isEmptyStr(key)){
                let flt = "";
                if (!locale.isEmptyStr(rel.flt)) {
                    flt+=rel.flt;
                }
                if (!locale.isEmptyStr(key)) {
                    if (flt.length){
                        flt+=" AND ";
                    }
                    flt+=rel.col_id+" = ${key}";
                }
                if (!locale.isEmptyStr(like)){
                    if (flt.length){
                        flt+=" AND ";
                    }
                    flt += rel.col_val+" ILIKE '"+like+"%' ESCAPE '/'";
                }
                query+=" WHERE "+flt;
            }
            if (!locale.isEmptyStr(rel.sort)) {
                query += " ORDER BY " + rel.sort;
            }
            if (!locale.isEmptyStr(limit)) {
                query += " LIMIT " + limit;
            }
            //console.log(query);
            db.any(query,{key : key})
                .then((data) => {
                    res.json(data)
                })
                .catch((error) => {
                    console.log('ERROR:', error);
                    res.status(500).type('text/plain');
                    res.send(error.message);
                })
        } catch (error) {
            res.status(404).type('text/plain');
            res.send(error.message);
        }
    });
}