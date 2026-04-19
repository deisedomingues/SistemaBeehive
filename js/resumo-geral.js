import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

/* =========================================================
   ELEMENTOS
========================================================= */
const msg = document.getElementById("msg");

const qtdAlunosUnicosAtivos = document.getElementById("qtdAlunosUnicosAtivos");
const qtdMatriculasAtivas = document.getElementById("qtdMatriculasAtivas");
const qtdProfessoresAtivos = document.getElementById("qtdProfessoresAtivos");
const qtdMateriasAtivas = document.getElementById("qtdMateriasAtivas");

const qtdEventosTotal = document.getElementById("qtdEventosTotal");
const qtdEventosFuturos = document.getElementById("qtdEventosFuturos");
const qtdReposicoesPendentesResumo = document.getElementById("qtdReposicoesPendentesResumo");
const qtdAulasMes = document.getElementById("qtdAulasMes");

const qtdAlunosComFaltasResumo = document.getElementById("qtdAlunosComFaltasResumo");
const qtdAlunosSemNotasResumo = document.getElementById("qtdAlunosSemNotasResumo");
const qtdEventosSemConfirmacaoResumo = document.getElementById("qtdEventosSemConfirmacaoResumo");
const qtdAusenciasMesResumo = document.getElementById("qtdAusenciasMesResumo");

const selectMatriculaAdmin = document.getElementById("selectMatriculaAdmin");
const btnDetalhesAdmin = document.getElementById("btnDetalhesAdmin");

const cardsProfessoresAtivos = document.getElementById("cardsProfessoresAtivos");
const cardsMateriasResumo = document.getElementById("cardsMateriasResumo");

const selectMateriaResumo = document.getElementById("selectMateriaResumo");
const selectModuloResumo = document.getElementById("selectModuloResumo");
const resultadoModuloResumo = document.getElementById("resultadoModuloResumo");

/* =========================================================
   ESTADO
========================================================= */
let matriculasAtivas = [];
let professoresAtivos = [];
let eventos = [];
let confirmacoesEvento = [];
let aulas = [];
let notas = [];

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

function criarParagrafoVazio(texto) {
  return `<p style="font-size:14px;">${texto}</p>`;
}

function escapeHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hojeISO() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function mesAtualPrefixo() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

/* =========================================================
   BUSCAS
========================================================= */
async function carregarProfessoresAtivos() {
  const { data, error } = await supabase
    .from("professor")
    .select("id, nome, email, ativo")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) throw error;

  professoresAtivos = data || [];
}

async function carregarMatriculasAtivas() {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      ativa,
      aluno_id,
      materia_id,
      modulo_id,
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
      ),
      professor:professor_id (
        id,
        nome,
        ativo
      )
    `)
    .eq("ativa", true);

  if (error) throw error;

  const professoresAtivosIds = new Set(professoresAtivos.map((p) => p.id));

  matriculasAtivas = (data || []).filter((m) => {
    const professorId = m?.professor?.id;
    return professoresAtivosIds.has(professorId);
  });
}

async function carregarEventos() {
  const { data, error } = await supabase
    .from("evento")
    .select("id, data_evento, hora_evento, ativo")
    .order("data_evento", { ascending: true });

  if (error) throw error;

  eventos = data || [];
}

async function carregarConfirmacoesEvento() {
  const { data, error } = await supabase
    .from("evento_confirmacao")
    .select("evento_id");

  if (error) throw error;

  confirmacoesEvento = data || [];
}

async function carregarAulasResumo() {
  const matriculaIdsAtivas = matriculasAtivas.map((m) => m.id);

  if (!matriculaIdsAtivas.length) {
    aulas = [];
    return;
  }

  const { data, error } = await supabase
    .from("aula")
    .select("id, matricula_id, data_aula, status, precisa_reposicao, aula_original_id")
    .in("matricula_id", matriculaIdsAtivas);

  if (error) throw error;

  aulas = data || [];
}

async function carregarNotasResumo() {
  const matriculaIdsAtivas = matriculasAtivas.map((m) => m.id);

  if (!matriculaIdsAtivas.length) {
    notas = [];
    return;
  }

  const { data, error } = await supabase
    .from("nota")
    .select("id, matricula_id")
    .in("matricula_id", matriculaIdsAtivas);

  if (error) throw error;

  notas = data || [];
}

/* =========================================================
   RENDER - TOPO
========================================================= */
function renderIndicadoresGerais() {
  const alunosUnicos = new Set(
    matriculasAtivas
      .map((m) => m?.aluno?.id)
      .filter(Boolean)
  );

  const materiasUnicas = new Set(
    matriculasAtivas
      .map((m) => m?.materia?.id)
      .filter(Boolean)
  );

  const hoje = hojeISO();
  const prefixoMes = mesAtualPrefixo();

  const idsOriginaisJaRepostos = new Set(
    aulas
      .filter((a) => a.status === "Reposição" && a.aula_original_id)
      .map((a) => Number(a.aula_original_id))
  );

  const reposicoesPendentes = aulas.filter((a) => {
    if (!a.precisa_reposicao) return false;
    if (idsOriginaisJaRepostos.has(Number(a.id))) return false;
    return a.status === "Ausente" || a.status === "Cancelada";
  }).length;

  const aulasDoMes = aulas.filter((a) =>
    String(a.data_aula || "").startsWith(prefixoMes)
  ).length;

  const eventosFuturos = eventos.filter((e) => {
    if (!e.ativo) return false;
    return String(e.data_evento || "") >= hoje;
  }).length;

  qtdAlunosUnicosAtivos.textContent = String(alunosUnicos.size);
  qtdMatriculasAtivas.textContent = String(matriculasAtivas.length);
  qtdProfessoresAtivos.textContent = String(professoresAtivos.length);
  qtdMateriasAtivas.textContent = String(materiasUnicas.size);

  qtdEventosTotal.textContent = String(eventos.length);
  qtdEventosFuturos.textContent = String(eventosFuturos);
  qtdReposicoesPendentesResumo.textContent = String(reposicoesPendentes);
  qtdAulasMes.textContent = String(aulasDoMes);
}

function renderAlertasResumo() {
  const prefixoMes = mesAtualPrefixo();

  const matriculaIdsComFaltas = new Set(
    aulas
      .filter((a) => a.status === "Ausente")
      .map((a) => a.matricula_id)
  );

  const alunoIdsComFaltas = new Set(
    matriculasAtivas
      .filter((m) => matriculaIdsComFaltas.has(m.id))
      .map((m) => m.aluno_id)
  );

  const matriculaIdsComNotas = new Set(
    notas.map((n) => n.matricula_id)
  );

  const alunoIdsSemNotas = new Set(
    matriculasAtivas
      .filter((m) => !matriculaIdsComNotas.has(m.id))
      .map((m) => m.aluno_id)
  );

  const confirmacoesPorEvento = new Map();
  confirmacoesEvento.forEach((c) => {
    const atual = confirmacoesPorEvento.get(c.evento_id) || 0;
    confirmacoesPorEvento.set(c.evento_id, atual + 1);
  });

  const hoje = hojeISO();
  const eventosSemConfirmacao = eventos.filter((e) => {
    const futuros = e.ativo && String(e.data_evento || "") >= hoje;
    if (!futuros) return false;
    return !confirmacoesPorEvento.has(e.id);
  });

  const ausenciasMes = aulas.filter((a) =>
    a.status === "Ausente" &&
    String(a.data_aula || "").startsWith(prefixoMes)
  ).length;

  qtdAlunosComFaltasResumo.textContent = String(alunoIdsComFaltas.size);
  qtdAlunosSemNotasResumo.textContent = String(alunoIdsSemNotas.size);
  qtdEventosSemConfirmacaoResumo.textContent = String(eventosSemConfirmacao.length);
  qtdAusenciasMesResumo.textContent = String(ausenciasMes);
}

/* =========================================================
   RENDER - CONSULTA DE ALUNO
========================================================= */
function renderSelectMatriculasAdmin() {
  selectMatriculaAdmin.innerHTML = `<option value="">Selecione o aluno (curso)</option>`;

  const listaOrdenada = [...matriculasAtivas].sort((a, b) => {
    const nomeA = a?.aluno?.nome || "";
    const nomeB = b?.aluno?.nome || "";
    return nomeA.localeCompare(nomeB);
  });

  listaOrdenada.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = `${m.aluno?.nome || "Aluno"} — ${m.materia?.nome || "Matéria"} (${m.modulo?.nome || "Módulo"})`;
    selectMatriculaAdmin.appendChild(opt);
  });
}

/* =========================================================
   RENDER - PROFESSORES
========================================================= */
function renderCardsProfessores() {
  if (!professoresAtivos.length) {
    cardsProfessoresAtivos.innerHTML = `<div class="card">${criarParagrafoVazio("Nenhum professor ativo encontrado.")}</div>`;
    return;
  }

  const html = professoresAtivos.map((prof) => {
    const matriculasDoProfessor = matriculasAtivas.filter(
      (m) => m?.professor?.id === prof.id
    );

    const alunosUnicos = new Set(
      matriculasDoProfessor
        .map((m) => m?.aluno?.id)
        .filter(Boolean)
    );

    const porMateria = {};

    matriculasDoProfessor.forEach((m) => {
      const nomeMateria = m?.materia?.nome || "Matéria";
      if (!porMateria[nomeMateria]) porMateria[nomeMateria] = new Set();

      if (m?.aluno?.id) {
        porMateria[nomeMateria].add(m.aluno.id);
      }
    });

    const materiasOrdenadas = Object.keys(porMateria).sort((a, b) => a.localeCompare(b));

    return `
      <div class="card card-professor-admin">
        <h2>🧑‍🏫 ${escapeHtml(prof.nome)}</h2>
        <p><b>Total de alunos:</b> ${alunosUnicos.size}</p>

        ${
          materiasOrdenadas.length
            ? `<ul class="lista-simples-resumo">
                ${materiasOrdenadas
                  .map((materia) => `<li>${escapeHtml(materia)}: ${porMateria[materia].size} aluno(s)</li>`)
                  .join("")}
               </ul>`
            : `<p>Nenhum aluno ativo vinculado.</p>`
        }
      </div>
    `;
  }).join("");

  cardsProfessoresAtivos.innerHTML = html;
}

/* =========================================================
   RENDER - MATÉRIAS
========================================================= */
function renderCardsMaterias() {
  const mapa = {};

  matriculasAtivas.forEach((m) => {
    const nomeMateria = m?.materia?.nome || "Matéria";
    const alunoId = m?.aluno?.id;

    if (!mapa[nomeMateria]) {
      mapa[nomeMateria] = {
        alunos: new Set(),
        matriculas: 0
      };
    }

    if (alunoId) mapa[nomeMateria].alunos.add(alunoId);
    mapa[nomeMateria].matriculas += 1;
  });

  const materias = Object.keys(mapa).sort((a, b) => a.localeCompare(b));

  if (!materias.length) {
    cardsMateriasResumo.innerHTML = `<div class="card">${criarParagrafoVazio("Nenhuma matéria com matrícula ativa encontrada.")}</div>`;
    return;
  }

  const html = materias.map((nomeMateria) => `
    <div class="card">
      <h2>${escapeHtml(nomeMateria)}</h2>
      <p><b>Alunos:</b> ${mapa[nomeMateria].alunos.size} pessoa(s)</p>
      <p><b>Matrículas ativas:</b> ${mapa[nomeMateria].matriculas}</p>
    </div>
  `).join("");

  cardsMateriasResumo.innerHTML = html;
}

/* =========================================================
   RENDER - FILTRO DE MÓDULO
========================================================= */
function renderSelectMateriasResumo() {
  if (!selectMateriaResumo) return;

  const mapaMaterias = new Map();

  matriculasAtivas.forEach((m) => {
    const materiaId = m?.materia?.id;
    const materiaNome = m?.materia?.nome;

    if (materiaId && materiaNome) {
      mapaMaterias.set(materiaId, materiaNome);
    }
  });

  const materiasOrdenadas = Array.from(mapaMaterias.entries()).sort((a, b) =>
    a[1].localeCompare(b[1])
  );

  selectMateriaResumo.innerHTML = `<option value="">Selecione a matéria</option>`;

  materiasOrdenadas.forEach(([id, nome]) => {
    const opt = document.createElement("option");
    opt.value = String(id);
    opt.textContent = nome;
    selectMateriaResumo.appendChild(opt);
  });
}

function limparSelectModulos() {
  if (!selectModuloResumo) return;

  selectModuloResumo.innerHTML = `<option value="">Selecione o módulo</option>`;
  selectModuloResumo.disabled = true;
}

function renderResultadoModuloInicial() {
  if (!resultadoModuloResumo) return;

  resultadoModuloResumo.innerHTML = `
    <p style="font-size:14px;">Selecione uma matéria para começar.</p>
  `;
}

function renderModulosPorMateria(materiaIdSelecionada) {
  if (!selectModuloResumo) return;

  const modulosMap = new Map();

  matriculasAtivas.forEach((m) => {
    const materiaId = String(m?.materia?.id || "");
    const moduloId = m?.modulo?.id;
    const moduloNome = m?.modulo?.nome;

    if (materiaId !== String(materiaIdSelecionada)) return;
    if (!moduloId || !moduloNome) return;

    modulosMap.set(moduloId, moduloNome);
  });

  const modulosOrdenados = Array.from(modulosMap.entries()).sort((a, b) =>
    a[1].localeCompare(b[1])
  );

  limparSelectModulos();

  if (!modulosOrdenados.length) {
    selectModuloResumo.disabled = true;
    resultadoModuloResumo.innerHTML = `
      <p style="font-size:14px;">Nenhum módulo encontrado para esta matéria.</p>
    `;
    return;
  }

  modulosOrdenados.forEach(([id, nome]) => {
    const opt = document.createElement("option");
    opt.value = String(id);
    opt.textContent = nome;
    selectModuloResumo.appendChild(opt);
  });

  selectModuloResumo.disabled = false;

  resultadoModuloResumo.innerHTML = `
    <p style="font-size:14px;">Agora selecione o módulo.</p>
  `;
}

function renderResultadoModulo(materiaIdSelecionada, moduloIdSelecionado) {
  if (!resultadoModuloResumo) return;

  const filtradas = matriculasAtivas.filter((m) => {
    const materiaId = String(m?.materia?.id || "");
    const moduloId = String(m?.modulo?.id || "");
    return (
      materiaId === String(materiaIdSelecionada) &&
      moduloId === String(moduloIdSelecionado)
    );
  });

  if (!filtradas.length) {
    resultadoModuloResumo.innerHTML = `
      <p style="font-size:14px;">Nenhuma matrícula ativa encontrada neste módulo.</p>
    `;
    return;
  }

  const nomeMateria = filtradas[0]?.materia?.nome || "Matéria";
  const nomeModulo = filtradas[0]?.modulo?.nome || "Módulo";

  const alunosUnicos = new Set(
    filtradas
      .map((m) => m?.aluno?.id)
      .filter(Boolean)
  );

  resultadoModuloResumo.innerHTML = `
    <div class="item-avaliacao-resumo">
      <strong>${escapeHtml(nomeModulo)}</strong>
      <p><b>Matéria:</b> ${escapeHtml(nomeMateria)}</p>
      <p><b>Alunos:</b> ${alunosUnicos.size} pessoa(s)</p>
      <p><b>Matrículas ativas:</b> ${filtradas.length}</p>
    </div>
  `;
}

/* =========================================================
   MONTAGEM
========================================================= */
async function montarResumoGeral() {
  try {
    await carregarProfessoresAtivos();
    await carregarMatriculasAtivas();
    await carregarEventos();
    await carregarConfirmacoesEvento();
    await carregarAulasResumo();
    await carregarNotasResumo();

    renderIndicadoresGerais();
    renderAlertasResumo();
    renderSelectMatriculasAdmin();
    renderCardsProfessores();
    renderCardsMaterias();

    renderSelectMateriasResumo();
    limparSelectModulos();
    renderResultadoModuloInicial();

  } catch (error) {
    console.error("Erro ao carregar resumo geral:", error);
    mostrarMensagem(
      "Erro ao carregar o resumo geral. Confira os relacionamentos e nomes das colunas.",
      false
    );
  }
}

/* =========================================================
   EVENTOS
========================================================= */
btnDetalhesAdmin?.addEventListener("click", () => {
  const matriculaId = selectMatriculaAdmin.value;

  if (!matriculaId) {
    mostrarMensagem("Selecione o aluno (curso).", false);
    return;
  }

  localStorage.setItem("matriculaSelecionada", matriculaId);
  window.location.href = "detalhes-aluno-admin.html";
});

selectMateriaResumo?.addEventListener("change", () => {
  const materiaId = selectMateriaResumo.value;

  if (!materiaId) {
    limparSelectModulos();
    renderResultadoModuloInicial();
    return;
  }

  renderModulosPorMateria(materiaId);
});

selectModuloResumo?.addEventListener("change", () => {
  const materiaId = selectMateriaResumo.value;
  const moduloId = selectModuloResumo.value;

  if (!materiaId || !moduloId) {
    resultadoModuloResumo.innerHTML = `
      <p style="font-size:14px;">Selecione um módulo para visualizar os dados.</p>
    `;
    return;
  }

  renderResultadoModulo(materiaId, moduloId);
});

/* =========================================================
   INÍCIO
========================================================= */
await montarResumoGeral();