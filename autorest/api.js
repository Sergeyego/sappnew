const locale = require('../locale.js');
const autorest = require('./autorest.js');
const db = require('../postgres.js');
const bodyParser = require('body-parser');

module.exports = function (app) {

    app.get("/autorest/upddata", async (req, res) => {
        try {
            await autorest.updData();
            res.status(200).type('text/plain').send("Обновлено успешно");
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/autorest/tableinfo/:tablename", async (req, res) => {
        try {
            const data = await autorest.getTblInfo(req.params["tablename"]);
            res.json(data);
        } catch (error) {
            res.status(404).type('text/plain').send(error.message);
        }
    });

    app.get("/autorest/relinfo/:name", async (req, res) => {
        try {
            const data = await autorest.getRelInfo(req.params["name"]);
            res.json(data);
        } catch (error) {
            res.status(404).type('text/plain').send(error.message);
        }
    });

    app.use("/autorest/tables/:tablename", bodyParser.json(), async (req, res) => {
        try {
            const data = await autorest.getData(req.params["tablename"], req);
            res.json(data);
        } catch (error) {
            res.status(404).type('text/plain').send(error.message);
        }
    });

    app.get("/autorest/relations/:name", async (req, res) => {
        try {
            const rel = await autorest.getRelInfo(req.params.name);
            const { like, key } = req.query;

            let limit = null;
            if (!locale.isEmptyStr(like)) {
                limit = 30;
            } else {
                limit = (rel.lim === null) ? null : Number(rel.lim);
            }

            // Создаем единый объект параметров для pg-promise
            const queryParams = {
                col_id: rel.col_id,
                col_val: rel.col_val,
                tablename: rel.tablename,
                key: key,
                likePattern: !locale.isEmptyStr(like) ? like + '%' : null,
                limit: limit
            };

            // Модификатор ~ (тильда) корректно экранирует имена таблиц/колонок, даже если они содержат точки
            let query = "SELECT ${col_id~} AS key, ${col_val~} AS disp FROM ${tablename~}";

            let filters = [];

            // 1. Системный фильтр из настроек реляции
            if (!locale.isEmptyStr(rel.flt)) {
                filters.push(`(${rel.flt})`);
            }

            // 2. Фильтр по первичному ключу (ID)
            if (!locale.isEmptyStr(key)) {
                filters.push("${col_id~} = ${key}");
            }

            // 3. Безопасный фильтр ILIKE
            if (!locale.isEmptyStr(like)) {
                filters.push("${col_val~} ILIKE ${likePattern}");
            }

            if (filters.length > 0) {
                query += " WHERE " + filters.join(" AND ");
            }

            if (!locale.isEmptyStr(rel.sort)) {
                // Сортировке доверяем из конфигурации базы данных
                query += ` ORDER BY ${rel.sort}`;
            }

            if (limit !== null) {
                query += " LIMIT ${limit}";
            }

            // pg-promise сам подставит все переменные (и идентификаторы ~, и значения)
            const data = await db.any(query, queryParams);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });
}