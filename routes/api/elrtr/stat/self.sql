select ps.dat, ps.num, ps.kto, psi.kvo*sc.koef*(-1) as kvo 
from prod_self_items psi 
inner join prod_self ps on ps.id = psi.id_self 
inner join self_cons sc on sc.id = psi.id_cons 
where psi.id_part = $1 order by ps.dat, ps.num