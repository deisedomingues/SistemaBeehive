create function private.registrar_acesso_aluno()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.aluno_acesso_diario(aluno_id)
  select p.aluno_id
  from public.perfil p
  where p.user_id = (select auth.uid()) and p.role='aluno' and p.aluno_id is not null
  on conflict (dia, aluno_id) do nothing;
$$;

revoke all on function private.registrar_acesso_aluno() from public, anon;
grant execute on function private.registrar_acesso_aluno() to authenticated;

create function public.registrar_acesso_aluno()
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.registrar_acesso_aluno();
$$;

revoke all on function public.registrar_acesso_aluno() from public, anon;
grant execute on function public.registrar_acesso_aluno() to authenticated;
notify pgrst, 'reload schema';
