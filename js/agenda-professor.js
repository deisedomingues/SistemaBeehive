import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

/* =====================================================
   ELEMENTOS
===================================================== */
const msgAgenda = document.getElementById("msgAgenda");
const textoHoje = document.getElementById("textoHoje");
const contadorHoje = document.getElementById("contadorHoje");
const listaHoje = document.getElementById("listaHoje");
const listaProximosDias = document.getElementById(
  "listaProximosDias"
);
const btnAtualizarAgenda = document.getElementById(
  "btnAtualizarAgenda"
);

/* =====================================================
   ESTADO
===================================================== */
let professorAtualId = null;

/*
  A matrícula será a fonte principal para saber:

  - qual é o professor atual;
  - qual é o aluno;
  - qual é a matéria;
  - qual é o módulo;
  - se o curso está ativo.
*/
let matriculasAtivasProfessor = new Map();

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
  if (!msgAgenda) {
    return;
  }

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
function obterDataHojeLocalISO() {
  const hoje = new Date();

  const ano = hoje.getFullYear();
  const mes = String(
    hoje.getMonth() + 1
  ).padStart(2, "0");

  const dia = String(
    hoje.getDate()
  ).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function formatarDataBR(dataISO) {
  if (!dataISO) {
    return "";
  }

  const [ano, mes, dia] = String(dataISO).split("-");

  if (!ano || !mes || !dia) {
    return String(dataISO);
  }

  return `${dia}/${mes}/${ano}`;
}

function obterDataISOComOffset(diasParaSomar) {
  const data = new Date();

  /*
    O horário de meio-dia evita mudanças indevidas de data
    durante conversões internas do navegador.
  */
  data.setHours(12, 0, 0, 0);

  data.setDate(
    data.getDate() + diasParaSomar
  );

  const ano = data.getFullYear();

  const mes = String(
    data.getMonth() + 1
  ).padStart(2, "0");

  const dia = String(
    data.getDate()
  ).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function criarDataLocalPorISO(dataISO) {
  const [ano, mes, dia] = String(dataISO)
    .split("-")
    .map(Number);

  return new Date(
    ano,
    mes - 1,
    dia,
    12,
    0,
    0
  );
}

function obterNomeDiaPorDataISO(dataISO) {
  const data = criarDataLocalPorISO(dataISO);

  return NOMES_DIAS[data.getDay()] || "";
}

function formatarHora(hora) {
  if (!hora) {
    return "";
  }

  return String(hora).slice(0, 5);
}

/* =====================================================
   GOOGLE AGENDA
===================================================== */
function montarDataHoraGoogle(dataISO, hora) {
  const dataLimpa = String(dataISO || "")
    .replaceAll("-", "");

  const horaLimpa = String(hora || "")
    .slice(0, 5)
    .replace(":", "");

  return `${dataLimpa}T${horaLimpa}00`;
}

function montarLinkGoogleAgenda(item, dataISO) {
  const alunoNome =
    item.aluno?.nome || "Aluno";

  const materiaNome =
    item.materia?.nome || "Curso";

  const moduloNome =
    item.modulo?.nome || "Módulo";

  const horaInicio = formatarHora(
    item.hora_inicio
  );

  const horaFim = formatarHora(
    item.hora_fim
  );

  const titulo = `Beehive - ${alunoNome}`;

  const detalhes = [
    `Aluno: ${alunoNome}`,
    `Curso: ${materiaNome}`,
    `Módulo: ${moduloNome}`,
    `Horário: ${horaInicio} às ${horaFim}`,
    "",
    "Aula fixa semanal cadastrada no Sistema Beehive."
  ].join("\n");

  const inicioGoogle = montarDataHoraGoogle(
    dataISO,
    horaInicio
  );

  const fimGoogle = montarDataHoraGoogle(
    dataISO,
    horaFim
  );

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: titulo,
    dates: `${inicioGoogle}/${fimGoogle}`,
    details: detalhes,
    ctz: "America/Sao_Paulo",
    recur: "RRULE:FREQ=WEEKLY"
  });

  return (
    "https://calendar.google.com/calendar/render?" +
    params.toString()
  );
}

/* =====================================================
   DETALHES DO ALUNO
===================================================== */
function abrirDetalhesAluno(matriculaId) {
  if (!matriculaId) {
    mostrarMensagem(
      "Não foi possível identificar a matrícula deste aluno.",
      false
    );

    return;
  }

  localStorage.setItem(
    "matriculaSelecionada",
    String(matriculaId)
  );

  localStorage.setItem(
    "matriculaSelecionadaId",
    String(matriculaId)
  );

  window.location.href = "detalhes-aluno.html";
}

/* =====================================================
   PROFESSOR LOGADO
===================================================== */
async function obterProfessorAtualId() {
  /*
    Não usamos primeiro o ID salvo no navegador.

    O usuário autenticado no Supabase é a referência correta.
    Isso impede que o ID de outro professor fique salvo no
    navegador e seja usado por engano.
  */
  const {
    data: authData,
    error: erroAuth
  } = await supabase.auth.getUser();

  if (
    erroAuth ||
    !authData?.user ||
    !authData.user.email
  ) {
    console.error(
      "Erro ao obter usuário logado:",
      erroAuth
    );

    throw new Error(
      "Não foi possível identificar o usuário conectado."
    );
  }

  const email = String(authData.user.email)
    .trim()
    .toLowerCase();

  const {
    data: professor,
    error: erroProfessor
  } = await supabase
    .from("professor")
    .select(`
      id,
      nome,
      email,
      ativo
    `)
    .ilike("email", email)
    .maybeSingle();

  if (erroProfessor) {
    console.error(
      "Erro ao buscar professor pelo e-mail:",
      erroProfessor
    );

    throw new Error(
      "Erro ao localizar o cadastro do professor."
    );
  }

  if (!professor?.id) {
    throw new Error(
      "Não existe um professor cadastrado para este login."
    );
  }

  if (professor.ativo === false) {
    throw new Error(
      "O cadastro deste professor está desativado."
    );
  }

  const professorId = Number(professor.id);

  if (!Number.isFinite(professorId)) {
    throw new Error(
      "O identificador do professor é inválido."
    );
  }

  /*
    Sobrescreve possíveis IDs antigos guardados
    no navegador.
  */
  localStorage.setItem(
    "professorId",
    String(professorId)
  );

  localStorage.setItem(
    "professor_id",
    String(professorId)
  );

  return professorId;
}

/* =====================================================
   MATRÍCULAS ATIVAS DO PROFESSOR
===================================================== */
async function carregarMatriculasAtivasProfessor() {
  const {
    data,
    error
  } = await supabase
    .from("matricula")
    .select(`
      id,
      ativa,
      aluno_id,
      materia_id,
      modulo_id,
      professor_id,

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
    .eq("ativa", true)
    .order("id", {
      ascending: true
    });

  if (error) {
    console.error(
      "Erro ao buscar matrículas ativas do professor:",
      error
    );

    throw new Error(
      "Erro ao carregar os alunos do professor."
    );
  }

  matriculasAtivasProfessor = new Map();

  (data || []).forEach((matricula) => {
    matriculasAtivasProfessor.set(
      String(matricula.id),
      matricula
    );
  });
}

/* =====================================================
   BUSCAR HORÁRIOS
===================================================== */
async function buscarHorariosPorDia(diaSemana) {
  /*
    O sistema da escola utiliza:
    1 = segunda-feira
    2 = terça-feira
    3 = quarta-feira
    4 = quinta-feira
    5 = sexta-feira
    6 = sábado
  */
  if (
    !diaSemana ||
    diaSemana < 1 ||
    diaSemana > 6
  ) {
    return [];
  }

  const matriculaIds = [
    ...matriculasAtivasProfessor.keys()
  ]
    .map(Number)
    .filter(Number.isFinite);

  if (!matriculaIds.length) {
    return [];
  }

  /*
    Agora procuramos os horários pelas matrículas ativas
    da professora.

    Assim, matricula.professor_id é a referência principal,
    e não aluno_horario_aula.professor_id.
  */
  const {
    data,
    error
  } = await supabase
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
      ativo
    `)
    .in("matricula_id", matriculaIds)
    .eq("dia_semana", diaSemana)
    .eq("ativo", true)
    .order("hora_inicio", {
      ascending: true
    });

  if (error) {
    console.error(
      "Erro ao buscar horários:",
      error
    );

    throw new Error(
      "Erro ao carregar horários da agenda."
    );
  }

  return (data || [])
    .map((horario) => {
      const matricula =
        matriculasAtivasProfessor.get(
          String(horario.matricula_id)
        );

      if (!matricula) {
        return null;
      }

      /*
        Aviso apenas para desenvolvimento.

        Se ainda existir algum horário com professor,
        matéria ou módulo diferente da matrícula, ele
        será informado no console.
      */
      const professorHorario =
        Number(horario.professor_id);

      const professorMatricula =
        Number(matricula.professor_id);

      const materiaHorario =
        Number(horario.materia_id);

      const materiaMatricula =
        Number(matricula.materia_id);

      const moduloHorario =
        Number(horario.modulo_id);

      const moduloMatricula =
        Number(matricula.modulo_id);

      if (
        professorHorario !== professorMatricula ||
        materiaHorario !== materiaMatricula ||
        moduloHorario !== moduloMatricula
      ) {
        console.warn(
          "Horário com informações diferentes da matrícula:",
          {
            horarioId: horario.id,
            matriculaId: matricula.id,
            horario,
            matricula
          }
        );
      }

      /*
        Os dados atuais da matrícula substituem possíveis
        informações antigas salvas no horário.
      */
      return {
        ...horario,

        aluno_id: matricula.aluno_id,
        materia_id: matricula.materia_id,
        modulo_id: matricula.modulo_id,
        professor_id: matricula.professor_id,

        aluno: matricula.aluno,
        materia: matricula.materia,
        modulo: matricula.modulo
      };
    })
    .filter(Boolean);
}

/* =====================================================
   BUSCAR AULAS REGISTRADAS
===================================================== */
async function buscarAulasRegistradasNaData(
  dataISO
) {
  const matriculaIds = [
    ...matriculasAtivasProfessor.keys()
  ]
    .map(Number)
    .filter(Number.isFinite);

  if (!matriculaIds.length) {
    return [];
  }

  const {
    data,
    error
  } = await supabase
    .from("aula")
    .select(`
      id,
      data_aula,
      matricula_id,
      professor_id,
      status,
      parte
    `)
    .in("matricula_id", matriculaIds)
    .eq("professor_id", professorAtualId)
    .eq("data_aula", dataISO);

  if (error) {
    console.error(
      "Erro ao buscar aulas registradas:",
      error
    );

    throw new Error(
      "Erro ao verificar aulas registradas."
    );
  }

  return data || [];
}

/* =====================================================
   STATUS DE REGISTRO
===================================================== */

/*
  Essa função marca "registrada" respeitando casos
  em que o mesmo aluno possui duas aulas no mesmo dia.

  Exemplo:

  19:20 até 20:00
  20:00 até 20:40

  Se existir apenas um registro de aula naquela data,
  apenas o primeiro horário será marcado como registrado.
*/
function aplicarStatusDeRegistro(
  horarios,
  aulasRegistradas
) {
  const horariosOrdenados = [
    ...(horarios || [])
  ].sort((horarioA, horarioB) => {
    const horaA = String(
      horarioA.hora_inicio || ""
    );

    const horaB = String(
      horarioB.hora_inicio || ""
    );

    if (horaA === horaB) {
      return String(
        horarioA.aluno?.nome || ""
      ).localeCompare(
        String(
          horarioB.aluno?.nome || ""
        ),
        "pt-BR"
      );
    }

    return horaA.localeCompare(horaB);
  });

  const aulasPorMatricula = {};

  (aulasRegistradas || []).forEach((aula) => {
    const chave = String(
      aula.matricula_id
    );

    if (!aulasPorMatricula[chave]) {
      aulasPorMatricula[chave] = [];
    }

    aulasPorMatricula[chave].push(aula);
  });

  Object.keys(
    aulasPorMatricula
  ).forEach((chave) => {
    aulasPorMatricula[chave].sort(
      (aulaA, aulaB) => {
        const parteA = Number(
          aulaA.parte || 1
        );

        const parteB = Number(
          aulaB.parte || 1
        );

        return parteA - parteB;
      }
    );
  });

  const contadorUsoPorMatricula = {};

  return horariosOrdenados.map((horario) => {
    const chave = String(
      horario.matricula_id
    );

    const aulasDaMatricula =
      aulasPorMatricula[chave] || [];

    const indiceUso =
      contadorUsoPorMatricula[chave] || 0;

    const aulaCorrespondente =
      aulasDaMatricula[indiceUso];

    let registrada = false;
    let aulaId = null;
    let statusAula = null;

    if (aulaCorrespondente) {
      registrada = true;
      aulaId = aulaCorrespondente.id;
      statusAula =
        aulaCorrespondente.status || null;

      contadorUsoPorMatricula[chave] =
        indiceUso + 1;
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
   CRIAR CARD DE HORÁRIO
===================================================== */
function criarCardHorario(
  item,
  dataISO,
  opcoes = {}
) {
  const {
    mostrarDia = false,
    mostrarStatus = false
  } = opcoes;

  const alunoNome =
    item.aluno?.nome ||
    "Aluno não informado";

  const materiaNome =
    item.materia?.nome ||
    "Curso não informado";

  const moduloNome =
    item.modulo?.nome ||
    "Módulo não informado";

  const horaInicio = formatarHora(
    item.hora_inicio
  );

  const horaFim = formatarHora(
    item.hora_fim
  );

  const linkGoogleAgenda =
    montarLinkGoogleAgenda(
      item,
      dataISO
    );

  const matriculaId =
    item.matricula_id;

  let htmlStatus = "";

  if (mostrarStatus) {
    const statusTexto = item.registrada
      ? "Aula registrada"
      : "Pendente de registro";

    const statusCor = item.registrada
      ? "#1b5e20"
      : "#9a6700";

    const statusFundo = item.registrada
      ? "#e8f5e9"
      : "#fff8e1";

    const statusBorda = item.registrada
      ? "#a5d6a7"
      : "#f1bc32";

    htmlStatus = `
      <span
        style="
          background:${statusFundo};
          border:1px solid ${statusBorda};
          color:${statusCor};
          padding:5px 9px;
          border-radius:999px;
          font-size:12px;
          font-weight:700;
          text-align:center;
        "
      >
        ${escaparHtml(statusTexto)}
      </span>
    `;
  }

  const htmlLinkDetalhes = matriculaId
    ? `
      <a
        href="detalhes-aluno.html"
        class="link-detalhes-aluno"
        data-matricula-id="${escaparHtml(
          matriculaId
        )}"
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

  const card = document.createElement("div");

  card.style.border =
    "1px solid #f1e4a7";

  card.style.background =
    "#fffdf4";

  card.style.borderRadius =
    "12px";

  card.style.padding =
    "12px";

  card.style.marginBottom =
    "10px";

  card.innerHTML = `
    <div
      style="
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:10px;
        flex-wrap:wrap;
      "
    >
      <div
        style="
          min-width:220px;
          flex:1;
        "
      >
        <div
          style="
            display:flex;
            align-items:center;
            gap:8px;
            flex-wrap:wrap;
          "
        >
          <strong
            style="
              font-size:14px;
              color:#3a2c00;
            "
          >
            ${escaparHtml(alunoNome)}
          </strong>

          ${htmlLinkDetalhes}
        </div>

        <p
          style="
            margin:4px 0 0 0;
            font-size:12.5px;
            color:#555;
            line-height:1.4;
          "
        >
          ${escaparHtml(materiaNome)}
          |
          ${escaparHtml(moduloNome)}
        </p>

        <p
          style="
            margin:5px 0 0 0;
            font-size:13px;
            color:#000;
          "
        >
          <strong>
            ${escaparHtml(horaInicio)}
          </strong>

          às

          <strong>
            ${escaparHtml(horaFim)}
          </strong>

          ${
            mostrarDia
              ? `
                ·
                ${escaparHtml(
                  obterNomeDiaPorDataISO(
                    dataISO
                  )
                )}
                ·
                ${escaparHtml(
                  formatarDataBR(dataISO)
                )}
              `
              : ""
          }
        </p>
      </div>

      <div
        style="
          display:flex;
          flex-direction:column;
          gap:7px;
          align-items:flex-end;
        "
      >
        ${htmlStatus}

        <a
          href="${escaparHtml(
            linkGoogleAgenda
          )}"
          target="_blank"
          rel="noopener noreferrer"
          style="
            background:#fff;
            border:1px solid #d8d8d8;
            color:#333;
            padding:6px 9px;
            border-radius:8px;
            font-size:12px;
            font-weight:700;
            text-decoration:none;
            white-space:nowrap;
          "
        >
          + Google Agenda
        </a>
      </div>
    </div>
  `;

  const linkDetalhes = card.querySelector(
    ".link-detalhes-aluno"
  );

  linkDetalhes?.addEventListener(
    "click",
    (evento) => {
      evento.preventDefault();

      const idMatricula =
        linkDetalhes.dataset.matriculaId;

      abrirDetalhesAluno(idMatricula);
    }
  );

  return card;
}

/* =====================================================
   RENDERIZAR HOJE
===================================================== */
function renderizarHoje(
  horariosComStatus,
  dataISO
) {
  if (!listaHoje) {
    return;
  }

  listaHoje.innerHTML = "";

  const nomeDia =
    obterNomeDiaPorDataISO(dataISO);

  if (textoHoje) {
    textoHoje.textContent =
      `${nomeDia}, ${formatarDataBR(dataISO)}`;
  }

  if (contadorHoje) {
    contadorHoje.textContent =
      `${horariosComStatus.length} horário(s)`;
  }

  if (!horariosComStatus.length) {
    listaHoje.innerHTML = `
      <div
        style="
          padding:12px;
          border:1px solid #eee;
          background:#fff;
          border-radius:10px;
          font-size:13px;
          color:#666;
        "
      >
        Nenhum aluno cadastrado para hoje.
      </div>
    `;

    return;
  }

  horariosComStatus.forEach((item) => {
    listaHoje.appendChild(
      criarCardHorario(
        item,
        dataISO,
        {
          mostrarDia: false,
          mostrarStatus: true
        }
      )
    );
  });
}

/* =====================================================
   RENDERIZAR PRÓXIMOS DIAS
===================================================== */
function renderizarProximosDias(
  listaPorDia
) {
  if (!listaProximosDias) {
    return;
  }

  listaProximosDias.innerHTML = "";

  const diasComHorario = (
    listaPorDia || []
  ).filter(
    (dia) =>
      dia.horarios.length > 0
  );

  if (!diasComHorario.length) {
    listaProximosDias.innerHTML = `
      <div
        style="
          padding:12px;
          border:1px solid #eee;
          background:#fff;
          border-radius:10px;
          font-size:13px;
          color:#666;
        "
      >
        Nenhum horário cadastrado para os próximos dias.
      </div>
    `;

    return;
  }

  diasComHorario.forEach((dia) => {
    const bloco =
      document.createElement("div");

    bloco.style.marginBottom =
      "16px";

    bloco.innerHTML = `
      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
          margin-bottom:8px;
        "
      >
        <h3
          style="
            font-size:14px;
            margin:0;
            color:#5f4b00;
          "
        >
          ${escaparHtml(
            obterNomeDiaPorDataISO(
              dia.dataISO
            )
          )}
        </h3>

        <span
          style="
            font-size:12px;
            color:#666;
          "
        >
          ${escaparHtml(
            formatarDataBR(
              dia.dataISO
            )
          )}

          ·

          ${dia.horarios.length}
          horário(s)
        </span>
      </div>
    `;

    dia.horarios.forEach((item) => {
      bloco.appendChild(
        criarCardHorario(
          item,
          dia.dataISO,
          {
            mostrarDia: false,
            mostrarStatus: false
          }
        )
      );
    });

    listaProximosDias.appendChild(
      bloco
    );
  });
}

/* =====================================================
   CARREGAR AGENDA
===================================================== */
async function carregarAgenda() {
  if (listaHoje) {
    listaHoje.innerHTML = `
      <div
        style="
          padding:12px;
          font-size:13px;
          color:#666;
        "
      >
        Carregando agenda de hoje...
      </div>
    `;
  }

  if (listaProximosDias) {
    listaProximosDias.innerHTML = `
      <div
        style="
          padding:12px;
          font-size:13px;
          color:#666;
        "
      >
        Carregando próximos dias...
      </div>
    `;
  }

  /*
    Atualiza primeiro as matrículas.

    Assim, se a administração acabou de mudar
    o professor do aluno, a agenda já utiliza
    a informação nova.
  */
  await carregarMatriculasAtivasProfessor();

  const hojeISO =
    obterDataHojeLocalISO();

  const hoje =
    criarDataLocalPorISO(hojeISO);

  const diaSemanaHoje =
    hoje.getDay();

  const horariosHoje =
    await buscarHorariosPorDia(
      diaSemanaHoje
    );

  const aulasHoje =
    await buscarAulasRegistradasNaData(
      hojeISO
    );

  const horariosHojeComStatus =
    aplicarStatusDeRegistro(
      horariosHoje,
      aulasHoje
    );

  renderizarHoje(
    horariosHojeComStatus,
    hojeISO
  );

  const proximosDias = [];

  /*
    Busca os próximos seis dias.

    Domingo é ignorado porque a agenda fixa
    está configurada de segunda a sábado.
  */
  for (
    let offset = 1;
    offset <= 6;
    offset++
  ) {
    const dataISO =
      obterDataISOComOffset(offset);

    const dataObj =
      criarDataLocalPorISO(dataISO);

    const diaSemana =
      dataObj.getDay();

    if (diaSemana === 0) {
      continue;
    }

    const horarios =
      await buscarHorariosPorDia(
        diaSemana
      );

    proximosDias.push({
      dataISO,
      diaSemana,
      horarios
    });
  }

  renderizarProximosDias(
    proximosDias
  );
}

/* =====================================================
   BOTÃO ATUALIZAR
===================================================== */
if (btnAtualizarAgenda) {
  btnAtualizarAgenda.addEventListener(
    "click",
    async () => {
      try {
        btnAtualizarAgenda.disabled = true;
        btnAtualizarAgenda.textContent =
          "Atualizando...";

        await carregarAgenda();

        mostrarMensagem(
          "Agenda atualizada com sucesso!",
          true
        );
      } catch (erro) {
        console.error(
          "Erro ao atualizar agenda:",
          erro
        );

        mostrarMensagem(
          erro.message ||
            "Erro ao atualizar agenda.",
          false
        );
      } finally {
        btnAtualizarAgenda.disabled = false;
        btnAtualizarAgenda.textContent =
          "Atualizar";
      }
    }
  );
}

/* =====================================================
   INICIALIZAÇÃO
===================================================== */
try {
  professorAtualId =
    await obterProfessorAtualId();

  await carregarAgenda();
} catch (erro) {
  console.error(
    "Erro ao iniciar agenda:",
    erro
  );

  if (contadorHoje) {
    contadorHoje.textContent =
      "0 horário(s)";
  }

  if (listaHoje) {
    listaHoje.innerHTML = `
      <div
        style="
          padding:12px;
          border:1px solid #ef9a9a;
          background:#ffebee;
          border-radius:10px;
          font-size:13px;
          color:#b71c1c;
        "
      >
        ${escaparHtml(
          erro.message ||
            "Erro ao carregar a agenda."
        )}
      </div>
    `;
  }

  if (listaProximosDias) {
    listaProximosDias.innerHTML = "";
  }
}