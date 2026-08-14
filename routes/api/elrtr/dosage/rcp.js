const db = require('../../../../postgres.js');
const autorest = require('../../../../autorest/autorest.js');
//const locale = require('../../../../locale.js');
var bodyParser = require('body-parser');

module.exports = function (app) {
    app.use("/elrtr/dosage/rcp", bodyParser.json(), async (req, res) => {
        const tableName = "rcp_nam";
        try {
            let data = await autorest.getData(tableName, req);
            const tbl = await autorest.getTblInfo(tableName);
            const col = tbl.columns;
            for (i = 0; i < data.length; i++) {
                col.forEach(function (cl) {
                    const lev = data[i].lev.edit_role;
                    let col = "#FFFFFF";
                    if (lev == 3) {
                        col = "#FFAAAA";
                    } else if (lev == 1) {
                        col = "#AAFFAA";
                    } else if (lev == 2) {
                        col = "#FFFF00";
                    }
                    data[i][cl.nam].background_role = col;
                })
            }
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.post("/elrtr/dosage/paste/:id_src_rcp/:id_rcp", async (req, res) => {
        try {
            await db.any("delete from rcp_cont where id_rcp = $1", [Number(req.params["id_rcp"])]);
            const data = await db.any("insert into rcp_cont (id_rcp, id_matr, kvo, hidden) " +
                "(select $1, id_matr, kvo, hidden from rcp_cont where id_rcp = $2 )", [Number(req.params["id_rcp"]), Number(req.params["id_src_rcp"])]);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/elrtr/dosage/mode/:id_el/:id_diam", async (req, res) => {
        try {
            const data = await autorest.getRoData("Наиболее вероятные параметры",
                "select * from get_el_mode($1, (select diam from diam where id = $2))", [Number(req.params["id_el"]), Number(req.params["id_diam"])]);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/elrtr/dosage/calc/:id_rcp", async (req, res) => {
        try {
            //console.log(req.query);
            const title = "Расход компонентов и проволоки на 1 тонну электродов";
            const headers = ["Компоненты", "Рецепт.,\n%", "Расч. \nрасход, кг", "Потери,\n%", "Расход на \n1 тонну, кг"];
            const query = "select m.nam as nam, rc.kvo as rcp, 0.0 as press, m.loss_new as loss, 0.0 as total " +
                "from rcp_cont rc " +
                "inner join matr m on m.id = rc.id_matr " +
                "where rc.id_rcp = $1 " +
                "order by m.nam";

            const data = await autorest.getRoData(title, query, [Number(req.params["id_rcp"])], headers, 2);

            const lel = Number(req.query.lel); //длина стержня
            const kfmp = Number(req.query.kfmp); //коэффициент массы покрытия

            const mprov = 1000 / (((lel - 22) * kfmp) / (lel * 100) + 1); //масса проволоки
            const mcomp = (1000 - mprov) * 1.1; //общая масса компонентов с учетом 10% потерь при опрессовке
            let mrcp = 0; //сумма процентов в рецептуре
            let mtotal = 0; //общая масса компонентов без учета проволоки

            //значения для строки с проволокой
            let prov = {
                nam: req.query.provol,
                rcp: null,
                press: mprov,
                loss: 1.5,
                total: (mprov + mprov * 0.015)
            };

            //значение для строки со стеклом
            let glass = {
                nam: req.query.glass,
                rcp: 12,
                press: 0,
                loss: 10,
                total: 0
            };

            //добавляем строку со стеклом
            let glass_col = {};
            for (let j = 0; j < data.fields.length; j++) {
                const val = (glass[data.fields[j].nam] == undefined) ? null : glass[data.fields[j].nam];
                glass_col[data.fields[j].nam] = {
                    edit_role: val,
                    display_role: autorest.getDisplay(val, data.fields[j].udt_name, 2, false),
                    background_role: "#FFFFFF",
                    tooltip_role: ""
                };
            }
            data.rows.push(glass_col);

            //считаем сумму процентов в рецептуре (должно получаться 112%: 100% в рецептуре и 12% стекла)
            for (let i = 0; i < data.rows.length; i++) {
                mrcp += data.rows[i].rcp.edit_role;
            }
            //console.log(mrcp);

            //расчитываем расход каждого компонента при опрессовке и расход с учетом потерь
            for (let i = 0; i < data.rows.length; i++) {
                const rcp = data.rows[i].rcp.edit_role;
                const comp = mcomp * rcp / mrcp; //масса конкретного компонента
                data.rows[i].press.edit_role = comp;
                data.rows[i].press.display_role = autorest.getDisplay(comp, data.fields[2].udt_name, 2, false);

                const loss = data.rows[i].loss.edit_role; //поцент потерь для компонента
                const total = comp + comp * loss / 100; //масса компонента с учетом потерь
                data.rows[i].total.edit_role = total;
                data.rows[i].total.display_role = autorest.getDisplay(total, data.fields[4].udt_name, 2, false);
                mtotal += total;
            }

            //значение для строки с итогами
            let sums = {
                nam: "итого",
                rcp: mrcp,
                press: mcomp,
                loss: null,
                total: mtotal
            };

            //добавляем строку с проволокой в начало таблицы
            let prov_col = {};
            for (let j = 0; j < data.fields.length; j++) {
                const val = (prov[data.fields[j].nam] == undefined) ? null : prov[data.fields[j].nam];
                prov_col[data.fields[j].nam] = {
                    edit_role: val,
                    display_role: autorest.getDisplay(val, data.fields[j].udt_name, 2, true),
                    background_role: "#FFFF00",
                    tooltip_role: ""
                };
            }
            data.rows.unshift(prov_col);

            //добавляем строку с итогами в конец таблицы
            let sum_col = {};
            for (let j = 0; j < data.fields.length; j++) {
                const val = (sums[data.fields[j].nam] == undefined) ? null : sums[data.fields[j].nam];
                sum_col[data.fields[j].nam] = {
                    edit_role: val,
                    display_role: autorest.getDisplay(val, data.fields[j].udt_name, 2, true),
                    background_role: "#FFFF00",
                    tooltip_role: ""
                };
            }
            data.rows.push(sum_col);

            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/elrtr/dosage/calc2/:id_rcp", async (req, res) => {
        try {
            const title = "Расход компонентов и проволоки на 1 тонну электродов";
            const headers = ["Компоненты", "Рецепт.,\n%", "Расч. \nрасход, кг", "Потери,\n%", "Расход на \n1 тонну, кг"];

            const query = `
            SELECT m.nam AS nam, rc.kvo AS rcp, 0.0 AS press, m.loss_new AS loss, 0.0 AS total 
            FROM rcp_cont rc 
            INNER JOIN matr m ON m.id = rc.id_matr 
            WHERE rc.id_rcp = $1 
            ORDER BY m.nam
        `;

            // Получаем исходные данные из БД
            const data = await autorest.getRoData(title, query, [Number(req.params["id_rcp"])], headers, 2);

            // Кэшируем типы данных полей для безопасного форматирования
            const fieldTypes = {};
            data.fields.forEach(f => { fieldTypes[f.nam] = f.udt_name; });

            const lel = Number(req.query.lel);       // Длина стержня
            const kfmp = Number(req.query.kfmp);     // Коэффициент массы покрытия

            // 1. Расчет базовых масс на 1 тонну электродов
            const mprov = 1000 / (((lel - 22) * kfmp) / (lel * 100) + 1); // Масса проволоки
            const mcomp = (1000 - mprov) * 1.1;                         // Масса компонентов покрытия с учетом 10% потерь на опрессовку

            // 2. Подготовка сырого объекта для проволоки (в итогах не участвует)
            const provRaw = { nam: req.query.provol || "Проволока", rcp: null, press: mprov, loss: 1.5, total: mprov * 1.015 };

            // Подготовка сырого объекта для жидкого стекла
            const glassRaw = { nam: req.query.glass || "Стекло жидкое", rcp: 12, press: 0, loss: 10, total: 0 };

            // 3. Расчет суммы процентов в рецептуре (сначала по компонентам из БД)
            let mrcp = 0;
            const dbRowsClean = data.rows.map(row => {
                mrcp += Number(row.rcp.edit_role || 0);
                return {
                    nam: row.nam.edit_role,
                    rcp: row.rcp.edit_role,
                    press: 0,
                    loss: row.loss.edit_role,
                    total: 0
                };
            });

            // Добавляем жидкое стекло в общую сумму процентов обмазки (итого 112%)
            mrcp += glassRaw.rcp;
            dbRowsClean.push(glassRaw);

            // 4. Расчет масс для каждого компонента покрытия
            let mtotal_coating = 0;

            dbRowsClean.forEach(item => {
                // Масса конкретного компонента с учетом 10% потерь на опрессовку
                item.press = mcomp * item.rcp / mrcp;

                // Масса компонента с учетом потерь на подготовку (из БД или 10% для стекла)
                item.total = item.press * (1 + item.loss / 100);
                mtotal_coating += item.total;
            });

            // 5. Формируем финальный массив строк с UI-структурой
            const finalRows = [];

            const createUiRow = (rawObj, isHighlight = false) => {
                const row = {};
                data.fields.forEach(f => {
                    const val = rawObj[f.nam] !== undefined ? rawObj[f.nam] : null;
                    row[f.nam] = {
                        edit_role: val,
                        display_role: autorest.getDisplay(val, fieldTypes[f.nam], 2, isHighlight),
                        background_role: isHighlight ? "#FFFF00" : "#FFFFFF",
                        tooltip_role: ""
                    };
                });
                return row;
            };

            // Собираем таблицу в привычном для производства порядке
            // 1. Проволока (отдельно в начале)
            finalRows.push(createUiRow(provRaw, true));

            // 2. Компоненты шихты и стекло
            dbRowsClean.forEach(item => {
                finalRows.push(createUiRow(item, false));
            });

            // 3. Строка ИТОГО (только по покрытию: mcomp и mtotal_coating)
            const sumsRaw = {
                nam: "ИТОГО по покрытию",
                rcp: mrcp,
                press: mcomp,
                loss: null,
                total: mtotal_coating
            };
            finalRows.push(createUiRow(sumsRaw, true));

            // Перезаписываем строки в ответе
            data.rows = finalRows;

            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });
}