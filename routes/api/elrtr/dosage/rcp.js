const db = require('../../../../postgres.js');
const autorest = require('../../../../autorest/autorest.js');
//const locale = require('../../../../locale.js');
const bodyParser = require('body-parser');
const ExcelJS = require('exceljs');

module.exports = function (app) {
    app.use("/elrtr/dosage/rcp", bodyParser.json(), async (req, res) => {
        const tableName = "rcp_nam";
        try {
            const data = await autorest.getData(tableName, req);
            const tbl = await autorest.getTblInfo(tableName);
            const columns = tbl.columns; // Переименовано для исключения конфликтов имен
            const colorMap = {
                1: "#AAFFAA", // Зеленый
                2: "#FFFF00", // Желтый
                3: "#FFAAAA"  // Красный
            };
            data.forEach(row => {
                const lev = row.lev?.edit_role;
                const bgColor = colorMap[lev] || "#FFFFFF";
                // Применяем вычисленный цвет ко всем ячейкам текущей строки
                columns.forEach(cl => {
                    if (row[cl.nam]) {
                        row[cl.nam].background_role = bgColor;
                    }
                });
            });
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
            const title = "Расход компонентов и проволоки на 1 тонну электродов марки " + req.query.marka;
            const headers = ["Компоненты", "Рецепт.,\n%", "Расч. \nрасход, кг", "Потери,\n%", "Расход на \n1 тонну, кг"];
            const query = "select m.nam as nam, rc.kvo as rcp, 0.0::float4 as press, m.loss_new as loss, 0.0::float4 as total " +
                "from rcp_cont rc " +
                "inner join matr m on m.id = rc.id_matr " +
                "where rc.id_rcp = $1 " +
                "order by m.nam";

            const dec = 2;
            const data = await autorest.getRoData(title, query, [Number(req.params["id_rcp"])], headers, dec);
            //console.log(data);

            const lel = Number(req.query.lel); //длина стержня
            const kfmp = Number(req.query.kfmp); //коэффициент массы покрытия

            const mprov = 1000 / (((lel - 22) * kfmp) / (lel * 100) + 1); //масса проволоки
            const mcomp = (1000 - mprov) * 1.1; //общая масса компонентов с учетом 10% потерь при опрессовке
            let mrcp = 0; //сумма процентов в рецептуре
            let mtotal = 0; //общая масса компонентов без учета проволоки

            // Кэшируем типы данных полей для безопасного форматирования
            const fieldTypes = {};
            data.fields.forEach(f => { fieldTypes[f.nam] = f.udt_name; });

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
            autorest.insertRow(data, glass, data.rows.length);

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
                data.rows[i].press.display_role = autorest.getDisplay(comp, fieldTypes["press"], dec, false);

                const loss = data.rows[i].loss.edit_role; //процент потерь для компонента
                const total = comp + comp * loss / 100; //масса компонента с учетом потерь
                data.rows[i].total.edit_role = total;
                data.rows[i].total.display_role = autorest.getDisplay(total, fieldTypes["total"], dec, false);
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
            autorest.insertRow(data, prov, 0, "#FFFF00");

            //добавляем строку с итогами в конец таблицы
            autorest.insertRow(data, sums, data.rows.length, "#FFFF00");
            res.json(data);
        } catch (error) {
            //console.log(error);
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/elrtr/dosage/xlsx/:id_rcp", async (req, res) => {
        try {
            const query = "select m.nam as nam, rc.kvo as rcp, m.loss_new/100.0 as loss " +
                "from rcp_cont rc " +
                "inner join matr m on m.id = rc.id_matr " +
                "where rc.id_rcp = $1 " +
                "order by m.nam";
            const data = await db.any(query, [Number(req.params["id_rcp"])]);

            //значение для строки со стеклом
            let glass = {
                nam: req.query.glass,
                rcp: 12,
                loss: 0.1
            };
            data.push(glass);

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(__dirname + '/template.xlsx');
            const worksheet = workbook.getWorksheet(1);

            // --- СОХРАНЯЕМ ШИРИНУ КОЛОНОК ИЗ ШАБЛОНА ---
            const columnWidths = worksheet.columns ? worksheet.columns.map(col => col.width) : [];

            // Заполнение параметров шапки отчета
            worksheet.getCell('A2').value = worksheet.getCell('A2').value + String(req.query.marka);
            worksheet.getCell('C6').value = Number(req.query.diam);
            worksheet.getCell('C7').value = Number(req.query.kfmp);
            worksheet.getCell('C8').value = Number(req.query.lel);
            worksheet.getCell('C9').value = 22;
            worksheet.getCell('C10').value = Number(req.query.dfil);
            worksheet.getCell('B12').value = String(req.query.provol);

            const startRow = 15;

            if (data && data.length > 0) {
                // 1. Кэшируем оригинальные стили ВСЕХ колонок строки 15 ДО вставки
                const styleSource = worksheet.getRow(startRow);
                const cellStyles = [];
                styleSource.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    cellStyles[colNumber] = cell.style;
                });

                // 2. БЛОК ИСПРАВЛЕНИЯ ОБЪЕДИНЕНИЙ ЯЧЕЕК ПОД ТАБЛИЦЕЙ
                const shiftCount = data.length - 1;
                const mergesToFix = [];

                if (worksheet._merges) {
                    Object.keys(worksheet._merges).forEach(key => {
                        const merge = worksheet._merges[key];
                        if (merge.top > startRow) {
                            mergesToFix.push({
                                top: merge.top + shiftCount,
                                bottom: merge.bottom + shiftCount,
                                left: merge.left,
                                right: merge.right
                            });
                            delete worksheet._merges[key];
                        }
                    });
                }

                // Маппим данные из БД в массив массивов
                const rowsToInsert = data.map(item => [
                    item.nam,  // A (1)
                    item.rcp,  // B (2)
                    null,      // C (3) - под формулу
                    item.loss, // D (4)
                    null       // E (5) - под формулу
                ]);

                // 3. Вставляем строки (нижняя часть шаблона сдвигается)
                worksheet.insertRows(startRow, rowsToInsert);

                // 4. НАКЛАДЫВАЕМ ОРИГИНАЛЬНЫЕ СТИЛИ И ВСТАВЛЯЕМ ФОРМУЛЫ В СТРОКИ
                for (let i = 0; i < data.length; i++) {
                    const currentRowNum = startRow + i;
                    const currentRow = worksheet.getRow(currentRowNum);

                    cellStyles.forEach((style, colNumber) => {
                        if (style) {
                            currentRow.getCell(colNumber).style = style;
                        }
                    });

                    // Формула для столбца C:
                    currentRow.getCell(3).value = { formula: `B${currentRowNum}*$C$${startRow + data.length}/$B$${startRow + data.length}` };

                    // Формула для столбца E:
                    currentRow.getCell(5).value = { formula: `C${currentRowNum}+C${currentRowNum}*D${currentRowNum}` };

                    currentRow.commit();
                }

                // 5. Удаляем старую строку-заглушку №15, которая улетела в самый низ
                worksheet.spliceRows(startRow + data.length, 1);

                // 6. ПОВТОРНОЕ ОБЪЕДИНЕНИЕ ЯЧЕЕК НА НОВЫХ МЕСТАХ
                mergesToFix.forEach(m => {
                    worksheet.mergeCells(m.top, m.left, m.bottom, m.right);
                });
            }

            // Заполнение формул ИТОГО под таблицей данных
            worksheet.getCell(`B${startRow + data.length}`).value = { formula: `SUM(B${startRow}:B${startRow + data.length - 1})` };
            worksheet.getCell(`E${startRow + data.length}`).value = { formula: `SUM(E${startRow}:E${startRow + data.length - 1})` };

            // БЕЗОПАСНАЯ ЗАПИСЬ ДАТЫ НА НОВОЕ СМЕЩЕННОЕ МЕСТО
            const targetDateRow = 24 + (data.length - 1);
            const dateCell = worksheet.getCell(`D${targetDateRow}`);
            dateCell.value = new Date();
            dateCell.numFmt = 'dd.mm.yyyy';

            // --- ВОССТАНОВЛЕНИЕ НАСТРОЕК СТРАНИЦЫ И ШИРИНЫ КОЛОНОК ---
            if (worksheet.columns && columnWidths.length > 0) {
                worksheet.columns.forEach((col, idx) => {
                    if (columnWidths[idx]) col.width = columnWidths[idx];
                });
            }

            worksheet.pageSetup = {
                orientation: 'portrait',  // Смените на 'landscape', если шаблон горизонтальный
                paperSize: 9,             // A4
                fitToPage: true,          // Вписать страницы
                fitToWidth: 1,            // По ширине в 1 страницу
                fitToHeight: 0            // По высоте без жестких ограничений
            };

            workbook.views = [{ firstSheet: 0, activeTab: 0, visibility: 'visible' }];
            worksheet.getImages();

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="calc_report.xlsx"');

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });
}