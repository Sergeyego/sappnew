const db = require('../../../postgres.js');

module.exports = function (app) {
    
    app.get("/depimages/:depId.png", async (req, res) => {
        try {
            const data = await db.one("select zv.simb as simb from zvd_ved zv where zv.id = $1", req.params['depId'])
            res.type('image/png');
            res.send(data.simb);
        } catch (error) {
            res.status(500).type("text/plain").send(error.message);
        }
    });

    app.get("/signatures/:lang/:dat.png", async (req, res) => {
        const { lang, dat } = req.params;

        // 1. Безопасность: Белый список для языков, чтобы защититься от SQL-инъекций в имени колонки
        const allowedLangs = ['ru', 'en', 'mix'];
        if (!allowedLangs.includes(lang)) {
            return res.status(400).type('text/plain').send('Invalid language parameter');
        }

        try {
            // Формируем безопасное имя колонки на основе проверенного языка
            const columnName = `sign_${lang}`;
            
            // 2. Используем стандартный плейсхолдер \$1 для значения dat (защита от инъекций)
            const query = `SELECT ${columnName} AS sign FROM general_data WHERE dat = $1`;
            
            // Выполняем запрос, передавая dat в массиве параметров
            const data = await db.one(query, [dat]);

            res.type('image/png');
            res.send(data.sign);
        } catch (error) {
            console.error('ERROR:', error);
            res.status(500).type('text/plain').send(error.message);
        }
    });
}