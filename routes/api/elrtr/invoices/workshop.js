const db = require('../../../../postgres.js');
const doc = require('../../../../invoice.js');

module.exports = function (app) {
    app.get("/elrtr/invoices/workshop/:invoiceId", async (req, res) => {
        try {
            const invoiceId = Number(req.params.invoiceId);

            // Валидация входящего параметра на уровне API
            if (Number.isNaN(invoiceId)) {
                return res.status(400).type('text/plain').send('Некорректный идентификатор накладной');
            }

            // 1. Получаем метаданные шапки цеховой накладной и её тип
            const titleQuery = `
                SELECT n.num AS num, 
                       n.dat AS dat, 
                       t.nam AS tnam, 
                       d.nam AS dnam, 
                       ef.nam AS efnam, 
                       et.nam AS etnam, 
                       n.tip AS idtype 
                FROM parti_nakl AS n 
                INNER JOIN parti_nakl_tip AS t ON t.id = n.tip 
                INNER JOIN nakl_doc AS d ON t.id_doc = d.id 
                INNER JOIN nakl_emp AS ef ON t.id_from = ef.id 
                INNER JOIN nakl_emp AS et ON t.id_to = et.id 
                WHERE n.id = $1
            `;
            const dataTitle = await db.oneOrNone(titleQuery, [invoiceId]);

            if (!dataTitle) {
                return res.status(404).type('text/plain').send('Цеховая накладная не найдена');
            }

            // 2. Определяем SQL-запрос в зависимости от типа накладной
            let itemsQuery = "";
            
            if (dataTitle.idtype === 1) {
                // Запрос для упакованной продукции
                itemsQuery = `
                    SELECT e.marka || ' ' || 'ф' || p.diam || 
                           CASE WHEN p.id_var <> 1 THEN ' /' || ev.nam || '/' ELSE '' END || 
                           ' (' || ep.pack_ed || ')' AS nam, 
                           p.n_s AS npart, 
                           w.kvo AS kvo 
                    FROM parti_pack AS w 
                    INNER JOIN parti AS p ON p.id = w.id_part 
                    INNER JOIN elrtr AS e ON e.id = p.id_el 
                    INNER JOIN el_pack AS ep ON ep.id = p.id_pack 
                    INNER JOIN elrtr_vars ev ON ev.id = p.id_var 
                    WHERE w.id_nakl = $1 
                    ORDER BY w.id
                `;
            } else if (dataTitle.idtype === 2) {
                // Запрос для брака
                itemsQuery = `
                    SELECT e.marka || ' ' || 'ф' || p.diam || 
                           CASE WHEN p.id_var <> 1 THEN ' /' || ev.nam || '/' ELSE '' END || 
                           ' (' || ep.pack_ed || ')' AS nam, 
                           p.n_s AS npart, 
                           w.kvo AS kvo 
                    FROM parti_break AS w 
                    INNER JOIN parti AS p ON p.id = w.id_part 
                    INNER JOIN elrtr AS e ON e.id = p.id_el 
                    INNER JOIN el_pack AS ep ON ep.id = p.id_pack 
                    INNER JOIN elrtr_vars ev ON ev.id = p.id_var 
                    WHERE w.id_nakl = $1 
                    ORDER BY w.id
                `;
            } else {
                // Защита от непредвиденных типов накладных в базе данных
                return res.status(400).type('text/plain').send(`Неподдерживаемый тип цеховой накладной (idtype: ${dataTitle.idtype})`);
            }

            // 3. Извлекаем строки спецификации
            const dataItems = await db.any(itemsQuery, [invoiceId]);

            // 4. Асинхронная генерация .docx документа Word
            const b64string = await doc.createDoc(dataTitle, dataItems);

            // Настройка заголовков ответа
            res.setHeader('Content-Disposition', 'attachment; filename="invoice.docx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

            // Отправляем бинарный буфер клиенту
            res.send(Buffer.from(b64string, 'base64'));

        } catch (error) {
            console.error('Ошибка генерации цеховой накладной:', error);
            res.status(500).type('text/plain').send(error.message);
        }
    });
};