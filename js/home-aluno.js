import { supabase } from "./supabase.js";
import { exigirAluno } from "./guard.js";

await exigirAluno();

const saudacao = document.getElementById("saudacao");
const btnSair = document.getElementById("btnSair");
const btnZoom = document.getElementById("btnZoom");
const btnYoutube = document.getElementById("btnYoutube");

const alunoId = localStorage.getItem("alunoId");

if (!alunoId) {
  window.location.href = "login.html";
}

// ======================
// utilitário para desabilitar card-link
// ======================
function desabilitarCard(linkEl, tituloIndisponivel, descricaoIndisponivel) {
  if (!linkEl) return;

  linkEl.removeAttribute("href");
  linkEl.classList.add("link-indisponivel");

  const titulo = linkEl.querySelector(".card-admin-conteudo h2");
  const descricao = linkEl.querySelector(".card-admin-conteudo p");

  if (titulo) titulo.textContent = tituloIndisponivel;
  if (descricao) descricao.textContent = descricaoIndisponivel;
}

// ======================
// carregar dados do aluno
// ======================
async function carregarAluno() {
  try {
    // ----------------------
    // 1) buscar nome do aluno
    // ----------------------
    const { data: aluno, error: erroAluno } = await supabase
      .from("aluno")
      .select("id, nome")
      .eq("id", alunoId)
      .single();

    if (erroAluno || !aluno) {
      console.error("Erro ao carregar aluno:", erroAluno);
      saudacao.textContent = "Olá!";
      desabilitarCard(
        btnZoom,
        "Aula ao vivo indisponível",
        "Não foi possível carregar seus dados no momento."
      );
      desabilitarCard(
        btnYoutube,
        "Aulas gravadas indisponíveis",
        "Não foi possível carregar seus dados no momento."
      );
      return;
    }

    // saudação
    saudacao.textContent = `Olá, ${aluno.nome}!`;

    // ----------------------
    // 2) buscar matrícula ativa do aluno
    // ----------------------
    const { data: matricula, error: erroMatricula } = await supabase
      .from("matricula")
      .select("link_zoom, link_youtube, ativa")
      .eq("aluno_id", alunoId)
      .eq("ativa", true)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (erroMatricula) {
      console.error("Erro ao carregar matrícula:", erroMatricula);

      desabilitarCard(
        btnZoom,
        "Aula ao vivo indisponível",
        "Não foi possível localizar o link da sua aula."
      );
      desabilitarCard(
        btnYoutube,
        "Aulas gravadas indisponíveis",
        "Não foi possível localizar sua playlist no momento."
      );
      return;
    }

    // ----------------------
    // 3) link zoom
    // ----------------------
    if (matricula?.link_zoom) {
      btnZoom.href = matricula.link_zoom;
      btnZoom.target = "_blank";
      btnZoom.rel = "noopener noreferrer";
      btnZoom.classList.remove("link-indisponivel");
    } else {
      desabilitarCard(
        btnZoom,
        "Aula ao vivo indisponível",
        "Seu link de aula ainda não foi cadastrado."
      );
    }

    // ----------------------
    // 4) link youtube
    // ----------------------
    if (matricula?.link_youtube) {
      btnYoutube.href = matricula.link_youtube;
      btnYoutube.target = "_blank";
      btnYoutube.rel = "noopener noreferrer";
      btnYoutube.classList.remove("link-indisponivel");
    } else {
      desabilitarCard(
        btnYoutube,
        "Aulas gravadas indisponíveis",
        "Sua playlist ainda não foi cadastrada."
      );
    }

  } catch (erro) {
    console.error("Erro inesperado na home do aluno:", erro);

    saudacao.textContent = "Olá!";

    desabilitarCard(
      btnZoom,
      "Aula ao vivo indisponível",
      "Ocorreu um erro ao carregar sua área."
    );

    desabilitarCard(
      btnYoutube,
      "Aulas gravadas indisponíveis",
      "Ocorreu um erro ao carregar sua área."
    );
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