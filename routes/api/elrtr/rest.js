const restinfo = require('../../../autorest/restinfo.js');
const db = require('../../../postgres.js');
const autorest = require('./../../../autorest/autorest.js');
const locale = require('../../../locale.js');

module.exports = function (app) {
    const tableName = "el_parti";
    app.use("/elrtr/parti", async (req, res) => {
        try {
            let data = await autorest.getData(tableName, req);
            let query = "select parti.id, " +
                "(select case when exists(select id from parti_chem where id_part=parti.id) " +
                "then 1 else 0 end " +
                "+ " +
                "case when exists(select id from parti_mech where id_part=parti.id) " +
                "then 2 else 0 end " +
                "as r) from parti";
            if (!locale.isEmptyStr(req.query.filter)){
                query+=" where "+req.query.filter;
            }
            const state = await db.any(query);
                mapStat = new Map();
            for (i = 0; i < state.length; i++) {
                let col = "#FFFFFF";
                const r = state[i].r;
                if (r == 1) {
                    col = "#FFAAAA";
                } else if (r == 2) {
                    col = "#AAFFAA";
                } else if (r == 3) {
                    col = "#FFFF00";
                }
                mapStat.set(state[i].id, col);
            }
            const tbl = restinfo.tables.get(tableName);
            const col = tbl.columns;
            for (i = 0; i < data.length; i++) {
                col.forEach(function (cl) {
                    if (mapStat.has(data[i].id.edit_role)) {
                        data[i][cl.nam].background_role = mapStat.get(data[i].id.edit_role);
                    }
                })
            }
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain');
            res.send(error.message);
        }
    });

    app.get("/elrtr/diam", async (req, res) => {
        db.result("select *, 2, null from diam where id = 1")
            .then(result => {
                // rowCount = number of rows affected by the query
                console.log(result.rowCount); // print how many records were deleted;
                res.json(result);
            })
            .catch(error => {
                console.log('ERROR:', error);
                res.status(500).type('text/plain');
                res.send(error.message);
            });
    });
}