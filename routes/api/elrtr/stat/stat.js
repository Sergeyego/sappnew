const db = require('../../../../postgres.js');
const autorest = require('../../../../autorest/autorest.js');
const sql = require('../../../../sql.js');

const sqlPackPal = sql('routes/api/elrtr/stat/packPal.sql');
const sqlPack = sql('routes/api/elrtr/stat/pack.sql');
const sqlThermoPack = sql('routes/api/elrtr/stat/thermoPack.sql');
const sqlPerePack = sql('routes/api/elrtr/stat/perePack.sql');
const sqlStock = sql('routes/api/elrtr/stat/stock.sql');
const sqlSelf = sql('routes/api/elrtr/stat/self.sql');
const sqlShip = sql('routes/api/elrtr/stat/ship.sql');
const sqlBreak = sql('routes/api/elrtr/stat/break.sql');

module.exports = function (app) {

    app.get("/elrtr/stat/:id_part", async (req, res) => {
        try {
            const id_part = Number(req.params["id_part"]);
            let data = [];
            let packPal = await autorest.getRoData("Упаковка поддонов",sqlPackPal,[id_part]);
            let pack = await autorest.getRoData("Упаковка",sqlPack,[id_part]);
            let thermoPack = await autorest.getRoData("Термопак",sqlThermoPack,[id_part]);
            let perePack = await autorest.getRoData("Переупаковка",sqlPerePack,[id_part]);
            let stock = await autorest.getRoData("Склад",sqlStock,[id_part]);
            let self = await autorest.getRoData("Собств. потреб.",sqlSelf,[id_part]);
            let ship = await autorest.getRoData("Склад",sqlShip,[id_part]);
            let brk = await autorest.getRoData("Брак",sqlBreak,[id_part]);

            data.push(packPal);
            data.push(pack);
            data.push(thermoPack);
            data.push(perePack);
            data.push(stock);
            data.push(self);
            data.push(ship);
            data.push(brk);

            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain');
            res.send(error.message);
        }
    });
}