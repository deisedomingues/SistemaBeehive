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
   MENSAGEM TOPO
========================= */


/* =========================
   MENSAGEM PERTO DO BOTÃO
========================= */
function mostrarMsgSalvar(texto, ok = true) {

  if (!msgSalvar) return;

  msgSalvar.className = ok ? "msg-sucesso" : "msg-erro";

  msgSalvar.textContent = texto;
  msgSalvar.style.display = "block";

  setTimeout(() => {
    msgSalvar.style.display = "none";
    msgSalvar.textContent = "";
  }, 2500);
}

/* =========================
   LIMPAR FORM
========================= */
function limparFormulario() {

  alunoAtualId = null;

  inputNome.value = "";
  inputData.value = "";
  inputEmail.value = "";
  inputTelefone.value = "";
  inputEmpresa.value = "";

  btnSalvar.disabled = true;
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
    console.error(error);
    mostrarMensagem("Erro ao carregar empresas", false);
    return;
  }

  empresasCache = data || [];

  inputEmpresa.innerHTML = "";

  empresasCache.forEach((emp) => {

    const option = document.createElement("option");

    option.value = emp.cnpj;
    option.textContent = emp.nome;

    inputEmpresa.appendChild(option);

  });
}

/* =========================
   CARREGAR ALUNOS
========================= */
async function carregarAlunosComQtdCursos() {

  const { data: alunos, error: errAluno } = await supabase
    .from("aluno")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (errAluno) {
    console.error(errAluno);
    mostrarMensagem("Erro ao carregar alunos", false);
    return;
  }

  const { data: mats, error: errMat } = await supabase
    .from("matricula")
    .select("aluno_id");

  if (errMat) {
    console.error(errMat);
    mostrarMensagem("Erro ao carregar matrículas", false);
    return;
  }

  const contador = {};

  (mats || []).forEach((m) => {
    const aid = String(m.aluno_id);
    contador[aid] = (contador[aid] || 0) + 1;
  });

  alunosCache = (alunos || []).map((a) => ({
    id: a.id,
    nome: a.nome,
    qtdCursos: contador[String(a.id)] || 0
  }));
}

/* =========================
   SUGESTÕES
========================= */
function mostrarSugestoes(lista) {

  listaSugestoes.innerHTML = "";

  if (lista.length === 0) {
    listaSugestoes.style.display = "none";
    return;
  }

  lista.forEach((aluno) => {

    const div = document.createElement("div");

    div.className = "item-sugestao";

    div.textContent =
      `${aluno.nome} (${aluno.qtdCursos} curso${aluno.qtdCursos === 1 ? "" : "s"})`;

    div.onclick = () => selecionarAluno(aluno);

    listaSugestoes.appendChild(div);
  });

  listaSugestoes.style.display = "block";
}

/* =========================
   SELECIONAR ALUNO
========================= */
async function selecionarAluno(aluno) {

  alunoAtualId = aluno.id;

  inputAluno.value = aluno.nome;
  listaSugestoes.style.display = "none";

  const dados = await carregarAlunoPorId(aluno.id);

  if (!dados) return;

  inputNome.value = dados.nome || "";
  inputData.value = dados.data_nascimento || "";
  inputEmail.value = dados.email || "";
  inputTelefone.value = dados.telefone || "";
  inputEmpresa.value = dados.empresa_cnpj || "";

  btnSalvar.disabled = false;
  btnVerMatriculas.disabled = false;
}

/* =========================
   CARREGAR ALUNO
========================= */
async function carregarAlunoPorId(id) {

  const { data, error } = await supabase
    .from("aluno")
    .select("id, nome, data_nascimento, email, telefone, empresa_cnpj")
    .eq("id", id)
    .single();

  if (error) {
    console.error(error);
    mostrarMensagem("Erro ao carregar dados do aluno", false);
    return null;
  }

  return data;
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

  const filtrados = alunosCache.filter(a =>
    a.nome.toLowerCase().includes(texto)
  );

  mostrarSugestoes(filtrados);
});

/* =========================
   VER MATRÍCULAS
========================= */
btnVerMatriculas.addEventListener("click", () => {

  if (!alunoAtualId) {
    mostrarMensagem("Selecione um aluno", false);
    return;
  }

  localStorage.setItem("alunoSelecionadoAdmin", alunoAtualId);
  window.location.href = "editar-matriculas.html";
});

/* =========================
   SALVAR
========================= */
form.addEventListener("submit", async (e) => {

  e.preventDefault();

  if (!alunoAtualId) {
    mostrarMensagem("Selecione um aluno", false);
    return;
  }

  const nome = inputNome.value.trim();
  const dataNascimento = inputData.value;
  const email = inputEmail.value.trim().toLowerCase();
  const telefone = inputTelefone.value.trim();
  const empresa = inputEmpresa.value;

  if (!nome || !dataNascimento) {
    mostrarMensagem("Preencha nome e data de nascimento", false);
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

  const { error } = await supabase
    .from("aluno")
    .update(patch)
    .eq("id", alunoAtualId);

  if (error) {
    console.error(error);
    mostrarMensagem("Erro ao salvar alterações", false);
    btnSalvar.disabled = false;
    btnSalvar.textContent = "Salvar alterações";
    return;
  }

  btnSalvar.textContent = "✔ Salvo";

  mostrarMsgSalvar("Salvo com sucesso!");

  setTimeout(() => {
    btnSalvar.textContent = "Salvar alterações";
    btnSalvar.disabled = false;
  }, 2000);

  await carregarAlunosComQtdCursos();
});

/* =========================
   INICIALIZAÇÃO
========================= */
limparFormulario();
await carregarEmpresas();
await carregarAlunosComQtdCursos();