update public.operation_boxes
set name = case
  when name = 'Esteira de entrada' then 'Entrada'
  when name = 'Box 01 - Lavagem' then 'Etapa 01 - Execução'
  when name = 'Box 02 - Secagem' then 'Etapa 02 - Conferência'
  when name = 'Retirada' then 'Concluído'
  else name
end
where name in ('Esteira de entrada', 'Box 01 - Lavagem', 'Box 02 - Secagem', 'Retirada');
