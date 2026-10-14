const db = require('../../../../postgres.js');

let getHeaderData = async function (id, is_ship=true) {
    let query = is_ship ? 
        "select p.id as id, p.n_s as n_s, p.yea as year, p.dat_part as dat, e.marka_sert as marka, p.diam as diam, "+
        "gt.nam as gt, pu.nam as pu, coalesce (p.ibco, ev.znam) as znam, coalesce(pp.nam, pe.nam) as provol, pol.naim as pol, pol1.naim as pol2, pol1.naim_en as pol2_en, "+
        "s.nom_s as nomer, coalesce(s.dat_vid, $2 ) as datvid, o.massa as massa, pol.naim_en as pol_en, (o.id::int8+((p.id::int8)<<32)::int8)::varchar as code, "+
        "o.id as id_ship, o.hash as hash, s.doublepol as doublepol "+
        "from otpusk as o "+
        "inner join sertifikat as s on o.id_sert=s.id "+
        "inner join parti as p on o.id_part=p.id "+
        "inner join elrtr as e on e.id=p.id_el "+
        "inner join provol as pe on pe.id=e.id_gost "+
        "left join provol as pp on pp.id=p.id_prfact and pp.id in (select ep.id_prov from el_provol as ep where ep.id_el = p.id_el) "+
        "inner join poluch as pol1 on s.id_pol=pol1.id "+
        "inner join poluch as pol on o.id_pol=pol.id "+
        "inner join el_var as ev on ev.id_el = p.id_el and ev.id_var = p.id_var "+
        "inner join gost_types as gt on ev.id_gost_type=gt.id "+
        "inner join purpose as pu on e.id_purpose=pu.id "+
        "where o.id = $1" 
        :
        "select p.id as id, p.n_s as n_s, p.yea as year, p.dat_part as dat, e.marka_sert as marka, p.diam as diam, "+
        "gt.nam as gt, pu.nam as pu, coalesce (p.ibco, ev.znam) as znam, coalesce(pp.nam, pe.nam) as provol, NULL as pol, NULL as pol2, NULL as pol2_en, "+
        "NULL as nomer, ($2)::date as datvid, get_prod($1) as massa, NULL as pol_en, (0::int8+((p.id::int8)<<32)::int8)::varchar as code, "+
        "NULL as id_ship, NULL as hash, false as doublepol "+
        "from parti as p "+
        "inner join elrtr as e on e.id=p.id_el "+
        "inner join provol as pe on pe.id=e.id_gost "+
        "left join provol as pp on pp.id=p.id_prfact and pp.id in (select ep.id_prov from el_provol as ep where ep.id_el = p.id_el) "+
        "inner join el_var as ev on ev.id_el = p.id_el and ev.id_var = p.id_var "+
        "inner join gost_types as gt on ev.id_gost_type=gt.id "+
        "inner join purpose as pu on e.id_purpose=pu.id "+
        "where p.id = $1";
    const data = await db.one(query, [ Number(id), new Date()] );
    return data;
}

let getTuData = async function (id) {
    let query="select nam as nam "+
        "from zvd_get_tu_var((select dat_part from parti where id = $1 ), "+
        "(select id_el from parti where id = $1 ), "+
        "(select d.id from diam as d where d.diam = (select diam from parti where id = $1 )), "+
        "(select id_var from parti where id = $1 ) ) ";
    const data = await db.any(query, [ Number(id)] );
    return data;
}

let getIntData = async function (id) {
    let query="select ic.nam as nam, eic.val as val "+
        "from el_int_class eic "+
        "inner join int_class ic on ic.id = eic.id_class "+
        "where eic.id_el = (select id_el from parti where id = $1) and "+
        "eic.id_var = (select id_var from parti where id = $1) "+
        "order by ic.nam";
    const data = await db.any(query, [ Number(id)] );
    return data;
}

let getChemData = async function (id) {
    let query="select c.sig as sig, s.value as val from sert_chem as s "+
        "inner join chem_tbl as c on s.id_chem=c.id "+
        "where s.id_part = $1 order by c.sig";
    const data = await db.any(query, [ Number(id)] );
    return data;
}

let getMechData = async function (id) {
    let query="select um.id_cat as id_cat, um.nam_html as nam, um.sig_html as sig, um.prefix as prefix, um.value as val, "+
        "um.nam_html_en as nam_en, um.sig_html_en as sig_en, um.prefix_en as prefix_en, mc.nam as catnam, mc.nam_en as catnam_en "+
        "from ( "+
        "select m.id_cat, m.nam_html, m.sig_html, m.prefix, s.value, m.nam_html_en, m.sig_html_en, m.prefix_en "+
        "from sert_mech as s "+
        "inner join mech_tbl as m on s.id_mech=m.id "+
        "where s.id_part = $1 "+
        "union "+
        "select t.id_cat, t.nam, null, n.nam, null, t.nam_en, null, n.nam_en from sert_mechx as x "+
        "inner join mechx_tbl as t on x.id_mechx=t.id "+
        "inner join mechx_nams as n on x.id_value=n.id "+
        "where x.id_part = $1 "+
        ") as um "+
        "inner join mech_category mc on mc.id=um.id_cat "+
        "order by um.id_cat, um.nam_html";
    const data = await db.any(query, [ Number(id)] );
    return data;
}

let getSertData = async function (id) {
    let query="select z.id_ved, z.doc_nam, z.ved_nam, z.nom_doc, z.dat_doc, z.id_doc_t, z.ved_short, "+
        "z.grade_nam, z.ved_short_en, z.doc_nam_en, z.ved_nam_en, z.id_doc, z.en, z.is_simb "+
        "from zvd_get_sert_var((select dat_part from parti where id = $1 ), "+
        "(select id_el from parti where id = $1 ), "+
        "(select d.id from diam as d where d.diam = (select diam from parti where id = $1 )), "+
        "(select id_var from parti where id = $1 ) ) as z";
    const data = await db.any(query, [ Number(id)] );
    return data;
}

module.exports.getHeaderData = getHeaderData;
module.exports.getTuData = getTuData;
module.exports.getChemData = getChemData;
module.exports.getMechData = getMechData;
module.exports.getSertData = getSertData;
module.exports.getIntData = getIntData;