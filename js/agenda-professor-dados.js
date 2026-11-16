import { supabase } from "./supabase.js";

export function dataAgendaISO(offset = 0) {
  const partes = new Intl.DateTimeFormat("en", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const { year, month, day } = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + offset))
    .toISOString().slice(0, 10);
}

export async function carregarHorariosDoDia(professorId, dataISO, mapaAvisos) {
  const diaSemana = new Date(`${dataISO}T12:00:00Z`).getUTCDay();
  const [horarios, aulas, avisos] = await Promise.all([
    buscarHorariosPorDia(professorId, diaSemana),
    buscarAulasRegistradasNaData(professorId, dataISO),
    mapaAvisos ?? buscarAvisosAusenciaNoPeriodo(professorId, dataISO, dataISO)
      .then(criarMapaAvisosAusencia)
  ]);

  return aplicarAvisosAusencia(
    aplicarStatusDeRegistro(horarios, aulas),
    dataISO,
    avisos
  );
}

export async function buscarHorariosPorDia(professorId, diaSemana) {
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
      matricula:matricula_id (
        empresa_cnpj,
        link_zoom,
        empresa:empresa_cnpj (nome, tipo_cadastro)
      ),
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
    .eq("professor_id", professorId)
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
async function buscarAulasRegistradasNaData(professorId, dataISO) {
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
    .eq("professor_id", professorId)
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
   AVISOS DE AUSÊNCIA
===================================================== */
export async function buscarAvisosAusenciaNoPeriodo(professorId, dataInicial, dataFinal) {
  const { data, error } = await supabase
    .from("aviso_ausencia")
    .select(`
      id,
      aluno_id,
      matricula_id,
      horario_aula_id,
      professor_id,
      data_aula,
      hora_inicio,
      hora_fim,
      justificativa,
      tipo_solicitacao,
      dentro_prazo_reposicao,
      antecedencia_minutos,
      status,
      criado_em
    `)
    .eq("professor_id", professorId)
    .eq("status", "pendente")
    .gte("data_aula", dataInicial)
    .lte("data_aula", dataFinal);

  if (error) {
    console.error("Erro ao buscar avisos de ausência:", error);
    throw new Error("Erro ao carregar avisos de ausência.");
  }

  return data || [];
}

export function criarMapaAvisosAusencia(avisos) {
  const mapa = new Map();

  (avisos || []).forEach((aviso) => {
    const chave = `${Number(aviso.horario_aula_id)}|${aviso.data_aula}`;
    mapa.set(chave, aviso);
  });

  return mapa;
}

export function aplicarAvisosAusencia(horarios, dataISO, mapaAvisos) {
  return (horarios || []).map((horario) => {
    const chave = `${Number(horario.id)}|${dataISO}`;

    return {
      ...horario,
      aviso_ausencia: mapaAvisos.get(chave) || null
    };
  });
}
