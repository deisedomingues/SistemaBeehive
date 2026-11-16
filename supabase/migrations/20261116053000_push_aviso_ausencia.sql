-- Aproveita a credencial do push já instalado, sem gravá-la no código fonte.
do $setup$
declare
  segredo text;
begin
  if exists (select 1 from vault.secrets where name = 'beehive_cron_secret') then
    return;
  end if;

  select (regexp_match(p.prosrc, $pattern$v_secret\s+text\s*:=\s*'([^']+)'$pattern$))[1]
  into segredo
  from pg_catalog.pg_proc p
  where p.oid = to_regprocedure('public.notificar_professor_reposicao_agendada()');

  if segredo is null then
    raise exception 'Configure a credencial beehive_cron_secret no Vault antes de habilitar os avisos de falta.';
  end if;

  perform vault.create_secret(segredo, 'beehive_cron_secret', 'Credencial da função de push do Beehive');
end;
$setup$;

create function private.notificar_professor_aviso_ausencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  destinatario bigint;
  hora time;
  segredo text;
begin
  if new.status is distinct from 'pendente' then
    return new;
  end if;

  -- O destinatário vem da matrícula e do horário vinculados ao aviso.
  select m.professor_id, h.hora_inicio
  into destinatario, hora
  from public.matricula m
  join public.aluno_horario_aula h on h.matricula_id=m.id
  where m.id=new.matricula_id and h.id=new.horario_aula_id
    and m.aluno_id=new.aluno_id and m.ativa is true and h.ativo is true
    and m.professor_id=new.professor_id;

  if destinatario is null or hora is null
    or new.data_aula + hora <= (now() at time zone 'America/Sao_Paulo')
    or not exists (
      select 1 from public.professor_push_token t
      where t.professor_id=destinatario and t.ativo is true
    ) then
    return new;
  end if;

  begin
    select decrypted_secret into segredo
    from vault.decrypted_secrets where name='beehive_cron_secret';

    if segredo is null then
      raise warning 'Credencial de push indisponível para o aviso %.', new.id;
      return new;
    end if;

    perform net.http_post(
      url := 'https://hlkoypxizkupaoootbfb.supabase.co/functions/v1/enviar-push',
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',segredo),
      body := jsonb_build_object(
        'professor_id', destinatario,
        'titulo', 'Aviso de ausência',
        'corpo', 'Aula de ' || to_char(new.data_aula,'DD/MM') || ' às ' ||
          to_char(new.data_aula + hora,'HH24:MI') || '. Toque para ver o aviso.',
        'tipo', 'aviso_ausencia_professor',
        'url', 'https://www.beehiveidiomas.com/notificacao-professor.html'
      ),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'Não foi possível enfileirar o push do aviso %. Código: %.', new.id, sqlstate;
  end;

  return new;
end;
$$;

revoke all on function private.notificar_professor_aviso_ausencia() from public, anon, authenticated;

create trigger trg_notificar_professor_aviso_ausencia
  after insert on public.aviso_ausencia
  for each row execute function private.notificar_professor_aviso_ausencia();
