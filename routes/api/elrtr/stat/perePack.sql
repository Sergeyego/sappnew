select * from ( 
(select pn.dat as dat, pn.num as num, 
(case when pp.id_new_part<>0 then'Переуп. в парт. '||p.n_s ||'-'||date_part('year',p.dat_part) else 'Брак при переуп.' end) as part, 
pp.kvo*(-1) as kvo, pp.kvo_break as brk 
from parti_perepack pp 
inner join parti_nakl pn on pn.id = pp.id_nakl 
inner join parti p on p.id = pp.id_new_part 
where pp.id_part = $1 and  pn.tip = 7 ) 
union 
(select pn.dat as dat, pn.num as num, 'Переуп. из парт. '||p.n_s ||'-'||date_part('year',p.dat_part) as part, 
pp.kvo as kvo, pp.kvo_break as brk 
from parti_perepack pp 
inner join parti_nakl pn on pn.id = pp.id_nakl 
inner join parti p on p.id = pp.id_part 
where pp.id_new_part = $1 and  pn.tip = 7 ) 
) as z order by z.dat, z.num