const db = require('../../../../postgres.js');
const locale = require('../../../../locale.js');
const path = require('path');

function getTable(data, by_rab) {
    if (!data || data.length === 0) {
        return '<p class="nodata">Нет данных для вывода</p>';
    }

    let sum = 0.0;
    let part_sum = 0.0;

    // Используем массив для быстрой сборки HTML (экономит память V8)
    const html = [
        '<table class="tablestyle" border="1" cellspacing="0" cellpadding="2">',
        '<tr class="boldtext">',
        '<td class="centeralign" width="5%">№</td>',
        '<td class="centeralign" width="28%">Наименование <br>товара</td>',
        '<td class="centeralign">Партия</td>',
        '<td class="centeralign">Упаковщик</td>',
        '<td class="centeralign">Поддон</td>',
        '<td class="centeralign">Колич.,<br>кг</td>',
        '</tr>'
    ];

    data.forEach((row, i) => {
        html.push(
            '<tr>',
            `<td class="leftalign">${i + 1}</td>`,
            `<td class="leftalign">${row.marka}</td>`,
            `<td class="leftalign">${row.part}</td>`,
            `<td class="leftalign">${row.rab}</td>`,
            `<td class="leftalign">${row.pal}</td>`,
            `<td class="rightalign">${locale.insNumber(row.kvo, 1)}</td>`,
            '</tr>'
        );

        const kvoNum = Number(row.kvo || 0);
        part_sum += kvoNum;
        sum += kvoNum;

        const is_end = (i === data.length - 1);
        let print_itogo = is_end;

        if (!is_end) {
            const nextRow = data[i + 1];
            print_itogo = by_rab ? (row.rab !== nextRow.rab) : (row.part !== nextRow.part);
        }

        if (print_itogo) {
            const labelStr = by_rab ? row.rab : `${row.marka} п. ${row.part}`;
            html.push(
                '<tr>',
                `<td class="leftalign" colspan="5"><b>${labelStr} итого</b></td>`,
                `<td class="rightalign"><b>${locale.insNumber(part_sum, 1)}</b></td>`,
                '</tr>'
            );
            part_sum = 0.0;
        }
    });

    html.push(
        '<tr>',
        '<td class="leftalign" colspan="5"><b>Итого</b></td>',
        `<td class="rightalign"><b>${locale.insNumber(sum, 1)}</b></td>`,
        '</tr>',
        '</table>'
    );

    return html.join('');
}

module.exports = function (app) {
    app.get("/elrtr/pack/packnakl/:dat/:id_src/:id_master/", async (req, res) => {
        try {
            const id_master = String(req.params.id_master);
            const id_src = Number(req.params.id_src);
            const rawDate = req.params.dat;

            if (Number.isNaN(id_src)) {
                return res.status(400).type('text/plain').send('Некорректный ID источника');
            }

            // Приведение к булеву типу
            const by_rab = req.query.by_rab === "true";

            // 1. Извлекаем метаданные заголовков
            const titleQuery = `
                SELECT i.nakl_nam AS oper, 
                       (SELECT rr.snam FROM kamin_empl rr WHERE rr.id = $1) AS "from", 
                       (SELECT ne.nam FROM nakl_emp ne WHERE ne.id = 1) AS "to" 
                FROM istoch i 
                WHERE i.id = $2
            `;
            const dataTitle = await db.oneOrNone(titleQuery, [id_master, id_src]);

            if (!dataTitle) {
                return res.status(404).type('text/plain').send('Информация о накладной не найдена');
            }

            // 2. Безопасное формирование ORDER BY без уязвимостей конкатенации внешних данных
            const sortFields = by_rab
                ? "rr.snam, e.marka, p.diam, date_part('year', p.dat_part), p.n_s, p2.nam"
                : "e.marka, p.diam, date_part('year', p.dat_part), p.n_s, rr.snam, p2.nam";

            const dataQuery = `
                SELECT e.marka || ' ф ' || CAST(p.diam AS varchar(3)) AS marka, 
                       p.n_s || '-' || date_part('year', p.dat_part) AS part, 
                       rr.snam AS rab, 
                       p2.nam AS pal, 
                       epo.kvo AS kvo 
                FROM el_pallet_op epo 
                INNER JOIN parti p ON p.id = epo.id_parti 
                INNER JOIN elrtr e ON e.id = p.id_el 
                INNER JOIN kamin_empl rr ON rr.id = epo.id_rab 
                INNER JOIN pallets p2 ON p2.id = epo.id_pallet 
                WHERE epo.id_main_rab = $1 
                  AND epo.dtm::date = $2::date 
                  AND epo.id_src = $3 
                ORDER BY ${sortFields}
            `;

            const data = await db.any(dataQuery, [id_master, rawDate, id_src]);

            // Безопасный парсинг даты (избегаем временных сдвигов таймзоны Node.js)
            const dateParts = rawDate.split('-');
            const parsedDate = dateParts.length === 3
                ? new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
                : new Date();

            const dateStr = locale.insDateLong(parsedDate);

            // Рендерим шаблон
            res.render(path.join(__dirname, "..", "..", "..", "..", "views", "nakl.hbs"), {
                title: `НАКЛАДНАЯ от ${dateStr}`,
                head: `НАКЛАДНАЯ от ${dateStr}`,
                oper: dataTitle.oper,
                to: dataTitle.to,
                from: dataTitle.from,
                table: getTable(data, by_rab),
                passed: dataTitle.from,
                accepted: dataTitle.to,
                dec: ''
            });

        } catch (error) {
            console.error('Ошибка генерации накладной:', error);
            res.status(500).type('text/plain').send(error.message);
        }
    });
};