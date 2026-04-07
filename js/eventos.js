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

function obterSituacaoEvento(evento) {
  const agora = new Date();

  // monta data/hora do evento
  const dataHoraEvento = new Date(`${evento.data_evento}T${evento.hora_evento}`);

  // se quiser considerar "ativo" false como inativo/encerrado visualmente
  if (!evento.ativo) {
    return "inativo";
  }

  if (dataHoraEvento < agora) {
    return "encerrado";
  }

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
      tipo_evento,
      descricao,
      local,
      data_evento,
      hora_evento,
      publico_alvo,
      materia_id,
      modulo_id,
      ordem_minima,
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

  const idsEventos = eventos.map((e) => e.id);

  if (!idsEventos.length) return;

  const { data, error } = await supabase
    .from("evento_confirmacao")
    .select("evento_id, status_confirmacao")
    .in("evento_id", idsEventos);

  if (error) {
    console.warn("Não foi possível carregar confirmações:", error);
    return;
  }

  for (const item of data || []) {
    if (!confirmacoesPorEvento[item.evento_id]) {
      confirmacoesPorEvento[item.evento_id] = {
        confirmado: 0,
        recusado: 0,
        pendente: 0
      };
    }

    const status = item.status_confirmacao || "pendente";

    if (status === "confirmado") {
      confirmacoesPorEvento[item.evento_id].confirmado += 1;
    } else if (status === "recusado") {
      confirmacoesPorEvento[item.evento_id].recusado += 1;
    } else {
      confirmacoesPorEvento[item.evento_id].pendente += 1;
    }
  }
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
   FILTRO
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
    const contagem = confirmacoesPorEvento[evento.id] || {
      confirmado: 0,
      recusado: 0,
      pendente: 0
    };

    const badgeSituacao =
      situacao === "ativo"
        ? `<span style="display:inline-block; padding:6px 10px; border-radius:999px; background:#e8f7e8; color:#1d5e1d; font-size:12px; font-weight:bold;">Ativo / futuro</span>`
        : `<span style="display:inline-block; padding:6px 10px; border-radius:999px; background:#f3f3f3; color:#555; font-size:12px; font-weight:bold;">Encerrado</span>`;

    return `
      <article class="card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:10px;">
          <div>
            <h2 style="margin-bottom:6px;">${evento.titulo || "-"}</h2>
            <p style="margin:0; opacity:0.85;">
              ${evento.tipo_evento || "Evento"} • ${formatarData(evento.data_evento)} às ${formatarHora(evento.hora_evento)}
            </p>
          </div>
          <div>
            ${badgeSituacao}
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-bottom:12px;">
          <div>
            <strong>Local:</strong><br>
            <span>${evento.local || "-"}</span>
          </div>

          <div>
            <strong>Público:</strong><br>
            <span>${obterRotuloPublico(evento)}</span>
          </div>

          <div>
            <strong>Confirma até:</strong><br>
            <span>${evento.limite_confirmacao ? new Date(evento.limite_confirmacao).toLocaleString("pt-BR") : "-"}</span>
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <strong>Descrição:</strong>
          <p style="margin:6px 0 0 0;">
            ${evento.descricao || "Sem descrição informada."}
          </p>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px;">
          <div style="padding:10px; border-radius:12px; background:rgba(255,255,255,0.45);">
            <strong>Confirmados</strong>
            <p style="font-size:22px; font-weight:bold; margin:6px 0 0 0;">${contagem.confirmado}</p>
          </div>

          <div style="padding:10px; border-radius:12px; background:rgba(255,255,255,0.45);">
            <strong>Recusaram</strong>
            <p style="font-size:22px; font-weight:bold; margin:6px 0 0 0;">${contagem.recusado}</p>
          </div>

          <div style="padding:10px; border-radius:12px; background:rgba(255,255,255,0.45);">
            <strong>Pendentes</strong>
            <p style="font-size:22px; font-weight:bold; margin:6px 0 0 0;">${contagem.pendente}</p>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

/* =========================================================
   EVENTOS DE FILTRO
========================================================= */
filtroBusca.addEventListener("input", renderizarEventos);
filtroSituacao.addEventListener("change", renderizarEventos);