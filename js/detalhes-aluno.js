import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

const professorId = localStorage.getItem("professorId");
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

const listaAulas = document.getElementById("listaAulas");
const listaReposicoes = document.getElementById("listaReposicoes");

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

// ===============================
// ESTADO
// ===============================

let todasNotas = [];
let todasAulas = [];
let eventosAluno = [];
let dadosCabecalho = null;

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
// FUNÇÕES AUXILIARES
// ===============================

function mostrarMensagem(texto, ok = true) {
  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";

  setTimeout(() => {
    msg.style.display = "none";
  }, 2200);
}

function limparLista(el) {
  if (!el) return;
  el.innerHTML = "";
}

function formatarDataBR(dataISO) {
  if (!dataISO) return "-";
  const [yyyy, mm, dd] = dataISO.split("-");
  return `${dd}/${mm}/${yyyy}`;
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
  return String(valor || "").trim().toLowerCase();
}

function obterClasseStatus(status) {
  if (status === STATUS.PRESENTE) return "status-presente";
  if (status === STATUS.AUSENTE) return "status-ausente";
  if (status === STATUS.CANCELADA) return "status-cancelada";
  if (status === STATUS.REPOSICAO) return "status-reposicao";
  if (status === STATUS.AULA_INSTRUMENTAL) return "status-instrumental";
  if (status === STATUS.PLANTAO_DUVIDAS) return "status-plantao";
  return "";
}

function ehAniversarioHoje(dataNascimento) {
  if (!dataNascimento) return false;

  const hoje = new Date();
  const [ano, mes, dia] = dataNascimento.split("-").map(Number);

  return hoje.getMonth() + 1 === mes && hoje.getDate() === dia;
}

function obterTextoStatusExtra(aula) {
  if (aula.status === STATUS.AUSENTE && aula.aula_gravada) {
    return "Ausência com aula gravada";
  }

  if (aula.status === STATUS.AUSENTE && aula.precisa_reposicao) {
    return "Ausência com reposição pendente";
  }

  if (aula.status === STATUS.CANCELADA) {
    return "Cancelada pela escola";
  }

  if (aula.status === STATUS.REPOSICAO) {
    return "Reposição realizada";
  }

  if (aula.status === STATUS.AULA_INSTRUMENTAL) {
    return "Benefício extra do aluno";
  }

  if (aula.status === STATUS.PLANTAO_DUVIDAS) {
    return "Atendimento de dúvidas";
  }

  return "";
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
    return "Sim";
  }

  if (aula.status === STATUS.CANCELADA) {
    return "Não";
  }

  return aula.aula_gravada ? "Sim" : "Não";
}

if (!matriculaId) {
  window.location.href = "resumo-professor.html";
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
    .order("data_aula", { ascending: false });

  if (error) {
    console.error(error);
    mostrarMensagem("Erro ao carregar aulas", false);
    return [];
  }

  return data || [];
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
      <div class="item-evento-aluno">
        <div class="item-evento-aluno-topo">
          <strong>${escaparHtml(evento.titulo || "Evento")}</strong>
          <span class="badge-evento-aluno">${escaparHtml(situacao)}</span>
        </div>

        <p>
          ${escaparHtml(evento.tipo_evento || "Evento")} •
          ${formatarDataBR(evento.data_evento)}
          ${evento.hora_evento ? ` às ${escaparHtml(evento.hora_evento.slice(0, 5))}` : ""}
        </p>

        <p>
          Link/local: ${escaparHtml(evento.local || "Não informado")}
        </p>
      </div>
    `;
  }).join("");
}

// ===============================
// CONTADORES + REPOSIÇÕES
// ===============================

function preencherContadores(aulas) {
  let p = 0;
  let a = 0;
  let c = 0;
  let reposicoesPendentes = 0;
  let instrumental = 0;
  let plantao = 0;

  limparLista(listaReposicoes);

  const idsAulasOriginaisJaRepostas = new Set(
    (aulas || [])
      .filter((x) => x.status === STATUS.REPOSICAO && x.aula_original_id)
      .map((x) => Number(x.aula_original_id))
  );

  aulas.forEach((x) => {
    if (x.status === STATUS.PRESENTE) {
      p++;
      return;
    }

    if (x.status === STATUS.AUSENTE) {
      a++;

      const estaPendente =
        x.precisa_reposicao === true &&
        !idsAulasOriginaisJaRepostas.has(Number(x.id));

      if (estaPendente) {
        reposicoesPendentes++;

        const li = document.createElement("li");
        li.textContent =
          `${formatarDataBR(x.data_aula)} — ${x.justificativa || "Reposição solicitada"}`;

        listaReposicoes.appendChild(li);
      }

      return;
    }

    if (x.status === STATUS.CANCELADA) {
      c++;

      const estaPendente =
        x.precisa_reposicao === true &&
        !idsAulasOriginaisJaRepostas.has(Number(x.id));

      if (estaPendente) {
        reposicoesPendentes++;

        const li = document.createElement("li");
        li.textContent =
          `${formatarDataBR(x.data_aula)} — ${x.justificativa || "Aula cancelada"}`;

        listaReposicoes.appendChild(li);
      }

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

  if (!listaReposicoes.innerHTML.trim()) {
    listaReposicoes.innerHTML = `<li>Nenhuma reposição pendente.</li>`;
  }

  cPresente.textContent = p;
  cAusente.textContent = a;
  cCancelada.textContent = c;
  cReposicao.textContent = reposicoesPendentes;
  cInstrumental.textContent = instrumental;
  cPlantao.textContent = plantao;
}

// ===============================
// RENDER AULAS
// ===============================

function renderAulas(aulas) {
  limparLista(listaAulas);

  if (!aulas.length) {
    listaAulas.innerHTML = `<div class="vazio-box">Nenhuma aula encontrada com os filtros selecionados.</div>`;
    return;
  }

  aulas.forEach((aula) => {
    const dataBR = formatarDataBR(aula.data_aula);
    const conteudo = aula.conteudo?.trim() || "Sem conteúdo informado";
    const licao = aula.licao_casa?.trim() || "Sem lição";
    const professor = aula.professor?.nome || "-";
    const status = aula.status || "-";
    const parte = textoParte(aula.parte);
    const justificativa = aula.justificativa?.trim() || "";
    const gravada = textoAulaGravada(aula);
    const observacaoStatus = obterTextoStatusExtra(aula);

    const infosNormais = [
      `Prof(a). ${professor}`,
      `Status: ${status}`,
      `Parte: ${parte}`
    ];

    if (justificativa) {
      infosNormais.push(`Justificativa: ${justificativa}`);
    }

    if (aula.status === STATUS.AUSENTE) {
      infosNormais.push(`Aula gravada: ${gravada}`);
    }

    if (aula.status === STATUS.AUSENTE && aula.precisa_reposicao) {
      infosNormais.push("Reposição: pendente/solicitada");
    }

    if (observacaoStatus) {
      infosNormais.push(observacaoStatus);
    }

    const html = `
      <article class="item-historico" style="border-bottom:1px solid #e6dfcf; padding:10px 0; margin:0;">
        <div style="font-size:14px; line-height:1.5;">
          <div style="font-weight:700; color:#2b2b2b; margin-bottom:4px; word-break:break-word;">
            ${escaparHtml(dataBR)} - ${escaparHtml(conteudo)} - ${escaparHtml(licao)}
          </div>

          <div style="color:#5f5a50; font-size:13px; word-break:break-word;">
            ${escaparHtml(infosNormais.join(" | "))}
          </div>
        </div>
      </article>
    `;

    listaAulas.insertAdjacentHTML("beforeend", html);
  });
}

// ===============================
// FILTRO DAS AULAS
// ===============================

function aplicarFiltroAulas() {
  const moduloId = Number(filtroModuloAula.value);
  const status = filtroStatusAula.value;

  let filtradas = [...todasAulas];

  if (moduloId) {
    filtradas = filtradas.filter(
      (aula) => Number(aula.modulo_id) === moduloId
    );
  }

  if (status) {
    filtradas = filtradas.filter(
      (aula) => normalizarTexto(aula.status) === normalizarTexto(status)
    );
  }

  renderAulas(filtradas);
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

filtroModuloAula?.addEventListener("change", aplicarFiltroAulas);
filtroStatusAula?.addEventListener("change", aplicarFiltroAulas);

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

  if (!data || !tipo || !valor || !moduloId) {
    mostrarMensagem("Preencha todos os campos", false);
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

  mostrarMensagem("Nota salva!");

  formNota.reset();
  notaData.value = hojeISO();
  notaTipo.value = "Avaliação";

  await carregarNotas();
});

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
  renderAulas(todasAulas);

  await carregarEventosAluno();
  await carregarNotas();
}

init();