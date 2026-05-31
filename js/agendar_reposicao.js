import { supabase } from "./supabase.js";
import { exigirAluno } from "./guard.js";

await exigirAluno();

const listaReposicoes = document.getElementById("listaReposicoes");
const msg = document.getElementById("msg");
const faltasAluno = document.getElementById("faltasAluno");
const textoSelecao = document.getElementById("textoSelecao");
const alertaCobrancaReposicao = document.getElementById("alertaCobrancaReposicao");

const blocoCursoReposicao = document.getElementById("blocoCursoReposicao");
const textoCursoReposicao = document.getElementById("textoCursoReposicao");
const labelSelectMatriculaReposicao = document.getElementById("labelSelectMatriculaReposicao");
const selectMatriculaReposicao = document.getElementById("selectMatriculaReposicao");

let alunoAtual = null;
let matriculasAtivas = [];
let matriculaSelecionada = null;
let aulasPendentes = [];
let aulaSelecionadaId = null;

// =============================
// WhatsApp da escola
// =============================
const TELEFONE_ESCOLA = "5511956177084";
const MENSAGEM_CANCELAMENTO = "Olá! Gostaria de cancelar uma reposição agendada.";

function gerarLinkWhatsApp() {
  return `https://wa.me/${TELEFONE_ESCOLA}?text=${encodeURIComponent(MENSAGEM_CANCELAMENTO)}`;
}

// =============================
// Mensagem
// =============================
function mostrarMensagem(texto, erro = false) {
  if (!msg) return;

  msg.textContent = texto;
  msg.className = erro ? "msg-erro" : "msg-sucesso";
  msg.style.display = "block";

  setTimeout(() => {
    msg.textContent = "";
    msg.className = "";
    msg.style.display = "none";
  }, 4000);
}

// =============================
// Utilitários gerais
// =============================
function formatarDataBR(dataISO) {
  if (!dataISO) return "";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarHora(hora) {
  if (!hora) return "";
  return String(hora).slice(0, 5);
}

function textoStatusBonito(status) {
  if (!status) return "Aula";

  const s = status.trim().toLowerCase();

  if (s === "ausente") return "Ausente";
  if (s === "cancelada") return "Cancelada";
  if (s === "trancada") return "Trancada";

  return status;
}

function textoJustificativa(justificativa) {
  if (!justificativa || !justificativa.trim()) {
    return "Sem justificativa informada.";
  }

  return justificativa.trim();
}

function montarNomeCurso(matricula) {
  const materia = matricula?.materia?.nome || "Curso";
  const modulo = matricula?.modulo?.nome || "Módulo não informado";
  return `${materia} — ${modulo}`;
}

function salvarMatriculaSelecionada(matricula) {
  if (!matricula?.id) return;

  localStorage.setItem("matriculaSelecionadaId", String(matricula.id));
  localStorage.setItem("materiaSelecionadaId", String(matricula.materia_id || ""));
  localStorage.setItem("moduloSelecionadoId", String(matricula.modulo_id || ""));
  localStorage.setItem("professorSelecionadoId", String(matricula.professor_id || ""));
  localStorage.setItem("nomeCursoSelecionado", montarNomeCurso(matricula));
}

function obterAlunoIdLogado() {
  return (
    localStorage.getItem("alunoId") ||
    localStorage.getItem("aluno_id") ||
    localStorage.getItem("idAluno") ||
    sessionStorage.getItem("alunoId") ||
    sessionStorage.getItem("aluno_id") ||
    sessionStorage.getItem("idAluno")
  );
}

// =============================
// Datas locais
// =============================
function criarDataLocal(dataISO, hora = 0, minuto = 0, segundo = 0) {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  return new Date(ano, mes - 1, dia, hora, minuto, segundo);
}

function hojeISO() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// =============================
// Regra do prazo
// Até 21h do dia anterior
// =============================
function obterPrazoLimiteAgendamento(dataReposicao) {
  const limite = criarDataLocal(dataReposicao, 21, 0, 0);
  limite.setDate(limite.getDate() - 1);
  return limite;
}

function podeAgendarHorario(dataReposicao) {
  const agora = new Date();
  const limite = obterPrazoLimiteAgendamento(dataReposicao);
  return agora <= limite;
}

function formatarPrazoLimite(dataReposicao) {
  const limite = obterPrazoLimiteAgendamento(dataReposicao);

  const dia = String(limite.getDate()).padStart(2, "0");
  const mes = String(limite.getMonth() + 1).padStart(2, "0");
  const ano = limite.getFullYear();
  const hora = String(limite.getHours()).padStart(2, "0");
  const minuto = String(limite.getMinutes()).padStart(2, "0");

  return `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
}

// =============================
// Regra cobrança
// Ausente + mês diferente = cobra
// Cancelada e Trancada = nunca cobra
// =============================
function extrairAnoMes(dataISO) {
  const [ano, mes] = dataISO.split("-");
  return { ano: Number(ano), mes: Number(mes) };
}

function reposicaoGeraCobranca(statusAula, dataAulaFaltada, dataReposicao) {
  if (!statusAula || !dataAulaFaltada || !dataReposicao) return false;

  const statusNormalizado = statusAula.trim().toLowerCase();

  if (statusNormalizado === "cancelada") return false;
  if (statusNormalizado === "trancada") return false;

  if (statusNormalizado !== "ausente") return false;

  const aula = extrairAnoMes(dataAulaFaltada);
  const reposicao = extrairAnoMes(dataReposicao);

  return aula.ano !== reposicao.ano || aula.mes !== reposicao.mes;
}

function montarMotivoCusto(aulaSelecionada, dataReposicao) {
  const geraCobranca = reposicaoGeraCobranca(
    aulaSelecionada.status,
    aulaSelecionada.data_aula,
    dataReposicao
  );

  if (!geraCobranca) return null;

  return "Reposição de aula ausente sem gravação agendada em mês diferente da aula original.";
}

function atualizarAlertaCobranca() {
  if (!alertaCobrancaReposicao) return;

  if (!aulaSelecionadaId) {
    alertaCobrancaReposicao.style.display = "none";
    alertaCobrancaReposicao.innerHTML = "";
    return;
  }

  const aulaSelecionada = aulasPendentes.find(
    (a) => Number(a.id) === Number(aulaSelecionadaId)
  );

  if (!aulaSelecionada) {
    alertaCobrancaReposicao.style.display = "none";
    alertaCobrancaReposicao.innerHTML = "";
    return;
  }

  const dataDaFalta = formatarDataBR(aulaSelecionada.data_aula);
  const statusNormalizado = (aulaSelecionada.status || "").trim().toLowerCase();

  alertaCobrancaReposicao.style.display = "block";

  if (statusNormalizado === "cancelada") {
    alertaCobrancaReposicao.innerHTML = `
      <div style="padding:12px; border-radius:10px; background:#ecfdf3; border:1px solid #12b76a;">
        <p style="margin:0;">
          <strong>Aula selecionada:</strong> cancelada em <strong>${dataDaFalta}</strong>.
          Reposições de aulas canceladas <strong>não geram cobrança</strong>.
        </p>
      </div>
    `;
    return;
  }

  if (statusNormalizado === "trancada") {
    alertaCobrancaReposicao.innerHTML = `
      <div style="padding:12px; border-radius:10px; background:#ecfdf3; border:1px solid #12b76a;">
        <p style="margin:0;">
          <strong>Aula selecionada:</strong> trancada em <strong>${dataDaFalta}</strong>.
          Reposições de aulas trancadas <strong>não geram cobrança</strong>.
        </p>
      </div>
    `;
    return;
  }

  alertaCobrancaReposicao.innerHTML = `
    <div style="padding:12px; border-radius:10px; background:rgba(255,245,204,0.88); border:1px solid #f1bc32;">
      <p style="margin:0;">
        <strong>Aula selecionada:</strong> ausência sem gravação em <strong>${dataDaFalta}</strong>.
        Se o horário escolhido for em <strong>mês diferente</strong> da aula faltada,
        será gerada cobrança de <strong>R$ 25,00</strong>.
      </p>
    </div>
  `;
}

// =============================
// Curso selecionado
// =============================
function definirMatriculaSelecionadaInicial() {
  if (!matriculasAtivas.length) {
    matriculaSelecionada = null;
    return;
  }

  const idSalvo = localStorage.getItem("matriculaSelecionadaId");
  const materiaSalva = localStorage.getItem("materiaSelecionadaId");

  const porMatricula = matriculasAtivas.find(
    (m) => String(m.id) === String(idSalvo)
  );

  if (porMatricula) {
    matriculaSelecionada = porMatricula;
    salvarMatriculaSelecionada(matriculaSelecionada);
    return;
  }

  const porMateria = matriculasAtivas.find(
    (m) => String(m.materia_id) === String(materiaSalva)
  );

  if (porMateria) {
    matriculaSelecionada = porMateria;
    salvarMatriculaSelecionada(matriculaSelecionada);
    return;
  }

  matriculaSelecionada = matriculasAtivas[0];
  salvarMatriculaSelecionada(matriculaSelecionada);
}

function preencherSelectMatriculas() {
  if (
    !blocoCursoReposicao ||
    !textoCursoReposicao ||
    !labelSelectMatriculaReposicao ||
    !selectMatriculaReposicao
  ) {
    return;
  }

  blocoCursoReposicao.style.display = "block";
  selectMatriculaReposicao.innerHTML = "";

  matriculasAtivas.forEach((matricula) => {
    const option = document.createElement("option");
    option.value = String(matricula.id);
    option.textContent = montarNomeCurso(matricula);
    selectMatriculaReposicao.appendChild(option);
  });

  if (matriculasAtivas.length > 1) {
    labelSelectMatriculaReposicao.style.display = "block";
  } else {
    labelSelectMatriculaReposicao.style.display = "none";
  }

  if (matriculaSelecionada?.id) {
    selectMatriculaReposicao.value = String(matriculaSelecionada.id);

    const nomeProfessor = matriculaSelecionada?.professor?.nome
      ? ` Professor regular: ${matriculaSelecionada.professor.nome}.`
      : "";

    textoCursoReposicao.textContent =
      `Você está visualizando as reposições do curso ${montarNomeCurso(matriculaSelecionada)}.${nomeProfessor}`;
  } else {
    textoCursoReposicao.textContent = "Nenhum curso ativo encontrado.";
  }
}

// =============================
// Buscar aluno logado
// =============================
async function buscarAluno() {
  const alunoId = obterAlunoIdLogado();

  if (!alunoId) {
    mostrarMensagem("Erro ao identificar o aluno.", true);
    return null;
  }

  const { data: aluno, error: errAluno } = await supabase
    .from("aluno")
    .select("id, nome")
    .eq("id", alunoId)
    .maybeSingle();

  if (errAluno || !aluno) {
    console.error("Aluno não encontrado:", errAluno);
    mostrarMensagem("Aluno não encontrado.", true);
    return null;
  }

  return {
    id: aluno.id,
    nome: aluno.nome
  };
}

// =============================
// Buscar matrículas ativas
// =============================
async function buscarMatriculasAtivas(alunoId) {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno_id,
      materia_id,
      modulo_id,
      professor_id,
      ativa,
      materia:materia_id (
        id,
        nome
      ),
      modulo:modulo_id (
        id,
        nome,
        ordem,
        materia_id
      ),
      professor:professor_id (
        id,
        nome
      )
    `)
    .eq("aluno_id", alunoId)
    .eq("ativa", true)
    .order("id", { ascending: true });

  if (error) {
    console.error("Erro ao carregar matrículas ativas:", error);
    throw error;
  }

  return data || [];
}

// =============================
// Buscar aulas pendentes
// =============================
async function buscarAulasPendentes(matriculaId) {
  const { data: aulasBase, error: errorAulas } = await supabase
    .from("aula")
    .select("id, data_aula, status, justificativa, aula_gravada, precisa_reposicao")
    .eq("matricula_id", matriculaId)
    .in("status", [
      "Ausente",
      "Cancelada",
      "Trancada",
      "ausente",
      "cancelada",
      "trancada"
    ])
    .eq("precisa_reposicao", true)
    .order("data_aula", { ascending: true })
    .order("id", { ascending: true });

  if (errorAulas) {
    console.error("Erro ao buscar aulas pendentes:", errorAulas);
    throw errorAulas;
  }

  const { data: reposicoesRegistradas, error: errorReposicoesRegistradas } = await supabase
    .from("aula")
    .select("aula_original_id")
    .eq("matricula_id", matriculaId)
    .eq("status", "Reposição")
    .not("aula_original_id", "is", null);

  if (errorReposicoesRegistradas) {
    console.error("Erro ao buscar aulas já repostas:", errorReposicoesRegistradas);
    throw errorReposicoesRegistradas;
  }

  const idsJaRepostos = new Set(
    (reposicoesRegistradas || []).map((item) => Number(item.aula_original_id))
  );

  return (aulasBase || []).filter((aula) => {
    const statusNormalizado = String(aula.status || "").trim().toLowerCase();

    const elegivelPorStatus =
      statusNormalizado === "cancelada" ||
      statusNormalizado === "trancada" ||
      (statusNormalizado === "ausente" && aula.aula_gravada === false);

    if (!elegivelPorStatus) return false;
    if (idsJaRepostos.has(Number(aula.id))) return false;

    return true;
  });
}

// =============================
// Buscar reposições ativas da matrícula
// =============================
async function buscarReposicoesAtivasDaMatricula(matriculaId) {
  const { data: agendamentos, error } = await supabase
    .from("reposicao_agendada")
    .select(`
      id,
      aula_id,
      horario_reposicao_id,
      cancelado,
      matricula_id
    `)
    .eq("matricula_id", matriculaId)
    .eq("cancelado", false);

  if (error) {
    console.error("Erro ao buscar reposições ativas:", error);
    throw error;
  }

  const lista = agendamentos || [];

  if (!lista.length) return [];

  const horariosIds = lista
    .map((item) => item.horario_reposicao_id)
    .filter(Boolean);

  if (!horariosIds.length) return lista;

  const { data: horarios, error: errorHorarios } = await supabase
    .from("horarios_reposicao")
    .select("id, data, hora_inicio, hora_fim")
    .in("id", horariosIds);

  if (errorHorarios) {
    console.error("Erro ao buscar horários das reposições ativas:", errorHorarios);
    throw errorHorarios;
  }

  const mapaHorarios = new Map(
    (horarios || []).map((h) => [Number(h.id), h])
  );

  return lista.map((item) => ({
    ...item,
    horario: mapaHorarios.get(Number(item.horario_reposicao_id)) || null
  }));
}

// =============================
// Renderizar aulas pendentes
// Agora o aluno pode escolher qualquer aula pendente.
// =============================
function renderizarAulasPendentes(aulasLivres, reposicoesAtivas) {
  if (!aulasLivres.length) {
    faltasAluno.innerHTML = `<p>Você não possui reposições pendentes para este curso.</p>`;
    textoSelecao.textContent = "Você não possui aulas pendentes para repor neste curso.";
    listaReposicoes.innerHTML = "";
    aulaSelecionadaId = null;
    atualizarAlertaCobranca();
    return;
  }

  let html = `
    <div class="resumo-pendencias">
      <p><strong>Total de reposições pendentes:</strong> ${aulasLivres.length}</p>
      <p><strong>Escolha abaixo</strong> qual aula deseja repor.</p>
      ${
        reposicoesAtivas.length > 0
          ? `<p><strong>Reposições já agendadas neste curso:</strong> ${reposicoesAtivas.length}</p>`
          : ""
      }
    </div>

    <div class="lista-aulas-pendentes">
  `;

  aulasLivres.forEach((aula) => {
    const selecionada = Number(aula.id) === Number(aulaSelecionadaId);
    const status = textoStatusBonito(aula.status);
    const dataBR = formatarDataBR(aula.data_aula);
    const justificativa = textoJustificativa(aula.justificativa);
    const statusNormalizado = String(aula.status || "").trim().toLowerCase();

    let textoRegra = "";

    if (statusNormalizado === "ausente") {
      textoRegra = "Pode gerar cobrança se o horário escolhido for em mês diferente da falta.";
    } else if (statusNormalizado === "cancelada") {
      textoRegra = "Reposição sem cobrança adicional.";
    } else if (statusNormalizado === "trancada") {
      textoRegra = "Reposição sem cobrança adicional.";
    }

    html += `
      <div class="item-pendente ${selecionada ? "item-pendente-selecionado" : ""}">
        <div class="item-pendente-conteudo">
          <p><strong>${status} em ${dataBR}</strong></p>
          <p class="justificativa-aula">${justificativa}</p>
          <p style="margin-top:8px; font-size:13px; opacity:0.85;">
            ${textoRegra}
          </p>
        </div>

        <button
          type="button"
          class="btn btnSelecionarAula"
          data-aula-id="${aula.id}"
        >
          ${selecionada ? "Selecionada" : "Escolher esta aula"}
        </button>
      </div>
    `;
  });

  html += `</div>`;

  if (reposicoesAtivas.length > 0) {
    html += `
      <div class="agendamentos-ativos">
        <p><strong>Reposições já marcadas neste curso:</strong></p>
        <ul>
    `;

    reposicoesAtivas.forEach((item) => {
      const h = item.horario;
      if (!h) return;

      html += `
        <li>
          ${formatarDataBR(h.data)} - ${formatarHora(h.hora_inicio)} às ${formatarHora(h.hora_fim)}
        </li>
      `;
    });

    html += `
        </ul>

        <div class="aviso-cancelamento-reposicao" style="margin-top: 12px; padding: 12px; border-radius: 10px; background: rgba(255, 245, 204, 0.85); border: 1px solid #f1bc32;">
          <p style="margin: 0 0 10px 0;">
            Para cancelar uma reposição agendada, entre em contato com a escola.
          </p>

          <a
            href="${gerarLinkWhatsApp()}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn"
            style="display: inline-block; text-decoration: none;"
          >
            WhatsApp da escola
          </a>
        </div>
      </div>
    `;
  }

  faltasAluno.innerHTML = html;
  atualizarAlertaCobranca();

  document.querySelectorAll(".btnSelecionarAula").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const aulaId = Number(btn.dataset.aulaId);
      aulaSelecionadaId = aulaId;

      const aulaEscolhida = aulasLivres.find(
        (a) => Number(a.id) === Number(aulaSelecionadaId)
      );

      if (aulaEscolhida) {
        const status = textoStatusBonito(aulaEscolhida.status);
        const dataBR = formatarDataBR(aulaEscolhida.data_aula);
        textoSelecao.textContent = `Você está escolhendo um horário para: ${status} em ${dataBR}.`;
      }

      renderizarAulasPendentes(aulasLivres, reposicoesAtivas);
      await carregarHorariosDisponiveis();
    });
  });
}

// =============================
// Carregar pendências
// Não seleciona automaticamente nenhuma aula.
// =============================
async function carregarPendencias() {
  const aulas = await buscarAulasPendentes(matriculaSelecionada.id);
  const reposicoesAtivas = await buscarReposicoesAtivasDaMatricula(matriculaSelecionada.id);

  const aulasJaAgendadasIds = new Set(
    reposicoesAtivas
      .filter((item) => item.aula_id !== null)
      .map((item) => Number(item.aula_id))
  );

  aulasPendentes = aulas.filter((aula) => !aulasJaAgendadasIds.has(Number(aula.id)));

  aulaSelecionadaId = null;

  if (aulasPendentes.length > 0) {
    textoSelecao.textContent = "Selecione uma aula pendente acima para visualizar os horários disponíveis.";
  } else {
    textoSelecao.textContent = "Você não possui aulas pendentes para repor neste curso.";
  }

  renderizarAulasPendentes(aulasPendentes, reposicoesAtivas);
}

// =============================
// Buscar horários livres
// Busca por curso/matéria, não por professor regular.
// Assim qualquer professor que dê o mesmo curso pode aparecer.
// Mantém regra das 21h.
// =============================
async function buscarHorariosLivres() {
  const hoje = hojeISO();

  if (!matriculaSelecionada?.materia_id) {
    console.warn("Matrícula selecionada sem materia_id:", matriculaSelecionada);
    return [];
  }

  const { data: horarios, error } = await supabase
    .from("horarios_reposicao")
    .select("id, data, hora_inicio, hora_fim, disponivel, professor_id, materia_id")
    .eq("materia_id", matriculaSelecionada.materia_id)
    .gte("data", hoje)
    .order("data", { ascending: true })
    .order("hora_inicio", { ascending: true });

  if (error) {
    console.error("Erro ao buscar horários livres:", error);
    throw error;
  }

  const listaHorarios = horarios || [];

  if (!listaHorarios.length) {
    return [];
  }

  const idsHorarios = listaHorarios.map((h) => h.id);

  const { data: agendamentos, error: errorAgendamentos } = await supabase
    .from("reposicao_agendada")
    .select("id, horario_reposicao_id, cancelado")
    .in("horario_reposicao_id", idsHorarios)
    .eq("cancelado", false);

  if (errorAgendamentos) {
    console.error("Erro ao buscar agendamentos dos horários:", errorAgendamentos);
    throw errorAgendamentos;
  }

  const horariosOcupados = new Set(
    (agendamentos || []).map((ag) => Number(ag.horario_reposicao_id))
  );

  const professorIds = [
    ...new Set(listaHorarios.map((h) => h.professor_id).filter(Boolean))
  ];

  const materiaIds = [
    ...new Set(listaHorarios.map((h) => h.materia_id).filter(Boolean))
  ];

  let mapaProfessores = new Map();
  let mapaMaterias = new Map();

  if (professorIds.length) {
    const { data: professores, error: errorProfessores } = await supabase
      .from("professor")
      .select("id, nome")
      .in("id", professorIds);

    if (errorProfessores) {
      console.error("Erro ao buscar professores:", errorProfessores);
      throw errorProfessores;
    }

    mapaProfessores = new Map(
      (professores || []).map((p) => [Number(p.id), p.nome])
    );
  }

  if (materiaIds.length) {
    const { data: materias, error: errorMaterias } = await supabase
      .from("materia")
      .select("id, nome")
      .in("id", materiaIds);

    if (errorMaterias) {
      console.error("Erro ao buscar matérias:", errorMaterias);
      throw errorMaterias;
    }

    mapaMaterias = new Map(
      (materias || []).map((m) => [Number(m.id), m.nome])
    );
  }

  const horariosLivres = listaHorarios
    .filter((horario) => {
      if (horario.disponivel === false) return false;
      if (horariosOcupados.has(Number(horario.id))) return false;
      if (!podeAgendarHorario(horario.data)) return false;
      return true;
    })
    .map((horario) => ({
      ...horario,
      professor_nome: mapaProfessores.get(Number(horario.professor_id)) || "Não informado",
      materia_nome: mapaMaterias.get(Number(horario.materia_id)) || "Não informado"
    }));

  return horariosLivres;
}

// =============================
// Renderizar horários disponíveis
// =============================
async function carregarHorariosDisponiveis() {
  if (!aulaSelecionadaId) {
    listaReposicoes.innerHTML = `
      <p>Selecione uma aula pendente para visualizar os horários disponíveis.</p>
    `;
    return;
  }

  const aulaSelecionada = aulasPendentes.find(
    (a) => Number(a.id) === Number(aulaSelecionadaId)
  );

  if (!aulaSelecionada) {
    listaReposicoes.innerHTML = `<p>Selecione uma aula pendente.</p>`;
    return;
  }

  const horariosLivres = await buscarHorariosLivres();

  if (!horariosLivres.length) {
    listaReposicoes.innerHTML = `
      <p>Nenhum horário disponível no momento para este curso.</p>
      <p style="margin-top:8px; opacity:0.8; font-size:14px;">
        Verifique se existe horário cadastrado para este curso, se ele está disponível,
        se ainda não foi agendado e se ainda está dentro do prazo de agendamento.
      </p>
    `;
    return;
  }

  listaReposicoes.innerHTML = "";

  horariosLivres.forEach((horario) => {
    const geraCobranca = reposicaoGeraCobranca(
      aulaSelecionada.status,
      aulaSelecionada.data_aula,
      horario.data
    );

    const div = document.createElement("div");
    div.className = "card card-horario";

    div.innerHTML = `
      <p><strong>Data:</strong> ${formatarDataBR(horario.data)}</p>
      <p><strong>Horário:</strong> ${formatarHora(horario.hora_inicio)} - ${formatarHora(horario.hora_fim)}</p>
      <p><strong>Professor:</strong> ${horario.professor_nome}</p>
      <p><strong>Curso:</strong> ${horario.materia_nome}</p>

      <p class="prazo-agendamento">
        <strong>Prazo para agendar:</strong> ${formatarPrazoLimite(horario.data)}
      </p>

      ${
        geraCobranca
          ? `
            <div style="margin:10px 0; padding:10px; border-radius:10px; background:#fff3cd; border:1px solid #f1bc32; font-size:14px;">
              <strong>Atenção:</strong> esta reposição gerará cobrança de <strong>R$ 25,00</strong>,
              pois o horário escolhido está em mês diferente da aula ausente.
              Aguarde o financeiro entrar em contato.
            </div>
          `
          : `
            <div style="margin:10px 0; padding:10px; border-radius:10px; background:#ecfdf3; border:1px solid #12b76a; font-size:14px;">
              <strong>Sem cobrança adicional.</strong>
            </div>
          `
      }

      <button
        type="button"
        class="btn btnEscolherHorario"
        data-horario-id="${horario.id}"
      >
        Agendar este horário
      </button>
    `;

    listaReposicoes.appendChild(div);
  });

  ativarEscolhaHorario();
}

// =============================
// Agendar horário
// =============================
function ativarEscolhaHorario() {
  document.querySelectorAll(".btnEscolherHorario").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!aulaSelecionadaId) {
        mostrarMensagem("Selecione uma aula pendente primeiro.", true);
        return;
      }

      const horarioId = Number(btn.dataset.horarioId);

      btn.disabled = true;
      btn.textContent = "Agendando...";

      try {
        const aulaEscolhida = aulasPendentes.find(
          (a) => Number(a.id) === Number(aulaSelecionadaId)
        );

        if (!aulaEscolhida) {
          mostrarMensagem("A aula selecionada não está mais disponível para reposição.", true);
          await carregarTudo();
          return;
        }

        const { data: horarioAtual, error: erroHorario } = await supabase
          .from("horarios_reposicao")
          .select("id, data, disponivel, professor_id, materia_id")
          .eq("id", horarioId)
          .maybeSingle();

        if (erroHorario || !horarioAtual) {
          throw erroHorario || new Error("Horário não encontrado.");
        }

        if (Number(horarioAtual.materia_id) !== Number(matriculaSelecionada.materia_id)) {
          mostrarMensagem("Este horário não pertence ao curso selecionado.", true);
          await carregarTudo();
          return;
        }

        if (!podeAgendarHorario(horarioAtual.data)) {
          mostrarMensagem("O prazo para agendar esta reposição já foi encerrado.", true);
          await carregarTudo();
          return;
        }

        const { data: horarioJaAgendado, error: erroHorarioJaAgendado } = await supabase
          .from("reposicao_agendada")
          .select("id")
          .eq("horario_reposicao_id", horarioId)
          .eq("cancelado", false);

        if (erroHorarioJaAgendado) {
          throw erroHorarioJaAgendado;
        }

        if (horarioAtual.disponivel === false || horarioJaAgendado.length > 0) {
          mostrarMensagem("Este horário não está mais disponível.", true);
          await carregarTudo();
          return;
        }

        const { data: aulaJaAgendada, error: erroAulaJaAgendada } = await supabase
          .from("reposicao_agendada")
          .select("id")
          .eq("aula_id", aulaSelecionadaId)
          .eq("cancelado", false);

        if (erroAulaJaAgendada) {
          throw erroAulaJaAgendada;
        }

        if (aulaJaAgendada && aulaJaAgendada.length > 0) {
          mostrarMensagem("Esta aula já possui uma reposição agendada.", true);
          await carregarTudo();
          return;
        }

        const geraCobranca = reposicaoGeraCobranca(
          aulaEscolhida.status,
          aulaEscolhida.data_aula,
          horarioAtual.data
        );

        const motivoCusto = montarMotivoCusto(aulaEscolhida, horarioAtual.data);

        const textoConfirmacao = geraCobranca
          ? "Esta reposição gerará cobrança de R$ 25,00. Deseja continuar?"
          : "Deseja agendar esta reposição?";

        const confirmar = confirm(textoConfirmacao);

        if (!confirmar) {
          btn.disabled = false;
          btn.textContent = "Agendar este horário";
          return;
        }

        const { error: erroInsert } = await supabase
          .from("reposicao_agendada")
          .insert({
            horario_reposicao_id: horarioId,
            aluno_id: alunoAtual.id,
            matricula_id: matriculaSelecionada.id,
            aula_id: aulaSelecionadaId,
            cancelado: false,
            tem_custo: geraCobranca,
            motivo_custo: motivoCusto
          });

        if (erroInsert) {
          throw erroInsert;
        }

        const { error: erroUpdate } = await supabase
          .from("horarios_reposicao")
          .update({ disponivel: false })
          .eq("id", horarioId);

        if (erroUpdate) {
          throw erroUpdate;
        }

        mostrarMensagem(
          geraCobranca
            ? "Reposição agendada com sucesso! Esta reposição gerará cobrança de R$ 25,00."
            : "Reposição agendada com sucesso!"
        );

        await carregarTudo();

      } catch (err) {
        console.error("Erro ao agendar reposição:", err);
        mostrarMensagem("Erro ao agendar reposição.", true);
      } finally {
        btn.disabled = false;
        btn.textContent = "Agendar este horário";
      }
    });
  });
}

// =============================
// Carregar tudo da matrícula
// =============================
async function carregarTudo() {
  faltasAluno.innerHTML = "Carregando pendências...";
  listaReposicoes.innerHTML = "Selecione uma aula pendente para visualizar os horários disponíveis.";

  if (alertaCobrancaReposicao) {
    alertaCobrancaReposicao.style.display = "none";
    alertaCobrancaReposicao.innerHTML = "";
  }

  try {
    if (!alunoAtual) {
      alunoAtual = await buscarAluno();
    }

    if (!alunoAtual) {
      faltasAluno.innerHTML = "Não foi possível identificar o aluno.";
      listaReposicoes.innerHTML = "";
      return;
    }

    if (!matriculasAtivas.length) {
      matriculasAtivas = await buscarMatriculasAtivas(alunoAtual.id);
      definirMatriculaSelecionadaInicial();
      preencherSelectMatriculas();
    }

    if (!matriculaSelecionada) {
      faltasAluno.innerHTML = "Nenhum curso ativo encontrado.";
      listaReposicoes.innerHTML = "";
      return;
    }

    salvarMatriculaSelecionada(matriculaSelecionada);

    await carregarPendencias();
    await carregarHorariosDisponiveis();

  } catch (error) {
    console.error("Erro geral:", error);
    faltasAluno.innerHTML = "Erro ao carregar as reposições pendentes.";
    listaReposicoes.innerHTML = "Erro ao carregar os horários disponíveis.";
    mostrarMensagem("Não foi possível carregar os dados.", true);
  }
}

// =============================
// Troca de curso
// =============================
if (selectMatriculaReposicao) {
  selectMatriculaReposicao.addEventListener("change", async () => {
    const idSelecionado = selectMatriculaReposicao.value;

    const encontrada = matriculasAtivas.find(
      (m) => String(m.id) === String(idSelecionado)
    );

    if (!encontrada) return;

    matriculaSelecionada = encontrada;
    aulaSelecionadaId = null;
    aulasPendentes = [];

    salvarMatriculaSelecionada(matriculaSelecionada);
    preencherSelectMatriculas();
    await carregarTudo();
  });
}

// =============================
// Iniciar
// =============================
carregarTudo();