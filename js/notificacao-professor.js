import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

const btnSair = document.getElementById("btnSair");
const saudacaoProfessor = document.getElementById("saudacaoProfessor");

const badgeNotificacoesProfessor = document.getElementById(
  "badgeNotificacoesProfessor"
);

const textoNotificacoesProfessor = document.getElementById(
  "textoNotificacoesProfessor"
);

const listaNotificacoesProfessor = document.getElementById(
  "listaNotificacoesProfessor"
);

const btnAtualizarNotificacoesProfessor = document.getElementById(
  "btnAtualizarNotificacoesProfessor"
);

const btnMarcarTodasVistas = document.getElementById(
  "btnMarcarTodasVistas"
);

const btnAtivarPushProfessorAtalho = document.getElementById(
  "btnAtivarPushProfessorAtalho"
);

const professorId = Number(
  localStorage.getItem("professorId")
);

if (!professorId) {
  window.location.href = "index.html";
}

const STATUS = {
  REPOSICAO: "Reposição",
  AULA_INSTRUMENTAL: "Aula Instrumental",
  PLANTAO_DUVIDAS: "Plantão de dúvidas",
  AVALIACAO_REALIZADA: "Avaliação realizada"
};

/*
  Esta chave precisa ser igual à usada na home-professor.js.
*/
const CHAVE_VISTOS =
  `beehive_notificacoes_professor_vistas_${professorId}`;

const FUSO_HORARIO = "America/Sao_Paulo";

let notificacoesAtuais = [];

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

/*
  Retorna o ano, mês e dia considerando sempre
  o horário de São Paulo.
*/
function obterPartesDataNoFuso(data = new Date()) {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_HORARIO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(data);

  const valores = {};

  partes.forEach((parte) => {
    if (parte.type !== "literal") {
      valores[parte.type] = parte.value;
    }
  });

  return {
    ano: valores.year,
    mes: valores.month,
    dia: valores.day
  };
}

/*
  Retorna a data de hoje no formato AAAA-MM-DD,
  sempre considerando o horário de São Paulo.
*/
function hojeISO() {
  const { ano, mes, dia } = obterPartesDataNoFuso();

  return `${ano}-${mes}-${dia}`;
}

/*
  Retorna uma data anterior no formato AAAA-MM-DD.
*/
function dataMenosDiasISO(dias) {
  const [ano, mes, dia] = hojeISO()
    .split("-")
    .map(Number);

  /*
    Utilizamos o meio-dia em UTC apenas para realizar
    a conta de dias sem correr o risco de a data mudar
    por causa do fuso horário.
  */
  const data = new Date(
    Date.UTC(
      ano,
      mes - 1,
      dia,
      12,
      0,
      0
    )
  );

  data.setUTCDate(
    data.getUTCDate() - Number(dias || 0)
  );

  const anoFinal = data.getUTCFullYear();

  const mesFinal = String(
    data.getUTCMonth() + 1
  ).padStart(2, "0");

  const diaFinal = String(
    data.getUTCDate()
  ).padStart(2, "0");

  return `${anoFinal}-${mesFinal}-${diaFinal}`;
}

/*
  Formata datas para o padrão brasileiro.

  Importante:
  uma data simples como "2026-07-15" não deve ser
  enviada diretamente para new Date(), porque o
  JavaScript pode interpretar como meia-noite em UTC.

  No horário de São Paulo, essa data poderia virar
  21h do dia anterior.
*/
function formatarDataBR(valor) {
  if (!valor) return "";

  const texto = String(valor).trim();

  /*
    Data simples, sem horário.
    Exemplo: 2026-07-15
  */
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [ano, mes, dia] = texto.split("-");

    return `${dia}/${mes}/${ano}`;
  }

  /*
    Data com horário.
    Exemplo:
    2026-07-09T19:32:19.362996+00:00
  */
  const data = new Date(texto);

  if (Number.isNaN(data.getTime())) {
    return texto;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_HORARIO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(data);
}

function formatarHora(hora) {
  if (!hora) return "";

  return String(hora).slice(0, 5);
}

/*
  Monta a data usada pelo Google Agenda.
*/
function formatarDataGoogle(dataISO, hora) {
  const [ano, mes, dia] = String(dataISO)
    .slice(0, 10)
    .split("-");

  const partesHora = String(
    hora || "00:00:00"
  ).split(":");

  const hh = partesHora[0] || "00";
  const mm = partesHora[1] || "00";
  const ss = partesHora[2] || "00";

  return `${ano}${mes}${dia}T${hh}${mm}${ss}`;
}

function criarLinkGoogleAgenda(item) {
  const titulo =
    `${item.tipo_agendamento || "Agendamento"} - Beehive`;

  const inicio = formatarDataGoogle(
    item.data_reposicao,
    item.hora_inicio_reposicao
  );

  const fim = formatarDataGoogle(
    item.data_reposicao,
    item.hora_fim_reposicao
  );

  const detalhes = [
    `${
      item.aluno_nome || "Um aluno"
    } agendou ${
      (
        item.tipo_agendamento ||
        "um horário"
      ).toLowerCase()
    } na Beehive.`,

    item.aula_original_data
      ? `Aula original: ${
          formatarDataBR(item.aula_original_data)
        } — ${
          item.aula_original_status ||
          "status não informado"
        }.`
      : "",

    item.observacao_aluno
      ? `Observação do aluno: ${item.observacao_aluno}`
      : "",

    item.tem_custo
      ? `Atenção: este agendamento possui custo. ${
          item.motivo_custo || ""
        }`
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
    ctz: FUSO_HORARIO
  });

  return (
    "https://calendar.google.com/calendar/render?" +
    params.toString()
  );
}

/* ======================
   Visto local

   Importante:
   "Visto" NÃO remove o card.
   Só tira o badge vermelho.
====================== */
function carregarIdsVistos() {
  try {
    const salvo = JSON.parse(
      localStorage.getItem(CHAVE_VISTOS) || "[]"
    );

    return new Set(
      (salvo || []).map((id) => String(id))
    );
  } catch (error) {
    console.warn(
      "Não foi possível ler notificações vistas:",
      error
    );

    return new Set();
  }
}

function salvarIdsVistos(ids) {
  localStorage.setItem(
    CHAVE_VISTOS,
    JSON.stringify(
      [...ids].map(String)
    )
  );
}

function estaVisto(notificacaoId) {
  return carregarIdsVistos().has(
    String(notificacaoId)
  );
}

function marcarVistoLocal(notificacaoId) {
  const ids = carregarIdsVistos();

  ids.add(
    String(notificacaoId)
  );

  salvarIdsVistos(ids);
}

function marcarTodosVistosLocal(notificacoes) {
  const ids = carregarIdsVistos();

  notificacoes.forEach((item) => {
    if (item.notificacao_id) {
      ids.add(
        String(item.notificacao_id)
      );
    }
  });

  salvarIdsVistos(ids);
}

/* ======================
   Textos de agendamento
====================== */
function montarTextoAgendamento(item) {
  const tipo =
    item.tipo_agendamento ||
    STATUS.REPOSICAO;

  const aluno =
    item.aluno_nome ||
    "Um aluno";

  const data = formatarDataBR(
    item.data_reposicao
  );

  const horaInicio = formatarHora(
    item.hora_inicio_reposicao
  );

  const horaFim = formatarHora(
    item.hora_fim_reposicao
  );

  const horario = horaFim
    ? `${horaInicio} às ${horaFim}`
    : horaInicio;

  if (tipo === STATUS.PLANTAO_DUVIDAS) {
    return (
      `${aluno} agendou um plantão de dúvidas ` +
      `para ${data}, das ${horario}.`
    );
  }

  if (tipo === STATUS.AULA_INSTRUMENTAL) {
    return (
      `${aluno} agendou uma aula instrumental ` +
      `para ${data}, das ${horario}.`
    );
  }

  return (
    `${aluno} agendou uma reposição ` +
    `para ${data}, das ${horario}.`
  );
}

function montarStatusAulaOriginal(item) {
  if (!item.aula_original_id) return "";

  const dataOriginal = item.aula_original_data
    ? formatarDataBR(
        item.aula_original_data
      )
    : "data não informada";

  const statusOriginal =
    item.aula_original_status ||
    "status não informado";

  let regra = "";

  if (
    String(statusOriginal).toLowerCase() ===
    "cancelada"
  ) {
    regra =
      "Reposição sem custo, responsabilidade da escola.";
  } else if (
    String(statusOriginal).toLowerCase() ===
    "trancada"
  ) {
    regra =
      "Reposição sem custo.";
  } else if (
    String(statusOriginal).toLowerCase() ===
    "ausente"
  ) {
    regra = item.tem_custo
      ? "Ausência sem gravação com cobrança de R$ 25,00 por estar em outro mês."
      : "Ausência sem gravação, sem custo por estar no mesmo mês.";
  }

  return `
    <div
      style="
        margin-top:10px;
        padding:10px 12px;
        border-radius:10px;
        background:#fff8dc;
        border:1px solid #f1bc32;
        color:#5f4700;
      "
    >
      <strong>Aula original:</strong>
      ${escaparHTML(statusOriginal)}
      em
      ${escaparHTML(dataOriginal)}.
      <br>

      ${
        regra
          ? escaparHTML(regra)
          : ""
      }

      ${
        item.aula_original_justificativa
          ? `
            <br>
            <strong>Justificativa:</strong>
            ${escaparHTML(
              item.aula_original_justificativa
            )}
          `
          : ""
      }
    </div>
  `;
}

/* ======================
   Textos de avaliação
====================== */
function tituloAvaliacao(item) {
  if (item.avaliacao_titulo) {
    return item.avaliacao_titulo;
  }

  if (item.numero_avaliacao) {
    return (
      `Progress Check ${item.numero_avaliacao}`
    );
  }

  return "Avaliação";
}

function montarTextoAvaliacao(item) {
  const aluno =
    item.aluno_nome ||
    "Um aluno";

  const titulo = tituloAvaliacao(item);

  return (
    `${aluno} informou que realizou ` +
    `a avaliação ${titulo}.`
  );
}

function montarMateriaModuloAvaliacao(item) {
  const materia =
    item.materia_nome ||
    "Matéria não informada";

  const modulo =
    item.modulo_nome ||
    "Módulo não informado";

  return `${materia} • ${modulo}`;
}

/* ======================
   Badge
====================== */
function atualizarBadge(total) {
  if (!badgeNotificacoesProfessor) return;

  if (total > 0) {
    badgeNotificacoesProfessor.textContent =
      total > 99
        ? "99+"
        : String(total);

    badgeNotificacoesProfessor.style.display =
      "inline-flex";
  } else {
    badgeNotificacoesProfessor.textContent =
      "0";

    badgeNotificacoesProfessor.style.display =
      "none";
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
    console.error(
      "Erro ao carregar professor:",
      error
    );

    if (saudacaoProfessor) {
      saudacaoProfessor.textContent =
        "Olá!";
    }

    return;
  }

  if (saudacaoProfessor) {
    saudacaoProfessor.textContent =
      `Olá, ${data.nome}!`;
  }
}

/* ======================
   Estados visuais
====================== */
function renderizarEstadoVazio() {
  if (
    !listaNotificacoesProfessor ||
    !textoNotificacoesProfessor
  ) {
    return;
  }

  textoNotificacoesProfessor.textContent =
    "Nenhuma notificação pendente no momento.";

  atualizarBadge(0);

  listaNotificacoesProfessor.innerHTML = `
    <article
      class="
        card-admin
        card-professor
        notificacao-professor-card
      "
    >
      <div class="card-admin-icone">
        ✅
      </div>

      <div class="card-admin-conteudo">
        <h2>Tudo certo por aqui</h2>

        <p>
          Quando um aluno agendar uma reposição,
          plantão de dúvidas, aula instrumental
          ou informar que realizou uma avaliação,
          o aviso aparecerá nesta tela.
        </p>
      </div>
    </article>
  `;
}

function renderizarErro(
  mensagem =
    "Não foi possível carregar as notificações."
) {
  if (
    !listaNotificacoesProfessor ||
    !textoNotificacoesProfessor
  ) {
    return;
  }

  textoNotificacoesProfessor.textContent =
    mensagem;

  atualizarBadge(0);

  listaNotificacoesProfessor.innerHTML = `
    <article
      class="
        card-admin
        card-professor
        notificacao-professor-card
      "
    >
      <div class="card-admin-icone">
        ⚠️
      </div>

      <div class="card-admin-conteudo">
        <h2>Erro ao carregar</h2>

        <p>
          Tente atualizar a página.
          Se o erro continuar,
          avise a administração.
        </p>
      </div>
    </article>
  `;
}

/* ======================
   Consultas de agendamentos
====================== */
async function buscarHorariosDoProfessor() {
  const dataInicial =
    dataMenosDiasISO(120);

  const { data, error } = await supabase
    .from("horarios_reposicao")
    .select(`
      id,
      data,
      hora_inicio,
      hora_fim,
      professor_id,
      materia_id
    `)
    .eq("professor_id", professorId)
    .gte("data", dataInicial)
    .order("data", {
      ascending: true
    })
    .order("hora_inicio", {
      ascending: true
    });

  if (error) {
    console.error(
      "Erro ao buscar horários do professor:",
      error
    );

    throw error;
  }

  return data || [];
}

async function buscarAgendamentosDosHorarios(
  horariosIds
) {
  if (!horariosIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("reposicao_agendada")
    .select(`
      id,
      aula_id,
      horario_reposicao_id,
      aluno_id,
      matricula_id,
      cancelado,
      tipo_agendamento,
      observacao_aluno,
      tem_custo,
      motivo_custo,
      status_agendamento
    `)
    .in(
      "horario_reposicao_id",
      horariosIds
    )
    .eq(
      "cancelado",
      false
    );

  if (error) {
    console.error(
      "Erro ao buscar agendamentos:",
      error
    );

    throw error;
  }

  return data || [];
}

async function buscarAlunosPorIds(
  alunosIds
) {
  if (!alunosIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("aluno")
    .select("id, nome")
    .in(
      "id",
      alunosIds
    );

  if (error) {
    console.error(
      "Erro ao buscar alunos:",
      error
    );

    return new Map();
  }

  return new Map(
    (data || []).map((aluno) => [
      Number(aluno.id),
      aluno
    ])
  );
}

async function buscarAulasOriginaisPorIds(
  aulasIds
) {
  if (!aulasIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("aula")
    .select(`
      id,
      data_aula,
      status,
      justificativa,
      aula_gravada,
      precisa_reposicao
    `)
    .in(
      "id",
      aulasIds
    );

  if (error) {
    console.error(
      "Erro ao buscar aulas originais:",
      error
    );

    return new Map();
  }

  return new Map(
    (data || []).map((aula) => [
      Number(aula.id),
      aula
    ])
  );
}

async function buscarReposicoesRegistradasPorAulaOriginal(
  aulasOriginaisIds
) {
  if (!aulasOriginaisIds.length) {
    return new Set();
  }

  const { data, error } = await supabase
    .from("aula")
    .select("aula_original_id")
    .eq(
      "professor_id",
      professorId
    )
    .eq(
      "status",
      STATUS.REPOSICAO
    )
    .not(
      "aula_original_id",
      "is",
      null
    )
    .in(
      "aula_original_id",
      aulasOriginaisIds
    );

  if (error) {
    console.error(
      "Erro ao buscar reposições já registradas pela aula original:",
      error
    );

    return new Set();
  }

  return new Set(
    (data || []).map((item) =>
      Number(item.aula_original_id)
    )
  );
}

async function buscarAulasRegistradasPorData(
  agendamentosComHorario
) {
  const matriculasIds = [
    ...new Set(
      agendamentosComHorario
        .map((item) =>
          Number(item.matricula_id)
        )
        .filter(Boolean)
    )
  ];

  const datas = [
    ...new Set(
      agendamentosComHorario
        .map((item) =>
          item.data_reposicao
        )
        .filter(Boolean)
    )
  ];

  if (
    !matriculasIds.length ||
    !datas.length
  ) {
    return new Set();
  }

  const { data, error } = await supabase
    .from("aula")
    .select(`
      matricula_id,
      data_aula,
      status
    `)
    .eq(
      "professor_id",
      professorId
    )
    .in(
      "matricula_id",
      matriculasIds
    )
    .in(
      "data_aula",
      datas
    )
    .in(
      "status",
      [
        STATUS.REPOSICAO,
        STATUS.AULA_INSTRUMENTAL,
        STATUS.PLANTAO_DUVIDAS
      ]
    );

  if (error) {
    console.error(
      "Erro ao buscar aulas já registradas pela data:",
      error
    );

    return new Set();
  }

  const chaves = new Set();

  (data || []).forEach((aula) => {
    chaves.add(
      `${
        Number(aula.matricula_id)
      }|${
        aula.data_aula
      }|${
        aula.status
      }`
    );
  });

  return chaves;
}

async function buscarAgendamentosAtivosProfessor() {
  const horarios =
    await buscarHorariosDoProfessor();

  if (!horarios.length) {
    return [];
  }

  const mapaHorarios = new Map(
    horarios.map((horario) => [
      Number(horario.id),
      horario
    ])
  );

  const horariosIds = horarios.map(
    (horario) =>
      Number(horario.id)
  );

  const agendamentos =
    await buscarAgendamentosDosHorarios(
      horariosIds
    );

  if (!agendamentos.length) {
    return [];
  }

  const alunosIds = [
    ...new Set(
      agendamentos
        .map((item) =>
          Number(item.aluno_id)
        )
        .filter(Boolean)
    )
  ];

  const aulasOriginaisIds = [
    ...new Set(
      agendamentos
        .map((item) =>
          Number(item.aula_id)
        )
        .filter(Boolean)
    )
  ];

  const mapaAlunos =
    await buscarAlunosPorIds(
      alunosIds
    );

  const mapaAulasOriginais =
    await buscarAulasOriginaisPorIds(
      aulasOriginaisIds
    );

  const listaComHorario = agendamentos
    .map((item) => {
      const horario = mapaHorarios.get(
        Number(item.horario_reposicao_id)
      );

      const aluno = mapaAlunos.get(
        Number(item.aluno_id)
      );

      const aulaOriginal = item.aula_id
        ? mapaAulasOriginais.get(
            Number(item.aula_id)
          )
        : null;

      return {
        tipo_notificacao:
          "agendamento",

        notificacao_id:
          `agendamento_${item.id}`,

        reposicao_id:
          item.id,

        aula_original_id:
          item.aula_id || null,

        matricula_id:
          item.matricula_id || null,

        aluno_id:
          item.aluno_id || null,

        aluno_nome:
          aluno?.nome ||
          "Aluno não informado",

        tipo_agendamento:
          item.tipo_agendamento ||
          STATUS.REPOSICAO,

        observacao_aluno:
          item.observacao_aluno ||
          null,

        tem_custo:
          Boolean(item.tem_custo),

        motivo_custo:
          item.motivo_custo ||
          null,

        status_agendamento:
          item.status_agendamento ||
          "Agendado",

        data_reposicao:
          horario?.data ||
          null,

        hora_inicio_reposicao:
          horario?.hora_inicio ||
          null,

        hora_fim_reposicao:
          horario?.hora_fim ||
          null,

        materia_id:
          horario?.materia_id ||
          null,

        aula_original_data:
          aulaOriginal?.data_aula ||
          null,

        aula_original_status:
          aulaOriginal?.status ||
          null,

        aula_original_justificativa:
          aulaOriginal?.justificativa ||
          null,

        ordenacao:
          `${
            horario?.data ||
            "9999-99-99"
          } ${
            horario?.hora_inicio ||
            "00:00"
          }`
      };
    })
    .filter(
      (item) =>
        item.data_reposicao
    );

  const aulasOriginaisJaRepostas =
    await buscarReposicoesRegistradasPorAulaOriginal(
      aulasOriginaisIds
    );

  const aulasJaRegistradasPorData =
    await buscarAulasRegistradasPorData(
      listaComHorario
    );

  const hoje = hojeISO();

  return listaComHorario.filter((item) => {
    const tipo =
      item.tipo_agendamento ||
      STATUS.REPOSICAO;

    const chavePorData =
      `${
        Number(item.matricula_id)
      }|${
        item.data_reposicao
      }|${
        tipo
      }`;

    const jaRegistrouPorData =
      aulasJaRegistradasPorData.has(
        chavePorData
      );

    if (jaRegistrouPorData) {
      return false;
    }

    if (tipo === STATUS.REPOSICAO) {
      const jaRegistrouPelaAulaOriginal =
        item.aula_original_id &&
        aulasOriginaisJaRepostas.has(
          Number(item.aula_original_id)
        );

      if (jaRegistrouPelaAulaOriginal) {
        return false;
      }

      return true;
    }

    if (
      tipo === STATUS.AULA_INSTRUMENTAL ||
      tipo === STATUS.PLANTAO_DUVIDAS
    ) {
      return true;
    }

    return (
      item.data_reposicao >= hoje
    );
  });
}

/* ======================
   Consultas de avaliações
====================== */
async function buscarMatriculasDoProfessor() {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno_id,
      professor_id,
      materia_id,
      modulo_id
    `)
    .eq(
      "professor_id",
      professorId
    )
    .eq(
      "ativa",
      true
    );

  if (error) {
    console.error(
      "Erro ao buscar matrículas do professor:",
      error
    );

    return [];
  }

  return data || [];
}

async function buscarMateriasPorIds(
  materiasIds
) {
  if (!materiasIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("materia")
    .select("id, nome")
    .in(
      "id",
      materiasIds
    );

  if (error) {
    console.error(
      "Erro ao buscar matérias:",
      error
    );

    return new Map();
  }

  return new Map(
    (data || []).map((materia) => [
      Number(materia.id),
      materia
    ])
  );
}

async function buscarModulosPorIds(
  modulosIds
) {
  if (!modulosIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("modulo")
    .select("id, nome")
    .in(
      "id",
      modulosIds
    );

  if (error) {
    console.error(
      "Erro ao buscar módulos:",
      error
    );

    return new Map();
  }

  return new Map(
    (data || []).map((modulo) => [
      Number(modulo.id),
      modulo
    ])
  );
}

async function buscarFormulariosPorIds(
  formulariosIds
) {
  if (!formulariosIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("avaliacao_formulario")
    .select(`
      id,
      titulo,
      link_formulario
    `)
    .in(
      "id",
      formulariosIds
    );

  if (error) {
    console.error(
      "Erro ao buscar formulários de avaliação:",
      error
    );

    return new Map();
  }

  return new Map(
    (data || []).map((formulario) => [
      Number(formulario.id),
      formulario
    ])
  );
}

async function buscarAvaliacoesRealizadasProfessor() {
  const matriculas =
    await buscarMatriculasDoProfessor();

  if (!matriculas.length) {
    return [];
  }

  const matriculasIds = matriculas.map(
    (matricula) =>
      Number(matricula.id)
  );

  const mapaMatriculas = new Map(
    matriculas.map((matricula) => [
      Number(matricula.id),
      matricula
    ])
  );

  const {
    data: avaliacoes,
    error
  } = await supabase
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
      concluida_em,
      aluno_confirmou_realizacao_em,
      observacao
    `)
    .in(
      "matricula_id",
      matriculasIds
    )
    .eq(
      "status",
      "Realizada pelo aluno"
    )
    .order(
      "aluno_confirmou_realizacao_em",
      {
        ascending: false
      }
    );

  if (error) {
    console.error(
      "Erro ao buscar avaliações realizadas:",
      error
    );

    return [];
  }

  const listaAvaliacoes =
    avaliacoes || [];

  if (!listaAvaliacoes.length) {
    return [];
  }

  const alunosIds = [
    ...new Set(
      listaAvaliacoes
        .map((avaliacao) =>
          Number(avaliacao.aluno_id)
        )
        .filter(Boolean)
    )
  ];

  const materiasIds = [
    ...new Set(
      listaAvaliacoes
        .map((avaliacao) =>
          Number(avaliacao.materia_id)
        )
        .filter(Boolean)
    )
  ];

  const modulosIds = [
    ...new Set(
      listaAvaliacoes
        .map((avaliacao) =>
          Number(avaliacao.modulo_id)
        )
        .filter(Boolean)
    )
  ];

  const formulariosIds = [
    ...new Set(
      listaAvaliacoes
        .map((avaliacao) =>
          Number(
            avaliacao.avaliacao_formulario_id
          )
        )
        .filter(Boolean)
    )
  ];

  const mapaAlunos =
    await buscarAlunosPorIds(
      alunosIds
    );

  const mapaMaterias =
    await buscarMateriasPorIds(
      materiasIds
    );

  const mapaModulos =
    await buscarModulosPorIds(
      modulosIds
    );

  const mapaFormularios =
    await buscarFormulariosPorIds(
      formulariosIds
    );

  return listaAvaliacoes.map(
    (avaliacao) => {
      const matricula = mapaMatriculas.get(
        Number(avaliacao.matricula_id)
      );

      const aluno = mapaAlunos.get(
        Number(avaliacao.aluno_id)
      );

      const materia = mapaMaterias.get(
        Number(
          avaliacao.materia_id ||
          matricula?.materia_id
        )
      );

      const modulo = mapaModulos.get(
        Number(
          avaliacao.modulo_id ||
          matricula?.modulo_id
        )
      );

      const formulario =
        mapaFormularios.get(
          Number(
            avaliacao.avaliacao_formulario_id
          )
        );

      return {
        tipo_notificacao:
          "avaliacao",

        notificacao_id:
          `avaliacao_${avaliacao.id}`,

        avaliacao_id:
          avaliacao.id,

        aluno_id:
          avaliacao.aluno_id ||
          null,

        aluno_nome:
          aluno?.nome ||
          "Aluno não informado",

        matricula_id:
          avaliacao.matricula_id ||
          null,

        materia_nome:
          materia?.nome ||
          "Matéria não informada",

        modulo_nome:
          modulo?.nome ||
          "Módulo não informado",

        avaliacao_titulo:
          formulario?.titulo ||
          null,

        link_formulario:
          formulario?.link_formulario ||
          null,

        numero_avaliacao:
          avaliacao.numero_avaliacao ||
          null,

        enviado_em:
          avaliacao.enviado_em ||
          null,

        aluno_confirmou_realizacao_em:
          avaliacao.aluno_confirmou_realizacao_em ||
          null,

        observacao:
          avaliacao.observacao ||
          null,

        tipo_agendamento:
          STATUS.AVALIACAO_REALIZADA,

        ordenacao:
          avaliacao.aluno_confirmou_realizacao_em ||
          avaliacao.enviado_em ||
          "0000-00-00"
      };
    }
  );
}

/* ======================
   Buscar tudo
====================== */
async function buscarTodasNotificacoesProfessor() {
  const [
    agendamentos,
    avaliacoes
  ] = await Promise.all([
    buscarAgendamentosAtivosProfessor(),
    buscarAvaliacoesRealizadasProfessor()
  ]);

  return [
    ...agendamentos,
    ...avaliacoes
  ].sort((a, b) => {
    const dataA = String(
      a.ordenacao || ""
    );

    const dataB = String(
      b.ordenacao || ""
    );

    return dataB.localeCompare(dataA);
  });
}

/* ======================
   Renderização
====================== */
function renderizarCardAgendamento(item) {
  const card =
    document.createElement("article");

  card.className =
    "card-admin card-professor notificacao-professor-card";

  const visto = estaVisto(
    item.notificacao_id
  );

  const mensagem =
    montarTextoAgendamento(item);

  const linkAgenda =
    criarLinkGoogleAgenda(item);

  const estaAtrasado =
    item.data_reposicao < hojeISO();

  const observacaoHTML =
    item.observacao_aluno
      ? `
        <p>
          <strong>Observação do aluno:</strong>
          ${escaparHTML(item.observacao_aluno)}
        </p>
      `
      : "";

  const custoHTML =
    item.tem_custo
      ? `
        <p style="color:#8a5a00;">
          <strong>Atenção:</strong>
          este agendamento possui custo.

          ${
            item.motivo_custo
              ? `
                <br>
                ${escaparHTML(
                  item.motivo_custo
                )}
              `
              : ""
          }
        </p>
      `
      : "";

  const statusVisualHTML = visto
    ? `
      <span
        style="
          display:inline-flex;
          padding:4px 9px;
          border-radius:999px;
          background:#e8f5e9;
          color:#1b5e20;
          font-size:12px;
          font-weight:bold;
        "
      >
        Visto
      </span>
    `
    : `
      <span
        style="
          display:inline-flex;
          padding:4px 9px;
          border-radius:999px;
          background:#c62828;
          color:white;
          font-size:12px;
          font-weight:bold;
        "
      >
        Novo
      </span>
    `;

  const atrasoHTML = estaAtrasado
    ? `
      <p
        style="
          color:#b71c1c;
          font-weight:bold;
        "
      >
        ⚠️ A data deste agendamento já passou,
        mas ele ainda aparece porque não foi
        encontrado registro de conclusão.
      </p>
    `
    : "";

  card.innerHTML = `
    <div class="card-admin-icone">
      ${visto ? "🗓️" : "📌"}
    </div>

    <div class="card-admin-conteudo">

      <div
        style="
          display:flex;
          align-items:center;
          gap:8px;
          flex-wrap:wrap;
          margin-bottom:4px;
        "
      >
        <h2 style="margin:0;">
          ${escaparHTML(
            item.tipo_agendamento ||
            "Agendamento"
          )}
        </h2>

        ${statusVisualHTML}
      </div>

      <p>
        <strong>
          ${escaparHTML(mensagem)}
        </strong>
      </p>

      ${atrasoHTML}

      ${montarStatusAulaOriginal(item)}

      ${observacaoHTML}

      ${custoHTML}

      <div
        style="
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          margin-top:12px;
        "
      >
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
          data-notificacao-id="${
            escaparHTML(item.notificacao_id)
          }"
          ${visto ? "disabled" : ""}
        >
          ${
            visto
              ? "Já visto"
              : "Marcar como visto"
          }
        </button>
      </div>
    </div>
  `;

  return card;
}

function renderizarCardAvaliacao(item) {
  const card =
    document.createElement("article");

  card.className =
    "card-admin card-professor notificacao-professor-card";

  const visto = estaVisto(
    item.notificacao_id
  );

  const mensagem =
    montarTextoAvaliacao(item);

  const statusVisualHTML = visto
    ? `
      <span
        style="
          display:inline-flex;
          padding:4px 9px;
          border-radius:999px;
          background:#e8f5e9;
          color:#1b5e20;
          font-size:12px;
          font-weight:bold;
        "
      >
        Visto
      </span>
    `
    : `
      <span
        style="
          display:inline-flex;
          padding:4px 9px;
          border-radius:999px;
          background:#c62828;
          color:white;
          font-size:12px;
          font-weight:bold;
        "
      >
        Novo
      </span>
    `;

  const dataConfirmacao =
    item.aluno_confirmou_realizacao_em
      ? formatarDataBR(
          item.aluno_confirmou_realizacao_em
        )
      : "Data não informada";

  const linkFormularioHTML =
    item.link_formulario
      ? `
        <a
          href="${
            escaparHTML(item.link_formulario)
          }"
          target="_blank"
          rel="noopener noreferrer"
          class="btn-secundario"
          style="text-decoration:none;"
        >
          Abrir formulário
        </a>
      `
      : "";

  card.innerHTML = `
    <div class="card-admin-icone">
      ${visto ? "✅" : "📝"}
    </div>

    <div class="card-admin-conteudo">

      <div
        style="
          display:flex;
          align-items:center;
          gap:8px;
          flex-wrap:wrap;
          margin-bottom:4px;
        "
      >
        <h2 style="margin:0;">
          Avaliação realizada
        </h2>

        ${statusVisualHTML}
      </div>

      <p>
        <strong>
          ${escaparHTML(mensagem)}
        </strong>
      </p>

      <p>
        <strong>Curso:</strong>

        ${escaparHTML(
          montarMateriaModuloAvaliacao(item)
        )}
      </p>

      <p>
        <strong>
          Informada como realizada em:
        </strong>

        ${escaparHTML(dataConfirmacao)}
      </p>

      <p
        style="
          font-size:14px;
          opacity:0.9;
        "
      >
        Esta notificação continuará aparecendo
        enquanto a avaliação estiver com status
        <strong>Realizada pelo aluno</strong>.

        Depois que a nota for lançada ou concluída,
        ela deverá sair da lista.
      </p>

      <div
        style="
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          margin-top:12px;
        "
      >
        ${linkFormularioHTML}

        <button
          type="button"
          class="btn-principal btn-marcar-visto"
          data-notificacao-id="${
            escaparHTML(item.notificacao_id)
          }"
          ${visto ? "disabled" : ""}
        >
          ${
            visto
              ? "Já visto"
              : "Marcar como visto"
          }
        </button>
      </div>
    </div>
  `;

  return card;
}

function renderizarNotificacoes(
  notificacoes
) {
  if (
    !textoNotificacoesProfessor ||
    !listaNotificacoesProfessor
  ) {
    return;
  }

  notificacoesAtuais =
    notificacoes || [];

  listaNotificacoesProfessor.innerHTML =
    "";

  if (!notificacoesAtuais.length) {
    renderizarEstadoVazio();
    return;
  }

  const totalNovas =
    notificacoesAtuais.filter(
      (item) =>
        !estaVisto(item.notificacao_id)
    ).length;

  atualizarBadge(totalNovas);

  const total =
    notificacoesAtuais.length;

  if (totalNovas > 0) {
    textoNotificacoesProfessor.textContent =
      totalNovas === 1
        ? `Você tem 1 nova notificação e ${total} notificação(ões) ativa(s) no total.`
        : `Você tem ${totalNovas} novas notificações e ${total} notificação(ões) ativa(s) no total.`;
  } else {
    textoNotificacoesProfessor.textContent =
      total === 1
        ? "Você tem 1 notificação ativa já vista."
        : `Você tem ${total} notificações ativas já vistas.`;
  }

  notificacoesAtuais.forEach((item) => {
    const card =
      item.tipo_notificacao === "avaliacao"
        ? renderizarCardAvaliacao(item)
        : renderizarCardAgendamento(item);

    listaNotificacoesProfessor.appendChild(
      card
    );
  });

  document
    .querySelectorAll(".btn-marcar-visto")
    .forEach((botao) => {
      botao.addEventListener(
        "click",
        async () => {
          const notificacaoId =
            botao.dataset.notificacaoId;

          if (!notificacaoId) {
            return;
          }

          await marcarComoVista(
            notificacaoId
          );
        }
      );
    });
}

/* ======================
   Carregar notificações
====================== */
async function carregarNotificacoes() {
  if (
    !textoNotificacoesProfessor ||
    !listaNotificacoesProfessor
  ) {
    return;
  }

  textoNotificacoesProfessor.textContent =
    "Carregando notificações...";

  listaNotificacoesProfessor.innerHTML = `
    <article
      class="
        card-admin
        card-professor
        notificacao-professor-card
      "
    >
      <div class="card-admin-icone">
        ⏳
      </div>

      <div class="card-admin-conteudo">
        <h2>Carregando...</h2>

        <p>
          Aguarde enquanto buscamos suas notificações.
        </p>
      </div>
    </article>
  `;

  atualizarBadge(0);

  try {
    const notificacoes =
      await buscarTodasNotificacoesProfessor();

    renderizarNotificacoes(
      notificacoes
    );
  } catch (error) {
    console.error(
      "Erro ao carregar notificações:",
      error
    );

    renderizarErro(
      "Não foi possível carregar as notificações."
    );
  }
}

/* ======================
   Marcar como visto
====================== */
async function marcarComoVista(
  notificacaoId
) {
  marcarVistoLocal(
    notificacaoId
  );

  renderizarNotificacoes(
    notificacoesAtuais
  );
}

async function marcarTodasComoVistas() {
  if (!notificacoesAtuais.length) {
    alert(
      "Não há notificações para marcar como vistas."
    );

    return;
  }

  const confirmar = confirm(
    "Deseja marcar todas como vistas? Elas continuarão aparecendo até serem registradas/concluídas."
  );

  if (!confirmar) {
    return;
  }

  marcarTodosVistosLocal(
    notificacoesAtuais
  );

  renderizarNotificacoes(
    notificacoesAtuais
  );
}

/* ======================
   Ativar push pelo botão
====================== */
btnAtivarPushProfessorAtalho?.addEventListener(
  "click",
  () => {
    if (!("Notification" in window)) {
      alert(
        "Este navegador não suporta notificações."
      );

      return;
    }

    if (
      Notification.permission ===
      "granted"
    ) {
      alert(
        "As notificações push já estão ativadas neste navegador."
      );

      return;
    }

    if (
      Notification.permission ===
      "denied"
    ) {
      alert(
        "As notificações estão bloqueadas. Para ativar, libere nas configurações do site no navegador."
      );

      return;
    }

    const botaoPush =
      document.getElementById(
        "btnAtivarPushProfessor"
      );

    if (botaoPush) {
      botaoPush.click();
      return;
    }

    alert(
      "Recarregue a página e tente ativar novamente."
    );
  }
);

/* ======================
   Botões
====================== */
btnAtualizarNotificacoesProfessor?.addEventListener(
  "click",
  async () => {
    await carregarNotificacoes();
  }
);

btnMarcarTodasVistas?.addEventListener(
  "click",
  async () => {
    await marcarTodasComoVistas();
  }
);

btnSair?.addEventListener(
  "click",
  async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error(
        "Erro ao sair:",
        error
      );
    }

    localStorage.removeItem("role");
    localStorage.removeItem("professorId");
    localStorage.removeItem("professorNome");
    localStorage.removeItem("professorEmail");
    localStorage.removeItem("matriculaSelecionada");
    localStorage.removeItem("alunoIdVisualizacao");

    window.location.href =
      "index.html";
  }
);

/* ======================
   Iniciar
====================== */
await carregarProfessor();
await carregarNotificacoes();