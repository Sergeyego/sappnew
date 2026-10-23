const db = require('../../../../postgres.js');

let getHeaderData = async function (id, is_ship=true) {
    let query = is_ship ? 
        "select w.id_wparti as id, w.m_netto as massa, s.nom_s as nomer, coalesce(s.dat_vid,($2)::date) as datvid, m.n_s as n_s, "+
        "date_part('year',m.dat) as year, m.dat as dat, "+
        "b.n_plav as nplav, prov.nam as sprov, pprov.nam as prov, d.diam as diam, k.nam as spool, "+
        "pol.naim as pol, pol1.naim as pol2, pol1.naim_en as pol2_en, pprov.is_cored as is_cored, pol.naim_en as pol_en, k.short_en as spool_en, coalesce(bprov.nam, pprov.nam) as bprov, "+
        "(w.id::int8+((p.id::int8)<<32)::int8)::varchar as code, w.id as id_ship, w.hash as hash, s.doublepol as doublepol "+
        "from wire_shipment_consist as w "+
        "inner join sertifikat as s on w.id_ship=s.id "+
        "inner join wire_parti as p on w.id_wparti=p.id "+
        "inner join wire_parti_m as m on p.id_m=m.id "+
        "inner join prov_buht as b on m.id_buht=b.id "+
        "inner join prov_prih as pr on b.id_prih=pr.id "+
        "inner join provol as prov on pr.id_pr=prov.id "+
        "inner join provol as pprov on m.id_provol=pprov.id "+
        "left join provol as bprov on pprov.id_base=bprov.id "+
        "inner join diam as d on m.id_diam=d.id "+
        "inner join poluch as pol1 on s.id_pol=pol1.id "+
        "inner join poluch as pol on w.id_pol=pol.id "+
        "inner join wire_pack_kind as k on p.id_pack=k.id "+
        "where w.id = $1 "
        :
        "select p.id as id, m.kvo as massa, NULL as nomer, ($2)::date as datvid, m.n_s as n_s, "+
        "date_part('year',m.dat) as year, m.dat as dat, "+
        "b.n_plav as nplav, prov.nam as sprov, pprov.nam as prov, d.diam as diam, k.nam as spool, "+
        "NULL as pol, NULL as pol2, NULL as pol2_en, pprov.is_cored as is_cored, NULL as pol_en, k.short_en as spool_en, coalesce(bprov.nam, pprov.nam) as bprov, "+
        "(0::int8+((p.id::int8)<<32)::int8)::varchar as code, NULL as id_ship, NULL as hash, false as doublepol "+
        "from wire_parti as p "+
        "inner join wire_parti_m as m on p.id_m=m.id "+
        "inner join prov_buht as b on m.id_buht=b.id "+
        "inner join prov_prih as pr on b.id_prih=pr.id "+
        "inner join provol as prov on pr.id_pr=prov.id "+
        "inner join provol as pprov on m.id_provol=pprov.id "+
        "left join provol as bprov on pprov.id_base=bprov.id "+
        "inner join diam as d on m.id_diam=d.id "+
        "inner join wire_pack_kind as k on p.id_pack=k.id "+
        "where p.id = $1 ";
    const data = await db.one(query, [ Number(id), new Date()] );
    return data;
}

let getTuData = async function (id) {
    let query="select g.nam as nam from wire_parti_gost as w "+
        "inner join gost_new as g on w.id_gost=g.id "+
        "where w.id_parti = (select p.id_m from wire_parti as p where p.id = $1 ) order by g.nam";
    const data = await db.any(query, [ Number(id)] );
    return data;
}

let getChemData = async function (id) {
    let query="select c.sig as sig, w.value as val from wire_parti_chem as w "+
        "inner join chem_tbl as c on w.id_chem=c.id "+
        "where w.id_part = (select p.id_m from wire_parti as p where p.id= $1 ) order by c.sig";
    const data = await db.any(query, [ Number(id)] );
    return data;
}

let getMechData = async function (id) {
    let query =
        `select * from (
        (select w.id_cat as id_cat, 
        m.nam_html as nam, m.sig_html as sig, m.prefix as prefix, w.value as val, w.value_max as val_max, 
        m.nam_html_en as nam_en, m.sig_html_en as sig_en, m.prefix_en as prefix_en, mc.nam as catnam, mc.nam_en as catnam_en 
        from wire_parti_mech as w 
        inner join mech_tbl as m on w.id_mech=m.id 
        inner join wire_parti_m as p on p.id=w.id_part 
        inner join provol as prov on p.id_provol=prov.id 
        inner join mech_category mc on mc.id=w.id_cat 
        where w.id_part = (select p.id_m from wire_parti as p where p.id = $1 ))
        union
        (select wm.id_cat, mt.nam, null, mn.nam, null, null, mt.nam_en, null, mn.nam_en, mc.nam, mc.nam_en 
        from wire_mechx wm
        inner join mechx_tbl mt on mt.id = wm.id_mechx 
        inner join mechx_nams mn on mn.id = wm.id_value 
        inner join mech_category mc on mc.id = wm.id_cat 
        where wm.id_part = (select p.id_m from wire_parti as p where p.id = $1 )
        )) as r order by r.id_cat, r.nam`;
    const data = await db.any(query, [ Number(id)] );
    return data;
}

let getSertData = async function (id) {
    let query="select i.id_ved as id_ved, i.vid as doc_nam, i.ved as ved_nam, i.nom as nom_doc, i.dat as dat_doc, "+
        "i.vid_en as doc_nam_en, i.ved_en as ved_nam_en, i.id_doc as id_doc, i.en as en, i.id_doc_t as id_doc_t, i.ved_short as ved_short, "+
        "i.ved_short_en as ved_short_en, i.grade as grade_nam, i.is_simb as is_simb "+
        "from zvd_get_wire_sert_var( "+
        "(select dat from wire_parti_m where id= (select p.id_m from wire_parti as p where p.id = $1 ) ), "+
        "(select id_provol from wire_parti_m where id= (select p.id_m from wire_parti as p where p.id = $1 ) ), "+
        "(select id_diam from wire_parti_m where id= (select p.id_m from wire_parti as p where p.id = $1 ) ), "+
        "(select p.id_var from wire_parti as p where p.id = $1 ) "+
        ") as i order by i.id_ved";
    const data = await db.any(query, [ Number(id)] );
    return data;
}

module.exports.getHeaderData = getHeaderData;
module.exports.getTuData = getTuData;
module.exports.getChemData = getChemData;
module.exports.getMechData = getMechData;
module.exports.getSertData = getSertData;