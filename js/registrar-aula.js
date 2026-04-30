import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

// ==========================================
// 1. ELEMENTOS
// ==========================================
const form = document.getElementById("form-aula");
const inputDataAula = document.getElementById("dataAula");
const aulaColetivaCheckbox = document.getElementById("aulaColetiva");
const selectMatricula = document.getElementById("matricula");
const listaAlunosBox = document.getElementById("listaAlunos");
const alunosSelecionadosDiv = document.getElementById("alunosSelecionados");

const boxStatusGeral = document.getElementById("boxStatus");
const selectStatusGeral = document.getElementById("status");
const boxAusenciaGeral = document.getElementById("boxAusencia");
const boxReposicaoGeral = document.getElementById("boxReposicao");

const selectParte = document.getElementById("parteAula");
const moduloAula = document.getElementById("moduloAula");
const boxJustificativaGeral = document.getElementById("boxJustificativa");
const inputJustificativa = document.getElementById("justificativa");
const inputConteudo = document.getElementById("conteudo");
const inputLicaoCasa = document.getElementById("licaoCasa");

const inputAulaGravada = document.getElementById("aulaGravada");
const inputPrecisaReposicao = document.getElementById("precisaReposicao");

const aulaOriginalIdGeral = document.getElementById("aulaOriginalId");

// Pode ainda existir no HTML antigo.
// O JS vai esconder e ignorar, porque custo é assunto administrativo/financeiro.
const reposicaoComCustoGeral = document.getElementById("reposicaoComCusto");

let msg = document.getElementById("msg");

let matriculasLista = [];
let materiaColetivaId = null;
let moduloColetivoId = null;

// ==========================================
// 2. STATUS
// ==========================================
const STATUS = {
  PRESENTE: "Presente",
  AUSENTE: "Ausente",
  CANCELADA: "Cancelada",
  REPOSICAO: "Reposição",
  AULA_INSTRUMENTAL: "Aula Instrumental",
  PLANTAO_DUVIDAS: "Plantão de dúvidas"
};

// ==========================================
// 3. AJUSTE VISUAL DA MENSAGEM
// ==========================================
function prepararMensagemAbaixoDoBotao() {
  const botaoSalvar =
    form.querySelector('button[type="submit"]') ||
    form.querySelector("button");

  if (!msg) {
    msg = document.createElement("div");
    msg.id = "msg";
    msg.style.display = "none";
  }

  if (botaoSalvar) {
    botaoSalvar.insertAdjacentElement("afterend", msg);
  }

  msg.style.display = "none";
  msg.style.marginTop = "12px";
  msg.style.marginBottom = "0";
}

function esconderCampoReposicaoComCusto() {
  if (!reposicaoComCustoGeral) return;

  reposicaoComCustoGeral.checked = false;
  reposicaoComCustoGeral.disabled = true;

  const label = reposicaoComCustoGeral.closest("label");
  const box = reposicaoComCustoGeral.closest("div");

  if (label) {
    label.style.display = "none";
  } else if (box) {
    box.style.display = "none";
  } else {
    reposicaoComCustoGeral.style.display = "none";
  }
}

// ==========================================
// 4. FUNÇÕES AUXILIARES
// ==========================================
function mostrarMensagem(texto, ok = true) {
  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";
  msg.style.padding = "10px 12px";
  msg.style.borderRadius = "10px";
  msg.style.marginTop = "12px";
  msg.style.marginBottom = "0";
  msg.style.fontWeight = "600";
  msg.style.textAlign = "center";

  setTimeout(() => {
    msg.style.display = "none";
  }, 3500);
}

function setarDataHoje() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  inputDataAula.value = `${ano}-${mes}-${dia}`;
}

function formatarDataBR(dataISO) {
  if (!dataISO) return "";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function textoStatusAulaOriginal(aula) {
  if (aula.status === STATUS.AUSENTE) {
    return "Ausente — aluno pediu reposição";
  }

  if (aula.status === STATUS.CANCELADA) {
    return "Cancelada — reposição sem custo, responsabilidade da escola";
  }

  return `${aula.status || "Status não informado"} — reposição pendente`;
}

function criarOpcaoAulaPendente(aula) {
  const dataBR = formatarDataBR(aula.data_aula);
  const statusTexto = textoStatusAulaOriginal(aula);

  const justificativa = aula.justificativa?.trim()
    ? ` — ${aula.justificativa.trim()}`
    : "";

  return `
    <option value="${aula.id}">
      ${dataBR} — ${statusTexto}${justificativa}
    </option>
  `;
}

function limparCamposAuxiliaresGerais() {
  boxAusenciaGeral.style.display = "none";
  boxReposicaoGeral.style.display = "none";
  boxJustificativaGeral.style.display = "none";

  inputAulaGravada.checked = false;
  inputPrecisaReposicao.checked = false;
  aulaOriginalIdGeral.innerHTML = `<option value="">Selecione o aluno primeiro</option>`;

  if (reposicaoComCustoGeral) {
    reposicaoComCustoGeral.checked = false;
    reposicaoComCustoGeral.disabled = true;
  }

  inputJustificativa.value = "";
}

function limparEstadoColetivo() {
  matriculasLista = [];
  materiaColetivaId = null;
  moduloColetivoId = null;
  alunosSelecionadosDiv.innerHTML = "";
  listaAlunosBox.style.display = "none";
}

function statusExigeJustificativa(status) {
  return status === STATUS.AUSENTE || status === STATUS.CANCELADA;
}

function statusGravaAutomaticamente(status) {
  return (
    status === STATUS.PRESENTE ||
    status === STATUS.REPOSICAO ||
    status === STATUS.AULA_INSTRUMENTAL ||
    status === STATUS.PLANTAO_DUVIDAS
  );
}

function statusNaoGeraReposicao(status) {
  return (
    status === STATUS.PRESENTE ||
    status === STATUS.AULA_INSTRUMENTAL ||
    status === STATUS.PLANTAO_DUVIDAS
  );
}

function atualizarBoxJustificativaGeral() {
  const status = selectStatusGeral.value;
  boxJustificativaGeral.style.display = statusExigeJustificativa(status)
    ? "block"
    : "none";
}

function atualizarCamposTextoPorStatusGeral() {
  const status = selectStatusGeral.value;
  const desabilitar = status === STATUS.CANCELADA;

  inputConteudo.disabled = desabilitar;
  inputLicaoCasa.disabled = desabilitar;

  if (desabilitar) {
    inputConteudo.value = "";
    inputLicaoCasa.value = "";
  }
}

function validarJustificativaObrigatoria(status, justificativa) {
  const texto = (justificativa || "").trim();

  if (statusExigeJustificativa(status) && !texto) {
    return `Preencha a justificativa para o status "${status}".`;
  }

  return null;
}

function gerarGrupoAulaId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `grupo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizarAlunoPorStatus(aluno) {
  const status = aluno.status;

  if (status === STATUS.PRESENTE) {
    aluno.aulaGravada = true;
    aluno.precisaReposicao = false;
    aluno.justificativa = "";
    aluno.aulaOriginalId = null;
    aluno.reposicaoComCusto = false;
    return;
  }

  if (status === STATUS.AUSENTE) {
    if (aluno.aulaGravada && aluno.precisaReposicao) {
      aluno.precisaReposicao = false;
    }

    aluno.aulaOriginalId = null;
    aluno.reposicaoComCusto = false;
    return;
  }

  if (status === STATUS.CANCELADA) {
    aluno.aulaGravada = false;
    aluno.precisaReposicao = true;
    aluno.aulaOriginalId = null;
    aluno.reposicaoComCusto = false;
    return;
  }

  if (status === STATUS.REPOSICAO) {
    aluno.aulaGravada = true;
    aluno.precisaReposicao = false;
    aluno.reposicaoComCusto = false;
    return;
  }

  if (status === STATUS.AULA_INSTRUMENTAL || status === STATUS.PLANTAO_DUVIDAS) {
    aluno.aulaGravada = true;
    aluno.precisaReposicao = false;
    aluno.justificativa = "";
    aluno.aulaOriginalId = null;
    aluno.reposicaoComCusto = false;
    return;
  }
}

function aplicarRegrasStatusGeral() {
  const status = selectStatusGeral.value;

  boxAusenciaGeral.style.display = status === STATUS.AUSENTE ? "block" : "none";
  boxReposicaoGeral.style.display = status === STATUS.REPOSICAO ? "block" : "none";

  if (status === STATUS.AUSENTE) {
    // Usuário escolhe: gravada OU reposição.
  } else if (status === STATUS.CANCELADA) {
    inputAulaGravada.checked = false;
    inputPrecisaReposicao.checked = true;
  } else if (status === STATUS.REPOSICAO) {
    inputAulaGravada.checked = true;
    inputPrecisaReposicao.checked = false;
  } else if (statusNaoGeraReposicao(status)) {
    inputAulaGravada.checked = statusGravaAutomaticamente(status);
    inputPrecisaReposicao.checked = false;
  } else {
    inputAulaGravada.checked = false;
    inputPrecisaReposicao.checked = false;
  }

  if (status !== STATUS.REPOSICAO) {
    aulaOriginalIdGeral.innerHTML = `<option value="">Selecione o aluno primeiro</option>`;
  }

  if (reposicaoComCustoGeral) {
    reposicaoComCustoGeral.checked = false;
    reposicaoComCustoGeral.disabled = true;
  }

  if (!statusExigeJustificativa(status)) {
    inputJustificativa.value = "";
  }

  atualizarBoxJustificativaGeral();
  atualizarCamposTextoPorStatusGeral();
  esconderCampoReposicaoComCusto();
}

// ==========================================
// 5. BUSCAS
// ==========================================
async function buscarAulasPendentes(matriculaId) {
  const { data: pendentes, error: errorPendentes } = await supabase
    .from("aula")
    .select("id, data_aula, status, justificativa")
    .eq("matricula_id", matriculaId)
    .eq("precisa_reposicao", true)
    .order("data_aula", { ascending: true });

  if (errorPendentes) {
    console.error("Erro ao buscar aulas pendentes:", errorPendentes);
    return [];
  }

  const { data: reposicoesJaRegistradas, error: errorReposicoes } = await supabase
    .from("aula")
    .select("aula_original_id")
    .eq("matricula_id", matriculaId)
    .eq("status", STATUS.REPOSICAO)
    .not("aula_original_id", "is", null);

  if (errorReposicoes) {
    console.error("Erro ao buscar reposições já registradas:", errorReposicoes);
    return pendentes || [];
  }

  const idsJaRepostos = new Set(
    (reposicoesJaRegistradas || []).map((item) => Number(item.aula_original_id))
  );

  const pendentesFiltradas = (pendentes || []).filter(
    (aula) => !idsJaRepostos.has(Number(aula.id))
  );

  return pendentesFiltradas;
}

async function carregarMatriculas() {
  const professorId = Number(localStorage.getItem("professorId"));

  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      materia_id,
      modulo_id,
      aluno:aluno_id(nome),
      materia:materia_id(nome),
      modulo:modulo_id(nome)
    `)
    .eq("professor_id", professorId)
    .eq("ativa", true);

  if (error) {
    console.error("Erro ao carregar matrículas:", error);
    selectMatricula.innerHTML = `<option value="">Erro ao carregar alunos</option>`;
    return;
  }

  selectMatricula.innerHTML = `<option value="">Selecione o aluno</option>`;

  (data || [])
    .sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome))
    .forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.aluno.nome} — ${m.materia.nome}`;
      opt.dataset.materiaId = m.materia_id;
      opt.dataset.moduloAtual = m.modulo_id;
      opt.dataset.materiaNome = m.materia.nome;
      opt.dataset.moduloNome = m.modulo?.nome || "Módulo não informado";
      selectMatricula.appendChild(opt);
    });
}

async function carregarModulos(materiaId, moduloAtual = null) {
  if (!materiaId) {
    moduloAula.innerHTML = `<option value="">Selecione o módulo</option>`;
    return;
  }

  const { data, error } = await supabase
    .from("modulo")
    .select("id, nome")
    .eq("materia_id", materiaId)
    .order("ordem");

  if (error) {
    console.error("Erro ao carregar módulos:", error);
    moduloAula.innerHTML = `<option value="">Erro ao carregar módulos</option>`;
    return;
  }

  moduloAula.innerHTML = `<option value="">Selecione o módulo</option>`;

  (data || []).forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.nome;

    if (moduloAtual && String(m.id) === String(moduloAtual)) {
      opt.selected = true;
    }

    moduloAula.appendChild(opt);
  });
}

async function carregarAulasPendentesGeral() {
  const matriculaId = selectMatricula.value;

  if (!matriculaId) {
    aulaOriginalIdGeral.innerHTML = `<option value="">Selecione o aluno primeiro</option>`;
    return;
  }

  const pendentes = await buscarAulasPendentes(matriculaId);

  if (!pendentes.length) {
    aulaOriginalIdGeral.innerHTML = `
      <option value="">Este aluno não possui faltas e/ou cancelamentos pendentes</option>
    `;

    mostrarMensagem(
      "Este aluno não possui faltas e/ou cancelamentos pendentes para reposição.",
      false
    );
    return;
  }

  aulaOriginalIdGeral.innerHTML = `<option value="">Selecione a aula original...</option>`;

  pendentes.forEach((aula) => {
    aulaOriginalIdGeral.insertAdjacentHTML("beforeend", criarOpcaoAulaPendente(aula));
  });
}

// ==========================================
// 6. AULA COLETIVA
// ==========================================
async function renderizarAlunosColetivo() {
  alunosSelecionadosDiv.innerHTML = "";

  for (const [index, aluno] of matriculasLista.entries()) {
    normalizarAlunoPorStatus(aluno);

    let htmlExtras = "";

    if (aluno.status === STATUS.AUSENTE) {
      htmlExtras = `
        <div style="margin-top:10px; background:#fff; padding:10px; border-radius:8px; border:1px solid #eee;">
          <label style="font-size:13px; display:block; margin-bottom:8px;">
            Justificativa
            <input
              type="text"
              class="justificativa-ind"
              data-index="${index}"
              value="${aluno.justificativa || ""}"
              placeholder="Ex: viagem / compromisso / aviso à escola"
              style="width:100%; margin-top:5px;"
            >
          </label>

          <label style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <input type="checkbox" class="gravada-ind" data-index="${index}" ${aluno.aulaGravada ? "checked" : ""}>
            Aula gravada
          </label>

          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" class="reposicao-ind" data-index="${index}" ${aluno.precisaReposicao ? "checked" : ""}>
            Agendar reposição
          </label>
        </div>
      `;
    } else if (aluno.status === STATUS.CANCELADA) {
      htmlExtras = `
        <div style="margin-top:10px; background:#fff; padding:10px; border-radius:8px; border:1px solid #eee;">
          <label style="font-size:13px; display:block;">
            Justificativa
            <input
              type="text"
              class="justificativa-ind"
              data-index="${index}"
              value="${aluno.justificativa || ""}"
              placeholder="Ex: professor sem luz / escola fechada / problema interno"
              style="width:100%; margin-top:5px;"
            >
          </label>

          <small style="display:block; margin-top:6px; color:#666;">
            Aula cancelada gera reposição automática e sem custo.
          </small>
        </div>
      `;
    } else if (aluno.status === STATUS.REPOSICAO) {
      const pendentes = await buscarAulasPendentes(aluno.id);
      const semPendencias = !pendentes.length;

      htmlExtras = `
        <div style="margin-top:10px; background:#fff; padding:10px; border-radius:8px; border:1px solid #eee;">
          <label style="font-size:13px; font-weight:bold; display:block; margin-bottom:6px;">
            Aula original
          </label>

          <select class="aula-original-ind" data-index="${index}" style="width:100%; margin-bottom:8px; font-size:12px;">
            ${
              semPendencias
                ? `<option value="">Este aluno não possui faltas e/ou cancelamentos pendentes</option>`
                : `<option value="">Selecione a aula original...</option>${pendentes
                    .map((p) => criarOpcaoAulaPendente(p))
                    .join("")}`
            }
          </select>

          ${
            semPendencias
              ? `<small style="display:block; color:#b71c1c; margin-bottom:8px;">
                  Este aluno não possui aula pendente para vincular a esta reposição.
                </small>`
              : `<small style="display:block; color:#555;">
                  A informação de custo não aparece para o professor. Quando a aula original for cancelada, a reposição é sem custo.
                </small>`
          }
        </div>
      `;
    } else if (
      aluno.status === STATUS.AULA_INSTRUMENTAL ||
      aluno.status === STATUS.PLANTAO_DUVIDAS
    ) {
      htmlExtras = `
        <div style="margin-top:10px; background:#fff; padding:10px; border-radius:8px; border:1px solid #eee;">
          <small style="color:#555;">
            Esta aula será salva como gravada e não gera reposição.
          </small>
        </div>
      `;
    }

    const div = document.createElement("div");
    div.className = "aluno-box";
    div.style.cssText = `
      background:#FFF5CC;
      padding:15px;
      margin-bottom:10px;
      border-radius:10px;
      border:1px solid #FDCC0C;
      position:relative;
    `;

    div.innerHTML = `
      <button
        type="button"
        class="btn-remover-aluno"
        data-index="${index}"
        style="
          position:absolute;
          right:10px;
          top:10px;
          background:#ff6b6b;
          color:white;
          border:none;
          border-radius:5px;
          cursor:pointer;
          width:24px;
          height:24px;
        "
      >
        ✕
      </button>

      <strong>${aluno.nome}</strong><br>

      <small style="display:block; margin-top:4px; color:#555;">
        Curso: ${aluno.materiaNome}
      </small>

      <small style="display:block; margin-top:2px; color:#555;">
        Módulo: ${aluno.moduloNome || "Módulo não informado"}
      </small>

      <select
        class="status-individual"
        data-index="${index}"
        style="width:100%; margin-top:8px; padding:8px; border-radius:6px;"
      >
        <option value="${STATUS.PRESENTE}" ${aluno.status === STATUS.PRESENTE ? "selected" : ""}>Presente</option>
        <option value="${STATUS.AUSENTE}" ${aluno.status === STATUS.AUSENTE ? "selected" : ""}>Ausente</option>
        <option value="${STATUS.CANCELADA}" ${aluno.status === STATUS.CANCELADA ? "selected" : ""}>Cancelada</option>
        <option value="${STATUS.REPOSICAO}" ${aluno.status === STATUS.REPOSICAO ? "selected" : ""}>Reposição</option>
        <option value="${STATUS.AULA_INSTRUMENTAL}" ${aluno.status === STATUS.AULA_INSTRUMENTAL ? "selected" : ""}>Aula Instrumental</option>
        <option value="${STATUS.PLANTAO_DUVIDAS}" ${aluno.status === STATUS.PLANTAO_DUVIDAS ? "selected" : ""}>Plantão de dúvidas</option>
      </select>

      ${htmlExtras}
    `;

    alunosSelecionadosDiv.appendChild(div);

    if (aluno.status === STATUS.REPOSICAO) {
      const selectAula = div.querySelector(".aula-original-ind");
      if (selectAula && aluno.aulaOriginalId) {
        selectAula.value = aluno.aulaOriginalId;
      }
    }
  }

  vincularEventosIndividuais();
}

function vincularEventosIndividuais() {
  document.querySelectorAll(".status-individual").forEach((sel) => {
    sel.onchange = async (e) => {
      const index = Number(e.target.dataset.index);
      const novoStatus = e.target.value;

      matriculasLista[index].status = novoStatus;

      if (novoStatus !== STATUS.AUSENTE && novoStatus !== STATUS.CANCELADA) {
        matriculasLista[index].justificativa = "";
      }

      if (novoStatus !== STATUS.REPOSICAO) {
        matriculasLista[index].aulaOriginalId = null;
        matriculasLista[index].reposicaoComCusto = false;
      }

      normalizarAlunoPorStatus(matriculasLista[index]);
      await renderizarAlunosColetivo();
    };
  });

  document.querySelectorAll(".gravada-ind").forEach((chk) => {
    chk.onchange = async (e) => {
      const index = Number(e.target.dataset.index);
      matriculasLista[index].aulaGravada = e.target.checked;

      if (e.target.checked) {
        matriculasLista[index].precisaReposicao = false;
      }

      await renderizarAlunosColetivo();
    };
  });

  document.querySelectorAll(".reposicao-ind").forEach((chk) => {
    chk.onchange = async (e) => {
      const index = Number(e.target.dataset.index);
      matriculasLista[index].precisaReposicao = e.target.checked;

      if (e.target.checked) {
        matriculasLista[index].aulaGravada = false;
      }

      await renderizarAlunosColetivo();
    };
  });

  document.querySelectorAll(".justificativa-ind").forEach((input) => {
    input.oninput = (e) => {
      const index = Number(e.target.dataset.index);
      matriculasLista[index].justificativa = e.target.value;
    };
  });

  document.querySelectorAll(".aula-original-ind").forEach((sel) => {
    sel.onchange = (e) => {
      const index = Number(e.target.dataset.index);
      matriculasLista[index].aulaOriginalId = e.target.value || null;
      matriculasLista[index].reposicaoComCusto = false;
    };
  });

  document.querySelectorAll(".btn-remover-aluno").forEach((btn) => {
    btn.onclick = async (e) => {
      const idx = Number(e.target.closest("button").dataset.index);
      matriculasLista.splice(idx, 1);

      if (matriculasLista.length === 0) {
        limparEstadoColetivo();
        moduloAula.innerHTML = `<option value="">Selecione o módulo</option>`;
        return;
      }

      await renderizarAlunosColetivo();
    };
  });
}

// ==========================================
// 7. EVENTOS DE INTERFACE
// ==========================================
aulaColetivaCheckbox.addEventListener("change", async () => {
  const isColetivo = aulaColetivaCheckbox.checked;

  if (boxStatusGeral) {
    boxStatusGeral.style.display = isColetivo ? "none" : "block";

    if (isColetivo) {
      selectStatusGeral.removeAttribute("required");
    } else {
      selectStatusGeral.setAttribute("required", "required");
    }
  }

  limparCamposAuxiliaresGerais();
  atualizarCamposTextoPorStatusGeral();

  if (!isColetivo) {
    limparEstadoColetivo();
    moduloAula.innerHTML = `<option value="">Selecione o módulo</option>`;
  } else if (matriculasLista.length > 0) {
    listaAlunosBox.style.display = "block";
    await renderizarAlunosColetivo();
  }

  esconderCampoReposicaoComCusto();
});

selectMatricula.addEventListener("change", async () => {
  const id = selectMatricula.value;
  if (!id) return;

  const opt = selectMatricula.selectedOptions[0];
  const materiaId = opt.dataset.materiaId;
  const moduloAtual = opt.dataset.moduloAtual;
  const materiaNome = opt.dataset.materiaNome;
  const moduloNome = opt.dataset.moduloNome;

  if (aulaColetivaCheckbox.checked) {
    const jaExiste = matriculasLista.find((a) => String(a.id) === String(id));

    if (jaExiste) {
      mostrarMensagem("Esse aluno já foi adicionado na aula coletiva.", false);
      selectMatricula.value = "";
      return;
    }

    if (matriculasLista.length === 0) {
      materiaColetivaId = materiaId;
      moduloColetivoId = moduloAtual;

      await carregarModulos(materiaId, moduloAtual);
      moduloAula.value = moduloAtual;
    } else {
      if (String(materiaId) !== String(materiaColetivaId)) {
        mostrarMensagem(
          "Em aula coletiva, todos os alunos precisam ser do mesmo curso.",
          false
        );
        selectMatricula.value = "";
        return;
      }

      if (String(moduloAtual) !== String(moduloColetivoId)) {
        mostrarMensagem(
          "Em aula coletiva, todos os alunos precisam ser do mesmo módulo.",
          false
        );
        selectMatricula.value = "";
        return;
      }
    }

    const novoAluno = {
      id: id,
      nome: opt.textContent,
      materiaId: materiaId,
      materiaNome: materiaNome,
      moduloAtual: moduloAtual,
      moduloNome: moduloNome,
      status: STATUS.PRESENTE,
      aulaGravada: true,
      precisaReposicao: false,
      justificativa: "",
      aulaOriginalId: null,
      reposicaoComCusto: false
    };

    matriculasLista.push(novoAluno);

    listaAlunosBox.style.display = "block";
    await renderizarAlunosColetivo();

    selectMatricula.value = "";
    return;
  }

  await carregarModulos(materiaId, moduloAtual);

  if (selectStatusGeral.value === STATUS.REPOSICAO) {
    await carregarAulasPendentesGeral();
  }
});

selectStatusGeral.addEventListener("change", async () => {
  aplicarRegrasStatusGeral();

  if (selectStatusGeral.value === STATUS.REPOSICAO) {
    await carregarAulasPendentesGeral();
  }

  esconderCampoReposicaoComCusto();
});

inputPrecisaReposicao.addEventListener("change", () => {
  if (inputPrecisaReposicao.checked) {
    inputAulaGravada.checked = false;
  }

  atualizarBoxJustificativaGeral();
});

inputAulaGravada.addEventListener("change", () => {
  if (inputAulaGravada.checked) {
    inputPrecisaReposicao.checked = false;
  }

  atualizarBoxJustificativaGeral();
});

// ==========================================
// 8. MONTAR REGISTRO
// ==========================================
function montarRegistroBase({
  matriculaId,
  professorId,
  dataAula,
  parte,
  moduloId,
  status,
  justificativa,
  conteudo,
  licaoCasa,
  aulaOriginalId,
  aulaGravada,
  precisaReposicao,
  aulaColetiva = false,
  grupoAulaId = null,
  quantidadeAlunos = 1
}) {
  const ehCancelada = status === STATUS.CANCELADA;
  const ehReposicao = status === STATUS.REPOSICAO;

  return {
    matricula_id: Number(matriculaId),
    professor_id: professorId,
    data_aula: dataAula,
    parte: Number(parte),
    modulo_id: moduloId,
    status: status,
    justificativa: statusExigeJustificativa(status) ? justificativa.trim() : null,
    conteudo: ehCancelada ? null : (conteudo || null),
    licao_casa: ehCancelada ? null : (licaoCasa || null),
    aula_original_id: ehReposicao ? Number(aulaOriginalId) : null,

    // Custo não é mais controlado pelo professor nesta tela.
    // Mantém false para não misturar regra financeira/administrativa com registro pedagógico.
    reposicao_com_custo: false,

    aula_gravada: !!aulaGravada,
    precisa_reposicao: !!precisaReposicao,
    aula_coletiva: !!aulaColetiva,
    grupo_aula_id: aulaColetiva ? grupoAulaId : null,
    quantidade_alunos: Number(quantidadeAlunos || 1)
  };
}

// ==========================================
// 9. SUBMIT
// ==========================================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const professorId = Number(localStorage.getItem("professorId"));
  const moduloId = Number(moduloAula.value);
  const conteudo = inputConteudo.value.trim();
  const licaoCasa = inputLicaoCasa.value.trim();

  if (!moduloId) {
    mostrarMensagem("Selecione o módulo.", false);
    return;
  }

  let registros = [];

  if (aulaColetivaCheckbox.checked) {
    if (matriculasLista.length === 0) {
      mostrarMensagem("Adicione pelo menos um aluno.", false);
      return;
    }

    if (matriculasLista.length < 2) {
      mostrarMensagem("Para aula coletiva, adicione pelo menos 2 alunos.", false);
      return;
    }

    const modulosDosAlunos = new Set(
      matriculasLista.map((aluno) => String(aluno.moduloAtual))
    );

    if (modulosDosAlunos.size > 1) {
      mostrarMensagem(
        "Em aula coletiva, todos os alunos precisam ser do mesmo módulo.",
        false
      );
      return;
    }

    if (String(moduloId) !== String(moduloColetivoId)) {
      mostrarMensagem(
        "O módulo selecionado precisa ser o mesmo módulo dos alunos da aula coletiva.",
        false
      );
      return;
    }

    const grupoAulaId = gerarGrupoAulaId();
    const quantidadeAlunos = matriculasLista.length;

    for (const aluno of matriculasLista) {
      normalizarAlunoPorStatus(aluno);

      const erroJustificativa = validarJustificativaObrigatoria(
        aluno.status,
        aluno.justificativa || ""
      );

      if (erroJustificativa) {
        mostrarMensagem(`Aluno ${aluno.nome}: ${erroJustificativa}`, false);
        return;
      }

      if (
        aluno.status === STATUS.AUSENTE &&
        !aluno.aulaGravada &&
        !aluno.precisaReposicao
      ) {
        mostrarMensagem(
          `Aluno ${aluno.nome}: em aula ausente, marque "aula gravada" ou "agendar reposição".`,
          false
        );
        return;
      }

      if (aluno.status === STATUS.REPOSICAO && !aluno.aulaOriginalId) {
        mostrarMensagem(
          `Aluno ${aluno.nome}: selecione a aula original da reposição.`,
          false
        );
        return;
      }

      registros.push(
        montarRegistroBase({
          matriculaId: aluno.id,
          professorId,
          dataAula: inputDataAula.value,
          parte: selectParte.value,
          moduloId,
          status: aluno.status,
          justificativa: aluno.justificativa || "",
          conteudo,
          licaoCasa,
          aulaOriginalId: aluno.aulaOriginalId,
          aulaGravada: aluno.aulaGravada,
          precisaReposicao: aluno.precisaReposicao,
          aulaColetiva: true,
          grupoAulaId,
          quantidadeAlunos
        })
      );
    }
  } else {
    const status = selectStatusGeral.value;
    const matriculaId = selectMatricula.value;
    const justificativa = inputJustificativa.value.trim();

    if (!matriculaId) {
      mostrarMensagem("Selecione o aluno.", false);
      return;
    }

    if (!status) {
      mostrarMensagem("Selecione o status da aula.", false);
      return;
    }

    const erroJustificativa = validarJustificativaObrigatoria(status, justificativa);

    if (erroJustificativa) {
      mostrarMensagem(erroJustificativa, false);
      return;
    }

    if (
      status === STATUS.AUSENTE &&
      !inputAulaGravada.checked &&
      !inputPrecisaReposicao.checked
    ) {
      mostrarMensagem(
        'Em aula ausente, marque "aula gravada" ou "agendar reposição".',
        false
      );
      return;
    }

    if (status === STATUS.REPOSICAO && !aulaOriginalIdGeral.value) {
      mostrarMensagem("Selecione a aula original da reposição.", false);
      return;
    }

    let aulaGravada = false;
    let precisaReposicao = false;

    if (status === STATUS.AUSENTE) {
      aulaGravada = inputAulaGravada.checked;
      precisaReposicao = inputPrecisaReposicao.checked;
    } else if (status === STATUS.CANCELADA) {
      aulaGravada = false;
      precisaReposicao = true;
    } else if (statusGravaAutomaticamente(status)) {
      aulaGravada = true;
      precisaReposicao = false;
    }

    registros = [
      montarRegistroBase({
        matriculaId,
        professorId,
        dataAula: inputDataAula.value,
        parte: selectParte.value,
        moduloId,
        status,
        justificativa,
        conteudo,
        licaoCasa,
        aulaOriginalId: aulaOriginalIdGeral.value,
        aulaGravada,
        precisaReposicao,
        aulaColetiva: false,
        grupoAulaId: null,
        quantidadeAlunos: 1
      })
    ];
  }

  const { error } = await supabase.from("aula").insert(registros);

  if (error) {
    console.error("Erro ao salvar aulas:", error);
    mostrarMensagem("Erro ao salvar os dados.", false);
    return;
  }

  const idsAulasOriginaisRepostas = registros
    .filter((reg) => reg.status === STATUS.REPOSICAO && reg.aula_original_id)
    .map((reg) => Number(reg.aula_original_id));

  if (idsAulasOriginaisRepostas.length > 0) {
    const { error: errorAtualizarOriginais } = await supabase
      .from("aula")
      .update({ precisa_reposicao: false })
      .in("id", idsAulasOriginaisRepostas);

    if (errorAtualizarOriginais) {
      console.error("Erro ao atualizar aulas originais repostas:", errorAtualizarOriginais);
      mostrarMensagem(
        "A aula foi salva, mas houve erro ao atualizar a pendência da reposição.",
        false
      );
      return;
    }
  }

  mostrarMensagem("Aula(s) registrada(s) com sucesso!");

  setTimeout(() => {
    location.reload();
  }, 1500);
});

// ==========================================
// 10. INICIAR
// ==========================================
prepararMensagemAbaixoDoBotao();
esconderCampoReposicaoComCusto();
setarDataHoje();
carregarMatriculas();
aplicarRegrasStatusGeral();