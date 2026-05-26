select pn.dat, pn.num, pb.kvo 
from parti_break pb 
inner join parti_nakl pn on pn.id = pb.id_nakl 
where pn.tip=2 and pb.id_part = $1 
order by pn.dat, pn.num