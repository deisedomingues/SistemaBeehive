import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

// =====================
// Elementos da tela
// =====================
const form = document.getElementById("form-professor");
const msg = document.getElementById("msg");

const nomeProfessor = document.getElementById("nomeProfessor");
const emailProfessor = document.getElementById("emailProfessor");
const listaMaterias = document.getElementById("listaMaterias");

// =====================
// Cache
// =====================
let materiasCache = []; // [{ id, nome }]

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

function limparFormularioMaterias() {
  document.querySelectorAll(".checkbox-materia").forEach((checkbox) => {
    checkbox.checked = false;
  });

  document.querySelectorAll(".input-valor-materia").forEach((input) => {
    input.value = "";
    input.disabled = true;
    input.style.background = "#f3f3f3";
  });
}

function criarLinhaMateria(materia) {
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
  inputValor.disabled = true;
  inputValor.style.width = "140px";
  inputValor.style.padding = "8px";
  inputValor.style.borderRadius = "8px";
  inputValor.style.border = "1px solid rgba(0,0,0,0.15)";
  inputValor.style.background = "#f3f3f3";

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

function renderMaterias() {
  listaMaterias.innerHTML = "";

  if (materiasCache.length === 0) {
    listaMaterias.innerHTML = `
      <div style="opacity:0.8; font-size:13px;">Nenhuma matéria cadastrada.</div>
    `;
    return;
  }

  materiasCache.forEach((materia) => {
    const linha = criarLinhaMateria(materia);
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
  renderMaterias();
}

// =====================
// Salvar professor
// =====================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome = nomeProfessor.value.trim();
  const email = emailProfessor.value.trim().toLowerCase();

  const materiasSelecionadas = obterMateriasSelecionadasComValor();

  if (!nome || !email) {
    mostrarMensagem("Preencha nome e e-mail.", false);
    return;
  }

  if (materiasSelecionadas.length === 0) {
    mostrarMensagem("Selecione pelo menos 1 matéria.", false);
    return;
  }

  for (const item of materiasSelecionadas) {
    if (item.valor_hora === "" || Number(item.valor_hora) < 0) {
      mostrarMensagem("Informe um valor/hora válido para cada matéria marcada.", false);
      return;
    }
  }

  // 1) inserir professor
  const { data: prof, error: errProf } = await supabase
    .from("professor")
    .insert([{
      nome,
      email,
      ativo: true
    }])
    .select("id")
    .single();

  if (errProf) {
    console.error(errProf);

    if (
      errProf.message?.toLowerCase().includes("duplicate") ||
      errProf.code === "23505"
    ) {
      mostrarMensagem("Este e-mail já está sendo usado por outro professor.", false);
      return;
    }

    mostrarMensagem("Erro ao salvar professor.", false);
    return;
  }

  const professorId = prof.id;

  // 2) inserir vínculos professor_materia com valor_hora
  const payloadVinculos = materiasSelecionadas.map((item) => ({
    professor_id: professorId,
    materia_id: item.materia_id,
    valor_hora: Number(item.valor_hora)
  }));

  const { error: errVinc } = await supabase
    .from("professor_materia")
    .insert(payloadVinculos);

  if (errVinc) {
    console.error(errVinc);
    mostrarMensagem(
      "Professor salvo, mas deu erro ao vincular matérias.",
      false
    );
    return;
  }

  mostrarMensagem("Professor cadastrado com sucesso!");

  form.reset();
  limparFormularioMaterias();
});

// init
await carregarMaterias();