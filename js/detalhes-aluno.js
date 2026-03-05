import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

const professorId = localStorage.getItem("professorId");
const matriculaId = localStorage.getItem("matriculaSelecionada");

// elementos
const msg = document.getElementById("msg");
const tituloAluno = document.getElementById("tituloAluno");
const subtituloAluno = document.getElementById("subtituloAluno");

const cPresente = document.getElementById("cPresente");
const cAusente = document.getElementById("cAusente");
const cCancelada = document.getElementById("cCancelada");
const cTrancada = document.getElementById("cTrancada");

const listaAulas = document.getElementById("listaAulas");

const formNota = document.getElementById("form-nota");
const notaData = document.getElementById("notaData");
const notaTipo = document.getElementById("notaTipo");
const notaValor = document.getElementById("notaValor");
const notaObs = document.getElementById("notaObs");
const listaNotas = document.getElementById("listaNotas");

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

function limparLista(ul) {
  ul.innerHTML = "";
}

function addLi(ul, texto) {
  const li = document.createElement("li");
  li.textContent = texto;
  ul.appendChild(li);
}

function formatarDataBR(dataISO) {
  // "YYYY-MM-DD" -> "DD/MM/YYYY"
  if (!dataISO) return "";
  const [yyyy, mm, dd] = dataISO.split("-");
  if (!yyyy || !mm || !dd) return dataISO;
  return `${dd}/${mm}/${yyyy}`;
}

function hojeISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ✅ Proteção: se não houver matrícula selecionada, voltar
if (!matriculaId) {
  window.location.href = "resumo-professor.html";
}

// ===============================
// 1) Carregar dados da matrícula (aluno/matéria/módulo/professor)
// ===============================
async function carregarCabecalho() {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      professor_id,
      aluno:aluno_id ( id, nome ),
      materia:materia_id ( id, nome ),
      modulo:modulo_id ( id, nome ),
      professor:professor_id ( id, nome )
    `)
    .eq("id", matriculaId)
    .single();

  if (error || !data) {
    console.error(error);
    mostrarMensagem("❌ Não foi possível carregar a matrícula.", false);
    return null;
  }

  // ✅ Segurança extra: professor só vê matrícula dele
  if (String(data.professor_id) !== String(professorId)) {
    window.location.href = "home-professor.html";
    return null;
  }

  tituloAluno.textContent = data.aluno?.nome || "Aluno";
  subtituloAluno.textContent = `${data.materia?.nome || ""} — ${data.modulo?.nome || ""} — Prof(a). ${data.professor?.nome || ""}`;

  return data;
}

// ===============================
// 2) Carregar aulas da matrícula (histórico)
// ===============================
async function carregarAulas() {
  const { data, error } = await supabase
    .from("aula")
    .select(`
      id,
      data_aula,
      status,
      justificativa,
      conteudo,
      licao_casa,
      matricula:matricula_id (
        professor:professor_id ( nome )
      )
    `)
    .eq("matricula_id", matriculaId)
    .order("data_aula", { ascending: true });

  if (error) {
    console.error(error);
    mostrarMensagem("❌ Erro ao carregar aulas.", false);
    return [];
  }

  return data || [];
}

// ===============================
// 3) Contadores por status
// ===============================
function preencherContadores(aulas) {
  let p = 0, a = 0, c = 0, t = 0;

  aulas.forEach((x) => {
    if (x.status === "Presente") p++;
    else if (x.status === "Ausente") a++;
    else if (x.status === "Cancelada") c++;
    else if (x.status === "Trancada") t++;
  });

  cPresente.textContent = p;
  cAusente.textContent = a;
  cCancelada.textContent = c;
  cTrancada.textContent = t;
}

// ===============================
// 4) Render histórico de aulas
// ===============================
function renderAulas(aulas) {
  limparLista(listaAulas);

  if (aulas.length === 0) {
    addLi(listaAulas, "Nenhuma aula registrada ainda.");
    return;
  }

  aulas.forEach((x) => {
    const dataBR = formatarDataBR(x.data_aula);
    const profNome = x.matricula?.professor?.nome || "Professor(a)";
    const conteudo = x.conteudo ? x.conteudo : "(sem conteúdo)";
    const licao = x.licao_casa ? ` | Lição: ${x.licao_casa}` : "";
    const statusExtra =
      x.status !== "Presente"
        ? ` | ${x.status}${x.justificativa ? ` (${x.justificativa})` : ""}`
        : "";

    addLi(listaAulas, `${dataBR} — ${profNome} — ${conteudo}${licao}${statusExtra}`);
  });
}

// ===============================
// 5) Notas: listar e inserir
// ===============================
async function carregarNotas() {
  const { data, error } = await supabase
    .from("nota")
    .select("id, data, tipo, valor, observacao")
    .eq("matricula_id", matriculaId)
    .order("data", { ascending: false });

  if (error) {
    console.error(error);
    mostrarMensagem("❌ Erro ao carregar notas.", false);
    return [];
  }

  return data || [];
}

function renderNotas(notas) {
  limparLista(listaNotas);

  if (notas.length === 0) {
    addLi(listaNotas, "Nenhuma nota registrada ainda.");
    return;
  }

  notas.forEach((n) => {
    const dataBR = formatarDataBR(n.data);
    const obs = n.observacao ? ` — ${n.observacao}` : "";
    addLi(listaNotas, `${dataBR} — ${n.tipo}: ${n.valor}${obs}`);
  });
}

formNota.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = notaData.value;
  const tipo = notaTipo.value.trim();
  const valor = Number(notaValor.value);
  const obs = notaObs.value.trim();

  if (!data || !tipo || Number.isNaN(valor)) {
    mostrarMensagem("⚠️ Preencha data, tipo e nota.", false);
    return;
  }

  const { error } = await supabase
    .from("nota")
    .insert([{
      matricula_id: matriculaId,
      data,
      tipo,
      valor,
      observacao: obs || null
    }]);

  if (error) {
    console.error(error);
    mostrarMensagem("❌ Erro ao salvar nota.", false);
    return;
  }

  mostrarMensagem("✅ Nota salva!");
  formNota.reset();
  notaData.value = hojeISO();
  notaTipo.value = "Avaliação";

  const notas = await carregarNotas();
  renderNotas(notas);
});

// ===============================
// INIT
// ===============================
async function init() {
  // valores padrão no form
  notaData.value = hojeISO();
  notaTipo.value = "Avaliação";

  const cab = await carregarCabecalho();
  if (!cab) return;

  const aulas = await carregarAulas();
  preencherContadores(aulas);
  renderAulas(aulas);

  const notas = await carregarNotas();
  renderNotas(notas);
}

init();
