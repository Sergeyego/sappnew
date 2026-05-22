select gcl.id  from glass_cons_load as gcl 
where gcl.dat_load = (select max(gcl2.dat_load) from glass_cons_load as gcl2 
where gcl2.dat_load<=(select p.dat_part from parti as p where p.id = $1 ) 
and gcl2.id_cons=gcl.id_cons) and gcl.id_cons = $2 