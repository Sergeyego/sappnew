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

    async partiKey(ownerKey, desc) {
        const res = await odata.get(`Catalog_усПартииНоменклатуры?$select=Ref_Key&$filter=Description eq '${desc}' and Owner_Key eq guid'${ownerKey}'`);
        return res.value?.[0]?.Ref_Key || cache.emptyKey;
    }

    async syncPart(queryPart) {
        const rows = await db.any(queryPart);
        const mapPart = new Map();
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

            let key = await this.partiKey(nomK, desc);
            if (key === cache.emptyKey) {
                key = (await odata.post("Catalog_усПартииНоменклатуры", body)).Ref_Key;
                console.log("партия не найдена", desc);
            } else {
                await odata.patch(`Catalog_усПартииНоменклатуры(guid'${key}')`, body);
                console.log("партия найдена", desc);
            }
            mapPart.set(r.id_part_kis, key);
        }
        return mapPart;
    }

    async syncCatalog(syncEl = true, syncWire = true) {
        return await catalog.sync(syncEl, syncWire);
    }

    async syncPriemEl(idDoc) {
        await this.syncCatalog(true, false);

        const queryPart = `select distinct 'e:'||p2.id_part as id_part_kis, p.id_el ||':'||(select id from diam as d where d.diam=p.diam) as kis, 
            p.n_s as n_s, p.dat_part as dat_part, i.key1c as id_ist, p.prim_prod as prim, rn.nam as rcpplav
            from prod p2 
            inner join parti p on p.id = p2.id_part 
            inner join istoch i on i.id = p.id_ist 
            left join rcp_nam rn on rn.id = p.id_rcp 
            where p2.id_nakl = ${idDoc}`;
        const partCache = await this.syncPart(queryPart);
        //console.log(partCache);

        const queryDoc = `select pn.id as id, pnt.prefix||date_part('year',pn.dat)||'-'||pn.num as num, pn.dat as dat, 
            pnt.nam as ist, pnt.codfrom as codfrom, pnt.codto as codto
            from prod_nakl pn 
            inner join prod_nakl_tip pnt on pnt.id = pn.id_ist 
            where pn.id = ${idDoc}`;
        const queryDocCont = `select 'e:'||p2.id_part as id_part_kis, 
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
        return await docs.syncOpDoc(queryDoc, queryDocCont, partCache);
    }

    async syncPriemWire(idDoc) {
        await this.syncCatalog(false, true);
        const queryPart = `select distinct 'w:'||wp.id as id_part_kis, wpm.id_provol||':'||wpm.id_diam||':'||wp.id_pack as kis, 
            wpm.n_s as n_s, wpm.dat as dat_part, ws.key1c as id_ist, wp.prim_prod as prim, pb.n_plav as rcpplav 
            from wire_warehouse ww 
            inner join wire_parti wp on wp.id = ww.id_wparti 
            inner join wire_parti_m wpm on wpm.id = wp.id_m 
            inner join wire_source ws on ws.id = wpm.id_source 
            inner join  prov_buht pb on pb.id = wpm.id_buht 
            where ww.id_waybill = ${idDoc}`;
        const partCache = await this.syncPart(queryPart);
        const queryDoc = `select www.id as id, wwbt.prefix||date_part('year',www.dat)||'-'||www.num as num, www.dat as dat, 
            wwbt.nam as ist, wwbt.codfrom as codfrom, wwbt.codto as codto
            from wire_whs_waybill www 
            inner join wire_way_bill_type wwbt on wwbt.id = www.id_type 
            where www.id = ${idDoc}`;
        const queryDocCont = `select 'w:'||ww.id_wparti as id_part_kis, wpm.id_provol ||':'||wpm.id_diam||':'||p.id_pack as kis, 
            wpm.n_s as n_s, wpm.dat as dat_part, 
            wp.pack_ed as pack, 
            wp.mas_ed as mass_ed, ww.m_netto as kvo, 
            wwbt.prefix ||date_part('year',www.dat) ||'-'||www.num ||'-'||ww.numcont as numcont, 
            ww.pack_kvo as shtuk, ww.barcodecont as barcodecont 
            from wire_warehouse ww 
            inner join wire_whs_waybill www on www.id = ww.id_waybill 
            inner join wire_way_bill_type wwbt on wwbt.id = www.id_type 
            inner join wire_parti p on p.id = ww.id_wparti 
            inner join wire_parti_m wpm on wpm.id = p.id_m 
            inner join wire_pack wp on wp.id = p.id_pack_type 
            where ww.id_waybill = ${idDoc}
            order by ww.id`;
        return await docs.syncOpDoc(queryDoc, queryDocCont, partCache);
    }

    async syncShip(idShip) {
        await this.syncCatalog(true, true);
        return await docs.syncShipDoc(idShip);
    }
}

module.exports = new SyncService();