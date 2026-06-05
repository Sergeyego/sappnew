const restinfo = require('../../../../autorest/restinfo.js');
//const db = require('../../../../postgres.js');
const autorest = require('../../../../autorest/autorest.js');
//const locale = require('../../../../locale.js');
var bodyParser = require('body-parser');

module.exports = function (app) {
    app.use("/elrtr/dosage/rcp", bodyParser.json(), async (req, res) => {
        const tableName = "rcp_nam";
        try {
            let data = await autorest.getData(tableName, req);
            const tbl = restinfo.tables.get(tableName);
            const col = tbl.columns;
            for (i = 0; i < data.length; i++) {
                col.forEach(function (cl) {
                    const lev = data[i].lev.edit_role;
                    let col = "#FFFFFF";
                    if (lev == 3) {
                        col = "#FFAAAA";
                    } else if (lev == 1) {
                        col = "#AAFFAA";
                    } else if (lev == 2) {
                        col = "#FFFF00";
                    }
                    data[i][cl.nam].background_role = col;
                })
            }
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain');
            res.send(error.message);
        }
    });
}