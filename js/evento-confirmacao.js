import { supabase } from "./supabase.js";

/* =========================================================
   ELEMENTOS
========================================================= */
const msg = document.getElementById("msg");
const listaEventos = document.getElementById("listaEventos");

/* =========================================================
   ESTADO
========================================================= */
let alunoId = null;
let matriculasAtivas = [];
let eventosDisponiveis = [];
let confirmacoesSet = new Set();

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
  msg.style.display = "block";
  msg.textContent = texto;
  msg.style.padding = "10px";
  msg.style.borderRadius = "10px";

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

/* =========================================================
   REGRAS DE VISIBILIDADE
========================================================= */
function alunoPodeVerEvento(evento) {
  if (!matriculasAtivas.length) return false;

  if (evento.publico_alvo === "todos") {
    return true;
  }

  if (evento.publico_alvo === "materia") {
    return matriculasAtivas.some(
      (matricula) => Number(matricula.materia_id) === Number(evento.materia_id)
    );
  }

  if (evento.publico_alvo === "modulo_exato") {
    return matriculasAtivas.some(
      (matricula) => Number(matricula.modulo_id) === Number(evento.modulo_id)
    );
  }

  if (evento.publico_alvo === "modulo_a_partir") {
    const ordemEvento = evento.modulo?.ordem;

    if (!ordemEvento || !evento.materia_id) return false;

    return matriculasAtivas.some((matricula) => {
      const mesmaMateria = Number(matricula.materia_id) === Number(evento.materia_id);
      const ordemAluno = matricula.modulo?.ordem ?? null;

      return mesmaMateria && ordemAluno !== null && Number(ordemAluno) >= Number(ordemEvento);
    });
  }

  return false;
}

/* =========================================================
   CARREGAMENTO
========================================================= */
async function iniciarTela() {
  esconderMensagem();

  alunoId = obterAlunoIdLogado();

  if (!alunoId) {
    mostrarMensagem(
      "Não foi possível identificar o aluno logado. Verifique se o ID do aluno está salvo no login.",
      "erro"
    );
    listaEventos.innerHTML = `
      <div class="card">
        <p style="margin:0;">Não foi possível carregar os eventos.</p>
      </div>
    `;
    return;
  }

  await carregarMatriculasAtivas();
  await carregarEventosDisponiveis();
  await carregarConfirmacoesDoAluno();
  renderizarEventos();
}

async function carregarMatriculasAtivas() {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
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
    .eq("ativa", true);

  if (error) {
    console.error("Erro ao carregar matrículas do aluno:", error);
    mostrarMensagem("Erro ao carregar os cursos do aluno.", "erro");
    matriculasAtivas = [];
    return;
  }

  matriculasAtivas = data || [];
}

async function carregarEventosDisponiveis() {
  const agoraIso = new Date().toISOString();

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
    .gte("limite_confirmacao", agoraIso)
    .order("data_evento", { ascending: true })
    .order("hora_evento", { ascending: true });

  if (error) {
    console.error("Erro ao carregar eventos:", error);
    mostrarMensagem("Erro ao carregar os eventos.", "erro");
    eventosDisponiveis = [];
    return;
  }

  eventosDisponiveis = (data || []).filter(alunoPodeVerEvento);
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
    mostrarMensagem("Os eventos foram carregados, mas houve erro ao verificar suas confirmações.", "erro");
    return;
  }

  (data || []).forEach((item) => {
    confirmacoesSet.add(Number(item.evento_id));
  });
}

/* =========================================================
   AÇÕES
========================================================= */
async function confirmarPresenca(eventoId) {
  esconderMensagem();

  const evento = eventosDisponiveis.find((item) => Number(item.id) === Number(eventoId));

  if (!evento) {
    mostrarMensagem("Evento não encontrado.", "erro");
    return;
  }

  if (eventoJaConfirmado(eventoId)) {
    mostrarMensagem("Você já confirmou presença neste evento.");
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

    // caso a unique impeça duplicado
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

/* =========================================================
   RENDER
========================================================= */
function renderizarEventos() {
  if (!eventosDisponiveis.length) {
    listaEventos.innerHTML = `
      <div class="card">
        <p style="margin:0;">
          No momento não há eventos disponíveis para você confirmar.
        </p>
      </div>
    `;
    return;
  }

  listaEventos.innerHTML = eventosDisponiveis.map((evento) => {
    const confirmado = eventoJaConfirmado(evento.id);

    const publicoDetalhe =
      evento.publico_alvo === "materia" && evento.materia?.nome
        ? `${obterRotuloPublico(evento)} • ${evento.materia.nome}`
        : evento.publico_alvo === "modulo_exato" && evento.modulo?.nome
        ? `${obterRotuloPublico(evento)} • ${evento.modulo.nome}`
        : evento.publico_alvo === "modulo_a_partir" && evento.modulo?.nome
        ? `${obterRotuloPublico(evento)} • ${evento.modulo.nome}`
        : obterRotuloPublico(evento);

    const botaoHtml = confirmado
      ? `
        <button type="button" class="btn" disabled style="opacity:0.75; cursor:default;">
          Presença confirmada
        </button>
      `
      : `
        <button
          type="button"
          class="btn btn-confirmar-evento"
          data-evento-id="${evento.id}"
        >
          Confirmar presença
        </button>
      `;

    return `
      <article class="card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:10px;">
          <div>
            <h2 style="margin-bottom:6px;">${escaparHtml(evento.titulo || "-")}</h2>
            <p style="margin:0; opacity:0.85;">
              ${escaparHtml(evento.tipo_evento || "Evento")} • ${formatarData(evento.data_evento)} às ${formatarHora(evento.hora_evento)}
            </p>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-bottom:12px;">
          <div>
            <strong>Local:</strong><br>
            <span>${escaparHtml(evento.local || "-")}</span>
          </div>

          <div>
            <strong>Público:</strong><br>
            <span>${escaparHtml(publicoDetalhe)}</span>
          </div>

          <div>
            <strong>Confirmar até:</strong><br>
            <span>${formatarDataHoraBR(evento.limite_confirmacao)}</span>
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <strong>Descrição:</strong>
          <p style="margin:6px 0 0 0;">
            ${escaparHtml(evento.descricao || "Sem descrição informada.")}
          </p>
        </div>

        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          ${botaoHtml}
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll(".btn-confirmar-evento").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const eventoId = Number(botao.dataset.eventoId);
      await confirmarPresenca(eventoId);
    });
  });
}