const db = require('../../../postgres.js');
const autorest = require('../../../autorest/autorest.js'); // Для setSqlContext

module.exports = function (app) {

    app.get("/proc/ovens/rab/:dbeg/:dend", async (req, res) => {
        try {
            const is_el = req.query.mode == "e";
            const header = ["id","Печь","Дата-время","Парт.","Марка-диам.","Программа","t0","w0","Замес","Загр.,кг","Окончание","W,кВт*ч","Рабочий"];
            const param = {
                id: { "width": -1 },
                num: { "width": 85 },
                dt_beg: { "width": 120 },
                n_s: { "width": is_el ? 70 : -1},
                marka: { "width": is_el ? 165 : -1 },
                prog_nam: { "width": is_el ? -1 : 200 },
                t0: { "width": -1 },
                w0: { "width": -1 },
                zms: { "width": -1 },
                kvo: { "width": -1 },
                dt_end: { "width": -1 },
                energ: { "width": -1 },
                rab: { "width": -1 },
                id_o: { "width": -1 }
            };
            const filter = is_el ? "and o2.id_group <> 17" : "and o2.id_group = 17";
            const query = `select o.id as id, o2.num as num, o.dt_beg as dt_beg, o.n_s as n_s, de.fnam as marka, o.prog_nam as prog_nam, 
                o.t0 as t0, o.w0 as w0, o.zms as zms, o.kvo as kvo, o.dt_end as dt_end, o.energ as energ, rr.snam as rab, o.id_owen as id_o
                from owens_rab as o
                inner join owens o2 on o2.id = o.id_owen 
                left join dry_els de on de.ide = o.id_eldim 
                left join rab_rab rr on rr.id = o.id_rab 
                where o.dt_beg between $1 and $2 ${filter}
                order by o.dt_beg `;
            
            const data = await autorest.getRoData("Прокалки",query,[req.params.dbeg,req.params.dend],header,1,param);

            for (let i = 0; i < data.rows.length; i++) {
                const row = data.rows[i];
                const color = row["dt_end"].edit_role===null ? "#FFFFFF" : "#AAFFAA";
                for (let j = 0; j < data.fields.length; j++) {
                    const fieldName = data.fields[j].nam;
                    if (row[fieldName]) {
                        row[fieldName].background_role = color;
                    }
                }
            }
            res.json(data);
        } catch (error) {
            res.status(500).type("text/plain").send(error.message);
        }
    });

    app.get("/proc/ovens/list", async (req, res) => {
        try {
            const header = ["id","Номер","Группа","Мощность"];
            const param = {
                id: { "width": -1 }
            };

            const query = `select o.id as id, o.num as num, g.nam as group, o.pwr||'+'||o.pwr_cool||' kW' as pwr 
                from owens as o 
                inner join owens_groups as g on o.id_group=g.id 
                order by o.num`;
            
            const data = await autorest.getRoData("Печи",query,[],header,1,param);
            res.json(data);
        } catch (error) {
            res.status(500).type("text/plain").send(error.message);
        }
    });
}