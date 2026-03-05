import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const form = document.getElementById("form-professor");
const msg = document.getElementById("msg");

const nomeProfessor = document.getElementById("nomeProfessor");
const emailProfessor = document.getElementById("emailProfessor");
const valorHora = document.getElementById("valorHora");
const listaMaterias = document.getElementById("listaMaterias");

let materiasCache = []; // [{id, nome}]

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

function renderMateriasCheckbox() {
  listaMaterias.innerHTML = "";

  if (materiasCache.length === 0) {
    listaMaterias.innerHTML = `<div style="opacity:0.8; font-size:13px;">Nenhuma matéria cadastrada.</div>`;
    return;
  }

  materiasCache.forEach((m) => {
    const id = `mat_${m.id}`;
    const wrap = document.createElement("label");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "10px";
    wrap.style.fontSize = "14px";

    wrap.innerHTML = `
      <input type="checkbox" class="chkMateria" value="${m.id}" id="${id}">
      <span>${m.nome}</span>
    `;

    listaMaterias.appendChild(wrap);
  });
}

async function carregarMaterias() {
  const { data, error } = await supabase
    .from("materia")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (error) {
    console.error(error);
    mostrarMensagem("❌ Erro ao carregar matérias.", false);
    return;
  }

  materiasCache = data || [];
  renderMateriasCheckbox();
}

function getMateriasSelecionadas() {
  const checks = [...document.querySelectorAll(".chkMateria")];
  return checks.filter((c) => c.checked).map((c) => c.value);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome = nomeProfessor.value.trim();
  const email = emailProfessor.value.trim().toLowerCase();
  const vh = Number(valorHora.value);

  const materiasSelecionadas = getMateriasSelecionadas();

  if (!nome || !email || !vh) {
    mostrarMensagem("⚠️ Preencha nome, e-mail e valor/hora.", false);
    return;
  }

  if (materiasSelecionadas.length === 0) {
    mostrarMensagem("⚠️ Selecione pelo menos 1 matéria.", false);
    return;
  }

  // 1) inserir professor
  const { data: prof, error: errProf } = await supabase
    .from("professor")
    .insert([{
      nome,
      email,
      valor_hora: vh
    }])
    .select("id")
    .single();

  if (errProf) {
    console.error(errProf);
    mostrarMensagem("❌ Erro ao salvar professor.", false);
    return;
  }

  const professorId = prof.id;

  // 2) inserir vínculos professor_materia (N:N)
  const payloadVinculos = materiasSelecionadas.map((materiaId) => ({
    professor_id: professorId,
    materia_id: materiaId
  }));

  const { error: errVinc } = await supabase
    .from("professor_materia")
    .insert(payloadVinculos);

  if (errVinc) {
    console.error(errVinc);
    mostrarMensagem("❌ Professor salvo, mas deu erro ao vincular matérias.", false);
    return;
  }

  mostrarMensagem("✅ Salvo!");
  form.reset();
  valorHora.value = "25.00"; // padrão
  // desmarcar checks
  document.querySelectorAll(".chkMateria").forEach((c) => (c.checked = false));
});

carregarMaterias();
