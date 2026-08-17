const autorest = require('../../../../autorest/autorest.js');
const sql = require('../../../../sql.js');
const locale = require('../../../../locale.js');

const sqlByPart = sql('routes/api/elrtr/report/by_part.sql');
const sqlByMark = sql('routes/api/elrtr/report/by_mark.sql');

module.exports = function (app) {
    app.get("/elrtr/report/:d1/:d2", async (req, res) => {
        try {
            const headerPart = ["Марка", "Диам.", "Партия", "Вариант", "Упаковка", "Налич.на нач.",
                "Упаковка", "Термопак", "Переуп.(+/-)", "Брак при переуп.", "Архив(+/-)", "Испытан.", "Соб. потр.", "Другие", "На склад", "Со склада", "Ост.на конец"];
            const headerMark = ["Марка", "Диам.", "Вариант", "Упаковка", "Налич.на нач.",
                "Упаковка", "Термопак", "Переуп.(+/-)", "Брак при переуп.", "Архив(+/-)", "Испытан.", "Соб. потр.", "Другие", "На склад", "Со склада", "Ост.на конец"];

            const query = (req.query.by_part == "true") ? sqlByPart : sqlByMark;
            const header = (req.query.by_part == "true") ? headerPart : headerMark;

            const d1 = new Date(req.params["d1"]);
            const d2 = new Date(req.params["d2"]);

            const title = "Отчет по цеху электродов с " + locale.insDate(d1) + " по " + locale.insDate(d2);
            let data = await autorest.getRoData(title, query, [d1, d2], header, 1);
            let sums = {};
            const col_sum = ["ostbeg", "pack", "thermo", "perepack", "perepackbreak", "arch", "isp", "selfn", "oth", "war", "warout", "ostend"];
            for (let n = 0; n < col_sum.length; n++) {
                sums[col_sum[n]] = 0;
            }
            for (let i = 0; i < data.rows.length; i++) {
                const beg = data.rows[i]["ostbeg"].edit_role;
                const end = data.rows[i]["ostend"].edit_role;
                for (let j = 0; j < data.fields.length; j++) {
                    if (beg < 0 || end < 0) {
                        data.rows[i][data.fields[j].nam].background_role = "#FFAAAA";
                    }
                }
                for (let n = 0; n < col_sum.length; n++) {
                    sums[col_sum[n]] += data.rows[i][col_sum[n]].edit_role;
                }
            }
            sums["marka"] = "ИТОГО";
            autorest.insertRow(data,sums,data.rows.length);
            //console.log(tbl_col);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain');
            res.send(error.message);
        }
    });
}