import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

/* ======================
   Elementos
====================== */
const btnSair = document.getElementById("btnSair");
const msg = document.getElementById("msg");

const qtdEventosResponsavel = document.getElementById("qtdEventosResponsavel");
const qtdEventosApoio = document.getElementById("qtdEventosApoio");
const qtdEventosProximos = document.getElementById("qtdEventosProximos");

const filtroPeriodoEventos = document.getElementById("filtroPeriodoEventos");

const listaEventosResponsavel = document.getElementById("listaEventosResponsavel");
const listaEventosApoio = document.getElementById("listaEventosApoio");

/* ======================
   Estado
====================== */
const professorId = localStorage.getItem("professorId");

let eventosResponsavel = [];
let eventosApoio = [];

if (!professorId) {
  window.location.href = "index.html";
}

/* ======================
   Utilitários
====================== */
function mostrarMensagem(texto, tipo = "erro") {
  if (!msg) return;

  msg.style.display = "block";
  msg.textContent = texto;

  if (tipo === "ok") {
    msg.style.background = "#e8f5e9";
    msg.style.color = "#1b5e20";
    msg.style.border = "1px solid #a5d6a7";
  } else {
    msg.style.background = "#ffebee";
    msg.style.color = "#b71c1c";
    msg.style.border = "1px solid #ef9a9a";
  }

  msg.style.padding = "10px 12px";
  msg.style.borderRadius = "10px";
}

function limparMensagem() {
  if (!msg) return;

  msg.style.display = "none";
  msg.textContent = "";
  msg.removeAttribute("style");
  msg.style.display = "none";
  msg.style.marginBottom = "14px";
}

function escapeHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarData(dataIso) {
  if (!dataIso) return "—";

  const partes = String(dataIso).split("-");
  if (partes.length !== 3) return dataIso;

  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

function formatarHora(hora) {
  if (!hora) return "—";
  return String(hora).slice(0, 5);
}

function montarDataHoraEvento(evento) {
  if (!evento?.data_evento) return null;

  const hora = evento.hora_evento || "00:00:00";
  return new Date(`${evento.data_evento}T${hora}`);
}

function eventoJaAconteceu(evento) {
  const dataHora = montarDataHoraEvento(evento);

  if (!dataHora || Number.isNaN(dataHora.getTime())) return false;

  return dataHora < new Date();
}

function filtrarPorPeriodo(lista) {
  const periodo = filtroPeriodoEventos?.value || "proximos";

  if (periodo === "todos") {
    return [...lista];
  }

  if (periodo === "anteriores") {
    return lista.filter((evento) => eventoJaAconteceu(evento));
  }

  return lista.filter((evento) => !eventoJaAconteceu(evento));
}

function ordenarEventos(lista) {
  return [...lista].sort((a, b) => {
    const dataA = montarDataHoraEvento(a)?.getTime() || 0;
    const dataB = montarDataHoraEvento(b)?.getTime() || 0;

    return dataA - dataB;
  });
}

function montarPublicoAlvo(evento) {
  if (!evento?.publico_alvo) return "—";

  if (evento.publico_alvo === "todos") return "Todos os alunos";
  if (evento.publico_alvo === "materia") return "Por curso/matéria";
  if (evento.publico_alvo === "modulo_exato") return "Módulo específico";
  if (evento.publico_alvo === "modulo_a_partir") return "A partir de um módulo";

  return evento.publico_alvo;
}

function montarCardEvento(evento, tipo = "responsavel") {
  const jaAconteceu = eventoJaAconteceu(evento);

  const badgeTipo =
    tipo === "apoio"
      ? `<span class="status-badge status-reposicao">Apoio</span>`
      : `<span class="status-badge status-presente">Responsável</span>`;

  const badgePeriodo = jaAconteceu
    ? `<span class="status-badge status-cancelada">Evento anterior</span>`
    : `<span class="status-badge status-presente">Próximo evento</span>`;

  return `
    <div class="item-historico">
      <div class="item-historico-topo">
        <strong>${escapeHtml(evento.titulo || "Evento")}</strong>

        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          ${badgeTipo}
          ${badgePeriodo}
        </div>
      </div>

      <p style="margin-top:8px;">
        <b>Data:</b> ${escapeHtml(formatarData(evento.data_evento))}
        |
        <b>Horário:</b> ${escapeHtml(formatarHora(evento.hora_evento))}
      </p>

      <p>
        <b>Tipo:</b> ${escapeHtml(evento.tipo_evento || "—")}
      </p>

      <p>
        <b>Público:</b> ${escapeHtml(montarPublicoAlvo(evento))}
      </p>

      ${
        evento.local
          ? `<p><b>Local/link:</b> ${escapeHtml(evento.local)}</p>`
          : `<p><b>Local/link:</b> —</p>`
      }

      ${
        evento.descricao
          ? `<p><b>Descrição:</b> ${escapeHtml(evento.descricao)}</p>`
          : ""
      }

      ${
        evento.observacao_apoio
          ? `<p><b>Observação do apoio:</b> ${escapeHtml(evento.observacao_apoio)}</p>`
          : ""
      }
    </div>
  `;
}

function renderResumo() {
  const todosEventos = [...eventosResponsavel, ...eventosApoio];

  const proximos = todosEventos.filter((evento) => !eventoJaAconteceu(evento));

  if (qtdEventosResponsavel) {
    qtdEventosResponsavel.textContent = String(eventosResponsavel.length);
  }

  if (qtdEventosApoio) {
    qtdEventosApoio.textContent = String(eventosApoio.length);
  }

  if (qtdEventosProximos) {
    qtdEventosProximos.textContent = String(proximos.length);
  }
}

function renderListaResponsavel() {
  if (!listaEventosResponsavel) return;

  const listaFiltrada = ordenarEventos(filtrarPorPeriodo(eventosResponsavel));

  if (!listaFiltrada.length) {
    listaEventosResponsavel.innerHTML = `
      <p class="vazio-box">Nenhum evento encontrado como responsável para este filtro.</p>
    `;
    return;
  }

  listaEventosResponsavel.innerHTML = listaFiltrada
    .map((evento) => montarCardEvento(evento, "responsavel"))
    .join("");
}

function renderListaApoio() {
  if (!listaEventosApoio) return;

  const listaFiltrada = ordenarEventos(filtrarPorPeriodo(eventosApoio));

  if (!listaFiltrada.length) {
    listaEventosApoio.innerHTML = `
      <p class="vazio-box">Nenhum evento encontrado como apoio para este filtro.</p>
    `;
    return;
  }

  listaEventosApoio.innerHTML = listaFiltrada
    .map((evento) => montarCardEvento(evento, "apoio"))
    .join("");
}

function renderTela() {
  renderResumo();
  renderListaResponsavel();
  renderListaApoio();
}

/* ======================
   Banco de dados
====================== */
async function carregarEventosComoResponsavel() {
  /*
    IMPORTANTE:
    Este código pressupõe que a tabela evento tenha uma coluna professor_id.

    Se sua tabela evento ainda não tiver essa coluna, rode depois este SQL:

    alter table public.evento
    add column if not exists professor_id bigint null references public.professor(id);
  */

  const { data, error } = await supabase
    .from("evento")
    .select(`
      id,
      titulo,
      descricao,
      tipo_evento,
      data_evento,
      hora_evento,
      local,
      publico_alvo,
      materia_id,
      modulo_id,
      limite_confirmacao,
      ativo,
      professor_id
    `)
    .eq("professor_id", professorId)
    .eq("ativo", true)
    .order("data_evento", { ascending: true })
    .order("hora_evento", { ascending: true });

  if (error) {
    console.error("Erro ao carregar eventos como responsável:", error);

    eventosResponsavel = [];

    mostrarMensagem(
      "Não foi possível carregar os eventos como responsável. Verifique se a tabela evento possui a coluna professor_id.",
      "erro"
    );

    return;
  }

  eventosResponsavel = data || [];
}

async function carregarEventosComoApoio() {
  /*
    Esta função usa a tabela evento_professor_apoio.

    Se ela ainda não existir, rode o SQL:

    create table public.evento_professor_apoio (
      id bigint generated by default as identity primary key,
      evento_id bigint not null references public.evento(id) on delete cascade,
      professor_id bigint not null references public.professor(id),
      observacao text null,
      created_at timestamp with time zone default now(),
      constraint evento_professor_apoio_unico unique (evento_id, professor_id)
    );
  */

  const { data, error } = await supabase
    .from("evento_professor_apoio")
    .select(`
      id,
      professor_id,
      observacao,
      evento:evento_id (
        id,
        titulo,
        descricao,
        tipo_evento,
        data_evento,
        hora_evento,
        local,
        publico_alvo,
        materia_id,
        modulo_id,
        limite_confirmacao,
        ativo
      )
    `)
    .eq("professor_id", professorId);

  if (error) {
    console.warn("Eventos como apoio não carregados:", error);

    eventosApoio = [];

    if (listaEventosApoio) {
      listaEventosApoio.innerHTML = `
        <p class="vazio-box">
          Nenhum evento como apoio encontrado. 
          Se você ainda não criou a tabela de professor apoio, esta área ficará vazia por enquanto.
        </p>
      `;
    }

    return;
  }

  eventosApoio = (data || [])
    .map((item) => {
      if (!item.evento) return null;

      return {
        ...item.evento,
        observacao_apoio: item.observacao || ""
      };
    })
    .filter((evento) => evento && evento.ativo);
}

/* ======================
   Inicialização
====================== */
async function iniciarTela() {
  try {
    limparMensagem();

    await carregarEventosComoResponsavel();
    await carregarEventosComoApoio();

    renderTela();
  } catch (erro) {
    console.error("Erro inesperado ao carregar eventos do professor:", erro);

    mostrarMensagem(
      "Ocorreu um erro ao carregar os eventos do professor.",
      "erro"
    );

    if (listaEventosResponsavel) {
      listaEventosResponsavel.innerHTML = `
        <p class="vazio-box">Não foi possível carregar os eventos como responsável.</p>
      `;
    }

    if (listaEventosApoio) {
      listaEventosApoio.innerHTML = `
        <p class="vazio-box">Não foi possível carregar os eventos como apoio.</p>
      `;
    }
  }
}

/* ======================
   Eventos de tela
====================== */
filtroPeriodoEventos?.addEventListener("change", () => {
  renderTela();
});

btnSair?.addEventListener("click", async () => {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Erro ao sair:", error);
  }

  localStorage.removeItem("role");
  localStorage.removeItem("professorId");
  localStorage.removeItem("professorNome");
  localStorage.removeItem("professorEmail");

  localStorage.removeItem("alunoIdVisualizacao");
  localStorage.removeItem("alunoId");
  localStorage.removeItem("aluno_id");
  localStorage.removeItem("idAluno");

  localStorage.removeItem("matriculaSelecionada");
  localStorage.removeItem("matriculaSelecionadaId");
  localStorage.removeItem("materiaSelecionadaId");
  localStorage.removeItem("moduloSelecionadoId");
  localStorage.removeItem("nomeCursoSelecionado");

  window.location.href = "index.html";
});

/* ======================
   Iniciar
====================== */
await iniciarTela();