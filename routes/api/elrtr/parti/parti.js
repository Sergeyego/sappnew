const db = require('../../../../postgres.js');

module.exports = function (app) {
    app.get("/elrtr/parti/insmark/:id_rcp", async (req, res) => {
        try {    
            const data = await db.any("select rn.id_el from rcp_nam rn where rn.id = $1",[Number(req.params["id_rcp"])]);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/elrtr/parti/insprovol/:id_el", async (req, res) => {
        try {    
            const data = await db.any("select e.id_gost as id_pr from elrtr e where e.id = $1",[Number(req.params["id_el"])]);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/elrtr/parti/inspack/:id_el/:diam", async (req, res) => {
        try {
            const data = await db.any("select p.id_pack, p.id_long, p.id_var, count(p.id_pack) as stat " +
                "from parti p " +
                "where p.dat_part >= (CURRENT_DATE-365) and p.id_el = $1 and p.diam = $2 " +
                "group by p.id_pack, p.id_long, p.id_var order by stat desc", [Number(req.params["id_el"]),Number(req.params["diam"])]);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });
}