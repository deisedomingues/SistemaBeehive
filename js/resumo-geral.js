import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

/* =========================================================
   CONFIGURAÇÃO
========================================================= */

// TROQUE pelo CNPJ exato que você cadastrou para a Beehive
const CNPJ_BEEHIVE = "12345678000199";

// Quando o pacote chegar em 28 aulas usadas, aparece em pontos de atenção.
// Pacote padrão: 36 aulas. 36 - 28 = restam 8 aulas.
const LIMITE_ALERTA_PACOTE = 28;

// Quantidade de aulas válidas para alertar avaliação pendente.
const LIMITE_AVALIACAO = 14;

/* =========================================================
   ELEMENTOS
========================================================= */

const msg = document.getElementById("msg");

const qtdAlunosUnicosAtivos = document.getElementById("qtdAlunosUnicosAtivos");
const qtdMatriculasAtivas = document.getElementById("qtdMatriculasAtivas");
const qtdProfessoresAtivos = document.getElementById("qtdProfessoresAtivos");
const qtdMateriasAtivas = document.getElementById("qtdMateriasAtivas");

const qtdEventosTotal = document.getElementById("qtdEventosTotal");
const qtdEventosFuturos = document.getElementById("qtdEventosFuturos");

const qtdEventosSemConfirmacaoResumo = document.getElementById("qtdEventosSemConfirmacaoResumo");

const qtdPacotesProximosResumo = document.getElementById("qtdPacotesProximosResumo");
const listaPacotesProximosResumo = document.getElementById("listaPacotesProximosResumo");

const qtdAvaliacoesPendentesResumo = document.getElementById("qtdAvaliacoesPendentesResumo");
const listaAvaliacoesPendentesResumo = document.getElementById("listaAvaliacoesPendentesResumo");

const selectMatriculaAdmin = document.getElementById("selectMatriculaAdmin");
const btnDetalhesAdmin = document.getElementById("btnDetalhesAdmin");

const cardsProfessoresAtivos = document.getElementById("cardsProfessoresAtivos");
const cardsMateriasResumo = document.getElementById("cardsMateriasResumo");

const selectMateriaResumo = document.getElementById("selectMateriaResumo");
const selectModuloResumo = document.getElementById("selectModuloResumo");
const resultadoModuloResumo = document.getElementById("resultadoModuloResumo");

/* =========================================================
   ESTADO
========================================================= */

let matriculasAtivas = [];
let matriculasAtivasResumo = [];
let professoresAtivos = [];
let eventos = [];
let confirmacoesEvento = [];
let aulas = [];
let notas = [];
let pacotesAulas = [];

/* =========================================================
   UTILITÁRIOS
========================================================= */

function mostrarMensagem(texto, ok = true) {
  msg.textContent = texto;
  msg.style.display = "block";
  msg.className = ok ? "msg-resumo-professor ok" : "msg-resumo-professor erro";

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
    msg.className = "msg-resumo-professor";
  }, 2500);
}

function criarParagrafoVazio(texto) {
  return `<p style="font-size:14px;">${texto}</p>`;
}

function escapeHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizarTexto(valor) {
  return String(valor || "").trim().toLowerCase();
}

function hojeISO() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function formatarDataBR(dataISO) {
  if (!dataISO) return "-";
  const [yyyy, mm, dd] = String(dataISO).split("-");
  return `${dd}/${mm}/${yyyy}`;
}

function ehAlunoInternoBeehive(matricula) {
  const empresaCnpj = String(matricula?.aluno?.empresa_cnpj || "").trim();
  return empresaCnpj !== "" && empresaCnpj === CNPJ_BEEHIVE;
}

function ehNotaDeAvaliacao(nota) {
  const tipo = normalizarTexto(nota?.tipo || "");
  return tipo.includes("avalia");
}

function aulaContaParaAvaliacao(aula) {
  const status = normalizarTexto(aula?.status);
  const gravada = aula?.aula_gravada === true;

  if (status === "presente" && gravada) return true;
  if (status === "ausente" && gravada) return true;
  if ((status === "reposição" || status === "reposicao") && gravada) return true;

  return false;
}

function aulaConsomePacote(aula) {
  const status = normalizarTexto(aula?.status);
  const gravada = aula?.aula_gravada === true;
  const precisaReposicao = aula?.precisa_reposicao === true;
  const temAulaOriginal = !!aula?.aula_original_id;

  /*
    Regra do pacote:
    Conta o encontro disponibilizado pelo professor.

    Presente com aula gravada conta.
    Ausente com aula gravada conta.
    Ausente sem aula gravada, mas com reposição gerada, conta.
    Reposição vinculada a uma aula de origem não conta de novo.
  */

  if (status === "presente" && gravada) return true;

  if (status === "ausente" && gravada) return true;

  if (status === "ausente" && !gravada && precisaReposicao) return true;

  if ((status === "reposição" || status === "reposicao") && gravada && !temAulaOriginal) {
    return true;
  }

  return false;
}

function aulaDentroDoPeriodoDoPacote(aula, pacote) {
  const dataAula = String(aula?.data_aula || "");
  const dataInicio = String(pacote?.data_inicio || "");
  const dataFim = String(pacote?.data_fim || "");

  if (!dataAula || !dataInicio) return false;

  if (dataAula < dataInicio) return false;

  if (dataFim && dataAula > dataFim) return false;

  return true;
}

function obterMatriculaPorAlunoMateria(alunoId, materiaId) {
  return matriculasAtivasResumo.find((m) => {
    return (
      Number(m.aluno_id) === Number(alunoId) &&
      Number(m.materia_id) === Number(materiaId)
    );
  });
}

function abrirDetalhesAluno(matriculaId) {
  if (!matriculaId) return;

  localStorage.setItem("matriculaSelecionada", String(matriculaId));
  window.location.href = "detalhes-aluno-admin.html";
}

function configurarBotoesAbrirAluno() {
  document.querySelectorAll("[data-abrir-matricula]").forEach((btn) => {
    btn.onclick = () => {
      const matriculaId = btn.dataset.abrirMatricula;
      abrirDetalhesAluno(matriculaId);
    };
  });
}

/* =========================================================
   BUSCAS
========================================================= */

async function carregarProfessoresAtivos() {
  const { data, error } = await supabase
    .from("professor")
    .select("id, nome, email, ativo")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) throw error;

  professoresAtivos = data || [];
}

async function carregarMatriculasAtivas() {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      ativa,
      aluno_id,
      materia_id,
      modulo_id,
      professor_id,
      aluno:aluno_id (
        id,
        nome,
        empresa_cnpj
      ),
      materia:materia_id (
        id,
        nome
      ),
      modulo:modulo_id (
        id,
        nome
      ),
      professor:professor_id (
        id,
        nome,
        ativo
      )
    `)
    .eq("ativa", true);

  if (error) throw error;

  const professoresAtivosIds = new Set(professoresAtivos.map((p) => p.id));

  matriculasAtivas = (data || []).filter((m) => {
    const professorId = m?.professor?.id;
    return professoresAtivosIds.has(professorId);
  });

  matriculasAtivasResumo = matriculasAtivas.filter((m) => !ehAlunoInternoBeehive(m));
}

async function carregarEventos() {
  const { data, error } = await supabase
    .from("evento")
    .select("id, data_evento, hora_evento, ativo")
    .order("data_evento", { ascending: true });

  if (error) throw error;

  eventos = data || [];
}

async function carregarConfirmacoesEvento() {
  const { data, error } = await supabase
    .from("evento_confirmacao")
    .select("evento_id");

  if (error) throw error;

  confirmacoesEvento = data || [];
}

async function carregarAulasResumo() {
  const matriculaIdsResumo = matriculasAtivasResumo.map((m) => m.id);

  if (!matriculaIdsResumo.length) {
    aulas = [];
    return;
  }

  const { data, error } = await supabase
    .from("aula")
    .select(`
      id,
      matricula_id,
      data_aula,
      status,
      precisa_reposicao,
      aula_original_id,
      aula_gravada,
      modulo_id
    `)
    .in("matricula_id", matriculaIdsResumo);

  if (error) throw error;

  aulas = data || [];
}

async function carregarNotasResumo() {
  const matriculaIdsResumo = matriculasAtivasResumo.map((m) => m.id);

  if (!matriculaIdsResumo.length) {
    notas = [];
    return;
  }

  const { data, error } = await supabase
    .from("nota")
    .select(`
      id,
      matricula_id,
      data,
      tipo,
      modulo_id
    `)
    .in("matricula_id", matriculaIdsResumo);

  if (error) throw error;

  notas = data || [];
}

async function carregarPacotesAulasResumo() {
  const alunoIds = Array.from(
    new Set(
      matriculasAtivasResumo
        .map((m) => m.aluno_id)
        .filter(Boolean)
    )
  );

  if (!alunoIds.length) {
    pacotesAulas = [];
    return;
  }

  const { data, error } = await supabase
    .from("pacote_aulas")
    .select(`
      id,
      aluno_id,
      materia_id,
      quantidade_aulas,
      data_inicio,
      data_fim,
      status,
      observacao,
      created_at
    `)
    .in("aluno_id", alunoIds)
    .eq("status", "Ativo");

  if (error) throw error;

  pacotesAulas = data || [];
}

/* =========================================================
   CÁLCULOS - PACOTE
========================================================= */

function contarAulasUsadasNoPacote(pacote) {
  const matricula = obterMatriculaPorAlunoMateria(pacote.aluno_id, pacote.materia_id);

  if (!matricula) return 0;

  return aulas.filter((aula) => {
    if (Number(aula.matricula_id) !== Number(matricula.id)) return false;
    if (!aulaDentroDoPeriodoDoPacote(aula, pacote)) return false;
    return aulaConsomePacote(aula);
  }).length;
}

function obterPacotesProximosRenovacao() {
  return pacotesAulas
    .map((pacote) => {
      const matricula = obterMatriculaPorAlunoMateria(pacote.aluno_id, pacote.materia_id);

      if (!matricula) return null;

      const usadas = contarAulasUsadasNoPacote(pacote);
      const total = Number(pacote.quantidade_aulas || 36);
      const restantes = Math.max(0, total - usadas);

      if (usadas < LIMITE_ALERTA_PACOTE) return null;

      return {
        pacote,
        matricula,
        usadas,
        total,
        restantes
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.restantes !== b.restantes) return a.restantes - b.restantes;
      return a.matricula.aluno?.nome?.localeCompare(b.matricula.aluno?.nome || "", "pt-BR");
    });
}

/* =========================================================
   CÁLCULOS - AVALIAÇÃO
========================================================= */

function contarAulasValidasDesdeUltimaAvaliacao(matricula) {
  const moduloAtual = Number(matricula.modulo_id || 0);

  const aulasValidasModulo = aulas
    .filter((aula) => {
      if (Number(aula.matricula_id) !== Number(matricula.id)) return false;
      if (Number(aula.modulo_id || 0) !== moduloAtual) return false;
      return aulaContaParaAvaliacao(aula);
    })
    .sort((a, b) => {
      const dataA = String(a.data_aula || "");
      const dataB = String(b.data_aula || "");

      if (dataA !== dataB) return dataA.localeCompare(dataB);

      return Number(a.id || 0) - Number(b.id || 0);
    });

  const avaliacoesModulo = notas
    .filter((nota) => {
      if (Number(nota.matricula_id) !== Number(matricula.id)) return false;
      if (Number(nota.modulo_id || 0) !== moduloAtual) return false;
      return ehNotaDeAvaliacao(nota);
    })
    .sort((a, b) => {
      const dataA = String(a.data || "");
      const dataB = String(b.data || "");

      if (dataA !== dataB) return dataA.localeCompare(dataB);

      return Number(a.id || 0) - Number(b.id || 0);
    });

  if (!avaliacoesModulo.length) {
    return {
      aulasDesdeUltima: aulasValidasModulo.length,
      totalAvaliacoes: 0
    };
  }

  const ultimaAvaliacao = avaliacoesModulo[avaliacoesModulo.length - 1];
  const dataUltimaAvaliacao = String(ultimaAvaliacao.data || "");

  const aulasDepois = aulasValidasModulo.filter((aula) => {
    return String(aula.data_aula || "") > dataUltimaAvaliacao;
  });

  return {
    aulasDesdeUltima: aulasDepois.length,
    totalAvaliacoes: avaliacoesModulo.length
  };
}

function obterMatriculasComAvaliacaoPendente() {
  return matriculasAtivasResumo
    .map((matricula) => {
      const dados = contarAulasValidasDesdeUltimaAvaliacao(matricula);

      if (dados.aulasDesdeUltima < LIMITE_AVALIACAO) return null;

      return {
        matricula,
        aulasDesdeUltima: dados.aulasDesdeUltima,
        totalAvaliacoes: dados.totalAvaliacoes,
        proximaAvaliacao: dados.totalAvaliacoes + 1
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.aulasDesdeUltima !== b.aulasDesdeUltima) {
        return b.aulasDesdeUltima - a.aulasDesdeUltima;
      }

      return a.matricula.aluno?.nome?.localeCompare(b.matricula.aluno?.nome || "", "pt-BR");
    });
}

/* =========================================================
   RENDER - VISÃO GERAL
========================================================= */

function renderIndicadoresGerais() {
  const alunosUnicos = new Set(
    matriculasAtivasResumo
      .map((m) => m?.aluno?.id)
      .filter(Boolean)
  );

  const materiasUnicas = new Set(
    matriculasAtivasResumo
      .map((m) => m?.materia?.id)
      .filter(Boolean)
  );

  const hoje = hojeISO();

  const eventosFuturos = eventos.filter((e) => {
    if (!e.ativo) return false;
    return String(e.data_evento || "") >= hoje;
  }).length;

  qtdAlunosUnicosAtivos.textContent = String(alunosUnicos.size);
  qtdMatriculasAtivas.textContent = String(matriculasAtivasResumo.length);
  qtdProfessoresAtivos.textContent = String(professoresAtivos.length);
  qtdMateriasAtivas.textContent = String(materiasUnicas.size);

  qtdEventosTotal.textContent = String(eventos.length);
  qtdEventosFuturos.textContent = String(eventosFuturos);
}

/* =========================================================
   RENDER - PONTOS DE ATENÇÃO
========================================================= */

function renderAlertasResumo() {
  renderAlertaPacotesProximos();
  renderAlertaAvaliacoesPendentes();
  renderAlertaEventosSemConfirmacao();
  configurarBotoesAbrirAluno();
}

function renderAlertaPacotesProximos() {
  const pacotesProximos = obterPacotesProximosRenovacao();

  qtdPacotesProximosResumo.textContent = String(pacotesProximos.length);

  if (!pacotesProximos.length) {
    listaPacotesProximosResumo.innerHTML = `
      <p style="font-size:13px; opacity:0.85; margin:0;">
        Nenhum pacote próximo da renovação.
      </p>
    `;
    return;
  }

  listaPacotesProximosResumo.innerHTML = pacotesProximos.slice(0, 8).map((item) => {
    const aluno = item.matricula.aluno?.nome || "Aluno";
    const materia = item.matricula.materia?.nome || "Curso";
    const situacao = item.restantes <= 0
      ? "Renovação necessária"
      : `Restam ${item.restantes} aula(s)`;

    return `
      <div style="padding:8px 0; border-bottom:1px solid #e6dfcf;">
        <strong>${escapeHtml(aluno)}</strong>
        <div style="font-size:12px; opacity:0.88;">
          ${escapeHtml(materia)} • ${item.usadas}/${item.total} aulas • ${escapeHtml(situacao)}
        </div>
        <button
          type="button"
          class="btn"
          data-abrir-matricula="${item.matricula.id}"
          style="padding:5px 9px; margin-top:6px; font-size:12px;"
        >
          Abrir aluno
        </button>
      </div>
    `;
  }).join("");

  if (pacotesProximos.length > 8) {
    listaPacotesProximosResumo.innerHTML += `
      <p style="font-size:12px; opacity:0.8; margin-top:8px;">
        + ${pacotesProximos.length - 8} outro(s) aluno(s) em atenção.
      </p>
    `;
  }
}

function renderAlertaAvaliacoesPendentes() {
  const avaliacoesPendentes = obterMatriculasComAvaliacaoPendente();

  qtdAvaliacoesPendentesResumo.textContent = String(avaliacoesPendentes.length);

  if (!avaliacoesPendentes.length) {
    listaAvaliacoesPendentesResumo.innerHTML = `
      <p style="font-size:13px; opacity:0.85; margin:0;">
        Nenhum aluno com avaliação pendente.
      </p>
    `;
    return;
  }

  listaAvaliacoesPendentesResumo.innerHTML = avaliacoesPendentes.slice(0, 8).map((item) => {
    const aluno = item.matricula.aluno?.nome || "Aluno";
    const materia = item.matricula.materia?.nome || "Curso";
    const modulo = item.matricula.modulo?.nome || "Módulo";

    return `
      <div style="padding:8px 0; border-bottom:1px solid #e6dfcf;">
        <strong>${escapeHtml(aluno)}</strong>
        <div style="font-size:12px; opacity:0.88;">
          ${escapeHtml(materia)} • ${escapeHtml(modulo)} •
          ${item.aulasDesdeUltima} aula(s) válida(s) desde a última avaliação
        </div>
        <div style="font-size:12px; opacity:0.88;">
          Próxima: Avaliação ${item.proximaAvaliacao}
        </div>
        <button
          type="button"
          class="btn"
          data-abrir-matricula="${item.matricula.id}"
          style="padding:5px 9px; margin-top:6px; font-size:12px;"
        >
          Abrir aluno
        </button>
      </div>
    `;
  }).join("");

  if (avaliacoesPendentes.length > 8) {
    listaAvaliacoesPendentesResumo.innerHTML += `
      <p style="font-size:12px; opacity:0.8; margin-top:8px;">
        + ${avaliacoesPendentes.length - 8} outro(s) aluno(s) com avaliação pendente.
      </p>
    `;
  }
}

function renderAlertaEventosSemConfirmacao() {
  const confirmacoesPorEvento = new Map();

  confirmacoesEvento.forEach((c) => {
    const atual = confirmacoesPorEvento.get(c.evento_id) || 0;
    confirmacoesPorEvento.set(c.evento_id, atual + 1);
  });

  const hoje = hojeISO();

  const eventosSemConfirmacao = eventos.filter((e) => {
    const futuro = e.ativo && String(e.data_evento || "") >= hoje;
    if (!futuro) return false;

    return !confirmacoesPorEvento.has(e.id);
  });

  qtdEventosSemConfirmacaoResumo.textContent = String(eventosSemConfirmacao.length);
}

/* =========================================================
   RENDER - CONSULTA DE ALUNO
========================================================= */

function renderSelectMatriculasAdmin() {
  selectMatriculaAdmin.innerHTML = `<option value="">Selecione o aluno (curso)</option>`;

  const listaOrdenada = [...matriculasAtivas].sort((a, b) => {
    const nomeA = a?.aluno?.nome || "";
    const nomeB = b?.aluno?.nome || "";
    return nomeA.localeCompare(nomeB, "pt-BR");
  });

  listaOrdenada.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = `${m.aluno?.nome || "Aluno"} — ${m.materia?.nome || "Matéria"} (${m.modulo?.nome || "Módulo"})`;
    selectMatriculaAdmin.appendChild(opt);
  });
}

/* =========================================================
   RENDER - PROFESSORES
========================================================= */

function renderCardsProfessores() {
  if (!professoresAtivos.length) {
    cardsProfessoresAtivos.innerHTML = `<div class="card">${criarParagrafoVazio("Nenhum professor ativo encontrado.")}</div>`;
    return;
  }

  const html = professoresAtivos.map((prof) => {
    const matriculasDoProfessor = matriculasAtivasResumo.filter(
      (m) => m?.professor?.id === prof.id
    );

    const alunosUnicos = new Set(
      matriculasDoProfessor
        .map((m) => m?.aluno?.id)
        .filter(Boolean)
    );

    const porMateria = {};

    matriculasDoProfessor.forEach((m) => {
      const nomeMateria = m?.materia?.nome || "Matéria";
      if (!porMateria[nomeMateria]) porMateria[nomeMateria] = new Set();

      if (m?.aluno?.id) {
        porMateria[nomeMateria].add(m.aluno.id);
      }
    });

    const materiasOrdenadas = Object.keys(porMateria).sort((a, b) => a.localeCompare(b, "pt-BR"));

    return `
      <div class="card card-professor-admin">
        <h2>🧑‍🏫 ${escapeHtml(prof.nome)}</h2>
        <p><b>Total de alunos:</b> ${alunosUnicos.size}</p>

        ${
          materiasOrdenadas.length
            ? `<ul class="lista-simples-resumo">
                ${materiasOrdenadas
                  .map((materia) => `<li>${escapeHtml(materia)}: ${porMateria[materia].size} aluno(s)</li>`)
                  .join("")}
               </ul>`
            : `<p>Nenhum aluno ativo vinculado.</p>`
        }

        <button
          type="button"
          class="btn btn-detalhes-professor-admin"
          data-professor-id="${prof.id}"
          style="padding:7px 10px; margin-top:8px; font-size:12px;"
        >
          Ver detalhes do professor
        </button>
      </div>
    `;
  }).join("");

  cardsProfessoresAtivos.innerHTML = html;

  document.querySelectorAll(".btn-detalhes-professor-admin").forEach((btn) => {
    btn.onclick = () => {
      localStorage.setItem("professorSelecionadoAdmin", btn.dataset.professorId);
      window.location.href = "detalhes-professor-admin.html";
    };
  });
}

/* =========================================================
   RENDER - MATÉRIAS
========================================================= */

function renderCardsMaterias() {
  const mapa = {};

  matriculasAtivasResumo.forEach((m) => {
    const nomeMateria = m?.materia?.nome || "Matéria";
    const alunoId = m?.aluno?.id;

    if (!mapa[nomeMateria]) {
      mapa[nomeMateria] = {
        alunos: new Set(),
        matriculas: 0
      };
    }

    if (alunoId) mapa[nomeMateria].alunos.add(alunoId);
    mapa[nomeMateria].matriculas += 1;
  });

  const materias = Object.keys(mapa).sort((a, b) => a.localeCompare(b, "pt-BR"));

  if (!materias.length) {
    cardsMateriasResumo.innerHTML = `<div class="card">${criarParagrafoVazio("Nenhuma matéria com matrícula ativa encontrada.")}</div>`;
    return;
  }

  const html = materias.map((nomeMateria) => `
    <div class="card">
      <h2>${escapeHtml(nomeMateria)}</h2>
      <p><b>Alunos:</b> ${mapa[nomeMateria].alunos.size} pessoa(s)</p>
      <p><b>Matrículas ativas:</b> ${mapa[nomeMateria].matriculas}</p>
    </div>
  `).join("");

  cardsMateriasResumo.innerHTML = html;
}

/* =========================================================
   RENDER - FILTRO DE MÓDULO
========================================================= */

function renderSelectMateriasResumo() {
  if (!selectMateriaResumo) return;

  const mapaMaterias = new Map();

  matriculasAtivasResumo.forEach((m) => {
    const materiaId = m?.materia?.id;
    const materiaNome = m?.materia?.nome;

    if (materiaId && materiaNome) {
      mapaMaterias.set(materiaId, materiaNome);
    }
  });

  const materiasOrdenadas = Array.from(mapaMaterias.entries()).sort((a, b) =>
    a[1].localeCompare(b[1], "pt-BR")
  );

  selectMateriaResumo.innerHTML = `<option value="">Selecione a matéria</option>`;

  materiasOrdenadas.forEach(([id, nome]) => {
    const opt = document.createElement("option");
    opt.value = String(id);
    opt.textContent = nome;
    selectMateriaResumo.appendChild(opt);
  });
}

function limparSelectModulos() {
  if (!selectModuloResumo) return;

  selectModuloResumo.innerHTML = `<option value="">Selecione o módulo</option>`;
  selectModuloResumo.disabled = true;
}

function renderResultadoModuloInicial() {
  if (!resultadoModuloResumo) return;

  resultadoModuloResumo.innerHTML = `
    <p style="font-size:14px;">Selecione uma matéria para começar.</p>
  `;
}

function renderModulosPorMateria(materiaIdSelecionada) {
  if (!selectModuloResumo) return;

  const modulosMap = new Map();

  matriculasAtivasResumo.forEach((m) => {
    const materiaId = String(m?.materia?.id || "");
    const moduloId = m?.modulo?.id;
    const moduloNome = m?.modulo?.nome;

    if (materiaId !== String(materiaIdSelecionada)) return;
    if (!moduloId || !moduloNome) return;

    modulosMap.set(moduloId, moduloNome);
  });

  const modulosOrdenados = Array.from(modulosMap.entries()).sort((a, b) =>
    a[1].localeCompare(b[1], "pt-BR")
  );

  limparSelectModulos();

  if (!modulosOrdenados.length) {
    selectModuloResumo.disabled = true;
    resultadoModuloResumo.innerHTML = `
      <p style="font-size:14px;">Nenhum módulo encontrado para esta matéria.</p>
    `;
    return;
  }

  modulosOrdenados.forEach(([id, nome]) => {
    const opt = document.createElement("option");
    opt.value = String(id);
    opt.textContent = nome;
    selectModuloResumo.appendChild(opt);
  });

  selectModuloResumo.disabled = false;

  resultadoModuloResumo.innerHTML = `
    <p style="font-size:14px;">Agora selecione o módulo.</p>
  `;
}

function renderResultadoModulo(materiaIdSelecionada, moduloIdSelecionado) {
  if (!resultadoModuloResumo) return;

  const filtradas = matriculasAtivasResumo.filter((m) => {
    const materiaId = String(m?.materia?.id || "");
    const moduloId = String(m?.modulo?.id || "");

    return (
      materiaId === String(materiaIdSelecionada) &&
      moduloId === String(moduloIdSelecionado)
    );
  });

  if (!filtradas.length) {
    resultadoModuloResumo.innerHTML = `
      <p style="font-size:14px;">Nenhuma matrícula ativa encontrada neste módulo.</p>
    `;
    return;
  }

  const nomeMateria = filtradas[0]?.materia?.nome || "Matéria";
  const nomeModulo = filtradas[0]?.modulo?.nome || "Módulo";

  const alunosUnicos = new Set(
    filtradas
      .map((m) => m?.aluno?.id)
      .filter(Boolean)
  );

  resultadoModuloResumo.innerHTML = `
    <div class="item-avaliacao-resumo">
      <strong>${escapeHtml(nomeModulo)}</strong>
      <p><b>Matéria:</b> ${escapeHtml(nomeMateria)}</p>
      <p><b>Alunos:</b> ${alunosUnicos.size} pessoa(s)</p>
      <p><b>Matrículas ativas:</b> ${filtradas.length}</p>
    </div>
  `;
}

/* =========================================================
   MONTAGEM
========================================================= */

async function montarResumoGeral() {
  try {
    await carregarProfessoresAtivos();
    await carregarMatriculasAtivas();
    await carregarEventos();
    await carregarConfirmacoesEvento();
    await carregarAulasResumo();
    await carregarNotasResumo();
    await carregarPacotesAulasResumo();

    renderAlertasResumo();
    renderIndicadoresGerais();
    renderSelectMatriculasAdmin();
    renderCardsProfessores();
    renderCardsMaterias();

    renderSelectMateriasResumo();
    limparSelectModulos();
    renderResultadoModuloInicial();

  } catch (error) {
    console.error("Erro ao carregar resumo geral:", error);
    mostrarMensagem(
      "Erro ao carregar o resumo geral. Confira os relacionamentos e nomes das colunas.",
      false
    );
  }
}

/* =========================================================
   EVENTOS
========================================================= */

btnDetalhesAdmin?.addEventListener("click", () => {
  const matriculaId = selectMatriculaAdmin.value;

  if (!matriculaId) {
    mostrarMensagem("Selecione o aluno (curso).", false);
    return;
  }

  abrirDetalhesAluno(matriculaId);
});

selectMateriaResumo?.addEventListener("change", () => {
  const materiaId = selectMateriaResumo.value;

  if (!materiaId) {
    limparSelectModulos();
    renderResultadoModuloInicial();
    return;
  }

  renderModulosPorMateria(materiaId);
});

selectModuloResumo?.addEventListener("change", () => {
  const materiaId = selectMateriaResumo.value;
  const moduloId = selectModuloResumo.value;

  if (!materiaId || !moduloId) {
    resultadoModuloResumo.innerHTML = `
      <p style="font-size:14px;">Selecione um módulo para visualizar os dados.</p>
    `;
    return;
  }

  renderResultadoModulo(materiaId, moduloId);
});

/* =========================================================
   INÍCIO
========================================================= */

await montarResumoGeral();