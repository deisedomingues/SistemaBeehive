import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";
await exigirAdmin();

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

// ===============================
// MENSAGEM
// ===============================
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

// ===============================
function limparLista(ul) {
  ul.innerHTML = "";
}

function addLi(ul, texto) {
  const li = document.createElement("li");
  li.textContent = texto;
  ul.appendChild(li);
}

function formatarDataBR(dataISO) {
  if (!dataISO) return "";
  const [yyyy, mm, dd] = dataISO.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

function hojeISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// proteção
if (!matriculaId) {
  window.location.href = "resumo-professor.html";
}

// ===============================
// CONFIRMAR EXCLUSÃO (perto da aula)
// ===============================
function confirmarExclusao(li, aulaId, textoAula) {

  // evita várias caixas abertas
  const existente = li.querySelector(".confirmacao-exclusao");
  if (existente) return;

  const caixa = document.createElement("div");
  caixa.className = "confirmacao-exclusao";

  caixa.style.marginTop = "6px";
  caixa.style.padding = "8px";
  caixa.style.background = "#fff3e0";
  caixa.style.border = "1px solid #ffe0b2";
  caixa.style.borderRadius = "6px";
  caixa.style.fontSize = "12px";

  caixa.innerHTML = `
    ⚠️ Confirma excluir esta aula?
    <br>
    <b>${textoAula}</b>
    <br><br>
    <button class="btnSimExcluir" style="margin-right:6px; padding:4px 10px; cursor:pointer;">
      Sim
    </button>
    <button class="btnNaoExcluir" style="padding:4px 10px; cursor:pointer;">
      Não
    </button>
  `;

  li.appendChild(caixa);

  caixa.querySelector(".btnSimExcluir").onclick = async () => {
    await excluirAula(aulaId);
  };

  caixa.querySelector(".btnNaoExcluir").onclick = () => {
    caixa.remove();
  };
}

// ===============================
// EXCLUIR AULA
// ===============================
async function excluirAula(aulaId) {

  const { error } = await supabase
    .from("aula")
    .delete()
    .eq("id", aulaId);

  if (error) {
    console.error(error);
    mostrarMensagem("❌ Erro ao excluir aula.", false);
    return;
  }

  mostrarMensagem("🗑️ Aula excluída com sucesso!");

  const aulas = await carregarAulas();
  preencherContadores(aulas);
  renderAulas(aulas);
}

// ===============================
// 1) Cabeçalho
// ===============================
async function carregarCabecalho() {

  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      professor_id,
      aluno:aluno_id ( nome ),
      materia:materia_id ( nome ),
      modulo:modulo_id ( nome ),
      professor:professor_id ( nome )
    `)
    .eq("id", matriculaId)
    .single();

  if (error || !data) {
    console.error(error);
    mostrarMensagem("❌ Não foi possível carregar a matrícula.", false);
    return null;
  }

  tituloAluno.textContent = data.aluno?.nome || "Aluno";

  subtituloAluno.textContent =
    `${data.materia?.nome || ""} — ${data.modulo?.nome || ""} — Prof(a). ${data.professor?.nome || ""}`;

  return data;
}

// ===============================
// 2) Carregar aulas
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
      professor:professor_id ( nome )
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
// 3) Contadores
// ===============================
function preencherContadores(aulas) {

  let p = 0;
  let a = 0;
  let c = 0;
  let t = 0;

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
// 4) Render histórico com X
// ===============================
function renderAulas(aulas) {

  limparLista(listaAulas);

  if (aulas.length === 0) {
    addLi(listaAulas, "Nenhuma aula registrada ainda.");
    return;
  }

  aulas.forEach((x) => {

    const li = document.createElement("li");
    li.style.marginBottom = "8px";

    const dataBR = formatarDataBR(x.data_aula);
    const professorNome = x.professor?.nome || "Professor";
    const conteudo = x.conteudo || "(sem conteúdo)";
    const licao = x.licao_casa ? ` | Lição: ${x.licao_casa}` : "";

    const statusExtra =
      x.status !== "Presente"
        ? ` | ${x.status}${x.justificativa ? ` (${x.justificativa})` : ""}`
        : "";

    const texto =
      `${dataBR} — ${professorNome} — ${conteudo}${licao}${statusExtra}`;

    const span = document.createElement("span");
    span.textContent = texto;

    const btnExcluir = document.createElement("button");
    btnExcluir.textContent = "✖";
    btnExcluir.style.marginLeft = "10px";
    btnExcluir.style.padding = "3px 7px";
    btnExcluir.style.fontSize = "12px";
    btnExcluir.style.background = "#ffebee";
    btnExcluir.style.border = "1px solid #ffcdd2";
    btnExcluir.style.cursor = "pointer";
    btnExcluir.style.borderRadius = "5px";

    btnExcluir.onclick = () => confirmarExclusao(li, x.id, texto);

    li.appendChild(span);
    li.appendChild(btnExcluir);

    listaAulas.appendChild(li);
  });
}

// ===============================
// 5) NOTAS
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

    addLi(
      listaNotas,
      `${dataBR} — ${n.tipo}: ${n.valor}${obs}`
    );

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