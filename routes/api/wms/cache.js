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

    async updateKeys() {
        const fetchDict = async (obj, kF, vF) => {
            const res = await odata.get(obj);
            return new Map((res.value || []).map(i => [String(i[kF]), String(i[vF])]));
        };

        this.partIstKeys = await fetchDict("Catalog_усИсточникиПартий", "Code", "Ref_Key");
        this.catalogTypeKeys = await fetchDict("Catalog_усВидыНоменклатуры", "Description", "Ref_Key");
        this.counterKeys = await fetchDict("Catalog_усКонтрагенты", "Code", "Ref_Key");
        this.shipTypeKeys = await fetchDict("Catalog_усНаправлениеОтгрузки", "Description", "Ref_Key");
        this.zoneValues = await fetchDict("Catalog_усЗоны", "Description", "Ref_Key");

        const getSingleKey = async (obj, nam, param) => {
            const res = await odata.get(`${obj}?$select=Ref_Key&$filter=${param} eq '${nam}'`);
            return res.value?.[0]?.Ref_Key || this.emptyKey;
        };

        this.constKeys.clear();
        this.constKeys.set("Сварочные электроды", await getSingleKey("Catalog_усНоменклатура", "Сварочные электроды", "Description"));
        this.constKeys.set("Сварочная проволока", await getSingleKey("Catalog_усНоменклатура", "Сварочная проволока", "Description"));
        this.constKeys.set("Базовая настройка", await getSingleKey("Catalog_усСтадииПриемки", "Базовая настройка", "Description"));
        this.constKeys.set("Учет партий товара", await getSingleKey("Catalog_усМоделиУчетаНоменклатуры", "Учет партий товара", "Description"));
        this.constKeys.set("Кондиция", await getSingleKey("Catalog_усСтатусыНоменклатуры", "Кондиция", "Description"));
        this.constKeys.set("кг", await getSingleKey("Catalog_усЕдиницыИзмерения", "кг", "Description"));
        this.constKeys.set("000000001", await getSingleKey("Catalog_Организации", "000000001", "Code"));
    }

    async updateCatalogData() {
        const cat = await odata.get("Catalog_усНоменклатура");
        this.catalogKeys = new Map((cat.value || []).map(i => [i.КодКИС, i.Ref_Key]));

        const packs = await odata.get("Catalog_усУпаковкиНоменклатуры");
        this.catalogPacks.clear();
        (packs.value || []).forEach(item => {
            if (!this.catalogPacks.has(item.Owner_Key)) this.catalogPacks.set(item.Owner_Key, []);
            this.catalogPacks.get(item.Owner_Key).push({ nam: item.Description, id: item.Ref_Key });
        });

        const eans = await odata.get("InformationRegister_усШтрихкоды?$filter=like(Штрихкод,'4627120______')");
        this.catalogEans.clear();
        (eans.value || []).forEach(item => {
            if (!this.catalogEans.has(item.Номенклатура_Key)) this.catalogEans.set(item.Номенклатура_Key, new Set());
            this.catalogEans.get(item.Номенклатура_Key).add(item.Штрихкод);
        });

        const zones = await odata.get("InformationRegister_усЗоныОтбора");
        this.catalogZoneOt.clear();
        (zones.value || []).forEach(item => {
            if (!this.catalogZoneOt.has(item.Номенклатура_Key)) this.catalogZoneOt.set(item.Номенклатура_Key, new Set());
            this.catalogZoneOt.get(item.Номенклатура_Key).add(item.Зона_Key);
        });

        //console.log(this.partIstKeys);
    }

    packKey(ownerKey, nam) {
        const list = this.catalogPacks.get(ownerKey) || [];
        return list.find(p => p.nam === nam)?.id || this.emptyKey;
    }
}

module.exports = new SyncCache();