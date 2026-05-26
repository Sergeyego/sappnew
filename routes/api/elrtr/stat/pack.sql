select pn.dat, pn.num, pp.kvo  from parti_pack pp 
inner join parti_nakl pn on pn.id = pp.id_nakl 
where pp.id_part = $1 order by pn.dat, pn.num