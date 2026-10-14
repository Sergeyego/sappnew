const sfs = require("node:fs/promises");
const path = require("node:path");
const lescape = require('escape-latex');
const db = require('../../../../postgres.js');
const locale = require('../../../../locale.js');

// Вспомогательная функция глубокого копирования папок
async function copyDir(src, dest) {
    await sfs.mkdir(dest, { recursive: true });
    const entries = await sfs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        } else {
            await sfs.copyFile(srcPath, destPath);
        }
    }
}

async function getPartData(id) {
    const query = `
        SELECT p.id AS id, p.n_s AS n_s, p.dat_part AS dat, e.marka_sert AS marka, p.diam AS diam, p.kfmp AS kfmp, ev.proc AS proc, e.shelf_life AS warr, 
               gt.nam AS type, pu.nam AS pu, COALESCE(p.ibco, ev.znam) AS znam, COALESCE(pp.nam, pe.nam) AS provol, el.nam AS long, e.vl AS vl, eg.typ AS grp, 
               get_prod($1) AS massa, COALESCE(ev.descrtu, ev.descr) AS descr, et.okp AS okp 
        FROM parti AS p 
        INNER JOIN elrtr AS e ON e.id = p.id_el 
        INNER JOIN provol AS pe ON pe.id = e.id_gost 
        LEFT JOIN provol AS pp ON pp.id = p.id_prfact AND pp.id IN (SELECT ep.id_prov FROM el_provol AS ep WHERE ep.id_el = p.id_el) 
        INNER JOIN el_var AS ev ON ev.id_el = p.id_el AND ev.id_var = p.id_var 
        INNER JOIN gost_types AS gt ON ev.id_gost_type = gt.id 
        INNER JOIN purpose AS pu ON e.id_purpose = pu.id 
        INNER JOIN el_long el ON el.id = p.id_long 
        INNER JOIN el_grp eg ON eg.id = e.id_grp 
        INNER JOIN el_types et ON et.id = e.id_vid 
        WHERE p.id = $1
    `;
    return await db.one(query, [id]);
}

async function getSertData(id) {
    const query = `
        SELECT z.doc_nam AS doc_nam, zs.nom_doc AS nom_doc, zs.dat_beg AS dat_beg, zs.dat_end AS dat_end, zd.iss AS iss, zv.iss_f AS iss_f 
        FROM zvd_get_sert_var((SELECT dat_part FROM parti WHERE id = $1), (SELECT id_el FROM parti WHERE id = $1), 
            (SELECT d.id FROM diam AS d WHERE d.diam = (SELECT diam FROM parti WHERE id = $1)), (SELECT id_var FROM parti WHERE id = $1)) AS z 
        INNER JOIN zvd_sert zs ON zs.id = z.id_doc INNER JOIN zvd_ved zv ON zv.id = zs.id_ved INNER JOIN zvd_doc zd ON zd.id = zs.id_doc WHERE z.en = true
    `;
    return await db.any(query, [id]);
}

async function getChemData(id) {
    const query = `
        SELECT c.sig AS sig, s.value AS val, ct.min AS min, ct.max AS max FROM sert_chem AS s 
        INNER JOIN chem_tbl c ON s.id_chem = c.id 
        LEFT JOIN chem_tu ct ON ct.id_el = (SELECT id_el FROM parti WHERE id = $1) AND ct.id_chem = s.id_chem AND ct.id_var = (SELECT id_var FROM parti WHERE id = $1) 
        WHERE s.id_part = $1 ORDER BY c.sig
    `;
    return await db.any(query, [id]);
}

async function getMechData(id) {
    const query = `
        SELECT * FROM ( 
            SELECT mc.nam AS cat_nam, m.tex AS nam, m.prefix AS prefix, s.value AS val, mt.min AS min, mt.max AS max FROM sert_mech AS s 
            INNER JOIN mech_tbl AS m ON s.id_mech = m.id INNER JOIN mech_category mc ON mc.id = m.id_cat 
            LEFT JOIN mech_tu mt ON mt.id_el = (SELECT id_el FROM parti WHERE id = $1) AND mt.id_mech = s.id_mech AND mt.id_var = (SELECT id_var FROM parti WHERE id = $1) WHERE s.id_part = $1 
            UNION 
            SELECT mc2.nam, t.nam, n.nam, null, null, null FROM sert_mechx AS x 
            INNER JOIN mechx_tbl AS t ON x.id_mechx = t.id INNER JOIN mechx_nams AS n ON x.id_value = n.id INNER JOIN mech_category mc2 ON mc2.id = t.id_cat WHERE x.id_part = $1 
        ) AS z ORDER BY z.cat_nam, z.nam
    `;
    return await db.any(query, [id]);
}

async function getAmpData(id) {
    const query = `
        SELECT at2.lay AS lay, p.nam AS pol, at2.bot AS bot, at2.vert AS vert, at2."ceil" AS top FROM amp_tu at2 INNER JOIN polar p ON p.id = at2.id_polar 
        WHERE at2.id_el = (SELECT id_el FROM parti WHERE id = $1) AND at2.id_diam = (SELECT id FROM diam WHERE diam = (SELECT diam FROM parti WHERE id = $1)) 
          AND at2.id_var = (SELECT id_var FROM parti WHERE id = $1) ORDER BY at2.id
    `;
    return await db.any(query, [id]);
}

async function getPlavData(id) {
    const query = `SELECT epn.nam AS nam, ep.value AS val FROM el_plav ep INNER JOIN el_plav_nams epn ON epn.id = ep.id_plav WHERE ep.id_el = (SELECT id_el FROM parti WHERE id = $1) ORDER BY epn.nam`;
    return await db.any(query, [id]);
}

async function createSignFiles(targetDir, date) {
    const query = `
        SELECT ps.id_role as id_role, ps.sig as sig FROM pasport_sig ps 
        INNER JOIN (SELECT id_role as id_role, max(dat) as dat FROM pasport_sig WHERE dat <= $1 GROUP BY id_role) as c ON c.id_role = ps.id_role AND c.dat = ps.dat
    `;
    const data = await db.any(query, [date]);
    const fileMap = { 1: 'auth.png', 2: 'check.png', 3: 'app.png', 4: 'norm.png' };
    for (const item of data) {
        const fileName = fileMap[item.id_role];
        if (fileName) await sfs.writeFile(path.join(targetDir, fileName), item.sig);
    }
}

function getFrac(partData) {
    let type = partData.type, pu = partData.pu, znam = partData.znam, num = "";
    if (type && type !== '-' && type !== '') num += lescape(type) + '-';
    num += lescape(partData.marka) + '-' + locale.insNumber(partData.diam, 1);
    if (pu && pu !== '-' && pu !== '') num += '-' + lescape(pu);
    return (znam && znam !== '-' && znam !== '') ? `\\frac {\\text{${num}}}{\\text{${lescape(znam)}}}` : `\\text{${num}}`;
}

function getSertStr(sertData) {
    let tex = "";
    for (const item of sertData) {
        tex += `${lescape(item.doc_nam)} & № ${lescape(item.nom_doc)} (срок действия с ${locale.insDate(item.dat_beg)}`;
        if (item.dat_end!=null){
            tex+=` по ${locale.insDate(item.dat_end)}`;
        }
        tex+=`)`;
        if (item.iss != null && item.iss_f != null) tex += `, ${lescape(item.iss)} ${lescape(item.iss_f)}`;
        tex += " \\\\ \\hline ";
    }
    return tex;
}

function getPlavStr(plavData) {
    let tex = "";
    for (const item of plavData) tex += `${lescape(item.nam)} & ${locale.insNumber(item.val, 1)} \\\\ \\hline `;
    return tex;
}

function getChemTbl(chemData) {
    if (!chemData.length) return "";
    let tex = "\\begin{tabular}{|c|c|c|} \\hline Элемент & Требование НД, \\% & Фактическое значение, \\% \\\\ \\hline ";
    for (const item of chemData) {
        tex += lescape(item.sig) + " & ";
        if (item.min != null || item.max != null) {
            if (item.min == null || item.min == 0) tex += "не более " + locale.insNumber(item.max, 3);
            else if (item.max == null) tex += "не менее " + locale.insNumber(item.min, 3);
            else tex += `${locale.insNumber(item.min, 3)} - ${locale.insNumber(item.max, 3)}`;
        }
        tex += " & " + locale.insNumber(item.val, 3) + " \\\\ \\hline ";
    }
    return tex + "\\end{tabular}";
}

function getMechTbl(mechData) {
    if (!mechData.length) return "";
    let tex = "", cat = "";
    for (let i = 0; i < mechData.length; i++) {
        const item = mechData[i];
        if (item.cat_nam !== cat) {
            if (i > 0) tex += "\\end{tabular} \\vspace{2.5mm}  \\\\ \\hline ";
            cat = item.cat_nam;
            tex += `${lescape(item.cat_nam)}: & \\vspace{-2.5mm} \\begin{tabular}{|p{5cm}|p{1.8cm}|p{2cm}|} \\hline \\makecell[c]{Параметр} & \\makecell[c]{Требование \\\\НД} & \\makecell[c]{Фактическое \\\\значение} \\\\ \\hline `;
        }
        tex += item.nam + " & ";
        let prefix = item.prefix ? lescape(item.prefix) : "";
        if (item.min != null || item.max != null) {
            if (item.min == null || item.min == 0) tex += "не более " + locale.insNumber(item.max, 2);
            else if (item.max == null) tex += "не менее " + locale.insNumber(item.min, 2);
            else tex += `${locale.insNumber(item.min, 2)} - ${locale.insNumber(item.max, 2)}`;
        } else tex += prefix;
        tex += ` & \\makecell[c]{ ${prefix} ${locale.insNumber(item.val, 2)} } \\\\ \\hline `;
    }
    return tex + "\\end{tabular} \\vspace{2.5mm}  \\\\ \\hline ";
}

function getAmpTbl(ampData) {
    if (!ampData.length) return "";
    let tex = "\\begin{table}[h!] \\centering \\caption*{Режимы сварки} \\begin{tabular}{|c|c|p{3cm}|p{3cm}|p{3cm}|} \\hline " +
        "\\multirow{2}{*}{Слой шва} & \\multirow{2}{*}{Полярность} &\\multicolumn{3}{c|}{Сварочный ток (А) в положении при сварке} \\\\ \\cline{3-5} && \\makecell[c]{нижнее} & \\makecell[c]{вертикальное} & \\makecell[c]{потолочное} \\\\ \\hline ";
    for (const item of ampData) {
        tex += `\\makecell[c]{${lescape(item.lay)}} & \\makecell[c]{${lescape(item.pol)}} & \\makecell[c]{${lescape(item.bot)}} & \\makecell[c]{${lescape(item.vert)}} & \\makecell[c]{${lescape(item.top)}} \\\\ \\hline `;
    }
    return tex + "\\end{tabular} \\end{table} ";
}

function getSTitle(dx1, dx2, pic) {
    let tex =
        "\\AddToShipoutPictureBG*{" +
        "   \\AtPageLowerLeft{" +
        "       \\hspace*{132mm}{" +
        "           \\raisebox{" + dx1 + "mm}{" +
        "			    \\includegraphics[width=20mm,height=11.25mm]{" + pic + "}" +
        "			     \\hspace*{-23mm}{" +
        "				     \\raisebox{" + dx2 + "mm}{ \\ESKDtheDay \\hspace{11mm} \\ESKDtheMonth \\hspace{12mm} \\ESKDtheYear}" +
        "			     }" +
        "			 }" +
        "		 }" +
        "	 }" +
        "}\n";
    return tex;
}

function getSigTitle(isSign) {
    if (!isSign) return "";
    let tex = "\\AddToShipoutPictureBG*{\\AtPageLowerLeft{\\hspace*{90mm}{\\raisebox{225mm}{\\includegraphics[width=42mm,height=42mm]{docstamp.png}}}}}\n";
    return tex + getSTitle(237, -3, 'app.png') + getSTitle(96, -2, 'auth.png') + getSTitle(70, -2, 'check.png');
}

function getSOne(x, pic) {
    let tex =
        "\\AddToShipoutPictureBG*{" +
        "   \\AtPageLowerLeft{" +
        "	    \\hspace*{56mm}{" +
        "		    \\raisebox{" + x + "mm}{" +
        "			    \\includegraphics[width=17mm,height=9.5625mm]{" + pic + "}" +
        "			    \\hspace*{-3mm}{" +
        "				    \\raisebox{3mm}{\\footnotesize \\ESKDtheDay.\\ESKDtheMonth}" +
        "			    }" +
        "		    }" +
        "	    }" +
        "   }" +
        "}";
    return tex;
}

function getSigOne(isSign) {
    return isSign ? getSOne(23, 'auth.png') + getSOne(18, 'check.png') + getSOne(8, 'norm.png') + getSOne(3, 'app.png') : "";
}

function getDoc(data, partData, tustr, sertData, chemData, mechData, ampData, plavData, body) {
    let tex = data;

    // Безопасное извлечение строки из body с LaTeX-экранированием.
    // null/undefined → "", число → строка, всё остальное → String().
    const safe = (v) => lescape(String(v ?? ""));

    // Блок 1: Базовые характеристики партии (partData)
    tex = tex.replace(/<npart>/g, lescape(partData.n_s));
    tex = tex.replace(/<okp>/g, lescape(partData.okp));
    tex = tex.replace(/<marka>/g, lescape(partData.marka));
    tex = tex.replace(/<diam>/g, locale.insNumber(partData.diam, 1));
    tex = tex.replace(/<type>/g, lescape(partData.type));
    tex = tex.replace(/<massa>/g, locale.insNumber(partData.massa, 1));
    tex = tex.replace(/<provol>/g, lescape(partData.provol));
    tex = tex.replace(/<dat>/g, locale.insDate(partData.dat));
    tex = tex.replace(/<long>/g, locale.insNumber(partData.long, 0));
    tex = tex.replace(/<kfmp>/g, locale.insNumber(partData.kfmp, 2));
    tex = tex.replace(/<proc>/g, lescape(partData.proc));
    tex = tex.replace(/<vl>/g, lescape(partData.vl));
    tex = tex.replace(/<warr>/g, locale.insNumber(partData.warr, 0));
    tex = tex.replace(/<grp>/g, lescape(partData.grp));
    tex = tex.replace(/<descr>/g, lescape(partData.descr));

    // Блок 2: Сложные динамические таблицы и строки
    tex = tex.replace(/<frac>/g, getFrac(partData));
    tex = tex.replace(/<plav>/g, getPlavStr(plavData));
    tex = tex.replace(/<sert>/g, getSertStr(sertData));
    tex = tex.replace(/<chem>/g, getChemTbl(chemData));
    tex = tex.replace(/<mech>/g, getMechTbl(mechData));
    tex = tex.replace(/<amp>/g, getAmpTbl(ampData));
    tex = tex.replace(/<tustr>/g, lescape(tustr));

    // Блок 3: Данные подписантов (все поля из body — через safe())
    tex = tex.replace(/<date>/g, safe(body.date).replace(/-/g, '/'));
    tex = tex.replace(/<auth>/g, safe(body.auth));
    tex = tex.replace(/<check>/g, safe(body.check));
    tex = tex.replace(/<norm>/g, safe(body.norm));
    tex = tex.replace(/<app>/g, safe(body.app));
    tex = tex.replace(/<authTitle>/g, safe(body.authTitle));
    tex = tex.replace(/<checkTitle>/g, safe(body.checkTitle));
    tex = tex.replace(/<appTitle>/g, safe(body.appTitle));

    // Блок 4: Отрисовка штампов и факсимиле подписей
    const isSign = Boolean(body.isSign);
    tex = tex.replace(/<sigtitle>/g, getSigTitle(isSign));
    tex = tex.replace(/<sigone>/g, getSigOne(isSign));

    const sigMainTex = isSign
        ? "\\tikz {\\raisebox{-3mm}{\\hspace{-11 mm} \\includegraphics[width=23mm,height=13mm]{check.png}}}"
        : "";
    tex = tex.replace(/<sigmain>/g, sigMainTex);

    const stampOtkTex = isSign
        ? "\\tikz {\\raisebox{-22mm}{\\hspace{-18mm} \\includegraphics[width=42mm,height=42mm]{otkstamp.png}}}"
        : "";
    tex = tex.replace(/<stampotk>/g, stampOtkTex);

    return tex;
}
module.exports = { copyDir, getPartData, getSertData, getChemData, getMechData, getAmpData, getPlavData, createSignFiles, getDoc };