select distinct epo.id_main_rab as id, ke.snam as snam 
from el_pallet_op epo 
inner join kamin_empl ke on ke.id = epo.id_main_rab 
where (epo.dtm)::date = $1 
order by ke.snam