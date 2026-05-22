select l.id_load, p.nam, l.val, l.temp, l.dat 
from glass_korr_load_par as l 
inner join glass_par as p on p.id=l.id_param 
where l.id_load = (select id_korr_load from glass_cons_load where id = $1)