const db = require('../../../postgres.js');
const multer = require('multer');
const autorest = require('../../../autorest/autorest.js'); // Для setSqlContext

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // Ограничение 5 МБ

module.exports = function (app) {

    app.get("/depimages/:depId.png", async (req, res) => {
        try {
            const data = await db.oneOrNone("select zv.simb as simb from zvd_ved zv where zv.id = $1", req.params['depId']);
            
            // Если записи нет или картинка пустая — отдаем 404
            if (!data || !data.simb) {
                return res.status(404).type("text/plain").send("Image not found");
            }
            
            res.type('image/png');
            res.send(data.simb);
        } catch (error) {
            res.status(500).type("text/plain").send(error.message);
        }
    });

    app.put("/depimages/:depId.png", upload.single('file'), async (req, res) => {
        try {
            const { depId } = req.params;

            if (!req.file) {
                return res.status(400).type("text/plain").send("Файл не загружен");
            }

            const result = await db.tx(async t => {
                await autorest.setSqlContext(t, req);
                return await t.result(
                    "update zvd_ved set simb = $1 where id = $2",
                    [req.file.buffer, depId]
                );
            });

            if (result.rowCount === 0) {
                return res.status(404).type("text/plain").send("Запись не найдена");
            }

            res.type("text/plain").send("Картинка успешно обновлена");
        } catch (error) {
            // Если сработал лимит multer
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).type("text/plain").send("Файл слишком большой (макс. 5 МБ)");
            }
            res.status(500).type("text/plain").send(error.message);
        }
    });

    app.delete("/depimages/:depId.png", async (req, res) => {
        try {
            const { depId } = req.params;

            const result = await db.tx(async t => {
                await autorest.setSqlContext(t, req);
                return await t.result(
                    "update zvd_ved set simb = null where id = $1",
                    depId
                );
            });

            if (result.rowCount === 0) {
                return res.status(404).type("text/plain").send("Запись не найдена");
            }

            res.type("text/plain").send("Картинка успешно удалена");
        } catch (error) {
            res.status(500).type("text/plain").send(error.message);
        }
    });

    app.get("/signatures/:lang/:dat.png", async (req, res) => {
        const { lang, dat } = req.params;

        const allowedLangs = ['ru', 'en', 'mix'];
        if (!allowedLangs.includes(lang)) {
            return res.status(400).type('text/plain').send('Invalid language parameter');
        }

        try {
            const columnName = `sign_${lang}`;
            const query = `SELECT ${columnName} AS sign FROM general_data WHERE dat = $1`;
            
            // Используем oneOrNone, чтобы не падать, если даты нет
            const data = await db.oneOrNone(query, [dat]);

            if (!data || !data.sign) {
                return res.status(404).type('text/plain').send("Signature not found");
            }

            res.type('image/png');
            res.send(data.sign);
        } catch (error) {
            console.error('ERROR:', error);
            res.status(500).type('text/plain').send(error.message);
        }
    });
}