import { supabase } from "./supabase.js";
import { exigirAluno } from "./guard.js";

await exigirAluno();

const saudacao = document.getElementById("saudacao");
const btnSair = document.getElementById("btnSair");

const btnZoom = document.getElementById("btnZoom");
const btnYoutube = document.getElementById("btnYoutube");

// ======================
// pegar aluno logado
// ======================

const alunoId = localStorage.getItem("alunoId");

if (!alunoId) {
  window.location.href = "login.html";
}

// ======================
// carregar dados do aluno
// ======================

async function carregarAluno() {

  const { data, error } = await supabase
    .from("aluno")
    .select("nome, link_zoom, link_youtube")
    .eq("id", alunoId)
    .single();

  if (error || !data) {
    console.error(error);
    return;
  }

  // saudação
  saudacao.textContent = `Olá, ${data.nome}`;

  // ======================
  // link zoom
  // ======================

  if (data.link_zoom) {

    btnZoom.href = data.link_zoom;

  } else {

    btnZoom.style.opacity = "0.5";
    btnZoom.style.pointerEvents = "none";
    btnZoom.textContent = "🎓 Aula não disponível";

  }

  // ======================
  // link youtube
  // ======================

  if (data.link_youtube) {

    btnYoutube.href = data.link_youtube;

  } else {

    btnYoutube.style.opacity = "0.5";
    btnYoutube.style.pointerEvents = "none";
    btnYoutube.textContent = "🎥 Playlist não disponível";

  }

}

// ======================
// sair
// ======================

btnSair.addEventListener("click", () => {

  localStorage.removeItem("alunoId");

  window.location.href = "login.html";

});

// iniciar
carregarAluno();