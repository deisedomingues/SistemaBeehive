create policy financeiro_fixo_admin_insert on public.financeiro_fixo
  for insert to authenticated with check ((select private.beehive_is_admin()));
create policy financeiro_fixo_admin_update on public.financeiro_fixo
  for update to authenticated using ((select private.beehive_is_admin()))
  with check ((select private.beehive_is_admin()));
create policy financeiro_parcela_admin_insert on public.financeiro_fixo_parcela
  for insert to authenticated with check ((select private.beehive_is_admin()));

create policy custo_adicional_admin_select on public.custo_adicional
  for select to authenticated using ((select private.beehive_is_admin()));
create policy custo_adicional_admin_insert on public.custo_adicional
  for insert to authenticated with check ((select private.beehive_is_admin()));
create policy custo_adicional_admin_update on public.custo_adicional
  for update to authenticated using ((select private.beehive_is_admin()))
  with check ((select private.beehive_is_admin()));

grant select, insert, update on public.financeiro_fixo, public.custo_adicional to authenticated;
grant select, insert on public.financeiro_fixo_parcela to authenticated;

create function public.cadastrar_custo_fixo(
  p_nome text, p_descricao text, p_inicio date, p_fim date,
  p_professor_id bigint, p_funcionario_id bigint, p_dias integer[],
  p_valores numeric[], p_observacao text
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  novo_id bigint;
  total numeric;
begin
  if not (select private.beehive_is_admin()) then
    raise exception 'Acesso restrito à administração' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_valores), 0) not between 1 and 2
    or cardinality(p_valores) is distinct from cardinality(p_dias)
    or exists (select 1 from unnest(p_valores) as valor where valor is null or valor <= 0 or valor <> round(valor, 2))
    or exists (select 1 from unnest(p_dias) as dia where dia is null or dia not between 1 and 31)
    or p_inicio is null or p_fim < p_inicio
    or nullif(btrim(p_nome), '') is null or nullif(btrim(p_descricao), '') is null
    or (p_professor_id is not null and p_funcionario_id is not null) then
    raise exception 'Confira o favorecido, a vigência e as parcelas do custo fixo.';
  end if;

  select sum(valor) into total from unnest(p_valores) as valor;
  insert into public.financeiro_fixo
    (tipo, pessoa_nome, professor_id, funcionario_id, descricao, valor_mensal,
     forma_pagamento, data_inicio, data_fim, observacao)
  values
    (case when p_professor_id is null then 'administrativo' else 'professor' end,
     btrim(p_nome), p_professor_id, p_funcionario_id, btrim(p_descricao), total,
     case when cardinality(p_valores) = 1 then 'unica' else 'duas_parcelas' end,
     p_inicio, p_fim, nullif(btrim(p_observacao), ''))
  returning id into novo_id;

  insert into public.financeiro_fixo_parcela (financeiro_fixo_id, numero_parcela, dia_vencimento, valor)
  select novo_id, pos, p_dias[pos], p_valores[pos]
  from generate_subscripts(p_valores, 1) as pos;
  return novo_id;
end;
$$;

revoke all on function public.cadastrar_custo_fixo(text,text,date,date,bigint,bigint,integer[],numeric[],text) from public, anon;
grant execute on function public.cadastrar_custo_fixo(text,text,date,date,bigint,bigint,integer[],numeric[],text) to authenticated;

create table public.financeiro_pagamento_mensal (
  competencia date not null check (extract(day from competencia) = 1),
  beneficiario text not null check (beneficiario ~ '^(professor|funcionario|fixo):[0-9]+$'),
  nome text not null check (btrim(nome) <> ''),
  valor_hora_aula numeric(12,2) not null check (valor_hora_aula >= 0),
  valor_fixo numeric(12,2) not null check (valor_fixo >= 0),
  pago_em date,
  alterado_em timestamptz not null default now(),
  primary key (competencia, beneficiario)
);

alter table public.financeiro_pagamento_mensal enable row level security;
grant select, insert, update on public.financeiro_pagamento_mensal to authenticated;
create policy financeiro_pagamento_admin on public.financeiro_pagamento_mensal
  for all to authenticated using ((select private.beehive_is_admin()))
  with check ((select private.beehive_is_admin()));

notify pgrst, 'reload schema';
