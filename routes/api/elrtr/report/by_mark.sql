select e.marka as marka, p.diam as diam, ev.nam as var, ep.pack_ed as pack_ed, 
sum(c.ostbeg) as ostbeg, sum(c.pack) as pack, sum(c.thermo) as thermo, 
sum(c.perepack-c.decperepack) as perepack, sum(c.perepackbreak) as perepackbreak, 
sum(c.arch - c.archout) as arch, sum(c.isp) as isp, sum(c.selfn) as selfn, sum(c.oth) as oth, 
sum(c.war) as war, sum(c.warout) as warout, sum(c.ostend) as ostend
from calc_prod_report($1::date -1, $2::date) as c 
inner join parti p on p.id = c.id_part 
inner join elrtr e on e.id = p.id_el 
inner join elrtr_vars ev on ev.id = p.id_var 
inner join el_pack ep on ep.id = p.id_pack 
group by e.marka, p.diam, ev.nam, ep.pack_ed 
order by e.marka, p.diam, ev.nam, ep.pack_ed