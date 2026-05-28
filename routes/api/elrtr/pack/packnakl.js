const db = require('../../../../postgres.js');
const locale = require('../../../../locale.js');

let getTable = function(data, by_rab){
    let sum = 0.0;
    let part_sum = 0.0;
    let tbl='<table class="tablestyle" border="1" cellspacing="0" cellpadding="2">';
        tbl+='<tr class="boldtext">'+
            '<td class="centeralign" width=5% >№</td>'+
            '<td class="centeralign" width=28% >Наименование <br>товара</td>'+
            '<td class="centeralign">Партия</td>'+
            '<td class="centeralign">Упаковщик</td>'+
            '<td class="centeralign">Поддон</td>'+
            '<td class="centeralign">Колич.,<br>кг</td>'+
        '</tr>';
    for (let i=0; i<data.length; i++){
        tbl+='<tr>'+
            '<td class="leftalign">'+String(i+1)+'</td>'+
            '<td class="leftalign">'+data[i].marka+'</td>'+
            '<td class="leftalign">'+data[i].part+'</td>'+
            '<td class="leftalign">'+data[i].rab+'</td>'+
            '<td class="leftalign">'+data[i].pal+'</td>'+
            '<td class="rightalign">'+locale.insNumber(data[i].kvo,1)+'</td>'+
        '</tr>';

        part_sum+=data[i].kvo;
        sum+=data[i].kvo;

        let is_end = (i==data.length-1);
        let print_itogo = is_end;
        if (!is_end) {
            print_itogo = by_rab ? (data[i].rab!=data[i+1].rab) : (data[i].part!=data[i+1].part);
        }
        if (print_itogo){
            let str = by_rab ? (data[i].rab) : (data[i].marka+' п. '+data[i].part);
            tbl+='<tr>'+
            '<td class="leftalign" colspan="5"><b>'+str+' итого</b></td>'+
            '<td class="rightalign"><b>'+locale.insNumber(part_sum,1)+'</b></td>'+
            '</tr>';
            part_sum=0.0;
        }
    }
    tbl+='<tr>'+
        '<td class="leftalign" colspan="5"><b>Итого</b></td>'+
        '<td class="rightalign"><b>'+locale.insNumber(sum,1)+'</b></td>'+
    '</tr>';
    tbl+='</table>';
    return tbl;
}

module.exports = function (app) {
    app.get("/elrtr/pack/packnakl/:dat/:id_src/:id_master/", async (req, res) => {
        let by_rab = !(typeof req.query.by_rab=="undefined" || req.query.by_rab=="false");
        db.one("select i.nakl_nam as oper, "+
            "(select rr.snam from kamin_empl rr where rr.id = $1 ) as from, "+
            "(select ne.nam  from nakl_emp ne where ne.id = 1) as to "+
            "from istoch i where i.id = $2"
            ,[ String(req.params["id_master"]), Number(req.params["id_src"]) ])
            .then((dataTitle) => {
                let sort = by_rab ? "rr.snam, e.marka, p.diam, date_part('year',p.dat_part), p.n_s, p2.nam" : "e.marka, p.diam, date_part('year',p.dat_part), p.n_s, rr.snam, p2.nam";
                db.any("select e.marka || ' ф ' || cast(p.diam as varchar(3)) as marka, "+
                    "p.n_s||'-'||date_part('year',p.dat_part) as part, rr.snam as rab, p2.nam as pal, epo.kvo as kvo "+
                    "from el_pallet_op epo "+
                    "inner join parti p on p.id=epo.id_parti "+
                    "inner join elrtr e on e.id=p.id_el "+
                    "inner join kamin_empl rr on rr.id=epo.id_rab "+
                    "inner join pallets p2 on p2.id = epo.id_pallet "+
                    "where epo.id_main_rab = $1 and epo.dtm ::date = $2 ::date and epo.id_src = $3 "+
                    "order by "+sort
                    , [ String(req.params["id_master"]), String(req.params["dat"]), Number(req.params["id_src"]) ] )
                    .then((data) => {
                        let date = new Date();
                        date.setTime(Date.parse(req.params["dat"]));
                        res.render(__dirname+"/../../../../views/nakl.hbs",{
                            title: "НАКЛАДНАЯ от "+locale.insDateLong(date),
                            head: "НАКЛАДНАЯ от "+locale.insDateLong(date),
                            oper: dataTitle.oper,
                            to: dataTitle.to,
                            from: dataTitle.from,
                            table: getTable(data,by_rab),
                            passed: dataTitle.from,
                            accepted: dataTitle.to
                        })
                    })
                    .catch((error) => {
                        console.log('ERROR:', error);
                        res.status(500).type('text/plain');
                        res.send(error.message);
                    }) 
            })
            .catch((error) => {
                console.log('ERROR:', error);
                res.status(500).type('text/plain');
                res.send(error.message);
            })            
    });     
 }
