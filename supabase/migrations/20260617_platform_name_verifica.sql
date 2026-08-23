update public.platform_settings
set platform_name = 'Verifica'
where key = 'default'
  and platform_name in ('VerificWash', 'VerificaWash', 'VerificaWash Control');
