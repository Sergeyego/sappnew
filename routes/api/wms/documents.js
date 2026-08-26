const db = require('../../../postgres.js');
const odata = require('../../../odata/service.js');
const cache = require('./cache.js');
const helpers = require('./helpers.js');

class SyncDocuments {

    // Проведение документа
    async postDoc(endpoint, docKey) {
        // Используем PostingModeOperational=false для старых платформ 1С. 
        return await odata.post(`${endpoint}(guid'${docKey}')/Post?PostingModeOperational=false`, {});
    }

    //удаление всех строк документа
    async deleteDocStr(obj, docKey) {
        const res = await odata.get(`${obj}?$filter=Владелец_Key eq guid'${docKey}'`);
        for (const item of (res.value || [])) {
            await odata.delete(`${obj}(guid'${item.Ref_Key}')`);
        }
    }

    // Установка статуса "Новая" для ожидаемой приемки
    async setOpDocStatusNew(key) {
        const statusObject = {
            ОжидаемаяПриемка_Key: key,
            Статус: "Новая"
        };
        return await odata.post("InformationRegister_усСтатусыОжидаемыхПриемок", statusObject);
    }

    // Синхронизация строк ожидаемой приемки
    async syncOpDocCont(docKey, rows, partCache) {
        const endpoint = "Document_усСтрокаОжидаемойПриемки";
        await this.deleteDocStr(endpoint, docKey);
        let n = 1;
        for (const r of rows) {
            const mass_ed = Number(r.mass_ed);
            // Безопасный расчет штук с учетом валидности чисел
            const shtuk = (!Number.isNaN(mass_ed) && mass_ed !== 0) ? Math.round(r.kvo / mass_ed) : 1;
            const nomK = cache.catalogKeys.get(r.kis) || cache.emptyKey;
            const numcont = r.barcodecont ? r.barcodecont : ("EUR-" + r.numcont);

            await odata.post(endpoint, {
                Number: String(n),
                Date: helpers.getFormattedDate(new Date()),
                Владелец_Key: docKey,
                Номенклатура_Key: nomK,
                СтатусНоменклатуры_Key: cache.constKeys.get("Кондиция"),
                ПартияНоменклатуры_Key: partCache.get(r.id_part_kis) || cache.emptyKey,
                УпаковкаНоменклатуры_Key: cache.packKey(nomK, r.pack),
                КоличествоУпаковок: shtuk,
                Количество: Math.round(Number(r.kvo) * 100) / 100,
                ТипКонтейнера_Key: cache.constKeys.get("Европаллета"),
                НомерКонтейнера: numcont
            });
            n++;
        }
    }

    // Синхронизация документа Ожидаемая Приемка
    async syncOpDoc(queryDoc, queryDocCont, partCache) {
        const docRow = await db.oneOrNone(queryDoc);
        if (!docRow) throw new Error("Документ накладной не найден в локальной БД.");
        const endpoint = "Document_усОжидаемаяПриемка";

        const docBody = {
            Number: String(docRow.num),
            Date: helpers.getFormattedDate(docRow.dat),
            НомерКИС: String(docRow.num),
            ДатаКИС: helpers.getFormattedDate(docRow.dat),
            ИсточникПоступления_Key: cache.postIstKeys.get(String(docRow.ist)) || cache.emptyKey,
            ДатаПоступления: helpers.getFormattedDate(docRow.dat),
            Поклажедатель_Key: cache.counterKeys.get(docRow.codfrom) || cache.emptyKey,
            Контрагент_Key: cache.counterKeys.get(docRow.codto) || cache.emptyKey,
            Организация_Key: cache.constKeys.get("000000001"),
            СтадииПриемки_Key: cache.constKeys.get("Базовая настройка")
        };

        const check = await odata.get(endpoint + `?$select=Ref_Key&$filter=НомерКИС eq '${docBody.Number}'`);
        let docK = check.value[0]?.Ref_Key;

        const rows = await db.any(queryDocCont);

        if (!docK) { // Если документ не найден, записываем его
            console.log("нет документа", docBody.Number);
            docK = (await odata.post(endpoint, docBody)).Ref_Key;
            await this.syncOpDocCont(docK, rows, partCache);
            console.log("создан документ", docK);
            await this.setOpDocStatusNew(docK);
            await this.postDoc(endpoint, docK);
        } else { // Если документ уже есть, проверяем статус
            const status = await odata.get(`InformationRegister_усСтатусыОжидаемыхПриемок?$filter=ОжидаемаяПриемка_Key eq guid'${docK}'`);
            if (!status.value[0] || status.value[0]["Статус"] === "Новая") { // Если статус 'Новая', перезаписываем
                console.log("есть документ", docBody.Number, docK);
                await odata.patch(`${endpoint}(guid'${docK}')`, docBody);
                await this.syncOpDocCont(docK, rows, partCache);
                if (!status.value[0]) {
                    await this.setOpDocStatusNew(docK);
                }
                await this.postDoc(endpoint, docK);
            } else {
                throw new Error(`Можно перезаписать документ 'Ожидаемая приемка' только со статусом 'Новая'`);
            }
        }
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
            Date: helpers.getFormattedDate(docRow.dat),
            НомерКИС: String(docRow.nn),
            Контрагент_Key: cache.counterKeys.get(String(docRow.id_post)) || cache.emptyKey,
            Организация_Key: cache.constKeys.get("000000001"),
            НаправлениеОтгрузки_Key: cache.shipTypeKeys.get(String(docRow.id_type)) || cache.emptyKey
        };

        const check = await odata.get(`Document_усЗаказНаОтгрузку?$select=Ref_Key&$filter=НомерКИС eq '${docBody.Number}'`);
        let docK = check.value[0]?.Ref_Key;

        /*if (!docK) docK = (await odata.post("Document_усЗаказНаОтгрузку", docBody)).Ref_Key;
        else await odata.patch(`Document_усЗаказНаОтгрузку(guid'${docK}')`, docBody);

        const qCont = `
            SELECT 'e:'||p2.id_part as id_part_kis, p.id_el||':'||(SELECT id FROM diam WHERE diam=p.diam) as kis, ep.npack, sum(sc.kvo*ep.mass_ed) as massa 
            FROM ship_cont sc INNER JOIN prod p2 ON p2.id = sc.id_prod INNER JOIN parti p ON p.id = p2.id_part INNER JOIN el_pack ep ON ep.id = p2.id_pack WHERE sc.id_ship = $1 GROUP BY p2.id_part, p.id_el, p.diam, ep.npack 
            UNION 
            SELECT 'w:'||p2.id_part as id_part_kis, w.id_wire||':'||w.id_diam||':'||w.id as kis, w.npack, sum(sc.kvo*w.mass_ed) as massa 
            FROM ship_cont sc INNER JOIN prod_wire p2 ON p2.id = sc.id_prod_wire INNER JOIN wire_pack w ON w.id = p2.id_pack WHERE sc.id_ship = $1 GROUP BY p2.id_part, w.id_wire, w.id_diam, w.id, w.npack`;
        */
        //const rows = await db.any(qCont, [idShip]);
        //await this.postDocRows("Document_усСтрокаЗаказаНаОтгрузку", docK, rows);
        //await odata.post(`Document_усЗаказНаОтгрузку(guid'${docK}')/Post?PostingModeOperational=false`, {});
        return docK;
    }
}

module.exports = new SyncDocuments();