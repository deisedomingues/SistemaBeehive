import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

// =====================
// Elementos da tela
// =====================
const msg = document.getElementById("msg");

const selectAluno = document.getElementById("selectAluno");
const selectMatricula = document.getElementById("selectMatricula");

const resumoAluno = document.getElementById("resumoAluno");
const nomeAlunoResumo = document.getElementById("nomeAlunoResumo");
const infoCursosAluno = document.getElementById("infoCursosAluno");

const blocoEdicao = document.getElementById("blocoEdicao");
const blocoRematricula = document.getElementById("blocoRematricula");

const tituloEdicao = document.getElementById("tituloEdicao");
const subtituloEdicao = document.getElementById("subtituloEdicao");

const formEditar = document.getElementById("formEditar");
const materiaSel = document.getElementById("materia");
const moduloSel = document.getElementById("modulo");
const professorSel = document.getElementById("professor");
const infoMatricula = document.getElementById("infoMatricula");
const btnSalvar = document.getElementById("btnSalvar");

const btnAddCurso = document.getElementById("btnAddCurso");
const btnDesmatricular = document.getElementById("btnDesmatricular");
const btnRematricular = document.getElementById("btnRematricular");

const textoRematricula = document.getElementById("textoRematricula");
const infoMatriculaInativa = document.getElementById("infoMatriculaInativa");

// =====================
// Cache
// =====================
let professoresCache = [];
let modulosCache = [];
let materiasCache = [];
let alunosCache = [];

let matriculasAluno = [];
let matriculaAtual = null;
let modoCriacao = false;

// =====================
// Helpers UI
// =====================
function mostrarMensagem(texto, ok = true) {
  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";
  msg.style.border = ok ? "1px solid #66bb6a" : "1px solid #ef5350";

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
  }, 2600);
}

function criarOption(value, label) {
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = label;
  return opt;
}

function formatarDataBR(dataISO) {
  if (!dataISO) return "—";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function obterAlunoSelecionado() {
  const alunoId = selectAluno.value;
  return alunosCache.find((a) => String(a.id) === String(alunoId)) || null;
}

function atualizarResumoAluno() {
  const aluno = obterAlunoSelecionado();

  if (!aluno) {
    resumoAluno.style.display = "none";
    nomeAlunoResumo.textContent = "—";
    return;
  }

  resumoAluno.style.display = "block";
  nomeAlunoResumo.textContent = aluno.nome;
}

function preencherResumoDeCursos() {
  if (!selectAluno.value) {
    infoCursosAluno.textContent = "";
    return;
  }

  const ativas = matriculasAluno.filter((m) => m.ativa !== false);
  const inativas = matriculasAluno.filter((m) => m.ativa === false);

  let partes = [];

  if (ativas.length > 0) {
    const nomesAtivos = ativas.map((m) => m.materia?.nome).filter(Boolean);
    partes.push(`Cursos ativos deste aluno: ${nomesAtivos.join(", ")}.`);
  }

  if (inativas.length > 0) {
    const nomesInativos = inativas.map((m) => m.materia?.nome).filter(Boolean);
    partes.push(`Cursos desmatriculados: ${nomesInativos.join(", ")}.`);
  }

  infoCursosAluno.textContent = partes.join(" ");
}

function esconderBotaoAdicionarCurso() {
  if (!btnAddCurso) return;
  btnAddCurso.style.display = "none";
}

function mostrarBotaoAdicionarCurso() {
  if (!btnAddCurso) return;
  btnAddCurso.style.display = "inline-block";
}

function resetEdicao() {
  modoCriacao = false;
  matriculaAtual = null;

  blocoEdicao.style.display = "none";
  blocoRematricula.style.display = "none";

  btnDesmatricular.style.display = "none";
  btnDesmatricular.hidden = true;

  mostrarBotaoAdicionarCurso();

  tituloEdicao.textContent = "Editar matrícula";
  subtituloEdicao.textContent = "Selecione uma matrícula para editar.";

  materiaSel.innerHTML = `<option value="">—</option>`;
  moduloSel.innerHTML = `<option value="">Selecione uma matrícula</option>`;
  professorSel.innerHTML = `<option value="">Selecione uma matrícula</option>`;

  materiaSel.disabled = true;
  moduloSel.disabled = true;
  professorSel.disabled = true;
  btnSalvar.disabled = true;

  infoMatricula.textContent = "—";
  textoRematricula.textContent = "—";
  infoMatriculaInativa.textContent = "—";
}

function obterMateriasNuncaMatriculadas() {
  const materiasJaExistentes = new Set(
    matriculasAluno.map((m) => String(m.materia?.id))
  );

  return materiasCache.filter(
    (mat) => !materiasJaExistentes.has(String(mat.id))
  );
}

function preencherModulosPorMateria(materiaId, moduloAtual = "") {
  moduloSel.innerHTML = "";
  moduloSel.appendChild(criarOption("", "Selecione o módulo"));

  modulosCache
    .filter((m) => String(m.materia_id) === String(materiaId))
    .forEach((m) => {
      moduloSel.appendChild(criarOption(m.id, m.nome));
    });

  moduloSel.value = moduloAtual || "";
}

function preencherProfessoresPorMateria(materiaId, professorAtual = "") {
  professorSel.innerHTML = "";
  professorSel.appendChild(criarOption("", "Selecione o professor"));

  const vistos = new Set();

  professoresCache
    .filter((p) => String(p.materia_id) === String(materiaId))
    .forEach((p) => {
      const chave = String(p.id);
      if (vistos.has(chave)) return;
      vistos.add(chave);
      professorSel.appendChild(criarOption(p.id, p.nome));
    });

  professorSel.value = professorAtual || "";
}

// =====================
// Base
// =====================
async function carregarBases() {
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

  const { data: pm, error: errPM } = await supabase
    .from("professor_materia")
    .select(`
      materia_id,
      professor:professor_id ( id, nome )
    `);

  if (errPM) {
    console.error(errPM);
    mostrarMensagem("❌ Erro ao carregar professores.", false);
    return;
  }

  professoresCache = (pm || [])
    .map((x) => ({
      id: x.professor?.id,
      nome: x.professor?.nome,
      materia_id: x.materia_id
    }))
    .filter((p) => p.id && p.nome && p.materia_id)
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const { data: alunos, error: errAluno } = await supabase
    .from("aluno")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (errAluno) {
    console.error(errAluno);
    mostrarMensagem("❌ Erro ao carregar alunos.", false);
    return;
  }

  alunosCache = alunos || [];

  selectAluno.innerHTML = `<option value="">Selecione o aluno</option>`;
  alunosCache.forEach((a) => {
    selectAluno.appendChild(criarOption(a.id, a.nome));
  });

  const alunoPreSelecionado = localStorage.getItem("alunoSelecionadoAdmin");
  if (alunoPreSelecionado) {
    const existe = alunosCache.some((a) => String(a.id) === String(alunoPreSelecionado));
    if (existe) {
      selectAluno.value = alunoPreSelecionado;
      selectAluno.dispatchEvent(new Event("change"));
    }
    localStorage.removeItem("alunoSelecionadoAdmin");
  }
}

// =====================
// Matrículas
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
  selectMatricula.innerHTML = `<option value="">Selecione um curso</option>`;

  if (matriculasAluno.length === 0) {
    selectMatricula.innerHTML = `<option value="">Nenhuma matrícula encontrada</option>`;
    selectMatricula.disabled = true;
    return;
  }

  matriculasAluno.forEach((m) => {
    const status = m.ativa === false ? " (desmatriculado)" : "";
    const label = `${m.materia?.nome} — ${m.modulo?.nome} — Prof(a). ${m.professor?.nome}${status}`;
    selectMatricula.appendChild(criarOption(m.id, label));
  });

  selectMatricula.disabled = false;
}

// =====================
// Tela da matrícula ativa
// =====================
function preencherEdicaoDaMatricula(m) {
  modoCriacao = false;
  matriculaAtual = m;

  blocoRematricula.style.display = "none";
  blocoEdicao.style.display = "block";

  mostrarBotaoAdicionarCurso();

  if (m.ativa === false) {
    btnDesmatricular.style.display = "none";
    btnDesmatricular.hidden = true;
  } else {
    btnDesmatricular.style.display = "inline-block";
    btnDesmatricular.hidden = false;
  }

  tituloEdicao.textContent = "Editar matrícula";
  subtituloEdicao.textContent = `Curso selecionado: ${m.materia?.nome || "—"}`;

  materiaSel.innerHTML = "";
  materiaSel.appendChild(criarOption(m.materia?.id || "", m.materia?.nome || "—"));

  const materiaId = m.materia?.id;

  preencherModulosPorMateria(materiaId, m.modulo?.id || "");
  preencherProfessoresPorMateria(materiaId, m.professor?.id || "");

  materiaSel.disabled = true;
  moduloSel.disabled = false;
  professorSel.disabled = false;
  btnSalvar.disabled = false;

  const inicio = formatarDataBR(m.data_inicio);
  const fim = m.data_fim ? formatarDataBR(m.data_fim) : "—";

  infoMatricula.textContent = `Status: Ativo | Início: ${inicio} | Fim: ${fim}`;
}

// =====================
// Tela da matrícula desmatriculada
// =====================
function preencherBlocoRematricula(m) {
  modoCriacao = false;
  matriculaAtual = m;

  blocoEdicao.style.display = "none";
  blocoRematricula.style.display = "block";

  btnDesmatricular.style.display = "none";
  btnDesmatricular.hidden = true;

  esconderBotaoAdicionarCurso();

  const inicio = formatarDataBR(m.data_inicio);
  const fim = m.data_fim ? formatarDataBR(m.data_fim) : "—";

  textoRematricula.innerHTML = `
    Este curso está desmatriculado no momento.<br>
    <strong>Após rematrícula você poderá editar módulo e professor(a).</strong>
  `;

  infoMatriculaInativa.innerHTML = `
    <strong>Últimos dados salvos nesta matrícula:</strong><br>
    Curso: ${m.materia?.nome || "—"} |
    Módulo anterior: ${m.modulo?.nome || "—"} |
    Professor anterior: ${m.professor?.nome || "—"} |
    Início: ${inicio} |
    Fim: ${fim}
  `;
}

// =====================
// Modo criação
// =====================
function entrarModoCriacao() {
  const alunoId = selectAluno.value;

  if (!alunoId) {
    mostrarMensagem("⚠️ Selecione um aluno antes.", false);
    return;
  }

  const materiasDisponiveis = obterMateriasNuncaMatriculadas();

  if (materiasDisponiveis.length === 0) {
    mostrarMensagem("⚠️ Este aluno já possui histórico em todos os cursos disponíveis. Para um curso já existente e desmatriculado, use a rematrícula.", false);
    return;
  }

  modoCriacao = true;
  matriculaAtual = null;

  blocoRematricula.style.display = "none";
  blocoEdicao.style.display = "block";

  btnDesmatricular.style.display = "none";
  btnDesmatricular.hidden = true;

  mostrarBotaoAdicionarCurso();

  tituloEdicao.textContent = "Adicionar novo curso";
  subtituloEdicao.textContent = "Use esta opção apenas para um curso que o aluno nunca teve antes.";

  materiaSel.disabled = false;
  moduloSel.disabled = true;
  professorSel.disabled = true;
  btnSalvar.disabled = false;

  materiaSel.innerHTML = `<option value="">Selecione a matéria</option>`;
  materiasDisponiveis.forEach((m) => {
    materiaSel.appendChild(criarOption(m.id, m.nome));
  });

  moduloSel.innerHTML = `<option value="">Selecione a matéria primeiro</option>`;
  professorSel.innerHTML = `<option value="">Selecione a matéria primeiro</option>`;

  infoMatricula.textContent = "Novo curso ainda não salvo.";
  selectMatricula.value = "";
}

materiaSel.addEventListener("change", () => {
  if (!modoCriacao) return;

  const materiaId = materiaSel.value;

  moduloSel.innerHTML = "";
  professorSel.innerHTML = "";

  if (!materiaId) {
    moduloSel.disabled = true;
    professorSel.disabled = true;
    moduloSel.appendChild(criarOption("", "Selecione a matéria primeiro"));
    professorSel.appendChild(criarOption("", "Selecione a matéria primeiro"));
    return;
  }

  preencherModulosPorMateria(materiaId);
  preencherProfessoresPorMateria(materiaId);

  moduloSel.disabled = false;
  professorSel.disabled = false;
});

// =====================
// Eventos principais
// =====================
selectAluno.addEventListener("change", async () => {
  const alunoId = selectAluno.value;

  resetEdicao();
  atualizarResumoAluno();

  if (!alunoId) {
    selectMatricula.disabled = true;
    selectMatricula.innerHTML = `<option value="">Selecione um aluno acima</option>`;
    infoCursosAluno.textContent = "";
    return;
  }

  matriculasAluno = await carregarMatriculasDoAluno(alunoId);
  preencherSelectMatriculas();
  preencherResumoDeCursos();
});

selectMatricula.addEventListener("change", () => {
  const mid = selectMatricula.value;
  resetEdicao();

  if (!mid) return;

  const m = matriculasAluno.find((x) => String(x.id) === String(mid));
  if (!m) return;

  if (m.ativa === false) {
    preencherBlocoRematricula(m);
  } else {
    preencherEdicaoDaMatricula(m);
  }
});

btnAddCurso.addEventListener("click", entrarModoCriacao);

// =====================
// Desmatricular
// =====================
btnDesmatricular.addEventListener("click", async () => {
  if (!matriculaAtual) {
    mostrarMensagem("⚠️ Selecione uma matrícula antes.", false);
    return;
  }

  const hojeISO = new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from("matricula")
    .update({
      ativa: false,
      data_fim: hojeISO
    })
    .eq("id", matriculaAtual.id);

  if (error) {
    console.error(error);
    mostrarMensagem("❌ Erro ao desmatricular este curso.", false);
    return;
  }

  mostrarMensagem("✅ Curso desmatriculado com sucesso.");

  const alunoId = selectAluno.value;
  const idAtual = matriculaAtual.id;

  matriculasAluno = await carregarMatriculasDoAluno(alunoId);
  preencherSelectMatriculas();
  preencherResumoDeCursos();
  selectMatricula.value = idAtual;

  const atualizada = matriculasAluno.find((x) => String(x.id) === String(idAtual));
  if (atualizada) preencherBlocoRematricula(atualizada);
});

// =====================
// Rematricular
// =====================
btnRematricular.addEventListener("click", async () => {
  if (!matriculaAtual) {
    mostrarMensagem("⚠️ Selecione um curso desmatriculado.", false);
    return;
  }

  const hojeISO = new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from("matricula")
    .update({
      ativa: true,
      data_fim: null,
      data_inicio: hojeISO
    })
    .eq("id", matriculaAtual.id);

  if (error) {
    console.error(error);
    mostrarMensagem("❌ Erro ao rematricular este curso.", false);
    return;
  }

  mostrarMensagem("✅ Curso rematriculado com sucesso. Agora você já pode editar módulo e professor(a).");

  const alunoId = selectAluno.value;
  const idAtual = matriculaAtual.id;

  matriculasAluno = await carregarMatriculasDoAluno(alunoId);
  preencherSelectMatriculas();
  preencherResumoDeCursos();
  selectMatricula.value = idAtual;

  const atualizada = matriculasAluno.find((x) => String(x.id) === String(idAtual));
  if (atualizada) preencherEdicaoDaMatricula(atualizada);
});

// =====================
// Salvar
// =====================
formEditar.addEventListener("submit", async (e) => {
  e.preventDefault();

  const alunoId = selectAluno.value;
  if (!alunoId) {
    mostrarMensagem("⚠️ Selecione um aluno.", false);
    return;
  }

  const hojeISO = new Date().toISOString().slice(0, 10);

  if (modoCriacao) {
    const materiaId = materiaSel.value;
    const moduloId = moduloSel.value;
    const professorId = professorSel.value;

    if (!materiaId || !moduloId || !professorId) {
      mostrarMensagem("⚠️ Preencha matéria, módulo e professor.", false);
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

    mostrarMensagem("✅ Novo curso adicionado com sucesso.");

    matriculasAluno = await carregarMatriculasDoAluno(alunoId);
    preencherSelectMatriculas();
    preencherResumoDeCursos();
    resetEdicao();
    return;
  }

  if (!matriculaAtual) {
    mostrarMensagem("⚠️ Selecione uma matrícula para editar.", false);
    return;
  }

  const novoModuloId = moduloSel.value;
  const novoProfessorId = professorSel.value;

  if (!novoModuloId || !novoProfessorId) {
    mostrarMensagem("⚠️ Selecione módulo e professor.", false);
    return;
  }

  const { error } = await supabase
    .from("matricula")
    .update({
      modulo_id: novoModuloId,
      professor_id: novoProfessorId
    })
    .eq("id", matriculaAtual.id);

  if (error) {
    console.error(error);
    mostrarMensagem("❌ Erro ao salvar alterações.", false);
    return;
  }

  mostrarMensagem("✅ Alterações salvas.");

  const midAtual = matriculaAtual.id;

  matriculasAluno = await carregarMatriculasDoAluno(alunoId);
  preencherSelectMatriculas();
  preencherResumoDeCursos();
  selectMatricula.value = midAtual;

  const atualizada = matriculasAluno.find((x) => String(x.id) === String(midAtual));
  if (atualizada) preencherEdicaoDaMatricula(atualizada);
});

// init
await carregarBases();