select s.dat_vid, s.nom_s, p.short, o.massa as kvo
from otpusk o 
inner join sertifikat s on o.id_sert=s.id 
inner join poluch p on s.id_pol=p.id 
where o.id_part = $1 and s.id_type = 1 
order by s.dat_vid, s.nom_s