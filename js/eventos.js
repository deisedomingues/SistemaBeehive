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
const eventosConfirmadosSemParticipacaoEl = document.getElementById(
  "eventosConfirmadosSemParticipacao"
);

const filtroBusca = document.getElementById("filtroBusca");
const filtroSituacao = document.getElementById("filtroSituacao");

/* =========================================================
   ESTADO
========================================================= */
let eventos = [];
let confirmacoesPorEvento = {};
let convitesPorEvento = {};
let eventosComParticipacaoRegistrada = new Set();
let participacoesPorEvento = {};

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
  if (!msg) return;

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
  if (!msg) return;

  msg.style.display = "none";
  msg.textContent = "";
}

function formatarData(dataStr) {
  if (!dataStr) return "-";

  const partes = String(dataStr).split("-");
  if (partes.length !== 3) return dataStr;

  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

function formatarHora(horaStr) {
  if (!horaStr) return "-";

  return String(horaStr).slice(0, 5);
}

function formatarDataHoraBR(dataHoraStr) {
  if (!dataHoraStr) return "-";

  const data = new Date(dataHoraStr);

  if (Number.isNaN(data.getTime())) {
    return "-";
  }

  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function obterSituacaoEvento(evento) {
  /*
    Importante:
    Antes estava usando !evento.ativo.
    Isso fazia null/undefined aparecer como cancelado.
    Agora só aparece cancelado quando ativo === false.
  */
  if (evento?.ativo === false) {
    return "cancelado";
  }

  if (!evento?.data_evento || !evento?.hora_evento) {
    return "ativo";
  }

  const agora = new Date();
  const dataHoraEvento = new Date(`${evento.data_evento}T${evento.hora_evento}`);

  if (!Number.isNaN(dataHoraEvento.getTime()) && dataHoraEvento < agora) {
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

function escaparHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function obterLocalEvento(evento) {
  return (
    evento.local ||
    evento.professor_responsavel?.link_eventos ||
    ""
  );
}

function montarLocalEventoHtml(evento) {
  const local = obterLocalEvento(evento);

  if (!local) return "-";

  if (local.startsWith("http://") || local.startsWith("https://")) {
    return `
      <a href="${escaparHtml(local)}" target="_blank" rel="noopener noreferrer">
        Abrir link do evento
      </a>
    `;
  }

  return escaparHtml(local);
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
  /*
    registrado = evento foi registrado, mesmo sem alunos.
    participacao_registrada = evento teve participação registrada.
    eventosComParticipacaoRegistrada = existe aula com status Evento vinculada.
  */
  return Boolean(
    evento?.registrado ||
    evento?.participacao_registrada ||
    eventosComParticipacaoRegistrada.has(Number(evento.id))
  );
}

function obterParticipacoesDoEvento(eventoId) {
  return participacoesPorEvento[Number(eventoId)] || {
    total: 0,
    alunosIds: new Set()
  };
}

function obterConfirmacoesDoEvento(eventoId) {
  return confirmacoesPorEvento[eventoId] || {
    total: 0,
    alunos: []
  };
}

function obterAlunosConfirmadosSemParticipacao(evento) {
  const jaRegistrado = eventoJaFoiRegistrado(evento);

  if (!jaRegistrado) {
    return [];
  }

  const confirmacoes = obterConfirmacoesDoEvento(evento.id);
  const participacoes = obterParticipacoesDoEvento(evento.id);

  return confirmacoes.alunos.filter(
    (aluno) => !participacoes.alunosIds.has(Number(aluno.id))
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
      registrado,
      registrado_em,
      participacao_registrada,
      professor_responsavel_id,
      professor_responsavel:professor_responsavel_id (
        id,
        nome,
        link_eventos
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

  if (!idsEventos.length) {
    return;
  }

  const { data, error } = await supabase
    .from("evento_confirmacao")
    .select(`
      evento_id,
      aluno_id,
      created_at,
      aluno:aluno_id (
        id,
        nome
      )
    `)
    .in("evento_id", idsEventos)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao carregar confirmações:", error);
    mostrarMensagem(
      "Os eventos foram carregados, mas houve erro ao buscar as confirmações.",
      "erro"
    );
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

    confirmacoesPorEvento[item.evento_id].alunos.push({
      id: item.aluno?.id || item.aluno_id,
      nome: item.aluno?.nome || `Aluno ID ${item.aluno_id}`
    });
  }

  Object.values(confirmacoesPorEvento).forEach((grupo) => {
    grupo.alunos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  });
}

async function carregarConvites() {
  convitesPorEvento = {};

  const idsEventos = eventos.map((evento) => evento.id);

  if (!idsEventos.length) {
    return;
  }

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
    mostrarMensagem(
      "Os eventos foram carregados, mas houve erro ao buscar os convites dos alunos.",
      "erro"
    );
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
  participacoesPorEvento = {};

  /*
    A tabela aula registra o evento pela matrícula.
    Por isso buscamos matricula:matricula_id para descobrir o aluno_id.
    Assim não dependemos de existir aluno_id diretamente na tabela aula.
  */
  const { data, error } = await supabase
    .from("aula")
    .select(`
      id,
      evento_id,
      matricula_id,
      status,
      matricula:matricula_id (
        id,
        aluno_id
      )
    `)
    .eq("status", "Evento")
    .not("evento_id", "is", null);

  if (error) {
    console.error("Erro ao buscar eventos já registrados:", error);
    mostrarMensagem(
      "Os eventos foram carregados, mas houve erro ao verificar participações já registradas.",
      "erro"
    );
    return;
  }

  for (const item of data || []) {
    if (item.evento_id == null) {
      continue;
    }

    const eventoIdAtual = Number(item.evento_id);
    const alunoIdAtual = Number(item.matricula?.aluno_id);

    eventosComParticipacaoRegistrada.add(eventoIdAtual);

    if (!participacoesPorEvento[eventoIdAtual]) {
      participacoesPorEvento[eventoIdAtual] = {
        total: 0,
        alunosIds: new Set()
      };
    }

    if (
      Number.isFinite(alunoIdAtual) &&
      !participacoesPorEvento[eventoIdAtual].alunosIds.has(alunoIdAtual)
    ) {
      participacoesPorEvento[eventoIdAtual].alunosIds.add(alunoIdAtual);
      participacoesPorEvento[eventoIdAtual].total += 1;
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
  let confirmadosSemParticipacao = 0;

  eventos.forEach((evento) => {
    const situacao = obterSituacaoEvento(evento);

    if (situacao === "ativo") {
      ativos += 1;
    }

    if (situacao === "encerrado" || situacao === "cancelado") {
      encerrados += 1;
    }

    /*
      Aqui conta alunos confirmados em eventos registrados,
      mas que não tiveram participação real registrada em aula.
    */
    confirmadosSemParticipacao += obterAlunosConfirmadosSemParticipacao(evento).length;
  });

  if (totalEventosEl) totalEventosEl.textContent = total;
  if (eventosAtivosEl) eventosAtivosEl.textContent = ativos;
  if (eventosEncerradosEl) eventosEncerradosEl.textContent = encerrados;

  if (eventosConfirmadosSemParticipacaoEl) {
    eventosConfirmadosSemParticipacaoEl.textContent = confirmadosSemParticipacao;
  }
}

/* =========================================================
   FILTROS
========================================================= */
function obterEventosFiltrados() {
  const busca = normalizarTexto(filtroBusca?.value || "");
  const situacaoFiltro = filtroSituacao?.value || "todos";

  return eventos.filter((evento) => {
    const titulo = normalizarTexto(evento.titulo);
    const tipo = normalizarTexto(evento.tipo_evento);
    const descricao = normalizarTexto(evento.descricao);
    const local = normalizarTexto(obterLocalEvento(evento));
    const professor = normalizarTexto(evento.professor_responsavel?.nome);

    const passouBusca =
      !busca ||
      titulo.includes(busca) ||
      tipo.includes(busca) ||
      descricao.includes(busca) ||
      local.includes(busca) ||
      professor.includes(busca);

    if (!passouBusca) {
      return false;
    }

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

  if (!confirmar) {
    return;
  }

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

  const confirmacoes = obterConfirmacoesDoEvento(evento.id);

  const convites = convitesPorEvento[evento.id] || {
    total: 0,
    visualizados: 0,
    naoVisualizados: 0
  };

  const participacoes = obterParticipacoesDoEvento(evento.id);
  const alunosSemParticipacao = obterAlunosConfirmadosSemParticipacao(evento);

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

  const alunosSemParticipacaoHtml = alunosSemParticipacao.length
    ? `
      <div class="bloco-detalhe-evento">
        <strong>Confirmados, porém sem participação</strong>
        <div class="chips-confirmados-evento">
          ${alunosSemParticipacao
            .map((aluno) => `
              <span class="chip-confirmado-evento">
                ${escaparHtml(aluno.nome)}
              </span>
            `)
            .join("")}
        </div>
      </div>
    `
    : "";

  let textoRegistroEvento = "";
  let corRegistroEvento = "#1d5e1d";

  if (jaRegistrado && participacoes.total > 0) {
    textoRegistroEvento =
      participacoes.total === 1
        ? "✅ Participação registrada para 1 aluno."
        : `✅ Participação registrada para ${participacoes.total} alunos.`;
  } else if (jaRegistrado) {
    textoRegistroEvento = "Evento registrado sem a participação de alunos.";
    corRegistroEvento = "#7a4b00";
  }

  const registroEventoHtml = jaRegistrado
    ? `
      <div class="bloco-detalhe-evento">
        <strong>Registro do evento</strong>
        <p style="margin:0; color:${corRegistroEvento}; font-weight:600;">
          ${escaparHtml(textoRegistroEvento)}
        </p>
      </div>
    `
    : "";

  /*
    Pode registrar evento encerrado.
    Só não pode registrar evento cancelado ou já registrado.
  */
  const podeRegistrarEvento =
    situacao !== "cancelado" &&
    !jaRegistrado;

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
        <strong>Link / local do evento</strong>
        <p>${montarLocalEventoHtml(evento)}</p>
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
        <strong>Participações registradas</strong>
        <p>${participacoes.total}</p>
      </div>

      <div class="bloco-detalhe-evento">
        <strong>Pendentes</strong>
        <p>${totalPendentes}</p>
      </div>
    </div>

    ${nomesConfirmadosHtml}
    ${registroEventoHtml}
    ${alunosSemParticipacaoHtml}

    <div class="acoes-evento-detalhe">
      ${
        podeRegistrarEvento
          ? `
            <a
              href="registrar-evento.html?evento=${evento.id}"
              class="btn"
              style="text-decoration:none; display:inline-block;"
            >
              Registrar evento / participação
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

  if (!gridEventosFuturos || !listaHistoricoEventos) {
    return;
  }

  if (!futuros.length) {
    gridEventosFuturos.innerHTML = `
      <div class="card">
        <p style="margin:0;">Nenhum evento futuro encontrado.</p>
      </div>
    `;
  } else {
    gridEventosFuturos.innerHTML = futuros
      .map((evento) => {
        const situacao = obterSituacaoEvento(evento);
        const professorResponsavel =
          evento.professor_responsavel?.nome || "Não informado";

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
                Link/local: ${montarLocalEventoHtml(evento)}
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
      })
      .join("");
  }

  if (!historico.length) {
    listaHistoricoEventos.innerHTML = `
      <div class="card">
        <p style="margin:0;">Nenhum evento encerrado ou cancelado encontrado.</p>
      </div>
    `;
  } else {
    listaHistoricoEventos.innerHTML = historico
      .map((evento) => {
        const situacao = obterSituacaoEvento(evento);
        const professorResponsavel =
          evento.professor_responsavel?.nome || "Não informado";

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
      })
      .join("");
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
if (filtroBusca) {
  filtroBusca.addEventListener("input", renderizarEventos);
}

if (filtroSituacao) {
  filtroSituacao.addEventListener("change", renderizarEventos);
}