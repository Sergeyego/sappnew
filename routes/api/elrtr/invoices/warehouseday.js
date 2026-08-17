const db = require('../../../../postgres.js');
const doc = require('../../../../invoice.js');

module.exports = function (app) {
    app.get("/elrtr/invoices/warehouseday/:typeId/:dayId", async (req, res) => {
        try {
            const typeId = Number(req.params.typeId);
            const dayId = req.params.dayId;

            // Валидация числового параметра на входе
            if (Number.isNaN(typeId)) {
                return res.status(400).type('text/plain').send('Некорректный идентификатор типа операции');
            }

            // Создаем единый объект параметров для подстановки в оба SQL-запроса
            const queryParams = {
                typeId: typeId,
                dayId: dayId
            };

            // 1. Извлекаем метаданные шапки суточной складской накладной
            // Использование именованного синтаксиса ${variable} страхует от путаницы с индексами $1, $2
            const titleQuery = `
                SELECT date_part('doy', \${dayId}::date) AS num, 
                       \${dayId}::date AS dat, 
                       t.fnam AS tnam, 
                       d.nam AS dnam, 
                       ef.nam AS efnam, 
                       et.nam AS etnam 
                FROM prod_nakl_tip AS t 
                INNER JOIN nakl_doc AS d ON t.id_doc = d.id 
                INNER JOIN nakl_emp AS ef ON t.id_from = ef.id 
                INNER JOIN nakl_emp AS et ON t.id_to = et.id 
                WHERE t.id = \${typeId}
            `;
            const dataTitle = await db.oneOrNone(titleQuery, queryParams);

            if (!dataTitle) {
                return res.status(404).type('text/plain').send('Тип складской операции не найден');
            }

            // 2. Извлекаем агрегированные строки (сумму сданной продукции) за сутки
            const itemsQuery = `
                SELECT (e.marka || ' ' || 'ф' || p.diam || 
                       CASE WHEN p.id_var <> 1 THEN ' /' || ev.nam || '/' ELSE '' END || 
                       ' (' || ep.pack_ed || ')') AS nam, 
                       p.n_s AS npart, 
                       SUM(w.kvo) AS kvo 
                FROM prod AS w 
                INNER JOIN parti AS p ON p.id = w.id_part 
                INNER JOIN elrtr AS e ON e.id = p.id_el 
                INNER JOIN el_pack AS ep ON ep.id = p.id_pack 
                INNER JOIN prod_nakl pn ON pn.id = w.id_nakl 
                INNER JOIN elrtr_vars ev ON ev.id = p.id_var 
                WHERE pn.id_ist = \${typeId} 
                  AND pn.dat = \${dayId}::date 
                GROUP BY e.marka, p.diam, p.id_var, ev.nam, ep.pack_ed, p.n_s 
                ORDER BY e.marka, p.diam, p.id_var, ev.nam, ep.pack_ed, p.n_s
            `;
            const dataItems = await db.any(itemsQuery, queryParams);

            // 3. Асинхронная генерация Word-документа
            const b64string = await doc.createDoc(dataTitle, dataItems);

            // Настройка правильных HTTP-заголовков ответа
            res.setHeader('Content-Disposition', 'attachment; filename="invoice.docx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

            // Отправляем бинарный буфер клиенту
            res.send(Buffer.from(b64string, 'base64'));

        } catch (error) {
            console.error('Ошибка генерации суточной складской накладной:', error);
            res.status(500).type('text/plain').send(error.message);
        }
    });
};