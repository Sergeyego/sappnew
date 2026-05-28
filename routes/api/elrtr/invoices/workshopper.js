module.exports = function (app) {
    const db = require('../../../../postgres.js');
    const doc = require('../../../../invoice.js');
    app.get("/invoices/elrtr/workshopper/:beg/:end", async (req, res) => {
        db.one("select date_part('month',$2::date)  as num, NULL as dat, t.nam as tnam, d.nam as dnam, ef.nam as efnam, et.nam as etnam, "+
            "to_char($1::date, 'DD.MM.YYYY')||'-'||to_char($2::date, 'DD.MM.YYYY') as period "+
            "from parti_nakl_tip as t "+
            "inner join nakl_doc as d on t.id_doc=d.id "+
            "inner join nakl_emp as ef on t.id_from=ef.id "+ 
            "inner join nakl_emp as et on t.id_to=et.id "+
            "where t.id = 2", [ String(req.params["beg"]), String(req.params["end"]) ] )
            .then((dataTitle) => {
                //console.log('DATA:', dataTitle);
                let query = "select e.marka||' '||'ф'||p.diam || "+
                    "CASE WHEN p.id_var<>1 THEN ' /'||ev.nam ||'/' ELSE '' END ||' ('||ep.pack_ed||')' as nam, "+
                    "NULL as npart, sum(w.kvo) as kvo from parti_break as w "+
                    "inner join parti_nakl pn on pn.id = w.id_nakl "+
                    "inner join parti as p on p.id=w.id_part "+
                    "inner join el_pack as ep on ep.id=p.id_pack "+
                    "inner join elrtr as e on e.id=p.id_el "+
                    "inner join elrtr_vars ev on ev.id = p.id_var "+
                    "where pn.dat between $1::date and $2::date "+
                    "group by e.marka, p.diam, ev.nam , p.id_var, ep.pack_ed "+
                    "order by nam";
                db.any(query, [ String(req.params["beg"]), String(req.params["end"]) ])
                    .then((dataItems) =>{
                        //console.log('DATA:', dataItems);
                        doc.createDoc(dataTitle,dataItems)
                        .then((b64string)=>{
                            res.setHeader('Content-Disposition', 'attachment; filename=invioce.docx');
                            res.send(Buffer.from(b64string, 'base64'));
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
            })
            .catch((error) => {
                console.log('ERROR:', error);
                res.status(500).type('text/plain');
                res.send(error.message);
            })       
    })
}