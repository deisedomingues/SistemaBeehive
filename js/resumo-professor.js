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

const listaMateriasProfessor = document.getElementById("listaMateriasProfessor");
const qtdTotalAlunos = document.getElementById("qtdTotalAlunos");
const qtdAulasPeriodo = document.getElementById("qtdAulasPeriodo");

const listaAvaliacoesContainer = document.getElementById("listaAvaliacoesContainer");

const selectMatricula = document.getElementById("selectMatricula");
const btnDetalhes = document.getElementById("btnDetalhes");

const cardsAlunosPorMateria = document.getElementById("cardsAlunosPorMateria");
const cardsModulosPorMateria = document.getElementById("cardsModulosPorMateria");

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
}

function statusContaComoAula(status) {
  return String(status || "").trim().toLowerCase() === "presente";
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

  let query = supabase
    .from("aula")
    .select(`
      id,
      data_aula,
      status,
      matricula_id,
      professor_id
    `)
    .eq("professor_id", professorId);

  if (inicio) query = query.gte("data_aula", inicio);
  if (fim) query = query.lte("data_aula", fim);

  const { data, error } = await query;

  if (error) throw error;

  const matriculaIdsPermitidas = new Set(matriculasFiltradas.map((m) => m.id));

  aulasFiltradasProfessor = (data || []).filter((aula) =>
    matriculaIdsPermitidas.has(aula.matricula_id)
  );
}

async function carregarNotasSistema() {
  const idsMatriculas = matriculasFiltradas.map((m) => m.id);

  if (!idsMatriculas.length) {
    notasDoSistema = [];
    return;
  }

  const { data, error } = await supabase
    .from("nota")
    .select("*")
    .in("matricula_id", idsMatriculas);

  if (error) {
    console.warn("Não foi possível carregar notas:", error.message);
    notasDoSistema = [];
    return;
  }

  notasDoSistema = data || [];
}

async function carregarPresencasTotaisPorMatricula() {
  const idsMatriculas = matriculasFiltradas.map((m) => m.id);
  if (idsMatriculas.length === 0) return {};

  const { data, error } = await supabase
    .from("aula")
    .select("id, matricula_id, status, professor_id")
    .in("matricula_id", idsMatriculas)
    .eq("professor_id", professorId)
    .eq("status", "Presente");

  if (error) throw error;

  const contagem = {};
  (data || []).forEach((a) => {
    const mid = String(a.matricula_id);
    contagem[mid] = (contagem[mid] || 0) + 1;
  });

  return contagem;
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
  const total = aulasFiltradasProfessor.filter((a) => statusContaComoAula(a.status)).length;
  qtdAulasPeriodo.textContent = String(total);
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

function existeNotaDaAvaliacao(matriculaId, numeroAvaliacao) {
  return notasDoSistema.some((nota) => {
    if (String(nota.matricula_id) !== String(matriculaId)) return false;

    const tipo = normalizarTexto(
      nota.tipo ?? nota.tipo_avaliacao ?? nota.avaliacao ?? ""
    );

    if (numeroAvaliacao === 1) return tipo.includes("1");
    if (numeroAvaliacao === 2) return tipo.includes("2");

    return false;
  });
}

function renderAvaliacoes(presencasPorMatricula) {
  const pendencias = [];

  matriculasFiltradas.forEach((m) => {
    const matriculaId = m.id;
    const totalPresencas = presencasPorMatricula[String(matriculaId)] || 0;

    if (totalPresencas >= 14 && !existeNotaDaAvaliacao(matriculaId, 1)) {
      pendencias.push({
        aluno: m?.aluno?.nome || "Aluno",
        materia: m?.modulo?.materia?.nome || "Matéria",
        modulo: m?.modulo?.nome || "Módulo",
        avaliacao: "Avaliação 1",
        presencas: totalPresencas
      });
      return;
    }

    if (totalPresencas >= 28 && !existeNotaDaAvaliacao(matriculaId, 2)) {
      pendencias.push({
        aluno: m?.aluno?.nome || "Aluno",
        materia: m?.modulo?.materia?.nome || "Matéria",
        modulo: m?.modulo?.nome || "Módulo",
        avaliacao: "Avaliação 2",
        presencas: totalPresencas
      });
    }
  });

  if (!pendencias.length) {
    listaAvaliacoesContainer.innerHTML = criarParagrafoVazio(
      "Nenhuma avaliação pendente no momento."
    );
    return;
  }

  pendencias.sort((a, b) => {
    if (a.materia !== b.materia) return a.materia.localeCompare(b.materia);
    return a.aluno.localeCompare(b.aluno);
  });

  listaAvaliacoesContainer.innerHTML = pendencias
    .map((item) => `
      <div class="item-avaliacao-resumo">
        <strong>${escapeHtml(item.aluno)} — ${escapeHtml(item.avaliacao)}</strong>
        <p>${escapeHtml(item.materia)} • ${escapeHtml(item.modulo)}</p>
        <p>${item.presencas} presença(s) registradas</p>
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
    renderSelectMatriculas();
    renderCardsAlunosPorMateria();
    renderCardsModulosPorMateria();

    const presencasPorMatricula = await carregarPresencasTotaisPorMatricula();
    renderAvaliacoes(presencasPorMatricula);

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
  const matriculaId = selectMatricula.value;

  if (!matriculaId) {
    mostrarMensagem("Selecione o aluno (curso).", false);
    return;
  }

  localStorage.setItem("matriculaSelecionada", matriculaId);
  window.location.href = "detalhes-aluno.html";
});

/* =========================================================
   INÍCIO
========================================================= */
await preencherFiltroInicial();
await montarResumo();