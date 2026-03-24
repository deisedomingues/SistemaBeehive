import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const matriculaId = localStorage.getItem("matriculaSelecionada");

// ===============================
// ELEMENTOS
// ===============================
const msg = document.getElementById("msg");

const tituloAluno = document.getElementById("tituloAluno");
const subtituloAluno = document.getElementById("subtituloAluno");

const listaAulas = document.getElementById("listaAulas");

const cPresente = document.getElementById("cPresente");
const cAusente = document.getElementById("cAusente");
const cCancelada = document.getElementById("cCancelada");
const cTrancada = document.getElementById("cTrancada");

const listaNotas = document.getElementById("listaNotas");

const mediaGeral = document.getElementById("mediaGeral");
const totalNotas = document.getElementById("totalNotas");
const mediaPorModulo = document.getElementById("mediaPorModulo");

// proteção
if (!matriculaId) {
  window.location.href = "resumo-geral.html";
}

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
// UTIL
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

// ===============================
// CABEÇALHO
// ===============================
async function carregarCabecalho() {

  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno:aluno_id ( nome ),
      materia:materia_id ( nome ),
      modulo:modulo_id ( nome ),
      professor:professor_id ( nome )
    `)
    .eq("id", matriculaId)
    .single();

  if (error || !data) {
    console.error(error);
    mostrarMensagem("Erro ao carregar aluno", false);
    return;
  }

  tituloAluno.textContent = data.aluno?.nome || "Aluno";

  subtituloAluno.textContent =
    `${data.materia?.nome || ""} — ${data.modulo?.nome || ""} — Prof(a). ${data.professor?.nome || ""}`;
}

// ===============================
// AULAS
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
    mostrarMensagem("Erro ao carregar aulas", false);
    return [];
  }

  return data || [];
}

// ===============================
function preencherContadores(aulas) {

  let p = 0;
  let a = 0;
  let c = 0;
  let t = 0;

  aulas.forEach(x => {

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
function renderAulas(aulas) {

  limparLista(listaAulas);

  if (aulas.length === 0) {
    addLi(listaAulas, "Nenhuma aula registrada.");
    return;
  }

  aulas.forEach(x => {

    const li = document.createElement("li");

    const dataBR = formatarDataBR(x.data_aula);

    const professor = x.professor?.nome || "Professor";

    const conteudo = x.conteudo || "(sem conteúdo)";

    const licao = x.licao_casa ? ` | Lição: ${x.licao_casa}` : "";

    const statusExtra =
      x.status !== "Presente"
        ? ` | ${x.status}${x.justificativa ? ` (${x.justificativa})` : ""}`
        : "";

    const texto =
      `${dataBR} — ${professor} — ${conteudo}${licao}${statusExtra}`;

    const span = document.createElement("span");
    span.textContent = texto;

    const btnExcluir = document.createElement("button");
    btnExcluir.textContent = "✖";
    btnExcluir.style.marginLeft = "10px";
    btnExcluir.style.cursor = "pointer";

    btnExcluir.onclick = async () => {

      if (!confirm("Excluir esta aula?")) return;

      await supabase
        .from("aula")
        .delete()
        .eq("id", x.id);

      mostrarMensagem("Aula excluída");

      init();
    };

    li.appendChild(span);
    li.appendChild(btnExcluir);

    listaAulas.appendChild(li);
  });
}

// ===============================
// NOTAS
// ===============================
async function carregarNotas() {

  const { data, error } = await supabase
    .from("nota")
    .select(`
      id,
      data,
      tipo,
      valor,
      observacao,
      matricula:matricula_id (
        modulo:modulo_id ( nome )
      )
    `)
    .eq("matricula_id", matriculaId)
    .order("data", { ascending: false });

  if (error) {
    console.error(error);
    mostrarMensagem("Erro ao carregar notas", false);
    return [];
  }

  return data || [];
}

// ===============================
function renderNotas(notas) {

  limparLista(listaNotas);

  if (notas.length === 0) {
    addLi(listaNotas, "Nenhuma nota registrada.");
    return;
  }

  notas.forEach(n => {

    const li = document.createElement("li");

    const dataBR = formatarDataBR(n.data);

    const modulo =
      n.matricula?.modulo?.nome || "Sem módulo";

    const obs =
      n.observacao ? ` — ${n.observacao}` : "";

    const texto =
      `${dataBR} — ${n.tipo} — ${modulo} — ${n.valor}${obs}`;

    const span = document.createElement("span");
    span.textContent = texto;

    const btnExcluir = document.createElement("button");
    btnExcluir.textContent = "🗑";
    btnExcluir.style.marginLeft = "10px";
    btnExcluir.style.cursor = "pointer";

    btnExcluir.onclick = async () => {

      if (!confirm("Excluir esta nota?")) return;

      await supabase
        .from("nota")
        .delete()
        .eq("id", n.id);

      mostrarMensagem("Nota excluída");

      init();
    };

    li.appendChild(span);
    li.appendChild(btnExcluir);

    listaNotas.appendChild(li);
  });
}

// ===============================
// MÉDIAS
// ===============================
function calcularMedias(notas) {

  if (notas.length === 0) {

    mediaGeral.textContent = "-";
    totalNotas.textContent = "0";
    mediaPorModulo.textContent = "Nenhuma média";

    return;
  }

  // média geral
  let soma = 0;

  notas.forEach(n => {
    soma += Number(n.valor);
  });

  const media = soma / notas.length;

  mediaGeral.textContent = media.toFixed(2);
  totalNotas.textContent = notas.length;

  // média por módulo
  const modulos = {};

  notas.forEach(n => {

    const nome =
      n.matricula?.modulo?.nome || "Sem módulo";

    if (!modulos[nome]) {
      modulos[nome] = [];
    }

    modulos[nome].push(Number(n.valor));
  });

  mediaPorModulo.innerHTML = "";

  Object.keys(modulos).forEach(m => {

    const lista = modulos[m];

    let somaModulo = 0;

    lista.forEach(v => somaModulo += v);

    const mediaModulo = somaModulo / lista.length;

    const p = document.createElement("p");

    p.textContent =
      `${m}: ${mediaModulo.toFixed(2)} (${lista.length} avaliações)`;

    mediaPorModulo.appendChild(p);
  });
}

// ===============================
// INIT
// ===============================
async function init() {

  await carregarCabecalho();

  const aulas = await carregarAulas();
  preencherContadores(aulas);
  renderAulas(aulas);

  const notas = await carregarNotas();
  renderNotas(notas);
  calcularMedias(notas);
}

init();