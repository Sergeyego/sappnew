const db = require('../../../../postgres.js');
const doc = require('../../../../invoice.js');

module.exports = function (app) {
    app.get("/elrtr/invoices/selfper/:type/:beg/:end", async (req, res) => {
        try {
            const type = Number(req.params.type);
            const { beg, end } = req.params;

            // Валидация входных параметров
            if (Number.isNaN(type)) {
                return res.status(400).type('text/plain').send('Некорректный идентификатор типа (статьи)');
            }

            // Создаем единый объект параметров для безопасной и понятной подстановки в SQL
            const queryParams = {
                beg: beg,
                end: end,
                type: type
            };

            // 1. Извлекаем метаданные шапки периодической накладной
            // Использование именованных параметров ${variable} исключает путаницу с индексами $1, $2
            const titleQuery = `
                SELECT date_part('month', \${end}::date) AS num, 
                       NULL AS dat, 
                       sc.nam AS tnam, 
                       nd.nam AS dnam, 
                       ne.nam AS efnam, 
                       ne2.nam AS etnam, 
                       to_char(\${beg}::date, 'DD.MM.YYYY') || '-' || to_char(\${end}::date, 'DD.MM.YYYY') AS period 
                FROM self_cons sc 
                INNER JOIN nakl_doc nd ON nd.id = sc.id_doc 
                INNER JOIN nakl_emp ne ON ne.id = sc.id_from 
                INNER JOIN nakl_emp ne2 ON ne2.id = sc.id_to 
                WHERE sc.id = \${type}
            `;
            const dataTitle = await db.oneOrNone(titleQuery, queryParams);

            if (!dataTitle) {
                return res.status(404).type('text/plain').send('Статья собственного потребления не найдена');
            }

            // 2. Извлекаем агрегированные строки (сумму килограмм) за указанный период
            const itemsQuery = `
                SELECT e.marka || ' ' || 'ф' || p.diam || 
                       CASE WHEN p.id_var <> 1 THEN ' /' || ev.nam || '/' ELSE '' END || 
                       ' (' || ep.pack_ed || ')' AS nam, 
                       NULL AS npart, 
                       SUM(psi.kvo) AS kvo 
                FROM prod_self_items psi 
                INNER JOIN prod_self ps ON ps.id = psi.id_self 
                INNER JOIN parti AS p ON p.id = psi.id_part 
                INNER JOIN elrtr AS e ON e.id = p.id_el 
                INNER JOIN el_pack AS ep ON ep.id = p.id_pack 
                INNER JOIN elrtr_vars ev ON ev.id = p.id_var 
                WHERE ps.id_cons = \${type} 
                  AND ps.dat BETWEEN \${beg}::date AND \${end}::date 
                GROUP BY e.marka, p.diam, ev.nam, p.id_var, ep.pack_ed 
                ORDER BY nam
            `;
            const dataItems = await db.any(itemsQuery, queryParams);

            // 3. Асинхронная генерация Word-документа
            const b64string = await doc.createDoc(dataTitle, dataItems);

            res.setHeader('Content-Disposition', 'attachment; filename="invoice.docx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

            // Отдача бинарного буфера в поток ответа
            res.send(Buffer.from(b64string, 'base64'));

        } catch (error) {
            console.error('Ошибка генерации периодической накладной собств. потребления:', error);
            res.status(500).type('text/plain').send(error.message);
        }
    });
};