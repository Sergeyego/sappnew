const autorest = require('./../../../../autorest/autorest.js');
const sql = require('./../../../../sql.js');

const sqlByPart = sql('routes/api/elrtr/report/by_part.sql');

module.exports = function (app) {
    app.get("/elrtr/report", async (req, res) => {
            try {
                let mapCol = new Map();
                mapCol.set("marka", {name : "Марка"});
                let data = await autorest.getRoData("По партиям", sqlByPart,null,mapCol);
                /*if (data.length) {
                    const id_part = Number(data[0].id_part.edit_role);
                    //console.log(id_part);
                    if (id_part > 0) {
                        const mapStat = await getMechTu(id_part);
                        const tbl = restinfo.tables.get(tableName);
                        const col = tbl.columns;
                        for (i = 0; i < data.length; i++) {
                            col.forEach(function (cl) {
                                if (mapStat.has(data[i].id_mech.edit_role)) {
                                    const tu = mapStat.get(data[i].id_mech.edit_role);
                                    const val = Number(data[i].kvo.edit_role);
                                    const ch = checkVal(tu, val);
                                    data[i][cl.nam].background_role = ch.color;
                                    data[i][cl.nam].tooltip_role = data[i].id_mech.display_role+ch.inf;
                                }
                            })
                        }
                    }
                }*/
                res.json(data);
            } catch (error) {
                res.status(500).type('text/plain');
                res.send(error.message);
            }
        });

}