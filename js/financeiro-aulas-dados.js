import { supabase } from "./supabase.js";

export async function carregarPaginas(criarConsulta) {
  const registros = [];
  const tamanho = 500;
  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await criarConsulta().range(inicio, inicio + tamanho - 1);
    if (error) throw error;
    registros.push(...data);
    if (data.length < tamanho) return registros;
  }
}

export async function carregarItensHoraAula({ inicio, fim, data, professorId } = {}) {
  const [aulas, precos] = await Promise.all([
    carregarPaginas(() => {
      let consulta = supabase.from("aula").select(`
        id, data_aula, status, conteudo, duracao_segundos, professor_id, parte,
        evento_id, aula_coletiva, grupo_aula_id, quantidade_alunos,
        matricula:matricula_id (id, professor_id, materia_id,
          aluno:aluno_id (id, nome), materia:materia_id (nome))
      `).or("aula_gravada.eq.true,status.eq.Evento,evento_id.not.is.null")
        .order("data_aula", { ascending: false }).order("id");
      if (data) return consulta.eq("data_aula", data);
      if (inicio) consulta = consulta.gte("data_aula", inicio);
      if (fim) consulta = consulta.lt("data_aula", fim);
      return consulta;
    }),
    carregarPaginas(() => supabase.from("professor_materia")
      .select("professor_id,materia_id,valor_hora").order("id"))
  ]);
  const tarifas = new Map(precos.map((p) => [`${p.professor_id}:${p.materia_id}`, Number(p.valor_hora)]));
  const filtradas = professorId ? aulas.filter((aula) =>
    String(aula.professor_id ?? aula.matricula?.professor_id) === String(professorId)
  ) : aulas;
  return agruparAulasParaFinanceiro(filtradas, tarifas);
}

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}


function ehSabado(dataIso) {
  if (!dataIso) {
    return false;
  }

  const [ano, mes, dia] = String(dataIso)
    .split("-")
    .map(Number);

  if (
    !ano ||
    !mes ||
    !dia
  ) {
    return false;
  }

  const dataLocal = new Date(
    ano,
    mes - 1,
    dia
  );

  return dataLocal.getDay() === 6;
}


export function formatarSegundosParaCampo(
  valorSegundos
) {
  if (
    valorSegundos === null ||
    valorSegundos === undefined ||
    valorSegundos === ""
  ) {
    return "";
  }

  const total = Number(valorSegundos);

  if (Number.isNaN(total)) {
    return "";
  }

  const horas = Math.floor(
    total / 3600
  );

  const resto = total % 3600;

  const minutos = Math.floor(
    resto / 60
  );

  const segundos = resto % 60;

  if (horas > 0) {
    return (
      `${horas}:` +
      `${String(minutos).padStart(2, "0")}:` +
      `${String(segundos).padStart(2, "0")}`
    );
  }

  return (
    `${minutos}:` +
    `${String(segundos).padStart(2, "0")}`
  );
}


export function normalizarDuracaoSegundos(valor) {
  if (
    valor === "" ||
    valor === null ||
    valor === undefined
  ) {
    return null;
  }

  const numero = Number(valor);

  if (
    Number.isNaN(numero) ||
    numero < 0
  ) {
    return null;
  }

  return numero;
}


function ehEvento(aulaOuItem) {
  const statusNormalizado = normalizarTexto(
    aulaOuItem?.status
  );

  const possuiEventoId =
    aulaOuItem?.evento_id !== null &&
    aulaOuItem?.evento_id !== undefined &&
    aulaOuItem?.evento_id !== "";

  return (
    statusNormalizado === "evento" ||
    possuiEventoId
  );
}


function obterValorHoraDaMateria(tarifas, professorId, materiaId) {
  return tarifas.get(`${professorId}:${materiaId}`) ?? null;
}


export function deveAplicarValorColetivo(
  item
) {
  /*
    Evento é sempre coletivo.

    Também recebem o valor coletivo:
    - aulas marcadas como coletivas;
    - aulas individuais realizadas no sábado.
  */
  return (
    Boolean(item.eh_evento) ||
    Boolean(item.aula_coletiva) ||
    Boolean(item.aula_sabado)
  );
}


export function obterValorHoraAplicado(
  item
) {
  const valorHoraBase = Number(
    item.valor_hora || 0
  );

  if (
    deveAplicarValorColetivo(item)
  ) {
    return valorHoraBase * 1.5;
  }

  return valorHoraBase;
}


export function calcularValorItem(item) {
  const segundos = Number(
    item.duracao_segundos || 0
  );

  if (!segundos) {
    return 0;
  }

  const valorHoraAplicado =
    obterValorHoraAplicado(item);

  return (
    valorHoraAplicado /
    3600
  ) * segundos;
}


function ordenarNomes(lista) {
  return [...lista].sort(
    (a, b) => {
      return a.localeCompare(
        b,
        "pt-BR",
        {
          sensitivity: "base"
        }
      );
    }
  );
}


function montarChaveParticipante(aula) {
  const alunoId =
    aula?.matricula?.aluno?.id;

  if (alunoId) {
    return `aluno_${alunoId}`;
  }

  const matriculaId =
    aula?.matricula?.id;

  if (matriculaId) {
    return `matricula_${matriculaId}`;
  }

  return `aula_${aula.id}`;
}


function montarChaveGrupo(aula) {
  const professorId =
    Number(aula.professor_id || 0);

  if (
    ehEvento(aula) &&
    aula.evento_id
  ) {
    /*
      Um evento aparece uma única vez por professor,
      mesmo tendo vários registros de participantes.
    */
    return (
      `evento_${aula.evento_id}` +
      `_professor_${professorId}`
    );
  }

  if (
    ehEvento(aula) &&
    !aula.evento_id
  ) {
    /*
      Compatibilidade para registros antigos de evento
      que eventualmente não possuam evento_id.
    */
    const conteudoNormalizado =
      normalizarTexto(
        aula.conteudo || "evento"
      )
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_áéíóúãõâêôç]/gi, "");

    return (
      `evento_sem_id_` +
      `${professorId}_` +
      `${aula.data_aula}_` +
      `${conteudoNormalizado}`
    );
  }

  if (aula.grupo_aula_id) {
    return (
      `grupo_${aula.grupo_aula_id}` +
      `_professor_${professorId}`
    );
  }

  return `aula_${aula.id}`;
}


function criarItemBase({
  aula,
  chave,
  materiaId,
  materiaNome,
  valorHoraBase,
  nomeAluno,
  chaveAluno,
  aulaEhEvento,
  aulaEhSabado,
  ehColetiva
}) {
  return {
    tipo: aulaEhEvento
      ? "evento"
      : ehColetiva
        ? "coletiva"
        : aulaEhSabado
          ? "individual_sabado"
          : "individual",

    chave,

    evento_id:
      aula.evento_id || null,

    grupo_aula_id:
      aula.grupo_aula_id || null,

    aula_coletiva:
      Boolean(ehColetiva),

    aula_sabado:
      Boolean(aulaEhSabado),

    eh_evento:
      Boolean(aulaEhEvento),

    ids_aula: [
      Number(aula.id)
    ],

    professor_id:
      aula.professor_id,

    data_aula:
      aula.data_aula,

    status:
      aula.status,

    conteudo:
      aula.conteudo || "",

    parte:
      aula.parte || 1,

    materia_id:
      materiaId,

    materia_nome:
      materiaNome,

    alunos: [
      nomeAluno
    ],

    chaves_alunos: [
      chaveAluno
    ],

    quantidade_alunos:
      1,

    duracao_segundos:
      aula.duracao_segundos ?? "",

    duracao_segundos_salva:
      aula.duracao_segundos ?? null,

    duracao_input:
      formatarSegundosParaCampo(
        aula.duracao_segundos
      ),

    valor_hora:
      valorHoraBase,

    editando:
      false
  };
}


export function agruparAulasParaFinanceiro(aulas, tarifas) {
  const grupos = new Map();

  for (const registro of aulas) {
    const aula = {
      ...registro,
      professor_id: registro.professor_id ?? registro.matricula?.professor_id ?? null
    };
    const materiaId =
      aula?.matricula?.materia_id ||
      null;

    const valorHoraBase =
      obterValorHoraDaMateria(
        tarifas, aula.professor_id, materiaId
      );

    const nomeAluno =
      aula?.matricula?.aluno?.nome ||
      "Aluno não identificado";

    const chaveAluno =
      montarChaveParticipante(aula);

    const materiaNome =
      aula?.matricula?.materia?.nome ||
      "Matéria não identificada";

    const aulaEhEvento =
      ehEvento(aula);

    const aulaEhSabado =
      ehSabado(aula.data_aula);

    /*
      Todo evento é tratado como coletivo,
      mesmo que aula_coletiva esteja false ou null.
    */
    const ehColetiva =
      Boolean(aula.aula_coletiva) ||
      aulaEhEvento;

    const deveAgrupar =
      ehColetiva ||
      Boolean(aula.grupo_aula_id);

    const chave =
      deveAgrupar
        ? montarChaveGrupo(aula)
        : `aula_${aula.id}`;

    if (!grupos.has(chave)) {
      grupos.set(
        chave,
        criarItemBase({
          aula,
          chave,
          materiaId,
          materiaNome,
          valorHoraBase,
          nomeAluno,
          chaveAluno,
          aulaEhEvento,
          aulaEhSabado,
          ehColetiva
        })
      );

      continue;
    }

    const grupo = grupos.get(chave);

    if (
      !grupo.ids_aula.includes(
        Number(aula.id)
      )
    ) {
      grupo.ids_aula.push(
        Number(aula.id)
      );
    }

    grupo.aula_sabado =
      grupo.aula_sabado ||
      aulaEhSabado;

    /*
      Adiciona o participante apenas uma vez.

      Isso evita duplicação caso existam dois registros
      relacionados ao mesmo aluno.
    */
    if (
      !grupo.chaves_alunos.includes(
        chaveAluno
      )
    ) {
      grupo.chaves_alunos.push(
        chaveAluno
      );

      grupo.alunos.push(
        nomeAluno
      );
    }

    /*
      Se um dos registros já possuir minutagem,
      ela será utilizada pelo grupo inteiro.
    */
    if (
      (
        grupo.duracao_segundos === "" ||
        grupo.duracao_segundos === null ||
        grupo.duracao_segundos === undefined
      ) &&
      aula.duracao_segundos !== null &&
      aula.duracao_segundos !== undefined
    ) {
      grupo.duracao_segundos =
        aula.duracao_segundos;

      grupo.duracao_input =
        formatarSegundosParaCampo(
          aula.duracao_segundos
        );
    }

    if (
      (
        grupo.duracao_segundos_salva === "" ||
        grupo.duracao_segundos_salva === null ||
        grupo.duracao_segundos_salva === undefined
      ) &&
      aula.duracao_segundos !== null &&
      aula.duracao_segundos !== undefined
    ) {
      grupo.duracao_segundos_salva =
        aula.duracao_segundos;
    }

    /*
      Mantém um conteúdo válido caso o primeiro
      registro esteja sem descrição.
    */
    if (
      !grupo.conteudo &&
      aula.conteudo
    ) {
      grupo.conteudo =
        aula.conteudo;
    }
  }

  const itens = [
    ...grupos.values()
  ].map((item) => {
    const alunosOrdenados =
      ordenarNomes(item.alunos);

    return {
      ...item,

      alunos:
        alunosOrdenados,

      quantidade_alunos:
        item.chaves_alunos.length || 1
    };
  });

  return itens.sort((a, b) =>
    (b.data_aula || "").localeCompare(a.data_aula || "") ||
    (a.alunos[0] || "").localeCompare(b.alunos[0] || "", "pt-BR", { sensitivity: "base" }) ||
    (a.chaves_alunos[0] || "").localeCompare(b.chaves_alunos[0] || "") ||
    Number(a.parte) - Number(b.parte) ||
    a.ids_aula[0] - b.ids_aula[0]
  );
}
