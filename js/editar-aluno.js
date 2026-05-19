import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const msg = document.getElementById("msg");
const msgSalvar = document.getElementById("msgSalvar");

const inputAluno = document.getElementById("inputAluno");
const listaSugestoes = document.getElementById("listaSugestoes");
const btnVerMatriculas = document.getElementById("btnVerMatriculas");

const form = document.getElementById("form-editar");
const inputNome = document.getElementById("nome");
const inputData = document.getElementById("dataNascimento");
const inputEmail = document.getElementById("email");
const inputTelefone = document.getElementById("telefone");
const inputEmpresa = document.getElementById("empresa");

const btnSalvar = document.getElementById("btnSalvar");

let alunosCache = [];
let empresasCache = [];
let alunoAtualId = null;

/* =========================
   MENSAGEM DO TOPO
========================= */
function mostrarMensagem(texto, ok = true) {
  if (!msg) return;

  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.padding = "10px";
  msg.style.borderRadius = "8px";
  msg.style.marginBottom = "10px";
  msg.style.fontSize = "14px";

  if (ok) {
    msg.style.background = "#e8f5e9";
    msg.style.color = "#1b5e20";
    msg.style.border = "1px solid #a5d6a7";
  } else {
    msg.style.background = "#ffebee";
    msg.style.color = "#b71c1c";
    msg.style.border = "1px solid #ef9a9a";
  }

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
  }, 3000);
}

/* =========================
   MENSAGEM PERTO DO BOTÃO
========================= */
function mostrarMsgSalvar(texto, ok = true) {
  if (!msgSalvar) return;

  msgSalvar.textContent = texto;
  msgSalvar.style.display = "block";
  msgSalvar.style.marginTop = "10px";
  msgSalvar.style.padding = "10px";
  msgSalvar.style.borderRadius = "8px";
  msgSalvar.style.fontSize = "14px";
  msgSalvar.style.textAlign = "center";

  if (ok) {
    msgSalvar.style.background = "#e8f5e9";
    msgSalvar.style.color = "#1b5e20";
    msgSalvar.style.border = "1px solid #a5d6a7";
  } else {
    msgSalvar.style.background = "#ffebee";
    msgSalvar.style.color = "#b71c1c";
    msgSalvar.style.border = "1px solid #ef9a9a";
  }

  setTimeout(() => {
    msgSalvar.style.display = "none";
    msgSalvar.textContent = "";
  }, 3000);
}

/* =========================
   LIMPAR FORMULÁRIO
========================= */
function limparFormulario() {
  alunoAtualId = null;

  inputNome.value = "";
  inputData.value = "";
  inputEmail.value = "";
  inputTelefone.value = "";
  inputEmpresa.value = "";

  btnSalvar.disabled = true;
  btnSalvar.textContent = "Salvar alterações";

  btnVerMatriculas.disabled = true;
}

/* =========================
   CARREGAR EMPRESAS
========================= */
async function carregarEmpresas() {
  const { data, error } = await supabase
    .from("empresaparceira")
    .select("cnpj, nome")
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao carregar empresas:", error);
    mostrarMensagem("Erro ao carregar empresas.", false);
    return;
  }

  empresasCache = data || [];

  inputEmpresa.innerHTML = "";

  const optionSemEmpresa = document.createElement("option");
  optionSemEmpresa.value = "";
  optionSemEmpresa.textContent = "Sem empresa vinculada";
  inputEmpresa.appendChild(optionSemEmpresa);

  empresasCache.forEach((emp) => {
    const option = document.createElement("option");
    option.value = emp.cnpj;
    option.textContent = emp.nome;
    inputEmpresa.appendChild(option);
  });
}

/* =========================
   CARREGAR ALUNOS COM QUANTIDADE DE CURSOS
========================= */
async function carregarAlunosComQtdCursos() {
  const { data: alunos, error: errAluno } = await supabase
    .from("aluno")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (errAluno) {
    console.error("Erro ao carregar alunos:", errAluno);
    mostrarMensagem("Erro ao carregar alunos.", false);
    return;
  }

  const { data: mats, error: errMat } = await supabase
    .from("matricula")
    .select("aluno_id");

  if (errMat) {
    console.error("Erro ao carregar matrículas:", errMat);
    mostrarMensagem("Erro ao carregar matrículas.", false);
    return;
  }

  const contador = {};

  (mats || []).forEach((m) => {
    const alunoId = String(m.aluno_id);
    contador[alunoId] = (contador[alunoId] || 0) + 1;
  });

  alunosCache = (alunos || []).map((a) => ({
    id: a.id,
    nome: a.nome,
    qtdCursos: contador[String(a.id)] || 0
  }));
}

/* =========================
   MOSTRAR SUGESTÕES
========================= */
function mostrarSugestoes(lista) {
  listaSugestoes.innerHTML = "";

  if (!lista || lista.length === 0) {
    listaSugestoes.style.display = "none";
    return;
  }

  lista.forEach((aluno) => {
    const div = document.createElement("div");

    div.className = "item-sugestao";
    div.textContent = `${aluno.nome} (${aluno.qtdCursos} curso${aluno.qtdCursos === 1 ? "" : "s"})`;

    div.addEventListener("click", () => {
      selecionarAluno(aluno);
    });

    listaSugestoes.appendChild(div);
  });

  listaSugestoes.style.display = "block";
}

/* =========================
   CARREGAR ALUNO POR ID
========================= */
async function carregarAlunoPorId(id) {
  const { data, error } = await supabase
    .from("aluno")
    .select("id, nome, data_nascimento, email, telefone, empresa_cnpj")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Erro ao carregar dados do aluno:", error);
    mostrarMensagem("Erro ao carregar dados do aluno.", false);
    return null;
  }

  return data;
}

/* =========================
   SELECIONAR ALUNO
========================= */
async function selecionarAluno(aluno) {
  alunoAtualId = aluno.id;

  inputAluno.value = aluno.nome;
  listaSugestoes.style.display = "none";

  const dados = await carregarAlunoPorId(aluno.id);

  if (!dados) {
    limparFormulario();
    return;
  }

  inputNome.value = dados.nome || "";
  inputData.value = dados.data_nascimento || "";
  inputEmail.value = dados.email || "";
  inputTelefone.value = dados.telefone || "";
  inputEmpresa.value = dados.empresa_cnpj || "";

  btnSalvar.disabled = false;
  btnSalvar.textContent = "Salvar alterações";

  btnVerMatriculas.disabled = false;
}

/* =========================
   BUSCAR ALUNO
========================= */
inputAluno.addEventListener("input", () => {
  const texto = inputAluno.value.toLowerCase().trim();

  if (!texto) {
    listaSugestoes.style.display = "none";
    limparFormulario();
    return;
  }

  const filtrados = alunosCache.filter((a) =>
    a.nome.toLowerCase().includes(texto)
  );

  mostrarSugestoes(filtrados);
});

/* =========================
   VER MATRÍCULAS
========================= */
btnVerMatriculas.addEventListener("click", () => {
  if (!alunoAtualId) {
    mostrarMensagem("Selecione um aluno.", false);
    return;
  }

  localStorage.setItem("alunoSelecionadoAdmin", alunoAtualId);
  window.location.href = "editar-matriculas.html";
});

/* =========================
   SALVAR ALTERAÇÕES
========================= */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!alunoAtualId) {
    mostrarMsgSalvar("Selecione um aluno antes de salvar.", false);
    return;
  }

  const nome = inputNome.value.trim();
  const dataNascimento = inputData.value || null;
  const email = inputEmail.value.trim().toLowerCase();
  const telefone = inputTelefone.value.trim();
  const empresa = inputEmpresa.value || null;

  if (!nome) {
    mostrarMsgSalvar("Preencha o nome do aluno.", false);
    return;
  }

  btnSalvar.disabled = true;
  btnSalvar.textContent = "Salvando...";

  const patch = {
    nome,
    data_nascimento: dataNascimento,
    email: email || null,
    telefone: telefone || null,
    empresa_cnpj: empresa
  };

  try {
    const { error } = await supabase
      .from("aluno")
      .update(patch)
      .eq("id", alunoAtualId);

    if (error) {
      console.error("Erro ao salvar alterações:", error);
      mostrarMsgSalvar("Erro ao salvar alterações. Verifique os dados e tente novamente.", false);
      return;
    }

    btnSalvar.textContent = "✔ Salvo";
    mostrarMsgSalvar("Salvo com sucesso!", true);

    await carregarAlunosComQtdCursos();

    const alunoAtualizado = alunosCache.find((a) => Number(a.id) === Number(alunoAtualId));
    if (alunoAtualizado) {
      inputAluno.value = alunoAtualizado.nome;
    }

  } catch (erro) {
    console.error("Erro inesperado ao salvar:", erro);
    mostrarMsgSalvar("Erro inesperado ao salvar. Veja o console para detalhes.", false);

  } finally {
    setTimeout(() => {
      btnSalvar.textContent = "Salvar alterações";
      btnSalvar.disabled = false;
    }, 1200);
  }
});

/* =========================
   FECHAR SUGESTÕES AO CLICAR FORA
========================= */
document.addEventListener("click", (e) => {
  const clicouNoInput = inputAluno.contains(e.target);
  const clicouNaLista = listaSugestoes.contains(e.target);

  if (!clicouNoInput && !clicouNaLista) {
    listaSugestoes.style.display = "none";
  }
});

/* =========================
   INICIALIZAÇÃO
========================= */
limparFormulario();

await carregarEmpresas();
await carregarAlunosComQtdCursos();