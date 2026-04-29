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
const qtdAulasMesProfessor = document.getElementById("qtdAulasMesProfessor");
const qtdAulasComputaveisProfessor = document.getElementById("qtdAulasComputaveisProfessor");
const qtdMinutosProfessor = document.getElementById("qtdMinutosProfessor");

const cardsCursosProfessor = document.getElementById("cardsCursosProfessor");

const listaAlunosProfessor = document.getElementById("listaAlunosProfessor");
const btnExpandirAlunosProfessor = document.getElementById("btnExpandirAlunosProfessor");

const filtroStatusAulaProfessor = document.getElementById("filtroStatusAulaProfessor");
const listaAulasProfessor = document.getElementById("listaAulasProfessor");
const boxExpandirAulasProfessor = document.getElementById("boxExpandirAulasProfessor");
const btnExpandirAulasProfessor = document.getElementById("btnExpandirAulasProfessor");

const btnMostrarFormOcorrencia = document.getElementById("btnMostrarFormOcorrencia");
const formOcorrenciaProfessor = document.getElementById("formOcorrenciaProfessor");
const btnCancelarOcorrencia = document.getElementById("btnCancelarOcorrencia");
const btnSalvarOcorrencia = document.getElementById("btnSalvarOcorrencia");

const ocorrenciaData = document.getElementById("ocorrenciaData");
const ocorrenciaTipo = document.getElementById("ocorrenciaTipo");
const ocorrenciaGravidade = document.getElementById("ocorrenciaGravidade");
const ocorrenciaMotivo = document.getElementById("ocorrenciaMotivo");
const ocorrenciaProvidencia = document.getElementById("ocorrenciaProvidencia");
const ocorrenciaDescricao = document.getElementById("ocorrenciaDescricao");

const listaOcorrenciasProfessor = document.getElementById("listaOcorrenciasProfessor");
const boxExpandirOcorrenciasProfessor = document.getElementById("boxExpandirOcorrenciasProfessor");
const btnExpandirOcorrenciasProfessor = document.getElementById("btnExpandirOcorrenciasProfessor");

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

let alunosExpandido = false;
let aulasExpandido = false;
let ocorrenciasExpandido = false;

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
  msg.style.padding = "10px 12px";
  msg.style.borderRadius = "10px";
  msg.style.fontSize = "13px";
  msg.style.fontWeight = "600";
  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";
  msg.style.border = ok ? "1px solid #66bb6a" : "1px solid #ef5350";

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
  }, 2800);
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

function dataHojeLocalISO() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
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
    Aula computável:
    é a aula que pode entrar no acompanhamento administrativo/financeiro.

    Conta:
    - Presente com aula gravada
    - Ausente com aula gravada
    - Reposição com aula gravada
    - Aula Instrumental com aula gravada
    - Plantão de dúvidas com aula gravada

    Não conta:
    - Cancelada
    - Aula sem gravação
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

function pluralAlunos(qtd) {
  return Number(qtd) === 1 ? "1 aluno" : `${qtd} alunos`;
}

function obterMatriculasPorCurso() {
  const mapa = new Map();

  materiasProfessor.forEach((pm) => {
    const materiaId = Number(pm.materia_id);
    const materiaNome = pm?.materia?.nome || "Curso";

    if (!mapa.has(materiaId)) {
      mapa.set(materiaId, {
        materia_id: materiaId,
        materia_nome: materiaNome,
        alunos: new Set(),
        matriculas: 0
      });
    }
  });

  matriculasProfessor.forEach((m) => {
    const materiaId = Number(m.materia_id);
    const materiaNome = m?.materia?.nome || "Curso";

    if (!mapa.has(materiaId)) {
      mapa.set(materiaId, {
        materia_id: materiaId,
        materia_nome: materiaNome,
        alunos: new Set(),
        matriculas: 0
      });
    }

    const item = mapa.get(materiaId);

    if (m?.aluno?.id) {
      item.alunos.add(Number(m.aluno.id));
    }

    item.matriculas += 1;
  });

  return Array.from(mapa.values()).sort((a, b) =>
    a.materia_nome.localeCompare(b.materia_nome, "pt-BR")
  );
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
      motivo,
      providencia,
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

  const prefixoMes = mesAtualPrefixo();

  const aulasMes = aulasProfessor.filter((aula) =>
    String(aula.data_aula || "").startsWith(prefixoMes)
  );

  const aulasComputaveisMes = aulasMes.filter((aula) =>
    aulaComputavelProfessor(aula)
  );

  const totalSegundosMes = aulasMes.reduce((acc, aula) => {
    return acc + (Number(aula.duracao_segundos) || 0);
  }, 0);

  const totalMinutosMes = segundosParaMinutos(totalSegundosMes);

  qtdAlunosAtivosProfessor.textContent = String(alunosUnicos.size);
  qtdMatriculasProfessor.textContent = String(matriculasProfessor.length);
  qtdCursosProfessor.textContent = String(cursosUnicos.size);
  qtdAulasMesProfessor.textContent = String(aulasMes.length);
  qtdAulasComputaveisProfessor.textContent = String(aulasComputaveisMes.length);
  qtdMinutosProfessor.textContent = String(totalMinutosMes);
}

// ===============================
// RENDER - CURSOS
// ===============================

function renderCardsCursos() {
  const cursos = obterMatriculasPorCurso();

  if (!cursos.length) {
    cardsCursosProfessor.innerHTML = `
      <div style="padding:12px; border:1px solid #eee; border-radius:10px; background:#fffdf5;">
        <p style="font-size:14px; margin:0;">Nenhum curso ativo encontrado para este professor.</p>
      </div>
    `;
    return;
  }

  cardsCursosProfessor.innerHTML = cursos.map((curso) => {
    const qtdAlunos = curso.alunos.size;
    const qtdMatriculas = curso.matriculas;

    return `
      <div style="padding:12px; border:1px solid #eee; border-radius:10px; background:#fffdf5;">
        <div style="font-size:12px; opacity:0.75;">${escaparHtml(curso.materia_nome)}</div>
        <div style="font-size:22px; font-weight:700; margin-top:5px;">
          ${escaparHtml(pluralAlunos(qtdAlunos))}
        </div>
        <div style="font-size:12px; opacity:0.85; margin-top:5px;">
          ${qtdMatriculas} matrícula(s) ativa(s)
        </div>
      </div>
    `;
  }).join("");
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

    if (btnExpandirAlunosProfessor) {
      btnExpandirAlunosProfessor.style.display = "none";
    }

    return;
  }

  const listaOrdenada = [...matriculasProfessor].sort((a, b) => {
    const nomeA = a?.aluno?.nome || "";
    const nomeB = b?.aluno?.nome || "";
    return nomeA.localeCompare(nomeB, "pt-BR");
  });

  const total = listaOrdenada.length;
  const limite = 3;

  const listaParaMostrar = alunosExpandido
    ? listaOrdenada
    : listaOrdenada.slice(0, limite);

  listaAlunosProfessor.innerHTML = listaParaMostrar.map((m) => {
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

  if (btnExpandirAlunosProfessor) {
    if (total <= limite) {
      btnExpandirAlunosProfessor.style.display = "none";
    } else {
      btnExpandirAlunosProfessor.style.display = "inline-block";
      btnExpandirAlunosProfessor.textContent = alunosExpandido
        ? "Ver menos"
        : `Ver mais (${total - limite})`;
    }
  }

  configurarBotoesAbrirAluno();
}

// ===============================
// RENDER - AULAS
// ===============================

function obterAulasFiltradas() {
  const statusSelecionado = filtroStatusAulaProfessor?.value || "";

  let aulas = [...aulasProfessor];

  /*
    Removido daqui:
    - aulas canceladas
    - aulas sem minutagem

    Você pediu que essas aulas não apareçam nesta tela.
  */
  aulas = aulas.filter((aula) => {
    if (aula.status === STATUS.CANCELADA) return false;
    if (!aula.duracao_segundos) return false;
    return true;
  });

  if (!statusSelecionado) {
    return aulas;
  }

  return aulas.filter((aula) =>
    normalizarTexto(aula.status) === normalizarTexto(statusSelecionado)
  );
}

function atualizarBotaoExpandirAulas(total) {
  if (!boxExpandirAulasProfessor || !btnExpandirAulasProfessor) return;

  const limite = 3;

  if (total <= limite) {
    boxExpandirAulasProfessor.style.display = "none";
    return;
  }

  boxExpandirAulasProfessor.style.display = "block";
  btnExpandirAulasProfessor.textContent = aulasExpandido
    ? "Ver menos aulas"
    : `Ver mais aulas (${total - limite})`;
}

function renderAulasProfessor() {
  const aulasFiltradas = obterAulasFiltradas();

  if (!aulasFiltradas.length) {
    listaAulasProfessor.innerHTML = `
      <p style="font-size:13px; opacity:0.85;">
        Nenhuma aula recente encontrada com minutagem registrada.
      </p>
    `;

    atualizarBotaoExpandirAulas(0);
    return;
  }

  const limite = 3;

  const aulasParaMostrar = aulasExpandido
    ? aulasFiltradas
    : aulasFiltradas.slice(0, limite);

  listaAulasProfessor.innerHTML = aulasParaMostrar.map((aula) => {
    const data = formatarDataBR(aula.data_aula);
    const aluno = obterNomeAlunoAula(aula);
    const materia = obterMateriaAula(aula);
    const modulo = obterModuloAula(aula);
    const status = aula.status || "-";
    const parte = textoParte(aula.parte);
    const conteudo = aula.conteudo?.trim() || "Sem conteúdo informado";
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
// RENDER - OCORRÊNCIAS
// ===============================

function renderOcorrenciasProfessor() {
  if (!ocorrenciasProfessor.length) {
    listaOcorrenciasProfessor.innerHTML = `
      <p style="font-size:13px; opacity:0.85;">
        Nenhuma ocorrência registrada para este professor.
      </p>
    `;

    if (boxExpandirOcorrenciasProfessor) {
      boxExpandirOcorrenciasProfessor.style.display = "none";
    }

    return;
  }

  const limite = 3;

  const ocorrenciasParaMostrar = ocorrenciasExpandido
    ? ocorrenciasProfessor
    : ocorrenciasProfessor.slice(0, limite);

  listaOcorrenciasProfessor.innerHTML = ocorrenciasParaMostrar.map((oc) => {
    const data = formatarDataBR(oc.data_ocorrencia);
    const tipo = oc.tipo || "Ocorrência";
    const gravidade = oc.gravidade || "Observação";
    const motivo = oc.motivo || "";
    const providencia = oc.providencia || "";
    const descricao = oc.descricao || "";

    return `
      <div style="padding:10px 0; border-bottom:1px solid #e6dfcf;">
        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <strong>${escaparHtml(data)} — ${escaparHtml(tipo)}</strong>
          <span style="font-size:12px; font-weight:700;">
            ${escaparHtml(gravidade)}
          </span>
        </div>

        ${
          motivo
            ? `<div style="font-size:12px; opacity:0.88; margin-top:4px;">
                <strong>Motivo:</strong> ${escaparHtml(motivo)}
              </div>`
            : ""
        }

        ${
          providencia
            ? `<div style="font-size:12px; opacity:0.88; margin-top:4px;">
                <strong>Providência:</strong> ${escaparHtml(providencia)}
              </div>`
            : ""
        }

        <div style="font-size:12px; opacity:0.88; margin-top:4px;">
          <strong>Descrição:</strong> ${escaparHtml(descricao)}
        </div>
      </div>
    `;
  }).join("");

  if (boxExpandirOcorrenciasProfessor && btnExpandirOcorrenciasProfessor) {
    if (ocorrenciasProfessor.length <= limite) {
      boxExpandirOcorrenciasProfessor.style.display = "none";
    } else {
      boxExpandirOcorrenciasProfessor.style.display = "block";
      btnExpandirOcorrenciasProfessor.textContent = ocorrenciasExpandido
        ? "Ver menos ocorrências"
        : `Ver mais ocorrências (${ocorrenciasProfessor.length - limite})`;
    }
  }
}

// ===============================
// FORMULÁRIO DE OCORRÊNCIA
// ===============================

function abrirFormOcorrencia() {
  formOcorrenciaProfessor.style.display = "block";
  btnMostrarFormOcorrencia.style.display = "none";

  ocorrenciaData.value = dataHojeLocalISO();
  ocorrenciaTipo.value = "";
  ocorrenciaGravidade.value = "Observação";
  ocorrenciaMotivo.value = "";
  ocorrenciaProvidencia.value = "";
  ocorrenciaDescricao.value = "";

  ocorrenciaTipo.focus();
}

function fecharFormOcorrencia() {
  formOcorrenciaProfessor.style.display = "none";
  btnMostrarFormOcorrencia.style.display = "inline-block";

  formOcorrenciaProfessor.reset();
}

async function salvarOcorrencia(event) {
  event.preventDefault();

  const dataOcorrencia = ocorrenciaData.value;
  const tipo = ocorrenciaTipo.value;
  const gravidade = ocorrenciaGravidade.value;
  const motivo = ocorrenciaMotivo.value.trim();
  const providencia = ocorrenciaProvidencia.value.trim();
  const descricao = ocorrenciaDescricao.value.trim();

  if (!dataOcorrencia || !tipo || !gravidade || !motivo || !providencia || !descricao) {
    mostrarMensagem("Preencha todos os campos da ocorrência.", false);
    return;
  }

  btnSalvarOcorrencia.disabled = true;
  btnSalvarOcorrencia.textContent = "Salvando...";

  const { error } = await supabase
    .from("professor_ocorrencia")
    .insert({
      professor_id: Number(professorId),
      data_ocorrencia: dataOcorrencia,
      tipo,
      gravidade,
      motivo,
      providencia,
      descricao
    });

  btnSalvarOcorrencia.disabled = false;
  btnSalvarOcorrencia.textContent = "Salvar ocorrência";

  if (error) {
    console.error("Erro ao salvar ocorrência:", error);
    mostrarMensagem("Erro ao salvar ocorrência.", false);
    return;
  }

  mostrarMensagem("Ocorrência registrada com sucesso!", true);

  fecharFormOcorrencia();

  await carregarOcorrenciasProfessor();
  ocorrenciasExpandido = false;
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
    renderCardsCursos();
    renderAlunosProfessor();
    renderAulasProfessor();
    renderOcorrenciasProfessor();

  } catch (error) {
    console.error("Erro ao carregar detalhes do professor:", error);
    mostrarMensagem("Erro ao carregar detalhes do professor.", false);
  }
}

// ===============================
// EVENTOS
// ===============================

btnExpandirAlunosProfessor?.addEventListener("click", () => {
  alunosExpandido = !alunosExpandido;
  renderAlunosProfessor();
});

btnExpandirAulasProfessor?.addEventListener("click", () => {
  aulasExpandido = !aulasExpandido;
  renderAulasProfessor();
});

filtroStatusAulaProfessor?.addEventListener("change", () => {
  aulasExpandido = false;
  renderAulasProfessor();
});

btnMostrarFormOcorrencia?.addEventListener("click", abrirFormOcorrencia);

btnCancelarOcorrencia?.addEventListener("click", fecharFormOcorrencia);

formOcorrenciaProfessor?.addEventListener("submit", salvarOcorrencia);

btnExpandirOcorrenciasProfessor?.addEventListener("click", () => {
  ocorrenciasExpandido = !ocorrenciasExpandido;
  renderOcorrenciasProfessor();
});

// ===============================
// INÍCIO
// ===============================

init();