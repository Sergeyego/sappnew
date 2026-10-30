const db = require('../../../../postgres.js');
const autorest = require('../../../../autorest/autorest.js');
var bodyParser = require('body-parser');

module.exports = function (app) {

    app.get("/elrtr/variants/list/:id_el", async (req, res) => {
        try {
            const query = `select ev2.id as id, ev2.nam as nam from el_var ev 
                inner join elrtr_vars ev2 on ev2.id = ev.id_var 
                where id_el = $1 order by ev.id_var`;
            const header = ["id", "Наименование"];
            const param = {
                id: { "width": -1 },
            };
            const data = await autorest.getRoData("Варианты марки", query, [Number(req.params["id_el"])], header, 1, param);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.get("/elrtr/variants/get/:id_el/:id_var", async (req, res) => {
        try {
            const id_el = parseInt(req.params.id_el, 10);
            const id_var = parseInt(req.params.id_var, 10);
            if (isNaN(id_el) || isNaN(id_var)) {
                return res.status(400).type('text/plain').send("Некорректные параметры id_el, id_var");
            }
            const query = `select znam, descr, proc, descrtu, id_gost_type from el_var where id_el = $1 and id_var = $2`;
            const data = await autorest.getRoData("Вариант марки", query, [id_el, id_var]);
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.post("/elrtr/variants/post/:id_el/:id_var", bodyParser.json(), async (req, res) => {
        try {
            const id_el = parseInt(req.params.id_el, 10);
            const id_var = parseInt(req.params.id_var, 10);
            if (isNaN(id_el) || isNaN(id_var)) {
                return res.status(400).type('text/plain').send("Некорректные параметры id_el, id_var");
            }
            const data = await db.tx(async t => {
                await autorest.setSqlContext(t, req);
                const query = `insert into el_var (id_el, id_var, znam, descr, proc, descrtu, id_gost_type) values 
                    ($1, $2, 
                    (select nam from denominator where id = (select id_denominator from elrtr as e where e.id = $1 )), 
                    (select e.descr from elrtr as e where e.id = $1 ),
                    (SELECT split_part(pr2, ':', 1) || '±' || split_part(pr2, ':', 2) || '°C ' || split_part(pr2, ':', 3) || ' ' || split_part(pr2, ':', 4) AS formatted_pr2 FROM elrtr WHERE id = $1 ), 
                    (select descrtu from el_var where id_el = $1 and id_var=1), 
                    (select e.id_gost_type from elrtr as e where e.id = $1 ))`;
                return await t.any(query, [id_el, id_var]);
            });
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.delete("/elrtr/variants/delete/:id_el/:id_var", async (req, res) => {
        try {
            const id_el = parseInt(req.params.id_el, 10);
            const id_var = parseInt(req.params.id_var, 10);

            if (isNaN(id_el) || isNaN(id_var)) {
                return res.status(400).type('text/plain').send("Некорректные параметры id_el, id_var");
            }
            const data = await db.tx(async t => {
                await autorest.setSqlContext(t, req);

                const params = { id_el, id_var };

                await t.none(`DELETE FROM el_var WHERE id_el = $(id_el) AND id_var = $(id_var)`, params);
                await t.none(`DELETE FROM amp WHERE id_el = $(id_el) AND id_var = $(id_var)`, params);
                await t.none(`DELETE FROM chem_tu WHERE id_el = $(id_el) AND id_var = $(id_var)`, params);
                await t.none(`DELETE FROM mech_tu WHERE id_el = $(id_el) AND id_var = $(id_var)`, params);
                await t.none(`DELETE FROM gost_el WHERE id_el = $(id_el) AND id_var = $(id_var)`, params);
                await t.none(`DELETE FROM amp_tu WHERE id_el = $(id_el) AND id_var = $(id_var)`, params);
                await t.none(`DELETE FROM el_int_class WHERE id_el = $(id_el) AND id_var = $(id_var)`, params);

                return { success: true };
            });
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.put("/elrtr/variants/put/:id_el/:id_var", bodyParser.json(), async (req, res) => {
        try {

            const id_el = parseInt(req.params.id_el, 10);
            const id_var = parseInt(req.params.id_var, 10);
            if (isNaN(id_el) || isNaN(id_var)) {
                return res.status(400).type('text/plain').send("Некорректные параметры id_el, id_var");
            }

            const data = await db.tx(async t => {
                await autorest.setSqlContext(t, req);

                const query = `update el_var set 
                            znam = $(znam), 
                            descr = $(descr), 
                            proc = $(proc), 
                            descrtu = $(descrtu), 
                            id_gost_type = $(id_gost_type) 
                            where id_el = $(id_el) and id_var = $(id_var)`;

                const params = {
                    id_el: id_el,
                    id_var: id_var,
                    znam: req.body.znam,
                    descr: req.body.descr,
                    proc: req.body.proc,
                    descrtu: req.body.descrtu,
                    id_gost_type: req.body.id_gost_type !== undefined ? req.body.id_gost_type : null
                };

                return await t.any(query, params);
            });
            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.post("/elrtr/variants/copy/:id_el/:id_var", bodyParser.json(), async (req, res) => {
        try {
            // Целевые параметры (куда копируем) из URL
            const id_el = parseInt(req.params.id_el, 10);
            const id_var = parseInt(req.params.id_var, 10);

            // Исходные параметры (откуда копируем) из тела запроса JSON
            const id_el_src = parseInt(req.body.id_el_src, 10);
            const id_var_src = parseInt(req.body.id_var_src, 10);

            // Валидация входных данных
            if (isNaN(id_el) || isNaN(id_var) || isNaN(id_el_src) || isNaN(id_var_src)) {
                return res.status(400).type('text/plain').send("Некорректные параметры id_el, id_var, id_el_src или id_var_src");
            }

            if (id_el === id_el_src && id_var === id_var_src) {
                return res.status(400).type('text/plain').send("Нельзя копировать вариант в самого себя");
            }

            const result = await db.tx(async t => {
                await autorest.setSqlContext(t, req);

                const params = { id_el, id_var, id_el_src, id_var_src };

                // 0. Копирование основных параметров (znam, descr, proc, descrtu, id_gost_type) в el_var
                await t.none(`
                    UPDATE el_var 
                    SET 
                        znam = src.znam,
                        descr = src.descr,
                        proc = src.proc,
                        descrtu = src.descrtu,
                        id_gost_type = src.id_gost_type
                    FROM el_var AS src
                    WHERE el_var.id_el = $(id_el) AND el_var.id_var = $(id_var)
                      AND src.id_el = $(id_el_src) AND src.id_var = $(id_var_src)
                `, params);

                // 1. Обработка amp
                await t.none(`DELETE FROM amp WHERE id_el = $(id_el) AND id_var = $(id_var)`, params);
                await t.none(`
                    INSERT INTO amp (id_el, id_diam, bot, vert, ceil, id_var)
                    SELECT $(id_el), id_diam, bot, vert, ceil, $(id_var)
                    FROM amp 
                    WHERE id_el = $(id_el_src) AND id_var = $(id_var_src)
                `, params);

                // 2. Обработка chem_tu
                await t.none(`DELETE FROM chem_tu WHERE id_el = $(id_el) AND id_var = $(id_var)`, params);
                await t.none(`
                    INSERT INTO chem_tu (id_el, id_var, id_chem, min, max)
                    SELECT $(id_el), $(id_var), id_chem, min, max
                    FROM chem_tu 
                    WHERE id_el = $(id_el_src) AND id_var = $(id_var_src)
                `, params);

                // 3. Обработка mech_tu
                await t.none(`DELETE FROM mech_tu WHERE id_el = $(id_el) AND id_var = $(id_var)`, params);
                await t.none(`
                    INSERT INTO mech_tu (id_el, id_var, id_mech, min, max)
                    SELECT $(id_el), $(id_var), id_mech, min, max
                    FROM mech_tu 
                    WHERE id_el = $(id_el_src) AND id_var = $(id_var_src)
                `, params);

                // 4. Обработка gost_el
                await t.none(`DELETE FROM gost_el WHERE id_el = $(id_el) AND id_var = $(id_var)`, params);
                await t.none(`
                    INSERT INTO gost_el (id_el, id_var, id_gost, dat, dat_end)
                    SELECT $(id_el), $(id_var), id_gost, dat, dat_end
                    FROM gost_el 
                    WHERE id_el = $(id_el_src) AND id_var = $(id_var_src)
                `, params);

                // 5. Обработка amp_tu
                await t.none(`DELETE FROM amp_tu WHERE id_el = $(id_el) AND id_var = $(id_var)`, params);
                await t.none(`
                    INSERT INTO amp_tu (id_el, id_diam, bot, vert, ceil, id_var, lay, id_polar)
                    SELECT $(id_el), id_diam, bot, vert, ceil, $(id_var), lay, id_polar
                    FROM amp_tu 
                    WHERE id_el = $(id_el_src) AND id_var = $(id_var_src)
                `, params);

                // 6. Обработка el_int_class
                await t.none(`DELETE FROM el_int_class WHERE id_el = $(id_el) AND id_var = $(id_var)`, params);
                await t.none(`
                    INSERT INTO el_int_class (id_el, id_var, id_class, val)
                    SELECT $(id_el), $(id_var), id_class, val
                    FROM el_int_class 
                    WHERE id_el = $(id_el_src) AND id_var = $(id_var_src)
                `, params);

                return { success: true };
            });

            res.json(result);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });
};
