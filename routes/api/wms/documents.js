const db = require('../../../postgres.js');
const odata = require('../../../odata/service.js');
const cache = require('./cache.js');
const helpers = require('./helpers.js');

class SyncDocuments {
    /**
     * Вспомогательный метод для отправки строк в 1С
     */
    async postDocRows(endpoint, docKey, rows) {
        await helpers.deleteDocStr(endpoint, docKey);
        for (const r of rows) {
            const nomK = cache.catalogKeys.get(r.kis) || cache.emptyKey;
            await odata.post(endpoint, {
                Владелец_Key: docKey, 
                Номенклатура_Key: nomK, 
                Количество: Math.round(Number(r.massa) * 100) / 100,
                Статус_Key: cache.constKeys.get("Кондиция"), 
                Партия_Key: await helpers.partiKeyById(String(r.id_part_kis)),
                УпаковкаНоменклатуры_Key: cache.packKey(nomK, r.npack)
            });
        }
    }

    /**
     * Проведение документа Ожидаемая Приемка (Приход)
     * ТЕПЕРЬ ПРИНИМАЕТ rows (массив данных) вместо строки запроса queryCont
     */
    async syncOpDoc(queryDoc, rows) {
        const docRow = await db.oneOrNone(queryDoc); 
        if (!docRow) throw new Error("Документ накладной не найден в локальной БД.");
        
        const docBody = { 
            Number: String(docRow.nn), 
            Date: new Date(docRow.dat).toISOString().substring(0, 19), 
            НомерКИС: String(docRow.nn), 
            ИсточникПоступления_Key: cache.counterKeys.get(String(docRow.id_ist)) || cache.emptyKey, 
            Организация_Key: cache.constKeys.get("000000001"), 
            СтадииПриемки_Key: cache.constKeys.get("Базовая настройка") 
        };
        
        const check = await odata.get(`Document_усОжидаемаяПриемка?$select=Ref_Key&$filter=НомерКИС eq '${docBody.Number}'`);
        let docK = check.value?.Ref_Key;
        
        if (!docK) docK = (await odata.post("Document_усОжидаемаяПриемка", docBody)).Ref_Key;
        else await odata.patch(`Document_усОжидаемаяПриемка(guid'${docK}')`, docBody);

        // Отправляем уже готовые строки, которые пришли из sync.service.js
        await this.postDocRows("Document_усСтрокаОжидаемойПриемки", docK, rows);
        await odata.post(`Document_усОжидаемаяПриемка(guid'${docK}')/Post?PostingModeOperational=false`, {});
        return docK;
    }

    /**
     * Проведение документа Заказ на отгрузку (Расход)
     */
    async syncShipDoc(idShip) {
        const docRow = await db.oneOrNone("SELECT s.nn, s.dat, s.id_post, s.id_type FROM ship s WHERE s.id = $1", [idShip]); 
        if (!docRow) throw new Error("Документ отгрузки не найден в локальной БД.");
        
        const docBody = { 
            Number: String(docRow.nn), 
            Date: new Date(docRow.dat).toISOString().substring(0, 19), 
            НомерКИС: String(docRow.nn), 
            Контрагент_Key: cache.counterKeys.get(String(docRow.id_post)) || cache.emptyKey, 
            Организация_Key: cache.constKeys.get("000000001"), 
            НаправлениеОтгрузки_Key: cache.shipTypeKeys.get(String(docRow.id_type)) || cache.emptyKey 
        };
        
        const check = await odata.get(`Document_усЗаказНаОтгрузку?$select=Ref_Key&$filter=НомерКИС eq '${docBody.Number}'`);
        let docK = check.value?.Ref_Key;
        
        if (!docK) docK = (await odata.post("Document_усЗаказНаОтгрузку", docBody)).Ref_Key;
        else await odata.patch(`Document_усЗаказНаОтгрузку(guid'${docK}')`, docBody);

        const qCont = `
            SELECT 'e:'||p2.id_part as id_part_kis, p.id_el||':'||(SELECT id FROM diam WHERE diam=p.diam) as kis, ep.npack, sum(sc.kvo*ep.mass_ed) as massa 
            FROM ship_cont sc INNER JOIN prod p2 ON p2.id = sc.id_prod INNER JOIN parti p ON p.id = p2.id_part INNER JOIN el_pack ep ON ep.id = p2.id_pack WHERE sc.id_ship = $1 GROUP BY p2.id_part, p.id_el, p.diam, ep.npack 
            UNION 
            SELECT 'w:'||p2.id_part as id_part_kis, w.id_wire||':'||w.id_diam||':'||w.id as kis, w.npack, sum(sc.kvo*w.mass_ed) as massa 
            FROM ship_cont sc INNER JOIN prod_wire p2 ON p2.id = sc.id_prod_wire INNER JOIN wire_pack w ON w.id = p2.id_pack WHERE sc.id_ship = $1 GROUP BY p2.id_part, w.id_wire, w.id_diam, w.id, w.npack`;
        
        const rows = await db.any(qCont, [idShip]);
        await this.postDocRows("Document_усСтрокаЗаказаНаОтгрузку", docK, rows);
        await odata.post(`Document_усЗаказНаОтгрузку(guid'${docK}')/Post?PostingModeOperational=false`, {});
        return docK;
    }
}

module.exports = new SyncDocuments();