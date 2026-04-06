import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

const professorId = localStorage.getItem("professorId");
const matriculaId = localStorage.getItem("matriculaSelecionada");

// ===============================
// ELEMENTOS
// ===============================

const msg = document.getElementById("msg");
const tituloAluno = document.getElementById("tituloAluno");
const subtituloAluno = document.getElementById("subtituloAluno");

const cPresente = document.getElementById("cPresente");
const cAusente = document.getElementById("cAusente");
const cCancelada = document.getElementById("cCancelada");
const cTrancada = document.getElementById("cTrancada");
const cReposicao = document.getElementById("cReposicao");

const listaAulas = document.getElementById("listaAulas");
const listaReposicoes = document.getElementById("listaReposicoes");

const formNota = document.getElementById("form-nota");
const notaData = document.getElementById("notaData");
const notaTipo = document.getElementById("notaTipo");
const notaValor = document.getElementById("notaValor");
const notaObs = document.getElementById("notaObs");
const notaModulo = document.getElementById("notaModulo");

const listaNotas = document.getElementById("listaNotas");

const mediaGeralEl = document.getElementById("mediaGeral");

// filtro das notas
const filtroModulo = document.getElementById("filtroModulo");

// filtro do histórico de aulas
const filtroModuloAula = document.getElementById("filtroModuloAula");

let todasNotas = [];
let todasAulas = [];

// ===============================
// FUNÇÕES AUXILIARES
// ===============================

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
  if (!el) return;
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
    console.error(error);
    mostrarMensagem("Erro ao carregar aluno", false);
    return null;
  }

  tituloAluno.textContent = data.aluno?.nome || "Aluno";

  subtituloAluno.textContent =
    `${data.materia?.nome || ""} — ${data.modulo?.nome || ""} — Prof(a). ${data.professor?.nome || ""}`;

  await carregarModulos(data.materia_id, data.modulo_id);

  return data;
}

// ===============================
// MÓDULOS
// ===============================

async function carregarModulos(materiaId, moduloAtual) {
  const { data, error } = await supabase
    .from("modulo")
    .select("id, nome, ordem")
    .eq("materia_id", materiaId)
    .order("ordem", { ascending: true });

  if (error) {
    console.error(error);
    mostrarMensagem("Erro ao carregar módulos", false);
    return;
  }

  const modulos = data || [];

  // select do cadastro de nota
  notaModulo.innerHTML = `<option value="">Selecione o módulo</option>`;

  // filtro das notas
  filtroModulo.innerHTML = `<option value="">Todos</option>`;

  // filtro das aulas
  if (filtroModuloAula) {
    filtroModuloAula.innerHTML = `<option value="">Todos</option>`;
  }

  modulos.forEach((m) => {
    // option da nota
    const optNota = document.createElement("option");
    optNota.value = m.id;
    optNota.textContent = m.nome;

    if (String(m.id) === String(moduloAtual)) {
      optNota.selected = true;
    }

    notaModulo.appendChild(optNota);

    // option do filtro de notas
    const optFiltroNota = document.createElement("option");
    optFiltroNota.value = m.id;
    optFiltroNota.textContent = m.nome;
    filtroModulo.appendChild(optFiltroNota);

    // option do filtro de aulas
    if (filtroModuloAula) {
      const optFiltroAula = document.createElement("option");
      optFiltroAula.value = m.id;
      optFiltroAula.textContent = m.nome;
      filtroModuloAula.appendChild(optFiltroAula);
    }
  });
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
      conteudo,
      licao_casa,
      justificativa,
      precisa_reposicao,
      aula_gravada,
      modulo_id,
      modulo:modulo_id ( nome ),
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
// CONTADORES + REPOSIÇÕES
// ===============================

function preencherContadores(aulas) {
  let p = 0;
  let a = 0;
  let c = 0;
  let t = 0;
  let r = 0;

  limparLista(listaReposicoes);

  aulas.forEach((x) => {
    if (x.status === "Presente") {
      p++;
    } else if (x.status === "Ausente") {
      if (x.aula_gravada) {
        a++;
      } else if (x.precisa_reposicao) {
        r++;

        const li = document.createElement("li");
        li.textContent =
          `${formatarDataBR(x.data_aula)} — ${x.justificativa || "Reposição solicitada"}`;

        listaReposicoes.appendChild(li);
      } else {
        a++;
      }
    } else if (x.status === "Cancelada") {
      c++;
      r++;

      const li = document.createElement("li");
      li.textContent =
        `${formatarDataBR(x.data_aula)} — ${x.justificativa || "Aula cancelada"}`;

      listaReposicoes.appendChild(li);
    } else if (x.status === "Trancada") {
      t++;
    }
  });

  cPresente.textContent = p;
  cAusente.textContent = a;
  cCancelada.textContent = c;
  cTrancada.textContent = t;
  cReposicao.textContent = r;
}

// ===============================
// RENDER AULAS
// ===============================

function renderAulas(aulas) {
  limparLista(listaAulas);

  if (!aulas.length) {
    listaAulas.innerHTML = "<li>Nenhuma aula registrada</li>";
    return;
  }

  aulas.forEach((x, index) => {
    const li = document.createElement("li");

    let texto = `${index + 1} - ${formatarDataBR(x.data_aula)}`;

    // agora mostra o módulo no histórico
    if (x.modulo?.nome) {
      texto += ` — Módulo: ${x.modulo.nome}`;
    }

    if (x.professor?.nome) {
      texto += ` — ${x.professor.nome}`;
    }

    if (x.conteudo) {
      texto += ` — ${x.conteudo}`;
    }

    if (x.licao_casa) {
      texto += ` — ${x.licao_casa}`;
    }

    if (x.status === "Ausente" && x.precisa_reposicao) {
      texto += " (Reposição pendente)";
    }

    if (x.status === "Cancelada") {
      texto += " (Cancelada)";
    }

    if (x.status === "Trancada") {
      texto += " (Trancada)";
    }

    li.textContent = texto;
    listaAulas.appendChild(li);
  });
}

// ===============================
// FILTRO DAS AULAS
// ===============================

function aplicarFiltroAulas() {
  if (!filtroModuloAula) {
    renderAulas(todasAulas);
    return;
  }

  const moduloId = Number(filtroModuloAula.value);

  if (!moduloId) {
    renderAulas(todasAulas);
    return;
  }

  const aulasFiltradas = todasAulas.filter(
    (aula) => Number(aula.modulo_id) === moduloId
  );

  renderAulas(aulasFiltradas);
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
      modulo_id,
      modulo:modulo_id ( nome )
    `)
    .eq("matricula_id", matriculaId)
    .order("data", { ascending: false });

  if (error) {
    console.error(error);
    mostrarMensagem("Erro ao carregar notas", false);
    return;
  }

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

  notas.forEach((n) => {
    const li = document.createElement("li");

    li.textContent =
      `${formatarDataBR(n.data)} — ${n.tipo} — ${n.valor} — ${n.modulo?.nome || ""}` +
      `${n.observacao ? " — " + n.observacao : ""}`;

    listaNotas.appendChild(li);
  });
}

// ===============================
// MÉDIA GERAL
// ===============================

function calcularMediaGeral(notas) {
  if (!notas.length) {
    mediaGeralEl.textContent = "0.0";
    return;
  }

  let soma = 0;

  notas.forEach((n) => {
    soma += Number(n.valor) || 0;
  });

  const media = soma / notas.length;
  mediaGeralEl.textContent = media.toFixed(2);
}

// ===============================
// FILTRO DAS NOTAS
// ===============================

filtroModulo.addEventListener("change", () => {
  const moduloId = Number(filtroModulo.value);

  if (!moduloId) {
    renderNotas(todasNotas);
    calcularMediaGeral(todasNotas);
    return;
  }

  const filtradas = todasNotas.filter(
    (n) => Number(n.modulo_id) === moduloId
  );

  renderNotas(filtradas);
  calcularMediaGeral(filtradas);
});

// ===============================
// EVENTO DO FILTRO DE AULAS
// ===============================

if (filtroModuloAula) {
  filtroModuloAula.addEventListener("change", aplicarFiltroAulas);
}

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
    .insert([
      {
        matricula_id: matriculaId,
        data,
        tipo,
        valor,
        observacao: obs || null,
        modulo_id: moduloId
      }
    ]);

  if (error) {
    console.error(error);
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

  todasAulas = await carregarAulas();

  preencherContadores(todasAulas);
  renderAulas(todasAulas);

  await carregarNotas();
}

init();