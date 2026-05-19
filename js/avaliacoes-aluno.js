import { supabase } from "./supabase.js";
import { exigirAluno } from "./guard.js";

await exigirAluno();

/* =========================================================
   ELEMENTOS
========================================================= */
const msg = document.getElementById("msg");

const blocoCursoSelecionado = document.getElementById("blocoCursoSelecionado");
const textoCursoSelecionado = document.getElementById("textoCursoSelecionado");

const listaAvaliacoesPendentes = document.getElementById("listaAvaliacoesPendentes");
const listaAvaliacoesRealizadas = document.getElementById("listaAvaliacoesRealizadas");

/* =========================================================
   CONTEXTO DO ALUNO
========================================================= */
const alunoId =
  localStorage.getItem("alunoId") ||
  localStorage.getItem("aluno_id") ||
  localStorage.getItem("idAluno");

const matriculaSelecionadaId =
  localStorage.getItem("matriculaSelecionadaId") ||
  localStorage.getItem("matriculaSelecionada");

const nomeCursoSelecionado =
  localStorage.getItem("nomeCursoSelecionado") || "";

if (!alunoId) {
  window.location.href = "login.html";
}

/* =========================================================
   ESTADO
========================================================= */
let avaliacoesDoAluno = [];

/* =========================================================
   UTILITÁRIOS
========================================================= */
function mostrarMensagem(texto, ok = true) {
  if (!msg) return;

  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.padding = "10px 12px";
  msg.style.borderRadius = "10px";
  msg.style.fontSize = "14px";
  msg.style.marginBottom = "12px";

  if (ok) {
    msg.style.background = "#e8f5e9";
    msg.style.color = "#1b5e20";
    msg.style.border = "1px solid #a5d6a7";
  } else {
    msg.style.background = "#ffebee";
    msg.style.color = "#b71c1c";
    msg.style.border = "1px solid #ef9a9a";
  }

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
  }, 3500);
}

function mostrarMensagemLocal(elementoReferencia, texto, ok = true) {
  if (!elementoReferencia) return;

  const container =
    elementoReferencia.closest(".acoes-avaliacao-aluno") ||
    elementoReferencia.parentElement;

  if (!container) return;

  const antiga = container.querySelector(".msg-local-avaliacao");

  if (antiga) {
    antiga.remove();
  }

  const div = document.createElement("div");
  div.className = "msg-local-avaliacao";
  div.textContent = texto;
  div.style.marginTop = "8px";
  div.style.padding = "8px 10px";
  div.style.borderRadius = "8px";
  div.style.fontSize = "13px";

  if (ok) {
    div.style.background = "#e8f5e9";
    div.style.color = "#1b5e20";
    div.style.border = "1px solid #a5d6a7";
  } else {
    div.style.background = "#ffebee";
    div.style.color = "#b71c1c";
    div.style.border = "1px solid #ef9a9a";
  }

  container.appendChild(div);

  setTimeout(() => {
    div.remove();
  }, 3500);
}

function escapeHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarDataBR(dataISO) {
  if (!dataISO) return "Data não informada";

  const data = new Date(dataISO);

  if (!Number.isNaN(data.getTime())) {
    return data.toLocaleDateString("pt-BR");
  }

  const [ano, mes, dia] = String(dataISO).split("-");
  if (!ano || !mes || !dia) return String(dataISO);

  return `${dia}/${mes}/${ano}`;
}

function textoStatusAvaliacao(avaliacao) {
  if (avaliacao.status === "Pendente") {
    return "Pendente — aguardando realização.";
  }

  if (avaliacao.status === "Realizada pelo aluno") {
    return "Você informou que já realizou. Aguardando conferência/correção pela escola.";
  }

  if (avaliacao.status === "Concluída") {
    return "Concluída.";
  }

  if (avaliacao.status === "Cancelada") {
    return "Cancelada.";
  }

  return avaliacao.status || "Status não informado.";
}

function tituloAvaliacao(avaliacao) {
  const tituloFormulario = avaliacao?.avaliacao_formulario?.titulo;
  const numero = avaliacao?.numero_avaliacao;

  if (tituloFormulario) return tituloFormulario;
  if (numero) return `Progress Check ${numero}`;

  return "Avaliação";
}

function nomeMateriaModulo(avaliacao) {
  const materia = avaliacao?.materia?.nome || "Matéria";
  const modulo = avaliacao?.modulo?.nome || "Módulo";
  return `${materia} • ${modulo}`;
}

/* =========================================================
   BANCO DE DADOS
========================================================= */
async function marcarAvaliacoesComoVisualizadas() {
  const idsPendentesNaoVisualizados = avaliacoesDoAluno
    .filter((avaliacao) => avaliacao.status === "Pendente" && avaliacao.visualizado === false)
    .map((avaliacao) => avaliacao.id);

  if (!idsPendentesNaoVisualizados.length) return;

  const { error } = await supabase
    .from("avaliacao_aluno")
    .update({ visualizado: true })
    .in("id", idsPendentesNaoVisualizados);

  if (error) {
    console.warn("Não foi possível marcar avaliações como visualizadas:", error.message);
  }
}

async function carregarAvaliacoesDoAluno() {
  let query = supabase
    .from("avaliacao_aluno")
    .select(`
      id,
      aluno_id,
      matricula_id,
      materia_id,
      modulo_id,
      avaliacao_formulario_id,
      numero_avaliacao,
      status,
      enviado_em,
      visualizado,
      concluida_em,
      aluno_confirmou_realizacao_em,
      observacao,
      materia:materia_id (
        id,
        nome
      ),
      modulo:modulo_id (
        id,
        nome,
        ordem
      ),
      avaliacao_formulario:avaliacao_formulario_id (
        id,
        titulo,
        link_formulario
      )
    `)
    .eq("aluno_id", alunoId)
    .in("status", ["Pendente", "Realizada pelo aluno"])
    .order("enviado_em", { ascending: false });

  if (matriculaSelecionadaId) {
    query = query.eq("matricula_id", matriculaSelecionadaId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao carregar avaliações do aluno:", error);
    throw error;
  }

  avaliacoesDoAluno = data || [];
}

async function confirmarRealizacao(avaliacaoId) {
  const { data, error } = await supabase
    .from("avaliacao_aluno")
    .update({
      status: "Realizada pelo aluno",
      aluno_confirmou_realizacao_em: new Date().toISOString(),
      visualizado: true
    })
    .eq("id", avaliacaoId)
    .eq("aluno_id", alunoId)
    .eq("status", "Pendente")
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/* =========================================================
   RENDERIZAÇÃO
========================================================= */
function renderCursoSelecionado() {
  if (!blocoCursoSelecionado || !textoCursoSelecionado) return;

  blocoCursoSelecionado.style.display = "block";

  if (nomeCursoSelecionado) {
    textoCursoSelecionado.textContent = `Você está visualizando avaliações de: ${nomeCursoSelecionado}.`;
    return;
  }

  textoCursoSelecionado.textContent =
    "Você está visualizando suas avaliações disponíveis.";
}

function htmlAvaliacaoPendente(avaliacao) {
  const linkFormulario = avaliacao?.avaliacao_formulario?.link_formulario || "";
  const titulo = tituloAvaliacao(avaliacao);
  const materiaModulo = nomeMateriaModulo(avaliacao);

  return `
    <div class="item-avaliacao-resumo" style="margin-bottom:12px;">
      <div class="item-avaliacao-topo">
        <div class="item-avaliacao-info">
          <strong>${escapeHtml(titulo)}</strong>
          <p>${escapeHtml(materiaModulo)}</p>
          <p><b>Enviada em:</b> ${escapeHtml(formatarDataBR(avaliacao.enviado_em))}</p>
          <p><b>Status:</b> ${escapeHtml(textoStatusAvaliacao(avaliacao))}</p>
        </div>

        <div class="item-avaliacao-acoes acoes-avaliacao-aluno">
          <button
            type="button"
            class="btn btn-realizar-avaliacao"
            data-link="${escapeHtml(linkFormulario)}"
            data-avaliacao-id="${avaliacao.id}"
          >
            Realizar avaliação
          </button>

          <button
            type="button"
            class="btn btn-neutro btn-confirmar-realizacao"
            data-avaliacao-id="${avaliacao.id}"
          >
            Já realizei a avaliação
          </button>
        </div>
      </div>
    </div>
  `;
}

function htmlAvaliacaoRealizada(avaliacao) {
  const titulo = tituloAvaliacao(avaliacao);
  const materiaModulo = nomeMateriaModulo(avaliacao);

  return `
    <div class="item-avaliacao-resumo" style="margin-bottom:12px;">
      <div class="item-avaliacao-topo">
        <div class="item-avaliacao-info">
          <strong>${escapeHtml(titulo)}</strong>
          <p>${escapeHtml(materiaModulo)}</p>
          <p><b>Enviada em:</b> ${escapeHtml(formatarDataBR(avaliacao.enviado_em))}</p>
          <p><b>Informada como realizada em:</b> ${escapeHtml(formatarDataBR(avaliacao.aluno_confirmou_realizacao_em))}</p>
          <p><b>Status:</b> ${escapeHtml(textoStatusAvaliacao(avaliacao))}</p>
        </div>
      </div>
    </div>
  `;
}

function vincularBotoesAvaliacoes() {
  document.querySelectorAll(".btn-realizar-avaliacao").forEach((btn) => {
    btn.addEventListener("click", () => {
      const link = btn.dataset.link || "";

      if (!link) {
        mostrarMensagemLocal(
          btn,
          "Não foi possível localizar o link desta avaliação. Avise a escola.",
          false
        );
        return;
      }

      window.open(link, "_blank", "noopener,noreferrer");

      mostrarMensagemLocal(
        btn,
        "A avaliação foi aberta em uma nova aba. Depois de responder, volte aqui e clique em “Já realizei a avaliação”."
      );
    });
  });

  document.querySelectorAll(".btn-confirmar-realizacao").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const avaliacaoId = Number(btn.dataset.avaliacaoId || 0);

      if (!avaliacaoId) {
        mostrarMensagemLocal(btn, "Avaliação não identificada.", false);
        return;
      }

      const textoOriginal = btn.textContent;

      btn.disabled = true;
      btn.textContent = "Confirmando...";

      try {
        await confirmarRealizacao(avaliacaoId);

        mostrarMensagem("Obrigada! Sua avaliação foi marcada como realizada.");

        await carregarAvaliacoesDoAluno();
        await marcarAvaliacoesComoVisualizadas();
        renderAvaliacoes();
      } catch (error) {
        console.error("Erro ao confirmar realização da avaliação:", error);

        btn.disabled = false;
        btn.textContent = textoOriginal;

        mostrarMensagemLocal(
          btn,
          "Não foi possível confirmar agora. Tente novamente ou avise a escola.",
          false
        );
      }
    });
  });
}

function renderAvaliacoes() {
  if (!listaAvaliacoesPendentes || !listaAvaliacoesRealizadas) return;

  const pendentes = avaliacoesDoAluno.filter(
    (avaliacao) => avaliacao.status === "Pendente"
  );

  const realizadas = avaliacoesDoAluno.filter(
    (avaliacao) => avaliacao.status === "Realizada pelo aluno"
  );

  if (!pendentes.length) {
    listaAvaliacoesPendentes.innerHTML = `
      <p style="font-size:14px;">
        Você não possui avaliações pendentes no momento.
      </p>
    `;
  } else {
    listaAvaliacoesPendentes.innerHTML = pendentes
      .map(htmlAvaliacaoPendente)
      .join("");
  }

  if (!realizadas.length) {
    listaAvaliacoesRealizadas.innerHTML = `
      <p style="font-size:14px;">
        Nenhuma avaliação informada como realizada no momento.
      </p>
    `;
  } else {
    listaAvaliacoesRealizadas.innerHTML = realizadas
      .map(htmlAvaliacaoRealizada)
      .join("");
  }

  vincularBotoesAvaliacoes();
}

/* =========================================================
   INÍCIO
========================================================= */
async function iniciar() {
  try {
    renderCursoSelecionado();

    await carregarAvaliacoesDoAluno();
    await marcarAvaliacoesComoVisualizadas();

    renderAvaliacoes();
  } catch (error) {
    console.error("Erro ao carregar tela de avaliações:", error);

    if (listaAvaliacoesPendentes) {
      listaAvaliacoesPendentes.innerHTML = `
        <p style="font-size:14px;">
          Não foi possível carregar suas avaliações agora.
        </p>
      `;
    }

    if (listaAvaliacoesRealizadas) {
      listaAvaliacoesRealizadas.innerHTML = "";
    }

    mostrarMensagem(
      "Erro ao carregar avaliações. Tente novamente mais tarde ou avise a escola.",
      false
    );
  }
}

iniciar();