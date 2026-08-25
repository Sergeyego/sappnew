const odata = require('../../../odata/service.js');

class SyncCache {
    constructor() {
        this.emptyKey = "00000000-0000-0000-0000-000000000000";
        this.constKeys = new Map();
        this.partIstKeys = new Map();
        this.catalogTypeKeys = new Map();
        this.counterKeys = new Map();
        this.postIstKeys = new Map();
        this.shipTypeKeys = new Map();
        this.zoneValues = new Map();
        this.catalogKeys = new Map();
        this.catalogPacks = new Map();
        this.catalogEans = new Map();
        this.catalogZoneOt = new Map();
    }

    // Хелпер для обхода ограничения 1С OData в 1000 строк (Постраничная загрузка)
    async getAllPages(urlPath, selectAndFilter = "") {
        let allRecords = [];
        let skip = 0;
        const top = 1000;
        let hasMore = true;

        const separator = urlPath.includes('?') ? '&' : '?';

        while (hasMore) {
            const queryUrl = `${urlPath}${separator}${selectAndFilter ? selectAndFilter + '&' : ''}$top=${top}&$skip=${skip}`;
            const res = await odata.get(queryUrl);
            const batch = res.value || [];
            allRecords = allRecords.concat(batch);
            
            if (batch.length < top) {
                hasMore = false;
            } else {
                skip += top;
            }
        }
        return allRecords;
    }

    // 1. Обновление базовых словарей (справочников)
    async updateDictionaries() {
        const fetchDict = async (obj, kF, vF) => {
            const records = await this.getAllPages(obj, `$select=${kF},${vF}`);
            return new Map(records.map(i => [String(i[kF]), String(i[vF])]));
        };

        const [partIst, postIst, catalogType, counter, shipType, zone] = await Promise.all([
            fetchDict("Catalog_усИсточникиПартий", "Code", "Ref_Key"),
            fetchDict("Catalog_усИсточникиПоступления", "Description", "Ref_Key"),
            fetchDict("Catalog_усВидыНоменклатуры", "Description", "Ref_Key"),
            fetchDict("Catalog_усКонтрагенты", "Code", "Ref_Key"),
            fetchDict("Catalog_усНаправлениеОтгрузки", "Description", "Ref_Key"),
            fetchDict("Catalog_усЗоны", "Description", "Ref_Key")
        ]);

        this.partIstKeys = partIst;
        this.postIstKeys = postIst;
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
        const records = await this.getAllPages("Catalog_усНоменклатура", "$select=КодКИС,Ref_Key");
        this.catalogKeys = new Map(records.map(i => [i.КодКИС, i.Ref_Key]));
    }

    // 4. Обновление кэша Упаковок
    async updateCatalogPacks() {
        const records = await this.getAllPages("Catalog_усУпаковкиНоменклатуры", "$select=Owner_Key,Description,Ref_Key");
        this.catalogPacks.clear();
        records.forEach(item => {
            if (!item.Owner_Key) return;
            if (!this.catalogPacks.has(item.Owner_Key)) {
                this.catalogPacks.set(item.Owner_Key, []);
            }
            this.catalogPacks.get(item.Owner_Key).push({ nam: item.Description, id: item.Ref_Key });
        });
    }

    // 5. Обновление кэша Штрихкодов
    async updateCatalogEans() {
        const records = await this.getAllPages("InformationRegister_усШтрихкоды", "$filter=like(Штрихкод,'4627120______')&$select=Номенклатура_Key,Штрихкод");
        this.catalogEans.clear();
        records.forEach(item => {
            if (!item.Номенклатура_Key) return;
            if (!this.catalogEans.has(item.Номенклатура_Key)) {
                this.catalogEans.set(item.Номенклатура_Key, new Set());
            }
            this.catalogEans.get(item.Номенклатура_Key).add(item.Штрихкод);
        });
    }

    // 6. Обновление кэша Зон отбора
    async updateCatalogZoneOt() {
        const records = await this.getAllPages("InformationRegister_усЗоныОтбора", "$select=Номенклатура_Key,Зона_Key");
        this.catalogZoneOt.clear();
        records.forEach(item => {
            if (!item.Номенклатура_Key) return;
            if (!this.catalogZoneOt.has(item.Номенклатура_Key)) {
                this.catalogZoneOt.set(item.Номенклатура_Key, new Set());
            }
            this.catalogZoneOt.get(item.Номенклатура_Key).add(item.Зона_Key);
        });
    }

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

    // Безопасный поиск с учетом обрезки до 25 символов и регистра
    packKey(ownerKey, nam) {
        const list = this.catalogPacks.get(ownerKey) || [];
        const safeNamLower = String(nam).substring(0, 25).trim().toLowerCase();
        
        return list.find(p => String(p.nam).trim().toLowerCase() === safeNamLower)?.id || this.emptyKey;
    }
}

module.exports = new SyncCache();