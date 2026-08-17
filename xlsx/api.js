const ExcelJS = require('exceljs');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json({ limit: '10mb' });

let getNumFmt = function (id_type, dec) {
    let fmt = "";
    if (id_type == 6 && dec > 0) {
        const code = '0';
        fmt = "# ##0." + code.padEnd(dec, '0');
    } else if (id_type == 2) {
        fmt = "0";
    } else if (id_type == 14) {
        fmt = "dd.mm.yyyy";
    } else if (id_type == 16) {
        fmt = "dd.mm.yyyy hh:mm";
    }
    return fmt;
}

module.exports = function (app) {

    app.post("/xlsx/create", jsonParser, async (req, res) => {
        try {
            const { title, columns: reqColumns, rows: reqRows, header_height } = req.body;

            let totalWidth = 0.0;
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Лист 1');
            worksheet.headerFooter.oddHeader = "&L" + title;

            worksheet.pageSetup.paperSize = 9;
            worksheet.pageSetup.orientation = 'portrait';
            worksheet.pageSetup.fitToPage = true;
            worksheet.pageSetup.fitToWidth = 1;
            worksheet.pageSetup.fitToHeight = 0;
            worksheet.pageSetup.margins = {
                left: 0.59, right: 0.59, top: 0.59, bottom: 0.59,
                header: 0.3, footer: 0.3
            };

            // 1. Оптимизация: Подготавливаем метаданные колонок и форматы ЗАРАНЕЕ
            const columns = [];
            const colMetaMap = []; // Массив для быстрого O(1) доступа к форматам во время прохода по строкам

            for (let j = 0; j < reqColumns.length; j++) {
                const col = reqColumns[j];
                const width = col.width / 7.0;

                columns.push({
                    header: col.header,
                    key: col.key,
                    width: width
                });

                totalWidth += width;

                // Кэшируем вычисленный формат и тип
                colMetaMap.push({
                    key: col.key,
                    id_type: col.id_type,
                    numFmt: getNumFmt(col.id_type, col.dec)
                });
            }

            if (totalWidth > 150) worksheet.pageSetup.orientation = 'landscape';
            if (totalWidth > 500) worksheet.pageSetup.fitToWidth = 0;

            worksheet.columns = columns;

            // Быстрое добавление всех строк
            worksheet.addRows(reqRows);

            // Стилизуем шапку таблицы (строка 1)
            const headerRow = worksheet.getRow(1);
            headerRow.font = { name: 'Arial', size: 10, bold: true };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            headerRow.height = header_height;

            // Серая граница для переиспользования
            const thinBorder = {
                top: { style: 'thin', color: { argb: 'FF808080' } },
                left: { style: 'thin', color: { argb: 'FF808080' } },
                bottom: { style: 'thin', color: { argb: 'FF808080' } },
                right: { style: 'thin', color: { argb: 'FF808080' } }
            };

            // 2. Оптимизированный проход по ячейкам
            worksheet.eachRow((row, rowNumber) => {
                // Массив colMetaMap гарантирует совпадение индексов с физическими ячейками
                colMetaMap.forEach((meta) => {
                    const cell = row.getCell(meta.key);

                    if (rowNumber > 1) { // Если это строка данных
                        cell.font = { name: 'Arial', size: 10, bold: false };

                        if (meta.numFmt) {
                            cell.numFmt = meta.numFmt;
                        }

                        const val = cell.value;

                        // Очистка нулевых вещественных значений
                        if (meta.id_type === 6 && val === 0.0) {
                            cell.value = null;
                        }
                        // Безопасное приведение к Date с защитой от Invalid Date
                        else if ((meta.id_type === 14 || meta.id_type === 16) && val) {
                            const parsedDate = new Date(val);
                            cell.value = isNaN(parsedDate.getTime()) ? null : parsedDate;
                        }
                    }

                    // Применяем границы ко всем строкам (включая шапку)
                    cell.border = thinBorder;
                });
            });

            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            res.setHeader(
                'Content-Disposition',
                'attachment; filename="sales_report.xlsx"'
            );

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            console.error('Ошибка генерации Excel:', error);
            res.status(500).send(error.message);
        }
    });
}