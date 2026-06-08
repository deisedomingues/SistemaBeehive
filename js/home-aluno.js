import { supabase } from "./supabase.js";
import { exigirAluno } from "./guard.js";

await exigirAluno();

const saudacao = document.getElementById("saudacao");
const btnSair = document.getElementById("btnSair");
const btnZoom = document.getElementById("btnZoom");
const btnYoutube = document.getElementById("btnYoutube");
const btnMaterialEstudo = document.getElementById("btnMaterialEstudo");

const textoCardZoom = document.getElementById("textoCardZoom");
const textoCardYoutube = document.getElementById("textoCardYoutube");
const textoCardMaterialEstudo = document.getElementById("textoCardMaterialEstudo");
const textoCardReposicao = document.getElementById("textoCardReposicao");
const textoCardPainel = document.getElementById("textoCardPainel");

const badgeEventos = document.getElementById("badgeEventos");
const textoEventosHome = document.getElementById("textoEventosHome");

const btnAvaliacoes = document.getElementById("btnAvaliacoes");
const badgeAvaliacoes = document.getElementById("badgeAvaliacoes");
const textoAvaliacoesHome = document.getElementById("textoAvaliacoesHome");

const badgeComunicados = document.getElementById("badgeComunicados");
const textoComunicadosHome = document.getElementById("textoComunicadosHome");

const blocoCursoAtual = document.getElementById("blocoCursoAtual");
const textoCursoAtual = document.getElementById("textoCursoAtual");
const labelSelectMatricula = document.getElementById("labelSelectMatricula");
const selectMatricula = document.getElementById("selectMatricula");

const linkEventos = document.querySelector('a[href="evento-confirmacao.html"]');

const alunoId =
  localStorage.getItem("alunoId") ||
  localStorage.getItem("aluno_id") ||
  localStorage.getItem("idAluno");

if (!alunoId) {
  window.location.href = "index.html";
}

let matriculasAtivas = [];
let matriculaSelecionada = null;
let eventosElegiveisAtuais = [];

function desabilitarCard(linkEl, tituloIndisponivel, descricaoIndisponivel) {
  if (!linkEl) return;

  linkEl.removeAttribute("href");
  linkEl.removeAttribute("target");
  linkEl.removeAttribute("rel");
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

function atualizarBadgeEventos(totalAlertas) {
  if (!badgeEventos || !textoEventosHome) return;

  if (!totalAlertas || totalAlertas <= 0) {
    badgeEventos.style.display = "none";
    badgeEventos.textContent = "0";
    textoEventosHome.textContent =
      "Consulte os eventos da escola e confirme sua participação.";
    return;
  }

  badgeEventos.style.display = "inline-flex";
  badgeEventos.textContent = totalAlertas > 99 ? "99+" : String(totalAlertas);

  textoEventosHome.textContent =
    totalAlertas === 1
      ? "Você tem 1 evento novo para visualizar."
      : `Você tem ${totalAlertas} eventos novos para visualizar.`;
}

function atualizarBadgeAvaliacoes(totalPendentes) {
  if (!btnAvaliacoes || !badgeAvaliacoes || !textoAvaliacoesHome) return;

  btnAvaliacoes.style.display = "block";
  btnAvaliacoes.href = "avaliacoes-aluno.html";
  btnAvaliacoes.classList.remove("link-indisponivel");

  if (!totalPendentes || totalPendentes <= 0) {
    badgeAvaliacoes.style.display = "none";
    badgeAvaliacoes.textContent = "0";
    textoAvaliacoesHome.textContent =
      "Você não possui avaliações pendentes no momento.";
    return;
  }

  badgeAvaliacoes.style.display = "inline-flex";
  badgeAvaliacoes.textContent = totalPendentes > 99 ? "99+" : String(totalPendentes);

  textoAvaliacoesHome.textContent =
    totalPendentes === 1
      ? "Você tem 1 avaliação pendente para realizar."
      : `Você tem ${totalPendentes} avaliações pendentes para realizar.`;
}

function atualizarBadgeComunicados(totalNovos) {
  if (!badgeComunicados || !textoComunicadosHome) return;

  if (!totalNovos || totalNovos <= 0) {
    badgeComunicados.style.display = "none";
    badgeComunicados.textContent = "0";
    textoComunicadosHome.textContent =
      "Veja os comunicados importantes da escola.";
    return;
  }

  badgeComunicados.style.display = "inline-flex";
  badgeComunicados.textContent = totalNovos > 99 ? "99+" : String(totalNovos);

  textoComunicadosHome.textContent =
    totalNovos === 1
      ? "Você tem 1 comunicado novo para visualizar."
      : `Você tem ${totalNovos} comunicados novos para visualizar.`;
}

function eventoJaAconteceu(evento) {
  if (!evento?.data_evento || !evento?.hora_evento) return false;
  const dataHoraEvento = new Date(`${evento.data_evento}T${evento.hora_evento}`);
  return dataHoraEvento < new Date();
}

function comunicadoEstaExpirado(comunicado) {
  if (!comunicado.data_expiracao) return false;

  const partes = String(comunicado.data_expiracao).split("-");
  const ano = Number(partes[0]);
  const mes = Number(partes[1]) - 1;
  const dia = Number(partes[2]);

  const fimDoDia = new Date(ano, mes, dia, 23, 59, 59, 999);
  return fimDoDia < new Date();
}

function alunoPodeVerEvento(evento, matriculasDoAluno) {
  if (!evento?.ativo) return false;
  if (eventoJaAconteceu(evento)) return false;
  if (!matriculasDoAluno.length) return false;

  if (evento.publico_alvo === "todos") return true;

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

      return (
        mesmaMateria &&
        ordemAluno !== null &&
        Number(ordemAluno) >= Number(ordemEvento)
      );
    });
  }

  return false;
}

function alunoPodeVerComunicado(comunicado, matriculasDoAluno) {
  if (!comunicado?.ativo) return false;
  if (comunicadoEstaExpirado(comunicado)) return false;

  if (comunicado.publico_alvo === "todos") return true;

  if (!matriculasDoAluno.length) return false;

  if (comunicado.publico_alvo === "materia") {
    return matriculasDoAluno.some(
      (matricula) => Number(matricula.materia_id) === Number(comunicado.materia_id)
    );
  }

  if (comunicado.publico_alvo === "modulo_exato") {
    return matriculasDoAluno.some(
      (matricula) =>
        Number(matricula.materia_id) === Number(comunicado.materia_id) &&
        Number(matricula.modulo_id) === Number(comunicado.modulo_id)
    );
  }

  if (comunicado.publico_alvo === "modulo_a_partir") {
    const ordemComunicado = comunicado.modulo?.ordem ?? null;
    if (ordemComunicado === null) return false;

    return matriculasDoAluno.some((matricula) => {
      const mesmaMateria =
        Number(matricula.materia_id) === Number(comunicado.materia_id);

      const ordemAluno = matricula.modulo?.ordem ?? null;

      return (
        mesmaMateria &&
        ordemAluno !== null &&
        Number(ordemAluno) >= Number(ordemComunicado)
      );
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

  textoCursoAtual.textContent =
    matriculasAtivas.length === 1
      ? `Você está matriculado(a) em: ${nomeCurso}.`
      : `Curso atualmente selecionado: ${nomeCurso}.`;

  if (textoCardReposicao) {
    textoCardReposicao.textContent =
      `Agende reposições, plantões de dúvidas ou aulas instrumentais de ${nomeCurso}.`;
  }

  if (textoCardPainel) {
    textoCardPainel.textContent =
      `Acompanhe frequência, histórico e informações da sua jornada em ${nomeCurso}.`;
  }
}

function atualizarCardsLinksBasicos() {
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

    desabilitarCard(
      btnMaterialEstudo,
      "Material indisponível",
      "Não foi possível identificar um curso ativo para este aluno."
    );

    if (textoCardReposicao) {
      textoCardReposicao.textContent =
        "Selecione um curso para visualizar seus agendamentos.";
    }

    if (textoCardPainel) {
      textoCardPainel.textContent =
        "Selecione um curso para visualizar seu painel acadêmico.";
    }

    atualizarBadgeAvaliacoes(0);
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

  labelSelectMatricula.style.display =
    matriculasAtivas.length > 1 ? "block" : "none";

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

  matriculaSelecionada = encontradaSalva || matriculasAtivas[0];
  salvarContextoDaMatricula(matriculaSelecionada);
}

async function atualizarCardMaterialEstudo() {
  if (!btnMaterialEstudo || !textoCardMaterialEstudo) return;

  if (!matriculaSelecionada?.materia_id || !matriculaSelecionada?.modulo_id) {
    desabilitarCard(
      btnMaterialEstudo,
      "Material indisponível",
      "Não foi possível identificar o curso e o módulo da matrícula selecionada."
    );
    return;
  }

  const nomeCurso = montarNomeCurso(matriculaSelecionada);

  try {
    const { data, error } = await supabase
      .from("material_estudo")
      .select("id, titulo, link_drive, ativo")
      .eq("materia_id", matriculaSelecionada.materia_id)
      .eq("modulo_id", matriculaSelecionada.modulo_id)
      .eq("ativo", true)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar material de estudo:", error);

      desabilitarCard(
        btnMaterialEstudo,
        "Material indisponível",
        `Não foi possível carregar o material de estudo de ${nomeCurso}.`
      );

      return;
    }

    if (!data?.link_drive) {
      desabilitarCard(
        btnMaterialEstudo,
        "Material indisponível",
        `O material de estudo de ${nomeCurso} ainda não foi cadastrado.`
      );

      return;
    }

    habilitarCard(btnMaterialEstudo, data.link_drive);

    const tituloMaterial = btnMaterialEstudo.querySelector(".card-admin-conteudo h2");
    if (tituloMaterial) tituloMaterial.textContent = "Ver material de estudo";

    textoCardMaterialEstudo.textContent =
      `Acesse livros, workbooks e materiais do módulo ${nomeCurso}.`;
  } catch (erro) {
    console.error("Erro inesperado ao carregar material de estudo:", erro);

    desabilitarCard(
      btnMaterialEstudo,
      "Material indisponível",
      `Ocorreu um erro ao carregar o material de estudo de ${nomeCurso}.`
    );
  }
}

async function atualizarTelaComMatriculaSelecionada() {
  atualizarResumoDoCursoSelecionado();
  atualizarCardsLinksBasicos();

  if (matriculaSelecionada) {
    salvarContextoDaMatricula(matriculaSelecionada);
  }

  await atualizarCardMaterialEstudo();
  await carregarBadgeAvaliacoes();
  await carregarBadgeComunicados();
}

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

  return (data || []).filter((evento) =>
    alunoPodeVerEvento(evento, matriculasDoAluno)
  );
}

async function sincronizarConvitesElegiveis(alunoIdAtual, eventosElegiveis) {
  if (!eventosElegiveis.length) return [];

  const idsEventosElegiveis = eventosElegiveis.map((evento) => Number(evento.id));

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
      aluno_id: Number(alunoIdAtual),
      visualizado: false
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
    eventosElegiveisAtuais = await carregarEventosElegiveisDoAluno(matriculasAtivas);
    const convites = await sincronizarConvitesElegiveis(alunoId, eventosElegiveisAtuais);

    const totalNaoVisualizados = convites.filter(
      (convite) => !convite.visualizado
    ).length;

    atualizarBadgeEventos(totalNaoVisualizados);
  } catch (erro) {
    console.error("Erro inesperado ao carregar badge de eventos:", erro);
    atualizarBadgeEventos(0);
  }
}

async function marcarEventosComoVisualizados() {
  try {
    if (!eventosElegiveisAtuais.length) return;

    const registros = eventosElegiveisAtuais.map((evento) => ({
      evento_id: Number(evento.id),
      aluno_id: Number(alunoId),
      visualizado: true
    }));

    const { error } = await supabase
      .from("evento_convite_aluno")
      .upsert(registros, {
        onConflict: "evento_id,aluno_id"
      });

    if (error) {
      console.error("Erro ao marcar eventos como visualizados:", error);
    }
  } catch (erro) {
    console.error("Erro inesperado ao marcar eventos como visualizados:", erro);
  }
}

async function carregarBadgeAvaliacoes() {
  try {
    if (!alunoId) {
      atualizarBadgeAvaliacoes(0);
      return;
    }

    let query = supabase
      .from("avaliacao_aluno")
      .select("id", { count: "exact", head: true })
      .eq("aluno_id", alunoId)
      .eq("status", "Pendente");

    if (matriculaSelecionada?.id) {
      query = query.eq("matricula_id", matriculaSelecionada.id);
    }

    const { count, error } = await query;

    if (error) {
      console.error("Erro ao carregar avaliações pendentes:", error);
      atualizarBadgeAvaliacoes(0);
      return;
    }

    atualizarBadgeAvaliacoes(count || 0);
  } catch (erro) {
    console.error("Erro inesperado ao carregar badge de avaliações:", erro);
    atualizarBadgeAvaliacoes(0);
  }
}

async function carregarComunicadosElegiveisDoAluno(matriculasDoAluno) {
  const { data, error } = await supabase
    .from("comunicado")
    .select(`
      id,
      titulo,
      texto,
      publico_alvo,
      materia_id,
      modulo_id,
      data_expiracao,
      ativo,
      data_publicacao,
      criado_em,
      modulo:modulo_id (
        id,
        nome,
        ordem,
        materia_id
      )
    `)
    .eq("ativo", true)
    .order("data_publicacao", { ascending: false });

  if (error) {
    console.error("Erro ao carregar comunicados para badge:", error);
    return [];
  }

  return (data || []).filter((comunicado) =>
    alunoPodeVerComunicado(comunicado, matriculasDoAluno)
  );
}

async function sincronizarVisualizacoesComunicados(alunoIdAtual, comunicadosElegiveis) {
  if (!comunicadosElegiveis.length) return [];

  const idsComunicadosElegiveis = comunicadosElegiveis.map((comunicado) =>
    Number(comunicado.id)
  );

  const { data: visualizacoesExistentes, error: erroVisualizacoes } = await supabase
    .from("comunicado_visualizacao_aluno")
    .select("id, comunicado_id, visto")
    .eq("aluno_id", alunoIdAtual)
    .in("comunicado_id", idsComunicadosElegiveis);

  if (erroVisualizacoes) {
    console.error("Erro ao buscar visualizações de comunicados:", erroVisualizacoes);
    return [];
  }

  const comunicadoIdsComVisualizacao = new Set(
    (visualizacoesExistentes || []).map((item) => Number(item.comunicado_id))
  );

  const visualizacoesFaltantes = idsComunicadosElegiveis
    .filter((comunicadoId) => !comunicadoIdsComVisualizacao.has(Number(comunicadoId)))
    .map((comunicadoId) => ({
      comunicado_id: Number(comunicadoId),
      aluno_id: Number(alunoIdAtual),
      visto: false
    }));

  if (visualizacoesFaltantes.length) {
    const { error: erroUpsert } = await supabase
      .from("comunicado_visualizacao_aluno")
      .upsert(visualizacoesFaltantes, {
        onConflict: "comunicado_id,aluno_id",
        ignoreDuplicates: true
      });

    if (erroUpsert) {
      console.error("Erro ao criar visualizações faltantes:", erroUpsert);
    }
  }

  const { data: visualizacoesAtualizadas, error: erroAtualizadas } = await supabase
    .from("comunicado_visualizacao_aluno")
    .select("id, comunicado_id, visto")
    .eq("aluno_id", alunoIdAtual)
    .in("comunicado_id", idsComunicadosElegiveis);

  if (erroAtualizadas) {
    console.error("Erro ao recarregar visualizações de comunicados:", erroAtualizadas);
    return visualizacoesExistentes || [];
  }

  return visualizacoesAtualizadas || [];
}

async function carregarBadgeComunicados() {
  try {
    if (!alunoId) {
      atualizarBadgeComunicados(0);
      return;
    }

    const comunicadosElegiveis =
      await carregarComunicadosElegiveisDoAluno(matriculasAtivas);

    const visualizacoes =
      await sincronizarVisualizacoesComunicados(alunoId, comunicadosElegiveis);

    const totalNaoVistos = visualizacoes.filter((item) => !item.visto).length;

    atualizarBadgeComunicados(totalNaoVistos);
  } catch (erro) {
    console.error("Erro inesperado ao carregar badge de comunicados:", erro);
    atualizarBadgeComunicados(0);
  }
}

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

      desabilitarCard(
        btnMaterialEstudo,
        "Material indisponível",
        "Não foi possível carregar seus dados no momento."
      );

      if (blocoCursoAtual) blocoCursoAtual.style.display = "block";

      if (textoCursoAtual) {
        textoCursoAtual.textContent =
          "Não foi possível carregar os cursos deste aluno.";
      }

      atualizarBadgeAvaliacoes(0);
      await carregarBadgeEventos();
      await carregarBadgeComunicados();
      return;
    }

    saudacao.textContent = `Olá, ${aluno.nome}!`;

    matriculasAtivas = await carregarMatriculasAtivasDoAluno();

    if (!matriculasAtivas.length) {
      if (blocoCursoAtual) blocoCursoAtual.style.display = "block";

      if (textoCursoAtual) {
        textoCursoAtual.textContent =
          "Você ainda não possui curso ativo disponível no sistema.";
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

      desabilitarCard(
        btnMaterialEstudo,
        "Material indisponível",
        "Você precisa ter uma matrícula ativa para acessar o material de estudo."
      );

      if (textoCardReposicao) {
        textoCardReposicao.textContent =
          "Você precisa ter uma matrícula ativa para visualizar seus agendamentos.";
      }

      if (textoCardPainel) {
        textoCardPainel.textContent =
          "Você precisa ter uma matrícula ativa para visualizar seu painel acadêmico.";
      }

      atualizarBadgeAvaliacoes(0);
      await carregarBadgeEventos();
      await carregarBadgeComunicados();
      return;
    }

    definirMatriculaSelecionadaInicial();
    preencherSelectMatriculas();

    await atualizarTelaComMatriculaSelecionada();
    await carregarBadgeEventos();
    await carregarBadgeAvaliacoes();
    await carregarBadgeComunicados();
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

    desabilitarCard(
      btnMaterialEstudo,
      "Material indisponível",
      "Ocorreu um erro ao carregar sua área."
    );

    if (blocoCursoAtual) blocoCursoAtual.style.display = "block";

    if (textoCursoAtual) {
      textoCursoAtual.textContent =
        "Ocorreu um erro ao carregar os cursos deste aluno.";
    }

    atualizarBadgeAvaliacoes(0);
    await carregarBadgeEventos();
    await carregarBadgeComunicados();
  }
}

if (selectMatricula) {
  selectMatricula.addEventListener("change", async () => {
    const matriculaIdSelecionada = selectMatricula.value;

    const encontrada = matriculasAtivas.find(
      (matricula) => String(matricula.id) === String(matriculaIdSelecionada)
    );

    if (!encontrada) return;

    matriculaSelecionada = encontrada;

    await atualizarTelaComMatriculaSelecionada();
    await carregarBadgeAvaliacoes();
    await carregarBadgeEventos();
    await carregarBadgeComunicados();
  });
}

if (linkEventos) {
  linkEventos.addEventListener("click", async (event) => {
    event.preventDefault();

    await marcarEventosComoVisualizados();

    window.location.href = "evento-confirmacao.html";
  });
}

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

  window.location.href = "index.html";
});

carregarAluno();