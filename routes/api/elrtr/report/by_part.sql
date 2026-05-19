select e.marka, p.diam, p.n_s||'-'||date_part('year',p.dat_part) as part, ev.nam as var, ep.pack_ed, 
c.ostbeg, c.pack, c.thermo, c.perepack-c.decperepack as perepack, c.perepackbreak, 
c.arch - c.archout as arch, c.isp, c.selfn, c.oth, c.war, c.warout, c.ostend 
from calc_prod_report($1::date - 1,$2::date) as c 
inner join parti p on p.id = c.id_part 
inner join elrtr e on e.id = p.id_el 
inner join elrtr_vars ev on ev.id = p.id_var 
inner join el_pack ep on ep.id = p.id_pack 
order by e.marka, p.diam, part, ev.nam, ep.pack_ed