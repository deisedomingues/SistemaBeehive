alter table public.funcionario
  add column funcao text
  check (funcao is null or char_length(btrim(funcao)) between 1 and 120);

notify pgrst, 'reload schema';
