const db = require('../../../postgres.js');
const odata = require('../../../odata/service.js');
const cache = require('./cache.js');

// Хелпер для параллельного выполнения промисов пачками (чтобы не перегрузить сеть и 1С)
async function chunkPromises(promises, chunkSize = 20) {
    for (let i = 0; i < promises.length; i += chunkSize) {
        const chunk = promises.slice(i, i + chunkSize);
        await Promise.all(chunk.map(p => p()));
    }
}

class SyncCatalog {
    async process(qStr, qPack, qEan, pNam) {
        let catalogCount = 0;
        let packCount = 0;
        let eanCount = 0;

        const catalogRequests = [];
        const packRequests = [];
        const eanRequests = [];

        // 1. Номенклатура
        for (const r of await db.any(qStr)) {
            if (!cache.catalogKeys.has(r.kis)) {
                console.log("не найдено номенклатуры", r.nam);
                catalogRequests.push(() => odata.post("Catalog_усНоменклатура", {
                    Description: r.nam,
                    КодКИС: r.kis,
                    Parent_Key: cache.constKeys.get(pNam),
                    ВидНоменклатуры_Key: cache.catalogTypeKeys.get(pNam),
                    МодельУчета_Key: cache.constKeys.get("Учет партий товара"),
                    ЕдиницаИзмерения_Key: cache.constKeys.get("кг")
                }));
                catalogCount++;
            }
        }

        if (catalogRequests.length > 0) {
            await chunkPromises(catalogRequests);
            // Сразу локально обновляем кэш ключей номенклатуры, так как они нужны для упаковок ниже
            await cache.updateCatalogKeys();
        }

        // 2. Упаковки

        for (const p of await db.any(qPack)) {
            const nomK = cache.catalogKeys.get(p.kis);
            if (nomK) {
                // Отрезаем строго первые 25 символов, как это делает 1С
                // .trim() убирает пробелы, если они случайно оказались на стыке среза
                const safePackName = String(p.npack).substring(0, 25).trim();
                const dbPackNameLower = safePackName.toLowerCase();

                // Проверяем наличие в кэше, сравнивая уже с безопасным обрезанным именем
                const hasPack = (cache.catalogPacks.get(nomK) || []).some(ep =>
                    String(ep.nam).trim().toLowerCase() === dbPackNameLower
                );

                if (!hasPack) {
                    console.log("не найдено упаковки, создаем:", safePackName);
                    packRequests.push(() => odata.post("Catalog_усУпаковкиНоменклатуры", {
                        Description: safePackName, // Отправляем обрезанную строку
                        Owner_Key: nomK,
                        Коэффициент: Number(p.mass_ed),
                        Масса: 0,
                        ЕдиницаИзмерения_Key: cache.constKeys.get("кг"),
                        ТипГрузообработки: "Мелкий"
                    }));
                    packCount++;
                }
            }
        }

        if (packRequests.length > 0) {
            await chunkPromises(packRequests);
            // Обновляем кэш упаковок, он нужен для штрихкодов
            await cache.updateCatalogPacks();
        }

        // 3. Штрихкоды
        for (const e of await db.any(qEan)) {
            const nomK = cache.catalogKeys.get(e.kis);
            if (!nomK) continue;

            const pK = cache.packKey(nomK, e.npack);
            const cEans = cache.catalogEans.get(nomK) || new Set();

            if (e.ean_ed && !cEans.has(e.ean_ed)) {
                console.log("не найден штрихкод", e.ean_ed);
                eanRequests.push(() => odata.post("InformationRegister_усШтрихкоды", {
                    Номенклатура_Key: nomK,
                    УпаковкаНоменклатуры_Key: pK,
                    Количество: String(e.mass_ed),
                    Штрихкод: e.ean_ed
                }));
                eanCount++;
            }
            if (e.ean_group && !cEans.has(e.ean_group)) {
                console.log("не найден штрихкод", e.ean_group);
                eanRequests.push(() => odata.post("InformationRegister_усШтрихкоды", {
                    Номенклатура_Key: nomK,
                    УпаковкаНоменклатуры_Key: pK,
                    Количество: String(e.mass_group),
                    Штрихкод: e.ean_group
                }));
                eanCount++;
            }
        }

        if (eanRequests.length > 0) {
            await chunkPromises(eanRequests);
            // Кэш штрихкодов обновим один раз в самом конце метода sync()
        }

        return catalogCount + packCount + eanCount;
    }

    async sync(syncEl = true, syncWire = true) {
        let n = 0;

        if (syncEl) {
            const queryElCatalog = `select distinct ee.id_el||':'||ee.id_diam as kis, e.marka ||' ф '|| d.sdim as nam 
                from ean_el ee 
                inner join elrtr e on e.id = ee.id_el 
                inner  join diam d on d.id = ee.id_diam 
                order by e.marka ||' ф '|| d.sdim`;
            const queryElPack = `select distinct ee.id_el||':'||ee.id_diam as kis, ep.pack_ed||'/'||ep.pack_group as npack, ep.mass_ed as mass_ed
                from ean_el ee 
                inner join el_pack ep on ep.id = ee.id_pack 
                order by npack`;
            const queryElEan = `select distinct ee.id_el||':'||ee.id_diam as kis, ep.pack_ed||'/'||ep.pack_group as npack, 
                ee.ean_ed as ean_ed, ee.ean_group as ean_group, ep.mass_ed as mass_ed, ep.mass_group as mass_group 
                from ean_el ee 
                inner join el_pack ep on ep.id = ee.id_pack 
                order by npack`;
            n += await this.process(queryElCatalog, queryElPack, queryElEan, "Сварочные электроды");
        }

        if (syncWire) {
            const queryWireCatalog = `select distinct we.id_prov ||':'||we.id_diam ||':'||we.id_spool as kis, p.nam ||' ф '|| d.sdim||' '||wpk.short as nam 
                from wire_ean we 
                inner join provol p on p.id=we.id_prov 
                inner  join diam d on d.id = we.id_diam 
                inner join wire_pack_kind wpk on wpk.id = we.id_spool 
                order by nam`;
            const queryWirePack = `select distinct we.id_prov ||':'||we.id_diam||':'||we.id_spool as kis, 
                wp.pack_ed as npack, 
                wp.mas_ed as mass_ed
                from wire_ean we 
                inner join wire_pack wp on wp.id = we.id_pack 
                order by wp.pack_ed`;
            const queryWireEan = `select distinct we.id_prov ||':'||we.id_diam||':'||we.id_spool as kis, 
                CASE WHEN wp.pack_group<>'-' THEN wp.pack_ed||'/'||wp.pack_group ELSE wp.pack_ed end as npack, 
                we.ean_ed as ean_ed, we.ean_group as ean_group, wp.mas_ed as mass_ed, wp.mas_group as mass_group  
                from wire_ean we 
                inner join wire_pack wp on wp.id = we.id_pack 
                order by npack`;
            n += await this.process(queryWireCatalog, queryWirePack, queryWireEan, "Сварочная проволока");
        }

        // 4. Синхронизация Зон отбора
        const zRows = await db.any("SELECT wz.nam, wzo.prefix FROM warehouse_zone_ot wzo INNER JOIN warehouse_zone wz ON wz.id = wzo.id_zone");

        // Разбиваем зоны на две группы заранее
        const zonesE = zRows.filter(r => r.prefix === 'e');
        const zonesW = zRows.filter(r => r.prefix === 'w');

        const zoneRequests = [];

        for (const [kis, nomK] of cache.catalogKeys.entries()) {
            const isElectrodes = kis.split(':').length === 2;
            const targetZones = isElectrodes ? zonesE : zonesW;
            const currentZones = cache.catalogZoneOt.get(nomK) || new Set();

            for (const z of targetZones) {
                const zK = cache.zoneValues.get(z.nam);
                if (zK && !currentZones.has(zK)) {
                    console.log("не найдено зоны", z.nam);
                    zoneRequests.push(() => odata.post("InformationRegister_усЗоныОтбора", {
                        Номенклатура_Key: nomK,
                        ТипЗоны: "ОтборМелкий",
                        Зона_Key: zK,
                        Организация_Key: "00000000-0000-0000-0000-000000000000",
                        МинимальноеКоличествоКонтейнеров: 0,
                        МаксимальноеКоличествоКонтейнеров: 999,
                        МинимальныйОстатокВКонтейнере: 0,
                        УпаковкаНоменклатуры_Key: "00000000-0000-0000-0000-000000000000",
                        МинимальныйОстатокВКонтейнереВУпаковках: 0,
                        МинимальноеКоличествоТоваров: 0,
                        МаксимальноеКоличествоТоваров: 0
                    }));
                    n++;
                }
            }
        }

        if (zoneRequests.length > 0) {
            await chunkPromises(zoneRequests);
        }

        // Финальное параллельное обновление всего измененного кэша
        await Promise.all([
            cache.updateCatalogEans(),
            cache.updateCatalogZoneOt()
        ]);

        return n;
    }
}

module.exports = new SyncCatalog();