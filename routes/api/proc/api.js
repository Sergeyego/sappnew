module.exports = function (app) {
    const db = require('../../../postgres.js');
    const autorest = require('../../../autorest/autorest.js');
    const XMLBuilder = require('fast-xml-builder').default;
    const { XMLParser } = require('fast-xml-parser');
    const bodyParser = require('body-parser');

    // Парсим любой XML в строку, а потом конвертируем в JS-объект
    const xmlTextParser = bodyParser.text({ type: ['application/xml', 'text/xml'] });
    const xmlParser = new XMLParser({ parseTagValue: false, parseAttributeValue: false });
    const builder = new XMLBuilder({ format: false, arrayNodeName: 'item' });

    // ==========================================
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    // ==========================================

    const sendXml = (res, data) => {
        const inner = builder.build(data);
        res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8" ?><root>' + inner + '</root>');
    };

    const sendError = (res, error) => {
        console.error('[SCADA]', error);
        res.status(error.status || 500).type('text/plain').send(error.message || String(error));
    };

    const toInt = (val, name) => {
        const n = Number(val);
        if (!Number.isFinite(n) || !Number.isInteger(n)) {
            const e = new Error(`Invalid integer for "${name}": ${val}`);
            e.status = 400;
            throw e;
        }
        return n;
    };

    const toNum = (val, name) => {
        const n = Number(val);
        if (!Number.isFinite(n)) {
            const e = new Error(`Invalid number for "${name}": ${val}`);
            e.status = 400;
            throw e;
        }
        return n;
    };

    // ==========================================
    // GET: Справочные данные
    // ==========================================

    app.get("/proc/channel/:id", async (req, res) => {
        try {
            const id = toInt(req.params.id, 'id');
            const data = await db.any(
                "select id, number, nam, color_ust, color_val, is_main, pwr from owens_trm_channel where id = $1",
                [id]
            );
            sendXml(res, data);
        } catch (error) {
            sendError(res, error);
        }
    });

    app.get("/proc/oven/:id", async (req, res) => {
        try {
            const id = toInt(req.params.id, 'id');
            const data = await db.any(
                "select id, num, pwr_cool from owens where id = $1",
                [id]
            );
            sendXml(res, data);
        } catch (error) {
            sendError(res, error);
        }
    });

    app.get("/proc/parti", async (req, res) => {
        try {
            const date = new Date();
            date.setSeconds(date.getSeconds() - 2592000); // 30 дней назад

            const data = await db.any(
                `SELECT p.n_s as num, e.marka || ' ф ' || d.sdim as mark, 
                        to_char(p.dat_part,'DD.MM.YYYY') as dat, p.id as id 
                 FROM parti as p
                 INNER JOIN elrtr as e ON e.id = p.id_el
                 LEFT JOIN diam as d ON d.diam = p.diam
                 WHERE p.id_ist = $1 AND p.dat_part > $2 
                 ORDER BY p.dat_part DESC, p.n_s DESC`,
                [1, date]
            );
            sendXml(res, data);
        } catch (error) {
            sendError(res, error);
        }
    });

    app.get("/proc/parti/:id_part", async (req, res) => {
        try {
            const id_part = toInt(req.params.id_part, 'id_part');
            const data = await db.any(
                `SELECT p.n_s as num, e.marka || ' ф ' || d.sdim as mark, 
                        to_char(p.dat_part,'DD.MM.YYYY') as dat, p.id as id 
                 FROM parti as p
                 INNER JOIN elrtr as e ON e.id = p.id_el
                 LEFT JOIN diam as d ON d.diam = p.diam
                 WHERE p.id = $1`,
                [id_part]
            );
            sendXml(res, data);
        } catch (error) {
            sendError(res, error);
        }
    });

    app.get("/proc/rabs", async (req, res) => {
        try {
            const OPERATOR_JOB_ID = '06b1dbd8-d34b-11e7-a867-0018e7159e2e';
            const data = await db.any(
                `select rr.id as id, rr.snam as nam 
                 from tab_number tn
                 inner join rab_rab rr on rr.id_kamin = tn.id
                 where tn.id_job = $1
                 order by rr.snam`,
                [OPERATOR_JOB_ID]
            );
            sendXml(res, data);
        } catch (error) {
            sendError(res, error);
        }
    });

    app.get("/proc/progs/:id_part", async (req, res) => {
        try {
            const id_part = toInt(req.params.id_part, 'id_part');
            const data = await db.any(
                "select r.id, r.nam, r.ide, r.fnam from get_dry_progs($1) as r order by r.nam",
                [id_part]
            );
            sendXml(res, data);
        } catch (error) {
            sendError(res, error);
        }
    });

    app.get("/proc/progdata/:id_prog/:vl/:temp/:id_oven", async (req, res) => {
        try {
            const id_prog = toInt(req.params.id_prog, 'id_prog');
            const vl = toNum(req.params.vl, 'vl');
            const temp = toNum(req.params.temp, 'temp');
            const id_oven = toInt(req.params.id_oven, 'id_oven');

            const data = await db.any(
                "select step, tim, tra from calc_proga_new($1, $2, $3, $4) order by step",
                [id_prog, vl, temp, id_oven]
            );
            sendXml(res, data);
        } catch (error) {
            sendError(res, error);
        }
    });

    // ==========================================
    // POST: Транзакционные операции
    // ==========================================

    app.post("/proc/newproc", xmlTextParser, async (req, res) => {
        try {
            const jsonObj = xmlParser.parse(req.body || '');
            const body = jsonObj?.root || {};
            const now = new Date();

            const id_oven = toInt(body.id_oven, 'id_oven');
            const id_rab = toInt(body.id_rab, 'id_rab');
            const id_prog = toInt(body.id_prog, 'id_prog');

            const data = await db.tx(async (t) => {
                await autorest.setSqlContext(t, req);

                return await t.one(
                    `INSERT INTO owens_rab 
                        (id_owen, id_rab, id_eldim, id_prog, n_s, zms, w0, t0, dt_beg, kvo, id_part, new_format)
                     VALUES 
                        ($1, $2, (select ide from dry_reg where id = $3), $4, $5, $6, $7, $8, $9, $10, $11, true)
                     RETURNING id`,
                    [
                        id_oven,
                        id_rab,
                        id_prog,
                        id_prog,
                        String(body.parti),
                        String(body.zms),
                        toNum(body.w0, 'w0'),
                        toNum(body.t0, 't0'),
                        now,
                        toInt(body.kvo, 'kvo'),
                        toInt(body.id_part, 'id_part'),
                    ]
                );
            });
            sendXml(res, data);
        } catch (error) {
            sendError(res, error);
        }
    });

    app.post("/proc/endproc/:id", xmlTextParser, async (req, res) => {
        try {
            const id = toInt(req.params.id, 'id');
            const jsonObj = xmlParser.parse(req.body || '');
            const body = jsonObj?.root || {};
            const energ = toNum(body.energ, 'energ');
            const now = new Date();

            const data = await db.tx(async (t) => {
                await autorest.setSqlContext(t, req);

                const updated = await t.any(
                    `update owens_rab set dt_end = $1, energ = $2 where id = $3 returning id`,
                    [now, energ, id]
                );

                await t.none(
                    `update owens_data_new set id_ow_rab = $1
                     where id_channel in (
                         select id from owens_trm_channel where id_owen = (
                             select id_owen from owens_rab where id = $1
                         )
                     )
                     and dat_time between 
                         (select dt_beg from owens_rab where id = $1) 
                         and (select dt_end from owens_rab where id = $1)`,
                    [id]
                );

                return updated;
            });
            sendXml(res, data);
        } catch (error) {
            sendError(res, error);
        }
    });

    app.post("/proc/newdata", xmlTextParser, async (req, res) => {
        try {
            const jsonObj = xmlParser.parse(req.body || '');
            const items = jsonObj?.root?.item;
            if (!items) {
                return sendXml(res, { inserted: 0 });
            }
            const arr = Array.isArray(items) ? items : [items];
            if (arr.length === 0) {
                return sendXml(res, { inserted: 0 });
            }

            const now = new Date();
            const params = [now];
            const valuesSql = arr.map((item, idx) => {
                const offset = idx * 4;
                const id_channel = toInt(item.id_channel, `item[${idx}].id_channel`);
                const ust = toNum(item.ust, `item[${idx}].ust`);
                const val = toNum(item.val, `item[${idx}].val`);
                const pwr = toNum(item.pwr, `item[${idx}].pwr`);

                params.push(id_channel, ust, val, pwr);
                return `($1, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
            }).join(', ');

            const query = `INSERT INTO owens_data_new (dat_time, id_channel, ust, val, pwr) VALUES ${valuesSql}`;

            await db.tx(async (t) => {
                await autorest.setSqlContext(t, req);
                await t.none(query, params);
            });

            sendXml(res, { inserted: arr.length });

        } catch (error) {
            sendError(res, error);
        }
    });
};