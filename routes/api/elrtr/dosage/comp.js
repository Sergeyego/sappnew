const db = require('../../../../postgres.js');
const autorest = require('../../../../autorest/autorest.js');
//const locale = require('../../../../locale.js');
const bodyParser = require('body-parser');

module.exports = function (app) {
    app.get("/elrtr/dosage/comp/parti/list/:dbeg/:dend", async (req, res) => {
        try {
            const query=`
                select cp.id as id, m.nam as nan, cp.parti ||'/'||TO_CHAR(cp2.dat_pr, 'YY') as part, cp2.dat_pr as dat
                from comp_parti cp 
                inner join comp_prih cp2 on cp2.id = cp.id_prih 
                inner join matr m on m.id = cp2.id_comp 
                where cp2.dat_pr between $1 and $2
                order by m.nam, cp.parti, cp2.dat_pr 
            `;
            const data = await autorest.getRoData("Партии компонентов",query,[req.params.dbeg, req.params.dend]);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });
}