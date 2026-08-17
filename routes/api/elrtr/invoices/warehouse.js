const db = require('../../../../postgres.js');
const doc = require('../../../../invoice.js');

module.exports = function (app) {
    app.get("/elrtr/invoices/warehouse/:typeId", async (req, res) => {
        try {
            const typeId = Number(req.params.typeId);

            // Валидация входного параметра на уровне API
            if (Number.isNaN(typeId)) {
                return res.status(400).type('text/plain').send('Некорректный идентификатор накладной');
            }

            // 1. Получаем метаданные шапки складской накладной
            const titleQuery = `
                SELECT n.num AS num, 
                       n.dat AS dat, 
                       t.fnam AS tnam, 
                       d.nam AS dnam, 
                       ef.nam AS efnam, 
                       et.nam AS etnam 
                FROM prod_nakl AS n 
                INNER JOIN prod_nakl_tip AS t ON t.id = n.id_ist 
                INNER JOIN nakl_doc AS d ON t.id_doc = d.id 
                INNER JOIN nakl_emp AS ef ON t.id_from = ef.id 
                INNER JOIN nakl_emp AS et ON t.id_to = et.id 
                WHERE n.id = $1
            `;
            const dataTitle = await db.oneOrNone(titleQuery, [typeId]);

            if (!dataTitle) {
                return res.status(404).type('text/plain').send('Накладная сдачи на склад не найдена');
            }

            // 2. Читаемый и безопасный SQL-запрос для строк спецификации готовой продукции
            const itemsQuery = `
                SELECT e.marka || ' ' || 'ф' || p.diam || 
                       CASE WHEN p.id_var <> 1 THEN ' /' || ev.nam || '/' ELSE '' END || 
                       ' (' || ep.pack_ed || ')' AS nam, 
                       p.n_s AS npart, 
                       w.kvo AS kvo 
                FROM prod AS w 
                INNER JOIN parti AS p ON p.id = w.id_part 
                INNER JOIN elrtr AS e ON e.id = p.id_el 
                INNER JOIN el_pack AS ep ON ep.id = p.id_pack 
                INNER JOIN elrtr_vars ev ON ev.id = p.id_var 
                WHERE w.id_nakl = $1 
                ORDER BY w.id
            `;
            const dataItems = await db.any(itemsQuery, [typeId]);

            // 3. Асинхронная генерация .docx файла
            const b64string = await doc.createDoc(dataTitle, dataItems);

            // Настройка заголовков ответа 
            res.setHeader('Content-Disposition', 'attachment; filename="invoice.docx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

            // Отправляем бинарный буфер в HTTP-ответ Express
            res.send(Buffer.from(b64string, 'base64'));

        } catch (error) {
            console.error('Ошибка генерации накладной сдачи на склад:', error);
            res.status(500).type('text/plain').send(error.message);
        }
    });
};