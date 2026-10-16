const srt = require('../../../../cert.js');
const locale = require('../../../../locale.js');
const data = require('./data.js');
const qr = require('../../../../barcode.js');

function getMainTbl(lang, headerdata, id_type) {
    const dat = (id_type !== 1) ? headerdata.dat : new Date(1111, 10, 11);
    const n_s = (id_type !== 1) ? headerdata.n_s : "1111";
    const massa = (id_type !== 1) ? headerdata.massa : 1111.0;
    const nplav = (id_type !== 1) ? headerdata.nplav : '111111';

    return `<table class="tablestyle" border="1" cellspacing="1" cellpadding="3">
        <tr class="boldtext">
            <td width="130" class="centeralign">${srt.insText(lang, "Марка проволоки", "Wire mark", true)}</td>
            <td width="140" class="centeralign">${srt.insText(lang, "Условное обозначение", "Wire symbol", true)}</td>
            <td class="centeralign">${srt.insText(lang, "Тип носителя", "Type of wire winding", true)}</td>
            <td class="centeralign">${srt.insText(lang, "Номер плавки", "Heat number", true)}</td>
            <td class="centeralign">${srt.insText(lang, "Номер партии", "Batch number", true)}</td>
            <td class="centeralign">${srt.insText(lang, "Дата производства", "Date of manufacture", true)}</td>
            <td class="centeralign">${srt.insText(lang, "Масса нетто, кг", "Net weight, kg", true)}</td>
        </tr>
        <tr>
            <td class="centeralign">${headerdata.bprov}</td>
            <td class="centeralign">${srt.insNumber(lang, headerdata.diam, 1)} ${headerdata.prov}</td>
            <td class="centeralign">${srt.insText(lang, headerdata.spool, headerdata.spool_en, true)}</td>
            <td class="centeralign">${nplav}</td>
            <td class="centeralign">${n_s}</td>
            <td class="centeralign">${srt.insDate(lang, dat, true)}</td>
            <td class="centeralign">${srt.insNumber(lang, massa, 1)}</td>
        </tr>
    </table>`;
}

function getQrCode(lang, headerdata, id_type, is_ship) {
    if (id_type >= 6 && headerdata.id_ship != null) {
        const url = `https://certificates.czcm-weld.ru/${headerdata.hash}/${headerdata.id_ship}-${lang}.pdf`;
        return `/api/qrcode/300.png?data=${qr.encodeBase64Url(Buffer.from(url))}`;
    }

    const n_s = (id_type !== 1) ? headerdata.n_s : "1111";
    const date_pr = (id_type !== 1) ? headerdata.dat : new Date(1111, 10, 11);
    const date = (id_type !== 1) ? headerdata.datvid : new Date(1111, 10, 11);
    const pref = (id_type !== 1) ? "СЕРТИФИКАТ КАЧЕСТВА №" : "ОБРАЗЕЦ СЕРТИФИКАТА КАЧЕСТВА №";
    const massa = (id_type !== 1) ? headerdata.massa : 1111.0;
    
    let code = `${pref}${n_s}-${headerdata.year}${is_ship ? "/" + headerdata.nomer : ""}\n`;
    code += `Марка проволоки ${headerdata.bprov}\n`;
    code += `Условное обозначение проволоки ${srt.insNumber("ru", headerdata.diam, 1)} ${headerdata.prov}\n`;
    code += `Тип носителя проволоки ${headerdata.spool}\nНомер плавки ${headerdata.nplav}\nНомер партии ${n_s}\n`;
    code += `Дата производства ${srt.insDate("ru", date_pr, false)}\nМасса нетто, кг ${srt.insNumber("ru",massa, 0)}\n`;
    if (is_ship && id_type !== 1) code += `Грузополучатель: ${headerdata.pol}\n`;
    code += `Дата ${srt.insDate("ru", date, false)}\nКод подлинности ${headerdata.code}`;

    return `/api/qrcode/300.png?data=${qr.encodeBase64Url(Buffer.from(code))}`;
}

module.exports = function (app) {
    app.get("/wire/certificates/:id_type/:id", async (req, res) => {
        try {
            const id = Number(req.params.id);
            const id_type = Number(req.params.id_type);
            const lang = req.query.lang || "ru";
            const is_ship = (typeof req.query.part === "undefined" || req.query.part === "false");
            
            const ennum = (id_type === 3 || id_type === 4) ? "3.2" : "3.1";
            const enru = `Испытания: согласно ${ennum} EN 10204.`;
            const enen = `Tests: according to ${ennum} EN 10204.`;

            // 1. Получаем заголовок
            const headerdata = await data.getHeaderData(id, is_ship);
            const id_part = headerdata.id;

            // 2. Параллельный асинхронный сбор данных из СУБД
            const [gendata, tudata, chemdata, mechdata, sertdata] = await Promise.all([
                srt.getGeneralData(headerdata.datvid),
                data.getTuData(id_part),
                data.getChemData(id_part),
                data.getMechData(id_part),
                data.getSertData(id_part)
            ]);

            // 3. Вычисление выбранных документов
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

            let head = `${srt.insText(lang, "СЕРТИФИКАТ КАЧЕСТВА", "QUALITY CERTIFICATE", false)} №${n_s}-${headerdata.year}`;
            let poltitle = "", pol = "";

            if (is_ship) {
                head += `/${headerdata.nomer}`;
                poltitle = `${srt.insText(lang, "Грузополучатель", "Consignee", false)}:`;
                if (id_type !== 1) pol = srt.insText(lang, headerdata.pol, headerdata.pol_en);
            }

            // Формируем текст подвала в зависимости от типа носителя
            const isLType = headerdata.spool.indexOf("L-") === 0;
            const footer = isLType 
                ? srt.insText(lang, "Состояние поверхности проволоки: поверхность проволоки чистая, гладкая, без трещин, расслоений, плен, закатов, раковин, забоин. На поверхности допускаются мелкие волочильные риски, царапины, отдельные вмятины, но их глубина не должна превышать 1/4 предельного отклонения по диаметру.", "Wire surface condition: The wire surface is clean and smooth, free of cracks, delamination, film, overlaps, voids, and nicks. Minor drawing marks, scratches, and individual dents are permitted on the surface, but their depth should not exceed 1/4 of the maximum diameter deviation.", true)
                : srt.insText(lang, "Состояние поверхности проволоки: поверхность проволоки чистая, гладкая, без трещин, расслоений, плен, закатов, раковин, забоин, окалины, ржавчины, масла, технологической смазки и других загрязнений.", "The condition of the surface of the wire: the surface of the wire is clean, smooth, without cracks, delaminations, slivers, laps, shells, nicks, scale, rust, oil, grease and other contaminants.", true);

            const chemtitle = srt.insText(lang, `${enru} Химический состав проволоки, %`, `${enen} The chemical composition of the wire, %`, true);
            
            // 4. Рендеринг страницы
            res.render(__dirname + "/../../../../views/cert.hbs", {
                header: head, 
                adr: srt.insText(lang, gendata.adr, gendata.adr_en, true), 
                tel: gendata.tel,
                fnam: srt.insText(lang, `Сертификат качества по форме ${ennum} EN 10204<br><br>${gendata.fnam}`, `Quality certificate according to form ${ennum} EN 10204<br><br>${gendata.fnam_en}`, true),
                tutitle: `${srt.insText(lang, "Нормативная документация", "Normative documents", false)}: `,
                tustr: srt.insText(lang, tustr, locale.insTrans(tustr), false),
                maintbl: getMainTbl(lang, headerdata, id_type),
                chemtbl: srt.getChemTbl(lang, chemtitle, chemdata),
                mechtbl: srt.getMechTbl(lang, enru, enen, mechdata, footer),
                srtheader: setSert.size ? srt.insText(lang, "Аттестация и сертификация", "Certification", false) : "",
                serttbl: srt.getSertTbl(lang, sertdata, setSert),
                sertpic: srt.getSertPic(sertdata, setSert),
                sertapp: srt.getSertApp(lang, sertdata, setSert),
                poltitle, pol,
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
            console.error("WIRE ROUTE ERROR:", error);
            if (!res.headersSent) res.status(500).type("text/plain").send(error.message);
        }
    });

    app.get("/wire/sertdata/:id", async (req, res) => {
        try {
            const sertdata = await data.getSertData(Number(req.params.id));
            res.json(sertdata);
        } catch (error) {
            console.error("WIRE SERTDATA ERROR:", error);
            res.status(500).type("text/plain").send(error.message);
        }
    });
};