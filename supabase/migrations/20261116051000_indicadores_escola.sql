create table public.aluno_acesso_diario (
  dia date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  aluno_id bigint not null references public.aluno(id) on delete cascade,
  primary key (dia, aluno_id)
);

alter table public.aluno_acesso_diario enable row level security;
revoke all on public.aluno_acesso_diario from public, anon, authenticated;
grant select, insert on public.aluno_acesso_diario to authenticated;

create policy aluno_acesso_diario_admin_select on public.aluno_acesso_diario
  for select to authenticated using ((select private.beehive_is_admin()));

create policy aluno_acesso_diario_aluno_insert on public.aluno_acesso_diario
  for insert to authenticated with check (
    dia = (now() at time zone 'America/Sao_Paulo')::date
    and exists (
      select 1 from public.perfil p
      where p.user_id = (select auth.uid()) and p.role = 'aluno'
        and p.aluno_id = aluno_acesso_diario.aluno_id
    )
  );

create function public.indicadores_escola(p_inicio date, p_fim date)
returns jsonb
language plpgsql
stable security invoker
set search_path = ''
as $$
begin
  if not (select private.beehive_is_admin()) then
    raise exception 'Acesso restrito à administração' using errcode = '42501';
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Selecione um período válido.' using errcode = '22007';
  end if;

  return (
    with
    primeira_matricula as (
      select aluno_id, min(data_inicio) dia
      from public.matricula group by aluno_id
    ),
    entradas as (
      select aluno_id, dia from primeira_matricula where dia between p_inicio and p_fim
    ),
    saidas as (
      select distinct m.aluno_id, m.data_fim as dia
      from public.matricula m
      where m.ativa is false and m.data_fim between p_inicio and p_fim
        and not exists (
          select 1 from public.matricula outra
          where outra.aluno_id=m.aluno_id and outra.id<>m.id
            and outra.data_inicio<=m.data_fim
            and (outra.data_fim>m.data_fim or (outra.data_fim is null and outra.ativa is true))
        )
    ),
    matriculas_periodo as (
      select m.* from public.matricula m
      where m.data_inicio <= p_fim
        and (m.data_fim > p_fim or (m.data_fim is null and m.ativa is true))
    ),
    aulas_periodo as (
      select au.status, au.data_aula, m.aluno_id
      from public.aula au join public.matricula m on m.id=au.matricula_id
      where au.data_aula between p_inicio and p_fim
    ),
    status_aula as (
      select status, count(*) quantidade from aulas_periodo group by status
    ),
    faltas as (
      select a.id, a.nome, count(*) filter (where ap.status='Ausente') faltas, count(*) total
      from aulas_periodo ap join public.aluno a on a.id=ap.aluno_id
      where ap.status in ('Ausente','Presente')
      group by a.id,a.nome
      having count(*) filter (where ap.status='Ausente') > 0
      order by faltas desc,a.nome,a.id limit 10
    ),
    uso as (
      select a.id,a.nome,count(*) dias
      from public.aluno_acesso_diario ac join public.aluno a on a.id=ac.aluno_id
      where ac.dia between p_inicio and p_fim
      group by a.id,a.nome order by dias desc,a.nome,a.id limit 10
    ),
    cursos as (
      select ma.nome,count(distinct m.aluno_id) alunos
      from matriculas_periodo m join public.materia ma on ma.id=m.materia_id
      group by ma.nome
    ),
    modalidades as (
      select
        case when m.empresa_cnpj='00000000000000' then 'Particular'
          when e.tipo_cadastro='equipe' then 'Equipe'
          when e.cnpj is not null then 'Empresa'
          else 'Sem vínculo informado' end as modalidade,
        count(*) matriculas
      from matriculas_periodo m
      left join public.empresaparceira e on e.cnpj=m.empresa_cnpj
      group by 1
    ),
    movimento as (
      select to_char(ref.mes,'YYYY-MM') mes,
        (select count(distinct a.aluno_id) from entradas a
          where a.dia>=ref.mes and a.dia<ref.mes+interval '1 month') entradas,
        (select count(distinct a.aluno_id) from saidas a
          where a.dia>=ref.mes and a.dia<ref.mes+interval '1 month') saidas
      from generate_series(date_trunc('month', p_inicio::timestamp),
        date_trunc('month', p_fim::timestamp), interval '1 month') as ref(mes)
    )
    select jsonb_build_object(
      'entradas', (select count(distinct aluno_id) from entradas),
      'saidas', (select count(distinct aluno_id) from saidas),
      'ativos', (select count(distinct aluno_id) from matriculas_periodo),
      'matriculas', (select count(*) from matriculas_periodo),
      'aulas', coalesce((select jsonb_object_agg(status,quantidade) from status_aula where status is not null),'{}'::jsonb),
      'movimento', coalesce((select jsonb_agg(m order by mes) from movimento m),'[]'::jsonb),
      'faltas', coalesce((select jsonb_agg(f order by faltas desc,nome,id) from faltas f),'[]'::jsonb),
      'uso', coalesce((select jsonb_agg(u order by dias desc,nome,id) from uso u),'[]'::jsonb),
      'usuarios_com_acesso', (select count(distinct aluno_id) from public.aluno_acesso_diario where dia between p_inicio and p_fim),
      'primeiro_acesso_medido', (select min(dia) from public.aluno_acesso_diario),
      'cursos', coalesce((select jsonb_agg(c order by alunos desc,nome) from cursos c),'[]'::jsonb),
      'modalidades', coalesce((select jsonb_agg(m order by matriculas desc,modalidade) from modalidades m),'[]'::jsonb),
      'avaliacoes', (
        select jsonb_build_object(
          'lancadas', count(*),
          'alunos', count(distinct m.aluno_id)
        )
        from public.nota n join public.matricula m on m.id=n.matricula_id
        where n.data between p_inicio and p_fim
      ),
      'reposicoes', (
        select jsonb_build_object(
          'solicitadas', count(*),
          'concluidas', count(*) filter(where r.status_agendamento='Concluído' and r.cancelado is not true),
          'canceladas', count(*) filter(where r.status_agendamento='Cancelado' or r.cancelado is true)
        )
        from public.reposicao_agendada r join public.horarios_reposicao h on h.id=r.horario_reposicao_id
        where h.data between p_inicio and p_fim and r.tipo_agendamento='Reposição'
      )
    )
  );
end;
$$;
revoke all on function public.indicadores_escola(date,date) from public, anon;
grant execute on function public.indicadores_escola(date,date) to authenticated;
notify pgrst, 'reload schema';
