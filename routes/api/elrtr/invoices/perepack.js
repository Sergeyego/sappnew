const db = require('../../../../postgres.js');
const doc = require('../../../../invoice.js');

module.exports = function (app) {
    app.get("/elrtr/invoices/perepack/:invId", async (req, res) => {
        try {
            const invId = Number(req.params.invId);

            // Валидация входного параметра
            if (Number.isNaN(invId)) {
                return res.status(400).type('text/plain').send('Некорректный идентификатор накладной');
            }

            // 1. Получаем метаданные шапки накладной переупаковки
            const titleQuery = `
                SELECT n.num AS num, 
                       n.dat AS dat, 
                       t.nam AS tnam, 
                       d.nam AS dnam, 
                       ef.nam AS efnam, 
                       et.nam AS etnam 
                FROM parti_nakl AS n 
                INNER JOIN parti_nakl_tip AS t ON t.id = n.tip 
                INNER JOIN nakl_doc AS d ON t.id_doc = d.id 
                INNER JOIN nakl_emp AS ef ON t.id_from = ef.id 
                INNER JOIN nakl_emp AS et ON t.id_to = et.id 
                WHERE n.id = $1
            `;
            const dataTitle = await db.oneOrNone(titleQuery, [invId]);

            if (!dataTitle) {
                return res.status(404).type('text/plain').send('Накладная не найдена');
            }

            // 2. Формируем читаемый SQL-запрос для строк накладной (избавились от конкатенации плюсами)
            const itemsQuery = `
                SELECT 
                    'из ' || e.marka || ' ф' || p.diam || 
                    CASE WHEN p.id_var <> 1 THEN ' /' || ev.nam || '/' ELSE '' END || 
                    ' (' || ep.pack_ed || ')' || 
                    CASE WHEN np.id = 0 THEN '' 
                         ELSE '\nв ' || ne.marka || ' ф' || np.diam || 
                              CASE WHEN np.id_var <> 1 THEN ' /' || ev2.nam || '/' ELSE '' END || 
                              ' (' || nep.pack_ed || ')' 
                    END AS nam, 
                    'из ' || p.n_s || CASE WHEN np.id = 0 THEN '' ELSE '\nв ' || np.n_s END AS npart, 
                    w.kvo AS kvo, 
                    w.kvo_break AS break 
                FROM parti_perepack AS w 
                INNER JOIN parti AS p ON p.id = w.id_part 
                INNER JOIN el_pack AS ep ON ep.id = p.id_pack 
                INNER JOIN elrtr AS e ON e.id = p.id_el 
                INNER JOIN parti AS np ON np.id = w.id_new_part 
                INNER JOIN el_pack AS nep ON nep.id = np.id_pack 
                INNER JOIN elrtr AS ne ON ne.id = np.id_el 
                INNER JOIN elrtr_vars ev ON ev.id = p.id_var 
                INNER JOIN elrtr_vars ev2 ON ev2.id = np.id_var 
                WHERE w.id_nakl = $1 
                ORDER BY w.id
            `;
            const dataItems = await db.any(itemsQuery, [invId]);

            // 3. Генерируем документ docx с помощью асинхронного вызова метода
            const b64string = await doc.createDoc(dataTitle, dataItems);

            // Установка заголовков ответа (Исправлена опечатка в имени файла и добавлены кавычки)
            res.setHeader('Content-Disposition', 'attachment; filename="invoice.docx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

            // Отправляем готовый бинарный буфер клиенту
            res.send(Buffer.from(b64string, 'base64'));

        } catch (error) {
            console.error('Ошибка генерации накладной переупаковки:', error);
            res.status(500).type('text/plain').send(error.message);
        }
    });
};