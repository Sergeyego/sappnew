const db = require('../../../../postgres.js');
const autorest = require('../../../../autorest/autorest.js');
const bodyParser = require('body-parser');

module.exports = function (app) {

    app.get("/elrtr/dosage/list/:dbeg/:dend", async (req, res) => {
        try {
            let query = `
                select d.id as id, d.dat as dat, d.tm as tm, rn.nam as rcp, d.kvo_tot as kvo, ds.nam as stat, d.parti as parti, d."result" as id_st
                from dosage d 
                inner join rcp_nam rn on rn.id = d.id_rcp 
                inner join dosage_stat ds on ds.id = d."result"
                where d.dat between $1 and $2
                order by d.dat, d.tm 
            `;
            const header = ["id", "Дата", "Время", "Рецептура", "Кол-во, кг", "Статус", "Партия"];
            const param = {
                id: { "width": -1 },
                dat: { "width": 80 },
                tm: { "width": 60 },
                rcp: { "width": 190 },
                kvo: { "width": 70 },
                stat: { "width": 100 },
                parti: { "width": 70 },
                id_st: { "width": -1 }
            };
            let data = await autorest.getRoData("Партии дозировки", query, [req.params.dbeg, req.params.dend], header, 1, param);

            for (let i = 0; i < data.rows.length; i++) {
                const row = data.rows[i];
                const id_st = row["id_st"].edit_role;
                let color = "#FFFFFF";
                if (id_st === 1) {
                    color = "#AAFFAA";
                } else if (id_st === 2) {
                    color = "#FFFF00";
                } else if (id_st === 3) {
                    color = "#FFC864";
                }
                for (let j = 0; j < data.fields.length; j++) {
                    const fieldName = data.fields[j].nam;
                    if (row[fieldName]) {
                        row[fieldName].background_role = color;
                    }
                }
            }

            res.json(data);
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    app.patch("/elrtr/dosage/patch/:id_part", bodyParser.json(), async (req, res) => {
        try {
            const allowedFields = ['parti', 'result'];

            let setParts = [];
            let returningFields = ['id']; // ID возвращаем всегда, чтобы фронтенд знал, какая строка обновилась
            let params = [req.params.id_part]; // \$1 — это всегда id_part
            let paramIndex = 2; // Переменные для SET начинаются с \$2

            // Обходим разрешенные поля
            const body = req.body || {};
            allowedFields.forEach(field => {
                if (body[field] !== undefined) {
                    setParts.push(`${field} = $${paramIndex}`);
                    returningFields.push(field);
                    params.push(body[field]);
                    paramIndex++;
                }
            });

            // Если клиент не передал ни одного разрешенного поля
            if (setParts.length === 0) {
                return res.status(400).type('text/plain').send('Нет данных для обновления или поля недопустимы');
            }

            // Выполняем обновление в транзакции
            const data = await db.tx(async t => {
                // Контекст для триггеров
                await autorest.setSqlContext(t, req);

                // Собираем SQL-запрос с динамическим SET и динамическим RETURNING
                const query = `UPDATE dosage SET ${setParts.join(', ')} WHERE id = $1 RETURNING ${returningFields.join(', ')};`;

                return await t.oneOrNone(query, params);
            });

            // Если запись не найдена в БД
            if (!data) {
                return res.status(404).type('text/plain').send('Партия с указанным ID не найдена');
            }

            // Клиент получит объект, содержащий только id и измененные им поля
            res.json(data);

        } catch (error) {
            console.error("Ошибка при обновлении партии дозировки:", error);
            res.status(500).type('text/plain').send(error.message);
        }
    });
}