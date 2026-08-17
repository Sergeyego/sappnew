const db = require('../../../../postgres.js');
const doc = require('../../../../invoice.js');

module.exports = function (app) {
    app.get("/elrtr/invoices/workshopper/:beg/:end", async (req, res) => {
        try {
            const { beg, end } = req.params;

            // Единый объект параметров для исключения путаницы с индексами $1, $2
            const queryParams = {
                beg: beg,
                end: end
            };

            // 1. Извлекаем метаданные шапки периодического отчета по браку
            const titleQuery = `
                SELECT date_part('month', \${end}::date) AS num, 
                       NULL AS dat, 
                       t.nam AS tnam, 
                       d.nam AS dnam, 
                       ef.nam AS efnam, 
                       et.nam AS etnam, 
                       to_char(\${beg}::date, 'DD.MM.YYYY') || '-' || to_char(\${end}::date, 'DD.MM.YYYY') AS period 
                FROM parti_nakl_tip AS t 
                INNER JOIN nakl_doc AS d ON d.id = t.id_doc 
                INNER JOIN nakl_emp AS ef ON ef.id = t.id_from 
                INNER JOIN nakl_emp AS et ON et.id = t.id_to 
                WHERE t.id = 2
            `;
            const dataTitle = await db.oneOrNone(titleQuery, queryParams);

            if (!dataTitle) {
                return res.status(404).type('text/plain').send('Тип цеховой накладной брака (ID: 2) не найден в справочнике');
            }

            // 2. Извлекаем агрегированные строки бракованной продукции за указанный период
            const itemsQuery = `
                SELECT e.marka || ' ' || 'ф' || p.diam || 
                       CASE WHEN p.id_var <> 1 THEN ' /' || ev.nam || '/' ELSE '' END || 
                       ' (' || ep.pack_ed || ')' AS nam, 
                       NULL AS npart, 
                       SUM(w.kvo) AS kvo 
                FROM parti_break AS w 
                INNER JOIN parti_nakl pn ON pn.id = w.id_nakl 
                INNER JOIN parti AS p ON p.id = w.id_part 
                INNER JOIN el_pack AS ep ON ep.id = p.id_pack 
                INNER JOIN elrtr AS e ON e.id = p.id_el 
                INNER JOIN elrtr_vars ev ON ev.id = p.id_var 
                WHERE pn.dat BETWEEN \${beg}::date AND \${end}::date 
                GROUP BY e.marka, p.diam, ev.nam, p.id_var, ep.pack_ed 
                ORDER BY nam
            `;
            const dataItems = await db.any(itemsQuery, queryParams);

            // 3. Асинхронная генерация Word-документа .docx
            const b64string = await doc.createDoc(dataTitle, dataItems);

            // Настройка правильных и безопасных заголовков HTTP-ответа
            res.setHeader('Content-Disposition', 'attachment; filename="invoice.docx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

            // Отправляем бинарный буфер клиенту
            res.send(Buffer.from(b64string, 'base64'));

        } catch (error) {
            console.error('Ошибка генерации периодического цехового отчета:', error);
            res.status(500).type('text/plain').send(error.message);
        }
    });
};