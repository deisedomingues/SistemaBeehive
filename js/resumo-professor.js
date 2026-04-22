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

const listaMateriasProfessor = document.getElementById("listaMateriasProfessor");
const qtdTotalAlunos = document.getElementById("qtdTotalAlunos");
const qtdAulasPeriodo = document.getElementById("qtdAulasPeriodo");

const listaAvaliacoesContainer = document.getElementById("listaAvaliacoesContainer");

const selectMatricula = document.getElementById("selectMatricula");
const btnDetalhes = document.getElementById("btnDetalhes");

const cardsAlunosPorMateria = document.getElementById("cardsAlunosPorMateria");
const cardsModulosPorMateria = document.getElementById("cardsModulosPorMateria");

const cAulasPresente = document.getElementById("cAulasPresente");
const cAulasAusente = document.getElementById("cAulasAusente");
const cAulasReposicao = document.getElementById("cAulasReposicao");
const cAulasInstrumental = document.getElementById("cAulasInstrumental");
const cAulasPlantao = document.getElementById("cAulasPlantao");

/* =========================================================
   ESTADO
========================================================= */
let professorNome = "";
let materiasProfessor = [];
let materiaIdsProfessor = [];
let matriculasFiltradas = [];
let aulasFiltradasProfessor = [];
let notasDoSistema = [];

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
}

function criarParagrafoVazio(texto) {
  return `<p style="font-size:14px;">${texto}</p>`;
}

function normalizarTexto(valor) {
  return String(valor || "").trim().toLowerCase();
}

function escapeHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
  if ((status === "reposição" || status === "reposicao") && gravada) return true;
  if (status === "ausente" && gravada) return true;

  return false;
}

function statusContaComoAulaNoPeriodo(aula) {
  const status = normalizarTexto(aula?.status);

  return [
    "presente",
    "ausente",
    "reposição",
    "reposicao",
    "aula instrumental",
    "plantão de dúvidas",
    "plantao de duvidas"
  ].includes(status);
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

async function carregarAulasProfessorPorPeriodo() {
  const inicio = dataInicio.value || null;
  const fim = dataFim.value || null;
  const statusSelecionado = filtroStatusPeriodo?.value || "";

  let query = supabase
    .from("aula")
    .select(`
      id,
      data_aula,
      status,
      aula_gravada,
      matricula_id,
      modulo_id,
      professor_id
    `)
    .eq("professor_id", professorId);

  if (inicio) query = query.gte("data_aula", inicio);
  if (fim) query = query.lte("data_aula", fim);

  const { data, error } = await query;

  if (error) throw error;

  const matriculaIdsPermitidas = new Set(matriculasFiltradas.map((m) => m.id));

  let filtradas = (data || []).filter((aula) =>
    matriculaIdsPermitidas.has(aula.matricula_id)
  );

  filtradas = filtradas.filter((aula) => statusContaComoAulaNoPeriodo(aula));

  if (statusSelecionado) {
    filtradas = filtradas.filter(
      (aula) => normalizarTexto(aula.status) === normalizarTexto(statusSelecionado)
    );
  }

  aulasFiltradasProfessor = filtradas;
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

/**
 * Esta função foi feita para bater com a tela detalhes-aluno:
 * - olha a matrícula
 * - olha o módulo atual da matrícula
 * - conta aulas válidas daquele módulo
 * - compara com as avaliações lançadas daquele mesmo módulo
 */
async function carregarPendenciasAvaliacaoPorMatricula() {
  const idsMatriculas = matriculasFiltradas.map((m) => m.id);
  if (!idsMatriculas.length) return [];

  const moduloAtualPorMatricula = {};
  const metaPorMatricula = {};

  matriculasFiltradas.forEach((m) => {
    const mid = String(m.id);
    moduloAtualPorMatricula[mid] = Number(m.modulo_id || 0);
    metaPorMatricula[mid] = {
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
function renderMateriasProfessor() {
  if (!materiasProfessor.length) {
    listaMateriasProfessor.innerHTML = criarParagrafoVazio(
      "Este professor ainda não está vinculado a nenhuma matéria."
    );
    return;
  }

  const html = materiasProfessor
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map((materia) => `<p>• <b>${escapeHtml(materia.nome)}</b></p>`)
    .join("");

  listaMateriasProfessor.innerHTML = html;
}

function renderTotalAlunos() {
  const alunosUnicos = new Set(
    matriculasFiltradas
      .map((m) => m?.aluno?.id)
      .filter(Boolean)
  );

  qtdTotalAlunos.textContent = String(alunosUnicos.size);
}

function renderAulasPeriodo() {
  qtdAulasPeriodo.textContent = String(aulasFiltradasProfessor.length);
}

function renderCardsStatusAulasPeriodo() {
  let presente = 0;
  let ausente = 0;
  let reposicao = 0;
  let instrumental = 0;
  let plantao = 0;

  aulasFiltradasProfessor.forEach((aula) => {
    const status = normalizarTexto(aula.status);

    if (status === "presente") presente++;
    else if (status === "ausente") ausente++;
    else if (status === "reposição" || status === "reposicao") reposicao++;
    else if (status === "aula instrumental") instrumental++;
    else if (status === "plantão de dúvidas" || status === "plantao de duvidas") plantao++;
  });

  cAulasPresente.textContent = String(presente);
  cAulasAusente.textContent = String(ausente);
  cAulasReposicao.textContent = String(reposicao);
  cAulasInstrumental.textContent = String(instrumental);
  cAulasPlantao.textContent = String(plantao);
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

function renderCardsAlunosPorMateria() {
  if (!materiasProfessor.length) {
    cardsAlunosPorMateria.innerHTML = `<div class="card">${criarParagrafoVazio("Nenhuma matéria encontrada.")}</div>`;
    return;
  }

  const html = materiasProfessor
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map((materia) => {
      const alunos = new Set();

      matriculasFiltradas.forEach((m) => {
        if (m?.modulo?.materia?.id === materia.id && m?.aluno?.id) {
          alunos.add(m.aluno.id);
        }
      });

      return `
        <div class="card">
          <h2>${escapeHtml(materia.nome)}</h2>
          <p><b>${alunos.size}</b> aluno(s)</p>
        </div>
      `;
    })
    .join("");

  cardsAlunosPorMateria.innerHTML = html;
}

function renderCardsModulosPorMateria() {
  if (!materiasProfessor.length) {
    cardsModulosPorMateria.innerHTML = `<div class="card">${criarParagrafoVazio("Nenhuma matéria encontrada.")}</div>`;
    return;
  }

  const html = materiasProfessor
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map((materia) => {
      const mapaModulos = {};

      matriculasFiltradas.forEach((m) => {
        if (m?.modulo?.materia?.id !== materia.id) return;

        const nomeModulo = m?.modulo?.nome || "Módulo sem nome";
        const alunoId = m?.aluno?.id;

        if (!mapaModulos[nomeModulo]) mapaModulos[nomeModulo] = new Set();
        if (alunoId) mapaModulos[nomeModulo].add(alunoId);
      });

      const nomesModulos = Object.keys(mapaModulos).sort((a, b) => a.localeCompare(b));

      return `
        <div class="card">
          <h2>${escapeHtml(materia.nome)}</h2>
          ${
            nomesModulos.length
              ? `<ul class="lista-simples-resumo">
                  ${nomesModulos
                    .map((nomeModulo) => `<li>${escapeHtml(nomeModulo)}: ${mapaModulos[nomeModulo].size}</li>`)
                    .join("")}
                 </ul>`
              : `<p>Nenhum aluno cadastrado nesta matéria.</p>`
          }
        </div>
      `;
    })
    .join("");

  cardsModulosPorMateria.innerHTML = html;
}

function renderAvaliacoes(pendencias) {
  if (!pendencias.length) {
    listaAvaliacoesContainer.innerHTML = criarParagrafoVazio(
      "Nenhuma avaliação pendente no momento."
    );
    return;
  }

  pendencias.sort((a, b) => {
    if (a.materia !== b.materia) return a.materia.localeCompare(b.materia);
    if (a.modulo !== b.modulo) return a.modulo.localeCompare(b.modulo);
    return a.aluno.localeCompare(b.aluno);
  });

  listaAvaliacoesContainer.innerHTML = pendencias
    .map((item) => `
      <div class="item-avaliacao-resumo">
        <strong>${escapeHtml(item.aluno)} — ${escapeHtml(item.avaliacao)}</strong>
        <p>${escapeHtml(item.materia)} • ${escapeHtml(item.modulo)}</p>
        <p>${item.aulasValidas} aula(s) válidas no módulo atual • ${item.avaliacoesLancadas} avaliação(ões) lançada(s)</p>
      </div>
    `)
    .join("");
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

    renderMateriasProfessor();

    if (!materiaIdsProfessor.length) {
      qtdTotalAlunos.textContent = "0";
      qtdAulasPeriodo.textContent = "0";
      cAulasPresente.textContent = "0";
      cAulasAusente.textContent = "0";
      cAulasReposicao.textContent = "0";
      cAulasInstrumental.textContent = "0";
      cAulasPlantao.textContent = "0";
      listaAvaliacoesContainer.innerHTML = criarParagrafoVazio("Sem dados para exibir.");
      cardsAlunosPorMateria.innerHTML = `<div class="card"><p>Sem matérias vinculadas.</p></div>`;
      cardsModulosPorMateria.innerHTML = `<div class="card"><p>Sem matérias vinculadas.</p></div>`;
      selectMatricula.innerHTML = `<option value="">Nenhum aluno disponível</option>`;
      return;
    }

    await carregarMatriculasRelacionadas();
    await carregarAulasProfessorPorPeriodo();
    await carregarNotasSistema();

    renderTotalAlunos();
    renderAulasPeriodo();
    renderCardsStatusAulasPeriodo();
    renderSelectMatriculas();
    renderCardsAlunosPorMateria();
    renderCardsModulosPorMateria();

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

/* =========================================================
   INÍCIO
========================================================= */
await preencherFiltroInicial();
await montarResumo();