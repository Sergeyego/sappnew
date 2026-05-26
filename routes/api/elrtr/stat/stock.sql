select pn.dat, pn.num, i.nam as ist, p.kvo*i.koef as kvo, p.barcodecont 
from prod p 
inner join prod_nakl pn on pn.id=p.id_nakl 
inner join istoch i on i.id=pn.id_ist 
where p.id_part = $1
order by pn.dat, pn.num