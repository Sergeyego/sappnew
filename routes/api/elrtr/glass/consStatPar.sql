select gp.nam, jp.val, jp.temp, jp.dat from 
(select id_load, id_param, max(dat) as dat 
from glass_cons_load_par as p where id_load = $1 
and dat<=(select dat_part from parti where id = $2 ) 
group by id_param, id_load) as p 
inner join glass_cons_load_par as jp on jp.id_load=p.id_load and jp.id_param=p.id_param and jp.dat=p.dat 
inner join glass_par as gp on (gp.id=jp.id_param) 
order by jp.id_param desc, jp.dat