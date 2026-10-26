const db = require('../../../postgres.js');
const locale = require('../../../locale.js');
const bodyParser = require('body-parser');
const encode = require('html-entities');

// Выносим куку в константу для удобства замены
const SITE_COOKIE = process.env.BITRIX_COOKIE || "beget=begetok";

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

const getSiteData = async function () {
    return await db.one("select s.url as url, s.code as code from site s where s.id=1");
};

const dateString = function (dat) {
    return dat != null ? locale.insDate(dat) : '';
};

const queryString = function (obj) {
    const params = new URLSearchParams();
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            params.append(key, obj[key]);
        }
    }
    return params.toString();
};

// Хелпер для нормализации: приводит null/undefined к '', обрезает пробелы
const norm = function (v) {
    if (v === null || v === undefined || v === false) return '';
    return String(v).trim();
};

// Обновленная функция simbEq
const simbEq = function (kis, data) {
    const k = norm(kis);
    const d = norm(encode.decode(data));
    return (k === d) || (k === '-' && d === '');
};

// Обновленная функция paramEq
const paramEq = function (kis, data) {
    return norm(kis) === norm(data);
};

const lenEq = function (kis, data) {
    return data ? (kis.length == data.length) : (kis.length == 0);
};

const getElProc = function (p) {
    let proc = '';
    const sp = String(p).split(':');
    if (sp.length == 4) {
        proc = sp[0] + "±" + sp[1] + "°C " + sp[2] + " " + sp[3];
    }
    return proc;
};

const getPar = function (p) {
    return (p == '-' || p == null) ? '' : p;
};

const getWireType = function (name) {
    return name.endsWith("-О") ? "Омедненная проволока" : "Неомедненная проволока";
};

// ==========================================
// ПОЛУЧЕНИЕ ДАННЫХ ИЗ БД (БЕЗ N+1)
// ==========================================

const getDocData = async function (id_doc) {
    return await db.one(
        "select zs.nom_doc, zs.dat_beg, zs.dat_end, zs.dat_doc, zs.id_ved, " +
        "COALESCE(zs.gr_tech_ust,'') as gr_tech_ust, zd.fnam as nazv " +
        "from zvd_sert zs inner join zvd_doc zd on zd.id=zs.id_doc where zs.id = $1 ",
        [Number(id_doc)]
    );
};

const getDocsData = async function () {
    return await db.any(
        "select zs.nom_doc, zs.dat_beg, zs.dat_end, zs.dat_doc, zs.id_ved, " +
        "COALESCE(zs.gr_tech_ust,'') as gr_tech_ust, zd.fnam as nazv " +
        "from zvd_sert zs inner join zvd_doc zd on zd.id=zs.id_doc " +
        "where COALESCE(zs.dat_end,'3000-01-01')>= $1 ",
        [new Date()]
    );
};

const getElData = async function () {
    return await db.any(
        "select e.id as id, coalesce(e.marka_sert, e.marka) as marka, et.snam as vid, " +
        "g.nam as type, pu.nam as suf, d.nam as znam, i.nam as iso, a.nam as aws, e.id_pic as id_pol, " +
        "p.descr as pol, e.katalog as active, COALESCE(e.descr,'') as descr, " +
        "COALESCE(e.descr_spec,'') as descr_spec, COALESCE(e.descr_feature,'') as descr_feature, COALESCE(e.pr2,'') as proc " +
        "from elrtr as e " +
        "inner join el_types as et on e.id_vid=et.id " +
        "inner join gost_types as g on e.id_gost_type=g.id " +
        "inner join purpose as pu on e.id_purpose=pu.id " +
        "inner join denominator as d on e.id_denominator=d.id " +
        "inner join iso_types as i on e.id_iso_type=i.id " +
        "inner join aws_types as a on e.id_aws_type=a.id " +
        "inner join pics as p on e.id_pic=p.id "
    );
};

const getWireData = async function () {
    return await db.any(
        "select p.id as id, p.nam as marka, coalesce(p.description,'') as descr , " +
        "t.nam as type, COALESCE(pp.nam, p.nam) as base, p.katalog as active " +
        "from provol as p " +
        "inner join provol_type as t on t.id = p.id_type " +
        "left join provol as pp on pp.id=p.id_base"
    );
};

// --- ПАКЕТНЫЕ ЗАПРОСЫ (BULK) ---

const getElTuBulk = async function (ids) {
    if (!ids.length) return new Map();
    const data = await db.any(
        "select ids.id_el, t.nam from unnest($2::int[]) as ids(id_el) " +
        "cross join lateral zvd_get_tu_var($1, ids.id_el, 4, 1) t",
        [new Date(), ids]
    );
    return groupBy(data, 'id_el');
};

const getElAmpBulk = async function (ids) {
    if (!ids.length) return new Map();
    const data = await db.any(
        "select a.id_el, d.diam, a.bot, a.vert, a.ceil from amp as a " +
        "inner join diam as d on a.id_diam=d.id " +
        "where a.id_el = ANY($1::int[]) and a.id_var=1 order by d.diam",
        [ids]
    );
    return groupBy(data, 'id_el');
};

const getElPlavBulk = async function (ids) {
    if (!ids.length) return new Map();
    const data = await db.any(
        "select e.id_el, n.nam, e.value from el_plav as e " +
        "inner join el_plav_nams as n on e.id_plav=n.id " +
        "where e.id_el = ANY($1::int[]) order by e.id_plav",
        [ids]
    );
    return groupBy(data, 'id_el');
};

const getElChemBulk = async function (ids) {
    if (!ids.length) return new Map();
    const data = await db.any(
        "select c.id_el, t.nam, t.sig, c.min, c.max from chem_tu as c " +
        "inner join chem_tbl as t on t.id=c.id_chem " +
        "where c.id_el = ANY($1::int[]) and c.id_var=1 order by t.sig",
        [ids]
    );
    return groupBy(data, 'id_el');
};

const getElMechBulk = async function (ids) {
    if (!ids.length) return new Map();
    const data = await db.any(
        "select m.id_el, t.nam_html, t.sig_html, m.min, m.max from mech_tu as m " +
        "inner join mech_tbl as t on t.id=m.id_mech " +
        "where m.id_el = ANY($1::int[]) and m.id_var=1 order by t.nam_html",
        [ids]
    );
    return groupBy(data, 'id_el');
};

const getElDiamsBulk = async function (ids) {
    if (!ids.length) return new Map();
    const data = await db.any(
        "select z.id_el, z.diam as diam, " + 
        "(SELECT pp.key FROM jsonb_each(z.pack) as pp where pp.value::double precision = (select max(value::double precision) from jsonb_each(z.pack))) as spool " +
        "from ( " +
        "  select p.id_el, p.diam as diam, jsonb_object_agg(ep.snam, ep.mass_ed) as pack " +
        "  from otpusk o " +
        "  inner join sertifikat s on s.id = o.id_sert " +
        "  inner join parti p on p.id = o.id_part " +
        "  inner join el_pack ep on ep.id = p.id_pack " +
        "  where s.dat_vid >=(CURRENT_DATE - 1460) and ep.catalog = true and p.id_el = ANY($1::int[]) " +
        "  group by p.id_el, p.diam " +
        ") as z order by z.id_el, z.diam",
        [ids]
    );
    return groupBy(data, 'id_el');
};

const getElSertBulk = async function (ids) {
    if (!ids.length) return new Map();
    const data = await db.any(
        "select ze.id_el, zs.nom_doc as nam, ze.id_sert as id_sert, '' as diams " +
        "from zvd_els ze " +
        "inner join zvd_sert zs on zs.id = ze.id_sert " +
        "where COALESCE(zs.dat_end,'3000-01-01')>= $1 and ze.id_el = ANY($2::int[]) " +
        "union " +
        "select de.id_el, zs.nom_doc, ze.id_sert, STRING_AGG(to_char(de.dim,'FM0D0'),'#' ORDER BY de.dim) " +
        "from zvd_eldim ze " +
        "inner join zvd_sert zs on zs.id = ze.id_sert " +
        "inner join dry_els de on de.ide = ze.id_eldr " +
        "where COALESCE(zs.dat_end,'3000-01-01')>= $1 and de.id_el = ANY($2::int[]) " +
        "group by de.id_el, ze.id_sert, zs.nom_doc",
        [new Date(), ids]
    );
    return groupBy(data, 'id_el');
};

const getWireTuBulk = async function (ids) {
    if (!ids.length) return new Map();
    const data = await db.any(
        "select t.id_provol, g.nam from wire_gost as t " +
        "inner join gost_new as g on t.id_gost=g.id " +
        "where t.id_provol = ANY($1::int[]) order by g.nam",
        [ids]
    );
    return groupBy(data, 'id_provol');
};

const getWireChemBulk = async function (ids) {
    if (!ids.length) return new Map();
    const data = await db.any(
        "select p.id as id_provol, t.nam, t.sig, c.min, c.max " +
        "from provol as p " +
        "inner join wire_chem_tu as c on c.id_provol = COALESCE(p.id_base, p.id) " +
        "inner join chem_tbl as t on t.id = c.id_chem " +
        "where p.id = ANY($1::int[]) " +
        "order by t.sig",
        [ids]
    );
    return groupBy(data, 'id_provol');
};

const getWireDiamsBulk = async function (ids) {
    if (!ids.length) return new Map();
    const data = await db.any(
        "select wd.id_wire, d.diam as diam, STRING_AGG(wpk.short,'#' ORDER BY wpk.sort_order, wpk.short) as spool " +
        "from wire_diams wd " +
        "inner join diam d on d.id = wd.id_diam " +
        "inner join wire_pack_kind wpk on wpk.id = wd.id_spool " +
        "where wd.id_wire = ANY($1::int[]) and wpk.katalog = true " +
        "group by wd.id_wire, d.diam order by d.diam",
        [ids]
    );
    return groupBy(data, 'id_wire');
};

const getWireSertBulk = async function (ids) {
    if (!ids.length) return new Map();
    const data = await db.any(
        "select z.id_provol, zs.nom_doc as nam, z.id_sert as id_sert, '' as diams from zvd_wire_sert as z " +
        "inner join zvd_sert zs on zs.id = z.id_sert " +
        "where COALESCE(zs.dat_end,'3000-01-01')>= $1 and z.id_provol = ANY($2::int[]) " +
        "union " +
        "select zwds.id_provol, zs.nom_doc, zwds.id_sert, STRING_AGG(to_char(d.diam,'FM0D0'),'#' ORDER BY d.diam) " +
        "from zvd_wire_diam_sert zwds " +
        "inner join zvd_sert zs on zs.id = zwds.id_sert " +
        "inner join diam d on d.id=zwds.id_diam " +
        "where COALESCE(zs.dat_end,'3000-01-01')>= $1 and zwds.id_provol = ANY($2::int[]) " +
        "group by zwds.id_provol, zs.nom_doc, zwds.id_sert",
        [new Date(), ids]
    );
    return groupBy(data, 'id_provol');
};

// Хелпер для группировки
function groupBy(array, key) {
    const map = new Map();
    for (const item of array) {
        const k = item[key];
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(item);
    }
    return map;
}

// ==========================================
// РАБОТА С САЙТОМ
// ==========================================

const sendReq = async function (sitedata, path, method, body) {
    let err = "", ok = false, data;

    const headers = new Headers({
        "Accept": "application/json",
        "Accept-Charset": "UTF-8",
        "User-Agent": "Appszsm",
        "Cookie": SITE_COOKIE,
        "Content-Type": "application/pdf",
    });

    const url = sitedata.url + '/rest/3/' + sitedata.code + '/' + path;

    const response = await fetch(url, { method, headers, body });

    if (response.headers.get('Content-Type')?.indexOf('application/json') >= 0) {
        const jsonObj = await response.json();
        if (response.ok) {
            data = jsonObj['result'];
            ok = true;
        } else {
            err = jsonObj['error_description'];
        }
    } else {
        err = await response.text();
    }
    return { object: data, error: err, ok: ok };
};

const addDoc = async function (sitedata, data, body) {
    const param = {
        'NAME': data.nom_doc,
        'fields[TIP_DOKUMENTA]': data.nazv,
        'fields[NACHALO_DEYSTVIYA]': dateString(data.dat_beg),
        'fields[KONETS_DEYSTVIYA]': dateString(data.dat_end),
        'fields[DATA_VYDACHI]': dateString(data.dat_doc),
        'fields[VEDOMSTVO]': data.id_ved,
        'fields[GRUPPY_TEKHNICHESKIKH_USTROYSTV]': data.gr_tech_ust,
    };
    return await sendReq(sitedata, "docs.Element.add?" + queryString(param), "POST", body);
};

const updDoc = async function (sitedata, id, data, clearFile, body) {
    const param = {
        'elementId': id,
        'NAME': data.nom_doc,
        'clearfile': clearFile,
        'fields[TIP_DOKUMENTA]': data.nazv,
        'fields[NACHALO_DEYSTVIYA]': dateString(data.dat_beg),
        'fields[KONETS_DEYSTVIYA]': dateString(data.dat_end),
        'fields[DATA_VYDACHI]': dateString(data.dat_doc),
        'fields[VEDOMSTVO]': data.id_ved,
        'fields[GRUPPY_TEKHNICHESKIKH_USTROYSTV]': data.gr_tech_ust,
    };
    return await sendReq(sitedata, "docs.Element.upd?" + queryString(param), "POST", body);
};

// ==========================================
// ЛОГИКА СРАВНЕНИЯ
// ==========================================

const elEqual = function (kis, data, tu, amp, plav, chem, mech, diams, sert, mapDoc) {
    const eq = (norm(kis.marka) === norm(encode.decode(data['NAME'])) &&
        ((kis.active && (data['ACTIVE'] == 'Y')) || (!kis.active && (data['ACTIVE'] == 'N'))) &&
        norm(kis.vid) === norm(encode.decode(data['NAZNACHENIE'])) &&
        simbEq(kis.type, data['TIP_PO_GOST']) &&
        simbEq(kis.suf, data['SUFFIKS']) &&
        simbEq(kis.znam, data['ZNAMENATEL']) &&
        simbEq(kis.iso, data['TIP_PO_ISO']) &&
        simbEq(kis.aws, data['TIP_PO_AWS']) &&
        norm(kis.id_pol) === norm(data['POLOZHENIE_PRI_SVARKE']) &&
        norm(kis.descr) === norm(encode.decode(data['OPISANIE'])) &&
        norm(kis.descr_spec) === norm(encode.decode(data['OSOBYE_SVOYSTVA'])) &&
        norm(kis.descr_feature) === norm(encode.decode(data['TEKHNOLOGICHESKIE_OSOBENNOSTI_SVARKI'])) &&
        norm(getElProc(kis.proc)) === norm(encode.decode(data['PROKALKA_PERED_SVARKOY'])) &&
        norm(kis.marka) === norm(encode.decode(data['NAZVANIE'])) &&
        norm(data['KHIMICHESKIY_SOSTAV_PROVOLOKI']) === '' &&
        norm(data['TIP_PROVOLOKI']) === '' &&
        norm(data['BAZOVAYA_MARKA']) === ''
    );

    let tuEq = eq && lenEq(tu, data['NORMATIVNAYA_DOKUMENTATSIYA']);
    if (tuEq) {
        for (let i = 0; i < tu.length; i++) {
            tuEq = tuEq && (norm(tu[i].nam) === norm(encode.decode(data['NORMATIVNAYA_DOKUMENTATSIYA'][i])));
        }
    }

    let ampEq = eq && lenEq(amp, data['REKOMENDUEMOE_ZNACHENIE_TOKA']);
    if (ampEq) {
        for (let i = 0; i < amp.length; i++) {
            const str = locale.insNumber(amp[i].diam, 1) + "#" + amp[i].bot + "#" + amp[i].vert + "#" + amp[i].ceil + "#";
            ampEq = ampEq && (norm(str) === norm(encode.decode(data['REKOMENDUEMOE_ZNACHENIE_TOKA'][i])));
        }
    }

    let plavEq = eq && lenEq(plav, data['KHARAKTERISTIKI_PLAVLENIYA']);
    if (plavEq) {
        for (let i = 0; i < plav.length; i++) {
            const str = plav[i].nam + "#" + locale.insNumber(plav[i].value, 2) + "#";
            plavEq = plavEq && (norm(str) === norm(encode.decodeEntity(data['KHARAKTERISTIKI_PLAVLENIYA'][i])));
        }
    }

    let chemEq = eq && lenEq(chem, data['KHIMICHESKIY_SOSTAV_NAPLAVLENNOGO_METALLA']);
    if (chemEq) {
        for (let i = 0; i < chem.length; i++) {
            const min = (chem[i].min == null) ? '' : locale.insNumber(chem[i].min, 3);
            const max = (chem[i].max == null) ? '' : locale.insNumber(chem[i].max, 3);
            const str = chem[i].nam + "#" + chem[i].sig + "#" + min + " - " + max + "#";
            chemEq = chemEq && (norm(str) === norm(encode.decode(data['KHIMICHESKIY_SOSTAV_NAPLAVLENNOGO_METALLA'][i])));
        }
    }

    let mechEq = eq && lenEq(mech, data['MEKHANICHESKIE_SVOYSTVA_METALLA_SHVA_I_NAPLAVLENNO']);
    if (mechEq) {
        for (let i = 0; i < mech.length; i++) {
            let val = '';
            if (mech[i].min == null && mech[i].max != null) val = "<= " + locale.insNumber(mech[i].max, 3);
            else if (mech[i].max == null && mech[i].min != null) val = ">= " + locale.insNumber(mech[i].min, 3);
            else if (mech[i].max != null && mech[i].min != null) val = locale.insNumber(mech[i].min, 3) + " - " + locale.insNumber(mech[i].max, 3);
            const str = encode.decode(mech[i].nam_html + "#" + mech[i].sig_html + "#" + val + "#");
            mechEq = mechEq && (norm(str) === norm(encode.decode(data['MEKHANICHESKIE_SVOYSTVA_METALLA_SHVA_I_NAPLAVLENNO'][i])));
        }
    }

    let diamsEq = eq && lenEq(diams, data['DIAMETER']);
    if (diamsEq) {
        for (let i = 0; i < diams.length; i++) {
            diamsEq = diamsEq && (norm(locale.insNumber(diams[i].diam, 1)) === norm(encode.decode(data['DIAMETER'][i])));
        }
    }

    let spoolEq = eq && lenEq(diams, data['NOSITELI_PROVOLOKI']?.VALUE);
    if (spoolEq) {
        for (let i = 0; i < diams.length; i++) {
            spoolEq = spoolEq && (norm(locale.insNumber(diams[i].diam, 1)) === norm(encode.decode(data['NOSITELI_PROVOLOKI']['VALUE'][i])))
                && (norm(diams[i].spool) === norm(encode.decode(data['NOSITELI_PROVOLOKI']['DESCRIPTION'][i])));
        }
    }

    let sertEq = eq && lenEq(sert, data['DOC']?.VALUE);
    if (sertEq && data['DOC'] && data['DOC']['VALUE']) {
        const map = new Map();
        for (let i = 0; i < data['DOC']['VALUE'].length; i++) {
            map.set(data['DOC']['VALUE'][i], data['DOC']['DESCRIPTION'][i]);
        }
        for (let i = 0; i < sert.length; i++) {
            const doc = mapDoc.get(sert[i].nam);
            if (!doc) { sertEq = false; break; }
            sertEq = sertEq && map.has(doc['ID']) && paramEq(sert[i].diams, map.get(doc['ID']));
        }
    }

    return eq && tuEq && ampEq && plavEq && chemEq && mechEq && diamsEq && spoolEq && sertEq;
};

const createElObj = function (id, kis, tu, amp, plav, chem, mech, diams, sert, mapDoc) {
    let obj = {
        'elementId': id,
        'CATALOG': 'Каталог электродов',
        'NAME': kis.marka,
        'ACTIVE': (kis.active ? 'Y' : 'N'),
    };

    let fields = {
        'XML_ID': kis.id,
        'NAZNACHENIE': kis.vid,
        'TIP_PO_GOST': getPar(kis.type),
        'SUFFIKS': getPar(kis.suf),
        'ZNAMENATEL': getPar(kis.znam),
        'TIP_PO_ISO': getPar(kis.iso),
        'TIP_PO_AWS': getPar(kis.aws),
        'POLOZHENIE_PRI_SVARKE': kis.id_pol,
        'OPISANIE': kis.descr,
        'OSOBYE_SVOYSTVA': kis.descr_spec,
        'TEKHNOLOGICHESKIE_OSOBENNOSTI_SVARKI': kis.descr_feature,
        'PROKALKA_PERED_SVARKOY': getElProc(kis.proc),
        'NAZVANIE': kis.marka,
        'KHIMICHESKIY_SOSTAV_PROVOLOKI': '',
        'TIP_PROVOLOKI': '',
        'BAZOVAYA_MARKA': '',
    };

    let tuobj = [];
    for (let i = 0; i < tu.length; i++) tuobj.push(tu[i].nam);
    fields['NORMATIVNAYA_DOKUMENTATSIYA'] = tuobj;

    let ampobj = [];
    for (let i = 0; i < amp.length; i++) {
        ampobj.push(locale.insNumber(amp[i].diam, 1) + "#" + amp[i].bot + "#" + amp[i].vert + "#" + amp[i].ceil + "#");
    }
    fields['REKOMENDUEMOE_ZNACHENIE_TOKA'] = ampobj;

    let plavobj = [];
    for (let i = 0; i < plav.length; i++) {
        plavobj.push(plav[i].nam + "#" + locale.insNumber(plav[i].value, 2) + "#");
    }
    fields['KHARAKTERISTIKI_PLAVLENIYA'] = plavobj;

    let chemobj = [];
    for (let i = 0; i < chem.length; i++) {
        const min = (chem[i].min == null) ? '' : locale.insNumber(chem[i].min, 3);
        const max = (chem[i].max == null) ? '' : locale.insNumber(chem[i].max, 3);
        chemobj.push(chem[i].nam + "#" + chem[i].sig + "#" + min + " - " + max + "#");
    }
    fields['KHIMICHESKIY_SOSTAV_NAPLAVLENNOGO_METALLA'] = chemobj;

    let mechobj = [];
    for (let i = 0; i < mech.length; i++) {
        let val = '';
        if (mech[i].min == null && mech[i].max != null) {
            val = "<= " + locale.insNumber(mech[i].max, 3);
        } else if (mech[i].max == null && mech[i].min != null) {
            val = ">= " + locale.insNumber(mech[i].min, 3);
        } else if (mech[i].max != null && mech[i].min != null) {
            val = locale.insNumber(mech[i].min, 3) + " - " + locale.insNumber(mech[i].max, 3);
        }
        mechobj.push(encode.decode(mech[i].nam_html + "#" + mech[i].sig_html + "#" + val + "#"));
    }
    fields['MEKHANICHESKIE_SVOYSTVA_METALLA_SHVA_I_NAPLAVLENNO'] = mechobj;

    let diamsobj = [];
    let spoolobj = [];
    for (let i = 0; i < diams.length; i++) {
        diamsobj.push(locale.insNumber(diams[i].diam, 1));
        spoolobj.push({
            'VALUE': locale.insNumber(diams[i].diam, 1),
            'DESCRIPTION': diams[i].spool
        });
    }
    fields['DIAMETER'] = diamsobj;
    fields['NOSITELI_PROVOLOKI'] = spoolobj;

    let sertobj = [];
    for (let i = 0; i < sert.length; i++) {
        const doc = mapDoc.get(sert[i].nam);
        if (!doc) continue;
        sertobj.push({
            'VALUE': doc['ID'],
            'DESCRIPTION': sert[i].diams
        });
    }
    fields['DOC'] = sertobj;

    obj['fields'] = fields;

    return JSON.stringify(obj);
};

const syncEl = async function (sitedata, data, mapDoc) {
    let err = [];
    let count = 0;
    const kisList = await getElData();
    const ids = kisList.map(k => k.id);

    // Пакетная загрузка всех зависимостей (Побежден N+1)
    const [tuMap, ampMap, plavMap, chemMap, mechMap, diamsMap, sertMap] = await Promise.all([
        getElTuBulk(ids), getElAmpBulk(ids), getElPlavBulk(ids),
        getElChemBulk(ids), getElMechBulk(ids), getElDiamsBulk(ids), getElSertBulk(ids)
    ]);

    for (let i = 0; i < kisList.length; i++) {
        const kis = kisList[i];
        const tu = tuMap.get(kis.id) || [];
        const amp = ampMap.get(kis.id) || [];
        const plav = plavMap.get(kis.id) || [];
        const chem = chemMap.get(kis.id) || [];
        const mech = mechMap.get(kis.id) || [];
        const diams = diamsMap.get(kis.id) || [];
        const sert = sertMap.get(kis.id) || [];

        if (data.has(kis.id)) {
            if (!elEqual(kis, data.get(kis.id), tu, amp, plav, chem, mech, diams, sert, mapDoc)) {
                let upd = await sendReq(sitedata, "catalog.Element.upd", "POST", createElObj(data.get(kis.id)['ID'], kis, tu, amp, plav, chem, mech, diams, sert, mapDoc));
                if (!upd.ok) err.push("Обновление " + kis.marka + ": " + upd.error);
                else count++;
            }
        } else if (kis.active) {
            let add = await sendReq(sitedata, "catalog.Element.add", "POST", createElObj('', kis, tu, amp, plav, chem, mech, diams, sert, mapDoc));
            if (!add.ok) err.push("Добавление " + kis.marka + ": " + add.error);
            else count++;
        }
    }
    return { error: err, count: count };
};

const wireEqual = function (kis, data, tu, chem, diams, sert, mapDoc) {
    const wtype = getWireType(kis.marka);
    const eq = (norm(kis.marka) === norm(encode.decode(data['NAME'])) &&
        ((kis.active && (data['ACTIVE'] == 'Y')) || (!kis.active && (data['ACTIVE'] == 'N'))) &&
        norm(data['NAZNACHENIE']) === '' &&
        norm(kis.type) === norm(encode.decode(data['TIP_PROVOLOKI'])) &&
        norm(data['TIP_PO_GOST']) === norm(wtype) &&
        norm(data['SUFFIKS']) === '' &&
        norm(data['ZNAMENATEL']) === '' &&
        norm(data['TIP_PO_ISO']) === '' &&
        norm(data['TIP_PO_AWS']) === '' &&
        norm(data['POLOZHENIE_PRI_SVARKE']) === '' &&
        norm(kis.descr) === norm(encode.decode(data['OPISANIE'])) &&
        norm(data['OSOBYE_SVOYSTVA']) === '' &&
        norm(data['TEKHNOLOGICHESKIE_OSOBENNOSTI_SVARKI']) === '' &&
        norm(data['PROKALKA_PERED_SVARKOY']) === '' &&
        norm(kis.marka) === norm(encode.decode(data['NAZVANIE'])) &&
        norm(data['KHIMICHESKIY_SOSTAV_NAPLAVLENNOGO_METALLA']) === '' &&
        norm(kis.base) === norm(encode.decode(data['BAZOVAYA_MARKA'])) &&
        norm(data['REKOMENDUEMOE_ZNACHENIE_TOKA']) === '' &&
        norm(data['KHARAKTERISTIKI_PLAVLENIYA']) === '' &&
        norm(data['MEKHANICHESKIE_SVOYSTVA_METALLA_SHVA_I_NAPLAVLENNO']) === ''
    );

    let tuEq = eq && lenEq(tu, data['NORMATIVNAYA_DOKUMENTATSIYA']);
    if (tuEq) {
        for (let i = 0; i < tu.length; i++) {
            tuEq = tuEq && (norm(tu[i].nam) === norm(encode.decode(data['NORMATIVNAYA_DOKUMENTATSIYA'][i])));
        }
    }

    let chemEq = eq && lenEq(chem, data['KHIMICHESKIY_SOSTAV_PROVOLOKI']);
    if (chemEq) {
        for (let i = 0; i < chem.length; i++) {
            const min = (chem[i].min == null) ? '' : locale.insNumber(chem[i].min, 3);
            const max = (chem[i].max == null) ? '' : locale.insNumber(chem[i].max, 3);
            const str = chem[i].nam + "#" + chem[i].sig + "#" + min + " - " + max + "#";
            chemEq = chemEq && (norm(str) === norm(encode.decode(data['KHIMICHESKIY_SOSTAV_PROVOLOKI'][i])));
        }
    }

    let diamsEq = eq && lenEq(diams, data['DIAMETER']);
    if (diamsEq) {
        for (let i = 0; i < diams.length; i++) {
            diamsEq = diamsEq && (norm(locale.insNumber(diams[i].diam, 1)) === norm(encode.decode(data['DIAMETER'][i])));
        }
    }

    let spoolEq = eq && lenEq(diams, data['NOSITELI_PROVOLOKI']?.VALUE);
    if (spoolEq) {
        for (let i = 0; i < diams.length; i++) {
            spoolEq = spoolEq && (norm(locale.insNumber(diams[i].diam, 1)) === norm(encode.decode(data['NOSITELI_PROVOLOKI']['VALUE'][i])))
                && (norm(diams[i].spool) === norm(encode.decode(data['NOSITELI_PROVOLOKI']['DESCRIPTION'][i])));
        }
    }

    let sertEq = eq && lenEq(sert, data['DOC']?.VALUE);
    if (sertEq && data['DOC'] && data['DOC']['VALUE']) {
        const map = new Map();
        for (let i = 0; i < data['DOC']['VALUE'].length; i++) {
            map.set(data['DOC']['VALUE'][i], data['DOC']['DESCRIPTION'][i]);
        }
        for (let i = 0; i < sert.length; i++) {
            const doc = mapDoc.get(sert[i].nam);
            if (!doc) { sertEq = false; break; }
            sertEq = sertEq && map.has(doc['ID']) && paramEq(sert[i].diams, map.get(doc['ID']));
        }
    }

    return eq && tuEq && chemEq && diamsEq && spoolEq && sertEq;
};

const createWireObj = function (id, kis, tu, chem, diams, sert, mapDoc) {
    let obj = {
        'elementId': id,
        'CATALOG': 'Каталог проволоки',
        'NAME': kis.marka,
        'ACTIVE': (kis.active ? 'Y' : 'N'),
    };

    let fields = {
        'XML_ID': kis.id,
        'NAZNACHENIE': '',
        'TIP_PO_GOST': getWireType(kis.marka),
        'SUFFIKS': '',
        'ZNAMENATEL': '',
        'TIP_PO_ISO': '',
        'TIP_PO_AWS': '',
        'POLOZHENIE_PRI_SVARKE': '',
        'OPISANIE': kis.descr,
        'OSOBYE_SVOYSTVA': '',
        'TEKHNOLOGICHESKIE_OSOBENNOSTI_SVARKI': '',
        'PROKALKA_PERED_SVARKOY': '',
        'NAZVANIE': kis.marka,
        'TIP_PROVOLOKI': kis.type,
        'BAZOVAYA_MARKA': kis.base,
        'REKOMENDUEMOE_ZNACHENIE_TOKA': '',
        'KHARAKTERISTIKI_PLAVLENIYA': '',
        'KHIMICHESKIY_SOSTAV_NAPLAVLENNOGO_METALLA': '',
        'MEKHANICHESKIE_SVOYSTVA_METALLA_SHVA_I_NAPLAVLENNO': '',
    };

    let tuobj = [];
    for (let i = 0; i < tu.length; i++) tuobj.push(tu[i].nam);
    fields['NORMATIVNAYA_DOKUMENTATSIYA'] = tuobj;

    let chemobj = [];
    for (let i = 0; i < chem.length; i++) {
        const min = (chem[i].min == null) ? '' : locale.insNumber(chem[i].min, 3);
        const max = (chem[i].max == null) ? '' : locale.insNumber(chem[i].max, 3);
        chemobj.push(chem[i].nam + "#" + chem[i].sig + "#" + min + " - " + max + "#");
    }
    fields['KHIMICHESKIY_SOSTAV_PROVOLOKI'] = chemobj;

    let diamsobj = [];
    let spoolobj = [];
    for (let i = 0; i < diams.length; i++) {
        diamsobj.push(locale.insNumber(diams[i].diam, 1));
        spoolobj.push({
            'VALUE': locale.insNumber(diams[i].diam, 1),
            'DESCRIPTION': diams[i].spool
        });
    }
    fields['DIAMETER'] = diamsobj;
    fields['NOSITELI_PROVOLOKI'] = spoolobj;

    let sertobj = [];
    for (let i = 0; i < sert.length; i++) {
        const doc = mapDoc.get(sert[i].nam);
        if (!doc) continue;
        sertobj.push({
            'VALUE': doc['ID'],
            'DESCRIPTION': sert[i].diams
        });
    }
    fields['DOC'] = sertobj;

    obj['fields'] = fields;
    return JSON.stringify(obj);
};

const syncWire = async function (sitedata, data, mapDoc) {
    let err = [];
    let count = 0;
    const kisList = await getWireData();
    const ids = kisList.map(k => k.id);

    // Пакетная загрузка всех зависимостей
    const [tuMap, chemMap, diamsMap, sertMap] = await Promise.all([
        getWireTuBulk(ids), getWireChemBulk(ids), getWireDiamsBulk(ids), getWireSertBulk(ids)
    ]);

    for (let i = 0; i < kisList.length; i++) {
        const kis = kisList[i];
        const tu = tuMap.get(kis.id) || [];
        const chem = chemMap.get(kis.id) || [];
        const diams = diamsMap.get(kis.id) || [];
        const sert = sertMap.get(kis.id) || [];

        if (data.has(kis.id)) {
            if (!wireEqual(kis, data.get(kis.id), tu, chem, diams, sert, mapDoc)) {
                let upd = await sendReq(sitedata, "catalog.Element.upd", "POST", createWireObj(data.get(kis.id)['ID'], kis, tu, chem, diams, sert, mapDoc));
                if (!upd.ok) err.push("Обновление " + kis.marka + ": " + upd.error);
                else count++;
            }
        } else if (kis.active) {
            let add = await sendReq(sitedata, "catalog.Element.add", "POST", createWireObj('', kis, tu, chem, diams, sert, mapDoc));
            if (!add.ok) err.push("Добавление " + kis.marka + ": " + add.error);
            else count++;
        }
    }
    return { error: err, count: count };
};

// ==========================================
// РОУТЫ EXPRESS
// ==========================================

module.exports = function (app) {

    app.get("/site/sync", async (req, res) => {
        try {
            let docCount = 0;
            let catCount = 0;
            let err = [];
            const sitedata = await getSiteData();

            // 1. Синхронизация документов
            const doc = await sendReq(sitedata, "docs.Element.listall", "GET");
            if (!doc.ok) return res.status(500).type("text/plain").send(doc.error);

            const mapDoc = new Map();
            doc.object.forEach(table => mapDoc.set(table['NAME'], table));

            const dataDoc = await getDocsData();
            for (const localDoc of dataDoc) {
                if (mapDoc.has(localDoc.nom_doc)) {
                    const siteDoc = mapDoc.get(localDoc.nom_doc);
                    if (!(localDoc.nazv == encode.decode(siteDoc['TIP_DOKUMENTA']) &&
                        localDoc.gr_tech_ust == encode.decode(siteDoc['GRUPPY_TEKHNICHESKIKH_USTROYSTV']) &&
                        localDoc.id_ved == siteDoc['VEDOMSTVO'] &&
                        dateString(localDoc.dat_beg) == siteDoc['NACHALO_DEYSTVIYA'] &&
                        dateString(localDoc.dat_end) == siteDoc['KONETS_DEYSTVIYA'] &&
                        dateString(localDoc.dat_doc) == siteDoc['DATA_VYDACHI'])
                    ) {
                        const upd = await updDoc(sitedata, siteDoc['ID'], localDoc, false, "");
                        if (upd.ok) { mapDoc.set(localDoc.nom_doc, upd.object); docCount++; }
                        else err.push("Обновление " + localDoc.nom_doc + ": " + upd.error);
                    }
                } else {
                    const add = await addDoc(sitedata, localDoc, "");
                    if (add.ok) { mapDoc.set(localDoc.nom_doc, add.object); docCount++; }
                    else err.push("Добавление " + localDoc.nom_doc + ": " + add.error);
                }
            }

            // 2. Синхронизация каталога
            const cat = await sendReq(sitedata, "catalog.Element.listall", "GET");
            if (!cat.ok) return res.status(500).type("text/plain").send(cat.error);

            const mapEl = new Map();
            const mapWire = new Map();
            cat.object.forEach(el => {
                if (el['CATALOG'] == "Каталог электродов") mapEl.set(Number(el['XML_ID']), el);
                else if (el['CATALOG'] == "Каталог проволоки") mapWire.set(Number(el['XML_ID']), el);
            });

            const resEl = await syncEl(sitedata, mapEl, mapDoc);
            catCount += resEl.count;
            err = err.concat(resEl.error);

            const resWire = await syncWire(sitedata, mapWire, mapDoc);
            catCount += resWire.count;
            err = err.concat(resWire.error);

            res.type("text/plain");
            res.send("Обновлено документов: " + docCount + "; Элементов каталога: " + catCount + "; Ошибок: " + err.length);

        } catch (error) {
            res.status(500).type("text/plain").send(error.message);
        }
    });

    app.get("/site/docs/list", async (req, res) => {
        try {
            const sitedata = await getSiteData();
            const dat = await sendReq(sitedata, "docs.Element.listall", "GET");
            if (dat.ok) res.json(dat.object);
            else res.status(500).type("text/plain").send(dat.error);
        } catch (error) {
            res.status(500).type("text/plain").send(error.message);
        }
    });

    app.post("/site/docs/upd", bodyParser.raw({ type: 'application/pdf', limit: '10mb' }), async (req, res) => {
        try {
            const sitedata = await getSiteData();
            const doc = await getDocData(req.query.id);
            const upd = await updDoc(sitedata, req.query.elementId, doc, true, req.body);
            if (upd.ok) res.json(upd.object);
            else res.status(500).type("text/plain").send(upd.error);
        } catch (error) {
            res.status(500).type("text/plain").send(error.message);
        }
    });

    app.post("/site/docs/add", bodyParser.raw({ type: 'application/pdf', limit: '10mb' }), async (req, res) => {
        try {
            const sitedata = await getSiteData();
            const doc = await getDocData(req.query.id);
            const add = await addDoc(sitedata, doc, req.body);
            if (add.ok) res.json(add.object);
            else res.status(500).type("text/plain").send(add.error);
        } catch (error) {
            res.status(500).type("text/plain").send(error.message);
        }
    });
};