begin;

alter table public.empresaparceira
  add column bloqueia_reposicao boolean not null default false;

-- Campo calculado da matrícula. A API recebe apenas a configuração booleana.
create function public.reposicao_bloqueada(matricula public.matricula)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select empresa.bloqueia_reposicao
    from public.empresaparceira as empresa
    where empresa.cnpj = ($1).empresa_cnpj
  ), false);
$$;

revoke all on function public.reposicao_bloqueada(public.matricula) from public;
grant execute on function public.reposicao_bloqueada(public.matricula) to authenticated, service_role;

create function public.validar_aviso_ausencia_turma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(trim(new.tipo_solicitacao)) = 'reposicao'
     and exists (
       select 1
       from public.matricula as m
       left join public.aluno_horario_aula as h on h.id = new.horario_aula_id
       where m.id in (new.matricula_id, h.matricula_id)
         and public.reposicao_bloqueada(m)
     ) then
    raise exception 'Esta turma permite aviso de ausência com gravação.';
  end if;

  return new;
end;
$$;

create trigger validar_aviso_ausencia_turma
  before insert or update of tipo_solicitacao, matricula_id, horario_aula_id
  on public.aviso_ausencia
  for each row execute function public.validar_aviso_ausencia_turma();

create function public.validar_agendamento_reposicao_turma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cancelado is not true
     and (
       new.aula_id is not null
       or lower(trim(coalesce(new.tipo_agendamento, ''))) in ('reposição', 'reposicao')
     )
     and exists (
       select 1
       from public.matricula as m
       left join public.aula as a on a.id = new.aula_id
       where m.id in (new.matricula_id, a.matricula_id)
         and public.reposicao_bloqueada(m)
     ) then
    raise exception 'O agendamento de reposição está bloqueado para esta turma.';
  end if;

  return new;
end;
$$;

create trigger validar_agendamento_reposicao_turma
  before insert or update of cancelado, tipo_agendamento, aula_id, matricula_id, horario_reposicao_id
  on public.reposicao_agendada
  for each row execute function public.validar_agendamento_reposicao_turma();

create function public.aplicar_regra_ausencia_turma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'Ausente'
     and new.precisa_reposicao is true
     and exists (
       select 1
       from public.matricula as m
       where m.id = new.matricula_id
         and public.reposicao_bloqueada(m)
     ) then
    new.precisa_reposicao := false;
  end if;

  return new;
end;
$$;

create trigger aplicar_regra_ausencia_turma
  before insert or update of matricula_id, status, precisa_reposicao
  on public.aula
  for each row execute function public.aplicar_regra_ausencia_turma();

revoke all on function public.validar_aviso_ausencia_turma() from public;
revoke all on function public.validar_agendamento_reposicao_turma() from public;
revoke all on function public.aplicar_regra_ausencia_turma() from public;

notify pgrst, 'reload schema';

commit;
