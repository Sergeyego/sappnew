const db = require('../../../postgres.js');
const autorest = require('../../../autorest/autorest.js');

module.exports = function (app) {
    
    app.get("/generalship/list/:dbeg/:dend", async (req, res) => {
        try {
            const query = `select s.id as id, s.nom_s as num, s.dat_vid as dat, p.short as pol from sertifikat as s 
                inner join poluch as p on p.id=s.id_pol 
                where s.dat_vid between $1 and $2 order by s.nom_s, s.dat_vid`;
            const headers = ["id","Номер","Дата","Получатель"];
            const param = {
                id: { "width": -1 }
            };
            const data = await autorest.getRoData("Отгрузки",query,[req.params["dbeg"],req.params["dend"]],headers,1,param);
            res.json(data);
        } catch (error) {
            res.status(500).type("text/plain").send(error.message);
        }
    });

    app.get("/generalship/data/:id_ship", async (req, res) => {
        try {
            const query = `select z.id, z.prefix, z.parti, z.mark, z.massa, z.ds_status, z.r, z.id_part from ( 
                  (select o.id, 'elrtr' as prefix, p.n_s||'-'||date_part('year',p.dat_part) as parti, 
                  e.marka||' ф '||cast(p.diam as varchar(3))||CASE WHEN p.id_var <> 1 THEN (' /'::text || ev.nam::text) || '/'::text ELSE ''::text END AS mark, 
                  o.massa as massa, o.ds_status as ds_status, 
                  (select case when exists(select id_chem from sert_chem where id_part=p.id) then 1 else 0 end + 
                  case when exists(select id_mech from sert_mech where id_part=p.id) then 2 else 0 end ) as r, p.id as id_part 
                  from otpusk o inner join parti p on o.id_part=p.id 
                  inner join elrtr e on e.id=p.id_el 
                  inner join istoch i on i.id=p.id_ist 
                  inner join elrtr_vars ev on ev.id=p.id_var 
                  where o.id_sert = $1 order by p.n_s, p.dat_part) 
                  union 
                  (select w.id, 'wire', m.n_s||'-'||date_part('year',m.dat), 
                  pr.nam||' ф '|| d.sdim ||' '||k.short ||' '|| CASE WHEN p.id_var <> 1 THEN (' /'::text || ev.nam::text) || '/'::text ELSE ''::text END AS mark, 
                  w.m_netto, w.ds_status, 
                  (select case when exists(select id from wire_parti_chem where id_part=(select p.id_m from wire_parti as p where p.id = w.id_wparti)) then 1 else 0 end + 
                  case when exists(select id from wire_parti_mech where id_part=(select p.id_m from wire_parti as p where p.id = w.id_wparti)) then 2 else 0 end) as r, 
                  p.id 
                  from wire_shipment_consist w 
                  inner join wire_parti p on p.id=w.id_wparti 
                  inner join wire_parti_m m on p.id_m=m.id 
                  inner join provol pr on pr.id=m.id_provol 
                  inner join diam d on d.id=m.id_diam 
                  inner join wire_pack_kind k on p.id_pack=k.id 
                  inner join elrtr_vars ev on ev.id=p.id_var 
                  where w.id_ship= $1 
                  order by pr.nam, d.sdim, k.short, m.n_s) 
                  ) as z order by z.prefix, z.mark, z.parti`;
            const headers = ["id","Префикс","Партия","Марка","Кол-во, кг","Подп.","Стат.","id_part"];
            const param = {
                id: { "width": -1 },
                prefix: { "width": -1 },
                ds_status: { "width": -1 },
                r: { "width": -1 },
                id_part: { "width": -1 }
            };

            const data = await autorest.getRoData("Данные отгрузки",query,[Number(req.params["id_ship"])],headers,1,param);

            for (let i = 0; i < data.rows.length; i++) {
                const row = data.rows[i];
                const stat = row["r"]?.edit_role;
                let color = "#FFFFFF";
                if (stat==0){
                    color="#FFAAAA";
                } else if (stat==1){
                    color="#FFFF00";
                } else if (stat==2){
                    color="#808080";
                } else if (stat==3){
                    color="#AAFFAA";
                }
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
}