(select d.proc, m.nam, l.part_lump, l.modul, d.id_load as id_korr_load, NULL as id_sump_load
from glass_korr_load_data as d 
inner join glass_sump_load as l on l.id=d.id_sump_load 
inner join matr as m on m.id=l.id_matr 
inner join glass_sump as s on s.id=l.id_sump 
where d.id_load = (select id_korr_load from glass_cons_load where id = $1 ) order by proc) 
union 
(select 100.0, mm.nam, ll.part_lump, ll.modul, NULL, ll.id 
from glass_sump_load as ll 
inner join matr as mm on mm.id=ll.id_matr 
inner join glass_sump as ss on ss.id=ll.id_sump 
where ll.id = (select id_sump_load from glass_cons_load where id = $1 ))