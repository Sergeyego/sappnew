
const autorest = require('../../../../autorest/autorest.js');
const sql = require('../../../../sql.js');
const locale = require('../../../../locale.js');

const sqlPackPal = sql('routes/api/elrtr/stat/packPal.sql');
const sqlPack = sql('routes/api/elrtr/stat/pack.sql');
const sqlThermoPack = sql('routes/api/elrtr/stat/thermoPack.sql');
const sqlPerePack = sql('routes/api/elrtr/stat/perePack.sql');
const sqlStock = sql('routes/api/elrtr/stat/stock.sql');
const sqlSelf = sql('routes/api/elrtr/stat/self.sql');
const sqlShip = sql('routes/api/elrtr/stat/ship.sql');
const sqlBreak = sql('routes/api/elrtr/stat/break.sql');

let calcSum = function (obj) {
    let sum = 0.0;
    for (let i = 0; i < obj.rows.length; i++) {
        sum += obj.rows[i]["kvo"].edit_role;
    }
    if (sum != 0) {
        obj.title += " итого: " + locale.insNumber(sum, 1) + " кг";
    }
    return sum;
}

let calcSumBrk = function (obj) {
    let sum = 0.0;
    let sumBrk = 0.0;
    for (let i = 0; i < obj.rows.length; i++) {
        sum += obj.rows[i]["kvo"].edit_role;
        sumBrk += obj.rows[i]["brk"].edit_role;
    }
    if (sum != 0) {
        obj.title += " итого: " + locale.insNumber(sum, 1) + " кг";
    }
    if (sumBrk > 0) {
        obj.title += " брак: " + locale.insNumber(sumBrk, 1) + " кг";
    }
    return sum;
}

let calcSumStock = function (obj) {
    let mapSum = new Map();
    for (let i = 0; i < obj.rows.length; i++) {
        const ist = obj.rows[i]["ist"].edit_role;
        const kvo = obj.rows[i]["kvo"].edit_role;
        if (mapSum.has(ist)) {
            let s = mapSum.get(ist) + kvo;
            mapSum.set(ist, s);
        } else {
            mapSum.set(ist, kvo);
        }
    }
    mapSum.forEach((value, key) => {
        obj.title += " " + key + ": " + locale.insNumber(value, 1) + " кг";
    });
    return 0;
}

module.exports = function (app) {

    app.get("/elrtr/stat/:id_part", async (req, res) => {
        try {
            const id_part = Number(req.params["id_part"]);
            const [
                packPal,
                pack,
                thermoPack,
                perePack,
                stock,
                self,
                ship,
                brk
            ] = await Promise.all([
                autorest.getRoData("Упаковка поддонов", sqlPackPal, [id_part], ["Дата", "Работник", "К-во, кг", "Поддон"], 1),
                autorest.getRoData("Упаковка", sqlPack, [id_part], ["Дата", "№ нак.", "К-во, кг"], 1),
                autorest.getRoData("Термопак", sqlThermoPack, [id_part], ["Дата", "Работник", "К-во, кг", "Поддон"], 1),
                autorest.getRoData("Переупаковка", sqlPerePack, [id_part], ["Дата", "№ нак.", "Операция", "К-во, кг", "Брак, кг"], 1),
                autorest.getRoData("Склад", sqlStock, [id_part], ["Дата", "№ нак.", "Источник", "К-во, кг", "Поддон"], 1),
                autorest.getRoData("Собств. потреб.", sqlSelf, [id_part], ["Дата", "№ нак.", "Куда", "К-во, кг"], 1),
                autorest.getRoData("Отгрузки", sqlShip, [id_part], ["Дата", "№ нак.", "Получатель", "К-во, кг"], 1),
                autorest.getRoData("Брак", sqlBreak, [id_part], ["Дата", "№ нак.", "К-во, кг"], 1)
            ]);

            // Агрегация сумм в заголовках
            calcSum(packPal);
            calcSum(pack);
            calcSum(thermoPack);
            calcSumBrk(perePack);
            calcSumStock(stock);
            calcSum(self);
            calcSum(ship);
            calcSum(brk);

            // Формируем результирующий массив отчетов
            const data = [
                packPal,
                pack,
                thermoPack,
                perePack,
                stock,
                self,
                ship,
                brk
            ];
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });
}