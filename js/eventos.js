import { supabase } from "./supabase.js";

/* =========================================================
   ELEMENTOS
========================================================= */
const msg = document.getElementById("msg");
const listaEventos = document.getElementById("listaEventos");

const totalEventosEl = document.getElementById("totalEventos");
const eventosAtivosEl = document.getElementById("eventosAtivos");
const eventosEncerradosEl = document.getElementById("eventosEncerrados");

const filtroBusca = document.getElementById("filtroBusca");
const filtroSituacao = document.getElementById("filtroSituacao");

/* =========================================================
   ESTADO
========================================================= */
let eventos = [];
let confirmacoesPorEvento = {};

/* =========================================================
   INICIALIZAÇÃO
========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  await carregarTudo();
});

/* =========================================================
   UTILITÁRIOS
========================================================= */
function mostrarMensagem(texto, tipo = "sucesso") {
  msg.style.display = "block";
  msg.textContent = texto;
  msg.style.padding = "10px";
  msg.style.borderRadius = "10px";

  if (tipo === "erro") {
    msg.style.background = "#ffe5e5";
    msg.style.color = "#7a1f1f";
    msg.style.border = "1px solid #e5b4b4";
  } else {
    msg.style.background = "#e8f7e8";
    msg.style.color = "#1d5e1d";
    msg.style.border = "1px solid #b8deb8";
  }
}

function esconderMensagem() {
  msg.style.display = "none";
  msg.textContent = "";
}

function formatarData(dataStr) {
  if (!dataStr) return "-";
  const [ano, mes, dia] = dataStr.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarHora(horaStr) {
  if (!horaStr) return "-";
  return horaStr.slice(0, 5);
}

function formatarDataHoraBR(dataHoraStr) {
  if (!dataHoraStr) return "-";

  const data = new Date(dataHoraStr);

  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function obterSituacaoEvento(evento) {
  const agora = new Date();
  const dataHoraEvento = new Date(`${evento.data_evento}T${evento.hora_evento}`);

  if (!evento.ativo) return "inativo";
  if (dataHoraEvento < agora) return "encerrado";

  return "ativo";
}

function obterRotuloPublico(evento) {
  const publico = evento.publico_alvo;

  if (publico === "todos") return "Todos os alunos";
  if (publico === "materia") return "Curso específico";
  if (publico === "modulo_exato") return "Módulo específico";
  if (publico === "modulo_a_partir") return "A partir de um módulo";

  return publico || "-";
}

function normalizarTexto(texto) {
  return (texto || "").toLowerCase().trim();
}

function escaparHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* =========================================================
   BUSCA DE DADOS
========================================================= */
async function carregarTudo() {
  esconderMensagem();
  await carregarEventos();
  await carregarConfirmacoes();
  atualizarResumo();
  renderizarEventos();
}

async function carregarEventos() {
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
      ativo
    `)
    .order("data_evento", { ascending: true })
    .order("hora_evento", { ascending: true });

  if (error) {
    console.error("Erro ao carregar eventos:", error);
    mostrarMensagem("Erro ao carregar os eventos.", "erro");
    eventos = [];
    return;
  }

  eventos = data || [];
}

async function carregarConfirmacoes() {
  confirmacoesPorEvento = {};

  const idsEventos = eventos.map((evento) => evento.id);

  if (!idsEventos.length) return;

  const { data, error } = await supabase
    .from("evento_confirmacao")
    .select(`
      evento_id,
      aluno_id,
      aluno:aluno_id (
        id,
        nome
      )
    `)
    .in("evento_id", idsEventos)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao carregar confirmações:", error);
    mostrarMensagem("Os eventos foram carregados, mas houve erro ao buscar as confirmações.", "erro");
    return;
  }

  for (const item of data || []) {
    if (!confirmacoesPorEvento[item.evento_id]) {
      confirmacoesPorEvento[item.evento_id] = {
        total: 0,
        alunos: []
      };
    }

    confirmacoesPorEvento[item.evento_id].total += 1;

    if (item.aluno?.nome) {
      confirmacoesPorEvento[item.evento_id].alunos.push({
        id: item.aluno.id,
        nome: item.aluno.nome
      });
    }
  }

  // ordena os nomes alfabeticamente
  Object.values(confirmacoesPorEvento).forEach((grupo) => {
    grupo.alunos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  });
}

/* =========================================================
   RESUMO
========================================================= */
function atualizarResumo() {
  const total = eventos.length;

  let ativos = 0;
  let encerrados = 0;

  eventos.forEach((evento) => {
    const situacao = obterSituacaoEvento(evento);

    if (situacao === "ativo") ativos += 1;
    if (situacao === "encerrado" || situacao === "inativo") encerrados += 1;
  });

  totalEventosEl.textContent = total;
  eventosAtivosEl.textContent = ativos;
  eventosEncerradosEl.textContent = encerrados;
}

/* =========================================================
   FILTROS
========================================================= */
function obterEventosFiltrados() {
  const busca = normalizarTexto(filtroBusca.value);
  const situacaoFiltro = filtroSituacao.value;

  return eventos.filter((evento) => {
    const titulo = normalizarTexto(evento.titulo);
    const tipo = normalizarTexto(evento.tipo_evento);
    const descricao = normalizarTexto(evento.descricao);
    const local = normalizarTexto(evento.local);

    const passouBusca =
      !busca ||
      titulo.includes(busca) ||
      tipo.includes(busca) ||
      descricao.includes(busca) ||
      local.includes(busca);

    if (!passouBusca) return false;

    const situacao = obterSituacaoEvento(evento);

    if (situacaoFiltro === "ativos") {
      return situacao === "ativo";
    }

    if (situacaoFiltro === "encerrados") {
      return situacao === "encerrado" || situacao === "inativo";
    }

    return true;
  });
}

/* =========================================================
   RENDER
========================================================= */
function renderizarEventos() {
  const lista = obterEventosFiltrados();

  if (!lista.length) {
    listaEventos.innerHTML = `
      <div class="card">
        <p style="margin:0;">Nenhum evento encontrado com os filtros selecionados.</p>
      </div>
    `;
    return;
  }

  listaEventos.innerHTML = lista.map((evento) => {
    const situacao = obterSituacaoEvento(evento);

    const confirmacoes = confirmacoesPorEvento[evento.id] || {
      total: 0,
      alunos: []
    };

    const nomesConfirmadosHtml = confirmacoes.alunos.length
      ? `
        <div style="margin-top:10px;">
          <strong>Alunos confirmados:</strong>
          <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:8px;">
            ${confirmacoes.alunos
              .map((aluno) => `
                <span style="display:inline-block; padding:6px 10px; border-radius:999px; background:rgba(255,255,255,0.55); font-size:13px;">
                  ${escaparHtml(aluno.nome)}
                </span>
              `)
              .join("")}
          </div>
        </div>
      `
      : `
        <div style="margin-top:10px;">
          <strong>Alunos confirmados:</strong>
          <p style="margin:6px 0 0 0;">Nenhum aluno confirmou presença ainda.</p>
        </div>
      `;

    const badgeSituacao =
      situacao === "ativo"
        ? `<span style="display:inline-block; padding:6px 10px; border-radius:999px; background:#e8f7e8; color:#1d5e1d; font-size:12px; font-weight:bold;">Ativo / futuro</span>`
        : `<span style="display:inline-block; padding:6px 10px; border-radius:999px; background:#f3f3f3; color:#555; font-size:12px; font-weight:bold;">Encerrado</span>`;

    return `
      <article class="card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:10px;">
          <div>
            <h2 style="margin-bottom:6px;">${escaparHtml(evento.titulo || "-")}</h2>
            <p style="margin:0; opacity:0.85;">
              ${escaparHtml(evento.tipo_evento || "Evento")} • ${formatarData(evento.data_evento)} às ${formatarHora(evento.hora_evento)}
            </p>
          </div>
          <div>
            ${badgeSituacao}
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-bottom:12px;">
          <div>
            <strong>Local:</strong><br>
            <span>${escaparHtml(evento.local || "-")}</span>
          </div>

          <div>
            <strong>Público:</strong><br>
            <span>${escaparHtml(obterRotuloPublico(evento))}</span>
          </div>

          <div>
            <strong>Confirma até:</strong><br>
            <span>${formatarDataHoraBR(evento.limite_confirmacao)}</span>
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <strong>Descrição:</strong>
          <p style="margin:6px 0 0 0;">
            ${escaparHtml(evento.descricao || "Sem descrição informada.")}
          </p>
        </div>

        <div style="padding:12px; border-radius:14px; background:rgba(255,255,255,0.35); margin-bottom:12px;">
          <strong>Total de confirmados</strong>
          <p style="font-size:24px; font-weight:bold; margin:6px 0 0 0;">${confirmacoes.total}</p>
        </div>

        <div style="padding:12px; border-radius:14px; background:rgba(255,255,255,0.25);">
          ${nomesConfirmadosHtml}
        </div>
      </article>
    `;
  }).join("");
}

/* =========================================================
   EVENTOS DOS FILTROS
========================================================= */
filtroBusca.addEventListener("input", renderizarEventos);
filtroSituacao.addEventListener("change", renderizarEventos);