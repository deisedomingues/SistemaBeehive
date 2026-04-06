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
const textoProfessorInativo = document.getElementById("textoProfessorInativo");
const infoProfessorInativo = document.getElementById("infoProfessorInativo");

const formEditarProfessor = document.getElementById("formEditarProfessor");

const nomeInput = document.getElementById("nome");
const emailInput = document.getElementById("email");

const listaMaterias = document.getElementById("listaMaterias");

const btnSalvar = document.getElementById("btnSalvar");
const btnDesativarProfessor = document.getElementById("btnDesativarProfessor");
const btnReativarProfessor = document.getElementById("btnReativarProfessor");

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
  msg.style.border = ok ? "1px solid #66bb6a" : "1px solid #ef5350";

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
  return valor && String(valor).trim() ? valor : "—";
}

function obterProfessorSelecionado() {
  const professorId = selectProfessor.value;
  return professoresCache.find((p) => String(p.id) === String(professorId)) || null;
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
  subtituloEdicao.textContent = "Selecione um professor para editar.";

  nomeInput.value = "";
  emailInput.value = "";

  nomeInput.disabled = true;
  emailInput.disabled = true;
  btnSalvar.disabled = true;

  btnDesativarProfessor.style.display = "none";
  btnReativarProfessor.style.display = "none";

  listaMaterias.innerHTML = `<p style="margin:0; font-size:14px;">Selecione um professor acima.</p>`;

  textoStatusProfessor.textContent = "—";
  infoProfessor.textContent = "—";
  textoProfessorInativo.textContent = "—";
  infoProfessorInativo.textContent = "—";
}

function criarLinhaMateria(materia, vinculoExistente = null) {
  const wrapper = document.createElement("div");
  wrapper.style.padding = "12px";
  wrapper.style.borderRadius = "12px";
  wrapper.style.background = "rgba(255,255,255,0.45)";
  wrapper.style.border = "1px solid rgba(0,0,0,0.06)";

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
  inputValor.style.border = "1px solid rgba(0,0,0,0.15)";
  inputValor.style.background = checkbox.checked ? "#fff" : "#f3f3f3";

  checkbox.addEventListener("change", () => {
    inputValor.disabled = !checkbox.checked;
    inputValor.style.background = checkbox.checked ? "#fff" : "#f3f3f3";

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

function preencherListaMaterias(vinculosProfessor = []) {
  listaMaterias.innerHTML = "";

  if (materiasCache.length === 0) {
    listaMaterias.innerHTML = `<p style="margin:0; font-size:14px;">Nenhuma matéria cadastrada.</p>`;
    return;
  }

  materiasCache.forEach((materia) => {
    const vinculoExistente = vinculosProfessor.find(
      (v) => String(v.materia_id) === String(materia.id)
    ) || null;

    const linha = criarLinhaMateria(materia, vinculoExistente);
    listaMaterias.appendChild(linha);
  });
}

function obterMateriasSelecionadasComValor() {
  const checkboxes = [...document.querySelectorAll(".checkbox-materia")];

  const selecionadas = [];

  for (const checkbox of checkboxes) {
    if (!checkbox.checked) continue;

    const materiaId = Number(checkbox.value);

    const inputValor = document.querySelector(
      `.input-valor-materia[data-materia-id="${materiaId}"]`
    );

    const valor = inputValor?.value?.trim();

    selecionadas.push({
      materia_id: materiaId,
      valor_hora: valor
    });
  }

  return selecionadas;
}

function montarTextoMaterias(vinculos = []) {
  if (!vinculos.length) return "Nenhuma";

  const partes = vinculos.map((v) => {
    const materia = materiasCache.find((m) => String(m.id) === String(v.materia_id));
    const nomeMateria = materia?.nome || "Matéria";
    return `${nomeMateria} (${formatarMoedaBR(v.valor_hora)})`;
  });

  return partes.join(", ");
}

function preencherEdicaoProfessor(professor) {
  professorAtual = professor;

  blocoEdicao.style.display = "block";

  tituloEdicao.textContent = "Editar professor";
  subtituloEdicao.textContent = `Professor selecionado: ${professor.nome || "—"}`;

  if (professor.ativo === false) {
    blocoProfessorAtivo.style.display = "none";
    blocoProfessorInativo.style.display = "block";

    btnDesativarProfessor.style.display = "none";
    btnReativarProfessor.style.display = "inline-block";

    textoStatusProfessor.innerHTML = `
      <strong>Status atual:</strong> Professor inativo.
    `;

    textoProfessorInativo.innerHTML = `
      Este professor está desativado no momento.<br>
      Para voltar a editar seus dados e matérias, clique em <strong>“Reativar professor”</strong>.
    `;

    infoProfessorInativo.innerHTML = `
      <strong>Nome:</strong> ${professor.nome || "—"}<br>
      <strong>E-mail:</strong> ${valorTextoOuTraco(professor.email)}<br>
      <strong>Matérias cadastradas:</strong> ${montarTextoMaterias(professor.materias)}<br>
      <strong>Status:</strong> Inativo
    `;

    return;
  }

  blocoProfessorAtivo.style.display = "block";
  blocoProfessorInativo.style.display = "none";

  nomeInput.disabled = false;
  emailInput.disabled = false;
  btnSalvar.disabled = false;

  nomeInput.value = professor.nome || "";
  emailInput.value = professor.email || "";

  preencherListaMaterias(professor.materias || []);

  btnDesativarProfessor.style.display = "inline-block";
  btnReativarProfessor.style.display = "none";

  textoStatusProfessor.innerHTML = `
    <strong>Status atual:</strong> Professor ativo.<br>
    Você pode editar os dados abaixo ou ajustar as matérias e o valor/hora de cada uma.
  `;

  infoProfessor.innerHTML = `
    <strong>ID:</strong> ${professor.id} |
    <strong>E-mail:</strong> ${valorTextoOuTraco(professor.email)}<br>
    <strong>Matérias atuais:</strong> ${montarTextoMaterias(professor.materias)}
  `;
}

// =====================
// Base
// =====================
async function carregarMaterias() {
  const { data, error } = await supabase
    .from("materia")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (error) {
    console.error(error);
    mostrarMensagem("Erro ao carregar matérias.", false);
    return;
  }

  materiasCache = data || [];
}

async function carregarProfessores() {
  const { data: professores, error } = await supabase
    .from("professor")
    .select("id, nome, email, ativo")
    .order("nome", { ascending: true });

  if (error) {
    console.error(error);
    mostrarMensagem("Erro ao carregar professores.", false);
    return;
  }

  const { data: professorMateria, error: errorPM } = await supabase
    .from("professor_materia")
    .select("professor_id, materia_id, valor_hora");

  if (errorPM) {
    console.error(errorPM);
    mostrarMensagem("Erro ao carregar matérias dos professores.", false);
    return;
  }

  professoresCache = (professores || []).map((prof) => {
    const materiasDoProfessor = (professorMateria || []).filter(
      (pm) => String(pm.professor_id) === String(prof.id)
    );

    return {
      ...prof,
      materias: materiasDoProfessor
    };
  });

  selectProfessor.innerHTML = `<option value="">Selecione o professor(a)</option>`;

  professoresCache.forEach((prof) => {
    const status = prof.ativo === false ? " (inativo)" : "";
    selectProfessor.appendChild(
      criarOption(prof.id, `${prof.nome}${status}`)
    );
  });
}

// =====================
// Eventos principais
// =====================
selectProfessor.addEventListener("change", () => {
  const professorId = selectProfessor.value;

  resetEdicao();
  atualizarResumoProfessor();

  if (!professorId) return;

  const professor = professoresCache.find(
    (p) => String(p.id) === String(professorId)
  );

  if (!professor) return;

  preencherEdicaoProfessor(professor);
});

// =====================
// Salvar edição
// =====================
formEditarProfessor.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!professorAtual) {
    mostrarMensagem("Selecione um professor para editar.", false);
    return;
  }

  const nome = nomeInput.value.trim();
  const email = emailInput.value.trim();
  const materiasSelecionadas = obterMateriasSelecionadasComValor();

  if (!nome) {
    mostrarMensagem("Preencha o nome do professor.", false);
    return;
  }

  if (materiasSelecionadas.length === 0) {
    mostrarMensagem("Marque pelo menos uma matéria para este professor.", false);
    return;
  }

  for (const item of materiasSelecionadas) {
    if (item.valor_hora === "" || Number(item.valor_hora) < 0) {
      mostrarMensagem("Informe um valor/hora válido para cada matéria marcada.", false);
      return;
    }
  }

  const payloadProfessor = {
    nome,
    email: email || null
  };

  const { error: errorProfessor } = await supabase
    .from("professor")
    .update(payloadProfessor)
    .eq("id", professorAtual.id);

  if (errorProfessor) {
    console.error(errorProfessor);

    if (
      errorProfessor.message?.toLowerCase().includes("duplicate") ||
      errorProfessor.code === "23505"
    ) {
      mostrarMensagem("Este e-mail já está sendo usado por outro professor.", false);
      return;
    }

    mostrarMensagem("Erro ao salvar dados do professor.", false);
    return;
  }

  const { error: errorDelete } = await supabase
    .from("professor_materia")
    .delete()
    .eq("professor_id", professorAtual.id);

  if (errorDelete) {
    console.error(errorDelete);
    mostrarMensagem("Os dados do professor foram salvos, mas houve erro ao atualizar as matérias.", false);
    return;
  }

  const novosVinculos = materiasSelecionadas.map((item) => ({
    professor_id: professorAtual.id,
    materia_id: item.materia_id,
    valor_hora: Number(item.valor_hora)
  }));

  const { error: errorInsert } = await supabase
    .from("professor_materia")
    .insert(novosVinculos);

  if (errorInsert) {
    console.error(errorInsert);
    mostrarMensagem("Os dados do professor foram salvos, mas houve erro ao salvar as matérias.", false);
    return;
  }

  mostrarMensagem("Professor atualizado com sucesso.");

  const idAtual = professorAtual.id;

  await carregarProfessores();
  selectProfessor.value = String(idAtual);

  const atualizado = professoresCache.find(
    (p) => String(p.id) === String(idAtual)
  );

  atualizarResumoProfessor();

  if (atualizado) {
    preencherEdicaoProfessor(atualizado);
  }
});

// =====================
// Desativar professor
// =====================
btnDesativarProfessor.addEventListener("click", async () => {
  if (!professorAtual) {
    mostrarMensagem("Selecione um professor antes.", false);
    return;
  }

  const { error } = await supabase
    .from("professor")
    .update({ ativo: false })
    .eq("id", professorAtual.id);

  if (error) {
    console.error(error);
    mostrarMensagem("Erro ao desativar professor.", false);
    return;
  }

  mostrarMensagem("Professor desativado com sucesso.");

  const idAtual = professorAtual.id;

  await carregarProfessores();
  selectProfessor.value = String(idAtual);

  const atualizado = professoresCache.find(
    (p) => String(p.id) === String(idAtual)
  );

  atualizarResumoProfessor();

  if (atualizado) {
    preencherEdicaoProfessor(atualizado);
  }
});

// =====================
// Reativar professor
// =====================
btnReativarProfessor.addEventListener("click", async () => {
  if (!professorAtual) {
    mostrarMensagem("Selecione um professor antes.", false);
    return;
  }

  const { error } = await supabase
    .from("professor")
    .update({ ativo: true })
    .eq("id", professorAtual.id);

  if (error) {
    console.error(error);
    mostrarMensagem("Erro ao reativar professor.", false);
    return;
  }

  mostrarMensagem("Professor reativado com sucesso.");

  const idAtual = professorAtual.id;

  await carregarProfessores();
  selectProfessor.value = String(idAtual);

  const atualizado = professoresCache.find(
    (p) => String(p.id) === String(idAtual)
  );

  atualizarResumoProfessor();

  if (atualizado) {
    preencherEdicaoProfessor(atualizado);
  }
});

// init
resetEdicao();
await carregarMaterias();
await carregarProfessores();