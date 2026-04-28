import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const professorId = localStorage.getItem("professorSelecionadoAdmin");

// ===============================
// ELEMENTOS
// ===============================

const msg = document.getElementById("msg");

const tituloProfessor = document.getElementById("tituloProfessor");
const subtituloProfessor = document.getElementById("subtituloProfessor");

const infoNomeProfessor = document.getElementById("infoNomeProfessor");
const infoEmailProfessor = document.getElementById("infoEmailProfessor");
const infoStatusProfessor = document.getElementById("infoStatusProfessor");
const infoCursosProfessor = document.getElementById("infoCursosProfessor");

const qtdAlunosAtivosProfessor = document.getElementById("qtdAlunosAtivosProfessor");
const qtdMatriculasProfessor = document.getElementById("qtdMatriculasProfessor");
const qtdCursosProfessor = document.getElementById("qtdCursosProfessor");
const qtdAulasRegistradasProfessor = document.getElementById("qtdAulasRegistradasProfessor");
const qtdAulasComputaveisProfessor = document.getElementById("qtdAulasComputaveisProfessor");
const qtdAulasCanceladasProfessor = document.getElementById("qtdAulasCanceladasProfessor");
const qtdAulasMesProfessor = document.getElementById("qtdAulasMesProfessor");
const qtdMinutosProfessor = document.getElementById("qtdMinutosProfessor");

const listaAlunosProfessor = document.getElementById("listaAlunosProfessor");
const cardsCursosProfessor = document.getElementById("cardsCursosProfessor");

const filtroStatusAulaProfessor = document.getElementById("filtroStatusAulaProfessor");
const listaAulasProfessor = document.getElementById("listaAulasProfessor");
const boxExpandirAulasProfessor = document.getElementById("boxExpandirAulasProfessor");
const btnExpandirAulasProfessor = document.getElementById("btnExpandirAulasProfessor");

const qtdCancelamentosAtencao = document.getElementById("qtdCancelamentosAtencao");
const listaCancelamentosAtencao = document.getElementById("listaCancelamentosAtencao");

const qtdAulasSemMinutagem = document.getElementById("qtdAulasSemMinutagem");
const listaAulasSemMinutagem = document.getElementById("listaAulasSemMinutagem");

// ===============================
// PROTEÇÃO
// ===============================

if (!professorId) {
  window.location.href = "resumo-geral.html";
}

// ===============================
// ESTADO
// ===============================

let professor = null;
let materiasProfessor = [];
let matriculasProfessor = [];
let aulasProfessor = [];
let ocorrenciasProfessor = [];
let aulasExpandido = false;

// ===============================
// STATUS
// ===============================

const STATUS = {
  PRESENTE: "Presente",
  AUSENTE: "Ausente",
  CANCELADA: "Cancelada",
  REPOSICAO: "Reposição",
  AULA_INSTRUMENTAL: "Aula Instrumental",
  PLANTAO_DUVIDAS: "Plantão de dúvidas"
};

// ===============================
// UTILITÁRIOS
// ===============================

function mostrarMensagem(texto, ok = true) {
  if (!msg) return;

  msg.textContent = texto;
  msg.style.display = "block";
  msg.className = ok ? "msg-resumo-professor ok" : "msg-resumo-professor erro";

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
    msg.className = "msg-resumo-professor";
  }, 2500);
}

function escaparHtml(texto) {
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

function formatarDataBR(dataISO) {
  if (!dataISO) return "-";

  const partes = String(dataISO).split("-");

  if (partes.length !== 3) return dataISO;

  const [yyyy, mm, dd] = partes;
  return `${dd}/${mm}/${yyyy}`;
}

function mesAtualPrefixo() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

function textoParte(parte) {
  if (!parte) return "Parte não informada";
  return `Parte ${parte}`;
}

function segundosParaMinutos(segundos) {
  const totalSegundos = Number(segundos) || 0;

  if (!totalSegundos) return 0;

  return Math.round(totalSegundos / 60);
}

function formatarDuracao(segundos) {
  const totalSegundos = Number(segundos) || 0;

  if (!totalSegundos) return "-";

  const minutos = Math.floor(totalSegundos / 60);
  const restoSegundos = totalSegundos % 60;

  if (restoSegundos === 0) {
    return `${minutos} min`;
  }

  return `${minutos} min ${restoSegundos}s`;
}

function abrirDetalhesAluno(matriculaId) {
  if (!matriculaId) return;

  localStorage.setItem("matriculaSelecionada", String(matriculaId));
  window.location.href = "detalhes-aluno-admin.html";
}

function configurarBotoesAbrirAluno() {
  document.querySelectorAll("[data-abrir-matricula]").forEach((btn) => {
    btn.onclick = () => {
      abrirDetalhesAluno(btn.dataset.abrirMatricula);
    };
  });
}

function aulaComputavelProfessor(aula) {
  const status = normalizarTexto(aula?.status);
  const gravada = aula?.aula_gravada === true;

  /*
    Aula computável aqui significa aula que pode entrar nos indicadores
    administrativos do professor, principalmente para histórico e financeiro.

    Conta:
    - Presente com aula gravada
    - Ausente com aula gravada
    - Reposição com aula gravada
    - Aula Instrumental com aula gravada
    - Plantão de dúvidas com aula gravada
  */

  if (status === "presente" && gravada) return true;
  if (status === "ausente" && gravada) return true;
  if ((status === "reposição" || status === "reposicao") && gravada) return true;
  if (status === "aula instrumental" && gravada) return true;
  if (status === "plantão de dúvidas" && gravada) return true;

  return false;
}

function obterNomeAlunoAula(aula) {
  return aula?.matricula?.aluno?.nome || "Aluno";
}

function obterMateriaAula(aula) {
  return aula?.matricula?.materia?.nome || "Curso";
}

function obterModuloAula(aula) {
  return aula?.matricula?.modulo?.nome || "Módulo";
}

// ===============================
// BUSCAS
// ===============================

async function carregarProfessor() {
  const { data, error } = await supabase
    .from("professor")
    .select("id, nome, email, ativo")
    .eq("id", professorId)
    .single();

  if (error || !data) {
    console.error("Erro ao carregar professor:", error);
    mostrarMensagem("Erro ao carregar professor.", false);
    return null;
  }

  professor = data;
  return data;
}

async function carregarMateriasProfessor() {
  const { data, error } = await supabase
    .from("professor_materia")
    .select(`
      id,
      professor_id,
      materia_id,
      valor_hora,
      materia:materia_id (
        id,
        nome
      )
    `)
    .eq("professor_id", professorId);

  if (error) {
    console.warn("Não foi possível carregar professor_materia:", error);
    materiasProfessor = [];
    return;
  }

  materiasProfessor = data || [];
}

async function carregarMatriculasProfessor() {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno_id,
      materia_id,
      modulo_id,
      professor_id,
      ativa,
      aluno:aluno_id (
        id,
        nome
      ),
      materia:materia_id (
        id,
        nome
      ),
      modulo:modulo_id (
        id,
        nome
      )
    `)
    .eq("professor_id", professorId)
    .eq("ativa", true);

  if (error) {
    console.error("Erro ao carregar matrículas do professor:", error);
    mostrarMensagem("Erro ao carregar alunos do professor.", false);
    matriculasProfessor = [];
    return;
  }

  matriculasProfessor = data || [];
}

async function carregarAulasProfessor() {
  const matriculaIds = matriculasProfessor.map((m) => m.id);

  if (!matriculaIds.length) {
    aulasProfessor = [];
    return;
  }

  /*
    Atenção:
    Na sua tabela aula, a duração chama duracao_segundos,
    não duracao_minutos.
  */

  const { data, error } = await supabase
    .from("aula")
    .select(`
      id,
      matricula_id,
      professor_id,
      data_aula,
      status,
      justificativa,
      conteudo,
      licao_casa,
      aula_gravada,
      precisa_reposicao,
      aula_original_id,
      parte,
      duracao_segundos,
      modulo_id,
      evento_id,
      aula_coletiva,
      grupo_aula_id,
      quantidade_alunos,
      reposicao_com_custo
    `)
    .in("matricula_id", matriculaIds)
    .order("data_aula", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("Erro ao carregar aulas do professor:", error);
    mostrarMensagem("Erro ao carregar aulas do professor.", false);
    aulasProfessor = [];
    return;
  }

  const mapaMatriculas = new Map();

  matriculasProfessor.forEach((matricula) => {
    mapaMatriculas.set(Number(matricula.id), matricula);
  });

  aulasProfessor = (data || []).map((aula) => {
    const matricula = mapaMatriculas.get(Number(aula.matricula_id));

    return {
      ...aula,
      matricula: matricula || null
    };
  });
}

async function carregarOcorrenciasProfessor() {
  const { data, error } = await supabase
    .from("professor_ocorrencia")
    .select(`
      id,
      professor_id,
      data_ocorrencia,
      tipo,
      descricao,
      gravidade,
      created_at
    `)
    .eq("professor_id", professorId)
    .order("data_ocorrencia", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.warn("Não foi possível carregar ocorrências do professor:", error);
    ocorrenciasProfessor = [];
    return;
  }

  ocorrenciasProfessor = data || [];
}

// ===============================
// RENDER - CABEÇALHO
// ===============================

function renderCabecalho() {
  const nome = professor?.nome || "Professor";
  const email = professor?.email || "-";
  const ativo = professor?.ativo === true;

  const cursosProfessorMateria = materiasProfessor
    .map((item) => item?.materia?.nome)
    .filter(Boolean);

  const cursosMatriculas = matriculasProfessor
    .map((item) => item?.materia?.nome)
    .filter(Boolean);

  const cursosUnicos = Array.from(
    new Set([...cursosProfessorMateria, ...cursosMatriculas])
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const cursosTexto = cursosUnicos.length
    ? cursosUnicos.join(", ")
    : "Nenhum curso vinculado";

  tituloProfessor.textContent = nome;
  subtituloProfessor.textContent = `${email} • ${ativo ? "Professor ativo" : "Professor inativo"}`;

  infoNomeProfessor.textContent = nome;
  infoEmailProfessor.textContent = email;
  infoStatusProfessor.textContent = ativo ? "Ativo" : "Inativo";
  infoStatusProfessor.style.color = ativo ? "#1b5e20" : "#b71c1c";
  infoCursosProfessor.textContent = cursosTexto;
}

// ===============================
// RENDER - INDICADORES
// ===============================

function renderIndicadores() {
  const alunosUnicos = new Set(
    matriculasProfessor
      .map((m) => m?.aluno?.id)
      .filter(Boolean)
  );

  const cursosUnicos = new Set(
    matriculasProfessor
      .map((m) => m?.materia?.id)
      .filter(Boolean)
  );

  const aulasComputaveis = aulasProfessor.filter((aula) =>
    aulaComputavelProfessor(aula)
  );

  const aulasCanceladas = aulasProfessor.filter((aula) =>
    aula.status === STATUS.CANCELADA
  );

  const prefixoMes = mesAtualPrefixo();

  const aulasMes = aulasProfessor.filter((aula) =>
    String(aula.data_aula || "").startsWith(prefixoMes)
  );

  const totalSegundos = aulasProfessor.reduce((acc, aula) => {
    return acc + (Number(aula.duracao_segundos) || 0);
  }, 0);

  const totalMinutos = segundosParaMinutos(totalSegundos);

  qtdAlunosAtivosProfessor.textContent = String(alunosUnicos.size);
  qtdMatriculasProfessor.textContent = String(matriculasProfessor.length);
  qtdCursosProfessor.textContent = String(cursosUnicos.size);
  qtdAulasRegistradasProfessor.textContent = String(aulasProfessor.length);
  qtdAulasComputaveisProfessor.textContent = String(aulasComputaveis.length);
  qtdAulasCanceladasProfessor.textContent = String(aulasCanceladas.length);
  qtdAulasMesProfessor.textContent = String(aulasMes.length);
  qtdMinutosProfessor.textContent = String(totalMinutos);
}

// ===============================
// RENDER - ALUNOS
// ===============================

function renderAlunosProfessor() {
  if (!matriculasProfessor.length) {
    listaAlunosProfessor.innerHTML = `
      <p style="font-size:13px; opacity:0.85;">
        Nenhum aluno ativo vinculado a este professor.
      </p>
    `;
    return;
  }

  const listaOrdenada = [...matriculasProfessor].sort((a, b) => {
    const nomeA = a?.aluno?.nome || "";
    const nomeB = b?.aluno?.nome || "";
    return nomeA.localeCompare(nomeB, "pt-BR");
  });

  listaAlunosProfessor.innerHTML = listaOrdenada.map((m) => {
    const aluno = m.aluno?.nome || "Aluno";
    const materia = m.materia?.nome || "Curso";
    const modulo = m.modulo?.nome || "Módulo";

    return `
      <div style="padding:9px 0; border-bottom:1px solid #e6dfcf;">
        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <strong>${escaparHtml(aluno)}</strong>

          <button
            type="button"
            class="btn"
            data-abrir-matricula="${m.id}"
            style="padding:5px 9px; font-size:12px;"
          >
            Abrir aluno
          </button>
        </div>

        <div style="font-size:12px; opacity:0.88; margin-top:4px;">
          ${escaparHtml(materia)} • ${escaparHtml(modulo)}
        </div>
      </div>
    `;
  }).join("");

  configurarBotoesAbrirAluno();
}

// ===============================
// RENDER - CURSOS
// ===============================

function renderCardsCursos() {
  const mapa = {};

  matriculasProfessor.forEach((m) => {
    const materia = m?.materia?.nome || "Curso";
    const alunoId = m?.aluno?.id;

    if (!mapa[materia]) {
      mapa[materia] = {
        alunos: new Set(),
        matriculas: 0
      };
    }

    if (alunoId) mapa[materia].alunos.add(alunoId);
    mapa[materia].matriculas += 1;
  });

  const cursos = Object.keys(mapa).sort((a, b) => a.localeCompare(b, "pt-BR"));

  if (!cursos.length) {
    cardsCursosProfessor.innerHTML = `
      <div class="card">
        <p style="font-size:14px;">Nenhum curso ativo encontrado para este professor.</p>
      </div>
    `;
    return;
  }

  cardsCursosProfessor.innerHTML = cursos.map((curso) => {
    return `
      <div class="card">
        <h2>${escaparHtml(curso)}</h2>
        <p><b>Alunos:</b> ${mapa[curso].alunos.size}</p>
        <p><b>Matrículas:</b> ${mapa[curso].matriculas}</p>
      </div>
    `;
  }).join("");
}

// ===============================
// RENDER - AULAS
// ===============================

function obterAulasFiltradas() {
  const statusSelecionado = filtroStatusAulaProfessor?.value || "";

  if (!statusSelecionado) {
    return [...aulasProfessor];
  }

  return aulasProfessor.filter((aula) =>
    normalizarTexto(aula.status) === normalizarTexto(statusSelecionado)
  );
}

function atualizarBotaoExpandirAulas(total) {
  if (!boxExpandirAulasProfessor || !btnExpandirAulasProfessor) return;

  if (total <= 6) {
    boxExpandirAulasProfessor.style.display = "none";
    return;
  }

  boxExpandirAulasProfessor.style.display = "block";
  btnExpandirAulasProfessor.textContent = aulasExpandido
    ? "Ver menos aulas"
    : "Ver mais aulas";
}

function renderAulasProfessor() {
  const aulasFiltradas = obterAulasFiltradas();

  if (!aulasFiltradas.length) {
    listaAulasProfessor.innerHTML = `
      <p style="font-size:13px; opacity:0.85;">
        Nenhuma aula encontrada com o filtro selecionado.
      </p>
    `;

    atualizarBotaoExpandirAulas(0);
    return;
  }

  const aulasParaMostrar = aulasExpandido
    ? aulasFiltradas
    : aulasFiltradas.slice(0, 6);

  listaAulasProfessor.innerHTML = aulasParaMostrar.map((aula) => {
    const data = formatarDataBR(aula.data_aula);
    const aluno = obterNomeAlunoAula(aula);
    const materia = obterMateriaAula(aula);
    const modulo = obterModuloAula(aula);
    const status = aula.status || "-";
    const parte = textoParte(aula.parte);
    const conteudo = aula.conteudo?.trim() || "Sem conteúdo informado";
    const justificativa = aula.justificativa?.trim() || "";
    const duracao = formatarDuracao(aula.duracao_segundos);

    const computavel = aulaComputavelProfessor(aula)
      ? "Computável"
      : "Não computável";

    return `
      <div style="padding:10px 0; border-bottom:1px solid #e6dfcf;">
        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <strong>${escaparHtml(data)} — ${escaparHtml(aluno)}</strong>
          <span style="font-size:12px; font-weight:700;">
            ${escaparHtml(status)}
          </span>
        </div>

        <div style="font-size:12px; opacity:0.88; margin-top:4px;">
          ${escaparHtml(materia)} • ${escaparHtml(modulo)} • ${escaparHtml(parte)}
        </div>

        <div style="font-size:12px; opacity:0.88; margin-top:4px;">
          Conteúdo: ${escaparHtml(conteudo)}
        </div>

        ${
          justificativa
            ? `<div style="font-size:12px; opacity:0.88; margin-top:4px;">
                Justificativa: ${escaparHtml(justificativa)}
              </div>`
            : ""
        }

        <div style="font-size:12px; opacity:0.88; margin-top:4px;">
          Aula gravada: ${aula.aula_gravada ? "Sim" : "Não"} •
          Duração: ${escaparHtml(duracao)} •
          ${escaparHtml(computavel)}
        </div>

        ${
          aula.aula_coletiva
            ? `<div style="font-size:12px; opacity:0.88; margin-top:4px;">
                Aula coletiva • Grupo: ${escaparHtml(aula.grupo_aula_id || "-")} •
                Qtd. alunos: ${Number(aula.quantidade_alunos || 1)}
              </div>`
            : ""
        }
      </div>
    `;
  }).join("");

  atualizarBotaoExpandirAulas(aulasFiltradas.length);
}

// ===============================
// RENDER - PONTOS DE ATENÇÃO
// ===============================

function renderCancelamentosAtencao() {
  const canceladasTodas = aulasProfessor.filter((aula) =>
    aula.status === STATUS.CANCELADA
  );

  const canceladas = canceladasTodas.slice(0, 6);

  qtdCancelamentosAtencao.textContent = String(canceladasTodas.length);

  if (!canceladasTodas.length) {
    listaCancelamentosAtencao.innerHTML = `
      <p style="font-size:13px; opacity:0.85;">
        Nenhuma aula cancelada registrada.
      </p>
    `;
    return;
  }

  listaCancelamentosAtencao.innerHTML = canceladas.map((aula) => {
    const data = formatarDataBR(aula.data_aula);
    const aluno = obterNomeAlunoAula(aula);
    const justificativa = aula.justificativa?.trim() || "Sem justificativa";

    return `
      <div style="padding:8px 0; border-bottom:1px solid #e6dfcf;">
        <strong>${escaparHtml(data)} — ${escaparHtml(aluno)}</strong>
        <div style="font-size:12px; opacity:0.88; margin-top:4px;">
          Justificativa: ${escaparHtml(justificativa)}
        </div>
      </div>
    `;
  }).join("");

  if (canceladasTodas.length > 6) {
    listaCancelamentosAtencao.innerHTML += `
      <p style="font-size:12px; opacity:0.8; margin-top:8px;">
        + ${canceladasTodas.length - 6} outro(s) cancelamento(s).
      </p>
    `;
  }
}

function renderAulasSemMinutagem() {
  const semMinutagemTodas = aulasProfessor.filter((aula) => {
    if (aula.status === STATUS.CANCELADA) return false;
    return !aula.duracao_segundos;
  });

  const semMinutagem = semMinutagemTodas.slice(0, 6);

  qtdAulasSemMinutagem.textContent = String(semMinutagemTodas.length);

  if (!semMinutagemTodas.length) {
    listaAulasSemMinutagem.innerHTML = `
      <p style="font-size:13px; opacity:0.85;">
        Nenhuma aula sem minutagem.
      </p>
    `;
    return;
  }

  listaAulasSemMinutagem.innerHTML = semMinutagem.map((aula) => {
    const data = formatarDataBR(aula.data_aula);
    const aluno = obterNomeAlunoAula(aula);
    const status = aula.status || "-";

    return `
      <div style="padding:8px 0; border-bottom:1px solid #e6dfcf;">
        <strong>${escaparHtml(data)} — ${escaparHtml(aluno)}</strong>
        <div style="font-size:12px; opacity:0.88; margin-top:4px;">
          Status: ${escaparHtml(status)} • Duração não informada
        </div>
      </div>
    `;
  }).join("");

  if (semMinutagemTodas.length > 6) {
    listaAulasSemMinutagem.innerHTML += `
      <p style="font-size:12px; opacity:0.8; margin-top:8px;">
        + ${semMinutagemTodas.length - 6} outra(s) aula(s) sem duração.
      </p>
    `;
  }
}

function renderOcorrenciasProfessor() {
  const cards = Array.from(document.querySelectorAll(".card"));
  const cardOcorrencias = cards.find((card) =>
    card.textContent.includes("Advertências / ocorrências")
  );

  if (!cardOcorrencias) return;

  if (!ocorrenciasProfessor.length) {
    cardOcorrencias.innerHTML = `
      <h2>⚠️ Advertências / ocorrências</h2>
      <p style="font-size:13px; opacity:0.88;">
        Nenhuma ocorrência registrada para este professor.
      </p>
      <p style="font-size:12px; opacity:0.8; margin-top:8px;">
        As próximas ocorrências cadastradas na tabela professor_ocorrencia aparecerão aqui.
      </p>
    `;
    return;
  }

  const ocorrenciasRecentes = ocorrenciasProfessor.slice(0, 6);

  cardOcorrencias.innerHTML = `
    <h2>⚠️ Advertências / ocorrências</h2>
    <p><b>${ocorrenciasProfessor.length}</b> ocorrência(s)</p>

    <div style="margin-top:10px; font-size:13px;">
      ${ocorrenciasRecentes.map((oc) => {
        return `
          <div style="padding:8px 0; border-bottom:1px solid #e6dfcf;">
            <strong>${escaparHtml(formatarDataBR(oc.data_ocorrencia))} — ${escaparHtml(oc.tipo)}</strong>
            <div style="font-size:12px; opacity:0.88; margin-top:4px;">
              Gravidade: ${escaparHtml(oc.gravidade || "Observação")}
            </div>
            <div style="font-size:12px; opacity:0.88; margin-top:4px;">
              ${escaparHtml(oc.descricao)}
            </div>
          </div>
        `;
      }).join("")}
    </div>

    ${
      ocorrenciasProfessor.length > 6
        ? `<p style="font-size:12px; opacity:0.8; margin-top:8px;">
            + ${ocorrenciasProfessor.length - 6} outra(s) ocorrência(s).
          </p>`
        : ""
    }
  `;
}

function renderPontosAtencao() {
  renderCancelamentosAtencao();
  renderAulasSemMinutagem();
  renderOcorrenciasProfessor();
}

// ===============================
// INIT
// ===============================

async function init() {
  try {
    await carregarProfessor();

    if (!professor) return;

    await carregarMateriasProfessor();
    await carregarMatriculasProfessor();
    await carregarAulasProfessor();
    await carregarOcorrenciasProfessor();

    renderCabecalho();
    renderIndicadores();
    renderAlunosProfessor();
    renderCardsCursos();
    renderAulasProfessor();
    renderPontosAtencao();

  } catch (error) {
    console.error("Erro ao carregar detalhes do professor:", error);
    mostrarMensagem("Erro ao carregar detalhes do professor.", false);
  }
}

// ===============================
// EVENTOS
// ===============================

btnExpandirAulasProfessor?.addEventListener("click", () => {
  aulasExpandido = !aulasExpandido;
  renderAulasProfessor();
});

filtroStatusAulaProfessor?.addEventListener("change", () => {
  aulasExpandido = false;
  renderAulasProfessor();
});

// ===============================
// INÍCIO
// ===============================

init();