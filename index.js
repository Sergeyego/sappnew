const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const db = require("./postgres.js");
const https = require('https');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const autorest = require('./autorest/autorest.js');

const app = express();
const port = 9000;

const options = {
    key: fs.readFileSync(os.homedir() + '/.szsm/privateKey.key'),
    cert: fs.readFileSync(os.homedir() + '/.szsm/certificate.crt')
};

const hashFunc = crypto.createHash('sha256').update(options.key).digest('hex');

global.tables = new Map();
global.rels = new Map();

autorest.updData()
    .then((inf) => {
        if (inf.ok){
            console.log("Данные успешно получены.");
        }
    })
    .catch((error) => {
        console.log("Не удалось обновить данные. " + error.message);
    })

app.set('view engine', 'hbs');
app.set('views', './views');

app.get('/', (req, res) => {
    res.status(200).type('text/plain');
    res.send('Welcome to the server');
})

app.post('/login', bodyParser.json(), async (req, res) => {
    const { username, password } = req.body;
    db.one("SELECT hashpass = crypt($2, hashpass) as ok FROM rest_users WHERE username = $1", [username, password])
        .then((pass_ok) => {
            if (pass_ok.ok) {
                jwt.sign({ username }, hashFunc, { expiresIn: "12 h" }, function (err, token) {
                    if (err) {
                        res.status(401).type('text/plain');
                        res.send(err.message);
                    } else {
                        const decoded = jwt.decode(token, { complete: true });
                        //console.log(decoded.payload);
                        res.json({token, username: decoded.payload.username, iat: decoded.payload.iat, exp: decoded.payload.exp});
                    }
                });
            } else {
                res.status(401).type('text/plain');
                res.send('Неверный пароль');
            }
        })
        .catch((error) => {
            res.status(401).type('text/plain');
            res.send(`Пользователь ${username} не найден. ` + error.message);
        })
});

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, hashFunc, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

const router = express.Router();
router.use(authMiddleware);

router.get('/groups', async (req, res) => {
    try {
        const groups = await db.any("select rug.id_group as id_group from rest_user_group rug " +
            "inner join rest_users ru on ru.id = rug.id_user " +
            "where ru.username = $1", [req.user.username]);
        res.json(groups);
    } catch (error) {
        res.status(500).type('text/plain');
        res.send(error.message);
    }
});

router.put('/users', bodyParser.json(), async (req, res) => {
    try {
        const { username, password } = req.body;
        const data = await db.any("update rest_users set hashpass = crypt($1, gen_salt('bf')) where username = $2", [password, username]);
        res.json(data);
    } catch (error) {
        res.status(500).type('text/plain');
        res.send(error.message);
    }
});

require('./xlsx/api.js')(router);
require('./client_olap/api.js')(router);
require('./autorest/api.js')(router);

require('./routes/api/elrtr/dosage/rcp.js')(router);

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

/*router.get('/profile', (req, res) => {
    res.json({ message: `Hello, ${req.user.username}!` });
});

router.get('/other', (req, res) => {
    res.json({ message: `Hello, ${req.user.username}!` });
});*/

app.use("/api", router);

app.use((req, res, next) => {
    res.status(404).type('text/plain');
    res.send('Not found');
})

/*app.listen(port, () => {
    console.log(`HTTP server running on port ${port}`);
})*/

https.createServer(options, app).listen(port, () => {
    console.log(`HTTPS server running on port ${port}`);
});