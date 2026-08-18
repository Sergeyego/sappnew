const db = require('../../../postgres.js');
const odata = require('../../../odata/service.js');
const cache = require('./cache.js');

class SyncCatalog {
    async process(qStr, qPack, qEan, pNam, tNam) {
        let n = 0;
        for (const r of await db.any(qStr)) {
            if (!cache.catalogKeys.has(r.kis)) {
                await odata.post("Catalog_усНоменклатура", {
                    Description: r.nam, КодКИС: r.kis, Parent_Key: cache.constKeys.get(pNam),
                    ВидНоменклатуры_Key: cache.catalogTypeKeys.get(tNam), 
                    МодельУчета_Key: cache.constKeys.get("Учет партий товара"), ЕдиницаИзмерения_Key: cache.constKeys.get("кг")
                });
                n++;
            }
        }
        await cache.updateCatalogData();

        for (const p of await db.any(qPack)) {
            const nomK = cache.catalogKeys.get(p.kis);
            if (nomK && !(cache.catalogPacks.get(nomK) || []).some(ep => ep.nam === p.npack)) {
                await odata.post("Catalog_усУпаковкиНоменклатуры", { Description: p.npack, Owner_Key: nomK, Коэффициент: Number(p.mass_ed), Масса: 0, ЕдиницаИзмерения_Key: cache.constKeys.get("кг"), ТипГрузообработки: "Мелкий" });
                n++;
            }
        }
        await cache.updateCatalogData();

        for (const e of await db.any(qEan)) {
            const nomK = cache.catalogKeys.get(e.kis); if (!nomK) continue;
            const pK = cache.packKey(nomK, e.npack), cEans = cache.catalogEans.get(nomK) || new Set();
            if (e.ean_ed && !cEans.has(e.ean_ed)) { await odata.post("InformationRegister_усШтрихкоды", { Номенклатура_Key: nomK, УпаковкаНоменклатуры_Key: pK, Количество: String(e.mass_ed), Штрихкод: e.ean_ed }); n++; }
            if (e.ean_group && !cEans.has(e.ean_group)) { await odata.post("InformationRegister_усШтрихкоды", { Номенклатура_Key: nomK, УпаковкаНоменклатуры_Key: pK, Количество: String(e.mass_group), Штрихкод: e.ean_group }); n++; }
        }
        return n;
    }

    async sync(syncEl = true, syncWire = true) {
        await cache.updateCatalogData();
        let n = 0;
        /*if (syncEl) n += await this.process("SELECT e.nam || ' d.' || d.diam as nam, e.id || ':' || d.id as kis FROM el e CROSS JOIN diam d WHERE e.act=true ORDER BY e.nam, d.diam", "SELECT e.id || ':' || d.id as kis, ep.npack, ep.mass_ed FROM el_pack ep INNER JOIN el e ON e.id = ep.id_el CROSS JOIN diam d WHERE e.act=true", "SELECT e.id || ':' || d.id as kis, ep.npack, ee.ean_ed, ee.ean_group, ep.mass_ed, ep.mass_group FROM el_ean ee INNER JOIN el_pack ep ON ep.id = ee.id_pack INNER JOIN el e ON e.id = ep.id_el INNER JOIN diam d ON d.id = ee.id_diam WHERE e.act=true", "Сварочные электроды", "Товар");
        if (syncWire) n += await this.process("SELECT w.nam || ' d.' || d.diam || ' ' || cast(wp.npack as text) as nam, w.id || ':' || d.id || ':' || wp.id as kis FROM wire_pack wp INNER JOIN wire w ON w.id = wp.id_wire INNER JOIN diam d ON d.id = wp.id_diam WHERE w.act=true ORDER BY w.nam, d.diam, wp.npack", "SELECT w.id || ':' || d.id || ':' || wp.id as kis, wp.npack, wp.mass_ed FROM wire_pack wp INNER JOIN wire w ON w.id = wp.id_wire INNER JOIN diam d ON d.id = wp.id_diam WHERE w.act=true", "SELECT w.id || ':' || d.id || ':' || wp.id as kis, wp.npack, wp.ean_ed, wp.ean_group, wp.mass_ed, wp.mass_ed as mass_group FROM wire_pack wp INNER JOIN wire w ON w.id = wp.id_wire INNER JOIN diam d ON d.id = wp.id_diam WHERE w.act=true", "Сварочная проволока", "Товар");

        const zRows = await db.any("SELECT wz.nam, wzo.prefix FROM warehouse_zone_ot wzo INNER JOIN warehouse_zone wz ON wz.id = wzo.id_zone");
        for (const [kis, nomK] of cache.catalogKeys.entries()) {
            for (const z of zRows.filter(r => r.prefix === (kis.split(':').length === 2 ? 'e' : 'w'))) {
                const zK = cache.zoneValues.get(z.nam);
                if (zK && !(cache.catalogZoneOt.get(nomK) || new Set()).has(zK)) {
                    await odata.post("InformationRegister_усЗоныОтбора", { Номенклатура_Key: nomK, ТипЗоны: "ОтборМелкий", Зона_Key: zK });
                    n++;
                }
            }
        }*/
        return n;
    }
}
module.exports = new SyncCatalog();