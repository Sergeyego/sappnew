const db = require('../../../../postgres.js');
const autorest = require('../../../../autorest/autorest.js');
const sql = require('../../../../sql.js');

const sqlMasters = sql('routes/api/elrtr/pack/masters.sql');
const sqlLoad = sql('routes/api/elrtr/pack/loadPack.sql');

function isLastDayOfMonth(date) {
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return date.getDate() === nextMonth.getDate();
}

module.exports = function (app) {
    app.get("/elrtr/pack/masters/:dat", async (req, res) => {
        try {
            let data = await autorest.getRoData("Мастеры",sqlMasters,[req.params["dat"]]);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/elrtr/pack/load/:id_nakl/:dat/:id_master", async (req, res) => {
        try {
            let data = await db.any(sqlLoad,[Number(req.params["id_nakl"]),req.params["dat"],req.params["id_master"]]);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/elrtr/pack/fix/dats", async (req, res) => {
        try {
            let data = await autorest.getRoData("Даты","select distinct dat as dat from prod_ost order by dat desc");
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/elrtr/pack/fix/new/:dat", async (req, res) => {
        try {
            const date = new Date(req.params["dat"]);
            if (!isLastDayOfMonth(date)){
                res.status(400).type('text/plain');
                res.send("Дата должна быть последним числом месяца!");
                return;
            }
            await db.any("delete from prod_ost where dat = $1",[date]);
            const data = await db.any("insert into prod_ost (dat, id_part, kvo) (select $1, p.id_part, p.ostend from calc_prod($1) as p where p.ostend<>0)",[date]);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });
}