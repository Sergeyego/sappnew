const autorest = require('./../../../../autorest/autorest.js');
const sql = require('./../../../../sql.js');

const sqlByPart = sql('routes/api/elrtr/report/by_part.sql');
const sqlByMark = sql('routes/api/elrtr/report/by_mark.sql');

module.exports = function (app) {
    app.get("/elrtr/report/:d1/:d2", async (req, res) => {
            try {
                let mapCol = new Map();
                mapCol.set("marka", {name : "Марка"});
                mapCol.set("diam", {name : "Диам."});
                mapCol.set("part", {name : "Партия"});
                mapCol.set("var", {name : "Вариант"});
                mapCol.set("pack_ed", {name : "Упаковка"});
                mapCol.set("ostbeg", {name : "Налич.на нач."});
                mapCol.set("pack", {name : "Упаковка"});
                mapCol.set("thermo", {name : "Термопак"});
                mapCol.set("perepack", {name : "Переуп.(+/-)"});
                mapCol.set("perepackbreak", {name : "Брак при переуп."});
                mapCol.set("arch", {name : "Архив(+/-)"});
                mapCol.set("isp", {name : "Испытан."});
                mapCol.set("selfn", {name : "Соб. потр."});
                mapCol.set("oth", {name : "Другие"});
                mapCol.set("war", {name : "На склад"});
                mapCol.set("warout", {name : "Со склада"});
                mapCol.set("ostend", {name : "Ост.на конец"});

                const query = (req.query.by_part=="true") ? sqlByPart : sqlByMark;

                let data = await autorest.getRoData("Отчет по цеху электродов", query ,[req.params["d1"], req.params["d2"]],mapCol);
                let sums = {};
                const col_sum=["ostbeg","pack","thermo","perepack","perepackbreak","arch","isp","selfn","oth","war","warout","ostend"];
                for (let n=0; n<col_sum.length; n++){
                    sums[col_sum[n]]=0;
                }
                for (i = 0; i < data.rows.length; i++) {
                    const beg = data.rows[i]["ostbeg"].edit_role;
                    const end = data.rows[i]["ostend"].edit_role;
                    for (j=0; j<data.fields.length; j++){
                        if (beg<0 || end<0){
                            data.rows[i][data.fields[j].nam].background_role = "#FFAAAA";
                        }
                    }
                    for (let n=0; n<col_sum.length; n++){
                        sums[col_sum[n]]+=data.rows[i][col_sum[n]].edit_role;
                    }
                }
                sums["marka"]="ИТОГО";
                let tbl_col = {};
                for (j = 0; j < data.fields.length; j++) {
                    let ob = {};
                    const val = (sums[data.fields[j].nam]==undefined) ? null : sums[data.fields[j].nam];
                    ob["edit_role"] = val;
                    ob["display_role"] = autorest.getDisplay(val, data.fields[j].udt_name, 1, true);
                    ob["background_role"] = "#FFFFFF";
                    ob["tooltip_role"] = "";
                    tbl_col[data.fields[j].nam] = ob;
                }
                data.rows.push(tbl_col);
                //console.log(tbl_col);
                res.json(data);
            } catch (error) {
                res.status(500).type('text/plain');
                res.send(error.message);
            }
        });

}