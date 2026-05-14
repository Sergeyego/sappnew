const restinfo = require('../../../autorest/restinfo.js');
const db = require('../../../postgres.js');
const autorest = require('./../../../autorest/autorest.js');
const locale = require('../../../locale.js');
var bodyParser = require('body-parser');

let getChemTu = async function(id_part){
    let query = "select c.id_chem, c.min, c.max from chem_tu as c where " +
        "c.id_el = (select p.id_el from parti as p where p.id = $1 ) " +
        "and c.id_var = (select p.id_var from parti as p where p.id = $1 )";
    const state = await db.any(query, [id_part]);
    mapStat = new Map();
    for (i = 0; i < state.length; i++) {
        mapStat.set(state[i].id_chem, { min: state[i].min, max: state[i].max });
    }
    return mapStat;
}

let getMechTu = async function(id_part){
    let query = "select m.id_mech, m.min, m.max from mech_tu as m where "+
            "m.id_el = (select p.id_el from parti as p where p.id = $1 )"+
            "and m.id_var = (select p.id_var from parti as p where p.id = $1 )";
    const state = await db.any(query, [id_part]);
    mapStat = new Map();
    for (i = 0; i < state.length; i++) {
        mapStat.set(state[i].id_mech, { min: state[i].min, max: state[i].max });
    }
    return mapStat;
}

let checkVal = function (tu, val) {
    let color = "#FFFFFF";
    //console.log(val);
    let inf = "";
    if (tu.max == null && tu.min != null) {
        inf += ": min " + tu.min;
        if (val < tu.min) {
            color = "#FFAAAA";
        } else if (val > tu.min) {
            color = "#AAFFAA";
        } else {
            color = "#FFFF00";
        }
    } else if (tu.min == null && tu.max != null) {
        inf += ": max " + tu.max;
        if (val > tu.max) {
            color = "#FFAAAA";
        } else if (val < tu.max) {
            color = "#AAFFAA";
        } else {
            color = "#FFFF00";
        }
    } else {
        inf += ": min " + tu.min + " max " + tu.max;
        if (val < tu.min || val > tu.max) {
            color = "#FFAAAA";
        } else if (val > tu.min && val < tu.max) {
            color = "#AAFFAA";
        } else {
            color = "#FFFF00";
        }
    }
    return {color: color, inf: inf};
}

module.exports = function (app) {
    app.use("/elrtr/parti", bodyParser.json(), async (req, res) => {
        const tableName = "el_parti";
        try {
            let data = await autorest.getData(tableName, req);
            let query = "select parti.id, " +
                "(select case when exists(select id from parti_chem where id_part=parti.id) " +
                "then 1 else 0 end " +
                "+ " +
                "case when exists(select id from parti_mech where id_part=parti.id) " +
                "then 2 else 0 end " +
                "as r) from parti";
            if (!locale.isEmptyStr(req.query.filter)) {
                query += " where " + req.query.filter;
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

    app.use("/elrtr/chem/parti", bodyParser.json(), async (req, res) => {
        const tableName = "el_parti_chem";
        try {
            let data = await autorest.getData(tableName, req);
            if (data.length) {
                const id_part = Number(data[0].id_part.edit_role);
                //console.log(id_part);
                if (id_part > 0) {
                    const mapStat = await getChemTu(id_part);
                    const tbl = restinfo.tables.get(tableName);
                    const col = tbl.columns;
                    for (i = 0; i < data.length; i++) {
                        col.forEach(function (cl) {
                            if (mapStat.has(data[i].id_chem.edit_role)) {
                                const tu = mapStat.get(data[i].id_chem.edit_role);
                                const val = Number(data[i].kvo.edit_role);
                                const ch = checkVal(tu, val);
                                data[i][cl.nam].background_role = ch.color;
                                data[i][cl.nam].tooltip_role = data[i].id_chem.display_role+ch.inf;
                            }
                        })
                    }
                }
            }
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain');
            res.send(error.message);
        }
    });

    app.use("/elrtr/mech/parti", bodyParser.json(), async (req, res) => {
        const tableName = "el_parti_mech";
        try {
            let data = await autorest.getData(tableName, req);
            if (data.length) {
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
            }
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain');
            res.send(error.message);
        }
    });
}