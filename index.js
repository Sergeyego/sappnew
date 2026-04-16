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

autorest.updData();

app.get('/', (req, res) => {
    res.status(200).type('text/plain');
    res.send('Welcome to the server');
})

app.post('/login', bodyParser.json(), async (req, res) => {
    const { username, password } = req.body;
    db.one("SELECT hashpass = crypt($2, hashpass) as ok FROM rest_users WHERE username = $1", [username, password])
        .then((pass_ok) => {
            if (pass_ok.ok) {
                jwt.sign({ username }, hashFunc, { expiresIn: "11 h" }, function (err, token) {
                    if (err) {
                        res.status(401).type('text/plain');
                        res.send(err.message);
                    } else {
                        res.json({ token });
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

require('./routes/api/elrtr/rest.js')(router);

router.get('/profile', (req, res) => {
    res.json({ message: `Hello, ${req.user.username}!` });
});

router.get('/other', (req, res) => {
    res.json({ message: `Hello, ${req.user.username}!` });
});

app.use("/api", router);

app.use((req, res, next) => {
    res.status(404).type('text/plain');
    res.send('Not found');
})

/*app.listen(port, () => {
    console.log(`Server app listening on port ${port}`);
})*/

https.createServer(options, app).listen(port, () => {
    console.log(`HTTPS server running on port ${port}`);
});