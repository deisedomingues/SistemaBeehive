import { supabase } from "./supabase.js";

/* =========================================================
   ELEMENTOS
========================================================= */
const msg = document.getElementById("msg");
const listaEventos = document.getElementById("listaEventos");

const blocoCursoEventos = document.getElementById("blocoCursoEventos");
const textoCursoEventos = document.getElementById("textoCursoEventos");
const labelSelectMatriculaEvento = document.getElementById("labelSelectMatriculaEvento");
const selectMatriculaEvento = document.getElementById("selectMatriculaEvento");

/* =========================================================
   ESTADO
========================================================= */
let alunoId = null;
let matriculasAtivas = [];
let matriculaSelecionada = null;
let eventosDisponiveis = [];
let confirmacoesSet = new Set();
let convitesMap = new Map();

/* =========================================================
   INICIALIZAÇÃO
========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  await iniciarTela();
});

/* =========================================================
   UTILITÁRIOS
========================================================= */
function mostrarMensagem(texto, tipo = "sucesso") {
  if (!msg) return;

  msg.style.display = "block";
  msg.textContent = texto;
  msg.style.padding = "10px";
  msg.style.borderRadius = "10px";
  msg.style.marginBottom = "12px";

  if (tipo === "erro") {
    msg.style.background = "#ffe5e5";
    msg.style.border = "1px solid #e7b4b4";
    msg.style.color = "#7a1f1f";
  } else {
    msg.style.background = "#e8f7e8";
    msg.style.border = "1px solid #b8deb8";
    msg.style.color = "#1d5e1d";
  }
}

function esconderMensagem() {
  if (!msg) return;
  msg.style.display = "none";
  msg.textContent = "";
}

function escaparHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function obterAlunoIdLogado() {
  const possiveisChaves = ["aluno_id", "alunoId", "idAluno"];

  for (const chave of possiveisChaves) {
    const valorLocal = localStorage.getItem(chave);
    if (valorLocal) return Number(valorLocal);

    const valorSession = sessionStorage.getItem(chave);
    if (valorSession) return Number(valorSession);
  }

  return null;
}

function montarNomeCurso(matricula) {
  const materia = matricula?.materia?.nome || "Curso";
  const modulo = matricula?.modulo?.nome || "Módulo não informado";
  return `${materia} — ${modulo}`;
}

function salvarMatriculaSelecionada(matricula) {
  if (!matricula?.id) return;

  localStorage.setItem("matriculaSelecionadaId", String(matricula.id));
  localStorage.setItem("materiaSelecionadaId", String(matricula.materia_id || ""));
  localStorage.setItem("moduloSelecionadoId", String(matricula.modulo_id || ""));
  localStorage.setItem("nomeCursoSelecionado", montarNomeCurso(matricula));
}

function eventoJaConfirmado(eventoId) {
  return confirmacoesSet.has(Number(eventoId));
}

function obterRotuloPublico(evento) {
  if (evento.publico_alvo === "todos") return "Todos os alunos";
  if (evento.publico_alvo === "materia") return "Somente este curso";
  if (evento.publico_alvo === "modulo_exato") return "Somente este módulo";
  if (evento.publico_alvo === "modulo_a_partir") return "A partir deste módulo";
  return "-";
}

function obterPublicoDetalhado(evento) {
  if (evento.publico_alvo === "todos") {
    return "Disponível para todos os alunos da escola";
  }

  if (evento.publico_alvo === "materia" && evento.materia?.nome) {
    return `${obterRotuloPublico(evento)} • ${evento.materia.nome}`;
  }

  if (
    (evento.publico_alvo === "modulo_exato" || evento.publico_alvo === "modulo_a_partir") &&
    evento.modulo?.nome
  ) {
    return `${obterRotuloPublico(evento)} • ${evento.materia?.nome || "Curso"} — ${evento.modulo.nome}`;
  }

  return obterRotuloPublico(evento);
}

function eventoPrazoConfirmacaoVencido(evento) {
  if (!evento?.limite_confirmacao) return false;
  return new Date(evento.limite_confirmacao) < new Date();
}

function eventoJaAconteceu(evento) {
  if (!evento?.data_evento || !evento?.hora_evento) return false;
  const dataHoraEvento = new Date(`${evento.data_evento}T${evento.hora_evento}`);
  return dataHoraEvento < new Date();
}

function eventoCondizComCursoSelecionado(evento) {
  if (!evento?.ativo) return false;
  if (!matriculaSelecionada) return false;
  if (eventoJaAconteceu(evento)) return false;

  if (evento.publico_alvo === "todos") {
    return true;
  }

  if (evento.publico_alvo === "materia") {
    return Number(matriculaSelecionada.materia_id) === Number(evento.materia_id);
  }

  if (evento.publico_alvo === "modulo_exato") {
    return (
      Number(matriculaSelecionada.materia_id) === Number(evento.materia_id) &&
      Number(matriculaSelecionada.modulo_id) === Number(evento.modulo_id)
    );
  }

  if (evento.publico_alvo === "modulo_a_partir") {
    const mesmaMateria = Number(matriculaSelecionada.materia_id) === Number(evento.materia_id);
    const ordemAluno = matriculaSelecionada.modulo?.ordem ?? null;
    const ordemEvento = evento.modulo?.ordem ?? null;

    if (!mesmaMateria || ordemAluno === null || ordemEvento === null) {
      return false;
    }

    return Number(ordemAluno) >= Number(ordemEvento);
  }

  return false;
}

/* =========================================================
   MATRÍCULAS
========================================================= */
async function carregarMatriculasAtivas() {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno_id,
      materia_id,
      modulo_id,
      ativa,
      modulo:modulo_id (
        id,
        nome,
        ordem,
        materia_id
      ),
      materia:materia_id (
        id,
        nome
      )
    `)
    .eq("aluno_id", alunoId)
    .eq("ativa", true)
    .order("id", { ascending: true });

  if (error) {
    console.error("Erro ao carregar matrículas do aluno:", error);
    mostrarMensagem("Erro ao carregar os cursos do aluno.", "erro");
    matriculasAtivas = [];
    return;
  }

  matriculasAtivas = data || [];
}

function definirMatriculaSelecionadaInicial() {
  if (!matriculasAtivas.length) {
    matriculaSelecionada = null;
    return;
  }

  const idSalvo = localStorage.getItem("matriculaSelecionadaId");

  const encontrada = matriculasAtivas.find(
    (m) => String(m.id) === String(idSalvo)
  );

  if (encontrada) {
    matriculaSelecionada = encontrada;
    return;
  }

  matriculaSelecionada = matriculasAtivas[0];
  salvarMatriculaSelecionada(matriculaSelecionada);
}

function preencherSelectMatriculas() {
  if (!blocoCursoEventos || !textoCursoEventos || !labelSelectMatriculaEvento || !selectMatriculaEvento) {
    return;
  }

  blocoCursoEventos.style.display = "block";
  selectMatriculaEvento.innerHTML = "";

  matriculasAtivas.forEach((matricula) => {
    const option = document.createElement("option");
    option.value = String(matricula.id);
    option.textContent = montarNomeCurso(matricula);
    selectMatriculaEvento.appendChild(option);
  });

  if (matriculasAtivas.length > 1) {
    labelSelectMatriculaEvento.style.display = "block";
  } else {
    labelSelectMatriculaEvento.style.display = "none";
  }

  if (matriculaSelecionada?.id) {
    selectMatriculaEvento.value = String(matriculaSelecionada.id);
    textoCursoEventos.textContent =
      `Você está visualizando os eventos do curso ${montarNomeCurso(matriculaSelecionada)}. Eventos gerais da escola também aparecem aqui.`;
  } else {
    textoCursoEventos.textContent = "Nenhum curso ativo encontrado.";
  }
}

/* =========================================================
   EVENTOS / CONVITES / CONFIRMAÇÕES
========================================================= */
async function carregarEventosDisponiveis() {
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
      modulo:modulo_id (
        id,
        nome,
        ordem,
        materia_id
      ),
      materia:materia_id (
        id,
        nome
      )
    `)
    .eq("ativo", true)
    .order("data_evento", { ascending: true })
    .order("hora_evento", { ascending: true });

  if (error) {
    console.error("Erro ao carregar eventos:", error);
    mostrarMensagem("Erro ao carregar os eventos.", "erro");
    eventosDisponiveis = [];
    return;
  }

  eventosDisponiveis = (data || []).filter(eventoCondizComCursoSelecionado);
}

async function sincronizarConvitesDoAluno() {
  convitesMap = new Map();

  if (!eventosDisponiveis.length) return;

  const idsEventos = eventosDisponiveis.map((evento) => evento.id);

  const { data: convitesExistentes, error: erroBusca } = await supabase
    .from("evento_convite_aluno")
    .select("id, evento_id, visualizado, visualizado_em")
    .eq("aluno_id", alunoId)
    .in("evento_id", idsEventos);

  if (erroBusca) {
    console.error("Erro ao buscar convites existentes do aluno:", erroBusca);
    return;
  }

  const idsComConvite = new Set(
    (convitesExistentes || []).map((item) => Number(item.evento_id))
  );

  const convitesFaltantes = idsEventos
    .filter((eventoId) => !idsComConvite.has(Number(eventoId)))
    .map((eventoId) => ({
      evento_id: Number(eventoId),
      aluno_id: Number(alunoId)
    }));

  if (convitesFaltantes.length) {
    const { error: erroUpsert } = await supabase
      .from("evento_convite_aluno")
      .upsert(convitesFaltantes, {
        onConflict: "evento_id,aluno_id",
        ignoreDuplicates: true
      });

    if (erroUpsert) {
      console.error("Erro ao criar convites faltantes do aluno:", erroUpsert);
    }
  }

  const { data: convitesAtualizados, error: erroAtualizados } = await supabase
    .from("evento_convite_aluno")
    .select("id, evento_id, visualizado, visualizado_em")
    .eq("aluno_id", alunoId)
    .in("evento_id", idsEventos);

  if (erroAtualizados) {
    console.error("Erro ao recarregar convites do aluno:", erroAtualizados);
    return;
  }

  (convitesAtualizados || []).forEach((convite) => {
    convitesMap.set(Number(convite.evento_id), convite);
  });
}

async function carregarConfirmacoesDoAluno() {
  confirmacoesSet = new Set();

  if (!eventosDisponiveis.length) return;

  const idsEventos = eventosDisponiveis.map((evento) => evento.id);

  const { data, error } = await supabase
    .from("evento_confirmacao")
    .select("evento_id")
    .eq("aluno_id", alunoId)
    .in("evento_id", idsEventos);

  if (error) {
    console.error("Erro ao carregar confirmações do aluno:", error);
    mostrarMensagem(
      "Os eventos foram carregados, mas houve erro ao verificar suas confirmações.",
      "erro"
    );
    return;
  }

  (data || []).forEach((item) => {
    confirmacoesSet.add(Number(item.evento_id));
  });
}

async function marcarConvitesComoVisualizados() {
  const idsNaoVisualizados = Array.from(convitesMap.values())
    .filter((convite) => !convite.visualizado)
    .map((convite) => convite.id);

  if (!idsNaoVisualizados.length) return;

  const agoraIso = new Date().toISOString();

  const { error } = await supabase
    .from("evento_convite_aluno")
    .update({
      visualizado: true,
      visualizado_em: agoraIso
    })
    .in("id", idsNaoVisualizados);

  if (error) {
    console.error("Erro ao marcar convites como visualizados:", error);
    return;
  }

  idsNaoVisualizados.forEach((idConvite) => {
    for (const [eventoId, convite] of convitesMap.entries()) {
      if (convite.id === idConvite) {
        convitesMap.set(eventoId, {
          ...convite,
          visualizado: true,
          visualizado_em: agoraIso
        });
      }
    }
  });
}

/* =========================================================
   AÇÕES
========================================================= */
async function confirmarPresenca(eventoId) {
  esconderMensagem();

  const evento = eventosDisponiveis.find(
    (item) => Number(item.id) === Number(eventoId)
  );

  if (!evento) {
    mostrarMensagem("Evento não encontrado.", "erro");
    return;
  }

  if (eventoJaConfirmado(eventoId)) {
    mostrarMensagem("Você já confirmou presença neste evento.");
    return;
  }

  if (eventoPrazoConfirmacaoVencido(evento)) {
    mostrarMensagem("O prazo de confirmação deste evento já foi encerrado.", "erro");
    renderizarEventos();
    return;
  }

  const { error } = await supabase
    .from("evento_confirmacao")
    .insert([
      {
        evento_id: eventoId,
        aluno_id: alunoId
      }
    ]);

  if (error) {
    console.error("Erro ao confirmar presença:", error);

    if (String(error.message || "").toLowerCase().includes("duplicate")) {
      confirmacoesSet.add(Number(eventoId));
      renderizarEventos();
      mostrarMensagem("Sua presença já estava confirmada.");
      return;
    }

    mostrarMensagem("Não foi possível confirmar sua presença.", "erro");
    return;
  }

  confirmacoesSet.add(Number(eventoId));
  renderizarEventos();
  mostrarMensagem("✅ Presença confirmada com sucesso!");
}

function adicionarEventosDeInterface() {
  document.querySelectorAll(".btn-confirmar-evento").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const eventoId = Number(botao.dataset.eventoId);
      await confirmarPresenca(eventoId);
    });
  });

  document.querySelectorAll(".detalhes-evento-box").forEach((details) => {
    const summary = details.querySelector("summary");
    const texto = summary?.querySelector(".texto-toggle-detalhes");
    const verMenos = details.querySelector(".link-ver-menos");

    function atualizarRotulo() {
      if (texto) {
        texto.textContent = details.open ? "Ver menos" : "Ver mais";
      }
    }

    atualizarRotulo();
    details.addEventListener("toggle", atualizarRotulo);

    if (verMenos) {
      verMenos.addEventListener("click", () => {
        details.open = false;
      });
    }
  });
}

/* =========================================================
   RENDER
========================================================= */
function renderizarEventos() {
  if (!listaEventos) return;

  if (!eventosDisponiveis.length) {
    listaEventos.innerHTML = `
      <div class="card">
        <p style="margin:0;">
          No momento não há eventos disponíveis para o curso selecionado.
        </p>
      </div>
    `;
    return;
  }

  listaEventos.innerHTML = eventosDisponiveis.map((evento) => {
    const confirmado = eventoJaConfirmado(evento.id);
    const prazoVencido = eventoPrazoConfirmacaoVencido(evento);
    const publicoDetalhe = obterPublicoDetalhado(evento);

    let badgeStatus = "";
    let statusInfo = "";
    let botaoHtml = "";

    if (confirmado) {
      badgeStatus = `<span class="badge-evento badge-evento-ativo">Confirmado</span>`;
      statusInfo = `
        <div class="mini-card-evento">
          <strong>Situação</strong>
          <p style="font-size:16px; margin-top:6px;">Sua presença já foi confirmada</p>
        </div>
      `;
      botaoHtml = `
        <button type="button" class="btn btn-evento-aluno-confirmado" disabled>
          Presença confirmada
        </button>
      `;
    } else if (prazoVencido) {
      badgeStatus = `<span class="badge-evento badge-evento-encerrado">Prazo encerrado</span>`;
      statusInfo = `
        <div class="mini-card-evento">
          <strong>Situação</strong>
          <p style="font-size:16px; margin-top:6px;">O prazo de confirmação terminou</p>
        </div>
      `;
      botaoHtml = `
        <button type="button" class="btn btn-evento-aluno-encerrado" disabled>
          Prazo encerrado
        </button>
      `;
    } else {
      badgeStatus = `<span class="badge-evento badge-evento-ativo">Disponível</span>`;
      statusInfo = `
        <div class="mini-card-evento">
          <strong>Situação</strong>
          <p style="font-size:16px; margin-top:6px;">Aguardando sua confirmação</p>
        </div>
      `;
      botaoHtml = `
        <button type="button" class="btn btn-confirmar-evento" data-evento-id="${evento.id}">
          Confirmar presença
        </button>
      `;
    }

    return `
      <article class="card card-evento-compacto card-evento-admin-futuro evento-visual-ativo">
        <div class="topo-card-evento-compacto">
          <div>
            <h2>${escaparHtml(evento.titulo || "-")}</h2>
            <p class="meta-evento-compacto">
              ${escaparHtml(evento.tipo_evento || "Evento")} •
              ${formatarData(evento.data_evento)} às ${formatarHora(evento.hora_evento)}
            </p>
          </div>

          <div>
            ${badgeStatus}
          </div>
        </div>

        ${statusInfo}

        <details class="detalhes-evento-box">
          <summary>
            <span class="texto-toggle-detalhes">Ver mais</span>
          </summary>

          <div class="conteudo-detalhes-evento">
            <div class="detalhes-evento-grid">
              <div class="bloco-detalhe-evento">
                <strong>Local</strong>
                <p>${escaparHtml(evento.local || "-")}</p>
              </div>

              <div class="bloco-detalhe-evento">
                <strong>Público</strong>
                <p>${escaparHtml(publicoDetalhe)}</p>
              </div>

              <div class="bloco-detalhe-evento">
                <strong>Confirmar até</strong>
                <p>${formatarDataHoraBR(evento.limite_confirmacao)}</p>
              </div>
            </div>

            <div class="bloco-detalhe-evento">
              <strong>Descrição</strong>
              <p>${escaparHtml(evento.descricao || "Sem descrição informada.")}</p>
            </div>

            <div class="acoes-evento-detalhe">
              ${botaoHtml}
              <button type="button" class="link-ver-menos">Ver menos</button>
            </div>
          </div>
        </details>
      </article>
    `;
  }).join("");

  adicionarEventosDeInterface();
}

/* =========================================================
   FLUXO
========================================================= */
async function recarregarTelaEventosPorCurso() {
  esconderMensagem();

  if (!matriculaSelecionada) {
    renderizarEventos();
    return;
  }

  salvarMatriculaSelecionada(matriculaSelecionada);
  preencherSelectMatriculas();

  await carregarEventosDisponiveis();
  await sincronizarConvitesDoAluno();
  await carregarConfirmacoesDoAluno();

  renderizarEventos();
  await marcarConvitesComoVisualizados();
}

async function iniciarTela() {
  esconderMensagem();

  alunoId = obterAlunoIdLogado();

  if (!alunoId) {
    mostrarMensagem(
      "Não foi possível identificar o aluno logado. Verifique se o ID do aluno está salvo no login.",
      "erro"
    );

    if (listaEventos) {
      listaEventos.innerHTML = `
        <div class="card">
          <p style="margin:0;">Não foi possível carregar os eventos.</p>
        </div>
      `;
    }
    return;
  }

  await carregarMatriculasAtivas();

  if (!matriculasAtivas.length) {
    if (blocoCursoEventos) blocoCursoEventos.style.display = "block";
    if (textoCursoEventos) {
      textoCursoEventos.textContent = "Você não possui matrícula ativa no momento.";
    }

    if (listaEventos) {
      listaEventos.innerHTML = `
        <div class="card">
          <p style="margin:0;">Você não possui curso ativo para visualizar eventos.</p>
        </div>
      `;
    }
    return;
  }

  definirMatriculaSelecionadaInicial();
  preencherSelectMatriculas();
  await recarregarTelaEventosPorCurso();
}

/* =========================================================
   EVENTOS DA INTERFACE
========================================================= */
if (selectMatriculaEvento) {
  selectMatriculaEvento.addEventListener("change", async () => {
    const idSelecionado = selectMatriculaEvento.value;

    const encontrada = matriculasAtivas.find(
      (m) => String(m.id) === String(idSelecionado)
    );

    if (!encontrada) return;

    matriculaSelecionada = encontrada;
    await recarregarTelaEventosPorCurso();
  });
}