import { supabase } from "./supabase.js";
import { exigirAlunoOuProfessorFuncionario } from "./guard.js";

try {
  await exigirAlunoOuProfessorFuncionario();
} catch (erro) {
  console.error("Erro ao validar acesso ao painel acadêmico:", erro);
}

/* =========================================================
   CONFIGURAÇÕES FIXAS
========================================================= */
const CONFIG = {
  WHATSAPP_NUMERO: "5511956177084",
  WHATSAPP_MENSAGEM: "Olá! Preciso de ajuda no painel acadêmico.",
  EMAIL: "contato.beehiveidiomas@gmail.com",
  TELEFONE_TEXTO: "(11) 95617-7084",
  TELEFONE_LINK: "+5511956177084"
};

/* =========================================================
   ELEMENTOS
========================================================= */
const msg = document.getElementById("msg");

const blocoCursoPainel = document.getElementById("blocoCursoPainel");
const textoCursoPainel = document.getElementById("textoCursoPainel");
const labelSelectMatriculaPainel = document.getElementById("labelSelectMatriculaPainel");
const selectMatriculaPainel = document.getElementById("selectMatriculaPainel");

const nomeAluno = document.getElementById("nomeAluno");
const statusMatricula = document.getElementById("statusMatricula");
const nomeCurso = document.getElementById("nomeCurso");
const nomeModulo = document.getElementById("nomeModulo");
const nomeProfessor = document.getElementById("nomeProfessor");
const dataInicio = document.getElementById("dataInicio");

const totalAulas = document.getElementById("totalAulas");
const totalPresencas = document.getElementById("totalPresencas");
const totalAusencias = document.getElementById("totalAusencias");
const totalCanceladas = document.getElementById("totalCanceladas");

const totalReposicoesPendentes = document.getElementById("totalReposicoesPendentes");
const totalReposicoesAgendadas = document.getElementById("totalReposicoesAgendadas");
const totalReposicoesFeitas = document.getElementById("totalReposicoesFeitas");
const totalPlantoes = document.getElementById("totalPlantoes");
const totalInstrumentais = document.getElementById("totalInstrumentais");
const totalEventos = document.getElementById("totalEventos");

const totalConvitesAceitosSemComparecimento = document.getElementById(
  "totalConvitesAceitosSemComparecimento"
);

const percentualPresenca = document.getElementById("percentualPresenca");
const barraPresenca = document.getElementById("barraPresenca");
const alertaAcademico = document.getElementById("alertaAcademico");

const mediaNotas = document.getElementById("mediaNotas");
const ultimaNota = document.getElementById("ultimaNota");

const listaReposicoesPendentes = document.getElementById("listaReposicoesPendentes");
const btnExpandirReposicoes = document.getElementById("btnExpandirReposicoes");

const listaEventosParticipados = document.getElementById("listaEventosParticipados");

const listaHistorico = document.getElementById("listaHistorico");
const btnExpandirHistorico = document.getElementById("btnExpandirHistorico");

const emailEscola = document.getElementById("emailEscola");
const telefoneEscola = document.getElementById("telefoneEscola");
const btnWhatsapp = document.getElementById("btnWhatsapp");

/* =========================================================
   ESTADO
========================================================= */
let alunoId = null;
let alunoAtual = null;
let matriculasAtivas = [];
let matriculaSelecionada = null;

let historicoCompleto = [];
let historicoExpandido = false;

let reposicoesPendentesCompletas = [];
let reposicoesExpandido = false;

/* =========================================================
   CONTATO
========================================================= */
function configurarContatoEscola() {
  if (emailEscola) {
    emailEscola.textContent = CONFIG.EMAIL;
    emailEscola.href = `mailto:${CONFIG.EMAIL}`;
  }

  if (telefoneEscola) {
    telefoneEscola.textContent = CONFIG.TELEFONE_TEXTO;
    telefoneEscola.href = `tel:${CONFIG.TELEFONE_LINK}`;
  }

  if (btnWhatsapp) {
    const mensagem = encodeURIComponent(CONFIG.WHATSAPP_MENSAGEM);
    btnWhatsapp.href = `https://wa.me/${CONFIG.WHATSAPP_NUMERO}?text=${mensagem}`;
  }
}

/* =========================================================
   MENSAGENS
========================================================= */
function mostrarMensagem(texto, tipo = "erro") {
  if (!msg) return;

  msg.textContent = texto;
  msg.className = `msg-box show ${tipo}`;
}

function limparMensagem() {
  if (!msg) return;

  msg.textContent = "";
  msg.className = "msg-box";
}

/* =========================================================
   UTILITÁRIOS
========================================================= */
function setTexto(el, valor) {
  if (!el) return;
  el.textContent = valor ?? "--";
}

function escaparHTML(valor) {
  if (valor === null || valor === undefined) return "";

  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarData(data) {
  if (!data) return "--";

  const d = new Date(`${data}T00:00:00`);

  if (Number.isNaN(d.getTime())) {
    return "--";
  }

  return d.toLocaleDateString("pt-BR");
}

function normalizarStatus(status) {
  if (!status) return "";

  return String(status)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function ehPresenca(status) {
  const s = normalizarStatus(status);
  return s === "presente" || s === "p";
}

function ehAusencia(status) {
  const s = normalizarStatus(status);
  return s === "ausente" || s === "a";
}

function ehCancelada(status) {
  const s = normalizarStatus(status);
  return s === "cancelada" || s === "cancelado" || s === "c";
}

function ehTrancada(status) {
  const s = normalizarStatus(status);
  return s === "trancada" || s === "trancamento" || s === "t";
}

function ehReposicao(status) {
  const s = normalizarStatus(status);
  return s === "reposicao";
}

function ehPlantao(status) {
  const s = normalizarStatus(status);

  return (
    s === "plantao de duvidas" ||
    s === "plantao de duvida" ||
    s === "plantao" ||
    s === "plantao duvidas"
  );
}

function ehInstrumental(status) {
  const s = normalizarStatus(status);

  return (
    s === "aula instrumental" ||
    s === "instrumental" ||
    s === "aula-instrumental"
  );
}

function ehEvento(status) {
  const s = normalizarStatus(status);
  return s === "evento";
}

function textoStatus(status) {
  const s = normalizarStatus(status);

  if (s === "p") return "Presente";
  if (s === "a") return "Ausente";
  if (s === "c") return "Cancelada";
  if (s === "t") return "Trancada";

  if (!status) return "--";

  return String(status).charAt(0).toUpperCase() + String(status).slice(1);
}

function classeStatus(status) {
  if (ehPresenca(status)) return "status-presente";
  if (ehAusencia(status)) return "status-ausente";
  if (ehCancelada(status)) return "status-cancelada";
  if (ehTrancada(status)) return "status-trancada";
  if (ehReposicao(status)) return "status-presente";
  if (ehPlantao(status)) return "status-presente";
  if (ehInstrumental(status)) return "status-presente";
  if (ehEvento(status)) return "status-presente";

  return "status-cancelada";
}

function formatarNota(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "--";
  }

  const numero = Number(valor);

  if (Number.isNaN(numero)) {
    return "--";
  }

  return numero.toFixed(1).replace(".", ",");
}

function obterAlunoId() {
  return (
    localStorage.getItem("alunoIdVisualizacao") ||
    localStorage.getItem("alunoId") ||
    localStorage.getItem("aluno_id") ||
    localStorage.getItem("idAluno")
  );
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
  localStorage.setItem("nomeCursoSelecionado", montarNomeCurso(matricula));
}

/* =========================================================
   REGRAS DE EVENTO PARA O CURSO
========================================================= */
function eventoCondizComMatricula(evento, matricula) {
  if (!evento || !matricula) return false;

  if (evento.publico_alvo === "todos") {
    return true;
  }

  if (evento.publico_alvo === "materia") {
    return Number(matricula.materia_id) === Number(evento.materia_id);
  }

  if (evento.publico_alvo === "modulo_exato") {
    return (
      Number(matricula.materia_id) === Number(evento.materia_id) &&
      Number(matricula.modulo_id) === Number(evento.modulo_id)
    );
  }

  if (evento.publico_alvo === "modulo_a_partir") {
    const mesmaMateria =
      Number(matricula.materia_id) === Number(evento.materia_id);

    const ordemAluno = matricula.modulo?.ordem ?? null;
    const ordemEvento = evento.modulo?.ordem ?? null;

    if (!mesmaMateria || ordemAluno === null || ordemEvento === null) {
      return false;
    }

    return Number(ordemAluno) >= Number(ordemEvento);
  }

  return false;
}

function eventoJaFoiProcessadoPeloAdmin(evento) {
  return Boolean(
    evento?.registrado === true ||
    evento?.participacao_registrada === true
  );
}

/* =========================================================
   LIMPAR TELA
========================================================= */
function limparCardsResumo() {
  setTexto(statusMatricula, "--");
  setTexto(nomeCurso, "--");
  setTexto(nomeModulo, "--");
  setTexto(nomeProfessor, "--");
  setTexto(dataInicio, "--");

  setTexto(totalAulas, "0");
  setTexto(totalPresencas, "0");
  setTexto(totalAusencias, "0");
  setTexto(totalCanceladas, "0");

  setTexto(totalReposicoesPendentes, "0");
  setTexto(totalReposicoesAgendadas, "0");
  setTexto(totalReposicoesFeitas, "0");
  setTexto(totalPlantoes, "0");
  setTexto(totalInstrumentais, "0");
  setTexto(totalEventos, "0");
  setTexto(totalConvitesAceitosSemComparecimento, "0");

  setTexto(percentualPresenca, "0%");

  if (barraPresenca) {
    barraPresenca.style.width = "0%";
  }

  if (alertaAcademico) {
    alertaAcademico.style.display = "none";
    alertaAcademico.textContent = "";
  }

  setTexto(mediaNotas, "--");
  setTexto(ultimaNota, "--");

  if (listaReposicoesPendentes) {
    listaReposicoesPendentes.innerHTML = `
      <div class="vazio-box">Nenhuma informação carregada.</div>
    `;
  }

  if (btnExpandirReposicoes) {
    btnExpandirReposicoes.style.display = "none";
  }

  if (listaEventosParticipados) {
    listaEventosParticipados.innerHTML = `
      <div class="vazio-box">Nenhuma informação carregada.</div>
    `;
  }

  if (listaHistorico) {
    listaHistorico.innerHTML = `
      <div class="vazio-box">Nenhuma informação carregada.</div>
    `;
  }

  if (btnExpandirHistorico) {
    btnExpandirHistorico.style.display = "none";
  }
}

/* =========================================================
   BUSCAS NO BANCO
========================================================= */
async function carregarAluno(alunoIdParam) {
  const { data, error } = await supabase
    .from("aluno")
    .select("id, nome, email")
    .eq("id", alunoIdParam)
    .single();

  if (error || !data) {
    console.error("Erro ao buscar aluno:", error);
    throw new Error("Não foi possível carregar os dados do aluno.");
  }

  setTexto(nomeAluno, data.nome || "Aluno(a)");

  return data;
}

async function carregarMatriculasAtivas(alunoIdParam) {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno_id,
      materia_id,
      modulo_id,
      professor_id,
      ativa,
      data_inicio,
      data_fim,
      link_zoom,
      link_youtube,
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
    .eq("aluno_id", alunoIdParam)
    .eq("ativa", true)
    .order("id", { ascending: true });

  if (error) {
    console.error("Erro ao buscar matrículas ativas:", error);
    throw new Error("Não foi possível carregar os cursos do aluno.");
  }

  return data || [];
}

async function carregarAulasDaMatricula(matriculaId) {
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
      precisa_reposicao,
      aula_original_id,
      evento_id
    `)
    .eq("matricula_id", matriculaId)
    .order("data_aula", { ascending: false })
    .order("parte", { ascending: false });

  if (error) {
    console.error("Erro ao buscar aulas:", error);
    throw new Error("Não foi possível carregar o histórico de aulas.");
  }

  return data || [];
}

async function carregarNotasDaMatricula(matriculaId) {
  const { data, error } = await supabase
    .from("nota")
    .select("id, data, tipo, valor, observacao")
    .eq("matricula_id", matriculaId)
    .order("data", { ascending: false });

  if (error) {
    console.error("Erro ao buscar notas:", error);
    return [];
  }

  return data || [];
}

async function carregarReposicoesDaMatricula(matriculaId) {
  const { data, error } = await supabase
    .from("reposicao_agendada")
    .select("id, aula_id, cancelado, data_agendamento, matricula_id")
    .eq("matricula_id", matriculaId)
    .eq("cancelado", false)
    .order("data_agendamento", { ascending: false });

  if (error) {
    console.error("Erro ao buscar reposições da matrícula:", error);
    return [];
  }

  return data || [];
}

/* =========================================================
   NOVA REGRA:
   CONVITES ACEITOS SEM COMPARECIMENTO
========================================================= */
async function carregarConvitesAceitosSemComparecimento(
  alunoIdParam,
  matriculaAtual
) {
  if (!alunoIdParam || !matriculaAtual) {
    return 0;
  }

  /*
    evento_confirmacao = aluno aceitou o convite.
    Isso NÃO significa que participou.
  */
  const { data: confirmacoes, error: erroConfirmacoes } = await supabase
    .from("evento_confirmacao")
    .select(`
      evento_id,
      aluno_id,
      evento:evento_id (
        id,
        titulo,
        publico_alvo,
        materia_id,
        modulo_id,
        ativo,
        registrado,
        participacao_registrada,
        data_evento,
        hora_evento,
        materia:materia_id (
          id,
          nome
        ),
        modulo:modulo_id (
          id,
          nome,
          ordem,
          materia_id
        )
      )
    `)
    .eq("aluno_id", alunoIdParam);

  if (erroConfirmacoes) {
    console.error(
      "Erro ao buscar confirmações de eventos do aluno:",
      erroConfirmacoes
    );
    return 0;
  }

  const confirmacoesValidas = (confirmacoes || []).filter((confirmacao) => {
    const evento = confirmacao.evento;

    if (!evento) return false;

    /*
      Evento cancelado não entra na conta.
    */
    if (evento.ativo === false) return false;

    /*
      Só entra depois que o admin registrou/processou o evento.
      Assim não conta evento futuro nem evento ainda pendente.
    */
    if (!eventoJaFoiProcessadoPeloAdmin(evento)) return false;

    /*
      Só entra se o evento realmente era compatível com o curso
      que o aluno está visualizando no painel.
    */
    if (!eventoCondizComMatricula(evento, matriculaAtual)) return false;

    return true;
  });

  if (!confirmacoesValidas.length) {
    return 0;
  }

  const idsEventosConfirmados = confirmacoesValidas.map((item) =>
    Number(item.evento_id)
  );

  const idsMatriculasDoAluno = matriculasAtivas.map((matricula) =>
    Number(matricula.id)
  );

  if (!idsMatriculasDoAluno.length) {
    return confirmacoesValidas.length;
  }

  /*
    Participação real = aula com status "Evento".
    Aqui buscamos em TODAS as matrículas do aluno, não só na matrícula atual,
    porque evento "todos" pode ter sido registrado em uma matrícula específica.
  */
  const { data: aulasEvento, error: erroAulasEvento } = await supabase
    .from("aula")
    .select("id, evento_id, matricula_id, status")
    .eq("status", "Evento")
    .in("evento_id", idsEventosConfirmados)
    .in("matricula_id", idsMatriculasDoAluno);

  if (erroAulasEvento) {
    console.error(
      "Erro ao buscar participações reais em eventos:",
      erroAulasEvento
    );
    return 0;
  }

  const eventosComParticipacaoReal = new Set(
    (aulasEvento || [])
      .filter((aula) => aula.evento_id !== null && aula.evento_id !== undefined)
      .map((aula) => Number(aula.evento_id))
  );

  const totalSemComparecimento = confirmacoesValidas.filter((confirmacao) => {
    const eventoId = Number(confirmacao.evento_id);
    return !eventosComParticipacaoReal.has(eventoId);
  }).length;

  return totalSemComparecimento;
}

/* =========================================================
   MATRÍCULA SELECIONADA
========================================================= */
function definirMatriculaSelecionadaInicial() {
  if (!matriculasAtivas.length) {
    matriculaSelecionada = null;
    return;
  }

  const matriculaSalvaId = localStorage.getItem("matriculaSelecionadaId");

  const encontrada = matriculasAtivas.find(
    (m) => String(m.id) === String(matriculaSalvaId)
  );

  if (encontrada) {
    matriculaSelecionada = encontrada;
    return;
  }

  matriculaSelecionada = matriculasAtivas[0];
  salvarMatriculaSelecionada(matriculaSelecionada);
}

function preencherSelectMatriculas() {
  if (
    !blocoCursoPainel ||
    !textoCursoPainel ||
    !labelSelectMatriculaPainel ||
    !selectMatriculaPainel
  ) {
    return;
  }

  blocoCursoPainel.style.display = "block";
  selectMatriculaPainel.innerHTML = "";

  matriculasAtivas.forEach((matricula) => {
    const option = document.createElement("option");
    option.value = String(matricula.id);
    option.textContent = montarNomeCurso(matricula);
    selectMatriculaPainel.appendChild(option);
  });

  labelSelectMatriculaPainel.style.display =
    matriculasAtivas.length > 1 ? "block" : "none";

  if (matriculaSelecionada?.id) {
    selectMatriculaPainel.value = String(matriculaSelecionada.id);
    textoCursoPainel.textContent =
      `Você está visualizando o painel do curso ${montarNomeCurso(matriculaSelecionada)}.`;
  } else {
    textoCursoPainel.textContent = "Nenhum curso ativo encontrado.";
  }
}

/* =========================================================
   PREENCHIMENTO DOS CARDS
========================================================= */
function preencherCabecalhoMatricula(matricula) {
  setTexto(statusMatricula, matricula.ativa ? "Ativa" : "Inativa");
  setTexto(dataInicio, formatarData(matricula.data_inicio));
  setTexto(nomeCurso, matricula?.materia?.nome || "--");
  setTexto(nomeModulo, matricula?.modulo?.nome || "--");
  setTexto(nomeProfessor, matricula?.professor?.nome || "--");
}

function preencherResumoAcademico(
  aulas,
  reposicoes,
  convitesAceitosSemComparecimento = 0
) {
  const total = aulas.length;

  const presentes = aulas.filter((aula) => ehPresenca(aula.status)).length;
  const ausentes = aulas.filter((aula) => ehAusencia(aula.status)).length;

  const canceladasOuTrancadas = aulas.filter(
    (aula) => ehCancelada(aula.status) || ehTrancada(aula.status)
  ).length;

  const reposicoesPendentes = aulas.filter(
    (aula) => aula.precisa_reposicao === true
  ).length;

  const reposicoesAgendadas = reposicoes.length;
  const reposicoesFeitas = aulas.filter((aula) => ehReposicao(aula.status)).length;
  const plantoes = aulas.filter((aula) => ehPlantao(aula.status)).length;
  const instrumentais = aulas.filter((aula) => ehInstrumental(aula.status)).length;

  /*
    Eventos participados = participação real.
    Isso vem da tabela aula com status "Evento".
  */
  const eventos = aulas.filter((aula) => ehEvento(aula.status)).length;

  setTexto(totalAulas, String(total));
  setTexto(totalPresencas, String(presentes));
  setTexto(totalAusencias, String(ausentes));
  setTexto(totalCanceladas, String(canceladasOuTrancadas));
  setTexto(totalReposicoesPendentes, String(reposicoesPendentes));
  setTexto(totalReposicoesAgendadas, String(reposicoesAgendadas));
  setTexto(totalReposicoesFeitas, String(reposicoesFeitas));
  setTexto(totalPlantoes, String(plantoes));
  setTexto(totalInstrumentais, String(instrumentais));
  setTexto(totalEventos, String(eventos));

  setTexto(
    totalConvitesAceitosSemComparecimento,
    String(convitesAceitosSemComparecimento)
  );

  const presencasConsideradas = presentes + reposicoesFeitas;

  const totalParaFrequencia = aulas.filter((aula) => {
    return (
      ehPresenca(aula.status) ||
      ehAusencia(aula.status) ||
      ehCancelada(aula.status) ||
      ehTrancada(aula.status) ||
      ehReposicao(aula.status)
    );
  }).length;

  const percentual =
    totalParaFrequencia > 0
      ? Math.round((presencasConsideradas / totalParaFrequencia) * 100)
      : 0;

  setTexto(percentualPresenca, `${percentual}%`);

  if (barraPresenca) {
    barraPresenca.style.width = `${percentual}%`;
  }

  preencherAlertaAcademico(
    reposicoesPendentes,
    reposicoesAgendadas,
    convitesAceitosSemComparecimento
  );
}

function preencherAlertaAcademico(
  qtdReposicoesPendentes,
  qtdReposicoesAgendadas,
  qtdConvitesAceitosSemComparecimento
) {
  if (!alertaAcademico) return;

  if (qtdReposicoesPendentes > 0) {
    alertaAcademico.style.display = "block";
    alertaAcademico.textContent =
      `Você possui ${qtdReposicoesPendentes} reposição(ões) pendente(s). Clique em “Agendar agora” para escolher um horário disponível.`;
    return;
  }

  if (qtdConvitesAceitosSemComparecimento > 0) {
    alertaAcademico.style.display = "block";
    alertaAcademico.textContent =
      `Você possui ${qtdConvitesAceitosSemComparecimento} convite(s) aceito(s) sem comparecimento registrado.`;
    return;
  }

  if (qtdReposicoesAgendadas > 0) {
    alertaAcademico.style.display = "block";
    alertaAcademico.textContent =
      `Você possui ${qtdReposicoesAgendadas} reposição(ões) agendada(s).`;
    return;
  }

  alertaAcademico.style.display = "block";
  alertaAcademico.textContent =
    "Nenhuma reposição pendente no momento.";
}

function preencherNotas(notas) {
  if (!notas.length) {
    setTexto(mediaNotas, "--");
    setTexto(ultimaNota, "--");
    return;
  }

  const notasValidas = notas
    .map((item) => Number(item.valor))
    .filter((valor) => !Number.isNaN(valor));

  if (!notasValidas.length) {
    setTexto(mediaNotas, "--");
    setTexto(ultimaNota, "--");
    return;
  }

  const soma = notasValidas.reduce((acc, item) => acc + item, 0);
  const media = soma / notasValidas.length;

  setTexto(mediaNotas, formatarNota(media));
  setTexto(ultimaNota, formatarNota(notasValidas[0]));
}

/* =========================================================
   REPOSIÇÕES
========================================================= */
function renderizarReposicoesPendentes(aulas) {
  if (!listaReposicoesPendentes) return;

  reposicoesPendentesCompletas = aulas.filter(
    (aula) => aula.precisa_reposicao === true
  );

  listaReposicoesPendentes.innerHTML = "";

  if (!reposicoesPendentesCompletas.length) {
    listaReposicoesPendentes.innerHTML = `
      <div class="vazio-box">
        Nenhuma reposição pendente para este curso.
      </div>
    `;

    if (btnExpandirReposicoes) {
      btnExpandirReposicoes.style.display = "none";
    }

    return;
  }

  const reposicoesParaMostrar = reposicoesExpandido
    ? reposicoesPendentesCompletas
    : reposicoesPendentesCompletas.slice(0, 3);

  reposicoesParaMostrar.forEach((aula) => {
    const item = document.createElement("div");
    item.className = "item-lista-simples";

    const dataAula = formatarData(aula.data_aula);
    const status = textoStatus(aula.status);
    const justificativa = aula.justificativa || "Motivo não informado.";

    item.innerHTML = `
      <strong>${dataAula} — ${escaparHTML(status)}</strong>
      <div>${escaparHTML(justificativa)}</div>
    `;

    listaReposicoesPendentes.appendChild(item);
  });

  if (btnExpandirReposicoes) {
    if (reposicoesPendentesCompletas.length > 3) {
      btnExpandirReposicoes.style.display = "inline-block";
      btnExpandirReposicoes.textContent = reposicoesExpandido
        ? "Recolher"
        : "Ver todas";
    } else {
      btnExpandirReposicoes.style.display = "none";
    }
  }
}

/* =========================================================
   EVENTOS PARTICIPADOS
========================================================= */
function renderizarEventosParticipados(aulas) {
  if (!listaEventosParticipados) return;

  const eventos = aulas.filter((aula) => ehEvento(aula.status));

  listaEventosParticipados.innerHTML = "";

  if (!eventos.length) {
    listaEventosParticipados.innerHTML = `
      <div class="vazio-box">
        Nenhum evento participado neste curso até o momento.
      </div>
    `;
    return;
  }

  eventos.forEach((aula) => {
    const item = document.createElement("div");
    item.className = "item-lista-simples";

    const dataAula = formatarData(aula.data_aula);
    const titulo = aula.conteudo || aula.justificativa || "Evento participado";

    item.innerHTML = `
      <strong>${dataAula}</strong>
      <div>${escaparHTML(titulo)}</div>
    `;

    listaEventosParticipados.appendChild(item);
  });
}

/* =========================================================
   HISTÓRICO
========================================================= */
function renderizarHistorico(aulas) {
  if (!listaHistorico) return;

  historicoCompleto = aulas || [];
  listaHistorico.innerHTML = "";

  if (!historicoCompleto.length) {
    listaHistorico.innerHTML = `
      <div class="vazio-box">
        Nenhuma aula registrada ainda para este curso.
      </div>
    `;

    if (btnExpandirHistorico) {
      btnExpandirHistorico.style.display = "none";
    }

    return;
  }

  const aulasParaMostrar = historicoExpandido
    ? historicoCompleto
    : historicoCompleto.slice(0, 3);

  aulasParaMostrar.forEach((aula) => {
    const item = document.createElement("div");
    item.className = "item-historico";

    const dataAula = formatarData(aula.data_aula);
    const status = textoStatus(aula.status);
    const conteudo = aula.conteudo || "Não informado";
    const licao = aula.licao_casa || "Não informada";
    const justificativa = aula.justificativa || "";
    const precisaReposicao = aula.precisa_reposicao ? "Sim" : "Não";
    const parte = aula.parte ? ` - Parte ${aula.parte}` : "";

    item.innerHTML = `
      <div class="item-historico-topo">
        <strong>${dataAula}${parte}</strong>
        <span class="status-badge ${classeStatus(aula.status)}">${escaparHTML(status)}</span>
      </div>

      <div><strong>Conteúdo:</strong> ${escaparHTML(conteudo)}</div>
      <div style="margin-top:6px;"><strong>Lição de casa:</strong> ${escaparHTML(licao)}</div>
      <div style="margin-top:6px;"><strong>Precisa de reposição:</strong> ${precisaReposicao}</div>

      ${
        justificativa
          ? `<div style="margin-top:6px;"><strong>Justificativa:</strong> ${escaparHTML(justificativa)}</div>`
          : ""
      }
    `;

    listaHistorico.appendChild(item);
  });

  if (btnExpandirHistorico) {
    if (historicoCompleto.length > 3) {
      btnExpandirHistorico.style.display = "inline-block";
      btnExpandirHistorico.textContent = historicoExpandido
        ? "Recolher histórico"
        : "Ver todas as aulas";
    } else {
      btnExpandirHistorico.style.display = "none";
    }
  }
}

/* =========================================================
   CARREGAR DADOS DO CURSO SELECIONADO
========================================================= */
async function carregarDadosDaMatriculaSelecionada() {
  limparMensagem();

  if (!matriculaSelecionada) {
    limparCardsResumo();
    mostrarMensagem("Nenhum curso ativo foi encontrado para este aluno.");
    return;
  }

  historicoExpandido = false;
  reposicoesExpandido = false;

  salvarMatriculaSelecionada(matriculaSelecionada);
  preencherSelectMatriculas();
  preencherCabecalhoMatricula(matriculaSelecionada);

  const [
    aulas,
    notas,
    reposicoes,
    convitesAceitosSemComparecimento
  ] = await Promise.all([
    carregarAulasDaMatricula(matriculaSelecionada.id),
    carregarNotasDaMatricula(matriculaSelecionada.id),
    carregarReposicoesDaMatricula(matriculaSelecionada.id),
    carregarConvitesAceitosSemComparecimento(alunoId, matriculaSelecionada)
  ]);

  preencherResumoAcademico(
    aulas,
    reposicoes,
    convitesAceitosSemComparecimento
  );

  preencherNotas(notas);
  renderizarReposicoesPendentes(aulas);
  renderizarEventosParticipados(aulas);
  renderizarHistorico(aulas);
}

/* =========================================================
   EVENTOS DE INTERFACE
========================================================= */
if (selectMatriculaPainel) {
  selectMatriculaPainel.addEventListener("change", async () => {
    const idSelecionado = selectMatriculaPainel.value;

    const encontrada = matriculasAtivas.find(
      (m) => String(m.id) === String(idSelecionado)
    );

    if (!encontrada) return;

    matriculaSelecionada = encontrada;
    await carregarDadosDaMatriculaSelecionada();
  });
}

if (btnExpandirHistorico) {
  btnExpandirHistorico.addEventListener("click", () => {
    historicoExpandido = !historicoExpandido;
    renderizarHistorico(historicoCompleto);
  });
}

if (btnExpandirReposicoes) {
  btnExpandirReposicoes.addEventListener("click", () => {
    reposicoesExpandido = !reposicoesExpandido;
    renderizarReposicoesPendentes(reposicoesPendentesCompletas);
  });
}

/* =========================================================
   INICIALIZAÇÃO
========================================================= */
async function init() {
  limparMensagem();
  configurarContatoEscola();

  alunoId = obterAlunoId();

  if (!alunoId) {
    mostrarMensagem("Não foi possível identificar o aluno logado.");
    return;
  }

  try {
    const nomeSalvo = localStorage.getItem("alunoNome");

    if (nomeSalvo) {
      setTexto(nomeAluno, nomeSalvo);
    }

    alunoAtual = await carregarAluno(alunoId);
    matriculasAtivas = await carregarMatriculasAtivas(alunoId);

    if (!matriculasAtivas.length) {
      if (blocoCursoPainel) {
        blocoCursoPainel.style.display = "block";
      }

      if (textoCursoPainel) {
        textoCursoPainel.textContent =
          "Você não possui curso ativo no momento.";
      }

      limparCardsResumo();
      mostrarMensagem("Você não possui matrícula ativa.");
      return;
    }

    definirMatriculaSelecionadaInicial();
    preencherSelectMatriculas();

    await carregarDadosDaMatriculaSelecionada();
  } catch (erro) {
    console.error("Erro no painel acadêmico:", erro);
    mostrarMensagem(erro.message || "Erro ao carregar o painel acadêmico.");
  }
}

init();