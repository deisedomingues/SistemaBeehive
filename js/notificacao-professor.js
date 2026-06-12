import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

const btnSair = document.getElementById("btnSair");
const saudacaoProfessor = document.getElementById("saudacaoProfessor");

const badgeNotificacoesProfessor = document.getElementById("badgeNotificacoesProfessor");
const textoNotificacoesProfessor = document.getElementById("textoNotificacoesProfessor");
const listaNotificacoesProfessor = document.getElementById("listaNotificacoesProfessor");

const btnAtualizarNotificacoesProfessor = document.getElementById("btnAtualizarNotificacoesProfessor");
const btnMarcarTodasVistas = document.getElementById("btnMarcarTodasVistas");
const btnAtivarPushProfessorAtalho = document.getElementById("btnAtivarPushProfessorAtalho");

const professorId = localStorage.getItem("professorId");

if (!professorId) {
  window.location.href = "index.html";
}

/* ======================
   Segurança para textos
====================== */
function escaparHTML(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ======================
   Datas e horários
====================== */
function formatarDataBR(dataISO) {
  if (!dataISO) return "";

  const [ano, mes, dia] = String(dataISO).split("-");

  if (!ano || !mes || !dia) return String(dataISO);

  return `${dia}/${mes}/${ano}`;
}

function formatarHora(hora) {
  if (!hora) return "";

  return String(hora).slice(0, 5);
}

function formatarDataGoogle(dataISO, hora) {
  const [ano, mes, dia] = String(dataISO).split("-");
  const partesHora = String(hora || "00:00:00").split(":");

  const hh = partesHora[0] || "00";
  const mm = partesHora[1] || "00";
  const ss = partesHora[2] || "00";

  return `${ano}${mes}${dia}T${hh}${mm}${ss}`;
}

function criarLinkGoogleAgenda(item) {
  const titulo = `${item.tipo_agendamento || "Agendamento"} - Beehive`;

  const inicio = formatarDataGoogle(
    item.data_reposicao,
    item.hora_inicio_reposicao
  );

  const fim = formatarDataGoogle(
    item.data_reposicao,
    item.hora_fim_reposicao
  );

  const detalhes = [
    `${item.aluno_nome || "Um aluno"} agendou ${(item.tipo_agendamento || "um horário").toLowerCase()} na Beehive.`,
    item.observacao_aluno ? `Observação do aluno: ${item.observacao_aluno}` : "",
    item.tem_custo
      ? `Atenção: este agendamento possui custo. ${item.motivo_custo || ""}`
      : ""
  ]
    .filter(Boolean)
    .join("\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: titulo,
    dates: `${inicio}/${fim}`,
    details: detalhes,
    location: "Beehive Idiomas",
    ctz: "America/Sao_Paulo"
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/* ======================
   Texto do agendamento
====================== */
function montarTextoAgendamento(item) {
  const tipo = item.tipo_agendamento || "Agendamento";
  const aluno = item.aluno_nome || "Um aluno";
  const data = formatarDataBR(item.data_reposicao);
  const horaInicio = formatarHora(item.hora_inicio_reposicao);
  const horaFim = formatarHora(item.hora_fim_reposicao);

  const horario = horaFim
    ? `${horaInicio} às ${horaFim}`
    : horaInicio;

  if (tipo === "Plantão de dúvidas") {
    return `${aluno} agendou um plantão de dúvidas para ${data}, das ${horario}.`;
  }

  if (tipo === "Aula Instrumental") {
    return `${aluno} agendou uma aula instrumental para ${data}, das ${horario}.`;
  }

  return `${aluno} agendou uma reposição para ${data}, das ${horario}.`;
}

/* ======================
   Badge
====================== */
function atualizarBadge(total) {
  if (!badgeNotificacoesProfessor) return;

  if (total > 0) {
    badgeNotificacoesProfessor.textContent = total > 99 ? "99+" : String(total);
    badgeNotificacoesProfessor.style.display = "inline-flex";
  } else {
    badgeNotificacoesProfessor.textContent = "0";
    badgeNotificacoesProfessor.style.display = "none";
  }
}

/* ======================
   Professor logado
====================== */
async function carregarProfessor() {
  const { data, error } = await supabase
    .from("professor")
    .select("id, nome")
    .eq("id", professorId)
    .single();

  if (error || !data) {
    console.error("Erro ao carregar professor:", error);

    if (saudacaoProfessor) {
      saudacaoProfessor.textContent = "Olá!";
    }

    return;
  }

  if (saudacaoProfessor) {
    saudacaoProfessor.textContent = `Olá, ${data.nome}!`;
  }
}

/* ======================
   Estados visuais
====================== */
function renderizarEstadoVazio() {
  if (!listaNotificacoesProfessor || !textoNotificacoesProfessor) return;

  textoNotificacoesProfessor.textContent =
    "Nenhuma nova notificação no momento.";

  atualizarBadge(0);

  listaNotificacoesProfessor.innerHTML = `
    <article class="card-admin card-professor notificacao-professor-card">
      <div class="card-admin-icone">✅</div>

      <div class="card-admin-conteudo">
        <h2>Tudo certo por aqui</h2>
        <p>
          Quando um aluno agendar uma reposição, plantão de dúvidas ou aula instrumental,
          o aviso aparecerá nesta tela.
        </p>
      </div>
    </article>
  `;
}

function renderizarErro(mensagem = "Não foi possível carregar as notificações.") {
  if (!listaNotificacoesProfessor || !textoNotificacoesProfessor) return;

  textoNotificacoesProfessor.textContent = mensagem;

  atualizarBadge(0);

  listaNotificacoesProfessor.innerHTML = `
    <article class="card-admin card-professor notificacao-professor-card">
      <div class="card-admin-icone">⚠️</div>

      <div class="card-admin-conteudo">
        <h2>Erro ao carregar</h2>
        <p>
          Tente atualizar a página. Se o erro continuar, avise a administração.
        </p>
      </div>
    </article>
  `;
}

/* ======================
   Renderizar notificações
====================== */
function renderizarNotificacoes(notificacoes) {
  if (!textoNotificacoesProfessor || !listaNotificacoesProfessor) return;

  listaNotificacoesProfessor.innerHTML = "";

  const total = notificacoes.length;

  atualizarBadge(total);

  if (!total) {
    renderizarEstadoVazio();
    return;
  }

  textoNotificacoesProfessor.textContent =
    total === 1
      ? "Você tem 1 novo agendamento:"
      : `Você tem ${total} novos agendamentos:`;

  notificacoes.forEach((item) => {
    const card = document.createElement("article");
    card.className = "card-admin card-professor notificacao-professor-card";

    const mensagem = montarTextoAgendamento(item);
    const linkAgenda = criarLinkGoogleAgenda(item);

    const observacaoHTML = item.observacao_aluno
      ? `
        <p>
          <strong>Observação do aluno:</strong>
          ${escaparHTML(item.observacao_aluno)}
        </p>
      `
      : "";

    const custoHTML = item.tem_custo
      ? `
        <p style="color:#8a5a00;">
          <strong>Atenção:</strong>
          este agendamento possui custo.
          ${
            item.motivo_custo
              ? `<br>${escaparHTML(item.motivo_custo)}`
              : ""
          }
        </p>
      `
      : "";

    card.innerHTML = `
      <div class="card-admin-icone">📌</div>

      <div class="card-admin-conteudo">
        <h2>${escaparHTML(item.tipo_agendamento || "Agendamento")}</h2>

        <p>
          <strong>${escaparHTML(mensagem)}</strong>
        </p>

        ${observacaoHTML}

        ${custoHTML}

        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
          <a
            href="${linkAgenda}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-secundario"
            style="text-decoration:none;"
          >
            Adicionar ao Google Agenda
          </a>

          <button
            type="button"
            class="btn-principal btn-marcar-visto"
            data-reposicao-id="${item.reposicao_id}"
          >
            Marcar como visto
          </button>
        </div>
      </div>
    `;

    listaNotificacoesProfessor.appendChild(card);
  });

  document.querySelectorAll(".btn-marcar-visto").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const reposicaoId = Number(botao.dataset.reposicaoId);

      if (!reposicaoId) return;

      await marcarComoVista(reposicaoId);
    });
  });
}

/* ======================
   Buscar notificações
====================== */
async function carregarNotificacoes() {
  if (!textoNotificacoesProfessor || !listaNotificacoesProfessor) return;

  textoNotificacoesProfessor.textContent = "Carregando notificações...";

  listaNotificacoesProfessor.innerHTML = `
    <article class="card-admin card-professor notificacao-professor-card">
      <div class="card-admin-icone">⏳</div>

      <div class="card-admin-conteudo">
        <h2>Carregando...</h2>
        <p>Aguarde enquanto buscamos suas notificações.</p>
      </div>
    </article>
  `;

  atualizarBadge(0);

  const { data, error } = await supabase.rpc(
    "listar_notificacoes_professor_reposicao"
  );

  if (error) {
    console.error("Erro ao carregar notificações:", error);
    renderizarErro("Não foi possível carregar as notificações.");
    return;
  }

  renderizarNotificacoes(data || []);
}

/* ======================
   Marcar como visto
====================== */
async function marcarComoVista(reposicaoId) {
  const { error } = await supabase.rpc(
    "marcar_notificacao_professor_visualizada",
    {
      p_reposicao_id: reposicaoId
    }
  );

  if (error) {
    console.error("Erro ao marcar como vista:", error);
    alert("Não foi possível marcar esta notificação como vista.");
    return;
  }

  await carregarNotificacoes();
}

async function marcarTodasComoVistas() {
  const confirmar = confirm(
    "Deseja marcar todas as notificações como vistas?"
  );

  if (!confirmar) return;

  const { error } = await supabase.rpc(
    "marcar_todas_notificacoes_professor_visualizadas"
  );

  if (error) {
    console.error("Erro ao marcar todas como vistas:", error);
    alert("Não foi possível marcar todas como vistas.");
    return;
  }

  await carregarNotificacoes();
}

/* ======================
   Ativar push pelo botão da tela
====================== */
btnAtivarPushProfessorAtalho?.addEventListener("click", () => {
  if (!("Notification" in window)) {
    alert("Este navegador não suporta notificações.");
    return;
  }

  if (Notification.permission === "granted") {
    alert("As notificações push já estão ativadas neste navegador.");
    return;
  }

  if (Notification.permission === "denied") {
    alert(
      "As notificações estão bloqueadas. Para ativar, libere nas configurações do site no navegador."
    );
    return;
  }

  const botaoPush = document.getElementById("btnAtivarPushProfessor");

  if (botaoPush) {
    botaoPush.click();
    return;
  }

  alert("Recarregue a página e tente ativar novamente.");
});

/* ======================
   Botões
====================== */
btnAtualizarNotificacoesProfessor?.addEventListener("click", async () => {
  await carregarNotificacoes();
});

btnMarcarTodasVistas?.addEventListener("click", async () => {
  await marcarTodasComoVistas();
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
  localStorage.removeItem("matriculaSelecionada");
  localStorage.removeItem("alunoIdVisualizacao");

  window.location.href = "index.html";
});

/* ======================
   Iniciar
====================== */
await carregarProfessor();
await carregarNotificacoes();