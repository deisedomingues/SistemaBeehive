import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

const professorId = Number(localStorage.getItem("professorId"));

/* =========================================================
   ELEMENTOS
========================================================= */
const msg = document.getElementById("msg");

const tituloResumoProfessor = document.getElementById("tituloResumoProfessor");
const subtituloResumoProfessor = document.getElementById("subtituloResumoProfessor");

const dataInicio = document.getElementById("dataInicio");
const dataFim = document.getElementById("dataFim");
const btnAplicarFiltro = document.getElementById("btnAplicarFiltro");
const btnLimparFiltro = document.getElementById("btnLimparFiltro");
const filtroStatusPeriodo = document.getElementById("filtroStatusPeriodo");

const textoResumoAulasPeriodo = document.getElementById("textoResumoAulasPeriodo");
const textoResumoDuracaoPeriodo = document.getElementById("textoResumoDuracaoPeriodo");

const listaAvaliacoesContainer = document.getElementById("listaAvaliacoesContainer");
const btnToggleAvaliacoes = document.getElementById("btnToggleAvaliacoes");

const listaAniversariantesContainer = document.getElementById("listaAniversariantesContainer");

const listaAulasPeriodoContainer = document.getElementById("listaAulasPeriodoContainer");
const btnToggleAulasPeriodo = document.getElementById("btnToggleAulasPeriodo");
const btnExpandirAulasPeriodo = document.getElementById("btnExpandirAulasPeriodo");

const selectMatricula = document.getElementById("selectMatricula");
const btnDetalhes = document.getElementById("btnDetalhes");

const cardVisaoGeralProfessor = document.getElementById("cardVisaoGeralProfessor");

/* =========================================================
   ESTADO
========================================================= */
let professorNome = "";
let materiasProfessor = [];
let materiaIdsProfessor = [];
let matriculasFiltradas = [];
let aulasFiltradasProfessor = [];
let notasDoSistema = [];
let avaliacoesEnviadasDoSistema = [];
let avaliacoesPendentesAtuais = [];

let avaliacoesExpandidas = false;
let aulasPeriodoAberta = false;
let aulasPeriodoExpandida = false;

/* =========================================================
   UTILITÁRIOS
========================================================= */
function mostrarMensagem(texto, ok = true) {
  if (!msg) return;

  msg.textContent = texto;
  msg.style.display = "block";
  msg.className = ok ? "msg-resumo-professor ok" : "msg-resumo-professor erro";

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
    msg.className = "msg-resumo-professor";
  }, 3000);
}

function mostrarMensagemLocal(elementoReferencia, texto, ok = true) {
  if (!elementoReferencia) return;

  const container =
    elementoReferencia.closest(".item-avaliacao-acoes") ||
    elementoReferencia.parentElement;

  if (!container) return;

  const mensagemAntiga = container.querySelector(".msg-local-resumo");

  if (mensagemAntiga) {
    mensagemAntiga.remove();
  }

  const div = document.createElement("div");
  div.className = ok ? "msg-local-resumo ok" : "msg-local-resumo erro";
  div.textContent = texto;

  container.appendChild(div);

  setTimeout(() => {
    div.remove();
  }, 3500);
}

function hojeISO() {
  const hoje = new Date();
  const yyyy = hoje.getFullYear();
  const mm = String(hoje.getMonth() + 1).padStart(2, "0");
  const dd = String(hoje.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function preencherFiltroInicial() {
  const primeiraAula = await buscarPrimeiraAulaProfessor();
  const hoje = hojeISO();

  if (dataInicio) dataInicio.value = primeiraAula || hoje;
  if (dataFim) dataFim.value = hoje;

  if (filtroStatusPeriodo) {
    filtroStatusPeriodo.value = "";
  }

  aulasPeriodoAberta = false;
  aulasPeriodoExpandida = false;
}

function criarParagrafoVazio(texto) {
  return `<p style="font-size:14px;">${escapeHtml(texto)}</p>`;
}

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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

  const texto = String(dataISO);

  if (texto.includes("T")) {
    const data = new Date(texto);

    if (!Number.isNaN(data.getTime())) {
      return data.toLocaleDateString("pt-BR");
    }
  }

  const [ano, mes, dia] = texto.split("-");

  if (!ano || !mes || !dia) return texto;

  return `${dia}/${mes}/${ano}`;
}

function formatarDataHoraBR(dataISO) {
  if (!dataISO) return "data não informada";

  const data = new Date(dataISO);

  if (Number.isNaN(data.getTime())) {
    return formatarDataBR(dataISO);
  }

  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function calcularIdade(dataNascimentoISO) {
  if (!dataNascimentoISO) return null;

  const hoje = new Date();
  const nascimento = new Date(`${dataNascimentoISO}T00:00:00`);

  if (Number.isNaN(nascimento.getTime())) return null;

  let idade = hoje.getFullYear() - nascimento.getFullYear();

  const mesAtual = hoje.getMonth();
  const diaAtual = hoje.getDate();
  const mesNascimento = nascimento.getMonth();
  const diaNascimento = nascimento.getDate();

  if (
    mesAtual < mesNascimento ||
    (mesAtual === mesNascimento && diaAtual < diaNascimento)
  ) {
    idade--;
  }

  return idade;
}

function ehAniversarianteHoje(dataNascimentoISO) {
  if (!dataNascimentoISO) return false;

  const hoje = new Date();
  const nascimento = new Date(`${dataNascimentoISO}T00:00:00`);

  if (Number.isNaN(nascimento.getTime())) return false;

  return (
    hoje.getDate() === nascimento.getDate() &&
    hoje.getMonth() === nascimento.getMonth()
  );
}

function ehNotaDeAvaliacao(nota) {
  const tipo = normalizarTexto(
    nota?.tipo ?? nota?.tipo_avaliacao ?? nota?.avaliacao ?? ""
  );

  return tipo.includes("avalia");
}

/* =========================================================
   REGRAS DE AULA
========================================================= */
function aulaValidaParaAvaliacao(aula) {
  const status = normalizarTexto(aula?.status);
  const gravada = aula?.aula_gravada === true;

  if (status === "presente") return true;
  if (status === "ausente" && gravada) return true;
  if (status === "reposicao" && gravada) return true;
  if (status === "reposição" && gravada) return true;

  return false;
}

function aulaContaParaCicloDeAvaliacao(aula) {
  return aulaValidaParaAvaliacao(aula);
}

function aulaValidaParaProfessor(aula) {
  return aulaValidaParaAvaliacao(aula);
}

function statusContaComoAulaPedagogicaNoPeriodo(aula) {
  const status = normalizarTexto(aula?.status);

  return [
    "presente",
    "ausente",
    "reposicao",
    "reposição",
    "aula instrumental",
    "plantao de duvidas",
    "plantão de duvidas",
    "plantao de dúvidas",
    "plantão de dúvidas",
    "evento"
  ].includes(status);
}

function aulaAusentePendenteReposicao(aula) {
  const status = normalizarTexto(aula?.status);

  return (
    status === "ausente" &&
    aula?.precisa_reposicao === true &&
    aula?.aula_gravada !== true
  );
}

function obterSegundosAula(aula) {
  /*
    Aula coletiva já vem agrupada para o resumo.
    Então a duração representa o grupo inteiro,
    não cada aluno individualmente.
  */
  if (aula?.ids_aulas_resumo?.length > 1) {
    const segundosGrupo = Number(aula?.duracao_segundos);

    if (!Number.isNaN(segundosGrupo) && segundosGrupo > 0) {
      return segundosGrupo;
    }

    return 0;
  }

  if (aulaAusentePendenteReposicao(aula)) {
    return 0;
  }

  const segundos = Number(aula?.duracao_segundos);

  if (!Number.isNaN(segundos) && segundos > 0) {
    return segundos;
  }

  return 0;
}

function obterMinutosAula(aula) {
  const segundos = obterSegundosAula(aula);

  if (segundos <= 0) return 0;

  return Math.round(segundos / 60);
}

function formatarDuracaoPorSegundos(totalSegundos) {
  const segundos = Number(totalSegundos || 0);

  if (segundos <= 0) {
    return "0 minuto(s) registrados";
  }

  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const segundosRestantes = segundos % 60;

  if (horas <= 0 && minutos <= 0) {
    return `${segundosRestantes} segundo(s) registrados`;
  }

  if (horas <= 0) {
    if (segundosRestantes > 0) {
      return `${minutos} minuto(s) e ${segundosRestantes} segundo(s) registrados`;
    }

    return `${minutos} minuto(s) registrados`;
  }

  if (minutos <= 0 && segundosRestantes <= 0) {
    return `${horas} hora(s) registradas`;
  }

  if (segundosRestantes <= 0) {
    return `${horas} hora(s) e ${minutos} minuto(s) registrados`;
  }

  return `${horas} hora(s), ${minutos} minuto(s) e ${segundosRestantes} segundo(s) registrados`;
}

function textoFiltroSelecionado() {
  const valor = filtroStatusPeriodo?.value || "";

  if (!valor) return "todas";
  if (valor === "aulas_validas") return "aulas válidas";

  return valor.toLowerCase();
}

function nomeAlunoDaAula(aula) {
  return aula?.matricula?.aluno?.nome || "Aluno não informado";
}

function textoStatusAulaProfessor(aula) {
  if (aulaAusentePendenteReposicao(aula)) {
    return "Ausente — pendente de reposição";
  }

  return aula?.status || "Não informado";
}

function textoReposicaoAulaOriginal(aula) {
  if (aulaAusentePendenteReposicao(aula)) {
    return "aguardando reposição";
  }

  if (
    normalizarTexto(aula?.status) !== "reposicao" &&
    normalizarTexto(aula?.status) !== "reposição"
  ) {
    return "";
  }

  const original = aula?.aula_original;

  if (!original) {
    return "aula original não localizada";
  }

  return `repõe ${formatarDataBR(original.data_aula)} (${original.status || "status não informado"})`;
}

function textoDuracaoAulaProfessor(aula) {
  if (aulaAusentePendenteReposicao(aula)) {
    return "0 min";
  }

  const minutos = obterMinutosAula(aula);

  if (minutos > 0) {
    return `${minutos} min`;
  }

  return "Sem minutagem";
}

function ordenarAulasPorDataDesc(a, b) {
  const dataA = String(a?.data_aula || "");
  const dataB = String(b?.data_aula || "");

  if (dataA !== dataB) {
    return dataB.localeCompare(dataA);
  }

  const parteA = Number(a?.parte || 1);
  const parteB = Number(b?.parte || 1);

  if (parteA !== parteB) {
    return parteB - parteA;
  }

  return Number(b?.id || 0) - Number(a?.id || 0);
}

function chaveAvaliacao({ matriculaId, moduloId, numeroAvaliacao }) {
  return `${Number(matriculaId)}-${Number(moduloId)}-${Number(numeroAvaliacao)}`;
}

/* =========================================================
   AGRUPAMENTO DAS AULAS DO RESUMO DO PROFESSOR
========================================================= */
function ehGrupoAulaPeriodo(aula) {
  return Boolean(aula?.aula_coletiva && aula?.grupo_aula_id);
}

function chaveGrupoAulaPeriodo(aula) {
  if (aula?.evento_id) {
    return `evento_${aula.evento_id}`;
  }

  if (ehGrupoAulaPeriodo(aula)) {
    return `grupo_${aula.grupo_aula_id}`;
  }

  return `aula_${aula.id}`;
}

function obterMateriaModuloResumo(aula) {
  const materia =
    aula?.matricula?.modulo?.materia?.nome ||
    aula?.matricula?.materia?.nome ||
    "";

  const modulo =
    aula?.matricula?.modulo?.nome ||
    "";

  if (materia && modulo) return `${materia} | ${modulo}`;
  if (materia) return materia;
  if (modulo) return modulo;

  return "";
}

function agruparAulasPeriodoProfessor(aulas) {
  const grupos = new Map();

  aulas.forEach((aula) => {
    const chave = chaveGrupoAulaPeriodo(aula);
    const nomeAluno = nomeAlunoDaAula(aula);
    const statusAluno = textoStatusAulaProfessor(aula);
    const duracao = obterSegundosAula(aula);

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        ...aula,
        chave_resumo: chave,
        aula_coletiva_resumo: ehGrupoAulaPeriodo(aula),
        ids_aulas_resumo: [Number(aula.id)],
        participantes_resumo: [
          {
            nome: nomeAluno,
            status: statusAluno
          }
        ],
        status_resumo: [statusAluno],
        duracao_segundos: duracao,
        quantidade_alunos_resumo: Number(aula.quantidade_alunos || 0) || 1,
        materia_modulo_resumo: obterMateriaModuloResumo(aula)
      });

      return;
    }

    const grupo = grupos.get(chave);

    grupo.ids_aulas_resumo.push(Number(aula.id));

    if (
      !grupo.participantes_resumo.some(
        (p) => normalizarTexto(p.nome) === normalizarTexto(nomeAluno)
      )
    ) {
      grupo.participantes_resumo.push({
        nome: nomeAluno,
        status: statusAluno
      });
    }

    if (!grupo.status_resumo.includes(statusAluno)) {
      grupo.status_resumo.push(statusAluno);
    }

    grupo.quantidade_alunos_resumo = Math.max(
      Number(grupo.quantidade_alunos_resumo || 0),
      Number(aula.quantidade_alunos || 0),
      grupo.participantes_resumo.length
    );

    /*
      Aula coletiva tem várias linhas no banco, uma por aluno.
      No resumo do professor, a duração precisa contar uma vez só.
      Por segurança, usamos a maior duração encontrada no grupo.
    */
    grupo.duracao_segundos = Math.max(
      Number(grupo.duracao_segundos || 0),
      Number(duracao || 0)
    );

    if (!grupo.conteudo && aula.conteudo) {
      grupo.conteudo = aula.conteudo;
    }

    if (!grupo.licao_casa && aula.licao_casa) {
      grupo.licao_casa = aula.licao_casa;
    }

    if (!grupo.materia_modulo_resumo) {
      grupo.materia_modulo_resumo = obterMateriaModuloResumo(aula);
    }
  });

  return [...grupos.values()].map((grupo) => ({
    ...grupo,
    participantes_resumo: [...grupo.participantes_resumo].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
    )
  }));
}

function textoTipoAulaResumo(aula) {
  if (aula?.evento_id) return "Evento";
  return aula?.aula_coletiva_resumo ? "Aula coletiva" : "Aula individual";
}

function htmlParticipantesResumo(aula) {
  const participantes = aula?.participantes_resumo || [
    {
      nome: nomeAlunoDaAula(aula),
      status: textoStatusAulaProfessor(aula)
    }
  ];

  return participantes
    .map((p) => {
      return `
        <span style="
          display:inline-flex;
          align-items:center;
          gap:4px;
          padding:3px 7px;
          border:1px solid #f1d98a;
          border-radius:999px;
          background:#fffdf8;
          white-space:nowrap;
        ">
          <b>${escapeHtml(p.nome)}</b>
          <span style="opacity:.75;">${escapeHtml(p.status)}</span>
        </span>
      `;
    })
    .join("");
}

function textoStatusResumoGrupo(aula) {
  if (!aula?.aula_coletiva_resumo) {
    return textoStatusAulaProfessor(aula);
  }

  const statuses = aula.status_resumo || [];

  if (statuses.length === 1) {
    return statuses[0];
  }

  return "Status misto";
}

/* =========================================================
   BUSCAS PAGINADAS
========================================================= */
async function buscarAulasPorPeriodoPaginado() {
  const inicio = dataInicio?.value || null;
  const fim = dataFim?.value || null;

  const tamanhoPagina = 1000;
  let pagina = 0;
  let todas = [];

  while (true) {
    const from = pagina * tamanhoPagina;
    const to = from + tamanhoPagina - 1;

    let query = supabase
      .from("aula")
      .select(`
        id,
        data_aula,
        status,
        conteudo,
        licao_casa,
        aula_gravada,
        precisa_reposicao,
        matricula_id,
        modulo_id,
        professor_id,
        aula_original_id,
        duracao_segundos,
        parte,
        evento_id,
        aula_coletiva,
        grupo_aula_id,
        quantidade_alunos,
        matricula:matricula_id (
          id,
          professor_id,
          materia_id,
          aluno:aluno_id (
            id,
            nome
          ),
          modulo:modulo_id (
            id,
            nome,
            materia_id,
            materia:materia_id (
              id,
              nome
            )
          ),
          materia:materia_id (
            id,
            nome
          )
        )
      `)
      .eq("professor_id", professorId)
      .order("id", { ascending: true })
      .range(from, to);

    if (inicio) query = query.gte("data_aula", inicio);
    if (fim) query = query.lte("data_aula", fim);

    const { data, error } = await query;

    if (error) throw error;

    const lote = data || [];
    todas = todas.concat(lote);

    if (lote.length < tamanhoPagina) break;

    pagina++;
  }

  return todas;
}

async function buscarTodasAulasDasMatriculasPaginado(idsMatriculas) {
  if (!idsMatriculas.length) return [];

  const tamanhoPagina = 1000;
  let pagina = 0;
  let todas = [];

  while (true) {
    const from = pagina * tamanhoPagina;
    const to = from + tamanhoPagina - 1;

    const { data, error } = await supabase
      .from("aula")
      .select(`
        id,
        matricula_id,
        modulo_id,
        status,
        aula_gravada,
        data_aula
      `)
      .in("matricula_id", idsMatriculas)
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw error;

    const lote = data || [];
    todas = todas.concat(lote);

    if (lote.length < tamanhoPagina) break;

    pagina++;
  }

  return todas;
}

async function buscarNotasDasMatriculasPaginado(idsMatriculas) {
  if (!idsMatriculas.length) return [];

  const tamanhoPagina = 1000;
  let pagina = 0;
  let todas = [];

  while (true) {
    const from = pagina * tamanhoPagina;
    const to = from + tamanhoPagina - 1;

    const { data, error } = await supabase
      .from("nota")
      .select(`
        id,
        matricula_id,
        modulo_id,
        tipo,
        valor,
        observacao,
        data
      `)
      .in("matricula_id", idsMatriculas)
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw error;

    const lote = data || [];
    todas = todas.concat(lote);

    if (lote.length < tamanhoPagina) break;

    pagina++;
  }

  return todas;
}

async function buscarAvaliacoesAlunosPaginado(idsMatriculas) {
  if (!idsMatriculas.length) return [];

  const tamanhoPagina = 1000;
  let pagina = 0;
  let todas = [];

  while (true) {
    const from = pagina * tamanhoPagina;
    const to = from + tamanhoPagina - 1;

    const { data, error } = await supabase
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
        aluno_confirmou_realizacao_em,
        concluida_em,
        visualizado
      `)
      .in("matricula_id", idsMatriculas)
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw error;

    const lote = data || [];
    todas = todas.concat(lote);

    if (lote.length < tamanhoPagina) break;

    pagina++;
  }

  return todas;
}

/* =========================================================
   BUSCAS
========================================================= */
async function carregarProfessor() {
  const { data, error } = await supabase
    .from("professor")
    .select("id, nome")
    .eq("id", professorId)
    .single();

  if (error) throw error;

  professorNome = data?.nome || "Professor(a)";

  if (tituloResumoProfessor) {
    tituloResumoProfessor.textContent = `Olá, ${professorNome}!`;
  }

  if (subtituloResumoProfessor) {
    subtituloResumoProfessor.textContent =
      "Acompanhe seus alunos, aulas e notificações importantes.";
  }
}

async function carregarMateriasProfessor() {
  const { data, error } = await supabase
    .from("professor_materia")
    .select(`
      materia_id,
      materia:materia_id (
        id,
        nome
      )
    `)
    .eq("professor_id", professorId);

  if (error) throw error;

  materiasProfessor = (data || [])
    .map((item) => item.materia)
    .filter(Boolean);

  materiaIdsProfessor = materiasProfessor.map((m) => Number(m.id));
}

async function carregarMatriculasRelacionadas() {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      professor_id,
      ativa,
      modulo_id,
      aluno:aluno_id (
        id,
        nome,
        data_nascimento
      ),
      modulo:modulo_id (
        id,
        nome,
        materia_id,
        materia:materia_id (
          id,
          nome
        )
      )
    `)
    .eq("professor_id", professorId)
    .eq("ativa", true);

  if (error) throw error;

  matriculasFiltradas = (data || []).filter((m) => {
    const materiaId = Number(m?.modulo?.materia_id || 0);
    return materiaIdsProfessor.includes(materiaId);
  });
}

async function buscarPrimeiraAulaProfessor() {
  const { data, error } = await supabase
    .from("aula")
    .select("data_aula")
    .eq("professor_id", professorId)
    .not("data_aula", "is", null)
    .order("data_aula", { ascending: true })
    .limit(1);

  if (error) throw error;

  return data?.[0]?.data_aula || null;
}

async function carregarAulasProfessorPorPeriodo() {
  const statusSelecionado = filtroStatusPeriodo?.value || "";

  const data = await buscarAulasPorPeriodoPaginado();

  const matriculaIdsPermitidas = new Set(
    matriculasFiltradas.map((m) => Number(m.id))
  );

  let filtradas = (data || []).filter((aula) =>
    matriculaIdsPermitidas.has(Number(aula.matricula_id))
  );

  filtradas = filtradas.filter((aula) =>
    statusContaComoAulaPedagogicaNoPeriodo(aula)
  );

  if (statusSelecionado === "aulas_validas") {
    filtradas = filtradas.filter((aula) => aulaValidaParaProfessor(aula));
  } else if (statusSelecionado) {
    filtradas = filtradas.filter(
      (aula) => normalizarTexto(aula.status) === normalizarTexto(statusSelecionado)
    );
  }

  const idsOriginais = [
    ...new Set(
      filtradas
        .map((aula) => aula.aula_original_id)
        .filter(Boolean)
        .map(Number)
    )
  ];

  let mapaOriginais = {};

  if (idsOriginais.length) {
    const { data: originais, error: errorOriginais } = await supabase
      .from("aula")
      .select("id, data_aula, status")
      .in("id", idsOriginais);

    if (!errorOriginais) {
      (originais || []).forEach((aulaOriginal) => {
        mapaOriginais[String(aulaOriginal.id)] = aulaOriginal;
      });
    }
  }

  const comOriginais = filtradas.map((aula) => ({
    ...aula,
    aula_original: aula.aula_original_id
      ? mapaOriginais[String(aula.aula_original_id)] || null
      : null
  }));

  aulasFiltradasProfessor = agruparAulasPeriodoProfessor(comOriginais);
}

async function carregarNotasSistema() {
  const idsMatriculas = matriculasFiltradas.map((m) => Number(m.id));

  if (!idsMatriculas.length) {
    notasDoSistema = [];
    return;
  }

  try {
    notasDoSistema = await buscarNotasDasMatriculasPaginado(idsMatriculas);
  } catch (error) {
    console.warn("Não foi possível carregar notas:", error.message);
    notasDoSistema = [];
  }
}

async function carregarAvaliacoesEnviadasSistema() {
  const idsMatriculas = matriculasFiltradas.map((m) => Number(m.id));

  if (!idsMatriculas.length) {
    avaliacoesEnviadasDoSistema = [];
    return;
  }

  try {
    avaliacoesEnviadasDoSistema = await buscarAvaliacoesAlunosPaginado(idsMatriculas);
  } catch (error) {
    console.warn("Não foi possível carregar avaliações enviadas:", error.message);
    avaliacoesEnviadasDoSistema = [];
  }
}

/* =========================================================
   AVALIAÇÕES
========================================================= */
async function carregarPendenciasAvaliacaoPorMatricula() {
  const idsMatriculas = matriculasFiltradas.map((m) => Number(m.id));

  if (!idsMatriculas.length) {
    return [];
  }

  const moduloAtualPorMatricula = {};
  const metaPorMatricula = {};

  matriculasFiltradas.forEach((m) => {
    const matriculaId = Number(m.id);
    const mid = String(matriculaId);

    moduloAtualPorMatricula[mid] = Number(m.modulo_id || 0);

    metaPorMatricula[mid] = {
      matriculaId,
      alunoId: Number(m?.aluno?.id || 0),
      aluno: m?.aluno?.nome || "Aluno",
      dataNascimento: m?.aluno?.data_nascimento || null,
      materia: m?.modulo?.materia?.nome || "Matéria",
      materiaId: Number(m?.modulo?.materia?.id || m?.modulo?.materia_id || 0),
      modulo: m?.modulo?.nome || "Módulo",
      moduloId: Number(m?.modulo_id || 0)
    };
  });

  const aulas = await buscarTodasAulasDasMatriculasPaginado(idsMatriculas);

  const aulasValidasPorMatricula = {};

  (aulas || []).forEach((aula) => {
    const mid = String(Number(aula.matricula_id));
    const moduloAtual = Number(moduloAtualPorMatricula[mid] || 0);
    const moduloDaAula = Number(aula.modulo_id || 0);

    if (!moduloAtual) return;
    if (moduloDaAula !== moduloAtual) return;
    if (!aulaContaParaCicloDeAvaliacao(aula)) return;

    aulasValidasPorMatricula[mid] = (aulasValidasPorMatricula[mid] || 0) + 1;
  });

  const avaliacoesPorMatricula = {};

  notasDoSistema.forEach((nota) => {
    const mid = String(Number(nota.matricula_id));
    const moduloAtual = Number(moduloAtualPorMatricula[mid] || 0);
    const moduloDaNota = Number(nota.modulo_id || 0);

    if (!moduloAtual) return;
    if (moduloDaNota !== moduloAtual) return;
    if (!ehNotaDeAvaliacao(nota)) return;

    avaliacoesPorMatricula[mid] = (avaliacoesPorMatricula[mid] || 0) + 1;
  });

  const mapaEnvios = {};

  avaliacoesEnviadasDoSistema.forEach((envio) => {
    const chave = chaveAvaliacao({
      matriculaId: envio.matricula_id,
      moduloId: envio.modulo_id,
      numeroAvaliacao: envio.numero_avaliacao
    });

    mapaEnvios[chave] = envio;
  });

  const pendencias = [];
  const auditoria = [];

  idsMatriculas.forEach((matriculaId) => {
    const mid = String(Number(matriculaId));

    const totalAulasValidas = aulasValidasPorMatricula[mid] || 0;
    const totalAvaliacoesLancadas = avaliacoesPorMatricula[mid] || 0;

    const avaliacoesEsperadas = Math.floor(totalAulasValidas / 14);
    const avaliacoesPendentes = Math.max(
      0,
      avaliacoesEsperadas - totalAvaliacoesLancadas
    );

    auditoria.push({
      matriculaId,
      aluno: metaPorMatricula[mid]?.aluno || "Aluno",
      materia: metaPorMatricula[mid]?.materia || "Matéria",
      materiaId: metaPorMatricula[mid]?.materiaId || 0,
      moduloAtual: metaPorMatricula[mid]?.modulo || "Módulo",
      moduloId: metaPorMatricula[mid]?.moduloId || 0,
      aulasValidasModuloAtual: totalAulasValidas,
      avaliacoesLancadasModuloAtual: totalAvaliacoesLancadas,
      avaliacoesEsperadas,
      avaliacoesPendentes,
      apareceNoCard: avaliacoesPendentes > 0 ? "SIM" : "NÃO"
    });

    if (avaliacoesPendentes <= 0) return;

    for (let i = 1; i <= avaliacoesPendentes; i++) {
      const numeroAvaliacao = totalAvaliacoesLancadas + i;
      const meta = metaPorMatricula[mid];

      const chave = chaveAvaliacao({
        matriculaId: meta?.matriculaId,
        moduloId: meta?.moduloId,
        numeroAvaliacao
      });

      const envio = mapaEnvios[chave] || null;

      pendencias.push({
        matriculaId: meta?.matriculaId || null,
        alunoId: meta?.alunoId || null,
        aluno: meta?.aluno || "Aluno",
        materia: meta?.materia || "Matéria",
        materiaId: meta?.materiaId || 0,
        modulo: meta?.modulo || "Módulo",
        moduloId: meta?.moduloId || 0,
        numeroAvaliacao,
        avaliacao: `Progress Check ${numeroAvaliacao}`,
        aulasValidas: totalAulasValidas,
        avaliacoesLancadas: totalAvaliacoesLancadas,
        envio
      });
    }
  });

  console.table(auditoria);
  console.log("Auditoria de avaliações do professor:", auditoria);

  return pendencias;
}

async function buscarFormularioAvaliacao({ materiaId, moduloId, numeroAvaliacao }) {
  if (!materiaId || !moduloId || !numeroAvaliacao) {
    throw new Error("Dados insuficientes para localizar o formulário.");
  }

  const { data, error } = await supabase
    .from("avaliacao_formulario")
    .select("id, titulo, link_formulario")
    .eq("materia_id", materiaId)
    .eq("modulo_id", moduloId)
    .eq("numero_avaliacao", numeroAvaliacao)
    .eq("ativo", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id) {
    throw new Error("Nenhum formulário ativo encontrado para esta avaliação.");
  }

  return data;
}

async function enviarAvaliacaoParaAluno({
  alunoId,
  matriculaId,
  materiaId,
  moduloId,
  numeroAvaliacao
}) {
  if (!alunoId || !matriculaId || !materiaId || !moduloId || !numeroAvaliacao) {
    throw new Error("Dados insuficientes para enviar a avaliação.");
  }

  const formulario = await buscarFormularioAvaliacao({
    materiaId,
    moduloId,
    numeroAvaliacao
  });

  const { data: existente, error: erroExistente } = await supabase
    .from("avaliacao_aluno")
    .select("id, status, enviado_em")
    .eq("matricula_id", matriculaId)
    .eq("modulo_id", moduloId)
    .eq("numero_avaliacao", numeroAvaliacao)
    .maybeSingle();

  if (erroExistente) {
    throw erroExistente;
  }

  if (existente && existente.status !== "Cancelada") {
    return {
      jaExistia: true,
      formulario,
      envio: existente
    };
  }

  if (existente && existente.status === "Cancelada") {
    const { data, error } = await supabase
      .from("avaliacao_aluno")
      .update({
        aluno_id: alunoId,
        matricula_id: matriculaId,
        materia_id: materiaId,
        modulo_id: moduloId,
        avaliacao_formulario_id: formulario.id,
        numero_avaliacao: numeroAvaliacao,
        status: "Pendente",
        enviado_por_professor_id: professorId,
        enviado_em: new Date().toISOString(),
        visualizado: false,
        aluno_confirmou_realizacao_em: null,
        concluida_em: null
      })
      .eq("id", existente.id)
      .select("id, status, enviado_em")
      .single();

    if (error) throw error;

    return {
      jaExistia: false,
      formulario,
      envio: data
    };
  }

  const { data, error } = await supabase
    .from("avaliacao_aluno")
    .insert({
      aluno_id: alunoId,
      matricula_id: matriculaId,
      materia_id: materiaId,
      modulo_id: moduloId,
      avaliacao_formulario_id: formulario.id,
      numero_avaliacao: numeroAvaliacao,
      status: "Pendente",
      enviado_por_professor_id: professorId,
      enviado_em: new Date().toISOString(),
      visualizado: false
    })
    .select("id, status, enviado_em")
    .single();

  if (error) throw error;

  return {
    jaExistia: false,
    formulario,
    envio: data
  };
}

/* =========================================================
   RENDERIZAÇÃO
========================================================= */
function renderAulasPeriodo() {
  if (!textoResumoAulasPeriodo || !textoResumoDuracaoPeriodo) return;

  const totalAulas = aulasFiltradasProfessor.length;

  const totalSegundos = aulasFiltradasProfessor.reduce(
    (acc, aula) => acc + obterSegundosAula(aula),
    0
  );

  textoResumoAulasPeriodo.innerHTML = `
    Foram encontradas <b>${totalAulas}</b> aula(s) em <b>${escapeHtml(textoFiltroSelecionado())}</b> no período selecionado.
  `;

  textoResumoDuracaoPeriodo.innerHTML = `
    Totalizando <b>${escapeHtml(formatarDuracaoPorSegundos(totalSegundos))}</b>.
  `;
}

function renderSelectMatriculas() {
  if (!selectMatricula) return;

  selectMatricula.innerHTML = `<option value="">Selecione o aluno (curso)</option>`;

  const listaOrdenada = [...matriculasFiltradas].sort((a, b) => {
    const nomeA = a?.aluno?.nome || "";
    const nomeB = b?.aluno?.nome || "";
    return nomeA.localeCompare(nomeB);
  });

  listaOrdenada.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = `${m.aluno?.nome || "Aluno"} — ${m.modulo?.materia?.nome || "Matéria"} (${m.modulo?.nome || "Módulo"})`;
    selectMatricula.appendChild(opt);
  });
}

function renderAniversariantesDoDia() {
  if (!listaAniversariantesContainer) return;

  const mapaAlunos = {};

  matriculasFiltradas.forEach((m) => {
    const aluno = m?.aluno;
    if (!aluno?.id) return;

    mapaAlunos[String(aluno.id)] = aluno;
  });

  const aniversariantes = Object.values(mapaAlunos)
    .filter((aluno) => ehAniversarianteHoje(aluno.data_nascimento))
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));

  if (!aniversariantes.length) {
    listaAniversariantesContainer.innerHTML = criarParagrafoVazio(
      "Nenhum aluno vinculado a você faz aniversário hoje."
    );
    return;
  }

  listaAniversariantesContainer.innerHTML = aniversariantes
    .map((aluno) => {
      const idade = calcularIdade(aluno.data_nascimento);

      const textoIdade =
        idade !== null
          ? ` faz ${idade} ano(s) hoje.`
          : " faz aniversário hoje.";

      return `
        <div class="item-avaliacao-resumo">
          <strong>🎂 ${escapeHtml(aluno.nome)}${escapeHtml(textoIdade)}</strong>
          <p>Dê os parabéns! 🎉</p>
        </div>
      `;
    })
    .join("");
}

function renderVisaoGeralUnificada() {
  if (!cardVisaoGeralProfessor) return;

  if (!materiasProfessor.length) {
    cardVisaoGeralProfessor.innerHTML = criarParagrafoVazio(
      "Este professor ainda não está vinculado a nenhuma matéria."
    );
    return;
  }

  const alunosUnicos = new Set(
    matriculasFiltradas
      .map((m) => m?.aluno?.id)
      .filter(Boolean)
  );

  const materiasOrdenadas = [...materiasProfessor].sort((a, b) =>
    a.nome.localeCompare(b.nome)
  );

  const materiasNomes = materiasOrdenadas.map((m) => escapeHtml(m.nome)).join(" • ");

  const htmlCursos = materiasOrdenadas.map((materia) => {
    const matriculasDaMateria = matriculasFiltradas.filter(
      (m) => Number(m?.modulo?.materia?.id || 0) === Number(materia.id)
    );

    const alunosDaMateria = new Set(
      matriculasDaMateria
        .map((m) => m?.aluno?.id)
        .filter(Boolean)
    );

    const mapaModulos = {};

    matriculasDaMateria.forEach((m) => {
      const nomeModulo = m?.modulo?.nome || "Módulo sem nome";
      const alunoId = m?.aluno?.id;

      if (!mapaModulos[nomeModulo]) {
        mapaModulos[nomeModulo] = new Set();
      }

      if (alunoId) {
        mapaModulos[nomeModulo].add(alunoId);
      }
    });

    const nomesModulos = Object.keys(mapaModulos).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" })
    );

    const modulosHtml = nomesModulos.length
      ? nomesModulos
          .map((nomeModulo) => {
            const total = mapaModulos[nomeModulo].size;

            return `
              <span class="item-modulo-inline">
                <b>${escapeHtml(nomeModulo)}</b>: ${total}
              </span>
            `;
          })
          .join('<span class="separador-modulo-professor">|</span>')
      : `<span class="texto-vazio-modulo">Nenhum aluno nesta matéria.</span>`;

    return `
      <div class="bloco-curso-unificado">
        <div class="linha-curso-unificado">
          <span class="nome-curso-unificado">📘 ${escapeHtml(materia.nome)}</span>
          <span class="quantidade-curso-unificado">
            ${alunosDaMateria.size} aluno(s)
          </span>
        </div>

        <div class="linha-modulos-unificado">
          <span class="rotulo-modulos-unificado">Módulos:</span>
          <div class="conteudo-modulos-unificado">
            ${modulosHtml}
          </div>
        </div>
      </div>
    `;
  }).join("");

  cardVisaoGeralProfessor.innerHTML = `
    <div class="topo-visao-geral-unificada">
      <div class="resumo-topo-unificado">
        <span class="rotulo-topo-unificado">Matérias</span>
        <strong>${materiasNomes}</strong>
      </div>

      <div class="resumo-topo-unificado">
        <span class="rotulo-topo-unificado">Total de alunos</span>
        <strong>${alunosUnicos.size}</strong>
      </div>
    </div>

    <div class="lista-cursos-unificada">
      ${htmlCursos}
    </div>
  `;
}

function textoStatusEnvioAvaliacao(envio) {
  if (!envio) return "";

  if (envio.status === "Pendente") {
    return `Avaliação enviada em ${formatarDataHoraBR(envio.enviado_em)}. Aguardando realização pelo aluno.`;
  }

  if (envio.status === "Realizada pelo aluno") {
    return `O aluno informou que realizou em ${formatarDataHoraBR(envio.aluno_confirmou_realizacao_em)}. Aguardando correção/lançamento de nota.`;
  }

  if (envio.status === "Concluída") {
    return "Avaliação concluída.";
  }

  if (envio.status === "Cancelada") {
    return "Avaliação cancelada.";
  }

  return `Status: ${envio.status}`;
}

function htmlItemAvaliacao(item) {
  const envio = item.envio || null;
  const jaEnviada = envio && envio.status !== "Cancelada";

  let textoBotao = "Enviar avaliação";

  if (envio?.status === "Pendente") {
    textoBotao = "Já enviada";
  }

  if (envio?.status === "Realizada pelo aluno") {
    textoBotao = "Aluno informou realização";
  }

  if (envio?.status === "Concluída") {
    textoBotao = "Concluída";
  }

  const textoStatus = textoStatusEnvioAvaliacao(envio);

  return `
    <div class="item-avaliacao-resumo">
      <div class="item-avaliacao-topo">
        <div class="item-avaliacao-info">
          <strong>${escapeHtml(item.aluno)} — ${escapeHtml(item.avaliacao)}</strong>
          <p>${escapeHtml(item.materia)} • ${escapeHtml(item.modulo)}</p>
          <p>
            ${item.aulasValidas} aula(s) válidas no módulo atual •
            ${item.avaliacoesLancadas} avaliação(ões) lançada(s) neste módulo
          </p>
          ${
            textoStatus
              ? `<p><b>Status:</b> ${escapeHtml(textoStatus)}</p>`
              : ""
          }
        </div>

        <div class="item-avaliacao-acoes">
          <button
            type="button"
            class="btn btn-neutro btn-enviar-avaliacao"
            data-aluno-id="${item.alunoId || ""}"
            data-matricula-id="${item.matriculaId || ""}"
            data-materia-id="${item.materiaId || ""}"
            data-modulo-id="${item.moduloId || ""}"
            data-numero-avaliacao="${item.numeroAvaliacao || ""}"
            data-avaliacao="${escapeHtml(item.avaliacao)}"
            ${jaEnviada ? "disabled" : ""}
          >
            ${escapeHtml(textoBotao)}
          </button>
        </div>
      </div>
    </div>
  `;
}

function vincularBotoesEnviarAvaliacao() {
  document.querySelectorAll(".btn-enviar-avaliacao").forEach((btn) => {
    if (btn.disabled) return;

    btn.addEventListener("click", async () => {
      const alunoId = Number(btn.dataset.alunoId || 0);
      const matriculaId = Number(btn.dataset.matriculaId || 0);
      const materiaId = Number(btn.dataset.materiaId || 0);
      const moduloId = Number(btn.dataset.moduloId || 0);
      const numeroAvaliacao = Number(btn.dataset.numeroAvaliacao || 0);

      const textoOriginal = btn.textContent;

      btn.disabled = true;
      btn.textContent = "Enviando...";

      try {
        const resultado = await enviarAvaliacaoParaAluno({
          alunoId,
          matriculaId,
          materiaId,
          moduloId,
          numeroAvaliacao
        });

        if (resultado.jaExistia) {
          btn.textContent = "Já enviada";
          mostrarMensagem("Esta avaliação já tinha sido enviada para o aluno.");
          mostrarMensagemLocal(
            btn,
            "Esta avaliação já tinha sido enviada para o aluno."
          );
        } else {
          btn.textContent = "Já enviada";
          mostrarMensagem("Avaliação enviada!");
          mostrarMensagemLocal(btn, "Avaliação enviada!");
        }

        await carregarAvaliacoesEnviadasSistema();

        const pendencias = await carregarPendenciasAvaliacaoPorMatricula();
        renderAvaliacoes(pendencias);
      } catch (error) {
        console.error("Erro ao enviar avaliação:", error);

        btn.disabled = false;
        btn.textContent = textoOriginal;

        mostrarMensagem(
          "Não foi possível enviar a avaliação. Confira se o formulário está cadastrado no Supabase.",
          false
        );

        mostrarMensagemLocal(
          btn,
          "Não foi possível enviar a avaliação. Confira se o formulário está cadastrado no Supabase.",
          false
        );
      }
    });
  });
}

function renderAvaliacoes(pendencias) {
  if (!listaAvaliacoesContainer || !btnToggleAvaliacoes) return;

  avaliacoesPendentesAtuais = [...pendencias];

  if (!avaliacoesPendentesAtuais.length) {
    listaAvaliacoesContainer.innerHTML = criarParagrafoVazio(
      "Nenhuma avaliação pendente no momento."
    );
    btnToggleAvaliacoes.style.display = "none";
    return;
  }

  avaliacoesPendentesAtuais.sort((a, b) => {
    if (a.materia !== b.materia) return a.materia.localeCompare(b.materia);
    if (a.modulo !== b.modulo) return a.modulo.localeCompare(b.modulo);
    return a.aluno.localeCompare(b.aluno);
  });

  const limite = avaliacoesExpandidas ? avaliacoesPendentesAtuais.length : 2;
  const visiveis = avaliacoesPendentesAtuais.slice(0, limite);

  listaAvaliacoesContainer.innerHTML = visiveis.map(htmlItemAvaliacao).join("");
  vincularBotoesEnviarAvaliacao();

  if (avaliacoesPendentesAtuais.length > 2) {
    btnToggleAvaliacoes.style.display = "inline-block";
    btnToggleAvaliacoes.textContent = avaliacoesExpandidas ? "Ver menos" : "Ver mais";
  } else {
    btnToggleAvaliacoes.style.display = "none";
  }
}

function renderListaAulasPeriodo() {
  if (!listaAulasPeriodoContainer || !btnToggleAulasPeriodo || !btnExpandirAulasPeriodo) {
    return;
  }

  if (!aulasFiltradasProfessor.length) {
    listaAulasPeriodoContainer.innerHTML = criarParagrafoVazio(
      "Nenhuma aula encontrada para o filtro selecionado."
    );
    btnToggleAulasPeriodo.style.display = "none";
    btnExpandirAulasPeriodo.style.display = "none";
    listaAulasPeriodoContainer.style.display = "none";
    return;
  }

  btnToggleAulasPeriodo.style.display = "inline-block";
  btnToggleAulasPeriodo.textContent = aulasPeriodoAberta ? "Ocultar aulas" : "Ver aulas";

  if (!aulasPeriodoAberta) {
    listaAulasPeriodoContainer.style.display = "none";
    btnExpandirAulasPeriodo.style.display = "none";
    return;
  }

  const aulasOrdenadas = [...aulasFiltradasProfessor].sort(ordenarAulasPorDataDesc);

  const limite = aulasPeriodoExpandida ? aulasOrdenadas.length : 5;
  const visiveis = aulasOrdenadas.slice(0, limite);

  listaAulasPeriodoContainer.style.display = "block";

  const html = visiveis
    .map((aula) => {
      const infoReposicao = textoReposicaoAulaOriginal(aula);
      const conteudo = aula.conteudo || "-";
      const licao = aula.licao_casa || "";
      const materiaModulo = aula.materia_modulo_resumo || "";
      const tipo = textoTipoAulaResumo(aula);
      const status = textoStatusResumoGrupo(aula);

      return `
        <div
          class="item-aula-periodo"
          style="
            display:grid;
            grid-template-columns: 110px 1fr 85px;
            gap:10px;
            align-items:center;
            padding:9px 12px;
            margin-bottom:8px;
            border:1px solid #f1d98a;
            border-radius:12px;
            background:#fffdf8;
            font-size:13px;
          "
        >
          <div>
            <div style="font-weight:700;">${formatarDataBR(aula.data_aula)}</div>
            <div style="font-size:12px; opacity:.75;">${escapeHtml(tipo)}</div>
          </div>

          <div style="min-width:0;">
            <div style="
              display:flex;
              flex-wrap:wrap;
              gap:6px;
              margin-bottom:5px;
            ">
              ${htmlParticipantesResumo(aula)}
            </div>

            <div style="font-size:12px; opacity:.9;">
              <b>Status:</b> ${escapeHtml(status)}
              ${
                materiaModulo
                  ? ` | <b>${escapeHtml(materiaModulo)}</b>`
                  : ""
              }
              ${
                aula.parte
                  ? ` | Parte ${Number(aula.parte || 1)}`
                  : ""
              }
              ${
                aula.aula_coletiva_resumo
                  ? ` | ${Number(aula.quantidade_alunos_resumo || aula.participantes_resumo?.length || 0)} aluno(s)`
                  : ""
              }
              ${
                infoReposicao
                  ? ` | ${escapeHtml(infoReposicao)}`
                  : ""
              }
            </div>

            <div style="
              font-size:12px;
              opacity:.85;
              margin-top:3px;
              white-space:nowrap;
              overflow:hidden;
              text-overflow:ellipsis;
            ">
              <b>Conteúdo:</b> ${escapeHtml(conteudo)}
              ${licao ? ` | <b>Lição:</b> ${escapeHtml(licao)}` : ""}
            </div>
          </div>

          <div style="text-align:right; font-weight:700;">
            ${escapeHtml(textoDuracaoAulaProfessor(aula))}
          </div>
        </div>
      `;
    })
    .join("");

  listaAulasPeriodoContainer.innerHTML = html;

  if (aulasOrdenadas.length > 5) {
    btnExpandirAulasPeriodo.style.display = "inline-block";
    btnExpandirAulasPeriodo.textContent = aulasPeriodoExpandida ? "Ver menos" : "Ver mais";
  } else {
    btnExpandirAulasPeriodo.style.display = "none";
  }
}

/* =========================================================
   MONTAGEM
========================================================= */
async function montarResumo() {
  try {
    if (!professorId) {
      mostrarMensagem("Professor não identificado. Faça login novamente.", false);
      return;
    }

    await carregarProfessor();
    await carregarMateriasProfessor();

    if (!materiaIdsProfessor.length) {
      if (textoResumoAulasPeriodo) {
        textoResumoAulasPeriodo.innerHTML = `
          Foram encontradas <b>0</b> aula(s) em <b>todas</b> no período selecionado.
        `;
      }

      if (textoResumoDuracaoPeriodo) {
        textoResumoDuracaoPeriodo.innerHTML = `
          Totalizando <b>0 minuto(s) registrados</b>.
        `;
      }

      if (listaAvaliacoesContainer) {
        listaAvaliacoesContainer.innerHTML = criarParagrafoVazio("Sem dados para exibir.");
      }

      if (listaAniversariantesContainer) {
        listaAniversariantesContainer.innerHTML = criarParagrafoVazio("Sem dados para exibir.");
      }

      if (cardVisaoGeralProfessor) {
        cardVisaoGeralProfessor.innerHTML = `<p style="font-size:14px;">Sem matérias vinculadas.</p>`;
      }

      if (selectMatricula) {
        selectMatricula.innerHTML = `<option value="">Nenhum aluno disponível</option>`;
      }

      if (listaAulasPeriodoContainer) {
        listaAulasPeriodoContainer.innerHTML = "";
      }

      if (btnToggleAulasPeriodo) {
        btnToggleAulasPeriodo.style.display = "none";
      }

      if (btnExpandirAulasPeriodo) {
        btnExpandirAulasPeriodo.style.display = "none";
      }

      return;
    }

    await carregarMatriculasRelacionadas();
    await carregarAulasProfessorPorPeriodo();
    await carregarNotasSistema();
    await carregarAvaliacoesEnviadasSistema();

    renderAulasPeriodo();
    renderSelectMatriculas();
    renderAniversariantesDoDia();
    renderVisaoGeralUnificada();
    renderListaAulasPeriodo();

    const pendencias = await carregarPendenciasAvaliacaoPorMatricula();
    renderAvaliacoes(pendencias);

  } catch (error) {
    console.error("Erro ao montar resumo do professor:", error);
    mostrarMensagem(
      "Erro ao carregar resumo. Confira se os relacionamentos e nomes das colunas estão corretos.",
      false
    );
  }
}

/* =========================================================
   EVENTOS
========================================================= */
btnAplicarFiltro?.addEventListener("click", async () => {
  aulasPeriodoAberta = false;
  aulasPeriodoExpandida = false;
  await montarResumo();
});

btnLimparFiltro?.addEventListener("click", async () => {
  await preencherFiltroInicial();
  await montarResumo();
});

btnDetalhes?.addEventListener("click", () => {
  const matriculaIdSelecionada = selectMatricula?.value;

  if (!matriculaIdSelecionada) {
    mostrarMensagem("Selecione o aluno (curso).", false);
    return;
  }

  localStorage.setItem("matriculaSelecionada", matriculaIdSelecionada);
  window.location.href = "detalhes-aluno.html";
});

btnToggleAvaliacoes?.addEventListener("click", () => {
  avaliacoesExpandidas = !avaliacoesExpandidas;
  renderAvaliacoes(avaliacoesPendentesAtuais);
});

btnToggleAulasPeriodo?.addEventListener("click", () => {
  aulasPeriodoAberta = !aulasPeriodoAberta;
  renderListaAulasPeriodo();
});

btnExpandirAulasPeriodo?.addEventListener("click", () => {
  aulasPeriodoExpandida = !aulasPeriodoExpandida;
  renderListaAulasPeriodo();
});

/* =========================================================
   INÍCIO
========================================================= */
await preencherFiltroInicial();
await montarResumo();