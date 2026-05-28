import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

const matriculaId = localStorage.getItem("matriculaSelecionada");

// ===============================
// ELEMENTOS
// ===============================

const msg = document.getElementById("msg");
const tituloAluno = document.getElementById("tituloAluno");
const subtituloAluno = document.getElementById("subtituloAluno");

const infoMateria = document.getElementById("infoMateria");
const infoModuloAtual = document.getElementById("infoModuloAtual");
const infoProfessor = document.getElementById("infoProfessor");
const infoNascimento = document.getElementById("infoNascimento");
const badgeAniversario = document.getElementById("badgeAniversario");

const cPresente = document.getElementById("cPresente");
const cAusente = document.getElementById("cAusente");
const cCancelada = document.getElementById("cCancelada");
const cReposicao = document.getElementById("cReposicao");
const cInstrumental = document.getElementById("cInstrumental");
const cPlantao = document.getElementById("cPlantao");
const cEventos = document.getElementById("cEventos");
const cAulasValidas = document.getElementById("cAulasValidas");

const statusAvaliacaoPendente = document.getElementById("statusAvaliacaoPendente");
const textoAvaliacaoPendente = document.getElementById("textoAvaliacaoPendente");

const listaAulas = document.getElementById("listaAulas");
const listaReposicoes = document.getElementById("listaReposicoes");
const btnToggleReposicoes = document.getElementById("btnToggleReposicoes");

const btnToggleEventos = document.getElementById("btnToggleEventos");
const boxEventosAluno = document.getElementById("boxEventosAluno");
const listaEventosAluno = document.getElementById("listaEventosAluno");

const formNota = document.getElementById("form-nota");
const notaData = document.getElementById("notaData");
const notaTipo = document.getElementById("notaTipo");
const notaValor = document.getElementById("notaValor");
const notaObs = document.getElementById("notaObs");
const notaModulo = document.getElementById("notaModulo");

const listaNotas = document.getElementById("listaNotas");
const mediaGeralEl = document.getElementById("mediaGeral");

const filtroModulo = document.getElementById("filtroModulo");
const filtroModuloAula = document.getElementById("filtroModuloAula");
const filtroStatusAula = document.getElementById("filtroStatusAula");

const btnVoltarTopo = document.getElementById("btnVoltarTopo");
const btnVoltarRodape = document.getElementById("btnVoltarRodape");

const boxExpandirAulas = document.getElementById("boxExpandirAulas");
const btnExpandirAulas = document.getElementById("btnExpandirAulas");

// ===============================
// ESTADO
// ===============================

let todasNotas = [];
let todasAulas = [];
let eventosAluno = [];
let avaliacoesAluno = [];
let dadosCabecalho = null;
let aulasExpandido = false;
let reposicoesExpandido = false;
let reposicoesPendentesLista = [];

// ===============================
// STATUS
// ===============================

const STATUS = {
  PRESENTE: "Presente",
  AUSENTE: "Ausente",
  CANCELADA: "Cancelada",
  REPOSICAO: "Reposição",
  AULA_INSTRUMENTAL: "Aula Instrumental",
  PLANTAO_DUVIDAS: "Plantão de dúvidas",
  TRANCADA: "Trancada",
  AULA_EXPERIMENTAL: "Aula Experimental"
};

// ===============================
// FUNÇÕES AUXILIARES
// ===============================

function mostrarMensagem(texto, ok = true) {
  if (!msg) return;

  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";
  msg.style.padding = "10px 12px";
  msg.style.borderRadius = "10px";

  setTimeout(() => {
    msg.style.display = "none";
  }, 2500);
}

function limparLista(el) {
  if (!el) return;
  el.innerHTML = "";
}

function formatarDataBR(dataISO) {
  if (!dataISO) return "-";

  const texto = String(dataISO);

  if (texto.includes("T")) {
    const data = new Date(texto);

    if (!Number.isNaN(data.getTime())) {
      return data.toLocaleDateString("pt-BR");
    }
  }

  const [yyyy, mm, dd] = texto.split("-");

  if (!yyyy || !mm || !dd) {
    return texto;
  }

  return `${dd}/${mm}/${yyyy}`;
}

function formatarDataHoraBR(dataISO) {
  if (!dataISO) return "-";

  const data = new Date(dataISO);

  if (Number.isNaN(data.getTime())) {
    return formatarDataBR(dataISO);
  }

  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function hojeISO() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
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
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function ehAniversarioHoje(dataNascimento) {
  if (!dataNascimento) return false;

  const hoje = new Date();
  const [, mes, dia] = dataNascimento.split("-").map(Number);

  return hoje.getMonth() + 1 === mes && hoje.getDate() === dia;
}

function voltarParaResumo() {
  window.location.href = "resumo-professor.html";
}

if (!matriculaId) {
  voltarParaResumo();
}

function obterMapaAulasPorId(aulas) {
  const mapa = new Map();

  (aulas || []).forEach((aula) => {
    mapa.set(Number(aula.id), aula);
  });

  return mapa;
}

function textoParte(parte) {
  if (!parte) return "Parte não informada";
  return `Parte ${parte}`;
}

function ehNotaDeAvaliacao(nota) {
  const tipo = normalizarTexto(
    nota?.tipo ?? nota?.tipo_avaliacao ?? nota?.avaliacao ?? ""
  );

  return tipo.includes("avalia");
}

function aulaContaComoValida(aula) {
  const status = normalizarTexto(aula?.status);
  const gravada = aula?.aula_gravada === true;

  if (status === "presente" && gravada) return true;
  if (status === "ausente" && gravada) return true;
  if ((status === "reposicao" || status === "reposição") && gravada) return true;

  return false;
}

function irParaEditarAula(aulaId) {
  localStorage.setItem("aulaSelecionadaEdicao", String(aulaId));
  localStorage.setItem("matriculaSelecionadaEdicao", String(matriculaId));
  window.location.href = `editar-aula.html?id=${encodeURIComponent(aulaId)}`;
}

function obterAulasValidasModuloAtual() {
  const moduloAtual = Number(dadosCabecalho?.modulo_id || 0);

  return todasAulas.filter((aula) => {
    if (Number(aula.modulo_id || 0) !== moduloAtual) return false;
    return aulaContaComoValida(aula);
  });
}

function obterNotasDeAvaliacaoModuloAtual() {
  const moduloAtual = Number(dadosCabecalho?.modulo_id || 0);

  return todasNotas
    .filter((nota) => {
      if (Number(nota.modulo_id || 0) !== moduloAtual) return false;
      return ehNotaDeAvaliacao(nota);
    })
    .sort((a, b) => {
      const dataA = String(a.data || "");
      const dataB = String(b.data || "");

      if (dataA !== dataB) {
        return dataA.localeCompare(dataB);
      }

      return Number(a.id || 0) - Number(b.id || 0);
    });
}

function contarAulasValidasModuloAtual() {
  return obterAulasValidasModuloAtual().length;
}

function contarAulasValidasDesdeUltimaAvaliacao() {
  const aulasValidas = obterAulasValidasModuloAtual();
  const avaliacoes = obterNotasDeAvaliacaoModuloAtual();

  if (!avaliacoes.length) {
    return aulasValidas.length;
  }

  const ultimaAvaliacao = avaliacoes[avaliacoes.length - 1];
  const dataUltimaAvaliacao = String(ultimaAvaliacao.data || "");

  return aulasValidas.filter((aula) => {
    const dataAula = String(aula.data_aula || "");
    return dataAula > dataUltimaAvaliacao;
  }).length;
}

function atualizarCardAulasValidasEAvaliacao() {
  const totalAulasValidas = contarAulasValidasModuloAtual();
  const avaliacoes = obterNotasDeAvaliacaoModuloAtual();
  const totalAvaliacoesLancadas = avaliacoes.length;
  const aulasDesdeUltimaAvaliacao = contarAulasValidasDesdeUltimaAvaliacao();
  const proximaAvaliacao = totalAvaliacoesLancadas + 1;

  cAulasValidas.textContent = String(totalAulasValidas);

  if (aulasDesdeUltimaAvaliacao >= 14) {
    statusAvaliacaoPendente.textContent = `Pendente: Avaliação ${proximaAvaliacao}`;
    statusAvaliacaoPendente.style.color = "#b71c1c";

    textoAvaliacaoPendente.textContent =
      `${totalAulasValidas} aula(s) válida(s) no módulo atual • ` +
      `${aulasDesdeUltimaAvaliacao} aula(s) válida(s) desde a última avaliação • ` +
      `${totalAvaliacoesLancadas} avaliação(ões) lançada(s). ` +
      `Ao lançar a próxima avaliação, o contador recomeça.`;
  } else {
    const faltam = 14 - aulasDesdeUltimaAvaliacao;

    statusAvaliacaoPendente.textContent = "Nenhuma avaliação pendente";
    statusAvaliacaoPendente.style.color = "#1b5e20";

    textoAvaliacaoPendente.textContent =
      `${totalAulasValidas} aula(s) válida(s) no módulo atual • ` +
      `${aulasDesdeUltimaAvaliacao} aula(s) válida(s) desde a última avaliação • ` +
      `${totalAvaliacoesLancadas} avaliação(ões) lançada(s). ` +
      `Faltam ${faltam} aula(s) válida(s) para a próxima previsão.`;
  }
}

function montarLinhaConteudo(aula) {
  const conteudo = aula.conteudo?.trim();
  return conteudo ? `Conteúdo da aula: ${conteudo}` : "Conteúdo da aula: Não informado";
}

function montarLinhaLicao(aula) {
  const licao = aula.licao_casa?.trim();
  return licao ? `Lição de casa: ${licao}` : "";
}

function obterTextoRodapeHistorico(aula, mapaAulas) {
  const professor = aula.professor?.nome || "-";
  const partes = [
    `Professor: ${professor}`,
    `Status: ${aula.status || "-"}`,
    textoParte(aula.parte)
  ];

  if (aula.status === STATUS.PRESENTE && aula.aula_gravada) {
    partes.push("Aula gravada");
    return partes.join(" | ");
  }

  if (aula.status === STATUS.AUSENTE) {
    if (aula.aula_gravada) {
      partes.push("Aula gravada");
    } else if (aula.precisa_reposicao) {
      partes.push("Reposição pendente");
    }
    return partes.join(" | ");
  }

  if (aula.status === STATUS.CANCELADA || aula.status === STATUS.TRANCADA) {
    if (aula.precisa_reposicao) {
      partes.push("Reposição pendente");
    }
    return partes.join(" | ");
  }

  if (aula.status === STATUS.REPOSICAO) {
    if (aula.aula_gravada) {
      partes.push("Aula gravada");
    }

    const aulaOriginal = mapaAulas.get(Number(aula.aula_original_id));

    if (aulaOriginal?.data_aula) {
      partes.push(`Referente à ausência do dia ${formatarDataBR(aulaOriginal.data_aula)}`);
    } else if (aula.aula_original_id) {
      partes.push("Referente a uma ausência anterior");
    }

    return partes.join(" | ");
  }

  if (
    aula.status === STATUS.AULA_INSTRUMENTAL ||
    aula.status === STATUS.PLANTAO_DUVIDAS
  ) {
    if (aula.aula_gravada) {
      partes.push("Aula gravada");
    }
    return partes.join(" | ");
  }

  if (aula.status === STATUS.AULA_EXPERIMENTAL) {
    partes.push("Duração padrão de 40 minutos");
    return partes.join(" | ");
  }

  return partes.join(" | ");
}

// ===============================
// BLOCO DINÂMICO DE AVALIAÇÕES ENVIADAS
// ===============================

function obterOuCriarBlocoAvaliacoesEnviadas() {
  let bloco = document.getElementById("blocoAvaliacoesEnviadasAluno");

  if (bloco) return bloco;

  bloco = document.createElement("section");
  bloco.id = "blocoAvaliacoesEnviadasAluno";
  bloco.className = "card";
  bloco.style.marginBottom = "16px";

  bloco.innerHTML = `
    <h2>📝 Avaliações enviadas ao aluno</h2>
    <p style="font-size:14px; opacity:0.9; margin-bottom:12px;">
      Acompanhe as avaliações liberadas para este aluno e o status informado pelo sistema.
    </p>
    <div id="listaAvaliacoesEnviadasAluno">
      <p style="font-size:14px;">Carregando avaliações enviadas...</p>
    </div>
  `;

  const referencia =
    document.getElementById("form-nota")?.closest("section") ||
    document.getElementById("form-nota")?.closest(".card") ||
    listaNotas?.closest("section") ||
    listaNotas?.closest(".card");

  if (referencia?.parentElement) {
    referencia.parentElement.insertBefore(bloco, referencia);
  } else {
    document.querySelector("main")?.appendChild(bloco);
  }

  return bloco;
}

function textoStatusAvaliacaoAluno(avaliacao) {
  if (avaliacao.status === "Pendente") {
    return "Pendente — enviada ao aluno, aguardando realização.";
  }

  if (avaliacao.status === "Realizada pelo aluno") {
    return "Realizada pelo aluno — aguardando conferência/correção e lançamento de nota.";
  }

  if (avaliacao.status === "Concluída") {
    return "Concluída — nota lançada no sistema.";
  }

  if (avaliacao.status === "Cancelada") {
    return "Cancelada.";
  }

  return avaliacao.status || "Status não informado.";
}

function tituloAvaliacaoAluno(avaliacao) {
  const tituloFormulario = avaliacao?.avaliacao_formulario?.titulo;
  const numero = avaliacao?.numero_avaliacao;

  if (tituloFormulario) return tituloFormulario;
  if (numero) return `Progress Check ${numero}`;

  return "Avaliação";
}

function renderAvaliacoesEnviadasAluno() {
  obterOuCriarBlocoAvaliacoesEnviadas();

  const lista = document.getElementById("listaAvaliacoesEnviadasAluno");

  if (!lista) return;

  if (!avaliacoesAluno.length) {
    lista.innerHTML = `
      <p style="font-size:14px;">
        Nenhuma avaliação foi enviada para este aluno até o momento.
      </p>
    `;
    return;
  }

  const ordenadas = [...avaliacoesAluno].sort((a, b) => {
    const dataA = String(a.enviado_em || "");
    const dataB = String(b.enviado_em || "");

    if (dataA !== dataB) return dataB.localeCompare(dataA);

    return Number(b.id || 0) - Number(a.id || 0);
  });

  lista.innerHTML = ordenadas
    .map((avaliacao) => {
      const titulo = tituloAvaliacaoAluno(avaliacao);
      const materia = avaliacao?.materia?.nome || dadosCabecalho?.materia?.nome || "Matéria";
      const modulo = avaliacao?.modulo?.nome || dadosCabecalho?.modulo?.nome || "Módulo";
      const enviadaEm = formatarDataHoraBR(avaliacao.enviado_em);
      const realizadaEm = avaliacao.aluno_confirmou_realizacao_em
        ? formatarDataHoraBR(avaliacao.aluno_confirmou_realizacao_em)
        : "-";
      const concluidaEm = avaliacao.concluida_em
        ? formatarDataHoraBR(avaliacao.concluida_em)
        : "-";

      return `
        <div style="padding:12px 0; border-bottom:1px solid #e6dfcf;">
          <strong>${escaparHtml(titulo)} — ${escaparHtml(modulo)}</strong>

          <p style="font-size:13px; margin:6px 0 4px 0;">
            ${escaparHtml(materia)} • ${escaparHtml(modulo)}
          </p>

          <p style="font-size:13px; margin:4px 0;">
            <b>Status:</b> ${escaparHtml(textoStatusAvaliacaoAluno(avaliacao))}
          </p>

          <p style="font-size:13px; margin:4px 0;">
            <b>Enviada em:</b> ${escaparHtml(enviadaEm)}
          </p>

          <p style="font-size:13px; margin:4px 0;">
            <b>Aluno informou realização em:</b> ${escaparHtml(realizadaEm)}
          </p>

          <p style="font-size:13px; margin:4px 0;">
            <b>Concluída em:</b> ${escaparHtml(concluidaEm)}
          </p>
        </div>
      `;
    })
    .join("");
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
      aluno:aluno_id (
        id,
        nome,
        data_nascimento
      ),
      materia:materia_id (
        nome
      ),
      modulo:modulo_id (
        nome
      ),
      professor:professor_id (
        nome
      )
    `)
    .eq("id", matriculaId)
    .single();

  if (error || !data) {
    console.error(error);
    mostrarMensagem("Erro ao carregar aluno", false);
    return null;
  }

  dadosCabecalho = data;

  const nomeAluno = data.aluno?.nome || "Aluno";
  const nomeMateria = data.materia?.nome || "-";
  const nomeModulo = data.modulo?.nome || "-";
  const nomeProfessor = data.professor?.nome || "-";
  const nascimento = data.aluno?.data_nascimento || null;

  tituloAluno.textContent = nomeAluno;
  subtituloAluno.textContent = `${nomeMateria} — ${nomeModulo} — Prof(a). ${nomeProfessor}`;

  infoMateria.textContent = nomeMateria;
  infoModuloAtual.textContent = nomeModulo;
  infoProfessor.textContent = nomeProfessor;
  infoNascimento.textContent = nascimento ? formatarDataBR(nascimento) : "-";

  if (ehAniversarioHoje(nascimento)) {
    badgeAniversario.style.display = "inline-flex";
  } else {
    badgeAniversario.style.display = "none";
  }

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

  notaModulo.innerHTML = `<option value="">Selecione o módulo</option>`;
  filtroModulo.innerHTML = `<option value="">Todos</option>`;
  filtroModuloAula.innerHTML = `<option value="">Todos</option>`;

  modulos.forEach((m) => {
    const optNota = document.createElement("option");
    optNota.value = m.id;
    optNota.textContent = m.nome;

    if (String(m.id) === String(moduloAtual)) {
      optNota.selected = true;
    }

    notaModulo.appendChild(optNota);

    const optFiltroNota = document.createElement("option");
    optFiltroNota.value = m.id;
    optFiltroNota.textContent = m.nome;
    filtroModulo.appendChild(optFiltroNota);

    const optFiltroAula = document.createElement("option");
    optFiltroAula.value = m.id;
    optFiltroAula.textContent = m.nome;
    filtroModuloAula.appendChild(optFiltroAula);
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
      aula_original_id,
      parte,
      modulo_id,
      modulo:modulo_id ( nome ),
      professor:professor_id ( nome )
    `)
    .eq("matricula_id", matriculaId)
    .order("data_aula", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error(error);
    mostrarMensagem("Erro ao carregar aulas", false);
    return [];
  }

  return data || [];
}

function atualizarBotaoExpandirAulas(totalAulas) {
  if (!boxExpandirAulas || !btnExpandirAulas) return;

  if (totalAulas <= 3) {
    boxExpandirAulas.style.display = "none";
    return;
  }

  boxExpandirAulas.style.display = "block";
  btnExpandirAulas.textContent = aulasExpandido ? "Ver menos aulas" : "Ver mais aulas";
}

function obterAulasFiltradas() {
  const moduloId = Number(filtroModuloAula?.value || "");
  const statusFiltro = filtroStatusAula?.value || "";

  let filtradas = [...todasAulas];

  if (moduloId) {
    filtradas = filtradas.filter(
      (aula) => Number(aula.modulo_id) === moduloId
    );
  }

  if (statusFiltro === "__VALIDAS__") {
    filtradas = filtradas.filter((aula) => aulaContaComoValida(aula));
    return filtradas;
  }

  if (statusFiltro) {
    filtradas = filtradas.filter(
      (aula) => normalizarTexto(aula.status) === normalizarTexto(statusFiltro)
    );
  }

  return filtradas;
}

function renderAulas(aulasOriginais) {
  limparLista(listaAulas);

  if (!aulasOriginais.length) {
    listaAulas.innerHTML = `<div class="vazio-box">Nenhuma aula encontrada com os filtros selecionados.</div>`;
    atualizarBotaoExpandirAulas(0);
    return;
  }

  const mapaAulas = obterMapaAulasPorId(todasAulas);
  const aulasParaMostrar = aulasExpandido ? aulasOriginais : aulasOriginais.slice(0, 3);
  const totalAulasFiltradas = aulasOriginais.length;

  aulasParaMostrar.forEach((aula, index) => {
    const li = document.createElement("li");
    li.style.listStyle = "none";
    li.style.marginBottom = "0";
    li.style.padding = "12px 0";
    li.style.borderBottom = "1px solid #e6dfcf";

    const numeroAula = totalAulasFiltradas - index;
    const dataBR = formatarDataBR(aula.data_aula);
    const linhaConteudo = montarLinhaConteudo(aula);
    const linhaLicao = montarLinhaLicao(aula);
    const rodape = obterTextoRodapeHistorico(aula, mapaAulas);

    li.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
          <div style="font-weight:700; font-size:14px;">
            ${escaparHtml(`Aula ${numeroAula} — ${dataBR}`)}
          </div>

          <button
            type="button"
            class="btn btn-editar-aula"
            data-aula-id="${escaparHtml(aula.id)}"
            style="padding:6px 10px; font-size:12px;"
          >
            ✏️ Editar aula
          </button>
        </div>

        <div style="font-size:13px; line-height:1.45;">
          ${escaparHtml(linhaConteudo)}
        </div>

        ${
          linhaLicao
            ? `<div style="font-size:13px; line-height:1.45;">
                ${escaparHtml(linhaLicao)}
              </div>`
            : ""
        }

        <div style="font-size:12px; opacity:0.88; line-height:1.45;">
          ${escaparHtml(rodape)}
        </div>
      </div>
    `;

    const btnEditar = li.querySelector(".btn-editar-aula");

    btnEditar?.addEventListener("click", () => {
      irParaEditarAula(aula.id);
    });

    listaAulas.appendChild(li);
  });

  atualizarBotaoExpandirAulas(aulasOriginais.length);
}

function atualizarRenderAulas() {
  const aulasFiltradas = obterAulasFiltradas();
  renderAulas(aulasFiltradas);
}

// ===============================
// AVALIAÇÕES ENVIADAS
// ===============================

async function carregarAvaliacoesAluno() {
  const { data, error } = await supabase
    .from("avaliacao_aluno")
    .select(`
      id,
      aluno_id,
      matricula_id,
      materia_id,
      modulo_id,
      avaliacao_formulario_id,
      numero_avaliacao,
      status,
      enviado_em,
      visualizado,
      concluida_em,
      aluno_confirmou_realizacao_em,
      observacao,
      materia:materia_id (
        id,
        nome
      ),
      modulo:modulo_id (
        id,
        nome,
        ordem
      ),
      avaliacao_formulario:avaliacao_formulario_id (
        id,
        titulo,
        link_formulario
      )
    `)
    .eq("matricula_id", matriculaId)
    .order("enviado_em", { ascending: false });

  if (error) {
    console.error("Erro ao carregar avaliações enviadas:", error);
    avaliacoesAluno = [];
    renderAvaliacoesEnviadasAluno();
    return;
  }

  avaliacoesAluno = data || [];
  renderAvaliacoesEnviadasAluno();
}

async function marcarAvaliacaoComoConcluidaAposNota(moduloId, tipoNota) {
  const tipo = normalizarTexto(tipoNota);

  if (!tipo.includes("avalia")) {
    return;
  }

  const modulo = Number(moduloId || 0);

  if (!modulo) return;

  const avaliacoesAbertas = avaliacoesAluno
    .filter((avaliacao) => {
      const mesmoModulo = Number(avaliacao.modulo_id || 0) === modulo;
      const aberta =
        avaliacao.status === "Pendente" ||
        avaliacao.status === "Realizada pelo aluno";

      return mesmoModulo && aberta;
    })
    .sort((a, b) => {
      const numeroA = Number(a.numero_avaliacao || 0);
      const numeroB = Number(b.numero_avaliacao || 0);

      if (numeroA !== numeroB) return numeroA - numeroB;

      return Number(a.id || 0) - Number(b.id || 0);
    });

  const avaliacaoParaConcluir = avaliacoesAbertas[0];

  if (!avaliacaoParaConcluir) {
    return;
  }

  const { error } = await supabase
    .from("avaliacao_aluno")
    .update({
      status: "Concluída",
      concluida_em: new Date().toISOString()
    })
    .eq("id", avaliacaoParaConcluir.id);

  if (error) {
    console.warn("Nota salva, mas não foi possível marcar avaliação como concluída:", error.message);
    return;
  }

  await carregarAvaliacoesAluno();
}

// ===============================
// EVENTOS DO ALUNO
// ===============================

async function carregarEventosAluno() {
  const alunoId = dadosCabecalho?.aluno?.id;

  if (!alunoId) {
    eventosAluno = [];
    atualizarCardEventos();
    return;
  }

  const { data, error } = await supabase
    .from("evento_confirmacao")
    .select(`
      evento_id,
      aluno_id,
      evento:evento_id (
        id,
        titulo,
        tipo_evento,
        data_evento,
        hora_evento,
        local,
        ativo
      )
    `)
    .eq("aluno_id", alunoId);

  if (error) {
    console.error("Erro ao carregar eventos do aluno:", error);
    eventosAluno = [];
    atualizarCardEventos();
    return;
  }

  eventosAluno = (data || [])
    .map((item) => item.evento)
    .filter(Boolean)
    .sort((a, b) => {
      const dataA = `${a.data_evento || ""} ${a.hora_evento || "00:00"}`;
      const dataB = `${b.data_evento || ""} ${b.hora_evento || "00:00"}`;
      return dataB.localeCompare(dataA);
    });

  atualizarCardEventos();
}

function atualizarCardEventos() {
  cEventos.textContent = eventosAluno.length;

  if (!eventosAluno.length) {
    btnToggleEventos.style.display = "none";
    boxEventosAluno.style.display = "none";
    listaEventosAluno.innerHTML = `<p style="font-size:13px; color:#666; margin-top:10px;">Nenhum evento participado até agora.</p>`;
    return;
  }

  btnToggleEventos.style.display = "inline-flex";
  renderEventosAluno();
}

function renderEventosAluno() {
  if (!eventosAluno.length) {
    listaEventosAluno.innerHTML = `<p style="font-size:13px; color:#666;">Nenhum evento encontrado.</p>`;
    return;
  }

  listaEventosAluno.innerHTML = eventosAluno.map((evento) => {
    const situacao = evento.ativo ? "Ativo" : "Encerrado/Cancelado";

    return `
      <div class="item-evento-aluno" style="padding:10px 0; border-bottom:1px solid #e6dfcf;">
        <div class="item-evento-aluno-topo" style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <strong>${escaparHtml(evento.titulo || "Evento")}</strong>
          <span class="badge-evento-aluno">${escaparHtml(situacao)}</span>
        </div>

        <p style="margin:6px 0 4px 0; font-size:13px;">
          ${escaparHtml(evento.tipo_evento || "Evento")} •
          ${formatarDataBR(evento.data_evento)}
          ${evento.hora_evento ? ` às ${escaparHtml(evento.hora_evento.slice(0, 5))}` : ""}
        </p>

        <p style="margin:0; font-size:13px;">
          Link/local: ${escaparHtml(evento.local || "Não informado")}
        </p>
      </div>
    `;
  }).join("");
}

// ===============================
// CONTADORES + REPOSIÇÕES
// ===============================

function obterReposicoesPendentes(aulas) {
  const idsAulasOriginaisJaRepostas = new Set(
    (aulas || [])
      .filter((x) => normalizarTexto(x.status) === normalizarTexto(STATUS.REPOSICAO) && x.aula_original_id)
      .map((x) => Number(x.aula_original_id))
  );

  return (aulas || [])
    .filter((x) => {
      const status = normalizarTexto(x.status);
      const statusGeraReposicao =
        status === normalizarTexto(STATUS.AUSENTE) ||
        status === normalizarTexto(STATUS.CANCELADA) ||
        status === normalizarTexto(STATUS.TRANCADA);

      if (!statusGeraReposicao) return false;
      if (x.precisa_reposicao !== true) return false;
      if (idsAulasOriginaisJaRepostas.has(Number(x.id))) return false;

      return true;
    })
    .sort((a, b) => {
      const dataA = String(a.data_aula || "");
      const dataB = String(b.data_aula || "");

      if (dataA !== dataB) {
        return dataB.localeCompare(dataA);
      }

      return Number(b.id || 0) - Number(a.id || 0);
    });
}

function renderReposicoesPendentes() {
  limparLista(listaReposicoes);

  if (!reposicoesPendentesLista.length) {
    listaReposicoes.innerHTML = `<li>Nenhuma reposição pendente.</li>`;

    if (btnToggleReposicoes) {
      btnToggleReposicoes.style.display = "none";
    }

    return;
  }

  const reposicoesParaMostrar = reposicoesExpandido
    ? reposicoesPendentesLista
    : reposicoesPendentesLista.slice(0, 3);

  reposicoesParaMostrar.forEach((x) => {
    const li = document.createElement("li");
    li.style.marginBottom = "6px";

    const status = normalizarTexto(x.status);
    const textoPadrao =
      status === normalizarTexto(STATUS.CANCELADA)
        ? "Aula cancelada"
        : status === normalizarTexto(STATUS.TRANCADA)
          ? "Aula trancada"
          : "Reposição solicitada";

    li.textContent =
      `${formatarDataBR(x.data_aula)} — ${x.justificativa || textoPadrao}`;

    listaReposicoes.appendChild(li);
  });

  if (!btnToggleReposicoes) return;

  if (reposicoesPendentesLista.length <= 3) {
    btnToggleReposicoes.style.display = "none";
    return;
  }

  btnToggleReposicoes.style.display = "inline-flex";
  btnToggleReposicoes.textContent = reposicoesExpandido
    ? "Ver menos"
    : `Ver mais ${reposicoesPendentesLista.length - 3}`;
}

function preencherContadores(aulas) {
  let p = 0;
  let a = 0;
  let c = 0;
  let instrumental = 0;
  let plantao = 0;

  aulas.forEach((x) => {
    if (x.status === STATUS.PRESENTE) {
      p++;
      return;
    }

    if (x.status === STATUS.AUSENTE) {
      a++;
      return;
    }

    if (x.status === STATUS.CANCELADA) {
      c++;
      return;
    }

    if (x.status === STATUS.AULA_INSTRUMENTAL) {
      instrumental++;
      return;
    }

    if (x.status === STATUS.PLANTAO_DUVIDAS) {
      plantao++;
      return;
    }
  });

  reposicoesPendentesLista = obterReposicoesPendentes(aulas);
  renderReposicoesPendentes();

  cPresente.textContent = p;
  cAusente.textContent = a;
  cCancelada.textContent = c;
  cReposicao.textContent = reposicoesPendentesLista.length;
  cInstrumental.textContent = instrumental;
  cPlantao.textContent = plantao;
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
  atualizarCardAulasValidasEAvaliacao();
}

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
// EVENTOS
// ===============================

btnToggleEventos?.addEventListener("click", () => {
  const aberto = boxEventosAluno.style.display === "block";

  if (aberto) {
    boxEventosAluno.style.display = "none";
    btnToggleEventos.textContent = "Ver mais";
  } else {
    boxEventosAluno.style.display = "block";
    btnToggleEventos.textContent = "Ver menos";
  }
});

btnToggleReposicoes?.addEventListener("click", () => {
  reposicoesExpandido = !reposicoesExpandido;
  renderReposicoesPendentes();
});

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
// FILTROS DAS AULAS
// ===============================

filtroModuloAula?.addEventListener("change", () => {
  aulasExpandido = false;
  atualizarRenderAulas();
});

filtroStatusAula?.addEventListener("change", () => {
  aulasExpandido = false;
  atualizarRenderAulas();
});

btnExpandirAulas?.addEventListener("click", () => {
  aulasExpandido = !aulasExpandido;
  atualizarRenderAulas();
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

  if (!data || !tipo || Number.isNaN(valor) || !moduloId) {
    mostrarMensagem("Preencha todos os campos", false);
    return;
  }

  if (valor < 0 || valor > 10) {
    mostrarMensagem("A nota precisa estar entre 0 e 10.", false);
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

  await marcarAvaliacaoComoConcluidaAposNota(moduloId, tipo);

  mostrarMensagem("Nota salva!");

  formNota.reset();
  notaData.value = hojeISO();
  notaTipo.value = "Avaliação";

  await carregarNotas();
  await carregarAvaliacoesAluno();
});

// ===============================
// BOTÕES VOLTAR
// ===============================

btnVoltarTopo?.addEventListener("click", voltarParaResumo);
btnVoltarRodape?.addEventListener("click", voltarParaResumo);

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
  atualizarRenderAulas();
  atualizarCardAulasValidasEAvaliacao();

  await carregarAvaliacoesAluno();
  await carregarEventosAluno();
  await carregarNotas();
}

init();