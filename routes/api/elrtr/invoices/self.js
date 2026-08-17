const db = require('../../../../postgres.js');
const doc = require('../../../../invoice.js');

module.exports = function (app) {
    app.get("/elrtr/invoices/self/:invId", async (req, res) => {
        try {
            const invId = Number(req.params.invId);

            // Валидация входящего параметра на уровне API
            if (Number.isNaN(invId)) {
                return res.status(400).type('text/plain').send('Некорректный идентификатор накладной');
            }

            // 1. Извлекаем метаданные шапки накладной собственного потребления
            const titleQuery = `
                SELECT n.num AS num, 
                       n.dat AS dat, 
                       n.kto AS tnam, 
                       nd.nam AS dnam, 
                       ne.nam AS efnam, 
                       ne2.nam AS etnam 
                FROM prod_self AS n 
                INNER JOIN self_cons sc ON sc.id = n.id_cons 
                INNER JOIN nakl_doc nd ON nd.id = sc.id_doc 
                INNER JOIN nakl_emp ne ON ne.id = sc.id_from 
                INNER JOIN nakl_emp ne2 ON ne2.id = sc.id_to 
                WHERE n.id = $1
            `;
            const dataTitle = await db.oneOrNone(titleQuery, [invId]);

            if (!dataTitle) {
                return res.status(404).type('text/plain').send('Накладная собственного потребления не найдена');
            }

            // 2. Читаемый и безопасный SQL-запрос для строк спецификации накладной
            const itemsQuery = `
                SELECT e.marka || ' ' || 'ф' || p.diam || 
                       CASE WHEN p.id_var <> 1 THEN ' /' || ev.nam || '/' ELSE '' END || 
                       ' (' || ep.pack_ed || ')' AS nam, 
                       p.n_s AS npart, 
                       w.kvo AS kvo 
                FROM prod_self_items AS w 
                INNER JOIN parti AS p ON p.id = w.id_part 
                INNER JOIN elrtr AS e ON e.id = p.id_el 
                INNER JOIN el_pack AS ep ON ep.id = p.id_pack 
                INNER JOIN elrtr_vars ev ON ev.id = p.id_var 
                WHERE w.id_self = $1 
                ORDER BY w.id_part
            `;
            const dataItems = await db.any(itemsQuery, [invId]);

            // 3. Асинхронная генерация .docx документа
            const b64string = await doc.createDoc(dataTitle, dataItems);

            res.setHeader('Content-Disposition', 'attachment; filename="invoice.docx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

            // Передача бинарного буфера клиенту
            res.send(Buffer.from(b64string, 'base64'));

        } catch (error) {
            console.error('Ошибка генерации накладной собств. потребления:', error);
            res.status(500).type('text/plain').send(error.message);
        }
    });
};