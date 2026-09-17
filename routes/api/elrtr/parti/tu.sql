select nam from zvd_get_tu_var((select dat_part from parti where id = $1 ), 
    (select id_el from parti where id = $1 ), 
    (select d.id from diam as d where d.diam = (select diam from parti where id = $1 )), 
    (select id_var from parti where id = $1 ) )