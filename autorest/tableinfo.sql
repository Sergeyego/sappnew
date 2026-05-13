select rtd.nam, rtd.col, rtd.snam, c.udt_name, pks.column_name is not null as is_pk,
rtd.editable, rtd.checkable ,rtd.dec, rr.nam as relnam, rtd.width as width
from rest_tables rt
inner join rest_tables_data rtd on rtd.id_table = rt.id
inner join information_schema.columns c on c.column_name = rtd.col and c.table_name = rt.tablename
left join (
select kcu.column_name as column_name from information_schema.key_column_usage as kcu
inner join information_schema.table_constraints as tc on tc.constraint_name = kcu.constraint_name and tc.table_name = kcu.table_name and tc.constraint_type = 'PRIMARY KEY'
where kcu.table_name = $1
) as pks on pks.column_name = rtd.col
left join rest_rels rr on rr.id = rtd.id_rel
where rt.tablename = $1 order by rtd.id
