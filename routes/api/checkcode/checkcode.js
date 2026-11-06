const db = require('../../../postgres.js');

module.exports = function (app) {

    app.get("/checkcode/:code", async (req, res) => {
        try {
            const codeStr = req.params.code;
            const type = req.query.type || 'el'; // 'el' или 'wire'

            let cod;
            try {
                cod = BigInt(codeStr);
            } catch (e) {
                return res.json({ text: "КОД НЕВЕРНЫЙ!" });
            }

            // Разбиваем 64-битное число на два 32-битных (Little Endian)
            const id_s = Number(cod & 0xFFFFFFFFn);
            const id_p = Number((cod >> 32n) & 0xFFFFFFFFn);

            if (id_p === 0) {
                return res.json({ text: "КОД НЕВЕРНЫЙ!" });
            }

            let resultText = "";

            if (type === 'el') {
                resultText = await checkEl(id_p, id_s);
            } else if (type === 'wire') {
                resultText = await checkWire(id_p, id_s);
            } else {
                return res.status(400).json({ text: "Неверный тип проверки" });
            }

            if (!resultText) {
                resultText = "КОД НЕВЕРНЫЙ!";
            }

            res.json({ text: resultText });

        } catch (error) {
            console.error("CHECK CODE ERROR:", error);
            res.status(500).json({ error: error.message });
        }
    });

    async function checkEl(id_part, id_ship) {
        let str = "";
        if (id_ship !== 0) {
            const query = `
                select o.id_part, o.massa, s.nom_s, s.dat_vid, p.n_s, p.yea, p.dat_part, 
                       el.marka, p.diam, pol.naim 
                from otpusk as o 
                inner join sertifikat as s on o.id_sert=s.id 
                inner join parti as p on o.id_part=p.id 
                inner join elrtr as el on p.id_el=el.id 
                inner join poluch as pol on s.id_pol=pol.id 
                where o.id = $1`;

            const rows = await db.any(query, [id_ship]);

            for (const row of rows) {
                str += `ОТГРУЗКА № ${row.nom_s} от ${formatDate(row.dat_vid)} грузополучатель: ${row.naim}\n`;
                str += `Марка ${row.marka}\n`;
                str += `Диаметр ${row.diam}\n`;
                str += `Партия ${row.n_s}\n`;
                str += `Дата производства ${formatDate(row.dat_part)}\n`;

                if (row.id_part !== id_part) {
                    str += `ПАРТИЯ НЕ ПРИНАДЛЕЖИТ ДАННОЙ ОТГРУЗКЕ! КОД НЕВЕРНЫЙ!\n`;
                }
            }
        } else {
            str += `СЕРТИФИКАТ НА ПАРТИЮ\n`;
            const query = `
                select p.n_s, p.dat_part, el.marka, p.diam 
                from parti as p 
                inner join elrtr as el on p.id_el=el.id 
                where p.id = $1`;

            const rows = await db.any(query, [id_part]);

            for (const row of rows) {
                str += `Марка ${row.marka}\n`;
                str += `Диаметр ${row.diam}\n`;
                str += `Партия ${row.n_s}\n`;
                str += `Дата производства ${formatDate(row.dat_part)}\n`;
            }
        }
        return str;
    }

    async function checkWire(id_part, id_ship) {
        let str = "";
        if (id_ship !== 0) {
            const query = `
                select w.id_wparti, w.m_netto, s.nom_s, s.dat_vid, m.n_s, date_part('year',m.dat) as year, m.dat, 
                       b.n_plav, pprov.nam, d.sdim as diam, k.nam as k_nam, pol.naim 
                from wire_shipment_consist as w 
                inner join sertifikat as s on w.id_ship=s.id 
                inner join wire_parti as p on w.id_wparti=p.id 
                inner join wire_parti_m as m on p.id_m=m.id 
                inner join prov_buht as b on m.id_buht=b.id 
                inner join prov_prih as pr on b.id_prih=pr.id 
                inner join provol as pprov on m.id_provol=pprov.id 
                inner join diam as d on m.id_diam=d.id 
                inner join poluch as pol on s.id_pol=pol.id 
                inner join wire_pack_kind as k on p.id_pack=k.id 
                where w.id = $1`;

            const rows = await db.any(query, [id_ship]);

            for (const row of rows) {
                str += `ОТГРУЗКА № ${row.nom_s} от ${formatDate(row.dat_vid)} грузополучатель: ${row.naim}\n`;
                str += `Марка ${row.nam}\n`;
                str += `Диаметр ${row.diam}\n`;
                str += `Намотка ${row.k_nam}\n`;
                str += `Плавка ${row.n_plav}\n`;
                str += `Партия ${row.n_s}\n`;
                str += `Дата производства ${formatDate(row.dat)}\n`;

                if (row.id_wparti !== id_part) {
                    str += `ПАРТИЯ НЕ ПРИНАДЛЕЖИТ ДАННОЙ ОТГРУЗКЕ! КОД НЕВЕРНЫЙ!\n`;
                }
            }
        } else {
            str += `СЕРТИФИКАТ НА ПАРТИЮ\n`;
            const query = `
                select m.n_s as n_s, date_part('year',m.dat) as year, m.dat as dat, 
                       b.n_plav as n_plav, prov.nam as nam, d.sdim as diam, k.nam as k_nam
                from wire_parti as p 
                inner join wire_parti_m as m on p.id_m=m.id 
                inner join prov_buht as b on m.id_buht=b.id 
                inner join prov_prih as pr on b.id_prih=pr.id 
                inner join provol as prov on m.id_provol=prov.id 
                inner join diam as d on m.id_diam=d.id 
                inner join wire_pack_kind as k on p.id_pack=k.id 
                where p.id = $1`;

            const rows = await db.any(query, [id_part]);

            for (const row of rows) {
                str += `Марка ${row.nam}\n`;
                str += `Диаметр ${row.diam}\n`;
                str += `Намотка ${row.k_nam}\n`;
                str += `Плавка ${row.n_plav}\n`;
                str += `Партия ${row.n_s}\n`;
                str += `Дата производства ${formatDate(row.dat)}\n`;
            }
        }
        return str;
    }

    // Хелпер для форматирования даты в "dd.MM.yy"
    function formatDate(dateVal) {
        if (!dateVal) return "";
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return "";
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = String(d.getFullYear()).slice(-2);
        return `${day}.${month}.${year}`;
    }
};