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

// proteção
if (!matriculaId) {
  window.location.href = "resumo-geral.html";
}

// ===============================
// ESTADO
// ===============================
let todasAulas = [];
let aulasExpandido = false;

// ===============================
// MENSAGEM
// ===============================
function mostrarMensagem(texto, ok = true) {
  msg.textContent = texto;
  msg.style.display = "block";

  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
  }, 2200);
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

function formatarDataBR(dataISO) {
  if (!dataISO) return "";
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

function textoParte(parte) {
  if (!parte) return "Não informada";
  return `Parte ${parte}`;
}

function textoAulaGravada(aula) {
  if (aula.status === "Ausente") {
    return aula.aula_gravada ? "Sim" : "Não";
  }

  if (
    aula.status === "Presente" ||
    aula.status === "Reposição" ||
    aula.status === "Aula Instrumental" ||
    aula.status === "Plantão de dúvidas"
  ) {
    return "Sim";
  }

  if (aula.status === "Cancelada") {
    return "Não";
  }

  return aula.aula_gravada ? "Sim" : "Não";
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
      aluno:aluno_id ( id, nome ),
      materia:materia_id ( nome ),
      modulo:modulo_id ( nome ),
      professor:professor_id ( nome )
    `)
    .eq("id", matriculaId)
    .single();

  if (error || !data) {
    console.error(error);
    mostrarMensagem("Erro ao carregar aluno", false);
    return null;
  }

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
      modulo:modulo_id ( nome )
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
    .sort((a, b) => a.nome.localeCompare(b.nome))
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

function preencherContadores(aulas) {
  let p = 0;
  let a = 0;
  let c = 0;

  aulas.forEach((x) => {
    if (x.status === "Presente") p++;
    else if (x.status === "Ausente") a++;
    else if (x.status === "Cancelada") c++;
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

  aulasParaMostrar.forEach((x) => {
    const li = document.createElement("li");
    li.style.listStyle = "none";
    li.style.marginBottom = "0";
    li.style.padding = "10px 0";
    li.style.borderBottom = "1px solid #e6dfcf";

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

    if (x.status === "Ausente") {
      infosNormais.push(`Aula gravada: ${gravada}`);
    }

    if (x.status === "Ausente" && x.precisa_reposicao) {
      infosNormais.push("Reposição: pendente/solicitada");
    }

    li.innerHTML = `
      <div class="item-historico-flex">
        <div class="item-historico-linha">
          <div class="item-historico-topo-compacto">
            ${escaparHtml(dataBR)} - ${escaparHtml(conteudo)} - ${escaparHtml(licao)}
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
      modulo:modulo_id ( nome )
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

init();