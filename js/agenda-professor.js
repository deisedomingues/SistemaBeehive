import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

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
   DATAS
===================================================== */
function obterDataHojeLocalISO() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

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

function obterDataISOComOffset(diasParaSomar) {
  const data = new Date();
  data.setHours(12, 0, 0, 0);
  data.setDate(data.getDate() + diasParaSomar);

  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
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
async function buscarHorariosPorDia(diaSemana) {
  if (!diaSemana || diaSemana < 1 || diaSemana > 6) {
    return [];
  }

  const { data, error } = await supabase
    .from("aluno_horario_aula")
    .select(`
      id,
      aluno_id,
      matricula_id,
      materia_id,
      modulo_id,
      professor_id,
      dia_semana,
      hora_inicio,
      hora_fim,
      ativo,
      aluno:aluno_id (
        id,
        nome
      ),
      materia:materia_id (
        id,
        nome
      ),
      modulo:modulo_id (
        id,
        nome
      )
    `)
    .eq("professor_id", professorAtualId)
    .eq("dia_semana", diaSemana)
    .eq("ativo", true)
    .order("hora_inicio", { ascending: true });

  if (error) {
    console.error("Erro ao buscar horários:", error);
    throw new Error("Erro ao carregar horários da agenda.");
  }

  return data || [];
}

/* =====================================================
   BUSCAR AULAS REGISTRADAS
===================================================== */
async function buscarAulasRegistradasNaData(dataISO) {
  const { data, error } = await supabase
    .from("aula")
    .select(`
      id,
      data_aula,
      matricula_id,
      professor_id,
      status,
      parte
    `)
    .eq("professor_id", professorAtualId)
    .eq("data_aula", dataISO);

  if (error) {
    console.error("Erro ao buscar aulas registradas:", error);
    throw new Error("Erro ao verificar aulas registradas.");
  }

  return data || [];
}

/*
  Essa função marca "registrada" respeitando casos em que
  o mesmo aluno tem duas aulas no mesmo dia.

  Exemplo:
  Horários:
  10:00-10:40
  10:40-11:20

  Se existe só 1 aula registrada naquele dia para aquela matrícula,
  só o primeiro horário aparece como registrado.
*/
function aplicarStatusDeRegistro(horarios, aulasRegistradas) {
  const horariosOrdenados = [...horarios].sort((a, b) => {
    const horaA = String(a.hora_inicio || "");
    const horaB = String(b.hora_inicio || "");

    if (horaA === horaB) {
      return String(a.aluno?.nome || "").localeCompare(String(b.aluno?.nome || ""));
    }

    return horaA.localeCompare(horaB);
  });

  const aulasPorMatricula = {};

  (aulasRegistradas || []).forEach((aula) => {
    const chave = String(aula.matricula_id);

    if (!aulasPorMatricula[chave]) {
      aulasPorMatricula[chave] = [];
    }

    aulasPorMatricula[chave].push(aula);
  });

  Object.keys(aulasPorMatricula).forEach((chave) => {
    aulasPorMatricula[chave].sort((a, b) => {
      const parteA = Number(a.parte || 1);
      const parteB = Number(b.parte || 1);
      return parteA - parteB;
    });
  });

  const contadorUsoPorMatricula = {};

  return horariosOrdenados.map((horario) => {
    const chave = String(horario.matricula_id);
    const aulasDaMatricula = aulasPorMatricula[chave] || [];

    const indiceUso = contadorUsoPorMatricula[chave] || 0;
    const aulaCorrespondente = aulasDaMatricula[indiceUso];

    let registrada = false;
    let aulaId = null;
    let statusAula = null;

    if (aulaCorrespondente) {
      registrada = true;
      aulaId = aulaCorrespondente.id;
      statusAula = aulaCorrespondente.status || null;
      contadorUsoPorMatricula[chave] = indiceUso + 1;
    }

    return {
      ...horario,
      registrada,
      aula_id: aulaId,
      status_aula: statusAula
    };
  });
}

/* =====================================================
   RENDER
===================================================== */
function criarCardHorario(item, dataISO, mostrarDia = false) {
  const alunoNome = item.aluno?.nome || "Aluno não informado";
  const materiaNome = item.materia?.nome || "Curso não informado";
  const moduloNome = item.modulo?.nome || "Módulo não informado";

  const horaInicio = formatarHora(item.hora_inicio);
  const horaFim = formatarHora(item.hora_fim);

  const statusTexto = item.registrada ? "Aula registrada" : "Pendente de registro";
  const statusCor = item.registrada ? "#1b5e20" : "#9a6700";
  const statusFundo = item.registrada ? "#e8f5e9" : "#fff8e1";
  const statusBorda = item.registrada ? "#a5d6a7" : "#f1bc32";

  const card = document.createElement("div");
  card.style.border = "1px solid #f1e4a7";
  card.style.background = "#fffdf4";
  card.style.borderRadius = "12px";
  card.style.padding = "12px";
  card.style.marginBottom = "10px";

  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
      <div>
        <strong style="font-size:14px; color:#3a2c00;">
          ${alunoNome}
        </strong>

        <p style="margin:4px 0 0 0; font-size:12.5px; color:#555; line-height:1.4;">
          ${materiaNome} | ${moduloNome}
        </p>

        <p style="margin:5px 0 0 0; font-size:13px; color:#000;">
          <strong>${horaInicio}</strong> às <strong>${horaFim}</strong>
          ${mostrarDia ? ` · ${obterNomeDiaPorDataISO(dataISO)} · ${formatarDataBR(dataISO)}` : ""}
        </p>
      </div>

      <span style="background:${statusFundo}; border:1px solid ${statusBorda}; color:${statusCor}; padding:5px 9px; border-radius:999px; font-size:12px; font-weight:700;">
        ${statusTexto}
      </span>
    </div>
  `;

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
    listaHoje.appendChild(criarCardHorario(item, dataISO, false));
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
          ${obterNomeDiaPorDataISO(dia.dataISO)}
        </h3>

        <span style="font-size:12px; color:#666;">
          ${formatarDataBR(dia.dataISO)} · ${dia.horarios.length} horário(s)
        </span>
      </div>
    `;

    dia.horarios.forEach((item) => {
      bloco.appendChild(criarCardHorario(item, dia.dataISO, false));
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

  const hojeISO = obterDataHojeLocalISO();
  const hoje = new Date();
  const diaSemanaHoje = hoje.getDay();

  const horariosHoje = await buscarHorariosPorDia(diaSemanaHoje);
  const aulasHoje = await buscarAulasRegistradasNaData(hojeISO);
  const horariosHojeComStatus = aplicarStatusDeRegistro(horariosHoje, aulasHoje);

  renderizarHoje(horariosHojeComStatus, hojeISO);

  const proximosDias = [];

  for (let offset = 1; offset <= 6; offset++) {
    const dataISO = obterDataISOComOffset(offset);

    const [ano, mes, dia] = dataISO.split("-").map(Number);
    const dataObj = new Date(ano, mes - 1, dia, 12, 0, 0);

    const diaSemana = diaSemanaBancoAPartirDaData(dataObj);

    if (diaSemana === 0) {
      continue;
    }

    const horarios = await buscarHorariosPorDia(diaSemana);
    const aulasRegistradas = await buscarAulasRegistradasNaData(dataISO);
    const horariosComStatus = aplicarStatusDeRegistro(horarios, aulasRegistradas);

    proximosDias.push({
      dataISO,
      diaSemana,
      horarios: horariosComStatus
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
      ${erro.message || "Erro ao carregar a agenda."}
    </div>
  `;

  listaProximosDias.innerHTML = "";
}