import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

// =====================
// Elementos da tela
// =====================
const msg = document.getElementById("msg");

const selectAluno = document.getElementById("selectAluno");
const selectMatricula = document.getElementById("selectMatricula");
const infoMatricula = document.getElementById("infoMatricula");

const formEditar = document.getElementById("formEditar");
const materiaSel = document.getElementById("materia");
const moduloSel = document.getElementById("modulo");
const professorSel = document.getElementById("professor");
const ativaChk = document.getElementById("ativa");
const btnSalvar = document.getElementById("btnSalvar");

// botão novo curso (precisa existir no HTML)
const btnAddCurso = document.getElementById("btnAddCurso");

// =====================
// Cache de dados
// =====================
let professoresCache = []; // [{id, nome, materia_id}] (pode repetir professor em matérias diferentes)
let modulosCache = [];     // [{id, nome, materia_id, ordem}]
let materiasCache = [];    // [{id, nome}]

let matriculasAluno = [];  // matrículas do aluno selecionado
let matriculaAtual = null; // matrícula selecionada no select

let modoCriacao = false;   // true = estamos criando novo curso

// =====================
// Helpers UI
// =====================
function mostrarMensagem(texto, ok = true) {
  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
  }, 2200);
}

function criarOption(value, label) {
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = label;
  return opt;
}

function resetEdicao() {
  modoCriacao = false;

  materiaSel.innerHTML = `<option value="">—</option>`;
  moduloSel.innerHTML = `<option value="">Selecione uma matrícula</option>`;
  professorSel.innerHTML = `<option value="">Selecione uma matrícula</option>`;

  materiaSel.disabled = true;
  moduloSel.disabled = true;
  professorSel.disabled = true;

  btnSalvar.disabled = true;

  ativaChk.checked = true;
  infoMatricula.textContent = "";
  matriculaAtual = null;
}

// =====================
// Carregar dados base
// =====================
async function carregarBases() {
  // 1) matérias
  const { data: materias, error: errMat } = await supabase
    .from("materia")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (errMat) {
    console.error(errMat);
    mostrarMensagem("❌ Erro ao carregar matérias.", false);
    return;
  }
  materiasCache = materias || [];

  // 2) módulos
  const { data: modulos, error: errMod } = await supabase
    .from("modulo")
    .select("id, nome, ordem, materia_id")
    .order("ordem", { ascending: true });

  if (errMod) {
    console.error(errMod);
    mostrarMensagem("❌ Erro ao carregar módulos.", false);
    return;
  }
  modulosCache = modulos || [];

  // 3) professores (N:N via professor_materia)
  const { data: pm, error: errPM } = await supabase
    .from("professor_materia")
    .select(`
      materia_id,
      professor:professor_id ( id, nome )
    `);

  if (errPM) {
    console.error(errPM);
    mostrarMensagem("❌ Erro ao carregar professores (professor_materia).", false);
    return;
  }

  // transforma em [{id, nome, materia_id}, ...]
  professoresCache = (pm || [])
    .map((x) => ({
      id: x.professor?.id,
      nome: x.professor?.nome,
      materia_id: x.materia_id
    }))
    .filter((p) => p.id && p.nome && p.materia_id)
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // 4) alunos
  const { data: alunos, error: errAluno } = await supabase
    .from("aluno")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (errAluno) {
    console.error(errAluno);
    mostrarMensagem("❌ Erro ao carregar alunos.", false);
    return;
  }

  // preencher selectAluno
  selectAluno.innerHTML = `<option value="">Selecione o aluno</option>`;
  (alunos || []).forEach((a) => {
    selectAluno.appendChild(criarOption(a.id, a.nome));
  });

  resetEdicao();

  // ✅ PRE-SELECIONAR ALUNO (quando veio da tela editar-aluno)
  const alunoPreSelecionado = localStorage.getItem("alunoSelecionadoAdmin");
  if (alunoPreSelecionado) {
    // se o aluno existe na lista
    const existe = (alunos || []).some((a) => String(a.id) === String(alunoPreSelecionado));
    if (existe) {
      selectAluno.value = alunoPreSelecionado;

      // dispara o carregamento de matrículas automaticamente
      const evento = new Event("change");
      selectAluno.dispatchEvent(evento);
    }

    // limpa a chave (pra não ficar preso pra sempre)
    localStorage.removeItem("alunoSelecionadoAdmin");
  }
}

// =====================
// Matrículas do aluno
// =====================
async function carregarMatriculasDoAluno(alunoId) {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      ativa,
      data_inicio,
      data_fim,
      aluno:aluno_id ( id, nome ),
      materia:materia_id ( id, nome ),
      modulo:modulo_id ( id, nome ),
      professor:professor_id ( id, nome )
    `)
    .eq("aluno_id", alunoId)
    .order("id", { ascending: true });

  if (error) {
    console.error(error);
    mostrarMensagem("❌ Erro ao carregar matrículas do aluno.", false);
    return [];
  }

  return data || [];
}

function preencherSelectMatriculas() {
  selectMatricula.innerHTML = `<option value="">Selecione o curso</option>`;

  if (matriculasAluno.length === 0) {
    selectMatricula.innerHTML = `<option value="">Este aluno não tem matrículas</option>`;
    selectMatricula.disabled = true;
    return;
  }

  matriculasAluno.forEach((m) => {
    const status = m.ativa === false ? " (inativa)" : "";
    const label = `${m.materia?.nome} — ${m.modulo?.nome} — Prof(a). ${m.professor?.nome}${status}`;
    selectMatricula.appendChild(criarOption(m.id, label));
  });

  selectMatricula.disabled = false;
}

// =====================
// Preencher edição
// =====================
function preencherEdicaoDaMatricula(m) {
  modoCriacao = false;

  // Matéria (somente informativa)
  materiaSel.innerHTML = "";
  materiaSel.appendChild(criarOption(m.materia?.id || "", m.materia?.nome || "—"));

  const materiaId = m.materia?.id;

  // módulos filtrados
  moduloSel.innerHTML = "";
  moduloSel.appendChild(criarOption("", "Selecione o módulo"));
  modulosCache
    .filter((x) => String(x.materia_id) === String(materiaId))
    .forEach((x) => {
      moduloSel.appendChild(criarOption(x.id, x.nome));
    });

  // professores filtrados (via cache N:N)
  professorSel.innerHTML = "";
  professorSel.appendChild(criarOption("", "Selecione o professor"));

  const vistos = new Set();
  professoresCache
    .filter((p) => String(p.materia_id) === String(materiaId))
    .forEach((p) => {
      const key = String(p.id);
      if (vistos.has(key)) return;
      vistos.add(key);
      professorSel.appendChild(criarOption(p.id, p.nome));
    });

  // setar valores atuais
  moduloSel.value = m.modulo?.id || "";
  professorSel.value = m.professor?.id || "";

  // checkbox ativa
  ativaChk.checked = m.ativa !== false;

  // habilitar
  materiaSel.disabled = true; // bloqueada em edição
  moduloSel.disabled = false;
  professorSel.disabled = false;
  btnSalvar.disabled = false;

  const ini = m.data_inicio ? `Início: ${m.data_inicio}` : "";
  const fim = m.data_fim ? ` | Fim: ${m.data_fim}` : "";
  infoMatricula.textContent = `${ini}${fim}`.trim();

  matriculaAtual = m;
}

// =====================
// Modo criação: adicionar curso
// =====================
function entrarModoCriacao() {
  const alunoId = selectAluno.value;
  if (!alunoId) {
    mostrarMensagem("⚠️ Selecione um aluno antes.", false);
    return;
  }

  modoCriacao = true;
  matriculaAtual = null;

  // liberar matéria
  materiaSel.disabled = false;

  // preencher matérias
  materiaSel.innerHTML = `<option value="">Selecione a matéria</option>`;
  materiasCache.forEach((m) => materiaSel.appendChild(criarOption(m.id, m.nome)));

  // bloquear módulo/professor até escolher matéria
  moduloSel.disabled = true;
  professorSel.disabled = true;

  moduloSel.innerHTML = `<option value="">Selecione a matéria primeiro</option>`;
  professorSel.innerHTML = `<option value="">Selecione a matéria primeiro</option>`;

  ativaChk.checked = true;
  btnSalvar.disabled = false;

  infoMatricula.textContent = "Criando novo curso para este aluno…";
  selectMatricula.value = "";
}

// quando escolhe a matéria (no modo criação), carregar módulo + professor
materiaSel.addEventListener("change", () => {
  if (!modoCriacao) return;

  const materiaId = materiaSel.value;

  // reset
  moduloSel.innerHTML = "";
  professorSel.innerHTML = "";

  if (!materiaId) {
    moduloSel.disabled = true;
    professorSel.disabled = true;
    moduloSel.appendChild(criarOption("", "Selecione a matéria primeiro"));
    professorSel.appendChild(criarOption("", "Selecione a matéria primeiro"));
    return;
  }

  // impede duplicar matéria já matriculada
  const jaExiste = matriculasAluno.some((m) => String(m.materia?.id) === String(materiaId));
  if (jaExiste) {
    mostrarMensagem("⚠️ Este aluno já possui matrícula nesta matéria.", false);
    materiaSel.value = "";
    moduloSel.disabled = true;
    professorSel.disabled = true;
    moduloSel.innerHTML = `<option value="">Selecione a matéria primeiro</option>`;
    professorSel.innerHTML = `<option value="">Selecione a matéria primeiro</option>`;
    return;
  }

  // módulos filtrados
  moduloSel.disabled = false;
  moduloSel.appendChild(criarOption("", "Selecione o módulo"));
  modulosCache
    .filter((x) => String(x.materia_id) === String(materiaId))
    .forEach((x) => {
      moduloSel.appendChild(criarOption(x.id, x.nome));
    });

  // professores filtrados pela matéria
  professorSel.disabled = false;
  professorSel.appendChild(criarOption("", "Selecione o professor"));

  const vistos = new Set();
  professoresCache
    .filter((p) => String(p.materia_id) === String(materiaId))
    .forEach((p) => {
      const key = String(p.id);
      if (vistos.has(key)) return;
      vistos.add(key);
      professorSel.appendChild(criarOption(p.id, p.nome));
    });
});

// =====================
// Eventos principais
// =====================
selectAluno.addEventListener("change", async () => {
  const alunoId = selectAluno.value;
  resetEdicao();

  if (!alunoId) {
    selectMatricula.disabled = true;
    selectMatricula.innerHTML = `<option value="">Selecione um aluno acima</option>`;
    return;
  }

  matriculasAluno = await carregarMatriculasDoAluno(alunoId);
  preencherSelectMatriculas();
});

selectMatricula.addEventListener("change", () => {
  const mid = selectMatricula.value;
  resetEdicao();

  if (!mid) return;

  const m = matriculasAluno.find((x) => String(x.id) === String(mid));
  if (!m) return;

  preencherEdicaoDaMatricula(m);
});

if (btnAddCurso) {
  btnAddCurso.addEventListener("click", entrarModoCriacao);
}

// =====================
// Salvar (UPDATE ou INSERT)
// =====================
formEditar.addEventListener("submit", async (e) => {
  e.preventDefault();

  const alunoId = selectAluno.value;
  if (!alunoId) {
    mostrarMensagem("⚠️ Selecione um aluno.", false);
    return;
  }

  const ativa = ativaChk.checked;
  const hojeISO = new Date().toISOString().slice(0, 10);

  // =========================
  // MODO CRIAÇÃO (INSERT)
  // =========================
  if (modoCriacao) {
    const materiaId = materiaSel.value;
    const moduloId = moduloSel.value;
    const professorId = professorSel.value;

    if (!materiaId || !moduloId || !professorId) {
      mostrarMensagem("⚠️ Preencha Matéria, Módulo e Professor.", false);
      return;
    }

    const { error } = await supabase
      .from("matricula")
      .insert([{
        aluno_id: alunoId,
        materia_id: materiaId,
        modulo_id: moduloId,
        professor_id: professorId,
        data_inicio: hojeISO,
        data_fim: null,
        ativa: true
      }]);

    if (error) {
      console.error(error);
      mostrarMensagem("❌ Erro ao adicionar curso.", false);
      return;
    }

    mostrarMensagem("✅ Curso adicionado!");

    // recarregar matrículas e sair do modo criação
    matriculasAluno = await carregarMatriculasDoAluno(alunoId);
    preencherSelectMatriculas();
    resetEdicao();
    return;
  }

  // =========================
  // MODO EDIÇÃO (UPDATE)
  // =========================
  if (!matriculaAtual) {
    mostrarMensagem("⚠️ Selecione uma matrícula ou clique em + Adicionar curso.", false);
    return;
  }

  const novoModuloId = moduloSel.value;
  const novoProfessorId = professorSel.value;

  if (!novoModuloId || !novoProfessorId) {
    mostrarMensagem("⚠️ Selecione módulo e professor.", false);
    return;
  }

  const patch = {
    modulo_id: novoModuloId,
    professor_id: novoProfessorId,
    ativa: ativa,
    data_fim: ativa ? null : (matriculaAtual.data_fim || hojeISO)
  };

  const { error } = await supabase
    .from("matricula")
    .update(patch)
    .eq("id", matriculaAtual.id);

  if (error) {
    console.error(error);
    mostrarMensagem("❌ Erro ao salvar alterações.", false);
    return;
  }

  mostrarMensagem("✅ Salvo!");

  // recarrega matrículas do aluno e mantém seleção
  const midAtual = matriculaAtual.id;

  matriculasAluno = await carregarMatriculasDoAluno(alunoId);
  preencherSelectMatriculas();
  selectMatricula.value = midAtual;

  const mAtualizada = matriculasAluno.find((x) => String(x.id) === String(midAtual));
  if (mAtualizada) preencherEdicaoDaMatricula(mAtualizada);
});

// init
await carregarBases();
