import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

/* =========================================================
   ELEMENTOS
========================================================= */
const msg = document.getElementById("msg");
const gridEventosFuturos = document.getElementById("gridEventosFuturos");
const listaHistoricoEventos = document.getElementById("listaHistoricoEventos");

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
let convitesPorEvento = {};
let eventosComParticipacaoRegistrada = new Set();

/* =========================================================
   INICIALIZAÇÃO
========================================================= */
async function init() {
  try {
    await carregarTudo();
  } catch (erro) {
    console.error("Erro na inicialização da página de eventos:", erro);
    mostrarMensagem("Erro ao inicializar a página de eventos.", "erro");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  await init();
}

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

  if (!evento.ativo) return "cancelado";
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

function obterClasseVisualEvento(situacao) {
  if (situacao === "ativo") return "evento-visual-ativo";
  if (situacao === "cancelado") return "evento-visual-cancelado";
  return "evento-visual-encerrado";
}

function obterBadgeSituacao(situacao) {
  if (situacao === "ativo") {
    return `<span class="badge-evento badge-evento-ativo">Ativo / futuro</span>`;
  }

  if (situacao === "cancelado") {
    return `<span class="badge-evento badge-evento-cancelado">Cancelado</span>`;
  }

  return `<span class="badge-evento badge-evento-encerrado">Encerrado</span>`;
}

function fecharDetalhesPorEventoId(eventoId) {
  const details = document.querySelector(`details[data-evento-id="${eventoId}"]`);
  if (details) {
    details.open = false;
  }
}

function eventoJaFoiRegistrado(evento) {
  return Boolean(
    evento?.participacao_registrada ||
    eventosComParticipacaoRegistrada.has(Number(evento.id))
  );
}

/* =========================================================
   BUSCA DE DADOS
========================================================= */
async function carregarTudo() {
  esconderMensagem();
  await carregarEventos();
  await carregarConfirmacoes();
  await carregarConvites();
  await carregarEventosJaRegistrados();
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
      ativo,
      participacao_registrada,
      professor_responsavel_id,
      professor_responsavel:professor_responsavel_id (
        id,
        nome
      )
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

  Object.values(confirmacoesPorEvento).forEach((grupo) => {
    grupo.alunos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  });
}

async function carregarConvites() {
  convitesPorEvento = {};

  const idsEventos = eventos.map((evento) => evento.id);
  if (!idsEventos.length) return;

  const { data, error } = await supabase
    .from("evento_convite_aluno")
    .select(`
      evento_id,
      aluno_id,
      visualizado
    `)
    .in("evento_id", idsEventos);

  if (error) {
    console.error("Erro ao carregar convites:", error);
    mostrarMensagem("Os eventos foram carregados, mas houve erro ao buscar os convites dos alunos.", "erro");
    return;
  }

  for (const item of data || []) {
    if (!convitesPorEvento[item.evento_id]) {
      convitesPorEvento[item.evento_id] = {
        total: 0,
        visualizados: 0,
        naoVisualizados: 0
      };
    }

    convitesPorEvento[item.evento_id].total += 1;

    if (item.visualizado) {
      convitesPorEvento[item.evento_id].visualizados += 1;
    } else {
      convitesPorEvento[item.evento_id].naoVisualizados += 1;
    }
  }
}

async function carregarEventosJaRegistrados() {
  eventosComParticipacaoRegistrada = new Set();

  const { data, error } = await supabase
    .from("aula")
    .select("evento_id")
    .eq("status", "Evento")
    .not("evento_id", "is", null);

  if (error) {
    console.error("Erro ao buscar eventos já registrados:", error);
    mostrarMensagem("Os eventos foram carregados, mas houve erro ao verificar participações já registradas.", "erro");
    return;
  }

  for (const item of data || []) {
    if (item.evento_id != null) {
      eventosComParticipacaoRegistrada.add(Number(item.evento_id));
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
    if (situacao === "encerrado" || situacao === "cancelado") encerrados += 1;
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
    const professor = normalizarTexto(evento.professor_responsavel?.nome);

    const passouBusca =
      !busca ||
      titulo.includes(busca) ||
      tipo.includes(busca) ||
      descricao.includes(busca) ||
      local.includes(busca) ||
      professor.includes(busca);

    if (!passouBusca) return false;

    const situacao = obterSituacaoEvento(evento);

    if (situacaoFiltro === "ativos") {
      return situacao === "ativo";
    }

    if (situacaoFiltro === "encerrados") {
      return situacao === "encerrado" || situacao === "cancelado";
    }

    return true;
  });
}

/* =========================================================
   AÇÕES
========================================================= */
async function cancelarEvento(eventoId) {
  const confirmar = window.confirm("Deseja realmente cancelar este evento?");
  if (!confirmar) return;

  esconderMensagem();

  const { error } = await supabase
    .from("evento")
    .update({ ativo: false })
    .eq("id", eventoId);

  if (error) {
    console.error("Erro ao cancelar evento:", error);
    mostrarMensagem("Não foi possível cancelar o evento.", "erro");
    return;
  }

  mostrarMensagem("✅ Evento cancelado com sucesso.");
  await carregarTudo();
}

/* =========================================================
   RENDER
========================================================= */
function montarDetalhesEvento(evento) {
  const situacao = obterSituacaoEvento(evento);
  const jaRegistrado = eventoJaFoiRegistrado(evento);

  const confirmacoes = confirmacoesPorEvento[evento.id] || {
    total: 0,
    alunos: []
  };

  const convites = convitesPorEvento[evento.id] || {
    total: 0,
    visualizados: 0,
    naoVisualizados: 0
  };

  const totalPendentes = Math.max(convites.total - confirmacoes.total, 0);
  const professorResponsavel = evento.professor_responsavel?.nome || "Não informado";

  const nomesConfirmadosHtml = confirmacoes.alunos.length
    ? `
      <div class="bloco-detalhe-evento">
        <strong>Alunos confirmados</strong>
        <div class="chips-confirmados-evento">
          ${confirmacoes.alunos
            .map((aluno) => `
              <span class="chip-confirmado-evento">
                ${escaparHtml(aluno.nome)}
              </span>
            `)
            .join("")}
        </div>
      </div>
    `
    : `
      <div class="bloco-detalhe-evento">
        <strong>Alunos confirmados</strong>
        <p>Nenhum aluno confirmou presença ainda.</p>
      </div>
    `;

  const podeRegistrarParticipacao =
    situacao !== "cancelado" &&
    confirmacoes.total > 0 &&
    !jaRegistrado;

  const participacaoJaRegistradaHtml = jaRegistrado
    ? `
      <div class="bloco-detalhe-evento">
        <strong>Participação</strong>
        <p style="margin:0; color:#1d5e1d; font-weight:600;">
          ✅ Participação já registrada para este evento.
        </p>
      </div>
    `
    : "";

  return `
    <div class="detalhes-evento-grid">
      <div class="bloco-detalhe-evento">
        <strong>Descrição</strong>
        <p>${escaparHtml(evento.descricao || "Sem descrição informada.")}</p>
      </div>

      <div class="bloco-detalhe-evento">
        <strong>Público</strong>
        <p>${escaparHtml(obterRotuloPublico(evento))}</p>
      </div>

      <div class="bloco-detalhe-evento">
        <strong>Professor responsável</strong>
        <p>${escaparHtml(professorResponsavel)}</p>
      </div>

      <div class="bloco-detalhe-evento">
        <strong>Confirma até</strong>
        <p>${formatarDataHoraBR(evento.limite_confirmacao)}</p>
      </div>

      <div class="bloco-detalhe-evento">
        <strong>Convidados</strong>
        <p>${convites.total}</p>
      </div>

      <div class="bloco-detalhe-evento">
        <strong>Confirmados</strong>
        <p>${confirmacoes.total}</p>
      </div>

      <div class="bloco-detalhe-evento">
        <strong>Pendentes</strong>
        <p>${totalPendentes}</p>
      </div>
    </div>

    ${nomesConfirmadosHtml}
    ${participacaoJaRegistradaHtml}

    <div class="acoes-evento-detalhe">
      ${
        podeRegistrarParticipacao
          ? `
            <a
              href="registrar-evento.html?evento=${evento.id}"
              class="btn"
              style="text-decoration:none; display:inline-block;"
            >
              Registrar participação
            </a>
          `
          : ""
      }

      ${
        situacao === "ativo"
          ? `
            <button
              type="button"
              class="btn btn-cancelar-evento"
              data-evento-id="${evento.id}"
            >
              Cancelar evento
            </button>
          `
          : ""
      }

      <button
        type="button"
        class="link-ver-menos"
        data-fechar-evento-id="${evento.id}"
      >
        Recolher
      </button>
    </div>
  `;
}

function renderizarEventos() {
  const lista = obterEventosFiltrados();

  const futuros = lista.filter((evento) => obterSituacaoEvento(evento) === "ativo");
  const historico = lista.filter((evento) => obterSituacaoEvento(evento) !== "ativo");

  if (!futuros.length) {
    gridEventosFuturos.innerHTML = `
      <div class="card">
        <p style="margin:0;">Nenhum evento futuro encontrado.</p>
      </div>
    `;
  } else {
    gridEventosFuturos.innerHTML = futuros.map((evento) => {
      const situacao = obterSituacaoEvento(evento);
      const professorResponsavel = evento.professor_responsavel?.nome || "Não informado";

      return `
        <article class="card-admin card-evento-compacto ${obterClasseVisualEvento(situacao)}">
          <div class="card-admin-icone">🎈</div>

          <div class="card-admin-conteudo">
            <div class="topo-card-evento-compacto">
              <h2>${escaparHtml(evento.titulo || "-")}</h2>
              ${obterBadgeSituacao(situacao)}
            </div>

            <p class="meta-evento-compacto">
              ${escaparHtml(evento.tipo_evento || "Evento")} • ${formatarData(evento.data_evento)} às ${formatarHora(evento.hora_evento)}
            </p>

            <p class="meta-evento-compacto">
              Local: ${escaparHtml(evento.local || "-")}
            </p>

            <p class="meta-evento-compacto">
              Responsável: ${escaparHtml(professorResponsavel)}
            </p>
          </div>

          <details class="detalhes-evento-box" data-evento-id="${evento.id}">
            <summary>Ver mais</summary>
            <div class="conteudo-detalhes-evento">
              ${montarDetalhesEvento(evento)}
            </div>
          </details>
        </article>
      `;
    }).join("");
  }

  if (!historico.length) {
    listaHistoricoEventos.innerHTML = `
      <div class="card">
        <p style="margin:0;">Nenhum evento encerrado ou cancelado encontrado.</p>
      </div>
    `;
  } else {
    listaHistoricoEventos.innerHTML = historico.map((evento) => {
      const situacao = obterSituacaoEvento(evento);
      const professorResponsavel = evento.professor_responsavel?.nome || "Não informado";

      return `
        <article class="item-historico-evento-compacto ${obterClasseVisualEvento(situacao)}">
          <div class="item-historico-evento-topo">
            <div class="item-historico-evento-icone">🎈</div>

            <div class="item-historico-evento-texto">
              <h3>${escaparHtml(evento.titulo || "-")}</h3>
              <p>
                ${escaparHtml(evento.tipo_evento || "Evento")} • ${formatarData(evento.data_evento)} às ${formatarHora(evento.hora_evento)}
              </p>
              <p style="margin-top:4px;">
                Responsável: ${escaparHtml(professorResponsavel)}
              </p>
            </div>

            <div class="item-historico-evento-lado">
              ${obterBadgeSituacao(situacao)}
            </div>
          </div>

          <details class="detalhes-evento-box detalhes-evento-historico" data-evento-id="${evento.id}">
            <summary>Ver mais</summary>
            <div class="conteudo-detalhes-evento">
              ${montarDetalhesEvento(evento)}
            </div>
          </details>
        </article>
      `;
    }).join("");
  }

  document.querySelectorAll(".btn-cancelar-evento").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const eventoId = Number(botao.dataset.eventoId);
      await cancelarEvento(eventoId);
    });
  });

  document.querySelectorAll(".link-ver-menos").forEach((botao) => {
    botao.addEventListener("click", () => {
      const eventoId = Number(botao.dataset.fecharEventoId);
      fecharDetalhesPorEventoId(eventoId);
    });
  });
}

/* =========================================================
   EVENTOS DOS FILTROS
========================================================= */
filtroBusca.addEventListener("input", renderizarEventos);
filtroSituacao.addEventListener("change", renderizarEventos);