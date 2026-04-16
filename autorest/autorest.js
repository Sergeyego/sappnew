const db = require('../postgres.js');
const restinfo = require('./restinfo.js');
const locale = require('../locale.js');

let updData = async function () {
    let err = "";
    let ok = true;
    try {
        const rels = await db.any("select rr.nam, rr.tablename, rr.col_id, rr.col_val, rr.sort, rr.lim, rr.flt from rest_rels rr ");
        const tables = await db.any("select nam, tablename, sort from rest_tables");

        const mapRel = new Map();
        for (let i = 0; i < rels.length; i++) {
            mapRel.set(rels[i].nam, rels[i]);
        }

        const mapTbl = new Map();
        for (let i = 0; i < tables.length; i++) {
            const cols = await db.any("select rtd.nam, rtd.col, rtd.snam, c.udt_name, coalesce((tc.constraint_type = 'PRIMARY KEY'), false) as is_pk, " +
                "rtd.editable, rtd.checkable ,rtd.dec, rr.nam as relnam " +
                "from rest_tables rt " +
                "inner join rest_tables_data rtd on rtd.id_table = rt.id " +
                "inner join information_schema.columns c on c.column_name = rtd.col and c.table_name = rt.tablename " +
                "left join information_schema.key_column_usage kcu on kcu.column_name = c.column_name and c.table_name = kcu.table_name " +
                "left join information_schema.table_constraints tc on tc.constraint_name = kcu.constraint_name and tc.table_name = kcu.table_name " +
                "left join rest_rels rr on rr.id = rtd.id_rel " +
                "where rt.tablename = $1 order by rtd.id", [tables[i].tablename]);

            mapTbl.set(tables[i].nam, { tablename: tables[i].tablename, sort: tables[i].sort, columns: cols });
        }

        restinfo.tables = mapTbl;
        restinfo.rels = mapRel;
    } catch (error) {
        console.log(error.message);
        err = error.message;
        ok = false;
    }
    return { error: err, ok: ok };
}

let getDisplay = function (val, type, dec) {
    let ret;
    switch (type) {
        case "bool":
            ret=val ? "Да" : "Нет";
            break;
        case "text":
        case "varchar":
            ret=locale.isEmptyStr(val) ? '' : val;
            break;
        case "int2":
        case "int4":
        case "int8":
            ret=locale.insNumber(val,0);
            break;
        case "float4":
        case "float8":
        case "numeric":
            ret=locale.insNumber(val,dec);
            break;
        case "date":
            ret=locale.insDate(val);
            break;
        case "timestamp":
        case "timestamptz":
            ret=locale.insDateTime(val);
            break;
        case "time":
        case "timetz":
            ret=locale.insTime(val);
            break;
        default:
            ret=val;
    }
    return ret;
}

let selectDb = async function (tname, flt){
    const tbl = restinfo.tables.get(tname);
    const col = tbl.columns;
    //console.log(col);
    let colstr = "";
    let joinstr = "";
    let coljoin = "";
    col.forEach(function (cl) {
        if (colstr!=""){
            colstr+=", ";
        }
        colstr+=tbl.tablename+"."+cl.col+" AS "+cl.nam;
        if (!locale.isEmptyStr(cl.relnam)){
            if (coljoin!=""){
                coljoin+=", ";
            }
            const rel=restinfo.rels.get(cl.relnam);
            coljoin+=cl.relnam+"."+rel.col_val+" AS jcol_"+cl.nam;
            joinstr+="LEFT JOIN "+rel.tablename+" AS "+cl.relnam+" ON "+cl.relnam+"."+rel.col_id+" = "+tbl.tablename+"."+cl.col+" ";
        }
    });

    let query = "SELECT "+colstr+", "+coljoin+" FROM "+tbl.tablename+" "+joinstr;
    if (!locale.isEmptyStr(flt)){
        query+="WHERE "+flt;
    }

    if (!locale.isEmptyStr(tbl.sort)){
        query+=" ORDER BY "+tbl.sort;
    }

    //console.log(query);
    const data = await db.any(query);

    let obj = new Array;
    for (let i = 0; i < data.length; i++) {
        let tbl_col = {};
        //console.log(data[i]);

        col.forEach(function (cl) {
            let ob = {};
            ob["edit_role"] = data[i][cl.nam];
            ob["display_role"] = (!locale.isEmptyStr(cl.relnam)) ? locale.insText(data[i]["jcol_"+cl.nam]) : getDisplay(data[i][cl.nam],cl.udt_name,cl.dec);
            ob["background_role"] = "#FFFFFF";
            ob["tooltip_role"] = "";
            tbl_col[cl.nam] = ob;
        })
        obj.push(tbl_col);
    }
    return obj;
}

let getData = async function (tname, req) {
    console.log(req.method);
    let data = {};
    if (req.method=="GET"){
        data = await selectDb(tname, "parti.dat_part>='2026-01-01'");
    }
    return data;
}

/*updData()
    .then((dt) => {
    })*/

//rest_tables = updData();

module.exports = {
    //rest_tables,
    getData,
    updData
};