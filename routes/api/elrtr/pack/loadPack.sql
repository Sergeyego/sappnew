insert into parti_pack (id_nakl, id_part, kvo) ( 
select $1, epo.id_parti, sum(epo.kvo) 
from el_pallet_op epo 
where (epo.dtm)::date = $2 and epo.id_main_rab = $3 and epo.id_src = 1 
group by epo.id_parti)