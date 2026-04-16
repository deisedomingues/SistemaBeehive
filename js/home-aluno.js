import { supabase } from "./supabase.js";
import { exigirAluno } from "./guard.js";

await exigirAluno();

const saudacao = document.getElementById("saudacao");
const btnSair = document.getElementById("btnSair");
const btnZoom = document.getElementById("btnZoom");
const btnYoutube = document.getElementById("btnYoutube");

const textoCardZoom = document.getElementById("textoCardZoom");
const textoCardYoutube = document.getElementById("textoCardYoutube");
const textoCardReposicao = document.getElementById("textoCardReposicao");
const textoCardPainel = document.getElementById("textoCardPainel");

const badgeEventos = document.getElementById("badgeEventos");
const textoEventosHome = document.getElementById("textoEventosHome");

const blocoCursoAtual = document.getElementById("blocoCursoAtual");
const textoCursoAtual = document.getElementById("textoCursoAtual");
const labelSelectMatricula = document.getElementById("labelSelectMatricula");
const selectMatricula = document.getElementById("selectMatricula");

const alunoId =
  localStorage.getItem("alunoId") ||
  localStorage.getItem("aluno_id") ||
  localStorage.getItem("idAluno");

if (!alunoId) {
  window.location.href = "login.html";
}

let matriculasAtivas = [];
let matriculaSelecionada = null;

/* ======================
   utilitários
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

function habilitarCard(linkEl, href) {
  if (!linkEl || !href) return;

  linkEl.href = href;
  linkEl.target = "_blank";
  linkEl.rel = "noopener noreferrer";
  linkEl.classList.remove("link-indisponivel");
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

function alunoPodeVerEvento(evento, matriculasDoAluno) {
  if (!evento?.ativo) return false;
  if (eventoJaAconteceu(evento)) return false;
  if (!matriculasDoAluno.length) return false;

  if (evento.publico_alvo === "todos") {
    return true;
  }

  if (evento.publico_alvo === "materia") {
    return matriculasDoAluno.some(
      (matricula) => Number(matricula.materia_id) === Number(evento.materia_id)
    );
  }

  if (evento.publico_alvo === "modulo_exato") {
    return matriculasDoAluno.some(
      (matricula) =>
        Number(matricula.materia_id) === Number(evento.materia_id) &&
        Number(matricula.modulo_id) === Number(evento.modulo_id)
    );
  }

  if (evento.publico_alvo === "modulo_a_partir") {
    const ordemEvento = evento.modulo?.ordem ?? null;
    if (ordemEvento === null) return false;

    return matriculasDoAluno.some((matricula) => {
      const mesmaMateria = Number(matricula.materia_id) === Number(evento.materia_id);
      const ordemAluno = matricula.modulo?.ordem ?? null;

      return mesmaMateria && ordemAluno !== null && Number(ordemAluno) >= Number(ordemEvento);
    });
  }

  return false;
}

function montarNomeCurso(matricula) {
  const nomeMateria = matricula?.materia?.nome || "Curso";
  const nomeModulo = matricula?.modulo?.nome || "Módulo não informado";
  return `${nomeMateria} — ${nomeModulo}`;
}

function salvarContextoDaMatricula(matricula) {
  if (!matricula?.id) return;

  localStorage.setItem("matriculaSelecionadaId", String(matricula.id));
  localStorage.setItem("materiaSelecionadaId", String(matricula.materia_id || ""));
  localStorage.setItem("moduloSelecionadoId", String(matricula.modulo_id || ""));
  localStorage.setItem("nomeCursoSelecionado", montarNomeCurso(matricula));
}

function atualizarResumoDoCursoSelecionado() {
  if (!blocoCursoAtual || !textoCursoAtual) return;

  blocoCursoAtual.style.display = "block";

  if (!matriculaSelecionada) {
    textoCursoAtual.textContent = "Nenhum curso ativo encontrado.";
    return;
  }

  const nomeCurso = montarNomeCurso(matriculaSelecionada);

  if (matriculasAtivas.length === 1) {
    textoCursoAtual.textContent = `Você está matriculado(a) em: ${nomeCurso}.`;
  } else {
    textoCursoAtual.textContent = `Curso atualmente selecionado: ${nomeCurso}.`;
  }

  if (textoCardReposicao) {
    textoCardReposicao.textContent =
      `Veja horários disponíveis para marcar suas reposições de ${nomeCurso}.`;
  }

  if (textoCardPainel) {
    textoCardPainel.textContent =
      `Acompanhe frequência, histórico e informações da sua jornada em ${nomeCurso}.`;
  }
}

function atualizarCardsLinks() {
  if (!matriculaSelecionada) {
    desabilitarCard(
      btnZoom,
      "Aula ao vivo indisponível",
      "Não foi possível identificar um curso ativo para este aluno."
    );

    desabilitarCard(
      btnYoutube,
      "Aulas gravadas indisponíveis",
      "Não foi possível identificar um curso ativo para este aluno."
    );

    if (textoCardReposicao) {
      textoCardReposicao.textContent =
        "Selecione um curso para visualizar suas reposições.";
    }

    if (textoCardPainel) {
      textoCardPainel.textContent =
        "Selecione um curso para visualizar seu painel acadêmico.";
    }

    return;
  }

  const nomeCurso = montarNomeCurso(matriculaSelecionada);

  if (matriculaSelecionada.link_zoom) {
    habilitarCard(btnZoom, matriculaSelecionada.link_zoom);
    const tituloZoom = btnZoom?.querySelector(".card-admin-conteudo h2");
    if (tituloZoom) tituloZoom.textContent = "Entrar na aula ao vivo";

    if (textoCardZoom) {
      textoCardZoom.textContent =
        `Acesse rapidamente o link da sua aula online de ${nomeCurso}.`;
    }
  } else {
    desabilitarCard(
      btnZoom,
      "Aula ao vivo indisponível",
      `O link da aula ao vivo de ${nomeCurso} ainda não foi cadastrado.`
    );
  }

  if (matriculaSelecionada.link_youtube) {
    habilitarCard(btnYoutube, matriculaSelecionada.link_youtube);
    const tituloYoutube = btnYoutube?.querySelector(".card-admin-conteudo h2");
    if (tituloYoutube) tituloYoutube.textContent = "Assistir aulas gravadas";

    if (textoCardYoutube) {
      textoCardYoutube.textContent =
        `Veja ou reveja as aulas gravadas disponíveis para ${nomeCurso}.`;
    }
  } else {
    desabilitarCard(
      btnYoutube,
      "Aulas gravadas indisponíveis",
      `A playlist de ${nomeCurso} ainda não foi cadastrada.`
    );
  }
}

function preencherSelectMatriculas() {
  if (!selectMatricula || !labelSelectMatricula || !blocoCursoAtual) return;

  blocoCursoAtual.style.display = "block";
  selectMatricula.innerHTML = "";

  if (!matriculasAtivas.length) {
    labelSelectMatricula.style.display = "none";
    return;
  }

  matriculasAtivas.forEach((matricula) => {
    const option = document.createElement("option");
    option.value = String(matricula.id);
    option.textContent = montarNomeCurso(matricula);
    selectMatricula.appendChild(option);
  });

  if (matriculasAtivas.length > 1) {
    labelSelectMatricula.style.display = "block";
  } else {
    labelSelectMatricula.style.display = "none";
  }

  if (matriculaSelecionada?.id) {
    selectMatricula.value = String(matriculaSelecionada.id);
  }
}

function definirMatriculaSelecionadaInicial() {
  if (!matriculasAtivas.length) {
    matriculaSelecionada = null;
    return;
  }

  const matriculaSalvaId = localStorage.getItem("matriculaSelecionadaId");

  const encontradaSalva = matriculasAtivas.find(
    (matricula) => String(matricula.id) === String(matriculaSalvaId)
  );

  if (encontradaSalva) {
    matriculaSelecionada = encontradaSalva;
    return;
  }

  matriculaSelecionada = matriculasAtivas[0];
  salvarContextoDaMatricula(matriculaSelecionada);
}

function atualizarTelaComMatriculaSelecionada() {
  atualizarResumoDoCursoSelecionado();
  atualizarCardsLinks();

  if (matriculaSelecionada) {
    salvarContextoDaMatricula(matriculaSelecionada);
  }
}

/* ======================
   banco de dados
====================== */
async function carregarMatriculasAtivasDoAluno() {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno_id,
      materia_id,
      modulo_id,
      professor_id,
      ativa,
      link_zoom,
      link_youtube,
      materia:materia_id (
        id,
        nome
      ),
      modulo:modulo_id (
        id,
        nome,
        ordem,
        materia_id
      )
    `)
    .eq("aluno_id", alunoId)
    .eq("ativa", true)
    .order("id", { ascending: true });

  if (error) {
    console.error("Erro ao carregar matrículas ativas do aluno:", error);
    return [];
  }

  return data || [];
}

async function carregarEventosElegiveisDoAluno(matriculasDoAluno) {
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

  return (data || []).filter((evento) => alunoPodeVerEvento(evento, matriculasDoAluno));
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
      evento_id: Number(eventoId),
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

async function carregarBadgeEventos() {
  try {
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
   carga da home
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

      if (blocoCursoAtual) blocoCursoAtual.style.display = "block";
      if (textoCursoAtual) {
        textoCursoAtual.textContent = "Não foi possível carregar os cursos deste aluno.";
      }

      await carregarBadgeEventos();
      return;
    }

    saudacao.textContent = `Olá, ${aluno.nome}!`;

    matriculasAtivas = await carregarMatriculasAtivasDoAluno();

    if (!matriculasAtivas.length) {
      if (blocoCursoAtual) blocoCursoAtual.style.display = "block";
      if (textoCursoAtual) {
        textoCursoAtual.textContent = "Você ainda não possui curso ativo disponível no sistema.";
      }

      desabilitarCard(
        btnZoom,
        "Aula ao vivo indisponível",
        "Você não possui matrícula ativa no momento."
      );

      desabilitarCard(
        btnYoutube,
        "Aulas gravadas indisponíveis",
        "Você não possui matrícula ativa no momento."
      );

      if (textoCardReposicao) {
        textoCardReposicao.textContent =
          "Você precisa ter uma matrícula ativa para visualizar suas reposições.";
      }

      if (textoCardPainel) {
        textoCardPainel.textContent =
          "Você precisa ter uma matrícula ativa para visualizar seu painel acadêmico.";
      }

      await carregarBadgeEventos();
      return;
    }

    definirMatriculaSelecionadaInicial();
    preencherSelectMatriculas();
    atualizarTelaComMatriculaSelecionada();
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

    if (blocoCursoAtual) blocoCursoAtual.style.display = "block";
    if (textoCursoAtual) {
      textoCursoAtual.textContent = "Ocorreu um erro ao carregar os cursos deste aluno.";
    }

    await carregarBadgeEventos();
  }
}

/* ======================
   troca de curso
====================== */
if (selectMatricula) {
  selectMatricula.addEventListener("change", () => {
    const matriculaIdSelecionada = selectMatricula.value;

    const encontrada = matriculasAtivas.find(
      (matricula) => String(matricula.id) === String(matriculaIdSelecionada)
    );

    if (!encontrada) return;

    matriculaSelecionada = encontrada;
    atualizarTelaComMatriculaSelecionada();
  });
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

  localStorage.removeItem("matriculaSelecionadaId");
  localStorage.removeItem("materiaSelecionadaId");
  localStorage.removeItem("moduloSelecionadoId");
  localStorage.removeItem("nomeCursoSelecionado");

  window.location.href = "login.html";
});

/* ======================
   iniciar
====================== */
carregarAluno();