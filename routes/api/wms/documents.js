const db = require('../../../postgres.js');
const odata = require('../../../odata/wms.js');
const cache = require('./cache.js');
const helpers = require('./helpers.js');

class SyncDocuments {

    // Проведение документа
    async postDoc(endpoint, docKey) {
        // Используем PostingModeOperational=false для старых платформ 1С. 
        return await odata.post(`${endpoint}(guid'${docKey}')/Post?PostingModeOperational=false`, {});
    }

   // Параллельное удаление всех строк документа пачками (Batching)
    async deleteDocStr(obj, docKey) {
        const res = await odata.get(`${obj}?$select=Ref_Key&$filter=Владелец_Key eq guid'${docKey}'`);
        const items = res.value || [];
        if (!items.length) return;

        const BATCH_SIZE = 15; // Оптимальный размер пачки для OData 1С
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = items.slice(i, i + BATCH_SIZE);
            await Promise.all(
                batch.map(item => odata.delete(`${obj}(guid'${item.Ref_Key}')`))
            );
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

    // Установка статуса "Новый" для заказа на отгрузку
    async setShipDocStatusNew(key) {
        const statusObject = {
            ЗаказНаОтгрузку_Key: key,
            Статус: "Новый"
        };
        return await odata.post("InformationRegister_усСтатусыЗаказовНаОтгрузку", statusObject);
    }

    // Синхронизация получателя
    async syncСounterparty(id_pol) {
        const query = `select p.short as short, p.naim as naim, coalesce(p.adres_egrul, p.adres ) as address, p.telef, p.innkpp, p.okpo, 
        pk.nam as cat, p.bank, p.city, p.bik, p.rs, p.ks from poluch p 
        inner join pol_kat pk on pk.id = p.id_kat 
        where p.id = $1`;

        const info = await db.one(query, [Number(id_pol)]);
        const innkpp = helpers.parseInnKpp(info.innkpp);

        // Сборка строки банковских реквизитов
        const bankParts = [];
        if (info.bank) bankParts.push(info.bank);
        if (info.city) bankParts.push(info.city);
        let bank = bankParts.join(" ");

        if (info.rs) bank += (bank.length ? ", " : "") + "р/с " + info.rs;
        if (info.ks) bank += (bank.length ? ", " : "") + "к/с " + info.ks;
        if (info.bik) bank += (bank.length ? ", " : "") + "БИК " + info.bik;

        const endpoint = "Catalog_усКонтрагенты";

        // 1. Поиск или создание папки категории (строго IsFolder eq true)
        const folderFilter = `$filter=Description eq '${info.cat}' and IsFolder eq true`;
        const cats = await odata.get(`${endpoint}?$select=Ref_Key&${folderFilter}`);
        let parentKey = cats?.value?.[0]?.Ref_Key;

        if (!parentKey) {
            const newFolder = await odata.post(endpoint, {
                Description: info.cat,
                IsFolder: true
            });
            parentKey = newFolder?.Ref_Key;
            if (!parentKey) {
                throw new Error(`Не удалось создать или получить папку категории: ${info.cat}`);
            }
        }

        // Формируем объект контрагента для 1С
        const polObject = {
            Description: info.short,
            НаименованиеПолное: info.naim,
            ИНН: innkpp.inn || "",
            КПП: innkpp.kpp || "",
            ОКПО: info.okpo || "",
            БанковскиеРеквизиты: bank,
            Parent_Key: parentKey // Сюда передаем актуальную (новую) категорию
        };

        // 2. Глобальный поиск
        let polFilter = "";
        if (polObject.ИНН) {
            polFilter = `ИНН eq '${polObject.ИНН}'`;
        } else {
            // Ищем по имени по всей базе 1С, исключая папки
            polFilter = `Description eq '${polObject.Description}' and IsFolder eq false`;
        }

        // Запрашиваем Ref_Key, ИНН и Parent_Key для анализа изменений
        const check = await odata.get(`${endpoint}?$select=Ref_Key,ИНН,Parent_Key&$filter=${polFilter}`);
        const foundElement = check?.value?.[0];
        let polK = foundElement?.Ref_Key;

        // 3. Создание или обновление (с возможным переносом в другую папку)
        if (!polK) {
            // Элемент абсолютно новый — создаем
            const createdPol = await odata.post(endpoint, polObject);
            polK = createdPol?.Ref_Key;
        } else {
            // Защита от коллизии: если искали по имени, но в 1С у найденного элемента есть ИНН, 
            // а у нас в Postgres ИНН пустой — это разные контрагенты. Создаем дубликат.
            if (!polObject.ИНН && foundElement.ИНН) {
                console.log(`Коллизия имен! Найдена чужая фирма с ИНН ${foundElement.ИНН}. Создаем отдельную карточку.`);
                const createdPol = await odata.post(endpoint, polObject);
                polK = createdPol?.Ref_Key;
            } else {
                // Обновляем все реквизиты, включая Parent_Key
                await odata.patch(`${endpoint}(guid'${polK}')`, polObject);
            }
        }

        if (!polK) {
            throw new Error(`Ошибка синхронизации контрагента для id_pol: ${id_pol}: ${polObject.Description}`);
        }

        return polK;
    }

    // Синхронизация строк ожидаемой приемки
    async syncOpDocCont(docKey, rows, partCache) {
        const endpoint = "Document_усСтрокаОжидаемойПриемки";
        await this.deleteDocStr(endpoint, docKey);
        
        let n = 1;
        const syncDate = helpers.getFormattedDate(new Date());

        for (const r of rows) {
            const mass = Number(r.mass_ed);
            const shtuk = (!isNaN(mass) && mass !== 0) ? Math.round(r.kvo / mass) : 1;
            const nomK = cache.catalogKeys.get(r.kis) || cache.emptyKey;
            const numcont = r.barcodecont ? r.barcodecont : ("EUR-" + r.numcont);

            await odata.post(endpoint, {
                Number: String(n),
                Date: syncDate,
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

    // Синхронизация строк заказа на отгрузку
    async syncShipDocCont(docKey, rows, partCache) {
        const endpoint = "Document_усСтрокаЗаказаНаОтгрузку";
        await this.deleteDocStr(endpoint, docKey);
        
        let n = 1;
        const syncDate = helpers.getFormattedDate(new Date());

        for (const r of rows) {
            const mass = Number(r.mass_ed);
            const shtuk = (!isNaN(mass) && mass !== 0) ? Math.round(r.kvo / mass) : 1;
            const nomK = cache.catalogKeys.get(r.kis) || cache.emptyKey;

            // Короткая проверка на валидную дату
            const timestamp = Date.parse(r.dat_part);
            const numPart = !isNaN(timestamp) ? `${r.n_s}-${new Date(timestamp).getFullYear()}` : (r.n_s || "");

            await odata.post(endpoint, {
                Number: String(n),
                Date: syncDate,
                Владелец_Key: docKey,
                Номенклатура_Key: nomK,
                СтатусНоменклатуры_Key: cache.constKeys.get("Кондиция"),
                ПартияНоменклатуры_Key: partCache.get(r.id_part_kis) || cache.emptyKey,
                УпаковкаНоменклатуры_Key: cache.packKey(nomK, r.pack),
                КоличествоУпаковок: shtuk,
                Количество: Math.round(Number(r.kvo) * 100) / 100,
                НомерПартии: String(numPart)
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
            Date: helpers.getFormattedDate(new Date(),true),
            НомерКИС: String(docRow.num),
            ДатаКИС: helpers.getFormattedDate(docRow.dat),
            ИсточникПоступления_Key: cache.postIstKeys.get(String(docRow.ist)) || cache.emptyKey,
            ДатаПоступления: helpers.getFormattedDate(docRow.dat),
            Поклажедатель_Key: cache.counterKeys.get(docRow.codfrom) || cache.emptyKey,
            Контрагент_Key: cache.counterKeys.get(docRow.codto) || cache.emptyKey,
            Организация_Key: cache.constKeys.get("000000001"),
            СтадииПриемки_Key: cache.constKeys.get("Базовая настройка приемки")
        };

        const check = await odata.get(`${endpoint}?$select=Ref_Key&$filter=НомерКИС eq '${docBody.Number}'`);
        let docK = check.value[0]?.Ref_Key;

        const rows = await db.any(queryDocCont);

        if (!docK) { // Если документ не найден, записываем его
            //console.log("нет документа", docBody.Number);
            docK = (await odata.post(endpoint, docBody)).Ref_Key;
            await this.syncOpDocCont(docK, rows, partCache);
            console.log("создан документ", docK);
            await this.setOpDocStatusNew(docK);
            await this.postDoc(endpoint, docK);
        } else { // Если документ уже есть, проверяем статус
            const status = await odata.get(`InformationRegister_усСтатусыОжидаемыхПриемок?$filter=ОжидаемаяПриемка_Key eq guid'${docK}'`);
            if (!status.value[0] || status.value[0]["Статус"] === "Новая") { // Если статус 'Новая', перезаписываем
                //console.log("есть документ", docBody.Number, docK);
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

    //синхронизация документа Заказ на отгрузку
    async syncShipDoc(queryDoc, queryDocCont, partCache) {
        const docRow = await db.oneOrNone(queryDoc);
        if (!docRow) throw new Error("Документ отгрузки не найден в локальной БД.");
        const endpoint = "Document_усЗаказНаОтгрузку";

        const docBody = {
            Number: String(docRow.docnum),
            Date: helpers.getFormattedDate(new Date(),true),
            НомерКИС: String(docRow.docnum),
            ДатаКИС: helpers.getFormattedDate(docRow.dat),
            ДатаОтгрузки: helpers.getFormattedDate(docRow.dat),
            Организация_Key: cache.constKeys.get("000000001"),
            НаправлениеОтгрузки_Key: cache.shipTypeKeys.get(String(docRow.type)) || cache.emptyKey,
            СтадииОтгрузки_Key: cache.constKeys.get("Базовая настройка отгрузки"),
            Контрагент_Key: (await this.syncСounterparty(docRow.id_pol)) || cache.emptyKey,
        };

        const check = await odata.get(`${endpoint}?$select=Ref_Key&$filter=НомерКИС eq '${docBody.Number}'`);
        let docK = check.value[0]?.Ref_Key;

        const rows = await db.any(queryDocCont);

        if (!docK) { // Если документ не найден, записываем его
            //console.log("нет документа", docBody.Number);
            docK = (await odata.post(endpoint, docBody)).Ref_Key;
            await this.syncShipDocCont(docK, rows, partCache);
            await this.setShipDocStatusNew(docK);
            await this.postDoc(endpoint, docK);
        } else { // Если документ уже есть, проверяем статус
            const status = await odata.get(`InformationRegister_усСтатусыЗаказовНаОтгрузку?$filter=ЗаказНаОтгрузку_Key eq guid'${docK}'`);
            if (!status.value[0] || status.value[0]["Статус"] === "Новый") { // Если статус 'Новый', перезаписываем
                //console.log("есть документ", docBody.Number, docK);
                await odata.patch(`${endpoint}(guid'${docK}')`, docBody);
                await this.syncShipDocCont(docK, rows, partCache);
                if (!status.value[0]) {
                    await this.setShipDocStatusNew(docK);
                }
                await this.postDoc(endpoint, docK);
            } else {
                throw new Error(`Можно перезаписать документ 'Заказ на отгрузку' только со статусом 'Новый'`);
            }
        }
        return docK;
    }
}

module.exports = new SyncDocuments();