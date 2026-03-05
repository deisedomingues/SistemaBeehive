import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const msg = document.getElementById("msg");

const busca = document.getElementById("busca");
const selectAluno = document.getElementById("selectAluno");
const btnVerMatriculas = document.getElementById("btnVerMatriculas");

const form = document.getElementById("form-editar");
const inputNome = document.getElementById("nome");
const inputData = document.getElementById("dataNascimento");
const inputEmail = document.getElementById("email");
const inputTelefone = document.getElementById("telefone");
const btnSalvar = document.getElementById("btnSalvar");

// cache local dos alunos carregados para filtrar rapidamente
let alunosCache = []; // [{id, nome, qtdCursos}]
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

function preencherSelectAlunos(lista, manterId = null) {
  selectAluno.innerHTML = `<option value="">Selecione o aluno</option>`;

  (lista || []).forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a.id;
    opt.textContent = `${a.nome} (${a.qtdCursos} curso${a.qtdCursos === 1 ? "" : "s"})`;
    selectAluno.appendChild(opt);
  });

  if (manterId) {
    selectAluno.value = manterId;
  }
}

function filtrarPorNome(texto) {
  const t = (texto || "").trim().toLowerCase();
  if (!t) return alunosCache;

  return alunosCache.filter((a) => a.nome.toLowerCase().includes(t));
}

async function carregarAlunosComQtdCursos() {
  // 1) buscar alunos
  const { data: alunos, error: errAluno } = await supabase
    .from("aluno")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (errAluno) {
    console.error(errAluno);
    mostrarMensagem("❌ Erro ao carregar alunos.", false);
    return;
  }

  // 2) buscar matrículas (só aluno_id) para contagem
  const { data: mats, error: errMat } = await supabase
    .from("matricula")
    .select("aluno_id");

  if (errMat) {
    console.error(errMat);
    mostrarMensagem("❌ Erro ao carregar matrículas.", false);
    return;
  }

  // 3) contar por aluno_id
  const contador = {};
  (mats || []).forEach((m) => {
    const aid = String(m.aluno_id);
    contador[aid] = (contador[aid] || 0) + 1;
  });

  // 4) montar cache final
  alunosCache = (alunos || []).map((a) => ({
    id: a.id,
    nome: a.nome,
    qtdCursos: contador[String(a.id)] || 0
  }));

  // preencher select (sem filtro inicialmente)
  preencherSelectAlunos(alunosCache);
}

async function carregarAlunoPorId(id) {
  const { data, error } = await supabase
    .from("aluno")
    .select("id, nome, data_nascimento, email, telefone")
    .eq("id", id)
    .single();

  if (error) {
    console.error(error);
    mostrarMensagem("❌ Erro ao carregar dados do aluno.", false);
    return null;
  }
  return data;
}

busca.addEventListener("input", () => {
  const lista = filtrarPorNome(busca.value);

  // mantém selecionado se ainda estiver na lista filtrada
  const manter = alunoAtualId && lista.some((a) => String(a.id) === String(alunoAtualId))
    ? alunoAtualId
    : null;

  preencherSelectAlunos(lista, manter);
});

selectAluno.addEventListener("change", async () => {
  const id = selectAluno.value;
  limparFormulario();

  if (!id) return;

  const aluno = await carregarAlunoPorId(id);
  if (!aluno) return;

  alunoAtualId = aluno.id;

  inputNome.value = aluno.nome || "";
  inputData.value = aluno.data_nascimento || "";
  inputEmail.value = aluno.email || "";
  inputTelefone.value = aluno.telefone || "";

  btnSalvar.disabled = false;
  btnVerMatriculas.disabled = false;
});

btnVerMatriculas.addEventListener("click", () => {
  if (!alunoAtualId) {
    mostrarMensagem("⚠️ Selecione um aluno.", false);
    return;
  }

  // salva para a outra tela já abrir no aluno correto
  localStorage.setItem("alunoSelecionadoAdmin", alunoAtualId);

  // abre a tela de editar matrículas
  window.location.href = "editar-matriculas.html";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!alunoAtualId) {
    mostrarMensagem("⚠️ Selecione um aluno.", false);
    return;
  }

  const nome = inputNome.value.trim();
  const dataNascimento = inputData.value;
  const email = inputEmail.value.trim().toLowerCase();
  const telefone = inputTelefone.value.trim();

  if (!nome || !dataNascimento) {
    mostrarMensagem("⚠️ Preencha nome e data de nascimento.", false);
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
    mostrarMensagem("❌ Erro ao salvar alterações.", false);
    return;
  }

  mostrarMensagem("✅ Salvo!");

  // Recarrega lista + contagem, e mantém selecionado
  await carregarAlunosComQtdCursos();

  // reaplica filtro
  const lista = filtrarPorNome(busca.value);
  preencherSelectAlunos(lista, alunoAtualId);
});

// init
limparFormulario();
carregarAlunosComQtdCursos();
