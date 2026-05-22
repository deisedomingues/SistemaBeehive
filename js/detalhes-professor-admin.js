import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

// =====================================================
// 1. PEGAR ID DO PROFESSOR
// =====================================================

function obterProfessorIdSelecionado() {
  const params = new URLSearchParams(window.location.search);

  const idUrl =
    params.get("id") ||
    params.get("professor_id") ||
    params.get("professorId");

  if (idUrl) return Number(idUrl);

  const idStorage =
    localStorage.getItem("professorSelecionadoAdmin") ||
    localStorage.getItem("professorSelecionado") ||
    localStorage.getItem("professorIdSelecionado") ||
    localStorage.getItem("professorAdminId") ||
    localStorage.getItem("detalhesProfessorId");

  if (idStorage) return Number(idStorage);

  return null;
}

const professorId = obterProfessorIdSelecionado();

if (!professorId) {
  alert("Professor não encontrado. Volte ao resumo e selecione um professor.");
  window.location.href = "resumo-geral.html";
}

// =====================================================
// 2. ELEMENTOS DA TELA
// =====================================================

const msg = document.getElementById("msg");

const tituloProfessor = document.getElementById("tituloProfessor");
const subtituloProfessor = document.getElementById("subtituloProfessor");

const infoNomeProfessor = document.getElementById("infoNomeProfessor");
const infoEmailProfessor = document.getElementById("infoEmailProfessor");
const infoStatusProfessor = document.getElementById("infoStatusProfessor");
const infoCursosProfessor = document.getElementById("infoCursosProfessor");

const qtdMatriculasProfessor = document.getElementById("qtdMatriculasProfessor");
const qtdAlunosAtivosProfessor = document.getElementById("qtdAlunosAtivosProfessor");
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

const ocorrenciaData = document.getElementById("ocorrenciaData");
const ocorrenciaTipo = document.getElementById("ocorrenciaTipo");
const ocorrenciaGravidade = document.getElementById("ocorrenciaGravidade");
const ocorrenciaMotivo = document.getElementById("ocorrenciaMotivo");
const ocorrenciaProvidencia = document.getElementById("ocorrenciaProvidencia");
const ocorrenciaDescricao = document.getElementById("ocorrenciaDescricao");

const btnCancelarOcorrencia = document.getElementById("btnCancelarOcorrencia");
const btnSalvarOcorrencia = document.getElementById("btnSalvarOcorrencia");

const listaOcorrenciasProfessor = document.getElementById("listaOcorrenciasProfessor");
const boxExpandirOcorrenciasProfessor = document.getElementById("boxExpandirOcorrenciasProfessor");
const btnExpandirOcorrenciasProfessor = document.getElementById("btnExpandirOcorrenciasProfessor");

// =====================================================
// 3. ESTADO
// =====================================================

let professorAtual = null;
let cursosProfessor = [];
let matriculasProfessor = [];
let aulasProfessor = [];
let ocorrenciasProfessor = [];

let alunosExpandido = false;
let aulasExpandido = false;
let ocorrenciasExpandido = false;

// =====================================================
// 4. CONSTANTES
// =====================================================

const STATUS = {
  PRESENTE: "Presente",
  AUSENTE: "Ausente",
  CANCELADA: "Cancelada",
  TRANCADA: "Trancada",
  REPOSICAO: "Reposição",
  AULA_INSTRUMENTAL: "Aula Instrumental",
  PLANTAO_DUVIDAS: "Plantão de dúvidas"
};

// =====================================================
// 5. UTILITÁRIOS
// =====================================================

function mostrarMensagem(texto, ok = true) {
  if (!msg) {
    alert(texto);
    return;
  }

  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";
  msg.style.padding = "10px 12px";
  msg.style.borderRadius = "10px";
  msg.style.fontWeight = "600";
  msg.style.textAlign = "center";

  msg.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
  }, 3500);
}

function escaparHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarDataBR(dataISO) {
  if (!dataISO) return "-";

  const partes = String(dataISO).split("-");
  const ano = partes[0];
  const mes = partes[1];
  const dia = partes[2];

  if (!ano || !mes || !dia) return "-";

  return `${dia}/${mes}/${ano}`;
}

function hojeISO() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function inicioMesISO() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");

  return `${ano}-${mes}-01`;
}

function proximoMesISO() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mesAtual = hoje.getMonth();

  const primeiroDiaProximoMes = new Date(ano, mesAtual + 1, 1);

  const anoFinal = primeiroDiaProximoMes.getFullYear();
  const mesFinal = String(primeiroDiaProximoMes.getMonth() + 1).padStart(2, "0");

  return `${anoFinal}-${mesFinal}-01`;
}

function normalizarTexto(valor) {
  return String(valor || "").trim().toLowerCase();
}

function formatarMinutosDeSegundos(segundos) {
  const totalSegundos = Number(segundos || 0);

  if (!totalSegundos) return "0";

  const minutos = Math.floor(totalSegundos / 60);
  const restoSegundos = totalSegundos % 60;

  if (restoSegundos === 0) return String(minutos);

  return `${minutos}m ${restoSegundos}s`;
}

function aulaComputavelFinanceiro(aula) {
  const status = normalizarTexto(aula?.status);
  const gravada = aula?.aula_gravada === true;

  if (status === "presente" && gravada) return true;
  if (status === "ausente" && gravada) return true;
  if ((status === "reposição" || status === "reposicao") && gravada) return true;
  if (status === "aula instrumental" && gravada) return true;
  if (status === "plantão de dúvidas" && gravada) return true;
  if (status === "plantao de dúvidas" && gravada) return true;
  if (status === "plantão de duvidas" && gravada) return true;
  if (status === "plantao de duvidas" && gravada) return true;

  return false;
}

function textoStatusProfessor(ativo) {
  if (ativo === false) return "Inativo";
  return "Ativo";
}

function textoParte(parte) {
  if (!parte) return "Parte não informada";
  return `Parte ${parte}`;
}

function obterNomeAlunoDaAula(aula) {
  return aula?.matricula?.aluno?.nome || "Aluno não informado";
}

function obterCursoDaAula(aula) {
  return aula?.matricula?.materia?.nome || "Curso não informado";
}

function obterModuloDaAula(aula) {
  return aula?.modulo?.nome || aula?.matricula?.modulo?.nome || "Módulo não informado";
}

// =====================================================
// 6. BUSCAS NO BANCO
// =====================================================

async function carregarProfessor() {
  const { data, error } = await supabase
    .from("professor")
    .select("id, nome, email, ativo")
    .eq("id", professorId)
    .single();

  if (error || !data) {
    console.error("Erro ao carregar professor:", error);
    mostrarMensagem("Erro ao carregar dados do professor.", false);
    return null;
  }

  professorAtual = data;
  return data;
}

async function carregarCursosProfessor() {
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
    console.error("Erro ao carregar cursos do professor:", error);
    cursosProfessor = [];
    return [];
  }

  cursosProfessor = data || [];
  return cursosProfessor;
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
      data_inicio,
      data_fim,
      ativa,
      aluno:aluno_id (
        id,
        nome,
        email,
        telefone
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
    .order("ativa", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("Erro ao carregar matrículas do professor:", error);
    matriculasProfessor = [];
    return [];
  }

  matriculasProfessor = data || [];
  return matriculasProfessor;
}

async function carregarAulasProfessor() {
  const dataInicio = inicioMesISO();
  const dataFim = proximoMesISO();

  const { data, error } = await supabase
    .from("aula")
    .select(`
      id,
      data_aula,
      status,
      justificativa,
      conteudo,
      licao_casa,
      parte,
      aula_gravada,
      precisa_reposicao,
      duracao_segundos,
      aula_original_id,
      reposicao_com_custo,
      aula_coletiva,
      grupo_aula_id,
      quantidade_alunos,
      modulo_id,
      matricula_id,
      modulo:modulo_id (
        id,
        nome
      ),
      matricula:matricula_id (
        id,
        aluno_id,
        materia_id,
        modulo_id,
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
      )
    `)
    .eq("professor_id", professorId)
    .gte("data_aula", dataInicio)
    .lt("data_aula", dataFim)
    .order("data_aula", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("Erro ao carregar aulas do professor:", error);
    aulasProfessor = [];
    return [];
  }

  aulasProfessor = data || [];
  return aulasProfessor;
}

async function carregarOcorrenciasProfessor() {
  const { data, error } = await supabase
    .from("professor_ocorrencia")
    .select("*")
    .eq("professor_id", professorId)
    .order("data_ocorrencia", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("Erro ao carregar ocorrências do professor:", error);

    if (listaOcorrenciasProfessor) {
      listaOcorrenciasProfessor.innerHTML = `
        <p style="font-size:13px; color:#b71c1c;">
          Não foi possível carregar as ocorrências. Verifique se a tabela professor_ocorrencia
          possui as colunas esperadas.
        </p>
      `;
    }

    ocorrenciasProfessor = [];
    return [];
  }

  ocorrenciasProfessor = data || [];
  return ocorrenciasProfessor;
}

// =====================================================
// 7. RENDERIZAÇÃO — CABEÇALHO E CARDS
// =====================================================

function renderProfessor() {
  if (!professorAtual) return;

  const nome = professorAtual.nome || "Professor";
  const email = professorAtual.email || "-";
  const status = textoStatusProfessor(professorAtual.ativo);

  const nomesCursos = cursosProfessor
    .map((item) => item.materia?.nome)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  if (tituloProfessor) {
    tituloProfessor.textContent = nome;
  }

  if (subtituloProfessor) {
    subtituloProfessor.textContent = nomesCursos.length
      ? `Professor(a) de ${nomesCursos.join(", ")}`
      : "Professor(a) sem curso vinculado.";
  }

  if (infoNomeProfessor) infoNomeProfessor.textContent = nome;
  if (infoEmailProfessor) infoEmailProfessor.textContent = email;
  if (infoStatusProfessor) infoStatusProfessor.textContent = status;

  if (infoStatusProfessor) {
    infoStatusProfessor.style.color = professorAtual.ativo === false ? "#b71c1c" : "#1b5e20";
  }

  if (infoCursosProfessor) {
    infoCursosProfessor.textContent = nomesCursos.length
      ? nomesCursos.join(", ")
      : "Nenhum curso vinculado";
  }
}

function renderIndicadores() {
  const matriculasAtivas = matriculasProfessor.filter((m) => m.ativa === true);

  const alunosAtivosUnicos = new Set(
    matriculasAtivas
      .map((m) => m.aluno_id)
      .filter(Boolean)
  );

  const cursosAtivosUnicos = new Set(
    matriculasAtivas
      .map((m) => m.materia_id)
      .filter(Boolean)
  );

  const aulasMes = aulasProfessor;

  const aulasComputaveis = aulasMes.filter(aulaComputavelFinanceiro);

  const totalSegundos = aulasMes.reduce((total, aula) => {
    return total + Number(aula.duracao_segundos || 0);
  }, 0);

  if (qtdMatriculasProfessor) {
    qtdMatriculasProfessor.textContent = String(matriculasAtivas.length);
  }

  if (qtdAlunosAtivosProfessor) {
    qtdAlunosAtivosProfessor.textContent = String(alunosAtivosUnicos.size);
  }

  if (qtdCursosProfessor) {
    qtdCursosProfessor.textContent = String(cursosAtivosUnicos.size);
  }

  if (qtdAulasMesProfessor) {
    qtdAulasMesProfessor.textContent = String(aulasMes.length);
  }

  if (qtdAulasComputaveisProfessor) {
    qtdAulasComputaveisProfessor.textContent = String(aulasComputaveis.length);
  }

  if (qtdMinutosProfessor) {
    qtdMinutosProfessor.textContent = formatarMinutosDeSegundos(totalSegundos);
  }
}

function renderCursosProfessor() {
  if (!cardsCursosProfessor) return;

  const matriculasAtivas = matriculasProfessor.filter((m) => m.ativa === true);

  if (!cursosProfessor.length && !matriculasAtivas.length) {
    cardsCursosProfessor.innerHTML = `
      <p style="font-size:13px; opacity:0.85;">
        Nenhum curso vinculado a este professor.
      </p>
    `;
    return;
  }

  const mapa = new Map();

  cursosProfessor.forEach((curso) => {
    const materiaId = String(curso.materia_id);

    mapa.set(materiaId, {
      materiaId,
      nome: curso.materia?.nome || "Curso não informado",
      valorHora: curso.valor_hora,
      quantidade: 0
    });
  });

  matriculasAtivas.forEach((matricula) => {
    const materiaId = String(matricula.materia_id);

    if (!mapa.has(materiaId)) {
      mapa.set(materiaId, {
        materiaId,
        nome: matricula.materia?.nome || "Curso não informado",
        valorHora: null,
        quantidade: 0
      });
    }

    const item = mapa.get(materiaId);
    item.quantidade += 1;
  });

  const cursos = Array.from(mapa.values())
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  cardsCursosProfessor.innerHTML = cursos.map((curso) => {
    const valorHoraTexto =
      curso.valorHora !== null && curso.valorHora !== undefined
        ? `Valor hora: R$ ${Number(curso.valorHora).toFixed(2).replace(".", ",")}`
        : "Valor hora não cadastrado";

    return `
      <div style="padding:12px; border:1px solid #eee; border-radius:10px; background:#fffdf5;">
        <div style="font-weight:700; margin-bottom:6px;">
          ${escaparHtml(curso.nome)}
        </div>

        <div style="font-size:13px; opacity:0.85;">
          ${curso.quantidade} matrícula(s) ativa(s)
        </div>

        <div style="font-size:12px; opacity:0.75; margin-top:4px;">
          ${escaparHtml(valorHoraTexto)}
        </div>
      </div>
    `;
  }).join("");
}

// =====================================================
// 8. RENDERIZAÇÃO — ALUNOS
// =====================================================

function renderAlunosProfessor() {
  if (!listaAlunosProfessor) return;

  const matriculasAtivas = matriculasProfessor
    .filter((m) => m.ativa === true)
    .sort((a, b) => {
      const nomeA = a.aluno?.nome || "";
      const nomeB = b.aluno?.nome || "";
      return nomeA.localeCompare(nomeB, "pt-BR");
    });

  if (!matriculasAtivas.length) {
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

  const limite = alunosExpandido ? matriculasAtivas.length : 5;
  const visiveis = matriculasAtivas.slice(0, limite);

  listaAlunosProfessor.innerHTML = visiveis.map((matricula) => {
    const nome = matricula.aluno?.nome || "Aluno sem nome";
    const curso = matricula.materia?.nome || "Curso não informado";
    const modulo = matricula.modulo?.nome || "Módulo não informado";
    const email = matricula.aluno?.email || "";
    const telefone = matricula.aluno?.telefone || "";

    return `
      <div style="padding:10px 0; border-bottom:1px solid #e6dfcf;">
        <div style="font-weight:700;">
          ${escaparHtml(nome)}
        </div>

        <div style="font-size:13px; opacity:0.9; margin-top:3px;">
          ${escaparHtml(curso)} | ${escaparHtml(modulo)}
        </div>

        ${
          email || telefone
            ? `<div style="font-size:12px; opacity:0.75; margin-top:3px;">
                ${email ? `E-mail: ${escaparHtml(email)}` : ""}
                ${email && telefone ? " | " : ""}
                ${telefone ? `Telefone: ${escaparHtml(telefone)}` : ""}
              </div>`
            : ""
        }
      </div>
    `;
  }).join("");

  if (btnExpandirAlunosProfessor) {
    if (matriculasAtivas.length <= 5) {
      btnExpandirAlunosProfessor.style.display = "none";
    } else {
      btnExpandirAlunosProfessor.style.display = "inline-block";
      btnExpandirAlunosProfessor.textContent = alunosExpandido ? "Ver menos" : "Ver mais";
    }
  }
}

// =====================================================
// 9. RENDERIZAÇÃO — AULAS
// =====================================================

function obterAulasFiltradas() {
  const statusFiltro = filtroStatusAulaProfessor?.value || "";

  let aulas = [...aulasProfessor];

  if (statusFiltro) {
    aulas = aulas.filter((aula) => aula.status === statusFiltro);
  }

  return aulas;
}

function agruparAulasColetivas(aulas) {
  const grupos = new Map();
  const individuais = [];

  aulas.forEach((aula) => {
    if (aula.aula_coletiva && aula.grupo_aula_id) {
      const chave = aula.grupo_aula_id;

      if (!grupos.has(chave)) {
        grupos.set(chave, {
          tipo: "coletiva",
          grupoAulaId: chave,
          data_aula: aula.data_aula,
          status: aula.status,
          parte: aula.parte,
          conteudo: aula.conteudo,
          licao_casa: aula.licao_casa,
          duracao_segundos: aula.duracao_segundos,
          quantidade_alunos: aula.quantidade_alunos,
          modulo: obterModuloDaAula(aula),
          curso: obterCursoDaAula(aula),
          alunos: [],
          aulas: [],
          ids: []
        });
      }

      const grupoAtual = grupos.get(chave);
      grupoAtual.alunos.push(obterNomeAlunoDaAula(aula));
      grupoAtual.aulas.push(aula);
      grupoAtual.ids.push(aula.id);
    } else {
      individuais.push({
        tipo: "individual",
        aula
      });
    }
  });

  const coletivas = Array.from(grupos.values()).map((grupo) => {
    grupo.alunos = grupo.alunos.sort((a, b) => a.localeCompare(b, "pt-BR"));
    return grupo;
  });

  const todos = [
    ...individuais,
    ...coletivas
  ];

  todos.sort((a, b) => {
    const dataA = a.tipo === "individual" ? a.aula.data_aula : a.data_aula;
    const dataB = b.tipo === "individual" ? b.aula.data_aula : b.data_aula;

    if (String(dataA) !== String(dataB)) {
      return String(dataB).localeCompare(String(dataA));
    }

    const idA = a.tipo === "individual"
      ? Number(a.aula.id || 0)
      : Math.max(...(a.ids || [0]).map((id) => Number(id || 0)));

    const idB = b.tipo === "individual"
      ? Number(b.aula.id || 0)
      : Math.max(...(b.ids || [0]).map((id) => Number(id || 0)));

    return idB - idA;
  });

  return todos;
}

function renderAulaIndividual(aula) {
  const dataBR = formatarDataBR(aula.data_aula);
  const aluno = obterNomeAlunoDaAula(aula);
  const curso = obterCursoDaAula(aula);
  const modulo = obterModuloDaAula(aula);
  const status = aula.status || "-";
  const parte = textoParte(aula.parte);
  const conteudo = aula.conteudo?.trim() || "Sem conteúdo informado";
  const licao = aula.licao_casa?.trim() || "Sem lição";
  const duracao = formatarMinutosDeSegundos(aula.duracao_segundos);
  const computavel = aulaComputavelFinanceiro(aula);

  return `
    <div style="padding:10px 0; border-bottom:1px solid #e6dfcf;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
        <div>
          <div style="font-weight:700;">
            ${escaparHtml(dataBR)}
            <span style="font-weight:400;"> — Aula individual</span>
          </div>

          <div style="font-weight:700; margin-top:4px;">
            • ${escaparHtml(aluno)}
          </div>
        </div>

        <button
          type="button"
          class="btn-secundario btn-excluir-aula-professor"
          data-excluir-aula-id="${aula.id}"
          style="padding:7px 10px; font-size:12px; border-color:#ffcdd2; color:#b71c1c; background:#fff5f5;"
        >
          Excluir aula
        </button>
      </div>

      <div style="font-size:13px; margin-top:4px;">
        ${escaparHtml(status)} | ${escaparHtml(parte)} | ${escaparHtml(curso)} | ${escaparHtml(modulo)}
      </div>

      <div style="font-size:13px; margin-top:4px;">
        Conteúdo: ${escaparHtml(conteudo)}
      </div>

      <div style="font-size:12px; opacity:0.8; margin-top:4px;">
        Lição: ${escaparHtml(licao)} | Duração: ${escaparHtml(duracao)} | 
        ${computavel ? "Computável" : "Não computável"}
      </div>
    </div>
  `;
}

function renderAulaColetiva(grupo) {
  const dataBR = formatarDataBR(grupo.data_aula);
  const status = grupo.status || "-";
  const parte = textoParte(grupo.parte);
  const conteudo = grupo.conteudo?.trim() || "Sem conteúdo informado";
  const licao = grupo.licao_casa?.trim() || "Sem lição";
  const duracao = formatarMinutosDeSegundos(grupo.duracao_segundos);
  const quantidade = grupo.alunos.length || grupo.quantidade_alunos || 0;

  return `
    <div style="padding:10px 0; border-bottom:1px solid #e6dfcf;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
        <div>
          <div style="font-weight:700;">
            ${escaparHtml(dataBR)}
            <span style="font-weight:400;"> — Aula coletiva</span>
          </div>

          <div style="font-size:12px; opacity:0.75; margin-top:3px;">
            Excluir aqui apaga esta aula coletiva para todos os alunos listados abaixo.
          </div>
        </div>

        <button
          type="button"
          class="btn-secundario btn-excluir-aula-professor"
          data-excluir-grupo-aula-id="${escaparHtml(grupo.grupoAulaId)}"
          style="padding:7px 10px; font-size:12px; border-color:#ffcdd2; color:#b71c1c; background:#fff5f5;"
        >
          Excluir aula coletiva
        </button>
      </div>

      <div style="margin-top:4px;">
        ${grupo.alunos.map((nome) => `
          <div style="font-weight:700;">• ${escaparHtml(nome)}</div>
        `).join("")}
      </div>

      <div style="font-size:13px; margin-top:4px;">
        ${escaparHtml(status)} | ${escaparHtml(parte)} | ${quantidade} aluno(s) | ${escaparHtml(grupo.curso)} | ${escaparHtml(grupo.modulo)}
      </div>

      <div style="font-size:13px; margin-top:4px;">
        Conteúdo: ${escaparHtml(conteudo)}
      </div>

      <div style="font-size:12px; opacity:0.8; margin-top:4px;">
        Lição: ${escaparHtml(licao)} | Duração: ${escaparHtml(duracao)}
      </div>
    </div>
  `;
}

function renderAulasProfessor() {
  if (!listaAulasProfessor) return;

  const aulasFiltradas = obterAulasFiltradas();

  if (!aulasFiltradas.length) {
    listaAulasProfessor.innerHTML = `
      <p style="font-size:13px; opacity:0.85;">
        Nenhuma aula encontrada para este professor no mês atual.
      </p>
    `;

    if (boxExpandirAulasProfessor) {
      boxExpandirAulasProfessor.style.display = "none";
    }

    return;
  }

  const agrupadas = agruparAulasColetivas(aulasFiltradas);
  const limite = aulasExpandido ? agrupadas.length : 3;
  const visiveis = agrupadas.slice(0, limite);

  listaAulasProfessor.innerHTML = visiveis.map((item) => {
    if (item.tipo === "coletiva") {
      return renderAulaColetiva(item);
    }

    return renderAulaIndividual(item.aula);
  }).join("");

  if (boxExpandirAulasProfessor && btnExpandirAulasProfessor) {
    if (agrupadas.length <= 3) {
      boxExpandirAulasProfessor.style.display = "none";
    } else {
      boxExpandirAulasProfessor.style.display = "block";
      btnExpandirAulasProfessor.textContent = aulasExpandido
        ? "Ver menos aulas"
        : "Ver mais aulas";
    }
  }
}

// =====================================================
// 10. RENDERIZAÇÃO — OCORRÊNCIAS
// =====================================================

function renderOcorrenciasProfessor() {
  if (!listaOcorrenciasProfessor) return;

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

  const limite = ocorrenciasExpandido ? ocorrenciasProfessor.length : 3;
  const visiveis = ocorrenciasProfessor.slice(0, limite);

  listaOcorrenciasProfessor.innerHTML = visiveis.map((oc) => {
    const data = formatarDataBR(oc.data_ocorrencia || oc.data || oc.created_at?.slice(0, 10));
    const tipo = oc.tipo || oc.tipo_ocorrencia || "Ocorrência";
    const gravidade = oc.gravidade || "Observação";
    const motivo = oc.motivo || "";
    const providencia = oc.providencia || "";
    const descricao = oc.descricao || oc.observacao || "";

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
            ? `<div style="font-size:13px; margin-top:5px;">
                <b>Motivo:</b> ${escaparHtml(motivo)}
              </div>`
            : ""
        }

        ${
          providencia
            ? `<div style="font-size:13px; margin-top:5px;">
                <b>Providência:</b> ${escaparHtml(providencia)}
              </div>`
            : ""
        }

        ${
          descricao
            ? `<div style="font-size:12px; opacity:0.85; margin-top:5px;">
                ${escaparHtml(descricao)}
              </div>`
            : ""
        }
      </div>
    `;
  }).join("");

  if (boxExpandirOcorrenciasProfessor && btnExpandirOcorrenciasProfessor) {
    if (ocorrenciasProfessor.length <= 3) {
      boxExpandirOcorrenciasProfessor.style.display = "none";
    } else {
      boxExpandirOcorrenciasProfessor.style.display = "block";
      btnExpandirOcorrenciasProfessor.textContent = ocorrenciasExpandido
        ? "Ver menos ocorrências"
        : "Ver mais ocorrências";
    }
  }
}

// =====================================================
// 11. EXCLUSÃO DE AULAS
// =====================================================

async function limparReposicoesAgendadasDasAulas(aulaIds) {
  const idsValidos = (aulaIds || [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (!idsValidos.length) return;

  const { error } = await supabase
    .from("reposicao_agendada")
    .delete()
    .in("aula_id", idsValidos);

  if (error) {
    console.warn(
      "Não foi possível limpar registros de reposição_agendada antes de excluir a aula. A exclusão da aula ainda será tentada.",
      error
    );
  }
}

async function excluirAulaIndividual(aulaId, botao = null) {
  const id = Number(aulaId);

  if (!id) {
    mostrarMensagem("Aula não encontrada para exclusão.", false);
    return;
  }

  const aula = aulasProfessor.find((item) => Number(item.id) === id);

  const aluno = aula ? obterNomeAlunoDaAula(aula) : "este aluno";
  const data = aula ? formatarDataBR(aula.data_aula) : "data não informada";

  const confirmou = confirm(
    `Deseja excluir esta aula?\n\nAluno: ${aluno}\nData: ${data}\n\nEssa ação não pode ser desfeita.`
  );

  if (!confirmou) return;

  if (botao) {
    botao.disabled = true;
    botao.textContent = "Excluindo...";
  }

  await limparReposicoesAgendadasDasAulas([id]);

  const { error } = await supabase
    .from("aula")
    .delete()
    .eq("professor_id", professorId)
    .eq("id", id);

  if (botao) {
    botao.disabled = false;
    botao.textContent = "Excluir aula";
  }

  if (error) {
    console.error("Erro ao excluir aula:", error);
    mostrarMensagem(
      "Não foi possível excluir a aula. Se ela estiver vinculada a outra reposição, exclua primeiro o vínculo relacionado.",
      false
    );
    return;
  }

  mostrarMensagem("Aula excluída com sucesso.");

  await carregarAulasProfessor();
  renderIndicadores();
  renderAulasProfessor();
}

async function excluirAulaColetiva(grupoAulaId, botao = null) {
  const grupoId = String(grupoAulaId || "").trim();

  if (!grupoId) {
    mostrarMensagem("Grupo da aula coletiva não encontrado para exclusão.", false);
    return;
  }

  const aulasDoGrupo = aulasProfessor.filter((aula) => {
    return aula.aula_coletiva === true && String(aula.grupo_aula_id || "") === grupoId;
  });

  if (!aulasDoGrupo.length) {
    mostrarMensagem("Nenhuma aula encontrada neste grupo coletivo.", false);
    return;
  }

  const ids = aulasDoGrupo
    .map((aula) => Number(aula.id))
    .filter((id) => Number.isFinite(id) && id > 0);

  const nomesAlunos = aulasDoGrupo
    .map(obterNomeAlunoDaAula)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  const data = formatarDataBR(aulasDoGrupo[0]?.data_aula);

  const confirmou = confirm(
    `Deseja excluir esta aula coletiva?\n\nData: ${data}\nAlunos:\n- ${nomesAlunos.join("\n- ")}\n\nEssa ação apaga a aula para todos os alunos acima e não pode ser desfeita.`
  );

  if (!confirmou) return;

  if (botao) {
    botao.disabled = true;
    botao.textContent = "Excluindo...";
  }

  await limparReposicoesAgendadasDasAulas(ids);

  const { error } = await supabase
    .from("aula")
    .delete()
    .eq("professor_id", professorId)
    .in("id", ids);

  if (botao) {
    botao.disabled = false;
    botao.textContent = "Excluir aula coletiva";
  }

  if (error) {
    console.error("Erro ao excluir aula coletiva:", error);
    mostrarMensagem(
      "Não foi possível excluir a aula coletiva. Se alguma aula estiver vinculada a uma reposição, exclua primeiro o vínculo relacionado.",
      false
    );
    return;
  }

  mostrarMensagem("Aula coletiva excluída com sucesso para todos os alunos do grupo.");

  await carregarAulasProfessor();
  renderIndicadores();
  renderAulasProfessor();
}

// =====================================================
// 12. OCORRÊNCIA — FORM
// =====================================================

function prepararFormOcorrencia() {
  if (ocorrenciaData) {
    ocorrenciaData.value = hojeISO();
  }
}

function abrirFormOcorrencia() {
  if (!formOcorrenciaProfessor) return;

  formOcorrenciaProfessor.style.display = "block";
  prepararFormOcorrencia();

  formOcorrenciaProfessor.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function fecharFormOcorrencia() {
  if (!formOcorrenciaProfessor) return;

  formOcorrenciaProfessor.reset();
  formOcorrenciaProfessor.style.display = "none";
  prepararFormOcorrencia();
}

async function salvarOcorrencia(e) {
  e.preventDefault();

  const dataOcorrencia = ocorrenciaData?.value;
  const tipo = ocorrenciaTipo?.value;
  const gravidade = ocorrenciaGravidade?.value;
  const motivo = ocorrenciaMotivo?.value?.trim();
  const providencia = ocorrenciaProvidencia?.value?.trim();
  const descricao = ocorrenciaDescricao?.value?.trim();

  if (!dataOcorrencia || !tipo || !gravidade || !motivo || !providencia || !descricao) {
    mostrarMensagem("Preencha todos os campos da ocorrência.", false);
    return;
  }

  if (btnSalvarOcorrencia) {
    btnSalvarOcorrencia.disabled = true;
    btnSalvarOcorrencia.textContent = "Salvando...";
  }

  const payload = {
    professor_id: professorId,
    data_ocorrencia: dataOcorrencia,
    tipo,
    gravidade,
    motivo,
    providencia,
    descricao
  };

  const { error } = await supabase
    .from("professor_ocorrencia")
    .insert(payload);

  if (btnSalvarOcorrencia) {
    btnSalvarOcorrencia.disabled = false;
    btnSalvarOcorrencia.textContent = "Salvar ocorrência";
  }

  if (error) {
    console.error("Erro ao salvar ocorrência:", error);
    mostrarMensagem(
      "Erro ao salvar ocorrência. Confira se a tabela professor_ocorrencia tem as colunas: professor_id, data_ocorrencia, tipo, gravidade, motivo, providencia e descricao.",
      false
    );
    return;
  }

  mostrarMensagem("Ocorrência salva com sucesso!");

  fecharFormOcorrencia();

  await carregarOcorrenciasProfessor();
  renderOcorrenciasProfessor();
}

// =====================================================
// 13. INIT
// =====================================================

async function init() {
  if (subtituloProfessor) {
    subtituloProfessor.textContent = "Carregando informações...";
  }

  prepararFormOcorrencia();

  await carregarProfessor();

  if (!professorAtual) return;

  await carregarCursosProfessor();
  await carregarMatriculasProfessor();
  await carregarAulasProfessor();
  await carregarOcorrenciasProfessor();

  renderProfessor();
  renderIndicadores();
  renderCursosProfessor();
  renderAlunosProfessor();
  renderAulasProfessor();
  renderOcorrenciasProfessor();

  if (subtituloProfessor && professorAtual) {
    const cursos = cursosProfessor
      .map((c) => c.materia?.nome)
      .filter(Boolean);

    subtituloProfessor.textContent = cursos.length
      ? `Professor(a) de ${cursos.join(", ")}`
      : "Professor(a) sem curso vinculado.";
  }
}

// =====================================================
// 14. EVENTOS DA INTERFACE
// =====================================================

listaAulasProfessor?.addEventListener("click", async (event) => {
  const botao = event.target.closest("[data-excluir-aula-id], [data-excluir-grupo-aula-id]");

  if (!botao) return;

  const aulaId = botao.dataset.excluirAulaId;
  const grupoAulaId = botao.dataset.excluirGrupoAulaId;

  if (grupoAulaId) {
    await excluirAulaColetiva(grupoAulaId, botao);
    return;
  }

  if (aulaId) {
    await excluirAulaIndividual(aulaId, botao);
  }
});

btnExpandirAlunosProfessor?.addEventListener("click", () => {
  alunosExpandido = !alunosExpandido;
  renderAlunosProfessor();
});

filtroStatusAulaProfessor?.addEventListener("change", () => {
  aulasExpandido = false;
  renderAulasProfessor();
});

btnExpandirAulasProfessor?.addEventListener("click", () => {
  aulasExpandido = !aulasExpandido;
  renderAulasProfessor();
});

btnMostrarFormOcorrencia?.addEventListener("click", () => {
  abrirFormOcorrencia();
});

btnCancelarOcorrencia?.addEventListener("click", () => {
  fecharFormOcorrencia();
});

formOcorrenciaProfessor?.addEventListener("submit", salvarOcorrencia);

btnExpandirOcorrenciasProfessor?.addEventListener("click", () => {
  ocorrenciasExpandido = !ocorrenciasExpandido;
  renderOcorrenciasProfessor();
});

init();