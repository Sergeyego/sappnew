const syncService = require('./sync.js');

module.exports = function(router) {

    //Полная синхронизация каталогов (Электроды + Проволока)
    router.post('/wms/sync/catalog/all', async (req, res) => {
        try {
            const syncEl = req.query.el !== 'false';
            const syncWire = req.query.wire !== 'false';

            await syncService.loadSettings(1);
            const totalCreated = await syncService.syncCatalog(syncEl, syncWire);

            res.json({
                success: true,
                message: "Синхронизация каталогов успешно завершена",
                details: `Создано/обновлено элементов справочников и зон: ${totalCreated}`
            });
        } catch (error) {
            console.error("Ошибка при синхронизации каталогов:", error.message);
            res.status(500).type('text/plain').send(error.message);
        }
    });

    //Синхронизация документа ожидаемой приемки ЭЛЕКТРОДОВ
    router.post('/wms/sync/priem/el/:id_doc', async (req, res) => {
        try {
            const idDoc = Number(req.params.id_doc);
            if (isNaN(idDoc)) {
                return res.status(400).type('text/plain').send("Параметр id_doc должен быть числом");
            }

            await syncService.loadSettings(1);
            const docKey = await syncService.syncPriemEl(idDoc);

            res.json({
                success: true,
                message: `Документ приемки электродов #${idDoc} успешно проведен в 1С WMS`,
                docKey: docKey
            });
        } catch (error) {
            console.error(`Ошибка при синхронизации приемки электродов #${req.params.id_doc}:`, error.message);
            res.status(500).type('text/plain').send(error.message);
        }
    });

    //Синхронизация документа ожидаемой приемки ПРОВОЛОКИ
    router.post('/wms/sync/priem/wire/:id_doc', async (req, res) => {
        try {
            const idDoc = Number(req.params.id_doc);
            if (isNaN(idDoc)) {
                return res.status(400).type('text/plain').send("Параметр id_doc должен быть числом");
            }

            await syncService.loadSettings(1);
            const docKey = await syncService.syncPriemWire(idDoc);

            res.json({
                success: true,
                message: `Документ приемки проволоки #${idDoc} успешно проведен в 1С WMS`,
                docKey: docKey
            });
        } catch (error) {
            console.error(`Ошибка при синхронизации приемки проволоки #${req.params.id_doc}:`, error.message);
            res.status(500).type('text/plain').send(error.message);
        }
    });

    //Синхронизация заказа на отгрузку
    router.post('/wms/sync/ship/:id_ship', async (req, res) => {
        try {
            const idShip = Number(req.params.id_ship);
            if (isNaN(idShip)) {
                return res.status(400).type('text/plain').send("Параметр id_ship должен быть числом");
            }

            await syncService.loadSettings(1);
            const docKey = await syncService.syncShip(idShip);

            res.json({
                success: true,
                message: `Заказ на отгрузку #${idShip} успешно создан и проведен в 1С WMS`,
                docKey: docKey
            });
        } catch (error) {
            console.error(`Ошибка при синхронизации отгрузки #${req.params.id_ship}:`, error.message);
            res.status(500).type('text/plain').send(error.message);
        }
    });
};