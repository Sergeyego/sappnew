const odata = require('../../../odata/service.js');

class SyncCache {
    constructor() {
        this.emptyKey = "00000000-0000-0000-0000-000000000000";
        this.constKeys = new Map();
        this.partIstKeys = new Map();
        this.catalogTypeKeys = new Map();
        this.counterKeys = new Map();
        this.shipTypeKeys = new Map();
        this.zoneValues = new Map();
        this.catalogKeys = new Map();
        this.catalogPacks = new Map();
        this.catalogEans = new Map();
        this.catalogZoneOt = new Map();
    }

    // 1. Обновление базовых словарей (справочников)
    async updateDictionaries() {
        const fetchDict = async (obj, kF, vF) => {
            const res = await odata.get(`${obj}?$select=${kF},${vF}`);
            return new Map((res.value || []).map(i => [String(i[kF]), String(i[vF])]));
        };

        const [partIst, catalogType, counter, shipType, zone] = await Promise.all([
            fetchDict("Catalog_усИсточникиПартий", "Code", "Ref_Key"),
            fetchDict("Catalog_усВидыНоменклатуры", "Description", "Ref_Key"),
            fetchDict("Catalog_усКонтрагенты", "Code", "Ref_Key"),
            fetchDict("Catalog_усНаправлениеОтгрузки", "Description", "Ref_Key"),
            fetchDict("Catalog_усЗоны", "Description", "Ref_Key")
        ]);

        this.partIstKeys = partIst;
        this.catalogTypeKeys = catalogType;
        this.counterKeys = counter;
        this.shipTypeKeys = shipType;
        this.zoneValues = zone;
    }

    // 2. Обновление предопределенных констант
    async updateConstants() {
        const fetchMultipleKeys = async (obj, field, values) => {
            const filter = values.map(v => `${field} eq '${v}'`).join(' or ');
            const res = await odata.get(`${obj}?$select=Ref_Key,${field}&$filter=${filter}`);
            return new Map((res.value || []).map(i => [i[field], i.Ref_Key]));
        };

        const [nomKeys, stageKeys, modelKeys, statusKeys, unitKeys, orgKeys] = await Promise.all([
            fetchMultipleKeys("Catalog_усНоменклатура", "Description", ["Сварочные электроды", "Сварочная проволока"]),
            fetchMultipleKeys("Catalog_усСтадииПриемки", "Description", ["Базовая настройка"]),
            fetchMultipleKeys("Catalog_усМоделиУчетаНоменклатуры", "Description", ["Учет партий товара"]),
            fetchMultipleKeys("Catalog_усСтатусыНоменклатуры", "Description", ["Кондиция"]),
            fetchMultipleKeys("Catalog_усЕдиницыИзмерения", "Description", ["кг"]),
            fetchMultipleKeys("Catalog_Организации", "Code", ["000000001"])
        ]);

        this.constKeys.clear();
        this.constKeys.set("Сварочные электроды", nomKeys.get("Сварочные электроды") || this.emptyKey);
        this.constKeys.set("Сварочная проволока", nomKeys.get("Сварочная проволока") || this.emptyKey);
        this.constKeys.set("Базовая настройка", stageKeys.get("Базовая настройка") || this.emptyKey);
        this.constKeys.set("Учет партий товара", modelKeys.get("Учет партий товара") || this.emptyKey);
        this.constKeys.set("Кондиция", statusKeys.get("Кондиция") || this.emptyKey);
        this.constKeys.set("кг", unitKeys.get("кг") || this.emptyKey);
        this.constKeys.set("000000001", orgKeys.get("000000001") || this.emptyKey);
    }

    // 3. Обновление кэша Номенклатуры
    async updateCatalogKeys() {
        const cat = await odata.get("Catalog_усНоменклатура?$select=КодКИС,Ref_Key");
        this.catalogKeys = new Map((cat.value || []).map(i => [i.КодКИС, i.Ref_Key]));
    }

    // 4. Обновление кэша Упаковок
    async updateCatalogPacks() {
        const packs = await odata.get("Catalog_усУпаковкиНоменклатуры?$select=Owner_Key,Description,Ref_Key");
        this.catalogPacks.clear();
        (packs.value || []).forEach(item => {
            if (!item.Owner_Key) return;
            if (!this.catalogPacks.has(item.Owner_Key)) {
                this.catalogPacks.set(item.Owner_Key, []);
            }
            this.catalogPacks.get(item.Owner_Key).push({ nam: item.Description, id: item.Ref_Key });
        });
    }

    // 5. Обновление кэша Штрихкодов
    async updateCatalogEans() {
        const eans = await odata.get("InformationRegister_усШтрихкоды?$filter=like(Штрихкод,'4627120______')&$select=Номенклатура_Key,Штрихкод");
        this.catalogEans.clear();
        (eans.value || []).forEach(item => {
            if (!item.Номенклатура_Key) return;
            if (!this.catalogEans.has(item.Номенклатура_Key)) {
                this.catalogEans.set(item.Номенклатура_Key, new Set());
            }
            this.catalogEans.get(item.Номенклатура_Key).add(item.Штрихкод);
        });
    }

    // 6. Обновление кэша Зон отбора
    async updateCatalogZoneOt() {
        const zones = await odata.get("InformationRegister_усЗоныОтбора?$select=Номенклатура_Key,Зона_Key");
        this.catalogZoneOt.clear();
        (zones.value || []).forEach(item => {
            if (!item.Номенклатура_Key) return;
            if (!this.catalogZoneOt.has(item.Номенклатура_Key)) {
                this.catalogZoneOt.set(item.Номенклатура_Key, new Set());
            }
            this.catalogZoneOt.get(item.Номенклатура_Key).add(item.Зона_Key);
        });
    }

    // Метод для полной параллельной инициализации (заменяет старые методы)
    async updateAllData() {
        await Promise.all([
            this.updateDictionaries(),
            this.updateConstants(),
            this.updateCatalogKeys(),
            this.updateCatalogPacks(),
            this.updateCatalogEans(),
            this.updateCatalogZoneOt()
        ]);
    }

    packKey(ownerKey, nam) {
        const list = this.catalogPacks.get(ownerKey) || [];
        return list.find(p => p.nam === nam)?.id || this.emptyKey;
    }
}

module.exports = new SyncCache();