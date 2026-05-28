module.exports = function (app) {
    const db = require('../../../../postgres.js');
    const doc = require('../../../../invoice.js');
    app.get("/invoices/elrtr/warehouse/:typeId", async (req, res) => {
        db.one("select n.num as num, n.dat as dat, t.fnam as tnam, d.nam as dnam, ef.nam as efnam, et.nam as etnam from prod_nakl as n "+
            "inner join prod_nakl_tip as t on t.id=n.id_ist "+
            "inner join nakl_doc as d on t.id_doc=d.id "+
            "inner join nakl_emp as ef on t.id_from=ef.id "+
            "inner join nakl_emp as et on t.id_to=et.id "+
            "where n.id = $1 ", [ Number(req.params["typeId"]) ] )
            .then((dataTitle) => {
                //console.log('DATA:', dataTitle);
                let query = "select e.marka||' '||'ф'||p.diam || "+
                    "CASE WHEN p.id_var<>1 THEN ' /'||ev.nam ||'/' ELSE '' end "+
                    "||' ('||ep.pack_ed||')' as nam, p.n_s as npart, w.kvo as kvo from prod as w "+
                    "inner join parti as p on p.id=w.id_part "+
                    "inner join elrtr as e on e.id=p.id_el "+
                    "inner join el_pack as ep on ep.id=p.id_pack "+
                    "inner join elrtr_vars ev on ev.id = p.id_var "+
                    "where w.id_nakl = $1 order by w.id";
                db.any(query, [ Number(req.params["typeId"]) ] )
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