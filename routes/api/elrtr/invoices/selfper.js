module.exports = function (app) {
    const db = require('../../../../postgres.js');
    const doc = require('../../../../invoice.js');
    app.get("/invoices/elrtr/selfper/:type/:beg/:end", async (req, res) => {
        db.one("select date_part('month',$2::date)  as num, NULL as dat, sc.nam  as tnam, nd.nam as dnam, ne.nam as efnam, ne2.nam as etnam, "+
            "to_char($1::date, 'DD.MM.YYYY')||'-'||to_char($2::date, 'DD.MM.YYYY') as period "+
            "from self_cons sc "+
            "inner join nakl_doc nd on nd.id = sc.id_doc "+
            "inner join nakl_emp ne on ne.id = sc.id_from "+
            "inner join nakl_emp ne2 on ne2.id = sc.id_to "+
            "where sc.id = $3", [ String(req.params["beg"]), String(req.params["end"]), Number(req.params["type"]) ] )
            .then((dataTitle) => {
                //console.log('DATA:', dataTitle);
                let query = "select e.marka||' '||'ф'||p.diam || "+
                            "CASE WHEN p.id_var<>1 THEN ' /'||ev.nam ||'/' ELSE '' END ||' ('||ep.pack_ed||')' as nam, "+
                            "NULL as npart, sum(psi.kvo) as kvo from prod_self_items psi "+
                            "inner join prod_self ps on ps.id = psi.id_self "+
                            "inner join parti as p on p.id=psi.id_part "+
                            "inner join elrtr as e on e.id=p.id_el "+
                            "inner join el_pack as ep on ep.id=p.id_pack "+
                            "inner join elrtr_vars ev on ev.id = p.id_var "+
                            "where ps.id_cons = $3 and ps.dat between $1::date and $2::date "+
                            "group by e.marka, p.diam, ev.nam , p.id_var, ep.pack_ed "+
                            "order by nam";
                db.any(query, [ String(req.params["beg"]), String(req.params["end"]), Number(req.params["type"]) ])
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