const db = require('../postgres.js');
const restinfo = require('./restinfo.js');
const locale = require('../locale.js');
const sql = require('../sql.js');

const sqlTableInfo = sql('autorest/tableinfo.sql');

let mapType = new Map([
    [16, "bool"],
    [17, "bytea"],
    [18, "char"],
    [20, "int8"],
    [21, "int2"],
    [23, "int4"],
    [24, "regproc"],
    [25, "text"],
    [26, "oid"],
    [27, "tid"],
    [28, "xid"],
    [29, "cid"],
    [30, "json"],
    [142, "xml"],
    [194, "pg_node_tree"],
    [210, "smgr"],
    [602, "path"],
    [604, "polygon"],
    [650, "cidr"],
    [700, "float4"],
    [701, "float8"],
    [702, "abstime"],
    [703, "reltime"],
    [704, "tinterval"],
    [718, "circle"],
    [774, "macaddr8"],
    [790, "money"],
    [829, "macaddr"],
    [869, "inet"],
    [1033, "aclitem"],
    [1042, "bpchar"],
    [1043, "varchar"],
    [1082, "date"],
    [1083, "time"],
    [1114, "timestamp"],
    [1184, "timestamptz"],
    [1186, "interval"],
    [1266, "timetz"],
    [1560, "bit"],
    [1562, "varbit"],
    [1700, "numeric"],
    [1790, "refcursor"],
    [2202, "regprocedure"],
    [2203, "regoper"],
    [2204, "regoperator"],
    [2205, "regclass"],
    [2206, "regtype"],
    [2950, "uuid"],
    [2970, "txid_snapshot"],
    [3220, "pg_lsn"],
    [3361, "pg_ndistinct"],
    [3402, "pg_dependencies"],
    [3614, "tsvector"],
    [3615, "tsquery"],
    [3642, "gtsvector"],
    [3734, "regconfig"],
    [3769, "regdictionary"],
    [3802, "jsonb"],
    [4089, "regnamespace"],
    [4096, "regrole"]
]);

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
            const cols = await db.any(sqlTableInfo, [tables[i].tablename]);
            //console.log(cols);
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
    if (val===null) return "";
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
        /*case "time":
        case "timetz":
            ret=locale.insTime(val);
            break;*/
        default:
            ret=val;
    }
    return ret;
}

let getFltStr = function (tname, obj){
    const tbl = restinfo.tables.get(tname);
    let flt = "";
    for (const key in obj) {
        if (flt!=""){
            flt+=" and ";
        }
        flt+=tbl.tablename+"."+key+" = "+"${"+key+"}";
    }
    return flt;
} 

let selectDb = async function (tname, flt, params){
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

    let query = "SELECT "+colstr;
    if (!locale.isEmptyStr(coljoin)){
        query+=", "+coljoin;
    }
    query+=" FROM "+tbl.tablename+" "+joinstr;
    if (!locale.isEmptyStr(flt)){
        query+="WHERE "+flt;
    }

    if (!locale.isEmptyStr(tbl.sort)){
        query+=" ORDER BY "+tbl.sort;
    }

    //console.log(query);
    const data = await db.any(query, params);

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

let insertDb = async function (tname, body){
    const tbl = restinfo.tables.get(tname);
    const col = tbl.columns;
    let colstr = "";
    let valstr = "";
    let idstr = "";

    col.forEach(function (cl) {
        if (body[cl.nam]!==null && body[cl.nam]!==undefined){
            //console.log(cl.nam, body[cl.nam]);
            if (colstr!=""){
                colstr+=", ";
                valstr+=", ";
            }
            colstr+=cl.col;
            valstr+="${"+cl.nam+"}";
        }
        if (cl.is_pk){
            if (idstr!=""){
                idstr+=", ";
            }
            idstr+=cl.col;
        }
    });

    let query = "INSERT INTO "+tbl.tablename+" ("+colstr+") VALUES ("+valstr+") RETURNING "+idstr;
    //console.log(query);
    const pks = await db.one(query, body);
    return pks;
}

let updateDb = async function (tname, body){
    const tbl = restinfo.tables.get(tname);
    const col = tbl.columns;
    let valstr = "";
    let idstr = "";
    let fltstr = "";
    let parobj = {};
    let pkobj = {};

    const new_row=body.new_row;
    const old_row=body.old_row;
    col.forEach(function (cl) {
        if (new_row[cl.nam]!==old_row[cl.nam]){
            //console.log(cl.nam, new_row[cl.nam]);
            if (valstr!=""){
                valstr+=", ";
            }
            valstr+=cl.col+" = ${"+cl.nam+"}";
            parobj[cl.nam] = new_row[cl.nam];
        }
        if (cl.is_pk){
            if (idstr!=""){
                idstr+=", ";
                fltstr+=" and ";
            }
            idstr+=cl.col;
            fltstr+=cl.col+" = ${pk_"+cl.col+"}";
            parobj["pk_"+cl.col]=old_row[cl.nam];
            pkobj[cl.col]=old_row[cl.nam];
        }
    });

    let pks = {};

    if (valstr.length){
        let query = "UPDATE "+tbl.tablename+" SET "+valstr+" WHERE "+fltstr+" RETURNING "+idstr;
        //console.log(query);
        //console.log(parobj);
        pks = await db.one(query, parobj);
    } else {
        pks = pkobj;
    }
    return pks;
}

let deleteDb = async function (tname, pks){
    const tbl = restinfo.tables.get(tname);
    const col = tbl.columns;
    let idstr = "";
    let pkstr = "";

    col.forEach(function (cl) {
        if (cl.is_pk){
            if (idstr!=""){
                idstr+=" and ";
                pkstr+=", ";
            }
            idstr+=cl.col+" = ${"+cl.nam+"}";
            pkstr+=cl.col;
        }
    });

    let query = "DELETE FROM "+tbl.tablename+" WHERE "+idstr+" RETURNING "+pkstr;
    //console.log(query);
    //console.log(pks);
    const ret = await db.one(query, pks);
    return ret;
}

let getData = async function (tname, req) {
    //console.log(req.method, tname);
    let data = {};
    if (req.method=="GET"){
        data = await selectDb(tname, req.query.filter);
    } else if (req.method=="POST") {
        const pks = await insertDb(tname, req.body);
        data = await selectDb(tname, getFltStr(tname, pks), pks);
        //console.log(data);
    } else if (req.method=="PUT") {
        const pks = await updateDb(tname, req.body);
        data = await selectDb(tname, getFltStr(tname, pks), pks);
        //console.log(data);
    } else if (req.method=="DELETE") {
        await deleteDb(tname, req.query);
    }
    return data;
}

let getRoData = async function (title, query, param, mapConf) {
    const data = await db.result(query,param);

    let res = {};
    res['title']=title;

    let arr_fields = new Array;
    for (let i=0; i<data.fields.length; i++){
        let ob = {};
        ob["name"] = data.fields[i].name;
        ob["udt_name"] = mapType.get(data.fields[i].dataTypeID);
        ob["snam"] = (mapConf.has(data.fields[i].name) && Object.hasOwn(mapConf.get(data.fields[i].name),'name')) ? mapConf.get(data.fields[i].name).name : data.fields[i].name;
        ob["dec"] = (mapConf.has(data.fields[i].name) && Object.hasOwn(mapConf.get(data.fields[i].name),'dec')) ? mapConf.get(data.fields[i].name).dec : 1;
        arr_fields.push(ob);
    }
    res['fields']=arr_fields;
    
    let arr_row = new Array;
    for (let i = 0; i < data.rows.length; i++) {
        let tbl_col = {};
        for (j=0; j<arr_fields.length; j++){
            let ob = {};
            ob["edit_role"] = data.rows[i][arr_fields[j].name];
            ob["display_role"] = getDisplay(data.rows[i][arr_fields[j].name],arr_fields[j].udt_name,arr_fields[j].dec);
            ob["background_role"] = "#FFFFFF";
            ob["tooltip_role"] = "";
            tbl_col[arr_fields[j].name] = ob;
        }
        arr_row.push(tbl_col);
    }
    res['rows']=arr_row;

    return /*data*/res;
}

module.exports = {
    getRoData,
    getData,
    updData
};