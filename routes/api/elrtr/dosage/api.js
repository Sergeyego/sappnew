module.exports = function (app) {
    const db = require('../../../../postgres.js');
    const autorest = require('../../../../autorest/autorest.js'); // если RLS включён — нужен setSqlContext
    const XMLBuilder = require('fast-xml-builder').default;
    const { XMLParser } = require('fast-xml-parser');
    const bodyParser = require('body-parser');

    // Парсим любой XML в строку, а потом конвертируем в JS-объект
    const xmlTextParser = bodyParser.text({ type: ['application/xml', 'text/xml'] });
    const xmlParser = new XMLParser({ parseTagValue: false, parseAttributeValue: false });
    const builder = new XMLBuilder({ format: false, arrayNodeName: 'item' });

    // ==========================================
    // Хелперы
    // ==========================================

    const sendXml = (res, data) => {
        const inner = builder.build(data);
        res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8" ?><root>' + inner + '</root>');
    };

    const sendError = (res, error) => {
        console.error('[dosage]', error);
        res.status(error.status || 500).type('text/plain').send(error.message || String(error));
    };

    const toInt = (val, name) => {
        if (val === "" || val === null || val === undefined) return null;
        const n = Number(val);
        if (!Number.isFinite(n) || !Number.isInteger(n)) {
            const e = new Error(`Invalid integer for "${name}": ${val}`);
            e.status = 400; throw e;
        }
        return n;
    };

    const toNum = (val, name) => {
        if (val === "" || val === null || val === undefined) return null;
        const n = Number(val);
        if (!Number.isFinite(n)) {
            const e = new Error(`Invalid number for "${name}": ${val}`);
            e.status = 400; throw e;
        }
        return n;
    };

    const pad2 = (n) => String(n).padStart(2, '0');
    const fmtDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const fmtTime = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

    const parseDtm = (req) => {
        const date = new Date();
        if (req.query.dtm) {
            const parsed = new Date(req.query.dtm);
            if (isNaN(parsed.getTime())) {
                const e = new Error("Неверный формат query-параметра dtm");
                e.status = 400; throw e;
            }
            date.setTime(parsed.getTime());
        }
        return date;
    };

    // ==========================================
    // GET: Рецепты и дозирование
    // ==========================================

    app.get("/elrtr/dosage/recipes", async (req, res) => {
        try {
            const data = await db.any(
                "select id as id, nam as nam from rcp_nam where lev = 1 order by nam"
            );
            sendXml(res, data);
        } catch (error) {
            sendError(res, error);
        }
    });

    app.get("/elrtr/dosage/recipes/:id", async (req, res) => {
        try {
            const id = toInt(req.params.id, 'id');
            const data = await db.any(
                `select rc.id_matr as id_matr,
                        'Компонент '||floor(random()*(1000-1)+1) as nam,
                        m.nam as fnam,
                        rc.kvo as kvo
                 from rcp_cont rc
                 inner join matr m on rc.id_matr = m.id
                 where rc.id_rcp = $1 and rc.hidden = 0 and m.cod <> 'g'
                 order by fnam`,
                [id]
            );
            sendXml(res, data);
        } catch (error) {
            sendError(res, error);
        }
    });

    app.get("/elrtr/dosage/recipes/:cex/:id/:mas", async (req, res) => {
        try {
            const id_rcp = toInt(req.params.id, 'id');
            const id_cex = toInt(req.params.cex, 'cex');
            const mas    = toNum(req.params.mas, 'mas');
            const date   = parseDtm(req);
            const dtm    = fmtDate(date) + ' ' + fmtTime(date);

            const data = await db.any(
                `select num as num, parti as parti, kvo as kvo, tiny as tiny,
                        nbunk as nbunk, id_bunk as id_bunk, nam as nam, id_matr as id_matr
                 from calc_doz_new($1, $2, $3, $4)`,
                [mas, dtm, id_rcp, id_cex]
            );
            sendXml(res, data);
        } catch (error) {
            sendError(res, error);
        }
    });

    // ==========================================
    // POST: Создание дозирования
    // ==========================================

    app.post("/elrtr/dosage/recipes/:cex/:id/:mas", xmlTextParser, async (req, res) => {
        try {
            const id_rcp = toInt(req.params.id, 'id');
            const id_cex = toInt(req.params.cex, 'cex');
            const mas    = toNum(req.params.mas, 'mas');
            const date   = parseDtm(req);

            const body  = xmlParser.parse(req.body || '')?.root || {};
            const items = body.item || [];   // isArray гарантирует массив
            if (items.length === 0) {
                const e = new Error("Тело запроса не содержит ни одной позиции <item>");
                e.status = 400; throw e;
            }

            // Валидируем и нормализуем ДО транзакции
            const rows = items.map((it, i) => ({
                id_matr: toInt(it.idmatr,  `item[${i}].idmatr`),
                kvo:     toNum(it.kvo,     `item[${i}].kvo`),
                id_bunk: toInt(it.idbunk,  `item[${i}].idbunk`),
                parti:   (it.parti === undefined || it.parti === null) ? null : String(it.parti)
            }));

            const result = await db.tx(async (t) => {
                if (autorest?.setSqlContext) await autorest.setSqlContext(t, req);

                // 1. Заголовок дозирования
                const dos = await t.one(
                    `insert into dosage (id_rcp, dat, tm, kvo_tot, id_cex)
                     values ($1, $2, $3, $4, $5)
                     returning id`,
                    [id_rcp, fmtDate(date), fmtTime(date), mas, id_cex]
                );

                // 2. Состав — параметризованно, без конкатенации
                const params = [dos.id];
                const valuesSql = rows.map((r, i) => {
                    const b = i * 4 + 2;
                    params.push(r.id_matr, r.kvo, r.id_bunk, r.parti);
                    return `($1, $${b}, $${b + 1}, $${b + 2}, $${b + 3})`;
                }).join(', ');

                await t.none(
                    `insert into dosage_spnd (id_dos, id_comp, kvo_comp, id_bunk, parti)
                     values ${valuesSql}`,
                    params
                );

                return dos;
            });

            sendXml(res, result);
        } catch (error) {
            sendError(res, error);
        }
    });

    // ==========================================
    // POST: Обновление факта и результата
    // ==========================================

    app.post("/elrtr/dosage/dosage/:iddos/:idcomp/:idbunk", xmlTextParser, async (req, res) => {
        try {
            const iddos   = toInt(req.params.iddos,  'iddos');
            const idcomp  = toInt(req.params.idcomp, 'idcomp');
            const idbunk  = toInt(req.params.idbunk, 'idbunk');

            const body    = xmlParser.parse(req.body || '')?.root || {};
            const kvofact = toNum(body.kvofact, 'kvofact');

            const data = await db.tx(async (t) => {
                if (autorest?.setSqlContext) await autorest.setSqlContext(t, req);
                return await t.any(
                    `update dosage_spnd set kvo_fact = $1
                     where id_dos = $2 and id_comp = $3 and id_bunk = $4
                     returning id_dos, id_comp, id_bunk`,
                    [kvofact, iddos, idcomp, idbunk]
                );
            });

            sendXml(res, data);
        } catch (error) {
            sendError(res, error);
        }
    });

    app.post("/elrtr/dosage/result/:iddos", xmlTextParser, async (req, res) => {
        try {
            const iddos  = toInt(req.params.iddos, 'iddos');
            const body   = xmlParser.parse(req.body || '')?.root || {};
            const result = toInt(body.result, 'result');

            const data = await db.tx(async (t) => {
                if (autorest?.setSqlContext) await autorest.setSqlContext(t, req);
                return await t.any(
                    `update dosage set result = $1
                     where id = $2
                     returning id, result`,
                    [result, iddos]
                );
            });

            sendXml(res, data);
        } catch (error) {
            sendError(res, error);
        }
    });
};