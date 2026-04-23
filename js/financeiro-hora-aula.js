import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

// ======================
// Elementos da tela
// ======================
const msg = document.getElementById("msg");

const filtroProfessor = document.getElementById("filtroProfessor");
const filtroDia = document.getElementById("filtroDia");
const filtroMes = document.getElementById("filtroMes");
const filtroAno = document.getElementById("filtroAno");

const btnBuscar = document.getElementById("btnBuscar");

const listaAulas = document.getElementById("listaAulas");

const resumoQtdAulas = document.getElementById("resumoQtdAulas");
const resumoSegundos = document.getElementById("resumoMinutos");
const resumoValor = document.getElementById("resumoValor");

// ======================
// Estado
// ======================
let professoresCache = [];
let valoresHoraProfessor = [];
let itensFinanceiroCache = [];

// ======================
// Helpers UI
// ======================
function mostrarMensagem(texto, ok = true) {
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
  }, 3200);
}

function formatarData(dataIso) {
  if (!dataIso) return "-";
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatarParte(parte) {
  return `Parte ${Number(parte || 1)}`;
}

function preencherDias() {
  filtroDia.innerHTML = `<option value="">Todos os dias</option>`;
  for (let i = 1; i <= 31; i++) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = String(i);
    filtroDia.appendChild(option);
  }
}

function preencherAnos() {
  filtroAno.innerHTML = `<option value="">Todos os anos</option>`;
  const anoAtual = new Date().getFullYear();

  for (let ano = anoAtual + 1; ano >= 2024; ano--) {
    const option = document.createElement("option");
    option.value = String(ano);
    option.textContent = String(ano);
    filtroAno.appendChild(option);
  }
}

// ======================
// Tempo / duração
// ======================
function somenteDigitos(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function formatarTempoDigitado(digitos) {
  const limpo = somenteDigitos(digitos);

  if (!limpo) return "";

  if (limpo.length <= 2) {
    return limpo;
  }

  if (limpo.length <= 4) {
    const minutos = limpo.slice(0, -2);
    const segundos = limpo.slice(-2).padStart(2, "0");
    return `${Number(minutos)}:${segundos}`;
  }

  const segundos = limpo.slice(-2);
  const minutos = limpo.slice(-4, -2).padStart(2, "0");
  const horas = limpo.slice(0, -4);
  return `${Number(horas)}:${minutos}:${segundos}`;
}

function converterTempoDigitadoParaSegundos(valorDigitado) {
  const limpo = somenteDigitos(valorDigitado);
  if (!limpo) return null;

  if (limpo.length <= 2) {
    // interpreta como minutos inteiros
    return Number(limpo) * 60;
  }

  if (limpo.length <= 4) {
    // mmss
    const minutos = Number(limpo.slice(0, -2) || 0);
    const segundos = Number(limpo.slice(-2) || 0);
    return (minutos * 60) + segundos;
  }

  // hhm mss / h:mm:ss
  const segundos = Number(limpo.slice(-2) || 0);
  const minutos = Number(limpo.slice(-4, -2) || 0);
  const horas = Number(limpo.slice(0, -4) || 0);
  return (horas * 3600) + (minutos * 60) + segundos;
}

function formatarSegundosParaCampo(valorSegundos) {
  if (valorSegundos === null || valorSegundos === undefined || valorSegundos === "") {
    return "";
  }

  const total = Number(valorSegundos);
  if (Number.isNaN(total)) return "";

  const horas = Math.floor(total / 3600);
  const resto = total % 3600;
  const minutos = Math.floor(resto / 60);
  const segundos = resto % 60;

  if (horas > 0) {
    return `${horas}:${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
  }

  return `${minutos}:${String(segundos).padStart(2, "0")}`;
}

function formatarSegundosResumo(totalSegundos) {
  const total = Number(totalSegundos || 0);

  const horas = Math.floor(total / 3600);
  const resto = total % 3600;
  const minutos = Math.floor(resto / 60);
  const segundos = resto % 60;

  if (horas > 0) {
    return `${horas}h ${String(minutos).padStart(2, "0")}min ${String(segundos).padStart(2, "0")}s`;
  }

  return `${minutos}min ${String(segundos).padStart(2, "0")}s`;
}

function normalizarDuracaoSegundos(valor) {
  if (valor === "" || valor === null || valor === undefined) return null;

  const numero = Number(valor);
  if (Number.isNaN(numero)) return null;

  return numero;
}

// ======================
// Regras de cálculo
// ======================
function obterValorHoraDaMateria(materiaId) {
  const registro = valoresHoraProfessor.find(
    (item) => Number(item.materia_id) === Number(materiaId)
  );
  return Number(registro?.valor_hora || 0);
}

function calcularValorItem(item) {
  const segundos = Number(item.duracao_segundos || 0);
  if (!segundos) return 0;

  let valorHora = Number(item.valor_hora || 0);

  if (item.aula_coletiva) {
    valorHora = valorHora * 1.5;
  }

  return (valorHora / 3600) * segundos;
}

function obterEstadoMinutagem(item) {
  const salvo = normalizarDuracaoSegundos(item.duracao_segundos_salva);
  const atual = normalizarDuracaoSegundos(item.duracao_segundos);

  if (salvo === null) {
    return {
      texto: "Sem minutagem",
      fundo: "#ffebee",
      cor: "#b71c1c",
      borda: "#ef9a9a"
    };
  }

  if (atual !== salvo) {
    return {
      texto: "Alteração não salva",
      fundo: "#fff8e1",
      cor: "#8a5a00",
      borda: "#f1d98a"
    };
  }

  return {
    texto: "Minutagem salva",
    fundo: "#e8f5e9",
    cor: "#1b5e20",
    borda: "#81c784"
  };
}

// ======================
// Resumo
// ======================
function atualizarResumo() {
  const qtd = itensFinanceiroCache.length;

  const totalSegundos = itensFinanceiroCache.reduce((acc, item) => {
    return acc + Number(item.duracao_segundos || 0);
  }, 0);

  const totalValor = itensFinanceiroCache.reduce((acc, item) => {
    return acc + calcularValorItem(item);
  }, 0);

  resumoQtdAulas.textContent = String(qtd);
  resumoSegundos.textContent = formatarSegundosResumo(totalSegundos);
  resumoValor.textContent = formatarMoeda(totalValor);
}

// ======================
// Filtros
// ======================
function aplicarFiltrosLocais(aulas) {
  const dia = filtroDia.value;
  const mes = filtroMes.value;
  const ano = filtroAno.value;

  return aulas.filter((aula) => {
    if (!aula.data_aula) return false;

    const [a, m, d] = aula.data_aula.split("-");

    if (dia && Number(d) !== Number(dia)) return false;
    if (mes && Number(m) !== Number(mes)) return false;
    if (ano && Number(a) !== Number(ano)) return false;

    return true;
  });
}

function ordenarNomes(lista) {
  return [...lista].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" })
  );
}

// ======================
// Agrupamento
// ======================
function agruparAulasParaFinanceiro(aulas) {
  const grupos = new Map();

  for (const aula of aulas) {
    const materiaId = aula?.matricula?.materia_id || null;
    const valorHoraBase = obterValorHoraDaMateria(materiaId);
    const nomeAluno = aula?.matricula?.aluno?.nome || "Aluno não identificado";
    const materiaNome = aula?.matricula?.materia?.nome || "Matéria não identificada";

    const ehColetiva = Boolean(aula.aula_coletiva) && aula.grupo_aula_id;

    if (ehColetiva) {
      const chave = `grupo_${aula.grupo_aula_id}`;

      if (!grupos.has(chave)) {
        grupos.set(chave, {
          tipo: "coletiva",
          chave,
          grupo_aula_id: aula.grupo_aula_id,
          aula_coletiva: true,
          ids_aula: [Number(aula.id)],
          data_aula: aula.data_aula,
          status: aula.status,
          conteudo: aula.conteudo || "",
          parte: aula.parte || 1,
          materia_id: materiaId,
          materia_nome: materiaNome,
          alunos: [nomeAluno],
          quantidade_alunos: Number(aula.quantidade_alunos || 0),
          duracao_segundos: aula.duracao_segundos ?? "",
          duracao_segundos_salva: aula.duracao_segundos ?? null,
          duracao_input: formatarSegundosParaCampo(aula.duracao_segundos),
          valor_hora: valorHoraBase
        });
      } else {
        const grupo = grupos.get(chave);
        grupo.ids_aula.push(Number(aula.id));

        if (!grupo.alunos.includes(nomeAluno)) {
          grupo.alunos.push(nomeAluno);
        }

        if (!grupo.quantidade_alunos && aula.quantidade_alunos) {
          grupo.quantidade_alunos = Number(aula.quantidade_alunos);
        }

        if (
          (grupo.duracao_segundos === "" || grupo.duracao_segundos == null) &&
          aula.duracao_segundos != null
        ) {
          grupo.duracao_segundos = aula.duracao_segundos;
          grupo.duracao_input = formatarSegundosParaCampo(aula.duracao_segundos);
        }

        if (
          (grupo.duracao_segundos_salva === "" || grupo.duracao_segundos_salva == null) &&
          aula.duracao_segundos != null
        ) {
          grupo.duracao_segundos_salva = aula.duracao_segundos;
        }
      }
    } else {
      const chave = `aula_${aula.id}`;

      grupos.set(chave, {
        tipo: "individual",
        chave,
        grupo_aula_id: null,
        aula_coletiva: false,
        ids_aula: [Number(aula.id)],
        data_aula: aula.data_aula,
        status: aula.status,
        conteudo: aula.conteudo || "",
        parte: aula.parte || 1,
        materia_id: materiaId,
        materia_nome: materiaNome,
        alunos: [nomeAluno],
        quantidade_alunos: 1,
        duracao_segundos: aula.duracao_segundos ?? "",
        duracao_segundos_salva: aula.duracao_segundos ?? null,
        duracao_input: formatarSegundosParaCampo(aula.duracao_segundos),
        valor_hora: valorHoraBase
      });
    }
  }

  const itens = [...grupos.values()].map((item) => ({
    ...item,
    alunos: ordenarNomes(item.alunos)
  }));

  return itens.sort((a, b) => {
    const dataA = `${a.data_aula || ""}-${String(a.parte || 1).padStart(2, "0")}`;
    const dataB = `${b.data_aula || ""}-${String(b.parte || 1).padStart(2, "0")}`;
    return dataB.localeCompare(dataA);
  });
}

// ======================
// Render
// ======================
function montarHtmlAlunos(alunos) {
  return `
    <ul style="margin:6px 0 0 18px; padding:0; line-height:1.55;">
      ${alunos.map((nome) => `<li style="margin-bottom:4px;"><strong style="font-size:15px;">${nome}</strong></li>`).join("")}
    </ul>
  `;
}

function renderItensFinanceiro() {
  listaAulas.innerHTML = "";

  if (!itensFinanceiroCache.length) {
    listaAulas.innerHTML = `
      <div style="opacity:0.8; font-size:13px;">Nenhuma aula encontrada para este filtro.</div>
    `;
    atualizarResumo();
    return;
  }

  itensFinanceiroCache.forEach((item) => {
    const estadoMinutagem = obterEstadoMinutagem(item);

    const card = document.createElement("div");
    card.style.border = item.aula_coletiva ? "1px solid #f1d98a" : "1px solid #eee";
    card.style.borderRadius = "12px";
    card.style.padding = "14px";
    card.style.marginBottom = "14px";
    card.style.background = item.aula_coletiva ? "#fff8e8" : "#fffdf8";

    const titulo = document.createElement("div");
    titulo.style.display = "flex";
    titulo.style.justifyContent = "space-between";
    titulo.style.alignItems = "flex-start";
    titulo.style.gap = "10px";
    titulo.style.flexWrap = "wrap";
    titulo.style.marginBottom = "12px";

    const tipoTexto = item.aula_coletiva ? "Aula coletiva" : "Aula individual";

    titulo.innerHTML = `
      <div>
        <div style="margin-bottom:4px;">
          <strong>${formatarData(item.data_aula)}</strong>
          <span style="font-weight:400;"> — ${tipoTexto}</span>
        </div>
      </div>

      <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
        <span style="
          font-size:12px;
          padding:4px 8px;
          border-radius:999px;
          background:#fff2c4;
          color:#6b5200;
          white-space:nowrap;
        ">
          ${item.materia_nome}
        </span>

        <span style="
          font-size:12px;
          padding:4px 8px;
          border-radius:999px;
          background:${estadoMinutagem.fundo};
          color:${estadoMinutagem.cor};
          border:1px solid ${estadoMinutagem.borda};
          font-weight:700;
          white-space:nowrap;
        ">
          ${estadoMinutagem.texto}
        </span>
      </div>
    `;
    card.appendChild(titulo);

    const blocoAlunos = document.createElement("div");
    blocoAlunos.style.marginBottom = "12px";
    blocoAlunos.innerHTML = montarHtmlAlunos(item.alunos);
    card.appendChild(blocoAlunos);

    const linhaInfo = document.createElement("div");
    linhaInfo.style.display = "flex";
    linhaInfo.style.flexWrap = "wrap";
    linhaInfo.style.gap = "16px";
    linhaInfo.style.marginBottom = "10px";
    linhaInfo.style.fontSize = "13px";

    linhaInfo.innerHTML = `
      <span><strong>Status:</strong> ${item.status || "-"}</span>
      <span><strong>${formatarParte(item.parte)}</strong></span>
      <span><strong>Qtd. alunos:</strong> ${item.quantidade_alunos || item.alunos.length}</span>
    `;
    card.appendChild(linhaInfo);

    const blocoConteudo = document.createElement("div");
    blocoConteudo.style.marginBottom = "12px";
    blocoConteudo.innerHTML = `
      <div style="font-size:14px;">
        <strong>Conteúdo:</strong> ${item.conteudo || "-"}
      </div>
    `;
    card.appendChild(blocoConteudo);

    const valorHoraAplicado = item.aula_coletiva
      ? Number(item.valor_hora || 0) * 1.5
      : Number(item.valor_hora || 0);

    const valorPrevio = calcularValorItem(item);

    const linhaFinal = document.createElement("div");
    linhaFinal.style.display = "grid";
    linhaFinal.style.gridTemplateColumns = "repeat(auto-fit, minmax(170px, 1fr))";
    linhaFinal.style.gap = "12px";
    linhaFinal.style.alignItems = "end";

    linhaFinal.innerHTML = `
      <div>
        <div style="font-size:12px; opacity:0.75;">Hora-aula aplicada</div>
        <div style="font-weight:700; margin-top:4px;">${formatarMoeda(valorHoraAplicado)}</div>
      </div>

      <div>
        <div style="font-size:12px; opacity:0.75;">Minutagem</div>
        <input
          type="text"
          inputmode="numeric"
          value="${item.duracao_input || ""}"
          data-chave-item="${item.chave}"
          class="input-duracao-aula"
          style="margin-top:6px;"
          placeholder="Ex: 3050"
        />
        <div style="font-size:11px; opacity:0.7; margin-top:4px;">Digite sem os dois pontos</div>
      </div>

      <div>
        <div style="font-size:12px; opacity:0.75;">Valor estimado</div>
        <div id="valor-item-${item.chave}" style="font-weight:700; margin-top:4px;">${formatarMoeda(valorPrevio)}</div>
      </div>
    `;
    card.appendChild(linhaFinal);

    const rodape = document.createElement("div");
    rodape.style.display = "flex";
    rodape.style.justifyContent = "flex-end";
    rodape.style.alignItems = "center";
    rodape.style.marginTop = "14px";

    rodape.innerHTML = `
      <button
        type="button"
        class="btn btn-salvar-item"
        data-chave-item="${item.chave}"
        style="padding:10px 14px;"
      >
        Salvar
      </button>
    `;
    card.appendChild(rodape);

    listaAulas.appendChild(card);
  });

  document.querySelectorAll(".input-duracao-aula").forEach((input) => {
    input.addEventListener("input", (e) => {
      const chave = e.target.dataset.chaveItem;
      const item = itensFinanceiroCache.find((x) => x.chave === chave);
      if (!item) return;

      const limpo = somenteDigitos(e.target.value);
      const formatado = formatarTempoDigitado(limpo);

      e.target.value = formatado;
      item.duracao_input = formatado;
      item.duracao_segundos = converterTempoDigitadoParaSegundos(limpo);

      const valorEl = document.getElementById(`valor-item-${chave}`);
      if (valorEl) {
        valorEl.textContent = formatarMoeda(calcularValorItem(item));
      }

      atualizarResumo();
    });
  });

  document.querySelectorAll(".btn-salvar-item").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const chave = e.currentTarget.dataset.chaveItem;
      await salvarDuracaoItem(chave, e.currentTarget);
    });
  });

  atualizarResumo();
}

// ======================
// Carregamento de dados
// ======================
async function carregarProfessores() {
  const { data, error } = await supabase
    .from("professor")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao carregar professores:", error);
    filtroProfessor.innerHTML = `<option value="">Erro ao carregar</option>`;
    return;
  }

  professoresCache = data || [];
  filtroProfessor.innerHTML = `<option value="">Selecione</option>`;

  professoresCache.forEach((professor) => {
    const option = document.createElement("option");
    option.value = professor.id;
    option.textContent = professor.nome;
    filtroProfessor.appendChild(option);
  });
}

async function carregarValoresHoraProfessor(professorId) {
  const { data, error } = await supabase
    .from("professor_materia")
    .select("materia_id, valor_hora")
    .eq("professor_id", professorId);

  if (error) {
    console.error("Erro ao carregar valores/hora:", error);
    valoresHoraProfessor = [];
    return false;
  }

  valoresHoraProfessor = data || [];
  return true;
}

async function buscarAulas() {
  const professorId = Number(filtroProfessor.value);

  if (!professorId) {
    mostrarMensagem("Selecione um professor.", false);
    return;
  }

  listaAulas.innerHTML = `<div style="opacity:0.8; font-size:13px;">Carregando aulas...</div>`;
  itensFinanceiroCache = [];
  valoresHoraProfessor = [];

  const okValores = await carregarValoresHoraProfessor(professorId);

  if (!okValores) {
    listaAulas.innerHTML = `<div style="opacity:0.8; font-size:13px;">Erro ao carregar valores do professor.</div>`;
    mostrarMensagem("Erro ao carregar valor/hora do professor.", false);
    atualizarResumo();
    return;
  }

  const { data, error } = await supabase
    .from("aula")
    .select(`
      id,
      data_aula,
      status,
      conteudo,
      duracao_segundos,
      aula_gravada,
      professor_id,
      parte,
      aula_coletiva,
      grupo_aula_id,
      quantidade_alunos,
      matricula:matricula_id (
        id,
        professor_id,
        materia_id,
        aluno:aluno_id (
          nome
        ),
        materia:materia_id (
          nome
        )
      )
    `)
    .eq("aula_gravada", true)
    .order("data_aula", { ascending: false })
    .order("parte", { ascending: false });

  if (error) {
    console.error("Erro ao buscar aulas:", error);
    itensFinanceiroCache = [];
    renderItensFinanceiro();
    mostrarMensagem("Erro ao buscar aulas.", false);
    return;
  }

  const aulasProfessor = (data || []).filter((aula) => {
    return Number(aula?.matricula?.professor_id) === professorId;
  });

  const aulasFiltradas = aplicarFiltrosLocais(aulasProfessor);

  itensFinanceiroCache = agruparAulasParaFinanceiro(aulasFiltradas);
  renderItensFinanceiro();
}

// ======================
// Salvar
// ======================
async function salvarDuracaoItem(chave, botao) {
  const item = itensFinanceiroCache.find((x) => x.chave === chave);

  if (!item) {
    mostrarMensagem("Aula não encontrada.", false);
    return;
  }

  const valorDuracao = normalizarDuracaoSegundos(item.duracao_segundos);

  botao.disabled = true;
  const textoOriginal = botao.textContent;
  botao.textContent = "Salvando...";

  try {
    for (const id of item.ids_aula) {
      const { error } = await supabase
        .from("aula")
        .update({
          duracao_segundos: valorDuracao
        })
        .eq("id", Number(id));

      if (error) {
        throw error;
      }
    }

    item.duracao_segundos_salva = valorDuracao;
    item.duracao_input = formatarSegundosParaCampo(valorDuracao);

    if (valorDuracao === null) {
      mostrarMensagem("Minutagem removida. O selo continuará pendente.", true);
    } else {
      mostrarMensagem("Minutagem salva com sucesso!", true);
    }

    renderItensFinanceiro();
  } catch (error) {
    console.error("Erro ao salvar minutagem:", error);
    mostrarMensagem("Erro ao salvar a minutagem desta aula.", false);
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

// ======================
// Eventos
// ======================
btnBuscar.addEventListener("click", buscarAulas);

// ======================
// Init
// ======================
(function init() {
  preencherDias();
  preencherAnos();

  const hoje = new Date();
  filtroDia.value = "";
  filtroMes.value = String(hoje.getMonth() + 1);
  filtroAno.value = String(hoje.getFullYear());

  carregarProfessores();
})();