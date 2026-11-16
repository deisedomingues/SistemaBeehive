alter table public.financeiro_fixo
  add column substitui_hora_aula boolean not null default false,
  add constraint financeiro_fixo_substitui_hora_aula_check
    check (not substitui_hora_aula or professor_id is not null);

create function public.cadastrar_custo_fixo_com_regime(
  p_nome text, p_descricao text, p_inicio date, p_fim date,
  p_professor_id bigint, p_funcionario_id bigint, p_dias integer[],
  p_valores numeric[], p_observacao text, p_substitui_hora_aula boolean
)
returns bigint language plpgsql security invoker set search_path = ''
as $$
declare
  novo_id bigint;
begin
  if p_substitui_hora_aula is true and p_professor_id is null then
    raise exception 'Selecione o professor da remuneração fixa.';
  end if;
  novo_id := public.cadastrar_custo_fixo(p_nome, p_descricao, p_inicio, p_fim,
    p_professor_id, p_funcionario_id, p_dias, p_valores, p_observacao);
  if p_substitui_hora_aula is true then
    update public.financeiro_fixo set substitui_hora_aula = true where id = novo_id;
  end if;
  return novo_id;
end;
$$;
revoke all on function public.cadastrar_custo_fixo_com_regime(text,text,date,date,bigint,bigint,integer[],numeric[],text,boolean) from public, anon;
grant execute on function public.cadastrar_custo_fixo_com_regime(text,text,date,date,bigint,bigint,integer[],numeric[],text,boolean) to authenticated;
notify pgrst, 'reload schema';
