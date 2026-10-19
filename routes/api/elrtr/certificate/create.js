const srt = require('../../../../cert.js');
const locale = require('../../../../locale.js');
const data = require('./data.js');
const qr = require('../../../../barcode.js');
const path = require('path');

function getMainTbl(lang, headerdata, id_type, tudata, intdata) {
    let symb = "";
    const isBadMarka = headerdata.gt === "-" || headerdata.pu === "-";

    if (id_type === 5) {
        symb = isBadMarka
            ? `${srt.insText(lang, headerdata.marka, locale.insTrans(headerdata.marka))}-${srt.insNumber(lang, headerdata.diam, 1)}`
            : `${headerdata.gt}-${headerdata.pu}`;
    } else {
        symb = isBadMarka
            ? `${srt.insText(lang, headerdata.marka, locale.insTrans(headerdata.marka))}-${srt.insNumber(lang, headerdata.diam, 1)}`
            : `${srt.insText(lang, headerdata.gt, locale.insTrans(headerdata.gt, 'chem'))}-${srt.insText(lang, headerdata.marka, locale.insTrans(headerdata.marka))}-${srt.insNumber(lang, headerdata.diam, 1)}-${srt.insText(lang, headerdata.pu, locale.insTrans(headerdata.pu))}`;
    }

    if (headerdata.znam && headerdata.znam !== "-") {
        symb += `<br>${srt.insText(lang, headerdata.znam, locale.insTrans(headerdata.znam))}`;
    }

    const goststr = tudata
        .filter(t => t.nam.indexOf("ГОСТ") === 0)
        .map(t => t.nam)
        .join("<br>");

    const dat = (id_type !== 1) ? headerdata.dat : new Date(1111, 10, 11);
    const n_s = (id_type !== 1) ? headerdata.n_s : "1111";
    const massa = (id_type !== 1) ? headerdata.massa : 1111.0;

    if (id_type === 5) {
        let tbl = `<table class="tablestyle" border="1" cellspacing="1" cellpadding="3">
            <tr class="boldtext">
                <td class="centeralign" rowspan="2" width="120">${srt.insText(lang, "Наименование продукции", "Product designation", true)}</td>
                <td class="centeralign" colspan="${1 + intdata.length}">${srt.insText(lang, "Классификация", "Classification", true)}</td>
                <td class="centeralign" rowspan="2">${srt.insText(lang, "Проволока по ГОСТ&nbsp;2246-70", "Wire <br>according to GOST&nbsp;2246-70", true)}</td>
                <td class="centeralign" rowspan="2">${srt.insText(lang, "Номер партии", "Batch number", true)}</td>
                <td class="centeralign" rowspan="2">${srt.insText(lang, "Дата производства", "Date of manufacture", true)}</td>
                <td class="centeralign" rowspan="2">${srt.insText(lang, "Масса электродов нетто, кг", "Net weight, kg", true)}</td>
            </tr>
            <tr>
                <td class="centeralign" width="150">${srt.insText(lang, goststr, locale.insTrans(goststr))}</td>`;

        for (const item of intdata) {
            tbl += `<td class="centeralign" width="100">${item.nam}</td>`;
        }

        tbl += `</tr><tr>
                <td class="centeralign">${srt.insText(lang, headerdata.marka, locale.insTrans(headerdata.marka))}-∅${srt.insNumber(lang, headerdata.diam, 1)}</td>
                <td class="centeralign">${symb}</td>`;

        for (const item of intdata) {
            tbl += `<td class="centeralign">${item.val}</td>`;
        }

        tbl += `<td class="centeralign">${srt.insText(lang, headerdata.provol, locale.insTrans(headerdata.provol))}</td>
                <td class="centeralign">${n_s}</td>
                <td class="centeralign">${srt.insDate(lang, dat, true)}</td>
                <td class="centeralign">${srt.insNumber(lang, massa, 1)}</td>
            </tr></table>`;
        return tbl;
    }

    return `<table class="tablestyle" border="1" cellspacing="1" cellpadding="3">
        <tr class="boldtext">
            <td width="300" class="centeralign">${srt.insText(lang, "Условное обозначение электрода", "Electrode symbol", true)}</td>
            <td class="centeralign">${srt.insText(lang, "Проволока по ГОСТ&nbsp;2246-70", "Wire <br>according to GOST&nbsp;2246-70", true)}</td>
            <td class="centeralign">${srt.insText(lang, "Номер партии", "Batch number", true)}</td>
            <td class="centeralign">${srt.insText(lang, "Дата производства", "Date of manufacture", true)}</td>
            <td class="centeralign">${srt.insText(lang, "Масса электродов нетто, кг", "Net weight, kg", true)}</td>
        </tr>
        <tr>
            <td class="centeralign">${symb}</td>
            <td class="centeralign">${srt.insText(lang, headerdata.provol, locale.insTrans(headerdata.provol, 'chem'))}</td>
            <td class="centeralign">${n_s}</td>
            <td class="centeralign">${srt.insDate(lang, dat, true)}</td>
            <td class="centeralign">${srt.insNumber(lang, massa, 1)}</td>
        </tr></table>`;
}

function getQrCode(lang, headerdata, id_type, is_ship) {
    if (id_type >= 6 && headerdata.id_ship != null) {
        const url = `https://certificates.czcm-weld.ru/${headerdata.hash}/${headerdata.id_ship}-${lang}.pdf`;
        return `/api/qrcode/300.png?data=${qr.encodeBase64Url(Buffer.from(url))}`;
    }

    const n_s = (id_type !== 1) ? headerdata.n_s : "1111";
    const date_pr = (id_type !== 1) ? headerdata.dat : new Date(1111, 10, 11);
    const date = (id_type !== 1) ? headerdata.datvid : new Date(1111, 10, 11);
    const samplePref = (id_type !== 1) ? "СЕРТИФИКАТ КАЧЕСТВА №" : "ОБРАЗЕЦ СЕРТИФИКАТА КАЧЕСТВА №";
    const massa = (id_type !== 1) ? headerdata.massa : 1111.0;

    let code = `${samplePref}${n_s}-${headerdata.year}`;
    if (is_ship) code += `/${headerdata.nomer}`;

    code += `\nМарка ${headerdata.marka}\nДиаметр, мм ${srt.insNumber("ru", headerdata.diam, 0)}\nНомер партии ${n_s}\n`;
    code += `Дата производства ${srt.insDate("ru", date_pr, false)}\nМасса нетто, кг ${srt.insNumber("ru", massa, 0)}\n`;

    if (is_ship && id_type !== 1) {
        code += "Грузополучатель: ";
        code += (headerdata.pol !== headerdata.pol2 && headerdata.doublepol)
            ? `${headerdata.pol2} (для ${headerdata.pol})\n`
            : `${headerdata.pol}\n`;
    }
    code += `Дата ${srt.insDate("ru", date, false)}\nКод подлинности ${headerdata.code}`;
    return `/api/qrcode/300.png?data=${qr.encodeBase64Url(Buffer.from(code))}`;
}

module.exports = function (app) {
    app.get("/elrtr/certificates/:id_type/:id", async (req, res) => {
        try {
            const id = Number(req.params.id);
            const id_type = Number(req.params.id_type);
            const lang = req.query.lang || "ru";
            const is_ship = (typeof req.query.part === "undefined" || req.query.part === "false");

            const ennum = (id_type === 3 || id_type === 4) ? "3.2" : "3.1";
            const enru = `Испытания: согласно ${ennum} EN 10204.`;
            const enen = `Tests: according to ${ennum} EN 10204.`;

            // Шаг 1: Извлекаем базовый заголовок поставки
            const headerdata = await data.getHeaderData(id, is_ship);
            const id_part = headerdata.id;

            // Шаг 2: Параллельно собираем все связанные наборы данных из СУБД/модулей
            const [gendata, tudata, chemdata, mechdata, sertdata, intdata] = await Promise.all([
                srt.getGeneralData(headerdata.datvid),
                data.getTuData(id_part),
                data.getChemData(id_part),
                data.getMechData(id_part),
                data.getSertData(id_part),
                data.getIntData(id_part)
            ]);

            // Шаг 3: Вычисляем видимые сертификаты соответствия
            const setSert = new Set();
            if (typeof req.query.docs !== "undefined") {
                if (req.query.docs !== "") {
                    req.query.docs.split("|").forEach(d => setSert.add(Number(d)));
                }
            } else {
                sertdata.filter(s => s.en === true).forEach(s => setSert.add(s.id_doc));
            }

            const tustr = tudata.map(t => t.nam).join(", ");
            const n_s = (id_type !== 1) ? headerdata.n_s : "1111";
            const datvid = (id_type !== 1) ? headerdata.datvid : new Date(1111, 10, 11);

            let numSert = `${n_s}-${headerdata.year}`;

            let poltitle = "", pol = "";

            if (is_ship) {
                numSert += `/${headerdata.nomer}`;
                poltitle = `${srt.insText(lang, "Грузополучатель", "Consignee", false)}:`;
                if (id_type !== 1) {
                    pol = (headerdata.pol !== headerdata.pol2 && headerdata.doublepol)
                        ? srt.insText(lang, headerdata.pol2, headerdata.pol2_en) + srt.insText(lang, " (для ", " (for ") + srt.insText(lang, headerdata.pol, headerdata.pol_en) + ")"
                        : srt.insText(lang, headerdata.pol, headerdata.pol_en);
                }
            }

            const head = `${srt.insText(lang, "СЕРТИФИКАТ КАЧЕСТВА", "QUALITY CERTIFICATE", false)} №${numSert}`;

            const chemtitle = srt.insText(lang, `${enru} Химический состав наплавленного металла, %`, `${enen} Chemical composition of weld metal, %`, true);

            // Шаг 4: Отрисовка шаблона Handlebars
            res.render(path.join(__dirname, "..", "..", "..", "..", "views", "cert.hbs"), {
                title: "elrtr_"+numSert,
                header: head,
                adr: srt.insText(lang, gendata.adr, gendata.adr_en, true),
                tel: gendata.tel,
                fnam: srt.insText(lang, `Сертификат качества по форме ${ennum} EN 10204<br><br>${gendata.fnam}`, `Quality certificate according to form ${ennum} EN 10204<br><br>${gendata.fnam_en}`, true),
                tutitle: `${srt.insText(lang, "Нормативная документация", "Normative documents", false)}: `,
                tustr: srt.insText(lang, tustr, locale.insTrans(tustr), false),
                maintbl: getMainTbl(lang, headerdata, id_type, tudata, intdata),
                chemtbl: srt.getChemTbl(lang, chemtitle, chemdata),
                mechtbl: srt.getMechTbl(lang, enru, enen, mechdata),
                srtheader: setSert.size ? srt.insText(lang, "Аттестация и сертификация", "Certification", false) : "",
                serttbl: srt.getSertTbl(lang, sertdata, setSert),
                sertpic: srt.getSertPic(sertdata, setSert),
                sertapp: srt.getSertApp(lang, sertdata, setSert),
                poltitle: poltitle, pol: pol,
                note: srt.insText(lang, "При переписке по вопросам качества просьба ссылаться на номер партии", "When correspondence on quality issues, please refer to the batch number", true),
                constitle: `${srt.insText(lang, "Заключение", "Conclusion", false)}:`,
                cons: srt.insText(lang, `соответствует требованиям ${tustr}`, `meets the requirements of ${locale.insTrans(tustr)}`, true),
                dattitle: `${srt.insText(lang, "Дата выдачи сертификата", "Date of issue of the certificate", false)}: `,
                dat: srt.insDate(lang, datvid, false),
                qrsrc: getQrCode(lang, headerdata, id_type, is_ship),
                sign: srt.getSign(lang, id_type, gendata),
                back: srt.getBackground(lang, id_type)
            });

        } catch (error) {
            console.error("CERTIFICATE ROUTE ERROR:", error);
            if (!res.headersSent) {
                res.status(500).type("text/plain").send(error.message);
            }
        }
    });

    // Служебный эндпоинт получения сырых данных
    app.get("/elrtr/sertdata/:id", async (req, res) => {
        try {
            const sertdata = await data.getSertData(Number(req.params.id));
            res.json(sertdata);
        } catch (error) {
            console.error("SERTDATA ERROR:", error);
            res.status(500).type("text/plain").send(error.message);
        }
    });
};
