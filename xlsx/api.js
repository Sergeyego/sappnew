const ExcelJS = require('exceljs');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json({ limit: '10mb' });

let getNumFmt = function (id_type, dec) {
    let fmt="";
    if (id_type==6 && dec>0){
        const code='0';
        fmt="# ##0."+code.padEnd(dec,'0');
    } else if (id_type==2){
        fmt="0";
    } else if (id_type==14) {
        fmt="dd.mm.yyyy";
    } else if (id_type==16) {
        fmt="dd.mm.yyyy HH:MM";
    }
    return fmt;
}

module.exports = function (app) {

    app.post("/xlsx/create", jsonParser, async (req, res) => {
        try {
            //console.log(req.body);
            // Создаем рабочую книгу
            let totalWidth = 0.0;
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Лист 1');
            worksheet.headerFooter.oddHeader = "&L" + req.body.title;

            worksheet.pageSetup.paperSize = 9;
            worksheet.pageSetup.orientation = 'portrait';
            worksheet.pageSetup.fitToPage = true;
            worksheet.pageSetup.fitToWidth = 1;  // Вписать в 1 страницу по ширине
            worksheet.pageSetup.fitToHeight = 0;
            worksheet.pageSetup.margins = {
                left: 0.59,   // Левое поле (~1.5 см)
                right: 0.59,  // Правое поле (~1.5 см)
                top: 0.59,    // Верхнее поле (~1.5 см)
                bottom: 0.59, // Нижнее поле (~1.5 см)
                header: 0.3,  // Отступ для верхнего колонтитула
                footer: 0.3   // Отступ для нижнего колонтитула
            };

            // Настраиваем колонки (заголовки, ключи данных и ширина)
            let columns = new Array;
            for (let j = 0; j < req.body.columns.length; j++) {
                const obj = {
                    "header": req.body.columns[j].header,
                    "key": req.body.columns[j].key,
                    "width": req.body.columns[j].width / 7.0
                };
                columns.push(obj);
                totalWidth+=(req.body.columns[j].width / 7.0);
            }

            if (totalWidth>150){
                worksheet.pageSetup.orientation = 'landscape';
            }
            if (totalWidth>500){
                worksheet.pageSetup.fitToWidth = 0;
            }

            worksheet.columns = columns;

            for (let i = 0; i < req.body.rows.length; i++) {
                worksheet.addRow(req.body.rows[i]);
            }

            // Стилизуем шапку таблицы (строка 1)
            const headerRow = worksheet.getRow(1);
            headerRow.font = { name: 'Arial', size: 10, bold: true };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true};
            headerRow.height = req.body.header_height;

            // Задаем числовые форматы и границы для ячеек с данными
            worksheet.eachRow((row, rowNumber) => {

                for (let j = 0; j < req.body.columns.length; j++) {
                    const key = req.body.columns[j].key;

                    if (rowNumber > 1) { //Если это не шапка
                        const id_type = req.body.columns[j].id_type;
                        const dec = req.body.columns[j].dec;
                        row.getCell(key).numFmt = getNumFmt(id_type, dec);
                        if (id_type === 6 && row.getCell(key).value === 0.0) {
                            row.getCell(key).value = null;
                        }
                        if (id_type===14 || id_type===16){
                            row.getCell(key).value = new Date(row.getCell(key).value);
                        }
                    }
                    // Тонкие границы для всех ячеек с данными
                    row.getCell(key).border = {
                        top: { style: 'thin', color: { argb: 'FF808080' } },
                        left: { style: 'thin', color: { argb: 'FF808080' } },
                        bottom: { style: 'thin', color: { argb: 'FF808080' } },
                        right: { style: 'thin', color: { argb: 'FF808080' } }
                    };
                }
            });

            // Устанавливаем HTTP-заголовки ответа
            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            res.setHeader(
                'Content-Disposition',
                'attachment; filename="sales_report.xlsx"'
            );

            // Стримим готовый файл напрямую в HTTP-ответ Express
            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            console.error('Ошибка генерации Excel:', error);
            res.status(500).send(error.message);
        }

    });
}