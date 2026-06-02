module.exports = function (app) {
    const db = require('../../../../postgres.js');
    const doc = require('../../../../invoice.js');
    app.get("/elrtr/invoices/perepack/:invId", async (req, res) => {
        db.one("select n.num as num, n.dat as dat, t.nam as tnam, d.nam as dnam, ef.nam as efnam, et.nam as etnam from parti_nakl as n "+
                "inner join parti_nakl_tip as t on t.id=n.tip "+
                "inner join nakl_doc as d on t.id_doc=d.id "+
                "inner join nakl_emp as ef on t.id_from=ef.id "+
                "inner join nakl_emp as et on t.id_to=et.id "+
                "where n.id = $1 "
            , [ Number(req.params["invId"]) ] )
            .then((dataTitle) => {
                //console.log('DATA:', dataTitle);
                let query = "select 'из '||e.marka||' '||'ф'||p.diam|| "+
                            "CASE WHEN p.id_var<>1 THEN ' /'||ev.nam ||'/' ELSE '' end "+
                            "||' ('||ep.pack_ed||')'|| CASE WHEN (np.id=0) THEN '' ELSE '\nв '||ne.marka||' '||'ф'|| np.diam || "+
                            "CASE WHEN np.id_var<>1 THEN ' /'||ev2.nam ||'/' ELSE '' end "+
                            "||' ('||nep.pack_ed||')'||'' END as nam, "+
                            "'из ' || p.n_s || CASE WHEN (np.id=0) THEN '' ELSE '\nв '||np.n_s END as npart, w.kvo as kvo, w.kvo_break as break from parti_perepack as w "+
                            "inner join parti as p on p.id=w.id_part "+
                            "inner join el_pack as ep on ep.id=p.id_pack "+
                            "inner join elrtr as e on e.id=p.id_el "+
                            "inner join parti as np on np.id=w.id_new_part "+
                            "inner join el_pack as nep on nep.id=np.id_pack "+
                            "inner join elrtr as ne on ne.id=np.id_el "+
                            "inner join elrtr_vars ev on ev.id = p.id_var "+
                            "inner join elrtr_vars ev2 on ev2.id = np.id_var "+
                            "where w.id_nakl = $1 order by w.id";
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