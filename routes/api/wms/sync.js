const db = require('../../../postgres.js');
const odata = require('../../../odata/service.js');
const cache = require('./cache.js');
const helpers = require('./helpers.js');
const catalog = require('./catalog.js');
const docs = require('./documents.js');

class SyncService {
    async loadSettings(idBase = 1) {
        const cfg = await db.oneOrNone("SELECT url, usr, pass FROM warehouse_data WHERE id = $1", [idBase]);
        if (!cfg) throw new Error("Конфигурация WMS базы не найдена.");
        odata.init(cfg.url, cfg.usr, cfg.pass);
        await cache.updateAllData();
    }

    async syncPart(queryPart) {
        const rows = await db.any(queryPart);
    for (const r of rows) {
        // Создаем объект даты
        const dateObj = new Date(r.dat_part);
        
        // Формируем год для desc
        const year = dateObj.getFullYear();
        const desc = `${r.n_s}-${year}`;
        
        const nomK = cache.catalogKeys.get(r.kis);
        if (!nomK) continue;

        // Корректно форматируем локальную дату в YYYY-MM-DD
        const formattedDate = helpers.getFormattedDate(dateObj);

        const body = { 
            КодКис: String(r.id_part_kis), 
            Description: desc, 
            Code: desc,
            Owner_Key: nomK, 
            ДатаПартии: formattedDate, 
            ДатаПроизводства: formattedDate, 
            СрокГодности: formattedDate, 
            Источник_Key: cache.partIstKeys.get(String(r.id_ist)) || cache.emptyKey,
            Комментарий: r.prim || "",
            РецептураПлавка: r.rcpplav || ""
        };
        
        const key = await helpers.partiKey(nomK, desc);
        if (key === cache.emptyKey) {
            await odata.post("Catalog_усПартииНоменклатуры", body);
            console.log("партия не найдена", desc);
        } else {
            await odata.patch(`Catalog_усПартииНоменклатуры(guid'${key}')`, body);
            console.log("партия найдена", desc);
        }
    }
    }

    async syncCatalog(syncEl = true, syncWire = true) { 
        return catalog.sync(syncEl, syncWire);
    }

    async syncPriemEl(idDoc) {
        await this.syncCatalog(true,false);

        const queryPart=`select distinct 'e:'||p2.id_part as id_part_kis, p.id_el ||':'||(select id from diam as d where d.diam=p.diam) as kis, 
            p.n_s as n_s, p.dat_part as dat_part, i.key1c as id_ist, p.prim_prod as prim, rn.nam as rcpplav
            from prod p2 
            inner join parti p on p.id = p2.id_part 
            inner join istoch i on i.id = p.id_ist 
            left join rcp_nam rn on rn.id = p.id_rcp 
            where p2.id_nakl = ${idDoc}`;
        await this.syncPart(queryPart);

        const queryDoc=`select pn.id as id, pnt.prefix||date_part('year',pn.dat)||'-'||pn.num as num, pn.dat as dat, 
            pnt.nam as ist, pnt.codfrom as codfrom, pnt.codto as codto
            from prod_nakl pn 
            inner join prod_nakl_tip pnt on pnt.id = pn.id_ist 
            where pn.id = ${idDoc}`;
        const queryDocCont=`select 'e:'||p2.id_part as id_part_kis, 
            p.id_el ||':'||(select id from diam as d where d.diam=p.diam) as kis, 
            p.n_s as n_s, p.dat_part as dat_part, ep.pack_ed||'/'||ep.pack_group as pack, 
            ep.mass_ed as mass_ed, p2.kvo as kvo, 
            pnt.prefix ||date_part('year',pn.dat) ||'-'||pn.num ||'-'||p2.numcont as numcont, 
            p2.shtuk as shtuk, p2.barcodecont as barcodecont
            from prod p2 
            inner join prod_nakl pn on pn.id = p2.id_nakl 
            inner join prod_nakl_tip pnt on pnt.id = pn.id_ist 
            inner join parti p on p.id = p2.id_part 
            inner join el_pack ep on ep.id = p.id_pack 
            where p2.id_nakl = ${idDoc} 
            order by p2.id`;
        //await helpers.checkEan(`SELECT id, ean_pallet FROM prod WHERE id_nakl = ${idDoc}`, "UPDATE prod SET ean_pallet = $1 WHERE id = $2");
        return await docs.syncOpDoc(queryDoc, queryDocCont);
    }

    async syncPriemWire(idDoc) {
        await this.syncCatalog(false,true);
        await this.syncPart(`SELECT 'w:'||p2.id_part as id_part_kis, w.id_wire||':'||w.id_diam||':'||w.id as kis, p.n_s, p.dat_part, p.id_ist FROM prod_wire p2 INNER JOIN parti_wire p ON p.id = p2.id_part INNER JOIN wire_pack w ON w.id = p2.id_pack WHERE p2.id_nakl = ${idDoc}`);
        //await helpers.checkEan(`SELECT id, ean_pallet FROM prod_wire WHERE id_nakl = ${idDoc}`, "UPDATE prod_wire SET ean_pallet = $1 WHERE id = $2");
        return await docs.syncOpDoc(`SELECT nn, dat, id_ist FROM nakl_wire WHERE id = ${idDoc}`, `SELECT 'w:'||p2.id_part as id_part_kis, w.id_wire||':'||w.id_diam||':'||w.id as kis, w.npack, sum(p2.massa) as massa FROM prod_wire p2 INNER JOIN wire_pack w ON w.id = p2.id_pack WHERE p2.id_nakl = ${idDoc} GROUP BY p2.id_part, w.id_wire, w.id_diam, w.id, w.npack`);
    }

    async syncShip(idShip) {
        await this.syncCatalog(true,true);
        return await docs.syncShipDoc(idShip); 
    }
}

module.exports = new SyncService();