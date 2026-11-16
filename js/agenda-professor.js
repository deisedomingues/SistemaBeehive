import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";
import {
  aplicarAvisosAusencia,
  buscarAvisosAusenciaNoPeriodo,
  buscarHorariosPorDia,
  carregarHorariosDoDia,
  criarMapaAvisosAusencia,
  dataAgendaISO
} from "./agenda-professor-dados.js";

await exigirProfessor();

const msgAgenda = document.getElementById("msgAgenda");
const textoHoje = document.getElementById("textoHoje");
const contadorHoje = document.getElementById("contadorHoje");
const listaHoje = document.getElementById("listaHoje");
const listaProximosDias = document.getElementById("listaProximosDias");
const btnAtualizarAgenda = document.getElementById("btnAtualizarAgenda");

let professorAtualId = null;

const NOMES_DIAS = {
  0: "Domingo",
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado"
};

/* =====================================================
   MENSAGEM
===================================================== */
function mostrarMensagem(texto, ok = true) {
  if (!msgAgenda) return;

  msgAgenda.textContent = texto;
  msgAgenda.style.display = "block";
  msgAgenda.style.padding = "10px";
  msgAgenda.style.borderRadius = "8px";
  msgAgenda.style.fontSize = "13px";
  msgAgenda.style.fontWeight = "600";

  if (ok) {
    msgAgenda.style.background = "#e8f5e9";
    msgAgenda.style.color = "#1b5e20";
    msgAgenda.style.border = "1px solid #a5d6a7";
  } else {
    msgAgenda.style.background = "#ffebee";
    msgAgenda.style.color = "#b71c1c";
    msgAgenda.style.border = "1px solid #ef9a9a";
  }

  setTimeout(() => {
    msgAgenda.style.display = "none";
    msgAgenda.textContent = "";
  }, 3500);
}

/* =====================================================
   TEXTO SEGURO
===================================================== */
function escaparHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =====================================================
   DATAS
===================================================== */
function formatarDataBR(dataISO) {
  if (!dataISO) return "";

  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function diaSemanaBancoAPartirDaData(data) {
  const diaJS = data.getDay();

  if (diaJS === 0) {
    return 0;
  }

  return diaJS;
}

function obterNomeDiaPorDataISO(dataISO) {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia, 12, 0, 0);
  return NOMES_DIAS[data.getDay()] || "";
}

function formatarHora(hora) {
  if (!hora) return "";
  return String(hora).slice(0, 5);
}

/* =====================================================
   GOOGLE AGENDA
===================================================== */
function montarDataHoraGoogle(dataISO, hora) {
  const dataLimpa = String(dataISO || "").replaceAll("-", "");
  const horaLimpa = String(hora || "").slice(0, 5).replace(":", "");

  return `${dataLimpa}T${horaLimpa}00`;
}

function montarLinkGoogleAgenda(item, dataISO) {
  const alunoNome = item.aluno?.nome || "Aluno";
  const materiaNome = item.materia?.nome || "Curso";
  const moduloNome = item.modulo?.nome || "Módulo";

  const horaInicio = formatarHora(item.hora_inicio);
  const horaFim = formatarHora(item.hora_fim);

  const titulo = `Beehive - ${alunoNome}`;

  const detalhes = [
    `Aluno: ${alunoNome}`,
    `Curso: ${materiaNome}`,
    `Módulo: ${moduloNome}`,
    `Horário: ${horaInicio} às ${horaFim}`,
    "",
    "Aula fixa semanal cadastrada no Sistema Beehive."
  ].join("\n");

  const inicioGoogle = montarDataHoraGoogle(dataISO, horaInicio);
  const fimGoogle = montarDataHoraGoogle(dataISO, horaFim);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: titulo,
    dates: `${inicioGoogle}/${fimGoogle}`,
    details: detalhes,
    ctz: "America/Sao_Paulo",
    recur: "RRULE:FREQ=WEEKLY"
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/* =====================================================
   DETALHES DO ALUNO
===================================================== */
function abrirDetalhesAluno(matriculaId) {
  if (!matriculaId) {
    mostrarMensagem("Não foi possível identificar a matrícula deste aluno.", false);
    return;
  }

  localStorage.setItem("matriculaSelecionada", String(matriculaId));
  window.location.href = "detalhes-aluno.html";
}

/* =====================================================
   PROFESSOR LOGADO
===================================================== */
async function obterProfessorAtualId() {
  const professorIdLocal =
    localStorage.getItem("professorId") ||
    localStorage.getItem("professor_id");

  if (professorIdLocal) {
    return Number(professorIdLocal);
  }

  const { data: authData, error: erroAuth } = await supabase.auth.getUser();

  if (erroAuth || !authData?.user?.email) {
    console.error("Erro ao obter usuário logado:", erroAuth);
    throw new Error("Não foi possível identificar o professor logado.");
  }

  const email = authData.user.email.toLowerCase();

  const { data: professor, error } = await supabase
    .from("professor")
    .select("id, nome, email")
    .ilike("email", email)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar professor pelo e-mail:", error);
    throw new Error("Erro ao localizar professor.");
  }

  if (!professor?.id) {
    throw new Error("Professor não encontrado para este login.");
  }

  localStorage.setItem("professorId", professor.id);

  return Number(professor.id);
}

/* =====================================================
   BUSCAR HORÁRIOS
===================================================== */
function textoSolicitacaoAusencia(tipo) {
  return tipo === "reposicao"
    ? "Aluno prefere reposição"
    : "Gravar esta aula";
}

/* =====================================================
   RENDER
===================================================== */
function criarCardHorario(item, dataISO, opcoes = {}) {
  const { mostrarDia = false, mostrarStatus = false } = opcoes;

  const alunoNome = item.aluno?.nome || "Aluno não informado";
  const materiaNome = item.materia?.nome || "Curso não informado";
  const moduloNome = item.modulo?.nome || "Módulo não informado";

  const horaInicio = formatarHora(item.hora_inicio);
  const horaFim = formatarHora(item.hora_fim);

  const linkGoogleAgenda = montarLinkGoogleAgenda(item, dataISO);

  const matriculaId = item.matricula_id;
  const avisoAusencia = item.aviso_ausencia || null;

  let htmlStatus = "";

  if (mostrarStatus) {
    const statusTexto = item.registrada ? "Aula registrada" : "Pendente de registro";
    const statusCor = item.registrada ? "#1b5e20" : "#9a6700";
    const statusFundo = item.registrada ? "#e8f5e9" : "#fff8e1";
    const statusBorda = item.registrada ? "#a5d6a7" : "#f1bc32";

    htmlStatus = `
      <span style="background:${statusFundo}; border:1px solid ${statusBorda}; color:${statusCor}; padding:5px 9px; border-radius:999px; font-size:12px; font-weight:700; text-align:center;">
        ${statusTexto}
      </span>
    `;
  }

  const htmlLinkDetalhes = matriculaId
    ? `
      <a
        href="detalhes-aluno.html"
        class="link-detalhes-aluno"
        data-matricula-id="${escaparHtml(matriculaId)}"
        style="
          font-size:12px;
          font-weight:700;
          color:#5f4b00;
          text-decoration:underline;
          white-space:nowrap;
        "
      >
        Ver detalhes do aluno
      </a>
    `
    : "";

  let htmlAvisoAusencia = "";

  if (avisoAusencia) {
    const tipoTexto = textoSolicitacaoAusencia(
      avisoAusencia.tipo_solicitacao
    );

    const justificativa =
      avisoAusencia.justificativa ||
      "Justificativa não informada.";

    const fundoAviso =
      avisoAusencia.tipo_solicitacao === "reposicao"
        ? "#eef4ff"
        : "#fff4e5";

    const bordaAviso =
      avisoAusencia.tipo_solicitacao === "reposicao"
        ? "#b9ccf5"
        : "#f6d59a";

    const corAviso =
      avisoAusencia.tipo_solicitacao === "reposicao"
        ? "#234a91"
        : "#7a4b00";

    htmlAvisoAusencia = `
      <div
        style="
          margin-top:11px;
          padding:10px 12px;
          border:1px solid ${bordaAviso};
          background:${fundoAviso};
          color:${corAviso};
          border-radius:9px;
          font-size:12.5px;
          line-height:1.5;
        "
      >
        <div style="font-weight:800; margin-bottom:4px;">
          ⚠️ Aluno informou que vai faltar
        </div>

        <div>
          <strong>Justificativa:</strong>
          ${escaparHtml(justificativa)}
        </div>

        <div style="margin-top:3px;">
          <strong>Solicitação:</strong>
          ${escaparHtml(tipoTexto)}
        </div>
      </div>
    `;
  }

  const card = document.createElement("div");
  card.style.border = avisoAusencia
    ? "1px solid #e0b24f"
    : "1px solid #f1e4a7";
  card.style.background = "#fffdf4";
  card.style.borderRadius = "12px";
  card.style.padding = "12px";
  card.style.marginBottom = "10px";

  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
      <div style="min-width:220px; flex:1;">

        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <strong style="font-size:14px; color:#3a2c00;">
            ${escaparHtml(alunoNome)}
          </strong>

          ${htmlLinkDetalhes}
        </div>

        <p style="margin:4px 0 0 0; font-size:12.5px; color:#555; line-height:1.4;">
          ${escaparHtml(materiaNome)} | ${escaparHtml(moduloNome)}
        </p>

        <p style="margin:5px 0 0 0; font-size:13px; color:#000;">
          <strong>${escaparHtml(horaInicio)}</strong> às <strong>${escaparHtml(horaFim)}</strong>
          ${mostrarDia ? ` · ${escaparHtml(obterNomeDiaPorDataISO(dataISO))} · ${escaparHtml(formatarDataBR(dataISO))}` : ""}
        </p>
      </div>

      <div style="display:flex; flex-direction:column; gap:7px; align-items:flex-end;">
        ${htmlStatus}

        <a
          href="${escaparHtml(linkGoogleAgenda)}"
          target="_blank"
          rel="noopener noreferrer"
          style="background:#fff; border:1px solid #d8d8d8; color:#333; padding:6px 9px; border-radius:8px; font-size:12px; font-weight:700; text-decoration:none; white-space:nowrap;"
        >
          + Google Agenda
        </a>
      </div>
    </div>

    ${htmlAvisoAusencia}
  `;

  const linkDetalhes = card.querySelector(".link-detalhes-aluno");

  linkDetalhes?.addEventListener("click", (e) => {
    e.preventDefault();

    const idMatricula = linkDetalhes.dataset.matriculaId;
    abrirDetalhesAluno(idMatricula);
  });

  return card;
}

function renderizarHoje(horariosComStatus, dataISO) {
  listaHoje.innerHTML = "";

  const nomeDia = obterNomeDiaPorDataISO(dataISO);

  textoHoje.textContent = `${nomeDia}, ${formatarDataBR(dataISO)}`;
  contadorHoje.textContent = `${horariosComStatus.length} horário(s)`;

  if (!horariosComStatus.length) {
    listaHoje.innerHTML = `
      <div style="padding:12px; border:1px solid #eee; background:#fff; border-radius:10px; font-size:13px; color:#666;">
        Nenhum aluno cadastrado para hoje.
      </div>
    `;
    return;
  }

  horariosComStatus.forEach((item) => {
    listaHoje.appendChild(
      criarCardHorario(item, dataISO, {
        mostrarDia: false,
        mostrarStatus: true
      })
    );
  });
}

function renderizarProximosDias(listaPorDia) {
  listaProximosDias.innerHTML = "";

  const diasComHorario = listaPorDia.filter((dia) => dia.horarios.length > 0);

  if (!diasComHorario.length) {
    listaProximosDias.innerHTML = `
      <div style="padding:12px; border:1px solid #eee; background:#fff; border-radius:10px; font-size:13px; color:#666;">
        Nenhum horário cadastrado para os próximos dias.
      </div>
    `;
    return;
  }

  diasComHorario.forEach((dia) => {
    const bloco = document.createElement("div");
    bloco.style.marginBottom = "16px";

    bloco.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:8px;">
        <h3 style="font-size:14px; margin:0; color:#5f4b00;">
          ${escaparHtml(obterNomeDiaPorDataISO(dia.dataISO))}
        </h3>

        <span style="font-size:12px; color:#666;">
          ${escaparHtml(formatarDataBR(dia.dataISO))} · ${dia.horarios.length} horário(s)
        </span>
      </div>
    `;

    dia.horarios.forEach((item) => {
      bloco.appendChild(
        criarCardHorario(item, dia.dataISO, {
          mostrarDia: false,
          mostrarStatus: false
        })
      );
    });

    listaProximosDias.appendChild(bloco);
  });
}

/* =====================================================
   CARREGAR AGENDA
===================================================== */
async function carregarAgenda() {
  listaHoje.innerHTML = `
    <div style="padding:12px; font-size:13px; color:#666;">
      Carregando agenda de hoje...
    </div>
  `;

  listaProximosDias.innerHTML = `
    <div style="padding:12px; font-size:13px; color:#666;">
      Carregando próximos dias...
    </div>
  `;

  const hojeISO = dataAgendaISO();
  const dataFinalISO = dataAgendaISO(6);

  /*
    Carrega de uma vez todos os avisos de ausência
    que podem aparecer na agenda de hoje e dos
    próximos dias.
  */
  const avisosAusencia = await buscarAvisosAusenciaNoPeriodo(
    professorAtualId,
    hojeISO,
    dataFinalISO
  );

  const mapaAvisosAusencia =
    criarMapaAvisosAusencia(avisosAusencia);

  const horariosHojeComAvisos = await carregarHorariosDoDia(
    professorAtualId,
    hojeISO,
    mapaAvisosAusencia
  );

  renderizarHoje(
    horariosHojeComAvisos,
    hojeISO
  );

  const proximosDias = [];

  for (let offset = 1; offset <= 6; offset++) {
    const dataISO = dataAgendaISO(offset);

    const [ano, mes, dia] = dataISO.split("-").map(Number);
    const dataObj = new Date(ano, mes - 1, dia, 12, 0, 0);

    const diaSemana = diaSemanaBancoAPartirDaData(dataObj);

    if (diaSemana === 0) {
      continue;
    }

    const horarios = await buscarHorariosPorDia(professorAtualId, diaSemana);

    const horariosComAvisos =
      aplicarAvisosAusencia(
        horarios,
        dataISO,
        mapaAvisosAusencia
      );

    proximosDias.push({
      dataISO,
      diaSemana,
      horarios: horariosComAvisos
    });
  }

  renderizarProximosDias(proximosDias);
}

/* =====================================================
   EVENTOS
===================================================== */
btnAtualizarAgenda.addEventListener("click", async () => {
  try {
    btnAtualizarAgenda.disabled = true;
    btnAtualizarAgenda.textContent = "Atualizando...";

    await carregarAgenda();

    mostrarMensagem("Agenda atualizada com sucesso!", true);
  } catch (erro) {
    console.error("Erro ao atualizar agenda:", erro);
    mostrarMensagem(erro.message || "Erro ao atualizar agenda.", false);
  } finally {
    btnAtualizarAgenda.disabled = false;
    btnAtualizarAgenda.textContent = "Atualizar";
  }
});

/* =====================================================
   INICIALIZAÇÃO
===================================================== */
try {
  professorAtualId = await obterProfessorAtualId();
  await carregarAgenda();
} catch (erro) {
  console.error("Erro ao iniciar agenda:", erro);

  listaHoje.innerHTML = `
    <div style="padding:12px; border:1px solid #ef9a9a; background:#ffebee; border-radius:10px; font-size:13px; color:#b71c1c;">
      ${escaparHtml(erro.message || "Erro ao carregar a agenda.")}
    </div>
  `;

  listaProximosDias.innerHTML = "";
}