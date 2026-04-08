import { supabase } from "./supabase.js";
import { exigirAluno } from "./guard.js";

await exigirAluno();

const saudacao = document.getElementById("saudacao");
const btnSair = document.getElementById("btnSair");
const btnZoom = document.getElementById("btnZoom");
const btnYoutube = document.getElementById("btnYoutube");

const badgeEventos = document.getElementById("badgeEventos");
const textoEventosHome = document.getElementById("textoEventosHome");

const alunoId = localStorage.getItem("alunoId") || localStorage.getItem("aluno_id") || localStorage.getItem("idAluno");

if (!alunoId) {
  window.location.href = "login.html";
}

/* ======================
   utilitário para desabilitar card-link
====================== */
function desabilitarCard(linkEl, tituloIndisponivel, descricaoIndisponivel) {
  if (!linkEl) return;

  linkEl.removeAttribute("href");
  linkEl.classList.add("link-indisponivel");

  const titulo = linkEl.querySelector(".card-admin-conteudo h2");
  const descricao = linkEl.querySelector(".card-admin-conteudo p");

  if (titulo) titulo.textContent = tituloIndisponivel;
  if (descricao) descricao.textContent = descricaoIndisponivel;
}

function atualizarBadgeEventos(totalNaoVisualizados) {
  if (!badgeEventos || !textoEventosHome) return;

  if (!totalNaoVisualizados || totalNaoVisualizados <= 0) {
    badgeEventos.style.display = "none";
    badgeEventos.textContent = "0";
    textoEventosHome.textContent =
      "Consulte os eventos da escola e confirme sua participação.";
    return;
  }

  badgeEventos.style.display = "inline-flex";
  badgeEventos.textContent = totalNaoVisualizados > 99 ? "99+" : String(totalNaoVisualizados);

  if (totalNaoVisualizados === 1) {
    textoEventosHome.textContent = "Você tem 1 evento novo aguardando sua visualização.";
  } else {
    textoEventosHome.textContent = `Você tem ${totalNaoVisualizados} eventos novos aguardando sua visualização.`;
  }
}

function eventoJaAconteceu(evento) {
  if (!evento?.data_evento || !evento?.hora_evento) return false;
  const dataHoraEvento = new Date(`${evento.data_evento}T${evento.hora_evento}`);
  return dataHoraEvento < new Date();
}

function alunoPodeVerEvento(evento, matriculasAtivas) {
  if (!evento?.ativo) return false;
  if (eventoJaAconteceu(evento)) return false;
  if (!matriculasAtivas.length) return false;

  if (evento.publico_alvo === "todos") {
    return true;
  }

  if (evento.publico_alvo === "materia") {
    return matriculasAtivas.some(
      (matricula) => Number(matricula.materia_id) === Number(evento.materia_id)
    );
  }

  if (evento.publico_alvo === "modulo_exato") {
    return matriculasAtivas.some(
      (matricula) =>
        Number(matricula.materia_id) === Number(evento.materia_id) &&
        Number(matricula.modulo_id) === Number(evento.modulo_id)
    );
  }

  if (evento.publico_alvo === "modulo_a_partir") {
    const ordemEvento = evento.modulo?.ordem ?? null;
    if (ordemEvento === null) return false;

    return matriculasAtivas.some((matricula) => {
      const mesmaMateria = Number(matricula.materia_id) === Number(evento.materia_id);
      const ordemAluno = matricula.modulo?.ordem ?? null;

      return mesmaMateria && ordemAluno !== null && Number(ordemAluno) >= Number(ordemEvento);
    });
  }

  return false;
}

async function carregarMatriculasAtivasDoAluno() {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno_id,
      materia_id,
      modulo_id,
      ativa,
      modulo:modulo_id (
        id,
        nome,
        ordem,
        materia_id
      )
    `)
    .eq("aluno_id", alunoId)
    .eq("ativa", true);

  if (error) {
    console.error("Erro ao carregar matrículas ativas do aluno:", error);
    return [];
  }

  return data || [];
}

async function carregarEventosElegiveisDoAluno(matriculasAtivas) {
  const { data, error } = await supabase
    .from("evento")
    .select(`
      id,
      titulo,
      data_evento,
      hora_evento,
      publico_alvo,
      materia_id,
      modulo_id,
      limite_confirmacao,
      ativo,
      modulo:modulo_id (
        id,
        nome,
        ordem,
        materia_id
      )
    `)
    .eq("ativo", true)
    .order("data_evento", { ascending: true })
    .order("hora_evento", { ascending: true });

  if (error) {
    console.error("Erro ao carregar eventos para badge:", error);
    return [];
  }

  return (data || []).filter((evento) => alunoPodeVerEvento(evento, matriculasAtivas));
}

async function sincronizarConvitesElegiveis(alunoIdAtual, eventosElegiveis) {
  if (!eventosElegiveis.length) return [];

  const idsEventosElegiveis = eventosElegiveis.map((evento) => evento.id);

  const { data: convitesExistentes, error: erroConvites } = await supabase
    .from("evento_convite_aluno")
    .select("id, evento_id, visualizado")
    .eq("aluno_id", alunoIdAtual)
    .in("evento_id", idsEventosElegiveis);

  if (erroConvites) {
    console.error("Erro ao buscar convites existentes:", erroConvites);
    return [];
  }

  const eventoIdsComConvite = new Set(
    (convitesExistentes || []).map((item) => Number(item.evento_id))
  );

  const convitesFaltantes = idsEventosElegiveis
    .filter((eventoId) => !eventoIdsComConvite.has(Number(eventoId)))
    .map((eventoId) => ({
      evento_id: eventoId,
      aluno_id: Number(alunoIdAtual)
    }));

  if (convitesFaltantes.length) {
    const { error: erroUpsert } = await supabase
      .from("evento_convite_aluno")
      .upsert(convitesFaltantes, {
        onConflict: "evento_id,aluno_id",
        ignoreDuplicates: true
      });

    if (erroUpsert) {
      console.error("Erro ao criar convites faltantes:", erroUpsert);
    }
  }

  const { data: convitesAtualizados, error: erroAtualizados } = await supabase
    .from("evento_convite_aluno")
    .select("id, evento_id, visualizado")
    .eq("aluno_id", alunoIdAtual)
    .in("evento_id", idsEventosElegiveis);

  if (erroAtualizados) {
    console.error("Erro ao recarregar convites:", erroAtualizados);
    return convitesExistentes || [];
  }

  return convitesAtualizados || [];
}

/* ======================
   carregar badge de eventos
====================== */
async function carregarBadgeEventos() {
  try {
    const matriculasAtivas = await carregarMatriculasAtivasDoAluno();
    const eventosElegiveis = await carregarEventosElegiveisDoAluno(matriculasAtivas);
    const convites = await sincronizarConvitesElegiveis(alunoId, eventosElegiveis);

    const totalNaoVisualizados = convites.filter((convite) => !convite.visualizado).length;
    atualizarBadgeEventos(totalNaoVisualizados);
  } catch (erro) {
    console.error("Erro inesperado ao carregar badge de eventos:", erro);
    atualizarBadgeEventos(0);
  }
}

/* ======================
   carregar dados do aluno
====================== */
async function carregarAluno() {
  try {
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

      await carregarBadgeEventos();
      return;
    }

    saudacao.textContent = `Olá, ${aluno.nome}!`;

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

      await carregarBadgeEventos();
      return;
    }

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

    await carregarBadgeEventos();
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

    await carregarBadgeEventos();
  }
}

/* ======================
   sair
====================== */
btnSair.addEventListener("click", () => {
  localStorage.removeItem("alunoId");
  sessionStorage.removeItem("alunoId");
  sessionStorage.removeItem("aluno_id");
  sessionStorage.removeItem("idAluno");
  localStorage.removeItem("aluno_id");
  localStorage.removeItem("idAluno");
  window.location.href = "login.html";
});

/* ======================
   iniciar
====================== */
carregarAluno();