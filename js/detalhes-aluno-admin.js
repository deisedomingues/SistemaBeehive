import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const matriculaId = localStorage.getItem("matriculaSelecionada");

// ===============================
// ELEMENTOS
// ===============================

const msg = document.getElementById("msg");

const tituloAluno = document.getElementById("tituloAluno");
const subtituloAluno = document.getElementById("subtituloAluno");

const listaAulas = document.getElementById("listaAulas");
const boxExpandirAulas = document.getElementById("boxExpandirAulas");
const btnExpandirAulas = document.getElementById("btnExpandirAulas");
const filtroModuloAula = document.getElementById("filtroModuloAula");

const cPresente = document.getElementById("cPresente");
const cAusente = document.getElementById("cAusente");
const cCancelada = document.getElementById("cCancelada");
const cTrancada = document.getElementById("cTrancada");

const listaNotas = document.getElementById("listaNotas");

const mediaGeral = document.getElementById("mediaGeral");
const totalNotas = document.getElementById("totalNotas");
const mediaPorModulo = document.getElementById("mediaPorModulo");

const pacoteSituacao = document.getElementById("pacoteSituacao");
const pacoteAulasUsadas = document.getElementById("pacoteAulasUsadas");
const pacoteAulasRestantes = document.getElementById("pacoteAulasRestantes");
const pacoteInicio = document.getElementById("pacoteInicio");
const pacoteAlerta = document.getElementById("pacoteAlerta");
const listaPacotesAluno = document.getElementById("listaPacotesAluno");
const boxAcoesPacote = document.getElementById("boxAcoesPacote");
const btnEncerrarPacote = document.getElementById("btnEncerrarPacote");
const btnVerAulasPacote = document.getElementById("btnVerAulasPacote");
const boxAulasPacote = document.getElementById("boxAulasPacote");
const listaAulasPacote = document.getElementById("listaAulasPacote");

// proteção
if (!matriculaId) {
  window.location.href = "resumo-geral.html";
}

// ===============================
// ESTADO
// ===============================

let todasAulas = [];
let aulasExpandido = false;
let aulasPacoteExpandido = false;
let dadosCabecalho = null;
let pacotesAluno = [];
let pacoteAtivoAtual = null;

// ===============================
// CONSTANTES
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
// MENSAGEM
// ===============================

function mostrarMensagem(texto, ok = true) {
  msg.textContent = texto;
  msg.style.display = "block";

  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";
  msg.style.padding = "10px 12px";
  msg.style.borderRadius = "10px";

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
  }, 2400);
}

// ===============================
// UTIL
// ===============================

function limparLista(ul) {
  if (!ul) return;
  ul.innerHTML = "";
}

function addLi(ul, texto) {
  const li = document.createElement("li");
  li.textContent = texto;
  ul.appendChild(li);
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
  const [yyyy, mm, dd] = dataISO.split("-");
  return `${dd}/${mm}/${yyyy}`;
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

function textoParte(parte) {
  if (!parte) return "Não informada";
  return `Parte ${parte}`;
}

function textoAulaGravada(aula) {
  if (aula.status === STATUS.AUSENTE) {
    return aula.aula_gravada ? "Sim" : "Não";
  }

  if (
    aula.status === STATUS.PRESENTE ||
    aula.status === STATUS.REPOSICAO ||
    aula.status === STATUS.AULA_INSTRUMENTAL ||
    aula.status === STATUS.PLANTAO_DUVIDAS
  ) {
    return aula.aula_gravada ? "Sim" : "Não";
  }

  if (aula.status === STATUS.CANCELADA) {
    return "Não";
  }

  return aula.aula_gravada ? "Sim" : "Não";
}

function obterTipoConsumoPacote(aula, idsAulasOriginaisJaContadas = new Set()) {
  const status = normalizarTexto(aula?.status);
  const gravada = aula?.aula_gravada === true;
  const precisaReposicao = aula?.precisa_reposicao === true;
  const temAulaOriginal = !!aula?.aula_original_id;

  if (status === "presente" && gravada) {
    return "Presença";
  }

  if (status === "ausente" && gravada) {
    return "Ausência com aula gravada";
  }

  if (status === "ausente" && !gravada && precisaReposicao) {
    return "Ausência sem aula gravada";
  }

  if ((status === "reposição" || status === "reposicao") && gravada) {
    if (!temAulaOriginal) {
      return "Reposição sem aula de origem vinculada";
    }

    const aulaOriginalId = Number(aula.aula_original_id);

    if (idsAulasOriginaisJaContadas.has(aulaOriginalId)) {
      return "";
    }

    return "Reposição";
  }

  return "";
}

function aulaConsomePacote(aula, idsAulasOriginaisJaContadas = new Set()) {
  return !!obterTipoConsumoPacote(aula, idsAulasOriginaisJaContadas);
}

function aulaContaParaAvaliacao(aula) {
  const status = normalizarTexto(aula?.status);
  const gravada = aula?.aula_gravada === true;

  if (status === "presente" && gravada) return true;
  if (status === "ausente" && gravada) return true;
  if ((status === "reposição" || status === "reposicao") && gravada) return true;

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

function obterAulasDoPeriodoDoPacote(pacote) {
  return todasAulas
    .filter((aula) => aulaDentroDoPeriodoDoPacote(aula, pacote))
    .sort((a, b) => {
      const dataA = String(a.data_aula || "");
      const dataB = String(b.data_aula || "");

      if (dataA !== dataB) {
        return dataA.localeCompare(dataB);
      }

      return Number(a.id || 0) - Number(b.id || 0);
    });
}

function obterIdsAulasOriginaisJaContadas(aulasDoPeriodo) {
  return new Set(
    (aulasDoPeriodo || [])
      .filter((aula) => {
        const status = normalizarTexto(aula.status);

        return (
          status === "ausente" &&
          aula.precisa_reposicao === true
        );
      })
      .map((aula) => Number(aula.id))
  );
}

function obterAulasConsumidasNoPacote(pacote) {
  const aulasDoPeriodo = obterAulasDoPeriodoDoPacote(pacote);
  const idsAulasOriginaisJaContadas = obterIdsAulasOriginaisJaContadas(aulasDoPeriodo);

  return aulasDoPeriodo.filter((aula) => {
    return aulaConsomePacote(aula, idsAulasOriginaisJaContadas);
  });
}

function contarAulasUsadasNoPacote(pacote) {
  return obterAulasConsumidasNoPacote(pacote).length;
}

// ===============================
// CABEÇALHO
// ===============================

async function carregarCabecalho() {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno_id,
      materia_id,
      modulo_id,
      professor_id,
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
      ),
      professor:professor_id (
        id,
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

  tituloAluno.textContent = data.aluno?.nome || "Aluno";
  subtituloAluno.textContent =
    `${data.materia?.nome || ""} — ${data.modulo?.nome || ""} — Prof(a). ${data.professor?.nome || ""}`;

  await carregarModulosDaMatricula(matriculaId);

  return data;
}

// ===============================
// FILTRO DE MÓDULO DAS AULAS
// ===============================

async function carregarModulosDaMatricula(matriculaId) {
  if (!filtroModuloAula) return;

  const { data, error } = await supabase
    .from("aula")
    .select(`
      modulo_id,
      modulo:modulo_id (
        nome
      )
    `)
    .eq("matricula_id", matriculaId)
    .not("modulo_id", "is", null);

  if (error) {
    console.error(error);
    return;
  }

  const mapa = new Map();

  (data || []).forEach((item) => {
    if (!item.modulo_id) return;

    if (!mapa.has(String(item.modulo_id))) {
      mapa.set(String(item.modulo_id), {
        id: item.modulo_id,
        nome: item.modulo?.nome || "Módulo"
      });
    }
  });

  filtroModuloAula.innerHTML = `<option value="">Todos</option>`;

  Array.from(mapa.values())
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .forEach((modulo) => {
      const option = document.createElement("option");
      option.value = String(modulo.id);
      option.textContent = modulo.nome;
      filtroModuloAula.appendChild(option);
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
      justificativa,
      conteudo,
      licao_casa,
      parte,
      aula_gravada,
      precisa_reposicao,
      aula_original_id,
      modulo_id,
      modulo:modulo_id (
        nome
      ),
      professor:professor_id (
        nome
      )
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

function preencherContadores(aulas) {
  let p = 0;
  let a = 0;
  let c = 0;

  aulas.forEach((x) => {
    if (x.status === STATUS.PRESENTE) p++;
    else if (x.status === STATUS.AUSENTE) a++;
    else if (x.status === STATUS.CANCELADA) c++;
  });

  cPresente.textContent = p;
  cAusente.textContent = a;
  cCancelada.textContent = c;
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
  const moduloSelecionado = filtroModuloAula?.value || "";

  if (!moduloSelecionado) {
    return [...todasAulas];
  }

  return todasAulas.filter(
    (aula) => String(aula.modulo_id || "") === String(moduloSelecionado)
  );
}

function renderAulas(aulasOriginais) {
  limparLista(listaAulas);

  if (aulasOriginais.length === 0) {
    addLi(listaAulas, "Nenhuma aula registrada.");
    atualizarBotaoExpandirAulas(0);
    return;
  }

  const aulasParaMostrar = aulasExpandido ? aulasOriginais : aulasOriginais.slice(0, 3);
  const totalAulasFiltradas = aulasOriginais.length;

  aulasParaMostrar.forEach((x, index) => {
    const li = document.createElement("li");
    li.style.listStyle = "none";
    li.style.marginBottom = "0";
    li.style.padding = "10px 0";
    li.style.borderBottom = "1px solid #e6dfcf";

    const numeroAula = totalAulasFiltradas - index;
    const dataBR = formatarDataBR(x.data_aula);
    const professor = x.professor?.nome || "Professor";
    const status = x.status || "-";
    const parte = textoParte(x.parte);
    const justificativa = x.justificativa?.trim() || "";
    const conteudo = x.conteudo?.trim() || "Sem conteúdo informado";
    const licao = x.licao_casa?.trim() || "Sem lição";
    const gravada = textoAulaGravada(x);
    const nomeModulo = x.modulo?.nome || "Sem módulo";

    const infosNormais = [
      `Prof(a). ${professor}`,
      `Módulo: ${nomeModulo}`,
      `Status: ${status}`,
      `Parte: ${parte}`
    ];

    if (justificativa) {
      infosNormais.push(`Justificativa: ${justificativa}`);
    }

    if (
      x.status === STATUS.PRESENTE ||
      x.status === STATUS.AUSENTE ||
      x.status === STATUS.REPOSICAO
    ) {
      infosNormais.push(`Aula gravada: ${gravada}`);
    }

    if (x.status === STATUS.AUSENTE && x.precisa_reposicao) {
      infosNormais.push("Reposição: pendente/solicitada");
    }

    if (aulaConsomePacote(x)) {
      infosNormais.push("Pode contar no pacote");
    }

    if (aulaContaParaAvaliacao(x)) {
      infosNormais.push("Conta para avaliação");
    }

    li.innerHTML = `
      <div class="item-historico-flex">
        <div class="item-historico-linha">
          <div class="item-historico-topo-compacto">
            ${escaparHtml(`Aula ${numeroAula}`)} • ${escaparHtml(dataBR)} - ${escaparHtml(conteudo)} - ${escaparHtml(licao)}
          </div>

          <div class="item-historico-detalhes">
            ${escaparHtml(infosNormais.join(" | "))}
          </div>
        </div>

        <div class="item-historico-acoes">
          <button
            type="button"
            data-aula-id="${x.id}"
            class="btn-excluir-aula-admin"
            title="Excluir aula"
          >
            ✖
          </button>
        </div>
      </div>
    `;

    listaAulas.appendChild(li);
  });

  atualizarBotaoExpandirAulas(aulasOriginais.length);

  document.querySelectorAll(".btn-excluir-aula-admin").forEach((btn) => {
    btn.onclick = async () => {
      const aulaId = Number(btn.dataset.aulaId);

      if (!confirm("Excluir esta aula?")) return;

      const { error } = await supabase
        .from("aula")
        .delete()
        .eq("id", aulaId);

      if (error) {
        console.error(error);
        mostrarMensagem("Erro ao excluir aula", false);
        return;
      }

      mostrarMensagem("Aula excluída");
      await init();
    };
  });
}

function atualizarRenderAulas() {
  const aulasFiltradas = obterAulasFiltradas();
  renderAulas(aulasFiltradas);
}

// ===============================
// PACOTES DE AULAS
// ===============================

async function carregarPacotesDoAluno(alunoId, materiaId) {
  if (!alunoId || !materiaId) {
    pacotesAluno = [];
    pacoteAtivoAtual = null;
    renderPacotesAluno();
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
    .eq("aluno_id", alunoId)
    .eq("materia_id", materiaId)
    .order("data_inicio", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error(error);
    mostrarMensagem("Erro ao carregar pacotes do aluno", false);
    pacotesAluno = [];
    pacoteAtivoAtual = null;
    renderPacotesAluno();
    return;
  }

  pacotesAluno = data || [];
  pacoteAtivoAtual = pacotesAluno.find((p) => p.status === "Ativo") || null;

  renderPacotesAluno();
}

function renderPacotesAluno() {
  if (!pacotesAluno.length) {
    pacoteSituacao.textContent = "Sem pacote ativo";
    pacoteSituacao.style.color = "#b71c1c";

    pacoteAulasUsadas.textContent = "-";
    pacoteAulasRestantes.textContent = "-";
    pacoteInicio.textContent = "-";

    pacoteAlerta.style.display = "block";
    pacoteAlerta.style.backgroundColor = "#ffebee";
    pacoteAlerta.style.color = "#b71c1c";
    pacoteAlerta.textContent =
      "Nenhum pacote foi cadastrado para este aluno neste curso.";

    boxAcoesPacote.style.display = "none";
    esconderAulasDoPacote();

    listaPacotesAluno.innerHTML =
      `<p style="font-size:13px; opacity:0.85;">Nenhum pacote cadastrado ainda.</p>`;

    return;
  }

  if (!pacoteAtivoAtual) {
    pacoteSituacao.textContent = "Sem pacote ativo";
    pacoteSituacao.style.color = "#b71c1c";

    pacoteAulasUsadas.textContent = "-";
    pacoteAulasRestantes.textContent = "-";
    pacoteInicio.textContent = "-";

    pacoteAlerta.style.display = "block";
    pacoteAlerta.style.backgroundColor = "#fff4cc";
    pacoteAlerta.style.color = "#7a4b00";
    pacoteAlerta.textContent =
      "Este aluno possui histórico de pacotes, mas nenhum pacote ativo para este curso.";

    boxAcoesPacote.style.display = "none";
    esconderAulasDoPacote();
  } else {
    const usadas = contarAulasUsadasNoPacote(pacoteAtivoAtual);
    const total = Number(pacoteAtivoAtual.quantidade_aulas || 36);
    const restantes = Math.max(0, total - usadas);

    pacoteAulasUsadas.textContent = `${usadas} / ${total}`;
    pacoteAulasRestantes.textContent = String(restantes);
    pacoteInicio.textContent = formatarDataBR(pacoteAtivoAtual.data_inicio);

    boxAcoesPacote.style.display = "flex";

    if (usadas >= total) {
      pacoteSituacao.textContent = "Renovação necessária";
      pacoteSituacao.style.color = "#b71c1c";

      pacoteAlerta.style.display = "block";
      pacoteAlerta.style.backgroundColor = "#ffebee";
      pacoteAlerta.style.color = "#b71c1c";
      pacoteAlerta.textContent =
        "O pacote atingiu a quantidade de aulas contratadas. Verifique a renovação com o aluno.";
    } else if (restantes <= 3) {
      pacoteSituacao.textContent = "Próximo da renovação";
      pacoteSituacao.style.color = "#7a4b00";

      pacoteAlerta.style.display = "block";
      pacoteAlerta.style.backgroundColor = "#fff4cc";
      pacoteAlerta.style.color = "#7a4b00";
      pacoteAlerta.textContent =
        `Atenção: faltam apenas ${restantes} aula(s) para acabar o pacote.`;
    } else {
      pacoteSituacao.textContent = "Em andamento";
      pacoteSituacao.style.color = "#1b5e20";

      pacoteAlerta.style.display = "block";
      pacoteAlerta.style.backgroundColor = "#e8f5e9";
      pacoteAlerta.style.color = "#1b5e20";
      pacoteAlerta.textContent =
        `Pacote ativo em andamento. Ainda restam ${restantes} aula(s).`;
    }

    if (aulasPacoteExpandido) {
      renderAulasDoPacote();
    }
  }

  renderHistoricoPacotes();
}

function renderHistoricoPacotes() {
  if (!pacotesAluno.length) {
    listaPacotesAluno.innerHTML =
      `<p style="font-size:13px; opacity:0.85;">Nenhum pacote cadastrado ainda.</p>`;
    return;
  }

  listaPacotesAluno.innerHTML = pacotesAluno.map((pacote) => {
    const usadas = contarAulasUsadasNoPacote(pacote);
    const total = Number(pacote.quantidade_aulas || 36);
    const restantes = Math.max(0, total - usadas);

    const statusCor =
      pacote.status === "Ativo"
        ? "#1b5e20"
        : pacote.status === "Encerrado"
          ? "#555"
          : "#b71c1c";

    return `
      <div style="padding:10px 0; border-bottom:1px solid #e6dfcf;">
        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <strong>
            ${escaparHtml(pacote.status === "Ativo" ? "Pacote ativo" : "Pacote")}
          </strong>

          <span style="font-size:12px; font-weight:700; color:${statusCor};">
            ${escaparHtml(pacote.status || "-")}
          </span>
        </div>

        <div style="font-size:13px; margin-top:4px;">
          Aulas usadas: <b>${usadas} / ${total}</b>
          ${
            pacote.status === "Ativo"
              ? ` • Restantes: <b>${restantes}</b>`
              : ""
          }
        </div>

        <div style="font-size:12px; opacity:0.85; margin-top:4px;">
          Início: ${formatarDataBR(pacote.data_inicio)}
          ${
            pacote.data_fim
              ? ` • Fim: ${formatarDataBR(pacote.data_fim)}`
              : " • Fim: em aberto"
          }
        </div>

        ${
          pacote.observacao
            ? `<div style="font-size:12px; opacity:0.85; margin-top:4px;">
                Obs: ${escaparHtml(pacote.observacao)}
              </div>`
            : ""
        }
      </div>
    `;
  }).join("");
}

function esconderAulasDoPacote() {
  aulasPacoteExpandido = false;

  if (boxAulasPacote) {
    boxAulasPacote.style.display = "none";
  }

  if (btnVerAulasPacote) {
    btnVerAulasPacote.textContent = "Ver aulas do pacote";
  }

  if (listaAulasPacote) {
    listaAulasPacote.innerHTML = "";
  }
}

function alternarAulasDoPacote() {
  if (!pacoteAtivoAtual) {
    mostrarMensagem("Não há pacote ativo para listar aulas.", false);
    return;
  }

  aulasPacoteExpandido = !aulasPacoteExpandido;

  if (aulasPacoteExpandido) {
    renderAulasDoPacote();
    btnVerAulasPacote.textContent = "Ocultar aulas do pacote";
    boxAulasPacote.style.display = "block";
  } else {
    esconderAulasDoPacote();
  }
}

function renderAulasDoPacote() {
  if (!pacoteAtivoAtual || !listaAulasPacote) return;

  const aulasConsumidas = obterAulasConsumidasNoPacote(pacoteAtivoAtual);
  const aulasDoPeriodo = obterAulasDoPeriodoDoPacote(pacoteAtivoAtual);
  const idsAulasOriginaisJaContadas = obterIdsAulasOriginaisJaContadas(aulasDoPeriodo);

  if (!aulasConsumidas.length) {
    listaAulasPacote.innerHTML =
      `<p style="font-size:13px; opacity:0.85;">Nenhuma aula consumida neste pacote ainda.</p>`;
    return;
  }

  listaAulasPacote.innerHTML = aulasConsumidas.map((aula, index) => {
    const tipoConsumo = obterTipoConsumoPacote(aula, idsAulasOriginaisJaContadas);
    const dataBR = formatarDataBR(aula.data_aula);
    const modulo = aula.modulo?.nome || "Sem módulo";
    const professor = aula.professor?.nome || "Professor";
    const conteudo = aula.conteudo?.trim() || "Sem conteúdo informado";
    const status = aula.status || "-";
    const parte = textoParte(aula.parte);

    return `
      <div style="padding:10px 0; border-bottom:1px solid #e6dfcf;">
        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <strong>${index + 1}. ${escaparHtml(dataBR)} — ${escaparHtml(status)}</strong>
          <span style="font-size:12px; font-weight:700;">
            ${escaparHtml(tipoConsumo)}
          </span>
        </div>

        <div style="font-size:13px; margin-top:4px;">
          ${escaparHtml(modulo)} • ${escaparHtml(parte)} • Prof(a). ${escaparHtml(professor)}
        </div>

        <div style="font-size:12px; opacity:0.85; margin-top:4px;">
          Conteúdo: ${escaparHtml(conteudo)}
        </div>

        ${
          aula.aula_original_id
            ? `<div style="font-size:12px; opacity:0.85; margin-top:4px;">
                Reposição vinculada à aula de origem ID ${Number(aula.aula_original_id)}
              </div>`
            : ""
        }
      </div>
    `;
  }).join("");
}

async function encerrarPacoteAtivo() {
  if (!pacoteAtivoAtual) {
    mostrarMensagem("Não há pacote ativo para encerrar.", false);
    return;
  }

  const confirmar = confirm(
    "Encerrar o pacote ativo deste aluno? Depois disso, será possível cadastrar uma renovação."
  );

  if (!confirmar) return;

  const { error } = await supabase
    .from("pacote_aulas")
    .update({
      status: "Encerrado",
      data_fim: hojeISO()
    })
    .eq("id", pacoteAtivoAtual.id);

  if (error) {
    console.error(error);
    mostrarMensagem("Erro ao encerrar pacote.", false);
    return;
  }

  mostrarMensagem("Pacote encerrado com sucesso!");

  esconderAulasDoPacote();

  await carregarPacotesDoAluno(
    dadosCabecalho?.aluno_id,
    dadosCabecalho?.materia_id
  );
}

// ===============================
// EVENTOS PARTICIPADOS
// ===============================

async function carregarQuantidadeEventosParticipados(alunoId) {
  if (!alunoId) {
    cTrancada.textContent = "0";
    return;
  }

  const { data, error } = await supabase
    .from("evento_confirmacao")
    .select("evento_id")
    .eq("aluno_id", alunoId);

  if (error) {
    console.error(error);
    cTrancada.textContent = "0";
    return;
  }

  const eventosUnicos = new Set((data || []).map((item) => item.evento_id));
  cTrancada.textContent = String(eventosUnicos.size);
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
      modulo:modulo_id (
        nome
      )
    `)
    .eq("matricula_id", matriculaId)
    .order("data", { ascending: false });

  if (error) {
    console.error(error);
    mostrarMensagem("Erro ao carregar notas", false);
    return [];
  }

  return data || [];
}

function renderNotas(notas) {
  limparLista(listaNotas);

  if (notas.length === 0) {
    addLi(listaNotas, "Nenhuma nota registrada.");
    return;
  }

  notas.forEach((n) => {
    const li = document.createElement("li");

    const dataBR = formatarDataBR(n.data);
    const modulo = n.modulo?.nome || "Sem módulo";
    const obs = n.observacao ? ` — ${n.observacao}` : "";

    const texto = `${dataBR} — ${n.tipo} — ${modulo} — ${n.valor}${obs}`;

    const span = document.createElement("span");
    span.textContent = texto;

    const btnExcluir = document.createElement("button");
    btnExcluir.textContent = "🗑";
    btnExcluir.style.marginLeft = "10px";
    btnExcluir.style.cursor = "pointer";

    btnExcluir.onclick = async () => {
      if (!confirm("Excluir esta nota?")) return;

      const { error } = await supabase
        .from("nota")
        .delete()
        .eq("id", n.id);

      if (error) {
        console.error(error);
        mostrarMensagem("Erro ao excluir nota", false);
        return;
      }

      mostrarMensagem("Nota excluída");
      await init();
    };

    li.appendChild(span);
    li.appendChild(btnExcluir);

    listaNotas.appendChild(li);
  });
}

// ===============================
// MÉDIAS
// ===============================

function calcularMedias(notas) {
  if (notas.length === 0) {
    mediaGeral.textContent = "-";
    totalNotas.textContent = "0";
    mediaPorModulo.textContent = "Nenhuma média";
    return;
  }

  let soma = 0;

  notas.forEach((n) => {
    soma += Number(n.valor) || 0;
  });

  const media = soma / notas.length;

  mediaGeral.textContent = media.toFixed(2);
  totalNotas.textContent = notas.length;

  const modulos = {};

  notas.forEach((n) => {
    const nome = n.modulo?.nome || "Sem módulo";

    if (!modulos[nome]) {
      modulos[nome] = [];
    }

    modulos[nome].push(Number(n.valor) || 0);
  });

  mediaPorModulo.innerHTML = "";

  Object.keys(modulos).forEach((m) => {
    const lista = modulos[m];

    let somaModulo = 0;

    lista.forEach((v) => {
      somaModulo += v;
    });

    const mediaModulo = somaModulo / lista.length;

    const p = document.createElement("p");
    p.textContent = `${m}: ${mediaModulo.toFixed(2)} (${lista.length} avaliações)`;

    mediaPorModulo.appendChild(p);
  });
}

// ===============================
// INIT
// ===============================

async function init() {
  const cabecalho = await carregarCabecalho();
  if (!cabecalho) return;

  todasAulas = await carregarAulas();

  preencherContadores(todasAulas);
  atualizarRenderAulas();

  await carregarPacotesDoAluno(cabecalho.aluno_id, cabecalho.materia_id);

  await carregarQuantidadeEventosParticipados(cabecalho.aluno_id);

  const notas = await carregarNotas();
  renderNotas(notas);
  calcularMedias(notas);
}

// ===============================
// EVENTOS DA INTERFACE
// ===============================

btnExpandirAulas?.addEventListener("click", () => {
  aulasExpandido = !aulasExpandido;
  atualizarRenderAulas();
});

filtroModuloAula?.addEventListener("change", () => {
  aulasExpandido = false;
  atualizarRenderAulas();
});

btnEncerrarPacote?.addEventListener("click", encerrarPacoteAtivo);

btnVerAulasPacote?.addEventListener("click", alternarAulasDoPacote);

init();