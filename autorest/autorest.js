const db = require('../postgres.js');
const locale = require('../locale.js');

const mapType = new Map([
    [16, "bool"], [17, "bytea"], [18, "char"], [20, "int8"], [21, "int2"],
    [23, "int4"], [24, "regproc"], [25, "text"], [26, "oid"], [27, "tid"],
    [28, "xid"], [29, "cid"], [30, "json"], [142, "xml"], [194, "pg_node_tree"],
    [210, "smgr"], [602, "path"], [604, "polygon"], [650, "cidr"], [700, "float4"],
    [701, "float8"], [702, "abstime"], [703, "reltime"], [704, "tinterval"],
    [718, "circle"], [774, "macaddr8"], [790, "money"], [829, "macaddr"],
    [869, "inet"], [1033, "aclitem"], [1042, "bpchar"], [1043, "varchar"],
    [1082, "date"], [1083, "time"], [1114, "timestamp"], [1184, "timestamptz"],
    [1186, "interval"], [1266, "timetz"], [1560, "bit"], [1562, "varbit"],
    [1700, "numeric"], [1790, "refcursor"], [2202, "regprocedure"], [2203, "regoper"],
    [2204, "regoperator"], [2205, "regclass"], [2206, "regtype"], [2950, "uuid"],
    [2970, "txid_snapshot"], [3220, "pg_lsn"], [3361, "pg_ndistinct"],
    [3402, "pg_dependencies"], [3614, "tsvector"], [3615, "tsquery"],
    [3642, "gtsvector"], [3734, "regconfig"], [3769, "regdictionary"],
    [3802, "jsonb"], [4089, "regnamespace"], [4096, "regrole"]
]);

const tblInfoCache = new Map();
const relInfoCache = new Map();

const updData = async function () {
    const data = await db.any("SELECT refresh_rest_tables_view()");
    tblInfoCache.clear();
    relInfoCache.clear();
    return data;
};

const getTblInfo = function (nam) {
    if (tblInfoCache.has(nam)) {
        return tblInfoCache.get(nam);
    }
    const promise = db.one("select * from rest_tables_view where nam = $1", [nam]);
    const cachedPromise = promise.catch(err => {
        tblInfoCache.delete(nam);
        throw err;
    });
    tblInfoCache.set(nam, cachedPromise);
    return cachedPromise;
};

const getRelInfo = function (nam) {
    if (relInfoCache.has(nam)) {
        return relInfoCache.get(nam);
    }
    const query = "select rr.nam, rr.tablename, rr.col_id, rr.col_val, rr.sort, rr.lim, rr.flt, rt.nam as editor from rest_rels rr left join rest_tables rt on rt.id = rr.id_tbl where rr.nam = $1";
    const promise = db.one(query, [nam]);
    const cachedPromise = promise.catch(err => {
        relInfoCache.delete(nam);
        throw err;
    });
    relInfoCache.set(nam, cachedPromise);
    return cachedPromise;
};

const getDisplay = function (val, type, dec, hide_zero = false, checkable = false) {
    if (val === null) return "";
    let ret;
    switch (type) {
        case "bool": ret = val ? "Да" : "Нет"; break;
        case "text":
        case "varchar": ret = locale.isEmptyStr(val) ? '' : val; break;
        case "int2":
        case "int4":
        case "int8": ret = ((hide_zero === true && val === 0) || checkable) ? "" : locale.insNumber(val, 0); break;
        case "float4":
        case "float8":
        case "numeric": ret = (hide_zero === true && (Number(val) === 0)) ? "" : locale.insNumber(val, dec); break;
        case "date": ret = locale.insDate(val); break;
        case "timestamp":
        case "timestamptz": ret = locale.insDateTime(val); break;
        case "time":
        case "timetz": ret = locale.insTime ? locale.insTime(val) : val; break;
        //Явно обрабатываем сложные типы, чтобы UI не выводил сырой мусор
        case "json":
        case "jsonb": ret = typeof val === 'object' ? JSON.stringify(val) : val; break;
        case "bytea": ret = "<binary>"; break;
        default: ret = val;
    }
    return ret;
};

const getFltStr = function (tbl, obj) {
    if (!obj || Object.keys(obj).length === 0) {
        throw new Error(`Не удалось определить условия фильтрации первичных ключей для таблицы ${tbl.tablename}`);
    }
    let flt = "";
    for (const key in obj) {
        if (flt != "") flt += " and ";
        flt += tbl.tablename + "." + key + " = " + "${" + key + "}";
    }
    return flt;
};

//Ужесточенный, безопасный список примитивов. Исключает undefined и null.
const isStrictPrimitive = (val) => {
    return typeof val === 'string' ||
        typeof val === 'number' ||
        typeof val === 'boolean' ||
        val instanceof Date;
};

/**
 * Формирует безопасный SQL-фильтр на основе объекта дерева условий.
 */
const buildTreeFilter = function (rootNode, allowedColumnsSet, maxDepth = 5) {
    const queryParams = {};
    let counter = 0;

    const parseNode = (node, depth = 0) => {
        if (!node || typeof node !== 'object') return "";
        if (depth > maxDepth) throw new Error(`Превышена максимальная глубина вложенности фильтра (${maxDepth})`);

        if (node.group && Array.isArray(node.rules)) {
            const type = node.group.toLowerCase().trim();
            if (type !== 'and' && type !== 'or') return "";
            const parts = node.rules.map(r => parseNode(r, depth + 1)).filter(str => str !== "");
            if (parts.length === 0) return "";
            return '(' + parts.join(' ' + type.toUpperCase() + ' ') + ')';
        }

        const { tablename, field, op, value } = node;
        if (!tablename || !field || !op) return "";

        // Раздел 2: Истинный Fail-Closed. Убран "size > 0". Любой пустой whitelist теперь наглухо блокирует запрос.
        const currentKey = `${tablename}.${field}`;
        if (!allowedColumnsSet.has(currentKey)) {
            throw new Error(`Доступ к колонке "${tablename}"."${field}" запрещен или её не существует в разрешенной схеме эндпоинта`);
        }

        const fullFieldName = `"${tablename}"."${field}"`;
        counter++;

        const sanitizedField = field.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_');
        const paramBase = `v_${sanitizedField}_${counter}`;
        const opClean = op.toLowerCase().trim();

        //eq/ne с undefined отсекаются
        if (value === undefined) {
            throw new Error(`Недопустимое значение "undefined" для поля "${field}"`);
        }

        //eq/ne с null корректно преобразуются в нативный синтаксис IS NULL
        if (opClean === 'eq' && value === null) return `${fullFieldName} IS NULL`;
        if (opClean === 'ne' && value === null) return `${fullFieldName} IS NOT NULL`;

        const scalarOperators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike'];
        if (scalarOperators.includes(opClean) && !isStrictPrimitive(value)) {
            throw new Error(`Оператор "${opClean}" для поля "${field}" ожидает валидный примитивный тип данных`);
        }

        switch (opClean) {
            case 'eq': queryParams[paramBase] = value; return `${fullFieldName} = \${${paramBase}}`;
            case 'ne': queryParams[paramBase] = value; return `${fullFieldName} != \${${paramBase}}`;
            case 'gt': queryParams[paramBase] = value; return `${fullFieldName} > \${${paramBase}}`;
            case 'gte': queryParams[paramBase] = value; return `${fullFieldName} >= \${${paramBase}}`;
            case 'lt': queryParams[paramBase] = value; return `${fullFieldName} < \${${paramBase}}`;
            case 'lte': queryParams[paramBase] = value; return `${fullFieldName} <= \${${paramBase}}`;
            case 'like': queryParams[paramBase] = value; return `${fullFieldName} LIKE \${${paramBase}}`;
            case 'ilike': queryParams[paramBase] = value; return `${fullFieldName} ILIKE \${${paramBase}}`;
            case 'between':
                if (!Array.isArray(value) || value.length !== 2) {
                    throw new Error(`Оператор BETWEEN для поля "${field}" требует массив строго из 2 элементов`);
                }
                //Границы диапазона проверяются строго по новому списку примитивов (без null/undefined)
                if (!isStrictPrimitive(value[0]) || !isStrictPrimitive(value[1])) {
                    throw new Error(`Оператор BETWEEN для поля "${field}" требует заполненные примитивные границы диапазона`);
                }
                const pMin = `${paramBase}_min`;
                const pMax = `${paramBase}_max`;
                queryParams[pMin] = value[0];
                queryParams[pMax] = value[1];
                return `${fullFieldName} BETWEEN \${${pMin}} AND \${${pMax}}`;
            case 'in':
            case 'nin':
                if (!Array.isArray(value) || value.length === 0) {
                    throw new Error(`Оператор "${opClean.toUpperCase()}" для поля "${field}" требует непустой массив значений`);
                }
                // Замечание 3.5: Проверяем элементы внутри IN массива
                if (value.some(val => !isStrictPrimitive(val))) {
                    throw new Error(`Оператор "${opClean.toUpperCase()}" для поля "${field}" содержит недопустимые типы данных (null/объекты)`);
                }
                queryParams[paramBase] = value;
                return `${fullFieldName} ${opClean === 'in' ? 'IN' : 'NOT IN'} (\${${paramBase}:csv})`;
            case 'null': return `${fullFieldName} IS NULL`;
            case 'nnull': return `${fullFieldName} IS NOT NULL`;
            default: throw new Error(`Неизвестный или неподдерживаемый оператор: "${opClean}" для поля "${field}"`);
        }
    };

    const sqlResult = parseNode(rootNode, 0);
    return { sql: sqlResult, params: queryParams };
};

/**
 * Настраиваемый middleware-фабрика для парсинга JSON-фильтра (Паттерн Fail-Closed).
 * 
 * ДОКУМЕНТАЦИЯ КОНТРАКТА:
 * Если маршрут является кастомным и не содержит динамических параметров :tablename или :table, 
 * данный middleware ОБЯЗАТЕЛЬНО должен вызываться с явным указанием имени таблицы в опциях:
 * Пример: parseFilterMiddleware({ tableName: "orders", maxDepth: 7 })
 *
 * @param {Object|string} [options] - Настройки фабрики (или строка с именем таблицы для совместимости)
 * @param {string} [options.tableName] - Жестко заданное имя таблицы для кастомного роута
 * @param {number} [options.maxDepth=5] - Кастомный предел глубины рекурсии для специфических роутов
 */
const parseFilterMiddleware = (options) => {
    // Поддержка как объекта конфигурации, так и старой передачи обычной строкой
    const config = typeof options === 'string' ? { tableName: options } : (options || {});
    const overrideTableName = config.tableName;
    const customMaxDepth = config.maxDepth || 5;

    return (req, res, next) => {
        req.parsedFilter = { sql: "", params: {} };

        if (req.query && req.query.filter){
            req.parsedFilter = { sql: req.query.filter, params: {} };
            return next();
        }

        if (!req.query || !req.query.filterobj) {
            return next();
        }

        const prepareFilter = async () => {
            const filterObj = typeof req.query.filterobj === 'string'
                ? JSON.parse(req.query.filterobj)
                : req.query.filterobj;

            if (!filterObj || typeof filterObj !== 'object' || Array.isArray(filterObj)) {
                throw new Error("Параметр filterobj должен быть валидным JSON-объектом");
            }

            // Защитный барьер. Если клиент прислал сломанный фильтр в обход IfValid()
            if (filterObj.__client_error__) {
                throw new Error(`Клиентский фильтр не прошёл валидацию на стороне интерфейса: ${filterObj.__client_error__}`);
            }

            const validFieldsSet = new Set();
            
            const targetTableName = overrideTableName || req.params?.tablename || req.params?.table;

            if (!targetTableName) {
                throw new Error("Не удалось определить целевую таблицу для валидации фильтра. Укажите параметр в маршруте или передайте tableName в опции middleware.");
            }

            const tbl = await getTblInfo(targetTableName);
            if (!tbl || !Array.isArray(tbl.columns) || tbl.columns.length === 0) {
                throw new Error(`Не удалось извлечь схему метаданных или белый список колонок для таблицы "${targetTableName}"`);
            }

            tbl.columns.forEach(c => validFieldsSet.add(`${tbl.tablename}.${c.col}`));

            const relPromises = tbl.columns
                .filter(cl => !locale.isEmptyStr(cl.relnam))
                .map(async (cl) => {
                    try {
                        const rel = await getRelInfo(cl.relnam);
                        const joinedTbl = await getTblInfo(rel.tablename); 
                        if (joinedTbl && Array.isArray(joinedTbl.columns)) {
                            joinedTbl.columns.forEach(jc => validFieldsSet.add(`${cl.relnam}.${jc.col}`));
                        }
                    } catch (e) {}
                });

            await Promise.all(relPromises);

            // Пробрасываем кастомный maxDepth в построитель фильтра
            const { sql, params } = buildTreeFilter(filterObj, validFieldsSet, customMaxDepth);
            req.parsedFilter = { sql, params };
        };

        prepareFilter()
            .then(() => next())
            .catch(err => {
                return res.status(400).json({ error: err.message || "Некорректный формат JSON-фильтра" });
            });
    };
};

const selectDb = async function (tbl, flt, params, ctx = db) {
    const col = tbl.columns;
    let colstr = "";
    let joinstr = "";
    let coljoin = "";

    const relPromises = col.map(async (cl) => {
        if (!locale.isEmptyStr(cl.relnam)) {
            const rel = await getRelInfo(cl.relnam);
            return { cl, rel };
        }
        return { cl, rel: null };
    });

    const resolvedRels = await Promise.all(relPromises);

    // Метаданные поступают из доверенного кэша rest_tables_view, конкатенация безопасна
    for (const { cl, rel } of resolvedRels) {
        if (colstr !== "") colstr += ", ";
        colstr += tbl.tablename + "." + cl.col + " AS " + cl.nam;

        if (rel) {
            if (coljoin !== "") coljoin += ", ";
            coljoin += cl.relnam + "." + rel.col_val + " AS jcol_" + cl.nam;
            joinstr += "LEFT JOIN " + rel.tablename + " AS " + cl.relnam + " ON " + cl.relnam + "." + rel.col_id + " = " + tbl.tablename + "." + cl.col + " ";
        }
    }

    let query = "SELECT " + colstr;
    if (!locale.isEmptyStr(coljoin)) query += ", " + coljoin;
    query += " FROM " + tbl.tablename + " " + joinstr;
    if (!locale.isEmptyStr(flt)) query += " WHERE " + flt;
    if (!locale.isEmptyStr(tbl.sort)) query += " ORDER BY " + tbl.sort;

    const data = await ctx.any(query, params);
    const obj = [];
    for (let i = 0; i < data.length; i++) {
        const tbl_col = {};
        col.forEach(function (cl) {
            const ob = {};
            ob["edit_role"] = data[i][cl.nam];
            ob["display_role"] = (!locale.isEmptyStr(cl.relnam))
                ? locale.insText(data[i]["jcol_" + cl.nam])
                : getDisplay(data[i][cl.nam], cl.udt_name, cl.dec, false, cl.checkable);
            ob["background_role"] = "#FFFFFF";
            ob["tooltip_role"] = "";
            tbl_col[cl.nam] = ob;
        });
        obj.push(tbl_col);
    }
    return obj;
};

let insertDb = async function (tbl, body, ctx = db) {
    // Предотвращаем TypeError при переборе свойств, если клиент прислал некорректный body
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new Error("Тело POST-запроса (body) должно быть валидным JSON-объектом");
    }

    const col = tbl.columns;
    const hasPk = col.some(cl => cl.is_pk);
    if (!hasPk) {
        throw new Error(`Таблица "${tbl.tablename}" не имеет объявленного первичного ключа. Операция заблокирована.`);
    }

    let colstr = "";
    let valstr = "";
    let idstr = "";

    col.forEach(function (cl) {
        if (body[cl.nam] !== null && body[cl.nam] !== undefined) {
            if (colstr != "") { colstr += ", "; valstr += ", "; }
            colstr += cl.col;
            valstr += "\${" + cl.nam + "}";
        }
        if (cl.is_pk) {
            if (idstr != "") idstr += ", ";
            idstr += cl.col;
        }
    });

    if (!colstr) throw new Error("Передан пустой объект для вставки (нет подходящих колонок)");

    let query = "INSERT INTO " + tbl.tablename + " (" + colstr + ") VALUES (" + valstr + ") RETURNING " + idstr;
    return await ctx.one(query, body);
};

let updateDb = async function (tbl, body, ctx = db) {
    // Жестко пресекаем отсутствие обязательных структурных объектов, возвращая информативную ошибку
    if (!body || !body.new_row || !body.old_row) {
        throw new Error("Операция обновления (PUT) требует обязательного наличия объектов 'new_row' и 'old_row'");
    }

    const col = tbl.columns;
    const hasPk = col.some(cl => cl.is_pk);
    if (!hasPk) {
        throw new Error(`Таблица "${tbl.tablename}" не имеет объявленного первичного ключа. Операция заблокирована.`);
    }

    let valstr = "";
    let idstr = "";
    let fltstr = "";
    let parobj = {};
    let pkobj = {};

    const new_row = body.new_row;
    const old_row = body.old_row;
    col.forEach(function (cl) {
        if (new_row[cl.nam] !== old_row[cl.nam]) {
            if (valstr != "") valstr += ", ";
            valstr += cl.col + " = \${" + cl.nam + "}";
            parobj[cl.nam] = new_row[cl.nam];
        }
        if (cl.is_pk) {
            if (idstr != "") { idstr += ", "; fltstr += " and "; }
            idstr += cl.col;
            fltstr += cl.col + " = \${pk_" + cl.col + "}";
            parobj["pk_" + cl.col] = old_row[cl.nam];
            pkobj[cl.col] = old_row[cl.nam];
        }
    });

    if (valstr.length) {
        let query = "UPDATE " + tbl.tablename + " SET " + valstr + " WHERE " + fltstr + " RETURNING " + idstr;
        return await ctx.one(query, parobj);
    }
    return pkobj;
}

let deleteDb = async function (tbl, pks, ctx = db) {
    const col = tbl.columns;

    const hasPk = col.some(cl => cl.is_pk);
    if (!hasPk) {
        throw new Error(`Таблица "${tbl.tablename}" не имеет объявленного первичного ключа. Операция заблокирована.`);
    }

    let idstr = "";
    let pkstr = "";
    const cleanPks = {};

    col.forEach(function (cl) {
        if (cl.is_pk) {
            if (idstr != "") { idstr += " and "; pkstr += ", "; }
            idstr += cl.col + " = \${" + cl.nam + "}";
            pkstr += cl.col;

            const rawVal = pks ? pks[cl.nam] : undefined;

            // Блокируем тихую подстановку NULL или падение драйвера при пустом или отсутствующем PK
            if (rawVal === undefined || rawVal === null || (Array.isArray(rawVal) && rawVal.length === 0)) {
                throw new Error(`Критическая уязвимость: не указан или пуст первичный ключ "${cl.nam}" для операции DELETE`);
            }

            cleanPks[cl.nam] = Array.isArray(rawVal) ? rawVal[0] : rawVal;
        }
    });

    let query = "DELETE FROM " + tbl.tablename + " WHERE " + idstr + " RETURNING " + pkstr;
    return await ctx.one(query, cleanPks);
}

const setSqlContext = async (t, req) => {
    const currentUser = req.user ? req.user.username : 'anonymous';
    const currentIp = req.ip || '127.0.0.1';

    await t.any(
        "SELECT set_config('app.logged_user', \$1, true), set_config('app.current_ip', \$2, true);",
        [currentUser, currentIp]
    );
};

let getData = async function (tname, req) {
    let data = {};
    const tbl = await getTblInfo(tname);

    if (req.method === "GET") {
        const { sql, params } = req.parsedFilter || { sql: "", params: {} };
        data = await selectDb(tbl, sql, params);
    } 
    else if (req.method === "POST") {
        data = await db.tx(async t => {
            await setSqlContext(t, req); 
            const pks = await insertDb(tbl, req.body, t);
            return await selectDb(tbl, getFltStr(tbl, pks), pks, t);
        });
    } 
    else if (req.method === "PUT") {
        data = await db.tx(async t => {
            await setSqlContext(t, req); 
            const pks = await updateDb(tbl, req.body, t);
            return await selectDb(tbl, getFltStr(tbl, pks), pks, t);
        });
    } 
    else if (req.method === "DELETE") {
        data = await db.tx(async t => {
            await setSqlContext(t, req); 
            return await deleteDb(tbl, req.query, t);
        });
    }
    // Генерация ошибки 405 Method Not Allowed с пробросом статус-кода
    else {
        const error = new Error(`HTTP метод "${req.method}" не поддерживается данным эндпоинтом автоматического REST`);
        error.status = 405; 
        throw error;
    }
    
    return data;
};

let getRoData = async function (title, query, param, headers, dec, decConf) {
    const data = await db.result(query, param);
    const hasHeaders = Array.isArray(headers) && headers.length > 0;

    let res = {};
    res['title'] = title;

    let arr_fields = [];

    for (let i = 0; i < data.fields.length; i++) {
        let width = 0;
        let decimal = 0;
        const colNam = data.fields[i].name;
        const udtName = mapType.get(data.fields[i].dataTypeID) || "text";

        if (decConf !== undefined && Object.hasOwn(decConf, colNam) && Object.hasOwn(decConf[colNam], "dec")) {
            decimal = decConf[colNam].dec;
        } else if (udtName === "float4" || udtName === "float8" || udtName === "numeric") {
            decimal = (dec != undefined && dec != null) ? dec : 0;
        }
        if (decConf !== undefined && Object.hasOwn(decConf, colNam) && Object.hasOwn(decConf[colNam], "width")) {
            width = decConf[colNam].width;
        }
        let ob = {};
        ob["nam"] = colNam;
        ob["udt_name"] = udtName;
        ob["snam"] = (hasHeaders && headers[i] !== undefined) ? headers[i] : colNam;
        ob["dec"] = decimal;
        ob["width"] = width;
        arr_fields.push(ob);
    }
    res['fields'] = arr_fields;

    let arr_row = [];
    for (let i = 0; i < data.rows.length; i++) {
        let tbl_col = {};
        for (let j = 0; j < arr_fields.length; j++) {
            let ob = {};
            ob["edit_role"] = data.rows[i][arr_fields[j].nam];
            ob["display_role"] = getDisplay(data.rows[i][arr_fields[j].nam], arr_fields[j].udt_name, arr_fields[j].dec, true);
            ob["background_role"] = "#FFFFFF";
            ob["tooltip_role"] = "";
            tbl_col[arr_fields[j].nam] = ob;
        }
        arr_row.push(tbl_col);
    }
    res['rows'] = arr_row;

    return res;
}

let insertRow = function (roData, objRow, pos, background_role = "#FFFFFF") {
    let tbl_row = {};
    for (let j = 0; j < roData.fields.length; j++) {
        let ob = {};
        const val = (objRow[roData.fields[j].nam] === undefined) ? null : objRow[roData.fields[j].nam];
        ob["edit_role"] = val;
        ob["display_role"] = getDisplay(val, roData.fields[j].udt_name, roData.fields[j].dec, true);
        ob["background_role"] = background_role;
        ob["tooltip_role"] = "";
        tbl_row[roData.fields[j].nam] = ob;
    }
    roData.rows.splice(pos, 0, tbl_row);
    return roData;
}

module.exports = {
    buildTreeFilter,
    parseFilterMiddleware,
    getRoData,
    insertRow,
    getData,
    updData,
    getDisplay,
    getTblInfo,
    getRelInfo,
    setSqlContext
};