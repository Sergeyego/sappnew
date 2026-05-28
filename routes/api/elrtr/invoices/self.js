module.exports = function (app) {
    const db = require('../../../../postgres.js');
    const doc = require('../../../../invoice.js');
    app.get("/invoices/elrtr/self/:invId", async (req, res) => {
        db.one("select n.num as num, n.dat as dat, n.kto as tnam, nd.nam as dnam , ne.nam as efnam, ne2.nam as etnam "+
                "from prod_self as n "+
                "inner join self_cons sc on sc.id = n.id_cons "+
                "inner join nakl_doc nd on nd.id = sc.id_doc "+
                "inner join nakl_emp ne on ne.id = sc.id_from "+
                "inner join nakl_emp ne2 on ne2.id = sc.id_to "+
                "where n.id = $1 "
            , [ Number(req.params["invId"]) ] )
            .then((dataTitle) => {
                //console.log('DATA:', dataTitle);
                let query = "select e.marka||' '||'ф'||p.diam || "+
                    "CASE WHEN p.id_var<>1 THEN ' /'||ev.nam ||'/' ELSE '' end "+
                    "||' ('||ep.pack_ed||')' as nam, p.n_s as npart, w.kvo as kvo from prod_self_items as w "+
                    "inner join parti as p on p.id=w.id_part "+
                    "inner join elrtr as e on e.id=p.id_el "+
                    "inner join el_pack as ep on ep.id=p.id_pack "+
                    "inner join elrtr_vars ev on ev.id = p.id_var "+
                    "where w.id_self = $1 order by w.id_part";
                db.any(query, [ Number(req.params["invId"]) ] )
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