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
const notaModulo = document.getElementById("notaModulo");

const listaNotas = document.getElementById("listaNotas");

const mediaGeralEl = document.getElementById("mediaGeral");
const filtroModulo = document.getElementById("filtroModulo");

let todasNotas = [];

function mostrarMensagem(texto, ok = true) {

  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";

  setTimeout(() => {
    msg.style.display = "none";
  }, 2200);
}

function limparLista(el) {
  el.innerHTML = "";
}

function formatarDataBR(dataISO) {
  if (!dataISO) return "";
  const [yyyy, mm, dd] = dataISO.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

function hojeISO() {
  return new Date().toISOString().split("T")[0];
}

if (!matriculaId) {
  window.location.href = "resumo-professor.html";
}

// ===============================
// CABEÇALHO
// ===============================

async function carregarCabecalho() {

  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      materia_id,
      modulo_id,
      professor_id,
      aluno:aluno_id ( nome ),
      materia:materia_id ( nome ),
      modulo:modulo_id ( nome ),
      professor:professor_id ( nome )
    `)
    .eq("id", matriculaId)
    .single();

  if (error || !data) {
    mostrarMensagem("Erro ao carregar aluno", false);
    return null;
  }

  tituloAluno.textContent = data.aluno.nome;

  subtituloAluno.textContent =
    `${data.materia.nome} — ${data.modulo.nome} — Prof(a). ${data.professor.nome}`;

  await carregarModulos(data.materia_id, data.modulo_id);

  return data;
}

// ===============================
// MODULOS
// ===============================

async function carregarModulos(materiaId, moduloAtual) {

  const { data, error } = await supabase
    .from("modulo")
    .select("id, nome, ordem")
    .eq("materia_id", materiaId)
    .order("ordem");

  if (error) {
    mostrarMensagem("Erro ao carregar módulos", false);
    return;
  }

  notaModulo.innerHTML = `<option value="">Selecione o módulo</option>`;
  filtroModulo.innerHTML = `<option value="">Todos</option>`;

  data.forEach(m => {

    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.nome;

    if (m.id == moduloAtual)
      opt.selected = true;

    notaModulo.appendChild(opt);

    const optFiltro = document.createElement("option");
    optFiltro.value = m.id;
    optFiltro.textContent = m.nome;

    filtroModulo.appendChild(optFiltro);
  });
}

// ===============================
// AULAS
// ===============================

async function carregarAulas() {

  const { data } = await supabase
    .from("aula")
    .select(`
      data_aula,
      status,
      conteudo,
      licao_casa,
      professor:professor_id ( nome )
    `)
    .eq("matricula_id", matriculaId)
    .order("data_aula");

  return data || [];
}

function preencherContadores(aulas) {

  let p = 0, a = 0, c = 0, t = 0;

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

function renderAulas(aulas) {

  limparLista(listaAulas);

  if (!aulas.length) {
    listaAulas.innerHTML = "<li>Nenhuma aula registrada</li>";
    return;
  }

  aulas.forEach((x, index) => {

    const li = document.createElement("li");

    li.textContent =
      `${index + 1} - ${formatarDataBR(x.data_aula)} — ${x.professor?.nome || ""} — ${x.conteudo || ""} ${x.licao_casa ? " — " + x.licao_casa : ""}`;

    listaAulas.appendChild(li);
  });
}

// ===============================
// NOTAS
// ===============================

async function carregarNotas() {

  const { data } = await supabase
    .from("nota")
    .select(`
      id,
      data,
      tipo,
      valor,
      observacao,
      modulo_id,
      modulo:modulo_id ( nome )
    `)
    .eq("matricula_id", matriculaId)
    .order("data", { ascending: false });

  todasNotas = data || [];

  calcularMediaGeral(todasNotas);
  renderNotas(todasNotas);
}

// ===============================
// RENDER NOTAS
// ===============================

function renderNotas(notas) {

  limparLista(listaNotas);

  if (!notas.length) {

    listaNotas.innerHTML = "<li>Nenhuma nota registrada</li>";
    return;
  }

  notas.forEach(n => {

    const li = document.createElement("li");

    li.textContent =
      `${formatarDataBR(n.data)} — ${n.tipo} — ${n.valor} — ${n.modulo?.nome || ""} ${n.observacao ? " — " + n.observacao : ""}`;

    listaNotas.appendChild(li);
  });
}

// ===============================
// MEDIA GERAL
// ===============================

function calcularMediaGeral(notas) {

  if (!notas.length) {
    mediaGeralEl.textContent = "0.0";
    return;
  }

  let soma = 0;

  notas.forEach(n => soma += n.valor);

  const media = soma / notas.length;

  mediaGeralEl.textContent = media.toFixed(2);
}

// ===============================
// FILTRO
// ===============================

filtroModulo.addEventListener("change", () => {

  const moduloId = Number(filtroModulo.value);

  if (!moduloId) {
    renderNotas(todasNotas);
    calcularMediaGeral(todasNotas);
    return;
  }

  const filtradas = todasNotas.filter(n => n.modulo_id === moduloId);

  renderNotas(filtradas);
  calcularMediaGeral(filtradas);
});

// ===============================
// SALVAR NOTA
// ===============================

formNota.addEventListener("submit", async (e) => {

  e.preventDefault();

  const data = notaData.value;
  const tipo = notaTipo.value.trim();
  const valor = Number(notaValor.value);
  const obs = notaObs.value.trim();
  const moduloId = notaModulo.value;

  if (!data || !tipo || !valor || !moduloId) {
    mostrarMensagem("Preencha todos os campos", false);
    return;
  }

  const { error } = await supabase
    .from("nota")
    .insert([{
      matricula_id: matriculaId,
      data,
      tipo,
      valor,
      observacao: obs || null,
      modulo_id: moduloId
    }]);

  if (error) {
    mostrarMensagem("Erro ao salvar nota", false);
    return;
  }

  mostrarMensagem("Nota salva!");

  formNota.reset();
  notaData.value = hojeISO();
  notaTipo.value = "Avaliação";

  await carregarNotas();
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

  await carregarNotas();
}

init();