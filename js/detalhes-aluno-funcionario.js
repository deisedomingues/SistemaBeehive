import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

/* =========================================================
   ELEMENTOS
========================================================= */
const msg = document.getElementById("msg");
const btnSair = document.getElementById("btnSair");

const tituloAluno = document.getElementById("tituloAluno");
const subtituloAluno = document.getElementById("subtituloAluno");
const badgeAniversarioWrap = document.getElementById("badgeAniversarioWrap");

const infoEmail = document.getElementById("infoEmail");
const infoTelefone = document.getElementById("infoTelefone");
const infoNascimento = document.getElementById("infoNascimento");
const infoEmpresa = document.getElementById("infoEmpresa");

const selectMatriculaFuncionario = document.getElementById("selectMatriculaFuncionario");

const resumoMateria = document.getElementById("resumoMateria");
const resumoModulo = document.getElementById("resumoModulo");
const resumoProfessor = document.getElementById("resumoProfessor");
const resumoInicio = document.getElementById("resumoInicio");
const resumoPresencas = document.getElementById("resumoPresencas");
const resumoAusencias = document.getElementById("resumoAusencias");
const resumoReposicoes = document.getElementById("resumoReposicoes");
const resumoFrequencia = document.getElementById("resumoFrequencia");

const textoZoom = document.getElementById("textoZoom");
const textoYoutube = document.getElementById("textoYoutube");
const linkZoom = document.getElementById("linkZoom");
const linkYoutube = document.getElementById("linkYoutube");

const qtdEventosParticipados = document.getElementById("qtdEventosParticipados");
const btnToggleEventos = document.getElementById("btnToggleEventos");
const boxEventosAluno = document.getElementById("boxEventosAluno");
const listaEventosAluno = document.getElementById("listaEventosAluno");

const filtroStatusHistorico = document.getElementById("filtroStatusHistorico");
const listaHistoricoAulas = document.getElementById("listaHistoricoAulas");

/* =========================================================
   ESTADO
========================================================= */
const params = new URLSearchParams(window.location.search);

/*
  Tenta encontrar o aluno de mais de uma forma.
  Isso evita erro caso uma tela anterior tenha salvo com outro nome.
*/
const alunoId =
  params.get("aluno_id") ||
  params.get("alunoId") ||
  localStorage.getItem("alunoIdVisualizacao") ||
  localStorage.getItem("alunoId") ||
  localStorage.getItem("alunoSelecionadoId");

let aluno = null;
let matriculas = [];
let matriculaAtual = null;
let aulasMatriculaAtual = [];
let eventosAluno = [];

/* =========================================================
   UTILITÁRIOS
========================================================= */
function mostrarMensagem(texto, ok = true) {
  if (!msg) return;

  msg.textContent = texto;
  msg.style.display = "block";
  msg.className = ok ? "msg-resumo-professor ok" : "msg-resumo-professor erro";
}

function limparMensagem() {
  if (!msg) return;

  msg.style.display = "none";
  msg.textContent = "";
  msg.className = "";
}

function escapeHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarData(dataIso) {
  if (!dataIso) return "—";

  const [ano, mes, dia] = String(dataIso).split("-");
  if (!ano || !mes || !dia) return dataIso;

  return `${dia}/${mes}/${ano}`;
}

function formatarHora(hora) {
  if (!hora) return "—";
  return String(hora).slice(0, 5);
}

function hojeMesDia() {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${mes}-${dia}`;
}

function ehAniversarioHoje(dataNascimento) {
  if (!dataNascimento) return false;

  const partes = String(dataNascimento).split("-");
  if (partes.length !== 3) return false;

  return `${partes[1]}-${partes[2]}` === hojeMesDia();
}

function obterClasseStatus(status) {
  switch (status) {
    case "Presente":
      return "status-presente";

    case "Ausente":
      return "status-ausente";

    case "Cancelada":
      return "status-cancelada";

    case "Reposição":
      return "status-reposicao";

    case "Aula Instrumental":
      return "status-instrumental";

    case "Plantão de dúvidas":
      return "status-plantao";

    default:
      return "";
  }
}

function calcularFrequencia(aulas) {
  /*
    Frequência aqui considera:
    - Presente como presença;
    - Reposição como presença;
    - Ausente como ausência;
    - Cancelada não deveria prejudicar o aluno, então também entra como presença técnica.
  */

  const totalConsiderado = aulas.filter((aula) =>
    ["Presente", "Ausente", "Cancelada", "Reposição"].includes(aula.status)
  );

  if (!totalConsiderado.length) return 0;

  const presencas = totalConsiderado.filter((aula) =>
    ["Presente", "Cancelada", "Reposição"].includes(aula.status)
  ).length;

  return Math.round((presencas / totalConsiderado.length) * 100);
}

function formatarDuracao(segundos) {
  if (!segundos && segundos !== 0) return "—";

  const totalSegundos = Number(segundos);

  if (Number.isNaN(totalSegundos)) return "—";

  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundosRestantes = totalSegundos % 60;

  if (horas > 0) {
    return `${horas}h ${String(minutos).padStart(2, "0")}min`;
  }

  if (minutos > 0) {
    return `${minutos}min`;
  }

  return `${segundosRestantes}s`;
}

/* =========================================================
   BUSCAS
========================================================= */
async function carregarAluno() {
  const { data, error } = await supabase
    .from("aluno")
    .select(`
      id,
      nome,
      data_nascimento,
      email,
      telefone,
      observacao,
      empresa_cnpj,
      empresa:empresa_cnpj (
        cnpj,
        nome
      )
    `)
    .eq("id", alunoId)
    .single();

  if (error) {
    console.error("Erro ao buscar aluno:", error);
    throw error;
  }

  aluno = data;
}

async function carregarMatriculas() {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      ativa,
      data_inicio,
      data_fim,
      link_zoom,
      link_youtube,
      aluno_id,
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
        nome
      )
    `)
    .eq("aluno_id", alunoId)
    .order("ativa", { ascending: false })
    .order("data_inicio", { ascending: false });

  if (error) {
    console.error("Erro ao buscar matrículas:", error);
    throw error;
  }

  matriculas = data || [];
}

async function carregarAulasDaMatricula(matriculaId) {
  /*
    CORREÇÃO IMPORTANTE:
    sua tabela usa duracao_segundos, não duracao_minutos.
    Se buscar duracao_minutos, o Supabase dá erro e nada carrega.
  */

  const { data, error } = await supabase
    .from("aula")
    .select(`
      id,
      data_aula,
      status,
      justificativa,
      conteudo,
      licao_casa,
      aula_original_id,
      precisa_reposicao,
      aula_gravada,
      duracao_segundos,
      parte,
      evento_id,
      aula_coletiva,
      grupo_aula_id,
      quantidade_alunos
    `)
    .eq("matricula_id", matriculaId)
    .order("data_aula", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("Erro ao buscar aulas da matrícula:", error);
    throw error;
  }

  aulasMatriculaAtual = data || [];
}

async function carregarEventosDoAluno() {
  const { data, error } = await supabase
    .from("evento_confirmacao")
    .select(`
      evento_id,
      evento:evento_id (
        id,
        titulo,
        data_evento,
        hora_evento,
        local,
        tipo_evento,
        ativo
      )
    `)
    .eq("aluno_id", alunoId);

  if (error) {
    console.error("Erro ao buscar eventos do aluno:", error);
    throw error;
  }

  eventosAluno = (data || [])
    .map((item) => item.evento)
    .filter(Boolean)
    .sort((a, b) =>
      String(b.data_evento || "").localeCompare(String(a.data_evento || ""))
    );
}

/* =========================================================
   RENDER - TOPO
========================================================= */
function renderTopoAluno() {
  tituloAluno.textContent = aluno?.nome || "Aluno";
  subtituloAluno.textContent = "Confira abaixo seus cursos, acessos e histórico de aulas.";

  infoEmail.textContent = aluno?.email || "—";
  infoTelefone.textContent = aluno?.telefone || "—";

  infoNascimento.textContent = aluno?.data_nascimento
    ? formatarData(aluno.data_nascimento)
    : "—";

  infoEmpresa.textContent = aluno?.empresa?.nome || "—";

  if (ehAniversarioHoje(aluno?.data_nascimento)) {
    badgeAniversarioWrap.innerHTML = `
      <span class="badge-aniversario">🎂 Aniversariante do dia</span>
    `;
  } else {
    badgeAniversarioWrap.innerHTML = "";
  }
}

function renderSelectMatriculas() {
  if (!matriculas.length) {
    selectMatriculaFuncionario.innerHTML = `
      <option value="">Nenhum curso encontrado</option>
    `;
    selectMatriculaFuncionario.disabled = true;
    return;
  }

  selectMatriculaFuncionario.disabled = false;
  selectMatriculaFuncionario.innerHTML = `
    <option value="">Selecione o curso</option>
  `;

  matriculas.forEach((matricula) => {
    const opt = document.createElement("option");

    opt.value = matricula.id;

    const materia = matricula?.materia?.nome || "Matéria";
    const modulo = matricula?.modulo?.nome || "Módulo";
    const situacao = matricula?.ativa ? "ativo" : "inativo";

    opt.textContent = `${materia} (${modulo}) — ${situacao}`;

    selectMatriculaFuncionario.appendChild(opt);
  });

  const primeiraAtiva = matriculas.find((matricula) => matricula.ativa) || matriculas[0];

  if (primeiraAtiva) {
    selectMatriculaFuncionario.value = String(primeiraAtiva.id);
  }
}

/* =========================================================
   RENDER - RESUMO DO CURSO
========================================================= */
function renderResumoCurso() {
  if (!matriculaAtual) {
    resumoMateria.textContent = "—";
    resumoModulo.textContent = "—";
    resumoProfessor.textContent = "—";
    resumoInicio.textContent = "—";
    resumoPresencas.textContent = "0";
    resumoAusencias.textContent = "0";
    resumoReposicoes.textContent = "0";
    resumoFrequencia.textContent = "0%";
    return;
  }

  const presencas = aulasMatriculaAtual.filter((aula) => aula.status === "Presente").length;
  const ausencias = aulasMatriculaAtual.filter((aula) => aula.status === "Ausente").length;
  const reposicoes = aulasMatriculaAtual.filter((aula) => aula.status === "Reposição").length;
  const frequencia = calcularFrequencia(aulasMatriculaAtual);

  resumoMateria.textContent = matriculaAtual?.materia?.nome || "—";
  resumoModulo.textContent = matriculaAtual?.modulo?.nome || "—";
  resumoProfessor.textContent = matriculaAtual?.professor?.nome || "—";
  resumoInicio.textContent = formatarData(matriculaAtual?.data_inicio);

  resumoPresencas.textContent = String(presencas);
  resumoAusencias.textContent = String(ausencias);
  resumoReposicoes.textContent = String(reposicoes);
  resumoFrequencia.textContent = `${frequencia}%`;
}

function renderLinksCurso() {
  const zoom = matriculaAtual?.link_zoom || "";
  const youtube = matriculaAtual?.link_youtube || "";

  if (zoom) {
    textoZoom.textContent = "Link disponível para este curso.";
    linkZoom.href = zoom;
    linkZoom.style.display = "inline-block";
  } else {
    textoZoom.textContent = "Nenhum link cadastrado.";
    linkZoom.removeAttribute("href");
    linkZoom.style.display = "none";
  }

  if (youtube) {
    textoYoutube.textContent = "Playlist disponível para este curso.";
    linkYoutube.href = youtube;
    linkYoutube.style.display = "inline-block";
  } else {
    textoYoutube.textContent = "Nenhum link cadastrado.";
    linkYoutube.removeAttribute("href");
    linkYoutube.style.display = "none";
  }
}

/* =========================================================
   RENDER - EVENTOS
========================================================= */
function renderEventosAluno() {
  qtdEventosParticipados.textContent = `${eventosAluno.length} evento(s)`;

  if (!eventosAluno.length) {
    listaEventosAluno.innerHTML = `
      <p class="vazio-box">Nenhum evento com participação registrada.</p>
    `;
    btnToggleEventos.style.display = "none";
    boxEventosAluno.style.display = "none";
    return;
  }

  btnToggleEventos.style.display = "inline-block";

  listaEventosAluno.innerHTML = eventosAluno
    .map((evento) => {
      return `
        <div class="item-evento-aluno">
          <div class="item-evento-aluno-topo">
            <strong>${escapeHtml(evento.titulo || "Evento")}</strong>
            <span class="badge-evento-aluno">
              ${escapeHtml(formatarData(evento.data_evento))}
            </span>
          </div>

          <p><b>Tipo:</b> ${escapeHtml(evento.tipo_evento || "—")}</p>
          <p><b>Horário:</b> ${escapeHtml(formatarHora(evento.hora_evento))}</p>
          <p><b>Local:</b> ${escapeHtml(evento.local || "—")}</p>
        </div>
      `;
    })
    .join("");
}

/* =========================================================
   RENDER - HISTÓRICO
========================================================= */
function renderHistorico() {
  const statusSelecionado = filtroStatusHistorico.value;

  let lista = [...aulasMatriculaAtual];

  if (statusSelecionado) {
    if (statusSelecionado === "evento") {
      /*
        O option do HTML usa value="evento".
        Evento não é status da aula.
        Então aqui filtramos por aula que tem evento_id.
      */
      lista = lista.filter((aula) => aula.evento_id);
    } else {
      lista = lista.filter((aula) => aula.status === statusSelecionado);
    }
  }

  if (!lista.length) {
    listaHistoricoAulas.innerHTML = `
      <p class="vazio-box">Nenhuma aula encontrada para os filtros selecionados.</p>
    `;
    return;
  }

  listaHistoricoAulas.innerHTML = lista
    .map((aula) => {
      const classeStatus = obterClasseStatus(aula.status);

      const infoParte = aula.parte ? `Parte ${aula.parte}` : "";
      const infoColetiva = aula.aula_coletiva ? "Aula coletiva" : "Aula individual";
      const qtdAlunos = aula.quantidade_alunos ? `${aula.quantidade_alunos} aluno(s)` : "";
      const duracao = aula.duracao_segundos ? formatarDuracao(aula.duracao_segundos) : "";

      return `
        <div class="item-historico">
          <div class="item-historico-topo">
            <strong>${escapeHtml(formatarData(aula.data_aula))}</strong>

            <span class="status-badge ${classeStatus}">
              ${escapeHtml(aula.status || "—")}
            </span>
          </div>

          <p style="margin-top:6px;">
            ${escapeHtml(infoColetiva)}
            ${infoParte ? ` | ${escapeHtml(infoParte)}` : ""}
            ${qtdAlunos ? ` | ${escapeHtml(qtdAlunos)}` : ""}
            ${aula.evento_id ? ` | Evento` : ""}
          </p>

          ${aula.conteudo ? `<p><b>Conteúdo:</b> ${escapeHtml(aula.conteudo)}</p>` : ""}
          ${aula.licao_casa ? `<p><b>Lição de casa:</b> ${escapeHtml(aula.licao_casa)}</p>` : ""}
          ${aula.justificativa ? `<p><b>Justificativa:</b> ${escapeHtml(aula.justificativa)}</p>` : ""}
          ${aula.aula_gravada ? `<p><b>Aula gravada:</b> Sim</p>` : ""}
          ${aula.precisa_reposicao ? `<p><b>Reposição pendente:</b> Sim</p>` : ""}
          ${duracao ? `<p><b>Duração registrada:</b> ${escapeHtml(duracao)}</p>` : ""}
        </div>
      `;
    })
    .join("");
}

/* =========================================================
   FLUXO
========================================================= */
async function selecionarMatricula(matriculaId) {
  matriculaAtual =
    matriculas.find((matricula) => String(matricula.id) === String(matriculaId)) || null;

  if (!matriculaAtual) {
    aulasMatriculaAtual = [];

    renderResumoCurso();
    renderLinksCurso();
    renderHistorico();

    return;
  }

  await carregarAulasDaMatricula(matriculaAtual.id);

  renderResumoCurso();
  renderLinksCurso();
  renderHistorico();
}

async function iniciarTela() {
  try {
    limparMensagem();

    if (!alunoId) {
      mostrarMensagem("Não foi possível identificar o aluno para visualização.", false);

      setTimeout(() => {
        window.location.href = "home-professor.html";
      }, 1200);

      return;
    }

    await carregarAluno();
    await carregarMatriculas();
    await carregarEventosDoAluno();

    renderTopoAluno();
    renderSelectMatriculas();
    renderEventosAluno();

    if (matriculas.length) {
      await selecionarMatricula(selectMatriculaFuncionario.value);
    } else {
      renderResumoCurso();
      renderLinksCurso();
      renderHistorico();

      mostrarMensagem("Este aluno ainda não possui matrícula cadastrada.", false);
    }
  } catch (error) {
    console.error("Erro ao carregar visualização do aluno:", error);

    mostrarMensagem(
      "Erro ao carregar os dados do aluno. Verifique se o ID do aluno foi enviado corretamente e se as colunas existem no banco.",
      false
    );
  }
}

/* =========================================================
   EVENTOS
========================================================= */
selectMatriculaFuncionario?.addEventListener("change", async () => {
  try {
    limparMensagem();
    await selecionarMatricula(selectMatriculaFuncionario.value);
  } catch (error) {
    console.error("Erro ao trocar matrícula:", error);
    mostrarMensagem("Erro ao carregar o curso selecionado.", false);
  }
});

filtroStatusHistorico?.addEventListener("change", renderHistorico);

btnToggleEventos?.addEventListener("click", () => {
  const aberto = boxEventosAluno.style.display === "block";

  boxEventosAluno.style.display = aberto ? "none" : "block";
  btnToggleEventos.textContent = aberto ? "Ver mais" : "Ver menos";
});

btnSair?.addEventListener("click", async () => {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Erro ao sair:", error);
  }

  localStorage.removeItem("role");
  localStorage.removeItem("professorId");
  localStorage.removeItem("professorNome");
  localStorage.removeItem("professorEmail");
  localStorage.removeItem("matriculaSelecionada");
  localStorage.removeItem("alunoIdVisualizacao");
  localStorage.removeItem("alunoId");
  localStorage.removeItem("alunoSelecionadoId");

  window.location.href = "index.html";
});

/* =========================================================
   INÍCIO
========================================================= */
await iniciarTela();