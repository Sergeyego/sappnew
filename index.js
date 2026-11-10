const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const db = require("./postgres.js");
const https = require('https');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const app = express();
const port = 9000;

const options = {
    key: fs.readFileSync(os.homedir() + '/.szsm/privateKey.key'),
    cert: fs.readFileSync(os.homedir() + '/.szsm/certificate.crt')
};

const hashFunc = crypto.createHash('sha256').update(options.key).digest('hex');

const JWT_SECRET = process.env.JWT_SECRET || hashFunc;
const API_KEY = process.env.API_KEY || 'super-secret-api-key';

app.set('view engine', 'hbs');
app.set('views', './views');

// Базовый некорректный путь
app.get('/', (req, res) => {
    res.status(200).type('text/plain').send('Welcome to the server');
});

// Эндпоинт получения JWT
app.post('/login', bodyParser.json(), async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).type('text/plain').send('Необходимо указать имя пользователя и пароль');
    }

    try {
        const user = await db.oneOrNone(
            "SELECT (hashpass = crypt($2, hashpass)) as ok FROM rest_users WHERE username = $1",
            [username, password]
        );

        if (!user || !user.ok) {
            return res.status(401).type('text/plain').send('Неверное имя пользователя или пароль');
        }

        const token = await new Promise((resolve, reject) => {
            jwt.sign({ username }, JWT_SECRET, { expiresIn: "12h" }, (err, encoded) => {
                if (err) reject(err);
                else resolve(encoded);
            });
        });

        const decoded = jwt.decode(token, { complete: true });

        return res.json({
            token,
            username: decoded.payload.username,
            iat: decoded.payload.iat,
            exp: decoded.payload.exp
        });

    } catch (error) {
        console.error('Ошибка авторизации:', error);
        return res.status(500).type('text/plain').send('Внутренняя ошибка сервера');
    }
});

// ==========================================
// МИДЛВАРЫ АВТОРИЗАЦИИ
// ==========================================

// Внутренняя функция для проверки JWT (без отправки ответа 401)
function verifyJWT(req) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

    const token = authHeader.split(' ')[1];
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (e) {
        return null;
    }
}

// 1. Строгий мидлвар (только JWT)
function authMiddleware(req, res, next) {
    const decoded = verifyJWT(req);
    if (!decoded) {
        return res.status(401).type('text/plain').send('Необходима авторизация через JWT (Bearer токен)');
    }
    req.user = decoded;
    next();
}

// 2. Гибридный мидлвар (API-ключ ИЛИ JWT)
function apiKeyOrJwtMiddleware(req, res, next) {
    const apiKey = req.headers['x-api-key'];

    // Проверяем сначала API-ключ
    if (apiKey && apiKey === API_KEY) {
        req.user = { username: 'api_key_user' };
        return next();
    }

    // Если ключа нет или он не подошел, пробуем проверить JWT
    const decoded = verifyJWT(req);
    if (decoded) {
        req.user = decoded;
        return next();
    }

    // Если не подошло ничего
    return res.status(401).type('text/plain').send('Доступ запрещен. Необходим валидный API-ключ или JWT-токен');
}


// ==========================================
// КОНФИГУРАЦИЯ РОУТОВ
// ==========================================

const router = express.Router();

// -------------------------------------------------------------
// КАТЕГОРИЯ 1: Роуты, доступные и по JWT, и по API-ключу
// -------------------------------------------------------------
router.use(apiKeyOrJwtMiddleware);

router.get('/groups', async (req, res) => {
    try {
        const groups = await db.any("select rug.id_group as id_group from rest_user_group rug " +
            "inner join rest_users ru on ru.id = rug.id_user " +
            "where ru.username = $1", [req.user.username]);
        res.json(groups);
    } catch (error) {
        res.status(500).type('text/plain').send(error.message);
    }
});

// Подключаем внешние модули, которые ТАКЖЕ должны отвечать на API-ключ
require('./routes/api/proc/api.js')(router);

// -------------------------------------------------------------
// КАТЕГОРИЯ 2: Все последующие роуты — ТОЛЬКО по JWT
// -------------------------------------------------------------
// Переопределяем мидлвар для всех строк кода, что идут ниже
router.use(authMiddleware);

router.put('/users', bodyParser.json(), async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).type('text/plain').send('Необходимо указать имя пользователя и новый пароль');
    }

    const isSelf = req.user.username === username;
    const isAdmin = req.user.username === 'admin';

    if (!isSelf && !isAdmin) {
        return res.status(403).type('text/plain').send('Недостаточно прав для изменения пароля этого пользователя');
    }

    try {
        const updatedUser = await db.oneOrNone(
            "UPDATE rest_users SET hashpass = crypt($1, gen_salt('bf')) WHERE username = $2 RETURNING username",
            [password, username]
        );

        if (!updatedUser) {
            return res.status(404).type('text/plain').send(`Пользователь ${username} не найден`);
        }

        return res.json({ success: true, message: `Пароль для пользователя ${username} успешно обновлен` });
    } catch (error) {
        console.error('Ошибка при обновлении пароля:', error);
        return res.status(500).type('text/plain').send('Внутренняя ошибка сервера');
    }
});

router.use(express.static(__dirname + '/public'));

// Модули ниже будут требовать исключительно JWT-токен
require('./autorest/api.js')(router);
require('./barcode.js')(router);
require('./xlsx/api.js')(router);
require('./client_olap/api.js')(router);
require('./routes/api/depimages/depimages.js')(router);
require('./routes/api/elrtr/dosage/rcp.js')(router);
require('./routes/api/elrtr/dosage/s3.js')(router);
require('./routes/api/elrtr/parti/parti.js')(router);
require('./routes/api/elrtr/lab/lab.js')(router);
require('./routes/api/elrtr/report/report.js')(router);
require('./routes/api/elrtr/glass/partGlass.js')(router);
require('./routes/api/elrtr/stat/stat.js')(router);
require('./routes/api/elrtr/invoices/workshop.js')(router);
require('./routes/api/elrtr/invoices/workshopper.js')(router);
require('./routes/api/elrtr/invoices/warehouse.js')(router);
require('./routes/api/elrtr/invoices/warehouseday.js')(router);
require('./routes/api/elrtr/invoices/perepack.js')(router);
require('./routes/api/elrtr/invoices/self.js')(router);
require('./routes/api/elrtr/invoices/selfper.js')(router);
require('./routes/api/elrtr/pack/packnakl.js')(router);
require('./routes/api/elrtr/pack/pack.js')(router);
require('./routes/api/elrtr/labels/api.js')(router);
require('./routes/api/elrtr/pasport/api.js')(router);
require('./routes/api/elrtr/certificate/create.js')(router);
require('./routes/api/elrtr/variants/variants.js')(router);
require('./routes/api/wire/certificate/create.js')(router);
require('./routes/api/wire/parti/parti.js')(router);
require('./routes/api/wms/api.js')(router);
require('./routes/api/site/api.js')(router);
require('./routes/api/generalship/generalship.js')(router);
require('./routes/api/checkcode/checkcode.js')(router);
require('./routes/api/docs/docs.js')(router);

// Подключаем роутер к приложению по стандартному пути
app.use("/api", router);

// ==========================================
// ОБРАБОТКА ОШИБОК И ЗАПУСК
// ==========================================
app.use((req, res, next) => {
    res.status(404).type('text/plain').send('Not found');
});

app.use((err, req, res, next) => {
    console.error(`[${req.method} ${req.url}]`, err.message);
    if (res.headersSent) {
        return next(err);
    }
    const status = err.status || err.statusCode || 500;
    res.status(status).type('text/plain').send(err.message || 'Internal error');
});

/*app.listen(port, () => {
    console.log(`HTTP server running on port ${port}`);
})*/

https.createServer(options, app).listen(port, () => {
    console.log(`HTTPS server running on port ${port}`);
});