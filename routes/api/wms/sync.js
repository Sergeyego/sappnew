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
            const desc = `${r.n_s}-${new Date(r.dat_part).getFullYear()}`, nomK = cache.catalogKeys.get(r.kis); if (!nomK) continue;
            const body = { КодКис: String(r.id_part_kis), Description: desc, Owner_Key: nomK, ДатаПартии: new Date(r.dat_part).toISOString().substring(0, 10) + "T00:00:00", Источник_Key: cache.partIstKeys.get(String(r.id_ist)) || cache.emptyKey };
            const key = await helpers.partiKey(nomK, desc);
            if (key === cache.emptyKey) await odata.post("Catalog_усПартииНоменклатуры", body);
            else await odata.patch(`Catalog_усПартииНоменклатуры(guid'${key}')`, body);
        }
    }

    async syncCatalog(syncEl = true, syncWire = true) { 
        return catalog.sync(syncEl, syncWire); 
    }

    async syncPriemEl(idDoc) {
        await cache.updateCatalogData();
        await this.syncPart(`SELECT 'e:'||p2.id_part as id_part_kis, p.id_el||':'||(SELECT id FROM diam WHERE diam=p.diam) as kis, p.n_s, p.dat_part, p.id_ist FROM prod p2 INNER JOIN parti p ON p.id = p2.id_part WHERE p2.id_nakl = ${idDoc}`);
        await helpers.checkEan(`SELECT id, ean_pallet FROM prod WHERE id_nakl = ${idDoc}`, "UPDATE prod SET ean_pallet = $1 WHERE id = $2");
        return await docs.syncOpDoc(`SELECT nn, dat, id_ist FROM nakl WHERE id = ${idDoc}`, `SELECT 'e:'||p2.id_part as id_part_kis, p.id_el||':'||(SELECT id FROM diam WHERE diam=p.diam) as kis, ep.npack, sum(p2.massa) as massa FROM prod p2 INNER JOIN parti p ON p.id = p2.id_part INNER JOIN el_pack ep ON ep.id = p2.id_pack WHERE p2.id_nakl = ${idDoc} GROUP BY p2.id_part, p.id_el, p.diam, ep.npack`);
    }

    async syncPriemWire(idDoc) {
        await cache.updateCatalogData();
        await this.syncPart(`SELECT 'w:'||p2.id_part as id_part_kis, w.id_wire||':'||w.id_diam||':'||w.id as kis, p.n_s, p.dat_part, p.id_ist FROM prod_wire p2 INNER JOIN parti_wire p ON p.id = p2.id_part INNER JOIN wire_pack w ON w.id = p2.id_pack WHERE p2.id_nakl = ${idDoc}`);
        await helpers.checkEan(`SELECT id, ean_pallet FROM prod_wire WHERE id_nakl = ${idDoc}`, "UPDATE prod_wire SET ean_pallet = $1 WHERE id = $2");
        return await docs.syncOpDoc(`SELECT nn, dat, id_ist FROM nakl_wire WHERE id = ${idDoc}`, `SELECT 'w:'||p2.id_part as id_part_kis, w.id_wire||':'||w.id_diam||':'||w.id as kis, w.npack, sum(p2.massa) as massa FROM prod_wire p2 INNER JOIN wire_pack w ON w.id = p2.id_pack WHERE p2.id_nakl = ${idDoc} GROUP BY p2.id_part, w.id_wire, w.id_diam, w.id, w.npack`);
    }

    async syncShip(idShip) { await cache.updateCatalogData(); return await docs.syncShipDoc(idShip); }
}

module.exports = new SyncService();