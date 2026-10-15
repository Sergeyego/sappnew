const bwipjs = require('bwip-js');

function encodeBase64Url(buffer) {
    return buffer.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
}
  
function decodeBase64Url(base64url) {
    const base64 = base64url
      .replace(/-/g, '+')
      .replace(/_/g, '/'); 
    return Buffer.from(base64, 'base64');
}

function stripDuplicateIccp(png) {
    const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (png.length < 8 || !png.slice(0, 8).equals(SIG)) return png;

    const out = [SIG];
    let offset = 8;
    let seenIccp = false;

    while (offset + 12 <= png.length) {
        const length = png.readUInt32BE(offset);
        const type = png.toString('ascii', offset + 4, offset + 8);
        const total = 12 + length;

        if (type === 'iCCP') {
            if (seenIccp) {
                offset += total;      // пропускаем дубликат
                continue;
            }
            seenIccp = true;
        }

        out.push(png.slice(offset, offset + total));
        offset += total;

        if (type === 'IEND') break;
    }

    return Buffer.concat(out);
}

module.exports = function (app) {
    
    // Эндпоинт генерации QR-кода полностью через bwip-js
    app.get("/qrcode/:width.png", async (req, res) => {
        try {
            const { data } = req.query;
            if (typeof data === "undefined") {
                return res.status(400).type("text/plain").send("no data");
            }

            const qrdata = decodeBase64Url(data).toString();       
            const width = Number(req.params.width);

            // Рендерим QR-код средствами bwip-js
            const png = await bwipjs.toBuffer({
                bcid: 'qrcode',            // Тип штрихкода - QR-код
                text: qrdata,              // Данные для кодирования
                scaleX: width / 33,        // Рассчитываем масштаб по X на основе желаемой ширины
                scaleY: width / 33,        // Рассчитываем масштаб по Y
                parse: true,               // Разрешить обработку спецсимволов в тексте
                eclevel: 'M'               // Уровень восстановления ошибок Medium (как и было)
            });

            res.type('image/png').send(png);
        } catch (error) {
            console.error("QR-CODE ERROR:", error);
            if (!res.headersSent) {
                res.status(500).type("text/plain").send(error.message);
            }
        }
    });

    // Эндпоинт генерации штрихкодов/матричных кодов через bwip-js
    app.get("/barcode/:format/:width.png", async (req, res) => {        
        try {
            const { data, height: queryHeight } = req.query;
            const { format } = req.params;
            
            if (typeof data === "undefined") {
                return res.status(400).type("text/plain").send("no data");
            }

            const width = Number(req.params.width) * 0.264583;
            let height = 10;

            const isMatrix = ["qrcode", "datamatrix", "azteccode", "microqrcode", "maxicode"].includes(format);
            if (isMatrix) {
                height = width;
            } else if (typeof queryHeight !== "undefined") {
                height = Number(queryHeight) * 0.264583;
            }

            // Рендерим запрашиваемый формат штрихкода
            const png = await bwipjs.toBuffer({
                bcid:        format,
                text:        data,
                scale:       3,
                height:      height,
                width:       width,
                includetext: true,
                textxalign:  'center',
                textyoffset: 4,
                textsize:    11,
                textgaps:    0,    
            });

            res.type('image/png').send(png);
        } catch (error) {
            console.error("BARCODE ERROR:", error);
            if (!res.headersSent) {
                res.status(500).type("text/plain").send(error.message);
            }
        }
    });
};

module.exports.encodeBase64Url = encodeBase64Url;
module.exports.decodeBase64Url = decodeBase64Url;
