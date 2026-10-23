const db = require('../../../../postgres.js');
const autorest = require('../../../../autorest/autorest.js');
const locale = require('../../../../locale.js');
const bodyParser = require('body-parser');
const otk = require('../../../../otk.js');
const pgp = db.pgp;

const getChemTu = async function (id_part) {
    const query = `
        SELECT c.id_chem, c.min, c.max 
        FROM chem_tu AS c 
        WHERE c.id_el = (SELECT p.id_el FROM parti AS p WHERE p.id = $1) 
          AND c.id_var = (SELECT p.id_var FROM parti AS p WHERE p.id = $1)
    `;
    const state = await db.any(query, [id_part]);
    const mapStat = new Map();
    for (let i = 0; i < state.length; i++) {
        mapStat.set(state[i].id_chem, { min: state[i].min, max: state[i].max });
    }
    return mapStat;
}

const getMechTu = async function (id_part) {
    const query = `
        SELECT m.id_mech, m.min, m.max 
        FROM mech_tu AS m 
        WHERE m.id_el = (SELECT p.id_el FROM parti AS p WHERE p.id = $1)
          AND m.id_var = (SELECT p.id_var FROM parti AS p WHERE p.id = $1)
    `;
    const state = await db.any(query, [id_part]);
    const mapStat = new Map();
    for (let i = 0; i < state.length; i++) {
        mapStat.set(state[i].id_mech, { min: state[i].min, max: state[i].max });
    }
    return mapStat;
}

module.exports = function (app) {
    app.use("/elrtr/lab/parti", autorest.parseFilterMiddleware("el_parti"), bodyParser.json(), async (req, res) => {
        const tableName = "el_parti";
        try {
            let data = await autorest.getData(tableName, req);

            if (!data || data.length === 0) {
                return res.json([]);
            }

            if (req.method != "DELETE") {
                const { sql, params } = req.parsedFilter || { sql: "", params: {} };
                let queryParams = { ...params };

                let query = `
                    SELECT parti.id, 
                    (SELECT CASE WHEN EXISTS(SELECT id FROM parti_chem WHERE id_part=parti.id) THEN 1 ELSE 0 END 
                    + 
                    CASE WHEN EXISTS(SELECT id FROM parti_mech WHERE id_part=parti.id) THEN 2 ELSE 0 END 
                    AS r) FROM parti
                `;

                if ((req.method == "GET") && !locale.isEmptyStr(sql)) {
                    query += " WHERE " + sql;
                } else if (req.method == "POST" || req.method == "PUT") {
                    const targetId = data[0] && data[0]["id"] ? data[0]["id"].edit_role : null;
                    if (targetId !== null) {
                        query += " WHERE parti.id = ${custom_target_id}";
                        queryParams.custom_target_id = targetId;
                    } else {
                        query += " WHERE parti.id = -1";
                    }
                } else {
                    query += " WHERE parti.id = -1";
                }

                const state = await db.any(query, queryParams);
                const mapStat = new Map();

                for (let i = 0; i < state.length; i++) {
                    let color = "#FFFFFF";
                    const r = state[i].r;
                    if (r == 1) color = "#FFAAAA";
                    else if (r == 2) color = "#AAFFAA";
                    else if (r == 3) color = "#FFFF00";
                    mapStat.set(state[i].id, color);
                }

                const tbl = await autorest.getTblInfo(tableName);
                const col = tbl.columns;

                for (let i = 0; i < data.length; i++) {
                    const currentId = data[i]["id"] ? data[i]["id"].edit_role : null;
                    if (currentId && mapStat.has(currentId)) {
                        const bg = mapStat.get(currentId);
                        col.forEach(function (cl) {
                            if (data[i][cl.nam]) {
                                data[i][cl.nam].background_role = bg;
                            }
                        });
                    }
                }
            }
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.use("/elrtr/lab/chem/parti", autorest.parseFilterMiddleware("el_parti_chem"), bodyParser.json(), async (req, res) => {
        const tableName = "el_parti_chem";
        try {
            let data = await autorest.getData(tableName, req);
            await otk.processTuColoring(data, tableName, getChemTu, "id_chem");
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.use("/elrtr/lab/chem/sert", autorest.parseFilterMiddleware("el_sert_chem"), bodyParser.json(), async (req, res) => {
        const tableName = "el_sert_chem";
        try {
            let data = await autorest.getData(tableName, req);
            await otk.processTuColoring(data, tableName, getChemTu, "id_chem");
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.use("/elrtr/lab/mech/parti", autorest.parseFilterMiddleware("el_parti_mech"), bodyParser.json(), async (req, res) => {
        const tableName = "el_parti_mech";
        try {
            let data = await autorest.getData(tableName, req);
            await otk.processTuColoring(data, tableName, getMechTu, "id_mech");
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.use("/elrtr/lab/mech/sert", autorest.parseFilterMiddleware("el_sert_mech"), bodyParser.json(), async (req, res) => {
        const tableName = "el_sert_mech";
        try {
            let data = await autorest.getData(tableName, req);
            await otk.processTuColoring(data, tableName, getMechTu, "id_mech");
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.post("/elrtr/lab/chem/load/:id_part/:id_dev", bodyParser.json(), async (req, res) => {
        const id_part = Number(req.params["id_part"]);
        const id_dev = Number(req.params["id_dev"]);

        // Проверяем валидность пришедших ID перед началом транзакции
        if (Number.isNaN(id_part) || Number.isNaN(id_dev)) {
            return res.status(400).type('text/plain').send("Некорректные параметры id_part или id_dev");
        }

        try {
            // Запускаем транзакцию через db.tx
            const ids = await db.tx(async t => {
                // 1. Устанавливаем SQL-контекст пользователя и IP внутри транзакции
                await autorest.setSqlContext(t, req);

                // 2. Получаем необходимые химические элементы (выполняем через объект транзакции 't')
                const tuChem = await t.any(
                    "select c.id_chem as id, ct.sig as sig from chem_tu as c " +
                    "inner join chem_tbl ct on ct.id = c.id_chem " +
                    "where c.id_el = (select p.id_el from parti as p where p.id = $1) " +
                    "and c.id_var = (select p.id_var from parti as p where p.id = $1)",
                    [id_part]
                );

                // Если ничего не нашли, возвращаем пустой массив
                if (!tuChem.length) {
                    return [];
                }

                // 3. Формируем массив объектов для безопасной множественной вставки
                const insertRows = tuChem.map(chem => {
                    const rawKvo = Object.hasOwn(req.body, chem.sig) ? req.body[chem.sig] : 0.0;
                    // Принудительно приводим к числу, чтобы избежать записи строк/undefined в БД
                    const kvo = Number.isNaN(Number(rawKvo)) ? 0.0 : Number(rawKvo);

                    return {
                        id_part: id_part,
                        id_dev: id_dev,
                        id_chem: chem.id,
                        kvo: kvo
                    };
                });

                // 4. Безопасно генерируем и выполняем множественный INSERT с помощью pg-promise helpers
                // Это полностью защищает от SQL-инъекций и корректно экранирует данные
                const cs = new pgp.helpers.ColumnSet(['id_part', 'id_dev', 'id_chem', 'kvo'], { table: 'parti_chem' });
                const query = pgp.helpers.insert(insertRows, cs) + " RETURNING id";

                // Выполняем вставку в рамках той же транзакции
                return await t.any(query);
            });

            // Отправляем успешный результат клиенту
            res.json(ids);

        } catch (error) {
            // Если транзакция упадет на любом этапе (включая setSqlContext), 
            // pg-promise автоматически сделает ROLLBACK.
            res.status(500).type('text/plain').send(error.message);
        }
    });
}