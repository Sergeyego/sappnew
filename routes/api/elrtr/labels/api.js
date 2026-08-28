const path = require('path');
const creator = require('../../../../labels/universallabel.js');

module.exports = function (app) {
    app.get("/elrtr/labels/get", async (req, res) => {
        try {

            const barcodeValue = req.query.code || "4627120435671";

            const label = new creator(150, 60, 203);

            label
                .round(4, 4, 141, 54, 0)
                .line(4, 50, 145, 50)
                .line(4, 54, 145, 54)
                .line(21, 4, 21, 50)
                .line(21, 16, 145, 16)
                .line(119, 16, 119, 50)
                .line(21, 34, 119, 34)
                .line(68, 34, 68, 50)
                .line(33, 34, 33, 50)
                .line(33, 38, 68, 38)
                .line(33, 42, 68, 42)
                .line(21, 46, 68, 46)
                .line(44, 42, 44, 50)
                .line(56, 42, 56, 50)
                .line(50, 4, 50, 16)
                .line(85, 4, 85, 16)
                .line(104, 4, 104, 16);

            label.block("УОНИ-13/55",22,6,27,6,5,0,'center',true,'center',{bold: true});

            label.block("ГОСТ 9466-75\nГОСТ 9467-75\nТУ 1272-001-50133500-2015",51,5,32,10,3,0,'left',true,'top');

            label.block("Арт.43567",86,6.5,17,5,5,0,'center',true,'center');
            
            label.line(105,10,144,10);
            //label.block("Э50А-УОНИ-13/55-5,0-УД");

            const desc = `Для сварки ответственных конструкций из углеродистых и низколегированных сталей, в том числе работающих при знакопеременных нагрузках и отрицательных температурах.`;
            label.block(desc,35,16,82,16,3);

            label.block("Диаметр, мм - 5,0\nПартия - 1891\nМасса нетто, кг - 5,5\nДата изг. - 02.08.2026",69,35,35,13,3);

            const appText = `Сертификация:\nГОСТ Р\nАттестация:\nНАКС\nОдобрено:\nРКО категория 3YH`;
            label.block(appText,120,17,24,21);
            
            await label.barcode(barcodeValue, 6, 8, 13, 'ean13', 'L', 1.125, true);

            await label.barcode("4627120435671e67785__1891-2026", 105, 36, 11, 'datamatrix', 'N', 1.125, true);

            const imagePosPath = path.join(__dirname, '../../../../public/pos-5.png');
            await label.image(imagePosPath,22,19.5,11,11);

            const imageFragPath = path.join(__dirname, '../../../../public/fragile.png');
            await label.image(imageFragPath,122,38.5,20,10);

            const pngBuffer = label.toPNG();

            // Отключаем кэш на уровне HTTP
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            res.setHeader('Content-Type', 'image/png');
            res.send(pngBuffer);

        } catch (error) {
            console.error(error);
            res.status(500).type('text/plain').send(error.message);
        }
    });
}