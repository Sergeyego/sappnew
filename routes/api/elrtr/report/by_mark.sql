select e.marka, p.diam, NULL, ev.nam, ep.pack_ed, 
sum(c.ostbeg), sum(c.pack), sum(c.thermo), sum(c.perepack-c.decperepack) as perepack, sum(c.perepackbreak), 
sum(c.arch - c.archout) as arch, sum(c.isp), sum(c.selfn), sum(c.oth), sum(c.war), sum(c.warout), sum(c.ostend) 
from calc_prod_report('%1','%2') as c 
inner join parti p on p.id = c.id_part 
inner join elrtr e on e.id = p.id_el 
inner join elrtr_vars ev on ev.id = p.id_var 
inner join el_pack ep on ep.id = p.id_pack 
group by e.marka, p.diam, ev.nam, ep.pack_ed 
order by e.marka, p.diam, ev.nam, ep.pack_ed