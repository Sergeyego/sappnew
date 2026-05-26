select epo.dtm, ke.snam, epo.kvo, p.nam as pal
from el_pallet_op epo 
left join kamin_empl ke on ke.id = epo.id_rab 
left join pallets p ON p.id = epo.id_pallet 
where epo.id_parti = $1 and epo.id_src = 0 
order by epo.dtm