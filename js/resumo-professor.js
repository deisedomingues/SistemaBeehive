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
let avaliacoesPendentesAtuais = [];

let avaliacoesExpandidas = false;
let aulasPeriodoAberta = false;
let aulasPeriodoExpandida = false;

/* =========================================================
   UTILITÁRIOS
========================================================= */
function mostrarMensagem(texto, ok = true) {
  msg.textContent = texto;
  msg.style.display = "block";
  msg.className = ok ? "msg-resumo-professor ok" : "msg-resumo-professor erro";

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
    msg.className = "msg-resumo-professor";
  }, 2500);
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

  dataInicio.value = primeiraAula || hoje;
  dataFim.value = hoje;

  if (filtroStatusPeriodo) {
    filtroStatusPeriodo.value = "";
  }

  aulasPeriodoAberta = false;
  aulasPeriodoExpandida = false;
}

function criarParagrafoVazio(texto) {
  return `<p style="font-size:14px;">${texto}</p>`;
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

  const [ano, mes, dia] = String(dataISO).split("-");
  return `${dia}/${mes}/${ano}`;
}

function ehNotaDeAvaliacao(nota) {
  const tipo = normalizarTexto(
    nota?.tipo ?? nota?.tipo_avaliacao ?? nota?.avaliacao ?? ""
  );

  return tipo.includes("avalia");
}

function aulaContaParaCicloDeAvaliacao(aula) {
  const status = normalizarTexto(aula?.status);
  const gravada = aula?.aula_gravada === true;

  if (status === "presente" && gravada) return true;
  if (status === "reposicao" && gravada) return true;
  if (status === "ausente" && gravada) return true;

  return false;
}

function aulaValidaParaProfessor(aula) {
  const status = normalizarTexto(aula?.status);
  const gravada = aula?.aula_gravada === true;

  if (status === "presente") return true;
  if (status === "ausente" && gravada) return true;
  if (status === "reposicao") return true;
  if (status === "aula instrumental") return true;
  if (status === "plantao de duvidas") return true;

  return false;
}

function statusContaComoAulaPedagogicaNoPeriodo(aula) {
  const status = normalizarTexto(aula?.status);

  return [
    "presente",
    "ausente",
    "reposicao",
    "aula instrumental",
    "plantao de duvidas"
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

  if (normalizarTexto(aula?.status) !== "reposicao") return "";

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

  return Number(b?.id || 0) - Number(a?.id || 0);
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
  tituloResumoProfessor.textContent = `Olá, ${professorNome}!`;
  subtituloResumoProfessor.textContent =
    "Acompanhe seus alunos, aulas e notificações importantes.";
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

  materiaIdsProfessor = materiasProfessor.map((m) => m.id);
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
      )
    `)
    .eq("professor_id", professorId)
    .eq("ativa", true);

  if (error) throw error;

  matriculasFiltradas = (data || []).filter((m) => {
    const materiaId = m?.modulo?.materia_id;
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

async function buscarAulasComDuracao() {
  const inicio = dataInicio.value || null;
  const fim = dataFim.value || null;

  let query = supabase
    .from("aula")
    .select(`
      id,
      data_aula,
      status,
      aula_gravada,
      precisa_reposicao,
      matricula_id,
      modulo_id,
      professor_id,
      aula_original_id,
      duracao_segundos,
      matricula:matricula_id (
        id,
        aluno:aluno_id (
          id,
          nome
        )
      )
    `)
    .eq("professor_id", professorId);

  if (inicio) query = query.gte("data_aula", inicio);
  if (fim) query = query.lte("data_aula", fim);

  return await query;
}

async function carregarAulasProfessorPorPeriodo() {
  const statusSelecionado = filtroStatusPeriodo?.value || "";

  const { data, error } = await buscarAulasComDuracao();

  if (error) throw error;

  const matriculaIdsPermitidas = new Set(matriculasFiltradas.map((m) => m.id));

  let filtradas = (data || []).filter((aula) =>
    matriculaIdsPermitidas.has(aula.matricula_id)
  );

  filtradas = filtradas.filter((aula) => statusContaComoAulaPedagogicaNoPeriodo(aula));

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

  aulasFiltradasProfessor = filtradas.map((aula) => ({
    ...aula,
    aula_original: aula.aula_original_id
      ? mapaOriginais[String(aula.aula_original_id)] || null
      : null
  }));
}

async function carregarNotasSistema() {
  const idsMatriculas = matriculasFiltradas.map((m) => m.id);

  if (!idsMatriculas.length) {
    notasDoSistema = [];
    return;
  }

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
    .in("matricula_id", idsMatriculas);

  if (error) {
    console.warn("Não foi possível carregar notas:", error.message);
    notasDoSistema = [];
    return;
  }

  notasDoSistema = data || [];
}

async function carregarPendenciasAvaliacaoPorMatricula() {
  const idsMatriculas = matriculasFiltradas.map((m) => m.id);
  if (!idsMatriculas.length) return [];

  const moduloAtualPorMatricula = {};
  const metaPorMatricula = {};

  matriculasFiltradas.forEach((m) => {
    const mid = String(m.id);

    moduloAtualPorMatricula[mid] = Number(m.modulo_id || 0);

    metaPorMatricula[mid] = {
      matriculaId: m.id,
      aluno: m?.aluno?.nome || "Aluno",
      materia: m?.modulo?.materia?.nome || "Matéria",
      modulo: m?.modulo?.nome || "Módulo"
    };
  });

  const { data: aulas, error: errorAulas } = await supabase
    .from("aula")
    .select(`
      id,
      matricula_id,
      modulo_id,
      status,
      aula_gravada
    `)
    .in("matricula_id", idsMatriculas);

  if (errorAulas) throw errorAulas;

  const aulasValidasPorMatricula = {};

  (aulas || []).forEach((aula) => {
    const mid = String(aula.matricula_id);
    const moduloAtual = Number(moduloAtualPorMatricula[mid] || 0);
    const moduloDaAula = Number(aula.modulo_id || 0);

    if (!moduloAtual || moduloDaAula !== moduloAtual) return;
    if (!aulaContaParaCicloDeAvaliacao(aula)) return;

    aulasValidasPorMatricula[mid] = (aulasValidasPorMatricula[mid] || 0) + 1;
  });

  const avaliacoesPorMatricula = {};

  notasDoSistema.forEach((nota) => {
    const mid = String(nota.matricula_id);
    const moduloAtual = Number(moduloAtualPorMatricula[mid] || 0);
    const moduloDaNota = Number(nota.modulo_id || 0);

    if (!moduloAtual || moduloDaNota !== moduloAtual) return;
    if (!ehNotaDeAvaliacao(nota)) return;

    avaliacoesPorMatricula[mid] = (avaliacoesPorMatricula[mid] || 0) + 1;
  });

  const pendencias = [];

  idsMatriculas.forEach((matriculaId) => {
    const mid = String(matriculaId);
    const totalAulasValidas = aulasValidasPorMatricula[mid] || 0;
    const totalAvaliacoesLancadas = avaliacoesPorMatricula[mid] || 0;

    const avaliacoesEsperadas = Math.floor(totalAulasValidas / 14);
    const avaliacoesPendentes = Math.max(0, avaliacoesEsperadas - totalAvaliacoesLancadas);

    if (avaliacoesPendentes <= 0) return;

    for (let i = 1; i <= avaliacoesPendentes; i++) {
      pendencias.push({
        matriculaId: metaPorMatricula[mid]?.matriculaId || null,
        aluno: metaPorMatricula[mid]?.aluno || "Aluno",
        materia: metaPorMatricula[mid]?.materia || "Matéria",
        modulo: metaPorMatricula[mid]?.modulo || "Módulo",
        avaliacao: `Avaliação ${totalAvaliacoesLancadas + i}`,
        aulasValidas: totalAulasValidas,
        avaliacoesLancadas: totalAvaliacoesLancadas
      });
    }
  });

  return pendencias;
}

/* =========================================================
   RENDERIZAÇÃO
========================================================= */
function renderAulasPeriodo() {
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
      (m) => m?.modulo?.materia?.id === materia.id
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

function htmlItemAvaliacao(item) {
  return `
    <div class="item-avaliacao-resumo">
      <div class="item-avaliacao-topo">
        <div class="item-avaliacao-info">
          <strong>${escapeHtml(item.aluno)} — ${escapeHtml(item.avaliacao)}</strong>
          <p>${escapeHtml(item.materia)} • ${escapeHtml(item.modulo)}</p>
          <p>
            ${item.aulasValidas} aula(s) válidas no módulo atual •
            ${item.avaliacoesLancadas} avaliação(ões) lançada(s)
          </p>
        </div>

        <div class="item-avaliacao-acoes">
          <button
            type="button"
            class="btn btn-neutro btn-enviar-avaliacao"
            data-matricula-id="${item.matriculaId || ""}"
            data-avaliacao="${escapeHtml(item.avaliacao)}"
          >
            Enviar avaliação
          </button>
        </div>
      </div>
    </div>
  `;
}

function vincularBotoesEnviarAvaliacao() {
  document.querySelectorAll(".btn-enviar-avaliacao").forEach((btn) => {
    btn.addEventListener("click", () => {
      mostrarMensagemLocal(
        btn,
        "Funcionalidade de envio de avaliação será implementada em breve."
      );
    });
  });
}

function renderAvaliacoes(pendencias) {
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

      return `
        <div class="item-aula-periodo item-aula-periodo-linha">
          <span class="col-aula col-aula-data">${formatarDataBR(aula.data_aula)}</span>
          <span class="col-aula col-aula-aluno">${escapeHtml(nomeAlunoDaAula(aula))}</span>
          <span class="col-aula col-aula-status">${escapeHtml(textoStatusAulaProfessor(aula))}</span>
          <span class="col-aula col-aula-reposicao">${escapeHtml(infoReposicao || "-")}</span>
          <span class="col-aula col-aula-duracao">${escapeHtml(textoDuracaoAulaProfessor(aula))}</span>
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
      textoResumoAulasPeriodo.innerHTML = `
        Foram encontradas <b>0</b> aula(s) em <b>todas</b> no período selecionado.
      `;

      textoResumoDuracaoPeriodo.innerHTML = `
        Totalizando <b>0 minuto(s) registrados</b>.
      `;

      listaAvaliacoesContainer.innerHTML = criarParagrafoVazio("Sem dados para exibir.");
      cardVisaoGeralProfessor.innerHTML = `<p style="font-size:14px;">Sem matérias vinculadas.</p>`;
      selectMatricula.innerHTML = `<option value="">Nenhum aluno disponível</option>`;
      listaAulasPeriodoContainer.innerHTML = "";
      btnToggleAulasPeriodo.style.display = "none";
      btnExpandirAulasPeriodo.style.display = "none";
      return;
    }

    await carregarMatriculasRelacionadas();
    await carregarAulasProfessorPorPeriodo();
    await carregarNotasSistema();

    renderAulasPeriodo();
    renderSelectMatriculas();
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
  const matriculaIdSelecionada = selectMatricula.value;

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