const db = require('../postgres.js');
const autorest = require('../autorest/autorest.js');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json({ limit: '10mb' });

module.exports = function (app) {

    // Получение списка кубов OLAP для программы
    app.get("/olap/prog/:progname", async (req, res) => {
        try {
            const progName = String(req.params.progname);

            const query = `
                SELECT o.id AS id, o.nam AS nam 
                FROM olaps_prog op 
                INNER JOIN olaps o ON o.id = op.id_olap 
                WHERE op.prog = $1 
                ORDER BY o.nam
            `;

            const data = await db.any(query, [progName]);
            res.json(data);
        } catch (error) {
            console.error('Ошибка в GET /olap/prog:', error);
            res.status(500).type('text/plain').send(error.message);
        }
    });

    // Получение метаданных конкретного OLAP-куба
    app.get("/olap/info/:id", async (req, res) => {
        try {
            const id = Number(req.params.id);

            if (Number.isNaN(id)) {
                return res.status(400).type('text/plain').send('Некорректный формат идентификатора OLAP');
            }

            const query = `
                SELECT nam AS nam, array_to_json(columns) AS columns, dc AS dec, query AS qu 
                FROM olaps 
                WHERE id = $1
            `;

            const data = await db.oneOrNone(query, [id]);

            if (!data) {
                return res.status(404).type('text/plain').send('OLAP-куб с указанным ID не найден');
            }

            res.json(data);
        } catch (error) {
            console.error('Ошибка в GET /olap/info:', error);
            res.status(500).type('text/plain').send(error.message);
        }
    });

    // Получение данных для OLAP-куба
    app.post("/olap/data", jsonParser, async (req, res) => {
        try {
            const { nam, qu, columns, dec } = req.body;
            // Вызов генератора read-only данных из модуля autorest
            const data = await autorest.getRoData(nam, qu, [], columns, dec);
            res.json(data);
        } catch (error) {
            console.error('Ошибка в POST /olap/data:', error);
            res.status(500).type('text/plain').send(error.message);
        }
    });
}