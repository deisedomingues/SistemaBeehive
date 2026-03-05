import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";
await exigirProfessor();


const form = document.getElementById("form-aula");

// Campos do formulário
const inputDataAula = document.getElementById("dataAula");
const selectMatricula = document.getElementById("matricula");
const selectStatus = document.getElementById("status");

const boxJustificativa = document.getElementById("boxJustificativa");
const inputJustificativa = document.getElementById("justificativa");

const inputConteudo = document.getElementById("conteudo");
const inputLicaoCasa = document.getElementById("licaoCasa");

const msg = document.getElementById("msg");

// ======================
// Mensagem pequena (sem popup)
// ======================
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

// ======================
// Data de hoje (auto)
// ======================
function setarDataHoje() {
  const hoje = new Date();
  const yyyy = hoje.getFullYear();
  const mm = String(hoje.getMonth() + 1).padStart(2, "0");
  const dd = String(hoje.getDate()).padStart(2, "0");
  inputDataAula.value = `${yyyy}-${mm}-${dd}`;
}

// ======================
// Regras por status
// Cancelada => justificativa obrigatória + desabilita conteúdo/lição
// ======================
function atualizarTelaPorStatus() {
  const cancelada = selectStatus.value === "Cancelada";

  if (cancelada) {
    boxJustificativa.style.display = "block";
    inputJustificativa.required = true;
  } else {
    boxJustificativa.style.display = "none";
    inputJustificativa.required = false;
    inputJustificativa.value = "";
  }

  inputConteudo.disabled = cancelada;
  inputLicaoCasa.disabled = cancelada;

  // Se cancelou, limpa para não salvar lixo
  if (cancelada) {
    inputConteudo.value = "";
    inputLicaoCasa.value = "";
  }
}

// ======================
// Carregar matrículas filtrando pelo professor logado
// ======================
async function carregarMatriculas() {
  const professorIdLogado = localStorage.getItem("professorId");

  if (!professorIdLogado) {
    // não está logado — manda pro login
    window.location.href = "index.html";
    return;
  }

  let query = supabase
    .from("matricula")
    .select(`
      id,
      aluno:aluno_id ( id, nome ),
      materia:materia_id ( id, nome ),
      modulo:modulo_id ( id, nome ),
      professor_id
    `)
    .eq("professor_id", professorIdLogado)
    .order("id", { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error(error);
    mostrarMensagem("❌ Erro ao carregar alunos", false);
    return;
  }

  selectMatricula.innerHTML = `<option value="">Selecione o aluno (curso)</option>`;

  if (!data || data.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Nenhum aluno vinculado a você ainda";
    selectMatricula.appendChild(opt);
    selectMatricula.disabled = true;
    return;
  }

  selectMatricula.disabled = false;

  data.forEach((m) => {
    const option = document.createElement("option");
    option.value = m.id;
    option.textContent = `${m.aluno.nome} — ${m.materia.nome} (${m.modulo.nome})`;
    selectMatricula.appendChild(option);
  });
}

// ======================
// Inicialização
// ======================
setarDataHoje();
carregarMatriculas();
atualizarTelaPorStatus();

selectStatus.addEventListener("change", atualizarTelaPorStatus);

// ======================
// Salvar aula
// ======================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const professorIdLogado = localStorage.getItem("professorId");
  if (!professorIdLogado) {
    window.location.href = "login.html";
    return;
  }

  const dataAula = inputDataAula.value;
  const matriculaId = selectMatricula.value;
  const status = selectStatus.value;

  const justificativa = inputJustificativa.value.trim();
  const conteudo = inputConteudo.value.trim();
  const licaoCasa = inputLicaoCasa.value.trim();

  if (!matriculaId) {
    mostrarMensagem("⚠️ Selecione um aluno (curso).", false);
    return;
  }

  if (status === "Cancelada" && justificativa.length === 0) {
    mostrarMensagem("⚠️ Preencha a justificativa do cancelamento.", false);
    return;
  }

  const payload = {
    matricula_id: matriculaId,
    data_aula: dataAula,
    status: status,
    justificativa: status === "Cancelada" ? (justificativa || null) : null,
    conteudo: status === "Cancelada" ? null : (conteudo || null),
    licao_casa: status === "Cancelada" ? null : (licaoCasa || null),
  };

  const { error } = await supabase.from("aula").insert([payload]);

  if (error) {
    console.error(error);
    mostrarMensagem("❌ Erro ao salvar aula.", false);
  } else {
    mostrarMensagem("✅ Salvo!");
    form.reset();
    setarDataHoje();
    atualizarTelaPorStatus();
    // mantém a lista carregada (não precisa recarregar)
  }
});
