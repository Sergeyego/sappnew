const path = require('path');
const creator = require('../../../../labels/universallabel.js');
const db = require('../../../../postgres.js');
const locale = require('../../../../locale.js');

async function getSrtStr(id_part) {
    let srtStr = "";
    const srt = new Map();

    try {
        // Используем db.task для выполнения обоих запросов в рамках одного подключения
        const result = await db.task(async t => {
            // 1. Загружаем справочник docType
            const docTypes = await t.any('select id, nam from zvd_doc_type order by nam');
            
            // Преобразуем в удобный объект (кэш)
            const docTypeMap = {};
            for (const row of docTypes) {
                docTypeMap[row.id] = row.nam;
            }

            // 2. Основной запрос. Используем именованный параметр $/id_part/, 
            // pg-promise сам подставит его во все нужные места SQL-строки.
            const queryText = `
                select z.id_doc_t, z.ved_short, z.grade_nam 
                from zvd_get_sert_var(
                    (select dat_part from parti where id = $/id_part/), 
                    (select id_el from parti where id = $/id_part/), 
                    (select d.id from diam as d where d.diam = (select diam from parti where id = $/id_part/)), 
                    (select id_var from parti where id = $/id_part/)
                ) as z 
                where z.en = true 
                order by z.id_doc_t, z.ved_short
            `;
            const rows = await t.any(queryText, { id_part });

            return { docTypeMap, rows };
        });

        const { docTypeMap, rows } = result;

        // 3. Обработка полученных строк
        for (const row of rows) {
            const id_doc_t = parseInt(row.id_doc_t, 10);
            const ved = row.ved_short || "";
            const grade = row.grade_nam || "";

            let s = ved;
            if (grade !== "") {
                s += " категория " + grade;
            }

            if (!srt.has(id_doc_t)) {
                srt.set(id_doc_t, new Set());
            }
            const currentSet = srt.get(id_doc_t);

            if (currentSet.has(ved) && ved !== s) {
                currentSet.delete(ved);
            }

            const hasMatch = Array.from(currentSet).some(item => item.startsWith(s));
            if (!hasMatch) {
                currentSet.add(s);
            }
        }

        // 4. Формируем итоговую строку
        const sortedKeys = Array.from(srt.keys()).sort((a, b) => a - b);

        for (const key of sortedKeys) {
            if (srtStr !== "") {
                srtStr += "\n";
            }
            
            const typeName = docTypeMap[key] !== undefined ? docTypeMap[key] : key;
            srtStr += typeName + ":";

            const valuesList = Array.from(srt.get(key)).sort();
            for (const st of valuesList) {
                srtStr += "\n" + st;
            }
        }

    } catch (err) {
        console.error("Error executing task:", err.message || err);
        throw err;
    }

    return srtStr;
}

let createLabel = async function (id_lbl, id_part, dpi) {

    const queryPart = `select p.id as id, p.n_s as n_s, p.dat_part as dat_part, coalesce(e.marka_sert,e.marka) as marka, p.diam as diam, 
        ep.mass_ed as mass_ed, ep.mass_group as mass_group, ee.ean_ed as ean_ed, ee.ean_group as ean_group, 
        g.nam as typ, pu.nam as suffix, coalesce(p.ibco, ev.znam) as znam, e.vl as vl, 
        ev.proc as proc, ev.descr as descr, e.id_pic as id_pic, p.ok as ok
        from parti as p 
        inner join elrtr as e on p.id_el=e.id 
        inner join el_pack as ep on ep.id=p.id_pack 
        left join el_var ev on ev.id_el = p.id_el and ev.id_var = p.id_var 
        left join gost_types as g on ev.id_gost_type=g.id 
        inner join purpose as pu on e.id_purpose=pu.id 
        left join ean_el ee on ee.id_el = p.id_el and ee.id_diam = (select d.id from diam d where d.diam=p.diam) and ee.id_pack = p.id_pack 
        where p.id = $1`;

    const queryTu = `select nam from zvd_get_tu_var((select dat_part from parti where id = $1 ), 
        (select id_el from parti where id = $1 ), 
        (select d.id from diam as d where d.diam = (select diam from parti where id = $1 )), 
        (select id_var from parti where id = $1 ) ) `;

    const queryAmp = `select d.diam, a.bot, a.vert, a.ceil 
        from amp as a 
        inner join diam as d on a.id_diam = d.id 
        where a.id_el = (select id_el from parti where id = $1 ) 
        and d.diam = (select diam from parti where id = $1 ) 
        and a.id_var = (select id_var from parti where id = $1 )`;

    const srtStr = await getSrtStr(id_part);
    //console.log(srtStr);

    const queryAdr = `select nam_lbl ||', '|| adr as adr from hoz where id=1`;

    const dataPart = await db.one(queryPart, [id_part]);
    const dataTu = await db.any(queryTu, [id_part]);
    const dataAmp = await db.one(queryAmp, [id_part]);
    const dataAdr = await db.one(queryAdr);

    const label = new creator(150, 60, dpi);

    label
        .round(4, 4, 141, 54, 0)
        .line(4, 50, 145, 50)
        .line(4, 54, 145, 54)
        .line(21, 4, 21, 50)
        .line(21, 16, 145, 16)
        .line(119, 16, 119, 50)
        .line(21, 34, 119, 34)
        .line(68, 34, 68, 50)
        .line(33, 34, 33, 50)
        .line(33, 38, 68, 38)
        .line(33, 42, 68, 42)
        .line(21, 46, 68, 46)
        .line(44, 42, 44, 50)
        .line(56, 42, 56, 50)
        .line(50, 4, 50, 16)
        .line(85, 4, 85, 16)
        .line(104, 4, 104, 16);

    label.block(dataPart.marka, 22, 6, 27, 6, 5, 0, 'center', true, 'center', { bold: true });

    label.block(dataTu.map(item => item.nam).join('\n'), 51, 5, 32, 10, 3, 0, 'left', true, 'top');

    const ean = (id_lbl === 1) ? dataPart.ean_ed : dataPart.ean_group;
    const sku = ean.slice(7, 12);

    label.block(`Арт.${sku}`, 86, 6.5, 17, 5, 5, 0, 'center', true, 'center');

    label.line(105, 10, 144, 10);
    label.block(dataPart.typ + '-' + dataPart.marka + '-' + dataPart.suffix, 105, 5, 39, 4, 4, 0, 'center', true, 'center');
    label.block(dataPart.znam, 105, 10, 39, 4, 4, 0, 'center', true, 'center');

    label.block(dataPart.descr, 35, 16, 82, 16, 3);

    const mass = (id_lbl === 1) ? locale.insNumber(dataPart.mass_ed) : locale.insNumber(dataPart.mass_group);

    label.block(`Диаметр, мм - ${locale.insNumber(dataPart.diam, 1)}\nПартия - ${dataPart.n_s}\nМасса нетто, кг - ${mass}\nДата изг. - ${locale.insDate(dataPart.dat_part)}`, 69, 35, 35, 13, 3);

    label.block(srtStr, 120, 17, 24, 21);

    label.block('Диам.,\nмм', 22, 35, 10, 9, 3, 0, 'center');
    label.block('Рекомендуемое значение тока, А', 34, 34.4, 33, 3, 3, 0, 'center');
    label.block('Положение шва', 34, 38, 33, 3, 3, 0, 'center');
    label.block('Нижнее', 33.5, 42, 10, 3, 3, 0, 'center');
    label.block('Вертик.', 45, 42, 10, 3, 3, 0, 'center');
    label.block('Потолоч.', 57, 42, 10, 3, 3, 0, 'center');

    label.block(locale.insNumber(dataAmp.diam, 1), 22, 46.3, 10, 3, 3, 0, 'center');
    label.block(dataAmp.bot, 33.5, 46.3, 10, 3, 3, 0, 'center');
    label.block(dataAmp.vert, 45, 46.3, 10, 3, 3, 0, 'center');
    label.block(dataAmp.ceil, 57, 46.3, 10, 3, 3, 0, 'center');

    label.block(`Допустимое содержание влаги в покрытии перед истользованием - ${dataPart.vl} %. Режим повторной прокалки: ${dataPart.proc}.`, 5, 50, 140, 3, 3, 0);

    label.block(`Изготовитель: ${dataAdr.adr}`, 5, 54.3, 140, 3, 3, 0);

    await label.barcode(ean, 6, 8, 13, 'ean13', 'L', 1.125, true);

    await label.barcode("4627120423395e67985__2074-2026", 105, 36, 11, 'datamatrix', 'N', 1.125, true);


    const imagePosPath = path.join(__dirname, `../../../../public/pos-${dataPart.id_pic}.png`);
    await label.image(imagePosPath, 22, 19.5, 11, 11);

    if (id_lbl === 2) {
        const imageFragPath = path.join(__dirname, '../../../../public/fragile.png');
        await label.image(imageFragPath, 122, 38.5, 20, 10);
    }
    return label;
}

module.exports = function (app) {
    app.get("/elrtr/labels/get", async (req, res) => {
        try {

            const label = await createLabel(2, 65958, 203);

            const pngBuffer = label.toPNG();

            // Отключаем кэш на уровне HTTP
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            res.setHeader('Content-Type', 'image/png');
            res.send(pngBuffer);

        } catch (error) {
            console.error(error);
            res.status(500).type('text/plain').send(error.message);
        }
    });
}