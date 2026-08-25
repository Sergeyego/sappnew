const db = require('../../../postgres.js');
const odata = require('../../../odata/service.js');
const cache = require('./cache.js');

class SyncHelpers {
    async partiKey(ownerKey, desc) {
        const res = await odata.get(`Catalog_усПартииНоменклатуры?$select=Ref_Key&$filter=Description eq '${desc}' and Owner_Key eq guid'${ownerKey}'`);
        return res.value?.[0]?.Ref_Key || cache.emptyKey;
    }

    async partiKeyById(id) {
        const res = await odata.get(`Catalog_усПартииНоменклатуры?$select=Ref_Key&$filter=КодКис eq '${id}'`);
        return res.value?.[0]?.Ref_Key || cache.emptyKey;
    }

    async deleteDocStr(obj, docKey) {
        const res = await odata.get(`${obj}?$filter=Владелец_Key eq guid'${docKey}'`);
        for (const item of (res.value || [])) {
            await odata.delete(`${obj}(guid'${item.Ref_Key}')`);
        }
    }

    getFormattedDate(dateObj){
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}T00:00:00`;
    }

    /*async checkEan(queryDoc, queryGen) {
        const rows = await db.any(queryDoc);
        for (const row of rows) {
            if (!row.ean_pallet) {
                const seq = await db.one("SELECT nextval('ean_seq') as code");
                let sCode = "4627120" + String(seq.code).padStart(5, '0');
                let sum = 0;
                for (let i = 0; i < 12; i++) sum += Number(sCode[i]) * (i % 2 === 0 ? 1 : 3);
                sCode += String((10 - (sum % 10)) % 10);
                await db.none(queryGen, [sCode, row.id]);
            }
        }
    }*/
}

module.exports = new SyncHelpers();