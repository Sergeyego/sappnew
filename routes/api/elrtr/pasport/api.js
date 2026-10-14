const latex = require('node-latex');
const sfs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const autorest = require('../../../../autorest/autorest.js');
const db = require('../../../../postgres.js');
const sql = require('../../../../sql.js');

const pasport = require('./pasport.js');
const queryTu = sql('routes/api/elrtr/parti/tu.sql');

module.exports = function (app) {
    const bodyParser = require('body-parser');
    const jsonParser = bodyParser.json({ limit: '10mb' });

    app.get("/elrtr/pasport/author/:date", async (req, res) => {
        try {
            const query = `
                SELECT ps.id_role as id_role, (select snam||'#'||job from kamin_get_inf($1, ps.id_empl)) as nam FROM pasport_sig ps 
                INNER JOIN (SELECT id_role as id_role, max(dat) as dat FROM pasport_sig WHERE dat <= $1 GROUP BY id_role) as c ON c.id_role = ps.id_role AND c.dat = ps.dat
            `;
            const data = await autorest.getRoData("Подписанты", query, [req.params.date]);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.post("/elrtr/pasport/create/:id", jsonParser, async (req, res) => {
        let tmpDir = null;
        try {
            const id_part = Number(req.params.id);
            if (Number.isNaN(id_part)) {
                return res.status(400).type('text/plain').send("Ошибка: id должен быть числом");
            }

            // Создаем изолированную директорию в /tmp
            tmpDir = await sfs.mkdtemp(path.join(os.tmpdir(), 'pasport-'));
            await pasport.copyDir(path.join(__dirname, 'tex'), tmpDir);
            await pasport.createSignFiles(tmpDir, req.body.date);

            // Собираем все данные СУБД параллельно
            const [templateData, partdata, tudata, sertData, chemData, mechData, ampData, plavData] = await Promise.all([
                sfs.readFile(path.join(tmpDir, 'document.tex'), 'utf8'),
                pasport.getPartData(id_part),
                db.any(queryTu, [id_part]), // Использование кэшированного SQL-файла
                pasport.getSertData(id_part), pasport.getChemData(id_part), pasport.getMechData(id_part), pasport.getAmpData(id_part), pasport.getPlavData(id_part)
            ]);

            const tustr = tudata.map(t => t.nam).join(", ");
            const docContent = pasport.getDoc(templateData, partdata, tustr, sertData, chemData, mechData, ampData, plavData, req.body);

            const options = { inputs: tmpDir, fonts: path.join(tmpDir, 'font'), cmd: 'xelatex', passes: 2 };
            const pdf = latex(docContent, options);

            res.type('application/pdf');
            pdf.pipe(res);

            const cleanUp = async () => {
                if (tmpDir) {
                    try { await sfs.rm(tmpDir, { recursive: true, force: true }); tmpDir = null; }
                    catch (e) { console.error("Ошибка удаления папки:", e); }
                }
            };

            pdf.on('end', cleanUp);
            res.on('close', cleanUp);
            pdf.on('error', async (err) => {
                console.error("Ошибка LaTeX:", err);
                await cleanUp();
                if (!res.headersSent) {
                    res.status(500).type('text/plain').send(err.message);
                } else {
                    res.destroy(err);   // ← обрываем соединение, клиент увидит сетевую ошибку вместо таймаута
                }
            });

        } catch (error) {
            console.error("Критическая ошибка:", error);
            if (tmpDir) { try { await sfs.rm(tmpDir, { recursive: true, force: true }); } catch (e) { } }
            if (!res.headersSent) res.status(500).type('text/plain').send(error.message);
        }
    });
};