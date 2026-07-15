import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

// =====================
// Elementos da tela
// =====================
const msg = document.getElementById("msg");

const selectProfessor = document.getElementById("selectProfessor");

const resumoProfessor = document.getElementById("resumoProfessor");
const nomeProfessorResumo = document.getElementById("nomeProfessorResumo");

const blocoEdicao = document.getElementById("blocoEdicao");

const tituloEdicao = document.getElementById("tituloEdicao");
const subtituloEdicao = document.getElementById("subtituloEdicao");

const textoStatusProfessor = document.getElementById("textoStatusProfessor");
const infoProfessor = document.getElementById("infoProfessor");

const blocoProfessorAtivo = document.getElementById("blocoProfessorAtivo");
const blocoProfessorInativo = document.getElementById("blocoProfessorInativo");

const textoProfessorInativo = document.getElementById(
  "textoProfessorInativo"
);

const infoProfessorInativo = document.getElementById(
  "infoProfessorInativo"
);

const formEditarProfessor = document.getElementById(
  "formEditarProfessor"
);

const nomeInput = document.getElementById("nome");
const emailInput = document.getElementById("email");

const linkEventosInput = document.getElementById(
  "linkEventos"
);

const linkZoomReposicaoInput = document.getElementById(
  "linkZoomReposicao"
);

const listaMaterias = document.getElementById("listaMaterias");

const btnSalvar = document.getElementById("btnSalvar");

const btnDesativarProfessor = document.getElementById(
  "btnDesativarProfessor"
);

const btnReativarProfessor = document.getElementById(
  "btnReativarProfessor"
);

// =====================
// Cache
// =====================
let professoresCache = [];
let materiasCache = [];
let professorAtual = null;

// =====================
// Helpers UI
// =====================
function mostrarMensagem(texto, ok = true) {
  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.padding = "10px 12px";
  msg.style.marginBottom = "14px";
  msg.style.borderRadius = "10px";
  msg.style.fontSize = "13px";
  msg.style.fontWeight = "600";
  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";
  msg.style.border = ok
    ? "1px solid #66bb6a"
    : "1px solid #ef5350";

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
  }, 2600);
}

function criarOption(value, label) {
  const opt = document.createElement("option");

  opt.value = value;
  opt.textContent = label;

  return opt;
}

function formatarMoedaBR(valor) {
  const numero = Number(valor || 0);

  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function valorTextoOuTraco(valor) {
  return valor && String(valor).trim()
    ? valor
    : "—";
}

function obterProfessorSelecionado() {
  const professorId = selectProfessor.value;

  return (
    professoresCache.find(
      (professor) =>
        String(professor.id) === String(professorId)
    ) || null
  );
}

function atualizarResumoProfessor() {
  const professor = obterProfessorSelecionado();

  if (!professor) {
    resumoProfessor.style.display = "none";
    nomeProfessorResumo.textContent = "—";
    return;
  }

  resumoProfessor.style.display = "block";
  nomeProfessorResumo.textContent = professor.nome;
}

function resetEdicao() {
  professorAtual = null;

  blocoEdicao.style.display = "none";
  blocoProfessorAtivo.style.display = "none";
  blocoProfessorInativo.style.display = "none";

  tituloEdicao.textContent = "Editar professor";

  subtituloEdicao.textContent =
    "Selecione um professor para editar.";

  nomeInput.value = "";
  emailInput.value = "";
  linkEventosInput.value = "";
  linkZoomReposicaoInput.value = "";

  nomeInput.disabled = true;
  emailInput.disabled = true;
  linkEventosInput.disabled = true;
  linkZoomReposicaoInput.disabled = true;

  btnSalvar.disabled = true;

  btnDesativarProfessor.style.display = "none";
  btnReativarProfessor.style.display = "none";

  listaMaterias.innerHTML = `
    <p style="margin:0; font-size:14px;">
      Selecione um professor acima.
    </p>
  `;

  textoStatusProfessor.textContent = "—";
  infoProfessor.textContent = "—";
  textoProfessorInativo.textContent = "—";
  infoProfessorInativo.textContent = "—";
}

// =====================
// Criar linha de matéria
// =====================
function criarLinhaMateria(
  materia,
  vinculoExistente = null
) {
  const wrapper = document.createElement("div");

  wrapper.style.padding = "12px";
  wrapper.style.borderRadius = "12px";
  wrapper.style.background =
    "rgba(255,255,255,0.45)";
  wrapper.style.border =
    "1px solid rgba(0,0,0,0.06)";

  const linhaTopo = document.createElement("div");

  linhaTopo.style.display = "flex";
  linhaTopo.style.alignItems = "center";
  linhaTopo.style.justifyContent = "space-between";
  linhaTopo.style.gap = "12px";
  linhaTopo.style.flexWrap = "wrap";

  const label = document.createElement("label");

  label.style.display = "flex";
  label.style.alignItems = "center";
  label.style.gap = "10px";
  label.style.cursor = "pointer";
  label.style.fontWeight = "600";
  label.style.color = "#5c4300";

  const checkbox = document.createElement("input");

  checkbox.type = "checkbox";
  checkbox.className = "checkbox-materia";
  checkbox.value = materia.id;
  checkbox.checked = !!vinculoExistente;
  checkbox.style.transform = "scale(1.1)";

  const nomeMateria = document.createElement("span");

  nomeMateria.textContent = materia.nome;

  label.appendChild(checkbox);
  label.appendChild(nomeMateria);

  const areaValor = document.createElement("div");

  areaValor.style.display = "flex";
  areaValor.style.alignItems = "center";
  areaValor.style.gap = "8px";
  areaValor.style.flexWrap = "wrap";

  const textoValor = document.createElement("span");

  textoValor.textContent = "Valor/hora";
  textoValor.style.fontSize = "13px";
  textoValor.style.opacity = "0.85";

  const inputValor = document.createElement("input");

  inputValor.type = "number";
  inputValor.step = "0.01";
  inputValor.min = "0";
  inputValor.placeholder = "Ex: 25.00";
  inputValor.className = "input-valor-materia";
  inputValor.dataset.materiaId = materia.id;
  inputValor.value = vinculoExistente?.valor_hora ?? "";
  inputValor.disabled = !checkbox.checked;
  inputValor.style.width = "140px";
  inputValor.style.padding = "8px";
  inputValor.style.borderRadius = "8px";
  inputValor.style.border =
    "1px solid rgba(0,0,0,0.15)";

  inputValor.style.background = checkbox.checked
    ? "#fff"
    : "#f3f3f3";

  checkbox.addEventListener("change", () => {
    inputValor.disabled = !checkbox.checked;

    inputValor.style.background = checkbox.checked
      ? "#fff"
      : "#f3f3f3";

    if (!checkbox.checked) {
      inputValor.value = "";
    }
  });

  areaValor.appendChild(textoValor);
  areaValor.appendChild(inputValor);

  linhaTopo.appendChild(label);
  linhaTopo.appendChild(areaValor);

  wrapper.appendChild(linhaTopo);

  return wrapper;
}

// =====================
// Preencher matérias
// =====================
function preencherListaMaterias(
  vinculosProfessor = []
) {
  listaMaterias.innerHTML = "";

  if (materiasCache.length === 0) {
    listaMaterias.innerHTML = `
      <p style="margin:0; font-size:14px;">
        Nenhuma matéria cadastrada.
      </p>
    `;

    return;
  }

  materiasCache.forEach((materia) => {
    const vinculoExistente =
      vinculosProfessor.find(
        (vinculo) =>
          String(vinculo.materia_id) ===
          String(materia.id)
      ) || null;

    const linha = criarLinhaMateria(
      materia,
      vinculoExistente
    );

    listaMaterias.appendChild(linha);
  });
}

// =====================
// Obter matérias selecionadas
// =====================
function obterMateriasSelecionadasComValor() {
  const checkboxes = [
    ...document.querySelectorAll(
      ".checkbox-materia"
    )
  ];

  const selecionadas = [];

  for (const checkbox of checkboxes) {
    if (!checkbox.checked) {
      continue;
    }

    const materiaId = Number(
      checkbox.value
    );

    const inputValor =
      document.querySelector(
        `.input-valor-materia[data-materia-id="${materiaId}"]`
      );

    const valor =
      inputValor?.value?.trim();

    selecionadas.push({
      materia_id: materiaId,
      valor_hora: valor
    });
  }

  return selecionadas;
}

// =====================
// Texto das matérias
// =====================
function montarTextoMaterias(
  vinculos = []
) {
  if (!vinculos.length) {
    return "Nenhuma";
  }

  const partes = vinculos.map(
    (vinculo) => {
      const materia =
        materiasCache.find(
          (item) =>
            String(item.id) ===
            String(vinculo.materia_id)
        );

      const nomeMateria =
        materia?.nome || "Matéria";

      return `${nomeMateria} (${formatarMoedaBR(
        vinculo.valor_hora
      )})`;
    }
  );

  return partes.join(", ");
}

// =====================
// Preencher edição
// =====================
function preencherEdicaoProfessor(
  professor
) {
  professorAtual = professor;

  blocoEdicao.style.display = "block";

  tituloEdicao.textContent =
    "Editar professor";

  subtituloEdicao.textContent =
    `Professor selecionado: ${
      professor.nome || "—"
    }`;

  // =====================
  // Professor inativo
  // =====================
  if (professor.ativo === false) {
    blocoProfessorAtivo.style.display = "none";
    blocoProfessorInativo.style.display = "block";

    btnDesativarProfessor.style.display = "none";
    btnReativarProfessor.style.display =
      "inline-block";

    textoStatusProfessor.innerHTML = `
      <strong>Status atual:</strong>
      Professor inativo.
    `;

    textoProfessorInativo.innerHTML = `
      Este professor está desativado no momento.
      <br>
      Para voltar a editar seus dados e matérias,
      clique em
      <strong>“Reativar professor”</strong>.
    `;

    infoProfessorInativo.innerHTML = `
      <strong>Nome:</strong>
      ${professor.nome || "—"}

      <br>

      <strong>E-mail:</strong>
      ${valorTextoOuTraco(
        professor.email
      )}

      <br>

      <strong>Link eventos:</strong>
      ${valorTextoOuTraco(
        professor.link_eventos
      )}

      <br>

      <strong>Link reposições:</strong>
      ${valorTextoOuTraco(
        professor.link_zoom_reposicao
      )}

      <br>

      <strong>Matérias cadastradas:</strong>
      ${montarTextoMaterias(
        professor.materias
      )}

      <br>

      <strong>Status:</strong>
      Inativo
    `;

    return;
  }

  // =====================
  // Professor ativo
  // =====================
  blocoProfessorAtivo.style.display = "block";
  blocoProfessorInativo.style.display = "none";

  nomeInput.disabled = false;
  emailInput.disabled = false;
  linkEventosInput.disabled = false;
  linkZoomReposicaoInput.disabled = false;

  btnSalvar.disabled = false;

  nomeInput.value =
    professor.nome || "";

  emailInput.value =
    professor.email || "";

  linkEventosInput.value =
    professor.link_eventos || "";

  linkZoomReposicaoInput.value =
    professor.link_zoom_reposicao || "";

  preencherListaMaterias(
    professor.materias || []
  );

  btnDesativarProfessor.style.display =
    "inline-block";

  btnReativarProfessor.style.display =
    "none";

  textoStatusProfessor.innerHTML = `
    <strong>Status atual:</strong>
    Professor ativo.
    <br>
    Você pode editar os dados abaixo,
    ajustar os links recorrentes ou alterar
    as matérias e o valor/hora de cada uma.
  `;

  infoProfessor.innerHTML = `
    <strong>ID:</strong>
    ${professor.id}

    |

    <strong>E-mail:</strong>
    ${valorTextoOuTraco(
      professor.email
    )}

    <br>

    <strong>Link eventos:</strong>
    ${valorTextoOuTraco(
      professor.link_eventos
    )}

    <br>

    <strong>Link reposições:</strong>
    ${valorTextoOuTraco(
      professor.link_zoom_reposicao
    )}

    <br>

    <strong>Matérias atuais:</strong>
    ${montarTextoMaterias(
      professor.materias
    )}
  `;
}

// =====================
// Carregar matérias
// =====================
async function carregarMaterias() {
  const { data, error } = await supabase
    .from("materia")
    .select("id, nome")
    .order("nome", {
      ascending: true
    });

  if (error) {
    console.error(
      "Erro ao carregar matérias:",
      error
    );

    mostrarMensagem(
      "Erro ao carregar matérias.",
      false
    );

    return;
  }

  materiasCache = data || [];
}

// =====================
// Carregar professores
// =====================
async function carregarProfessores() {
  const {
    data: professores,
    error
  } = await supabase
    .from("professor")
    .select(`
      id,
      nome,
      email,
      ativo,
      link_eventos,
      link_zoom_reposicao
    `)
    .order("nome", {
      ascending: true
    });

  if (error) {
    console.error(
      "Erro ao carregar professores:",
      error
    );

    mostrarMensagem(
      "Erro ao carregar professores.",
      false
    );

    return;
  }

  const {
    data: professorMateria,
    error: errorPM
  } = await supabase
    .from("professor_materia")
    .select(`
      professor_id,
      materia_id,
      valor_hora
    `);

  if (errorPM) {
    console.error(
      "Erro ao carregar matérias dos professores:",
      errorPM
    );

    mostrarMensagem(
      "Erro ao carregar matérias dos professores.",
      false
    );

    return;
  }

  professoresCache =
    (professores || []).map(
      (professor) => {
        const materiasDoProfessor =
          (professorMateria || []).filter(
            (vinculo) =>
              String(
                vinculo.professor_id
              ) ===
              String(
                professor.id
              )
          );

        return {
          ...professor,
          materias: materiasDoProfessor
        };
      }
    );

  selectProfessor.innerHTML = `
    <option value="">
      Selecione o professor(a)
    </option>
  `;

  professoresCache.forEach(
    (professor) => {
      const status =
        professor.ativo === false
          ? " (inativo)"
          : "";

      selectProfessor.appendChild(
        criarOption(
          professor.id,
          `${professor.nome}${status}`
        )
      );
    }
  );
}

// =====================
// Selecionar professor
// =====================
selectProfessor.addEventListener(
  "change",
  () => {
    const professorId =
      selectProfessor.value;

    resetEdicao();

    atualizarResumoProfessor();

    if (!professorId) {
      return;
    }

    const professor =
      professoresCache.find(
        (item) =>
          String(item.id) ===
          String(professorId)
      );

    if (!professor) {
      return;
    }

    preencherEdicaoProfessor(
      professor
    );
  }
);

// =====================
// Salvar edição
// =====================
formEditarProfessor.addEventListener(
  "submit",
  async (e) => {
    e.preventDefault();

    if (!professorAtual) {
      mostrarMensagem(
        "Selecione um professor para editar.",
        false
      );

      return;
    }

    const nome =
      nomeInput.value.trim();

    const email =
      emailInput.value
        .trim()
        .toLowerCase();

    const link_eventos =
      linkEventosInput.value.trim() ||
      null;

    const link_zoom_reposicao =
      linkZoomReposicaoInput.value.trim() ||
      null;

    const materiasSelecionadas =
      obterMateriasSelecionadasComValor();

    // =====================
    // Validações
    // =====================
    if (!nome) {
      mostrarMensagem(
        "Preencha o nome do professor.",
        false
      );

      return;
    }

    if (
      materiasSelecionadas.length === 0
    ) {
      mostrarMensagem(
        "Marque pelo menos uma matéria para este professor.",
        false
      );

      return;
    }

    for (
      const item
      of materiasSelecionadas
    ) {
      if (
        item.valor_hora === "" ||
        Number(item.valor_hora) < 0
      ) {
        mostrarMensagem(
          "Informe um valor/hora válido para cada matéria marcada.",
          false
        );

        return;
      }
    }

    // =====================
    // Desativar botão
    // =====================
    btnSalvar.disabled = true;

    btnSalvar.textContent =
      "Salvando alterações...";

    // =====================
    // Atualizar professor
    // =====================
    const payloadProfessor = {
      nome,
      email: email || null,
      link_eventos,
      link_zoom_reposicao
    };

    const {
      error: errorProfessor
    } = await supabase
      .from("professor")
      .update(payloadProfessor)
      .eq(
        "id",
        professorAtual.id
      );

    if (errorProfessor) {
      console.error(
        "Erro ao salvar professor:",
        errorProfessor
      );

      btnSalvar.disabled = false;
      btnSalvar.textContent =
        "Salvar alterações";

      if (
        errorProfessor.message
          ?.toLowerCase()
          .includes("duplicate") ||
        errorProfessor.code === "23505"
      ) {
        mostrarMensagem(
          "Este e-mail já está sendo usado por outro professor.",
          false
        );

        return;
      }

      mostrarMensagem(
        "Erro ao salvar dados do professor.",
        false
      );

      return;
    }

    // =====================
    // Excluir vínculos antigos
    // =====================
    const {
      error: errorDelete
    } = await supabase
      .from("professor_materia")
      .delete()
      .eq(
        "professor_id",
        professorAtual.id
      );

    if (errorDelete) {
      console.error(
        "Erro ao remover vínculos antigos:",
        errorDelete
      );

      btnSalvar.disabled = false;

      btnSalvar.textContent =
        "Salvar alterações";

      mostrarMensagem(
        "Os dados do professor foram salvos, mas houve erro ao atualizar as matérias.",
        false
      );

      return;
    }

    // =====================
    // Criar novos vínculos
    // =====================
    const novosVinculos =
      materiasSelecionadas.map(
        (item) => ({
          professor_id:
            professorAtual.id,

          materia_id:
            item.materia_id,

          valor_hora:
            Number(item.valor_hora)
        })
      );

    const {
      error: errorInsert
    } = await supabase
      .from("professor_materia")
      .insert(novosVinculos);

    if (errorInsert) {
      console.error(
        "Erro ao salvar matérias:",
        errorInsert
      );

      btnSalvar.disabled = false;

      btnSalvar.textContent =
        "Salvar alterações";

      mostrarMensagem(
        "Os dados do professor foram salvos, mas houve erro ao salvar as matérias.",
        false
      );

      return;
    }

    // =====================
    // Sucesso
    // =====================
    mostrarMensagem(
      "Professor atualizado com sucesso."
    );

    const idAtual =
      professorAtual.id;

    await carregarProfessores();

    selectProfessor.value =
      String(idAtual);

    const atualizado =
      professoresCache.find(
        (professor) =>
          String(professor.id) ===
          String(idAtual)
      );

    atualizarResumoProfessor();

    if (atualizado) {
      preencherEdicaoProfessor(
        atualizado
      );
    }

    btnSalvar.disabled = false;

    btnSalvar.textContent =
      "Salvar alterações";
  }
);

// =====================
// Desativar professor
// =====================
btnDesativarProfessor.addEventListener(
  "click",
  async () => {
    if (!professorAtual) {
      mostrarMensagem(
        "Selecione um professor antes.",
        false
      );

      return;
    }

    const confirmar = confirm(
      `Deseja realmente desativar ${professorAtual.nome}?`
    );

    if (!confirmar) {
      return;
    }

    btnDesativarProfessor.disabled = true;

    btnDesativarProfessor.textContent =
      "Desativando...";

    const { error } = await supabase
      .from("professor")
      .update({
        ativo: false
      })
      .eq(
        "id",
        professorAtual.id
      );

    btnDesativarProfessor.disabled = false;

    btnDesativarProfessor.textContent =
      "Desativar professor";

    if (error) {
      console.error(
        "Erro ao desativar professor:",
        error
      );

      mostrarMensagem(
        "Erro ao desativar professor.",
        false
      );

      return;
    }

    mostrarMensagem(
      "Professor desativado com sucesso."
    );

    const idAtual =
      professorAtual.id;

    await carregarProfessores();

    selectProfessor.value =
      String(idAtual);

    const atualizado =
      professoresCache.find(
        (professor) =>
          String(professor.id) ===
          String(idAtual)
      );

    atualizarResumoProfessor();

    if (atualizado) {
      preencherEdicaoProfessor(
        atualizado
      );
    }
  }
);

// =====================
// Reativar professor
// =====================
btnReativarProfessor.addEventListener(
  "click",
  async () => {
    if (!professorAtual) {
      mostrarMensagem(
        "Selecione um professor antes.",
        false
      );

      return;
    }

    btnReativarProfessor.disabled = true;

    btnReativarProfessor.textContent =
      "Reativando...";

    const { error } = await supabase
      .from("professor")
      .update({
        ativo: true
      })
      .eq(
        "id",
        professorAtual.id
      );

    btnReativarProfessor.disabled = false;

    btnReativarProfessor.textContent =
      "Reativar professor";

    if (error) {
      console.error(
        "Erro ao reativar professor:",
        error
      );

      mostrarMensagem(
        "Erro ao reativar professor.",
        false
      );

      return;
    }

    mostrarMensagem(
      "Professor reativado com sucesso."
    );

    const idAtual =
      professorAtual.id;

    await carregarProfessores();

    selectProfessor.value =
      String(idAtual);

    const atualizado =
      professoresCache.find(
        (professor) =>
          String(professor.id) ===
          String(idAtual)
      );

    atualizarResumoProfessor();

    if (atualizado) {
      preencherEdicaoProfessor(
        atualizado
      );
    }
  }
);

// =====================
// Inicialização
// =====================
resetEdicao();

await carregarMaterias();

await carregarProfessores();