const restinfo = require('../../../autorest/restinfo.js');
const db = require('../../../postgres.js');

module.exports = function (app) {
    const autorest = require('./../../../autorest/autorest.js');

    app.use("/elrtr/parti", async (req, res) => {
        let data = await autorest.getData("el_parti", req);

        const state = await db.any("select parti.id, " +
            "(select case when exists(select id from parti_chem where id_part=parti.id) " +
            "then 1 else 0 end " +
            "+ " +
            "case when exists(select id from parti_mech where id_part=parti.id) " +
            "then 2 else 0 end " +
            "as r) from parti where parti.dat_part between $1 and $2", ['2026-01-01', '2026-12-31']);
        mapStat = new Map();
        for (i=0; i<state.length; i++){
            let col = "#FFFFFF";
            const r = state[i].r;
            if (r == 1) {
                col="#FFAAAA";
            } else if (r == 2) {
                col="#AAFFAA";
            } else if (r == 3) {
                col="#FFFF00";
            }
            mapStat.set(state[i].id,col);
        }
        const tbl = restinfo.tables.get("el_parti");
        const col = tbl.columns;
        for (i=0; i<data.length; i++){
            col.forEach(function (cl) {
                if (mapStat.has(data[i].id.edit_role)){
                    data[i][cl.nam].background_role=mapStat.get(data[i].id.edit_role);
                }
            })
        }
        //console.log(mapStat);
        //let d = await autorest.updData();
        //console.log(/*global.rest_tables*/restinfo.tables);
        //res.type('text/plain');
        //res.send(data);
        res.json(data);
    })
}