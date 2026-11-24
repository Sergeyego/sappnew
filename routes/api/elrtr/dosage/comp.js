const db = require('../../../../postgres.js');
const autorest = require('../../../../autorest/autorest.js');
//const locale = require('../../../../locale.js');
const bodyParser = require('body-parser');
const otk = require('../../../../otk.js');

const getChemGost = async function (id_part) {
    const query = `
        SELECT c.id_chem, c.min, c.max 
        FROM comp_gost AS c 
        WHERE c.id_comp = (select cp.id_comp from comp_prih as cp inner join comp_parti cp2 on cp2.id_prih = cp.id where cp2.id = $1 )
    `;
    const state = await db.any(query, [id_part]);
    const mapStat = new Map();
    for (let i = 0; i < state.length; i++) {
        mapStat.set(state[i].id_chem, { min: state[i].min, max: state[i].max });
    }
    return mapStat;
}

module.exports = function (app) {

    app.use("/elrtr/dosage/comp/chem", autorest.parseFilterMiddleware("comp_chem"), bodyParser.json(), async (req, res) => {
        const tableName = "comp_chem";
        try {
            let data = await autorest.getData(tableName, req);
            await otk.processTuColoring(data, tableName, getChemGost, "id_el", "id_part");
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.use("/elrtr/dosage/comp/chemtest", autorest.parseFilterMiddleware("comp_test"), bodyParser.json(), async (req, res) => {
        const tableName = "comp_test";
        try {
            let data = await autorest.getData(tableName, req);
            await otk.processTuColoring(data, tableName, getChemGost, "id_comp", "id_part");
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/elrtr/dosage/comp/parti/list/:dbeg/:dend", async (req, res) => {
        try {
            const query = `
                select cp.id as id, m.nam as nam, cp.parti ||'/'||TO_CHAR(cp2.dat_pr, 'YY') as part, 
                cp2.dat_pr as dat, cp.finish as finish, s.short as post, cp2.kvo as kvo
                from comp_parti cp 
                inner join comp_prih cp2 on cp2.id = cp.id_prih 
                inner join matr m on m.id = cp2.id_comp 
                inner join suppl s on s.id = cp2.id_spl 
                where cp2.dat_pr between $1 and $2
                order by m.nam, date_part('year',cp2.dat_pr), cp.parti, cp2.dat_pr
            `;

            const header = ["id", "Компонент", "Партия", "Дата парт.", "Законч.", "Поставщик", "Колич.,т"];
            const param = {
                id: { "width": -1 },
                nam: { "width": 230 },
                part: { "width": 70 },
                dat: { "width": 80 },
                finish: { "width": 50 },
                post: { "width": 170 },
                kvo: { "width": 70 }
            };

            const data = await autorest.getRoData("Партии компонентов", query, [req.params.dbeg, req.params.dend], header, 3, param);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });
}