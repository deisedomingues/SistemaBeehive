import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const msg = document.getElementById("msg");

const inputAluno = document.getElementById("inputAluno");
const listaSugestoes = document.getElementById("listaSugestoes");
const btnVerMatriculas = document.getElementById("btnVerMatriculas");

const form = document.getElementById("form-editar");
const inputNome = document.getElementById("nome");
const inputData = document.getElementById("dataNascimento");
const inputEmail = document.getElementById("email");
const inputTelefone = document.getElementById("telefone");
const btnSalvar = document.getElementById("btnSalvar");

let alunosCache = [];
let alunoAtualId = null;

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

function limparFormulario() {

  alunoAtualId = null;

  inputNome.value = "";
  inputData.value = "";
  inputEmail.value = "";
  inputTelefone.value = "";

  btnSalvar.disabled = true;
  btnVerMatriculas.disabled = true;

}

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

  btnSalvar.disabled = false;
  btnVerMatriculas.disabled = false;

}

async function carregarAlunoPorId(id) {

  const { data, error } = await supabase
    .from("aluno")
    .select("id, nome, data_nascimento, email, telefone")
    .eq("id", id)
    .single();

  if (error) {

    console.error(error);
    mostrarMensagem("Erro ao carregar dados do aluno", false);
    return null;

  }

  return data;

}

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

btnVerMatriculas.addEventListener("click", () => {

  if (!alunoAtualId) {

    mostrarMensagem("Selecione um aluno", false);
    return;

  }

  localStorage.setItem("alunoSelecionadoAdmin", alunoAtualId);

  window.location.href = "editar-matriculas.html";

});

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

  if (!nome || !dataNascimento) {

    mostrarMensagem("Preencha nome e data de nascimento", false);
    return;

  }

  const patch = {

    nome,
    data_nascimento: dataNascimento,
    email: email || null,
    telefone: telefone || null

  };

  const { error } = await supabase
    .from("aluno")
    .update(patch)
    .eq("id", alunoAtualId);

  if (error) {

    console.error(error);
    mostrarMensagem("Erro ao salvar alterações", false);
    return;

  }

  mostrarMensagem("Salvo!");

  await carregarAlunosComQtdCursos();

});

// inicialização
limparFormulario();
carregarAlunosComQtdCursos();