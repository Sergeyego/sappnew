const locale = require('./locale.js');

let getGeneralData = async function (dat) {
    const db = require('./postgres.js');
    let query = `select dat as dat, adr as adr, telboss||', '||telfax||', '||teldop||'<br>'||site||' '||email as tel, 
        otk as otk, adr_en as adr_en, otk_en as otk_en, otk_title as otk_title, otk_title_en as otk_title_en, fnam as fnam, fnam_en as fnam_en 
        from general_data where dat = (select max(mgd.dat) from general_data mgd where mgd.dat <= $1 )`;
    const data = await db.one(query, [dat] );
    return data;
}

// HTML-escape для значений, попадающих в разметку. Не трогает уже готовые теги.
let esc = function (v) {
    if (v == null) return "";
    return String(v).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
};

// Вставляет ru/en-текст с учётом языка. Все значения экранируются,
// <br> для newpar добавляется уже после escape.
let insText = function (lang, rus, eng, newpar = false) {
    const r = esc(rus);
    const e = esc(eng);
    let text = "";

    if (typeof lang == "undefined" || lang == "ru" || rus == eng) {
        text = r;
    } else if (lang == "en") {
        text = (e !== "") ? e : r;
    } else {
        text = r;
        if (newpar) text += "<br>";
        if (e !== "") text += e;
    }
    return text;
};

let insNumber = function (lang, val, dec) {
    if (val == null) return "";
    const lg = (typeof lang == "undefined" || lang == "ru") ? "ru-RU" : "en-US";
    const d = Number(dec) || 0;
    return new Intl.NumberFormat(lg, {
        style: "decimal",
        minimumFractionDigits: d,
        maximumFractionDigits: d
    }).format(val);
};

let insDate = function (lang, date, newpar = false) {
    if (date == null) return "";

    // Значение из pg обычно Date, но может быть строкой (например, при кастомном парсере).
    const d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return "";

    let str;
    if (typeof lang == "undefined" || lang == "ru") {
        str = new Intl.DateTimeFormat("ru-RU").format(d);
    } else if (lang == "en") {
        str = new Intl.DateTimeFormat("en-US", {
            year: "numeric", month: "short", day: "numeric"
        }).format(d);
    } else {
        const f1 = new Intl.DateTimeFormat("ru-RU", {
            year: "numeric", month: "short", day: "numeric"
        });
        const f2 = new Intl.DateTimeFormat("en-US", {
            year: "numeric", month: "short", day: "numeric"
        });
        str = f1.format(d) + " / ";
        if (newpar) str += "<br>";
        str += f2.format(d);
    }
    return str;
};

let getChemTbl = function (lang, title, chemdata) {
    let tbl = '';
    if (chemdata.length) {
        tbl = '<table class="tablestyle" border="1" cellspacing="1" cellpadding="3">' +
                '<tr class="boldtext">' +
                    '<td colspan="' + chemdata.length + '" class="centeralign">' + esc(title) + '</td>' +
                '</tr>' +
                '<tr>';
        for (let i = 0; i < chemdata.length; i++) {
            tbl += '<td class="centeralign">' + esc(chemdata[i].sig) + '</td>';
        }
        tbl += '</tr>' +
            '<tr>';
        for (let i = 0; i < chemdata.length; i++) {
            tbl += '<td class="centeralign">' + insNumber(lang, chemdata[i].val, 3) + '</td>';
        }
        tbl += '</tr>' +
            '</table>';
    }
    return tbl;
};

let getMechTbl = function (lang, titleru, titleen, mechdata, footer = null) {
    let tbl = '';
    if (mechdata.length) {
        let id_cat_old = -1;
        tbl = '<table class="tablestyle" border="1" cellspacing="1" cellpadding="3">';
        for (let i = 0; i < mechdata.length; i++) {
            let id_cat = mechdata[i].id_cat;
            if (id_cat != id_cat_old) {
                let title = (id_cat_old < 0)
                    ? insText(lang, titleru + " " + mechdata[i].catnam, titleen + " " + mechdata[i].catnam_en, true)
                    : insText(lang, mechdata[i].catnam, mechdata[i].catnam_en, true);
                tbl += '<tr class="boldtext">' +
                    '<td colspan="3" class="centeralign">' + title + '</td>' +
                    '</tr>';
            }
            let prefix = insText(lang, mechdata[i].prefix, mechdata[i].prefix_en, true);
            let val = insNumber(lang, mechdata[i].val, 2);
            if (prefix.length) {
                val = prefix + " " + val;
            }
            if (typeof mechdata[i].val_max != "undefined" && mechdata[i].val_max != null) {
                val += " - " + insNumber(lang, mechdata[i].val_max, 2);
            }
            tbl += '<tr>' +
                '<td width="60%" class="leftalign">' + insText(lang, mechdata[i].nam, mechdata[i].nam_en, true) + '</td>' +
                '<td width="20%" class="centeralign">' + insText(lang, mechdata[i].sig, mechdata[i].sig_en, true) + '</td>' +
                '<td width="20%" class="rightalign">' + val + '</td>' +
                '</tr>';
            id_cat_old = id_cat;
        }
        if (footer != null) {
            tbl += '<tr>' +
                '<td colspan="3" class="leftalign">' + footer + '</td>' +
                '</tr>';
        }
        tbl += '</table>';
    }
    return tbl;
};

let getSertTbl = function (lang, sertdata, setSert) {
    let tbl = '';
    if (setSert.size) {
        tbl += '<table class="tablestyle" border="1" cellspacing="1" cellpadding="3">' +
            '<tr class="boldtext">' +
                '<td class="centeralign">' + insText(lang, "Вид документа", "Type of document", true) + '</td>' +
                '<td class="centeralign">' + insText(lang, "Сертифицирующий орган", "Certification authority", true) + '</td>' +
                '<td class="centeralign">' + insText(lang, "Номер документа", "Document Number", true) + '</td>' +
                '<td class="centeralign">' + insText(lang, "Дата выдачи", "Date of issue", true) + '</td>' +
            '</tr>';
        for (let i = 0; i < sertdata.length; i++) {
            if (setSert.has(sertdata[i].id_doc)) {
                tbl += '<tr>' +
                    '<td class="centeralign">' + insText(lang, sertdata[i].doc_nam, sertdata[i].doc_nam_en, true) + '</td>' +
                    '<td class="centeralign">' + insText(lang, sertdata[i].ved_nam, sertdata[i].ved_nam_en, true) + '</td>' +
                    '<td class="centeralign">' + insText(lang, sertdata[i].nom_doc, locale.insTrans(sertdata[i].nom_doc)) + '</td>' +
                    '<td class="centeralign">' + insDate(lang, sertdata[i].dat_doc, true) + '</td>' +
                '</tr>';
            }
        }
        tbl += '</table>';
    }
    return tbl;
};

let getSertPic = function (sertdata, setSert) {
    let im = "";
    let set = new Set();
    for (let i = 0; i < sertdata.length; i++) {
        if (setSert.has(sertdata[i].id_doc) && sertdata[i].is_simb && !set.has(sertdata[i].id_ved)) {
            set.add(sertdata[i].id_ved);
            im += '<img src="/depimages/' + sertdata[i].id_ved + '.png" alt="ved' + sertdata[i].id_ved + '" height="45"></img>';
        }
    }
    return im;
};

let getSertApp = function (lang, sertdata, setSert) {
    let app = "";
    let set = new Set();
    for (let i = 0; i < sertdata.length; i++) {
        if (setSert.has(sertdata[i].id_doc) && sertdata[i].id_doc_t == 3) {
            let dopru = ".";
            let dopen = ".";
            if (sertdata[i].grade_nam != null) {
                dopru = " по категории " + sertdata[i].grade_nam + dopru;
                dopen = " in category " + sertdata[i].grade_nam + dopen;
            }
            let str = insText(lang,
                "Одобрено " + sertdata[i].ved_short + dopru,
                "Approved by " + sertdata[i].ved_short_en + dopen,
                false);
            set.add(str);
        }
    }
    for (let value of set) {
        if (app != "") {
            app += "<br>";
        }
        app += value;
    }
    return app;
};

let getSign = function (lang, id_type, gendata) {
    let sign = "";
    if (id_type == 1) {
        sign += '<p style="text-align: right;">';
        sign += insText(lang, gendata.otk_title, gendata.otk_title_en, false) + "______________";
        sign += insText(lang, "[МЕСТО ДЛЯ ПЕЧАТИ, ПОДПИСЬ]", "[LOCUS SIGILLI, SIGNATURE]", false);
        sign += '</p>';
    } else if (id_type == 2) {
        // gendata.dat может прийти как Date или строкой — нормализуем.
        const dt = (gendata.dat instanceof Date) ? gendata.dat : new Date(gendata.dat);
        if (!isNaN(dt.getTime())) {
            const datSrc = dt.toLocaleString('ru-RU', { year: 'numeric', month: 'numeric', day: 'numeric' });
            const datDst = datSrc.split(".").reverse().join("-");
            const lg = (lang == "ru" || lang == "en") ? lang : "mix";
            sign += (lang == "ru" || lang == "en") ? "                        " : "   ";
            sign += '<img src="/signatures/' + lg + '/' + datDst + '.png" alt="sign" height="150"></img>';
        }
    } else if (id_type == 3) {
        let sep = (lang == "ru" || lang == "en") ? "                    " : "   ";
        sign += '<p style="text-align: right;">';
        sign += insText(lang, gendata.otk_title, gendata.otk_title_en, false);
        sign += "                                          ";
        sign += insText(lang, "Представитель ООО \"Транснефть Надзор\"", "Representative of Transneft Nadzor LLC", false);
        sign += "<br><br>";
        sign += "______________";
        sign += insText(lang, gendata.otk, gendata.otk_en, false);
        sign += sep;
        sign += "<u>" + insText(lang, "Ведущий инженер", "Lead Lower", false) + "</u>";
        sign += "   __________________   __________________";
        sign += '<p style="font-size: 10px; text-align: right;">';
        sign += "(" + insText(lang, "должность", "job title", false) + ")" + sep;
        sign += "(" + insText(lang, "подпись", "signature", false) + ")" + sep;
        sign += "(" + insText(lang, "ФИО", "full name", false) + ")" + sep;
        sign += '</p>';
        sign += '</p>';
    } else if (id_type == 4) {
        let sep = (lang == "ru" || lang == "en") ? "                    " : "   ";
        sign += '<p style="text-align: right;">';
        sign += insText(lang, gendata.otk_title, gendata.otk_title_en, false);
        sign += "                                          ";
        sign += insText(lang, "Представитель АО \"РТ-Техприемка\"", "Representative of JSC \"RT-Techpriemka\"", false);
        sign += "<br><br>";
        sign += "______________";
        sign += insText(lang, gendata.otk, gendata.otk_en, false);
        sign += "                        ";
        sign += "   __________________   __________________   __________________";
        sign += '<p style="font-size: 10px; text-align: right;">';
        sign += "(" + insText(lang, "должность", "job title", false) + ")" + sep;
        sign += "(" + insText(lang, "подпись", "signature", false) + ")" + sep;
        sign += "(" + insText(lang, "ФИО", "full name", false) + ")" + sep;
        sign += '</p>';
        sign += '</p>';
    } else if (id_type == 7) {
        let sep = (lang == "ru" || lang == "en") ? "                  " : "                 ";
        sign += '<p style="text-align: left;">';
        sign += insText(lang, "Представитель ООО \"Транснефть Надзор\"", "Representative of Transneft Nadzor LLC", false);
        sign += "<br><br>";
        sign += "<u>" + insText(lang, "Ведущий инженер", "Lead Lower", false) + "</u>";
        sign += "   __________________   __________________";
        sign += '<p style="font-size: 10px; text-align: left;">';
        sign += sep;
        sign += "(" + insText(lang, "должность", "job title", false) + ")" + sep;
        sign += "(" + insText(lang, "подпись", "signature", false) + ")" + sep;
        sign += "(" + insText(lang, "ФИО", "full name", false) + ")" + sep;
        sign += '</p>';
        sign += '</p>';
    } else if (id_type != 6) {
        sign += '<p style="text-align: center;">';
        sign += insText(lang, gendata.otk_title, gendata.otk_title_en, false) + "______________";
        sign += insText(lang, gendata.otk, gendata.otk_en, false);
        sign += '</p>';
    }
    return sign;
};

let getBackground = function (lang, id_type) {
    let back = "";
    if (id_type == 1) {
        let lg = (lang == "ru" || lang == "en") ? lang : "mix";
        back = 'background-image: url("/bg_' + lg + '.png");';
    }
    return back;
};

module.exports.getGeneralData = getGeneralData;
module.exports.insText = insText;
module.exports.insNumber = insNumber;
module.exports.insDate = insDate;
module.exports.getChemTbl = getChemTbl;
module.exports.getMechTbl = getMechTbl;
module.exports.getSertTbl = getSertTbl;
module.exports.getSertPic = getSertPic;
module.exports.getSertApp = getSertApp;
module.exports.getSign = getSign;
module.exports.getBackground = getBackground;