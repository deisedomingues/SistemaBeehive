import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

// garante que é professor logado e preenche professorId no localStorage
await exigirProfessor();

const professorId = localStorage.getItem("professorId");

// elementos
const msg = document.getElementById("msg");
const qtdIngles = document.getElementById("qtdIngles");
const qtdEspanhol = document.getElementById("qtdEspanhol");
const qtdTotalAlunos = document.getElementById("qtdTotalAlunos");
const qtdAulasMes = document.getElementById("qtdAulasMes");

const selectMatricula = document.getElementById("selectMatricula");
const btnDetalhes = document.getElementById("btnDetalhes");

const listaModulosIngles = document.getElementById("listaModulosIngles");
const listaModulosEspanhol = document.getElementById("listaModulosEspanhol");

// ✅ NOVOS (precisam existir no HTML)
const cardAniversarioHoje = document.getElementById("cardAniversarioHoje");
const listaAvalIngles = document.getElementById("listaAvalIngles");
const listaAvalEspanhol = document.getElementById("listaAvalEspanhol");

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

function inicioFimMesAtualISO() {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1); // primeiro dia do próximo mês

  const toISODate = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  return { inicio: toISODate(inicio), fim: toISODate(fim) };
}

function limparLista(ul) {
  if (!ul) return;
  ul.innerHTML = "";
}

function addLi(ul, texto) {
  if (!ul) return;
  const li = document.createElement("li");
  li.textContent = texto;
  ul.appendChild(li);
}

// ===========================
// Datas (aniversários)
// ===========================
function hojeDiaMes() {
  const d = new Date();
  return { dia: d.getDate(), mes: d.getMonth() + 1 }; // mês 1-12
}

function parseDiaMes(dataISO) {
  // dataISO: "YYYY-MM-DD"
  if (!dataISO || typeof dataISO !== "string") return null;

  const partes = dataISO.split("-");
  if (partes.length < 3) return null;

  const mm = Number(partes[1]);
  const dd = Number(partes[2]);

  if (!mm || !dd) return null;
  return { dia: dd, mes: mm };
}

// ===========================
// 1) Carregar matrículas do professor
//    ⚠️ Aqui agora puxamos data_nascimento também
// ===========================
async function carregarMatriculasProfessor() {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno:aluno_id ( id, nome, data_nascimento ),
      materia:materia_id ( id, nome ),
      modulo:modulo_id ( id, nome )
    `)
    .eq("professor_id", professorId);

  if (error) {
    console.error(error);
    mostrarMensagem("❌ Erro ao carregar matrículas.", false);
    return [];
  }

  return data || [];
}

// ===========================
// 2) Presenças do mês atual (do professor)
// ===========================
async function carregarPresencasMesAtual() {
  const { inicio, fim } = inicioFimMesAtualISO();

  const { data, error } = await supabase
    .from("aula")
    .select(`
      id,
      status,
      data_aula,
      matricula:matricula_id ( professor_id )
    `)
    .gte("data_aula", inicio)
    .lt("data_aula", fim);

  if (error) {
    console.error(error);
    mostrarMensagem("❌ Erro ao carregar aulas do mês.", false);
    return 0;
  }

  const lista = data || [];
  const presencasDoProfessor = lista.filter((a) => {
    return (
      a.status === "Presente" &&
      String(a.matricula?.professor_id) === String(professorId)
    );
  });

  return presencasDoProfessor.length;
}

// ===========================
// 3) Contar presenças por matrícula (para Avaliações)
// ===========================
async function carregarContagemPresencasPorMatricula(matriculaIds) {
  if (!matriculaIds || matriculaIds.length === 0) return {};

  const { data, error } = await supabase
    .from("aula")
    .select("id, matricula_id, status")
    .in("matricula_id", matriculaIds)
    .eq("status", "Presente");

  if (error) {
    console.error(error);
    mostrarMensagem("❌ Erro ao carregar presenças (avaliações).", false);
    return {};
  }

  const contagem = {};
  (data || []).forEach((a) => {
    const mid = String(a.matricula_id);
    contagem[mid] = (contagem[mid] || 0) + 1;
  });

  return contagem;
}

// ===========================
// 4) Render aniversariantes de hoje (dia + mês)
// ===========================
function renderAniversariantesHoje(matriculas) {
  if (!cardAniversarioHoje) return;

  const { dia, mes } = hojeDiaMes();

  // alunos únicos (para não repetir quem faz 2 matérias)
  const mapaAlunos = new Map();
  matriculas.forEach((m) => {
    if (m?.aluno?.id) mapaAlunos.set(m.aluno.id, m.aluno);
  });

  const aniversariantes = [];
  for (const aluno of mapaAlunos.values()) {
    const dm = parseDiaMes(aluno.data_nascimento);
    if (dm && dm.dia === dia && dm.mes === mes) {
      aniversariantes.push(aluno.nome);
    }
  }

  if (aniversariantes.length === 0) {
    cardAniversarioHoje.innerHTML = `
      <p style="font-size:14px;">Não há aluno aniversariante no dia de hoje.</p>
    `;
    return;
  }

  aniversariantes.sort();

  if (aniversariantes.length === 1) {
    cardAniversarioHoje.innerHTML = `
      <p style="font-size:14px;"><b>Hoje é o aniversário de:</b></p>
      <p style="font-size:15px; margin-top:6px;">🎉 ${aniversariantes[0]}</p>
    `;
    return;
  }

  cardAniversarioHoje.innerHTML = `
    <p style="font-size:14px;"><b>Hoje é aniversário de:</b></p>
    <ul style="margin-top:6px;"></ul>
  `;
  const ul = cardAniversarioHoje.querySelector("ul");
  aniversariantes.forEach((nome) => addLi(ul, `🎉 ${nome}`));
}

// ===========================
// 5) Render avaliações (Inglês: múltiplos de 14)
// ===========================
function renderAvaliacoes(matriculas, presencasPorMatricula) {
  limparLista(listaAvalIngles);
  limparLista(listaAvalEspanhol);

  // Inglês: 14, 28, 42... por matrícula
  const devidasIngles = [];

  matriculas.forEach((m) => {
    const mid = String(m.id);
    const materiaNome = m.materia?.nome;
    const pres = presencasPorMatricula[mid] || 0;

    if (materiaNome === "Inglês" && pres > 0 && pres % 14 === 0) {
      devidasIngles.push(`${m.aluno.nome} — ${pres} presenças`);
    }
  });

  if (devidasIngles.length === 0) {
    addLi(listaAvalIngles, "Nenhuma avaliação pendente no momento.");
  } else {
    devidasIngles.sort().forEach((txt) => addLi(listaAvalIngles, txt));
  }

  // Espanhol: placeholder (você vai me passar as regras por módulo)
  addLi(listaAvalEspanhol, "Regras por módulo ainda não configuradas.");
}

// ===========================
// 6) Montar tela
// ===========================
async function montarResumo() {
  const matriculas = await carregarMatriculasProfessor();

  // preencher select para detalhes
  selectMatricula.innerHTML = `<option value="">Selecione o aluno (curso)</option>`;
  matriculas
    .sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome))
    .forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.aluno.nome} — ${m.materia.nome} (${m.modulo.nome})`;
      selectMatricula.appendChild(opt);
    });

  // contagem de alunos únicos (no total)
  const alunosUnicos = new Set(matriculas.map((m) => m.aluno.id));
  qtdTotalAlunos.textContent = alunosUnicos.size;

  // contagem por matéria (alunos únicos por matéria)
  const alunosPorMateria = {};
  matriculas.forEach((m) => {
    const nomeMateria = m.materia.nome;
    if (!alunosPorMateria[nomeMateria]) alunosPorMateria[nomeMateria] = new Set();
    alunosPorMateria[nomeMateria].add(m.aluno.id);
  });

  qtdIngles.textContent = (alunosPorMateria["Inglês"]?.size || 0);
  qtdEspanhol.textContent = (alunosPorMateria["Espanhol"]?.size || 0);

  // contagem por módulo dentro de cada matéria (alunos únicos)
  const mapa = {};
  matriculas.forEach((m) => {
    const mat = m.materia.nome;
    const mod = m.modulo.nome;
    if (!mapa[mat]) mapa[mat] = {};
    if (!mapa[mat][mod]) mapa[mat][mod] = new Set();
    mapa[mat][mod].add(m.aluno.id);
  });

  limparLista(listaModulosIngles);
  limparLista(listaModulosEspanhol);

  const renderMateria = (nomeMateria, ul) => {
    const mods = mapa[nomeMateria] || {};
    const nomesModulos = Object.keys(mods).sort((a, b) => a.localeCompare(b));
    if (nomesModulos.length === 0) {
      addLi(ul, "Nenhum aluno cadastrado nesta matéria.");
      return;
    }
    nomesModulos.forEach((mod) => {
      addLi(ul, `${mod}: ${mods[mod].size}`);
    });
  };

  renderMateria("Inglês", listaModulosIngles);
  renderMateria("Espanhol", listaModulosEspanhol);

  // presenças do mês
  const presencasMes = await carregarPresencasMesAtual();
  qtdAulasMes.textContent = presencasMes;

  // aniversariantes hoje (dia+mês)
  renderAniversariantesHoje(matriculas);

  // avaliações (Inglês: múltiplos de 14)
  const idsMatriculas = matriculas.map((m) => m.id);
  const presencasPorMatricula = await carregarContagemPresencasPorMatricula(idsMatriculas);
  renderAvaliacoes(matriculas, presencasPorMatricula);
}

// botão detalhes
btnDetalhes.addEventListener("click", () => {
  const matriculaId = selectMatricula.value;
  if (!matriculaId) {
    mostrarMensagem("⚠️ Selecione o aluno (curso).", false);
    return;
  }

  localStorage.setItem("matriculaSelecionada", matriculaId);
  mostrarMensagem("✅ Ok! Depois vamos abrir a tela de detalhes.");
   window.location.href = "detalhes-aluno.html";
});

montarResumo();
