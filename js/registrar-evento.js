import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

/* =========================================================
   ELEMENTOS
========================================================= */
const msg = document.getElementById("msg");

const tituloEventoEl = document.getElementById("tituloEvento");
const subtituloEventoEl = document.getElementById("subtituloEvento");
const listaParticipantesEl = document.getElementById("listaParticipantes");
const totalSelecionadosEl = document.getElementById("totalSelecionados");
const btnRegistrarEvento = document.getElementById("btnRegistrarEvento");

/* =========================================================
   ESTADO
========================================================= */
const params = new URLSearchParams(window.location.search);

const eventoId = Number(
  params.get("evento") ||
  params.get("evento_id") ||
  params.get("id")
);

let evento = null;
let participantes = [];
let registrando = false;

/* =========================================================
   INICIALIZAÇÃO
========================================================= */
async function inicializar() {
  try {
    if (!Number.isFinite(eventoId) || eventoId <= 0) {
      mostrarMensagem("Evento não informado ou inválido na URL.", "erro");

      if (tituloEventoEl) tituloEventoEl.textContent = "Evento não encontrado";
      if (subtituloEventoEl) subtituloEventoEl.textContent = "";
      if (btnRegistrarEvento) btnRegistrarEvento.disabled = true;

      return;
    }

    if (btnRegistrarEvento) {
      btnRegistrarEvento.addEventListener("click", registrarParticipacao);
    }

    await carregarTela();
  } catch (erro) {
    console.error("Erro na inicialização da página:", erro);

    mostrarMensagem("Não foi possível abrir esta página.", "erro");

    if (tituloEventoEl) tituloEventoEl.textContent = "Erro ao carregar";
    if (subtituloEventoEl) subtituloEventoEl.textContent = "";
    if (btnRegistrarEvento) btnRegistrarEvento.disabled = true;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializar);
} else {
  await inicializar();
}

/* =========================================================
   MENSAGENS
========================================================= */
function mostrarMensagem(texto, tipo = "sucesso") {
  if (!msg) return;

  msg.style.display = "block";
  msg.textContent = texto;
  msg.style.padding = "10px";
  msg.style.borderRadius = "10px";
  msg.style.marginBottom = "12px";

  if (tipo === "erro") {
    msg.style.background = "#ffe5e5";
    msg.style.color = "#7a1f1f";
    msg.style.border = "1px solid #e5b4b4";
  } else {
    msg.style.background = "#e8f7e8";
    msg.style.color = "#1d5e1d";
    msg.style.border = "1px solid #b8deb8";
  }
}

function esconderMensagem() {
  if (!msg) return;

  msg.style.display = "none";
  msg.textContent = "";
}

/* =========================================================
   UTILITÁRIOS
========================================================= */
function formatarData(dataStr) {
  if (!dataStr) return "-";

  const partes = String(dataStr).split("-");

  if (partes.length !== 3) {
    return dataStr;
  }

  const [ano, mes, dia] = partes;

  return `${dia}/${mes}/${ano}`;
}

function formatarHora(horaStr) {
  if (!horaStr) return "-";

  return String(horaStr).slice(0, 5);
}

function escaparHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function atualizarTotal() {
  if (!totalSelecionadosEl) return;

  totalSelecionadosEl.textContent = String(participantes.length);
}

function definirBotaoRegistrando(ativo) {
  registrando = ativo;

  if (!btnRegistrarEvento) return;

  btnRegistrarEvento.disabled = ativo;
  btnRegistrarEvento.textContent = ativo
    ? "Registrando..."
    : "Registrar participação";
}

function obterProfessorResponsavelId(eventoAtual) {
  return (
    eventoAtual?.professor_responsavel_id ||
    eventoAtual?.professor_id ||
    null
  );
}

function obterNomeProfessorResponsavel(eventoAtual) {
  return (
    eventoAtual?.professor_responsavel?.nome ||
    eventoAtual?.professor?.nome ||
    "Não informado"
  );
}

function eventoJaFoiRegistrado(eventoAtual, registrosExistentes = []) {
  return Boolean(
    eventoAtual?.registrado === true ||
    eventoAtual?.participacao_registrada === true ||
    registrosExistentes.length > 0
  );
}

/* =========================================================
   BUSCAS NO BANCO
========================================================= */
async function buscarEvento() {
  const { data, error } = await supabase
    .from("evento")
    .select(`
      id,
      titulo,
      descricao,
      tipo_evento,
      data_evento,
      hora_evento,
      local,
      publico_alvo,
      materia_id,
      modulo_id,
      ativo,
      registrado,
      registrado_em,
      participacao_registrada,
      professor_id,
      professor_responsavel_id,
      professor:professor_id (
        id,
        nome
      ),
      professor_responsavel:professor_responsavel_id (
        id,
        nome
      )
    `)
    .eq("id", eventoId)
    .single();

  if (error) {
    console.error("Erro ao buscar evento:", error);
    throw new Error("Não foi possível carregar o evento.");
  }

  return data;
}

async function buscarConfirmadosDoEvento() {
  const { data, error } = await supabase
    .from("evento_confirmacao")
    .select(`
      id,
      evento_id,
      aluno_id,
      created_at,
      aluno:aluno_id (
        id,
        nome
      )
    `)
    .eq("evento_id", eventoId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao buscar confirmados:", error);
    throw new Error("Não foi possível carregar os alunos confirmados.");
  }

  return (data || [])
    .filter((item) => item.aluno?.id && item.aluno?.nome)
    .map((item) => ({
      aluno_id: Number(item.aluno.id),
      nome: item.aluno.nome
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

async function buscarMatriculasAtivasDosAlunos(alunosIds) {
  if (!alunosIds.length) return [];

  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno_id,
      materia_id,
      modulo_id,
      professor_id,
      data_inicio,
      ativa
    `)
    .in("aluno_id", alunosIds)
    .eq("ativa", true)
    .order("data_inicio", { ascending: false });

  if (error) {
    console.error("Erro ao buscar matrículas ativas:", error);
    throw new Error("Não foi possível buscar as matrículas ativas dos alunos.");
  }

  return data || [];
}

async function buscarRegistrosJaExistentesPorEvento() {
  const { data, error } = await supabase
    .from("aula")
    .select(`
      id,
      matricula_id,
      evento_id,
      status
    `)
    .eq("evento_id", eventoId)
    .eq("status", "Evento");

  if (error) {
    console.error("Erro ao buscar registros existentes:", error);
    throw new Error("Não foi possível verificar registros já existentes do evento.");
  }

  return data || [];
}

/* =========================================================
   REGRAS DE MATRÍCULA
========================================================= */
function escolherMatriculaParaEvento(matriculasDoAluno, eventoAtual) {
  if (!matriculasDoAluno.length) return null;

  const professorResponsavelId = obterProfessorResponsavelId(eventoAtual);

  /*
    1. Se o evento tem matéria/curso, usa a matrícula dessa matéria.
  */
  if (eventoAtual.materia_id) {
    const matriculaDaMateria = matriculasDoAluno.find(
      (matricula) =>
        Number(matricula.materia_id) === Number(eventoAtual.materia_id)
    );

    if (matriculaDaMateria) {
      return matriculaDaMateria;
    }
  }

  /*
    2. Se não encontrou pela matéria, tenta pelo professor responsável.
  */
  if (professorResponsavelId) {
    const matriculaDoProfessor = matriculasDoAluno.find(
      (matricula) =>
        Number(matricula.professor_id) === Number(professorResponsavelId)
    );

    if (matriculaDoProfessor) {
      return matriculaDoProfessor;
    }
  }

  /*
    3. Última opção: matrícula ativa mais recente.
  */
  return matriculasDoAluno[0];
}

/* =========================================================
   RENDER
========================================================= */
function renderizarCabecalhoEvento() {
  if (!evento) return;

  const responsavel = obterNomeProfessorResponsavel(evento);
  const local = evento.local ? ` • Local: ${evento.local}` : "";

  if (tituloEventoEl) {
    tituloEventoEl.textContent = evento.titulo || "Evento";
  }

  if (subtituloEventoEl) {
    subtituloEventoEl.textContent =
      `${evento.tipo_evento || "Evento"} • ` +
      `${formatarData(evento.data_evento)} às ${formatarHora(evento.hora_evento)} • ` +
      `Responsável: ${responsavel}${local}`;
  }
}

function renderizarParticipantes() {
  if (!listaParticipantesEl) return;

  if (!participantes.length) {
    listaParticipantesEl.innerHTML = `
      <div class="card" style="margin-top:10px;">
        <p style="margin:0;">
          Nenhum participante selecionado para registrar.
        </p>

        <p style="margin:6px 0 0 0; opacity:0.85;">
          Se o evento aconteceu sem participantes, clique em
          <strong>Registrar participação</strong> para marcar o evento como realizado sem alunos.
        </p>
      </div>
    `;

    atualizarTotal();
    return;
  }

  listaParticipantesEl.innerHTML = participantes
    .map((participante, index) => `
      <div class="item-participante-evento">
        <span>${escaparHtml(participante.nome)}</span>

        <button
          type="button"
          class="btn-remover-participante"
          data-index="${index}"
          title="Remover da participação"
        >
          ✕
        </button>
      </div>
    `)
    .join("");

  document.querySelectorAll(".btn-remover-participante").forEach((botao) => {
    botao.addEventListener("click", () => {
      const index = Number(botao.dataset.index);

      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= participantes.length
      ) {
        return;
      }

      participantes.splice(index, 1);
      renderizarParticipantes();
    });
  });

  atualizarTotal();
}

/* =========================================================
   ATUALIZAR TABELA EVENTO
========================================================= */
async function marcarEventoComoRegistrado(teveParticipacaoReal) {
  const { error } = await supabase
    .from("evento")
    .update({
      registrado: true,
      registrado_em: new Date().toISOString(),
      participacao_registrada: teveParticipacaoReal === true
    })
    .eq("id", eventoId);

  if (error) {
    console.error("Erro ao marcar evento como registrado:", error);

    throw new Error(
      "A participação foi salva, mas não foi possível marcar o evento como registrado."
    );
  }

  if (evento) {
    evento.registrado = true;
    evento.registrado_em = new Date().toISOString();
    evento.participacao_registrada = teveParticipacaoReal === true;
  }
}

/* =========================================================
   FLUXO DA TELA
========================================================= */
async function carregarTela() {
  esconderMensagem();

  try {
    evento = await buscarEvento();
    renderizarCabecalhoEvento();

    const registrosExistentes = await buscarRegistrosJaExistentesPorEvento();

    if (evento.ativo === false) {
      mostrarMensagem(
        "Este evento está inativo/cancelado e não pode ser registrado.",
        "erro"
      );

      if (btnRegistrarEvento) btnRegistrarEvento.disabled = true;

      return;
    }

    if (eventoJaFoiRegistrado(evento, registrosExistentes)) {
      const totalRegistros = registrosExistentes.length;

      if (totalRegistros > 0) {
        mostrarMensagem(
          `Este evento já foi registrado anteriormente com ${totalRegistros} participação(ões).`,
          "erro"
        );
      } else {
        mostrarMensagem(
          "Este evento já foi registrado anteriormente sem participantes.",
          "erro"
        );
      }

      if (btnRegistrarEvento) btnRegistrarEvento.disabled = true;

      return;
    }

    participantes = await buscarConfirmadosDoEvento();
    renderizarParticipantes();

    /*
      Mesmo sem participantes, o botão fica ativo.
      Assim o admin pode registrar que o evento aconteceu sem alunos.
    */
    if (btnRegistrarEvento) {
      btnRegistrarEvento.disabled = false;
      btnRegistrarEvento.textContent = "Registrar participação";
    }

    if (!participantes.length) {
      mostrarMensagem(
        "Este evento não possui alunos confirmados. Você ainda pode registrá-lo como realizado sem participantes.",
        "sucesso"
      );
    }
  } catch (erro) {
    console.error(erro);

    mostrarMensagem(erro.message || "Erro ao carregar a tela.", "erro");

    if (tituloEventoEl) tituloEventoEl.textContent = "Erro ao carregar evento";
    if (subtituloEventoEl) subtituloEventoEl.textContent = "";
    if (btnRegistrarEvento) btnRegistrarEvento.disabled = true;
  }
}

/* =========================================================
   REGISTRO SEM PARTICIPANTES
========================================================= */
async function registrarEventoSemParticipantes() {
  /*
    Evento realizado sem alunos:
    - Não cria aula.
    - Marca o evento como registrado.
    - participacao_registrada fica false.
  */
  await marcarEventoComoRegistrado(false);
}

/* =========================================================
   REGISTRO COM PARTICIPANTES
========================================================= */
async function registrarEventoComParticipantes() {
  const professorResponsavelId = obterProfessorResponsavelId(evento);

  if (!professorResponsavelId) {
    throw new Error(
      "Este evento não possui professor responsável/anfitrião cadastrado. Cadastre o professor responsável antes de registrar a participação."
    );
  }

  const alunosIds = participantes.map((item) => Number(item.aluno_id));

  const [matriculasAtivas, registrosExistentes] = await Promise.all([
    buscarMatriculasAtivasDosAlunos(alunosIds),
    buscarRegistrosJaExistentesPorEvento()
  ]);

  const matriculasPorAluno = new Map();

  for (const matricula of matriculasAtivas) {
    const alunoIdAtual = Number(matricula.aluno_id);

    if (!matriculasPorAluno.has(alunoIdAtual)) {
      matriculasPorAluno.set(alunoIdAtual, []);
    }

    matriculasPorAluno.get(alunoIdAtual).push(matricula);
  }

  const matriculasJaRegistradas = new Set(
    registrosExistentes.map((item) => Number(item.matricula_id))
  );

  const registrosParaInserir = [];
  const nomesSemMatricula = [];
  const nomesJaRegistrados = [];

  const quantidadeAlunosEvento = participantes.length;
  const grupoAulaId = `evento-${evento.id}`;

  for (const participante of participantes) {
    const matriculasDoAluno =
      matriculasPorAluno.get(Number(participante.aluno_id)) || [];

    const matriculaEscolhida = escolherMatriculaParaEvento(
      matriculasDoAluno,
      evento
    );

    if (!matriculaEscolhida) {
      nomesSemMatricula.push(participante.nome);
      continue;
    }

    if (matriculasJaRegistradas.has(Number(matriculaEscolhida.id))) {
      nomesJaRegistrados.push(participante.nome);
      continue;
    }

    registrosParaInserir.push({
      data_aula: evento.data_evento,
      status: "Evento",
      justificativa: null,
      conteudo: `Participação em evento: ${evento.titulo}`,
      licao_casa: null,
      matricula_id: Number(matriculaEscolhida.id),

      /*
        Sua tabela aula usa duração em segundos.
        Para evento, deixamos null porque a duração pode ser ajustada depois no financeiro.
      */
      duracao_segundos: null,

      professor_id: Number(professorResponsavelId),
      parte: 1,

      modulo_id: matriculaEscolhida.modulo_id
        ? Number(matriculaEscolhida.modulo_id)
        : null,

      aula_gravada: false,
      precisa_reposicao: false,
      aula_original_id: null,
      reposicao_com_custo: false,

      evento_id: Number(evento.id),

      /*
        Evento entra como aula coletiva.
      */
      aula_coletiva: true,
      grupo_aula_id: grupoAulaId,
      quantidade_alunos: quantidadeAlunosEvento
    });

    matriculasJaRegistradas.add(Number(matriculaEscolhida.id));
  }

  /*
    Se ninguém pôde ser inserido, o evento ainda fica registrado.
    Mas só fica com participacao_registrada = true se já existia aula Evento antes.
  */
  if (!registrosParaInserir.length) {
    const jaTinhaParticipacaoReal = registrosExistentes.length > 0;

    await marcarEventoComoRegistrado(jaTinhaParticipacaoReal);

    let mensagem = jaTinhaParticipacaoReal
      ? "Evento marcado como registrado. As participações já estavam salvas anteriormente."
      : "Evento registrado como realizado sem participantes.";

    if (nomesJaRegistrados.length) {
      mensagem += ` ${nomesJaRegistrados.length} aluno(s) já tinham registro anterior.`;
    }

    if (nomesSemMatricula.length) {
      mensagem += ` ${nomesSemMatricula.length} aluno(s) não tinham matrícula ativa compatível.`;
    }

    return {
      quantidadeInserida: 0,
      nomesSemMatricula,
      nomesJaRegistrados,
      mensagem
    };
  }

  const { error: erroInsert } = await supabase
    .from("aula")
    .insert(registrosParaInserir);

  if (erroInsert) {
    console.error("Erro ao registrar participação:", erroInsert);

    throw new Error(
      "Não foi possível registrar a participação dos alunos na tabela aula."
    );
  }

  /*
    Este era o ponto que estava causando inconsistência:
    agora o evento também fica oficialmente registrado.
  */
  await marcarEventoComoRegistrado(true);

  return {
    quantidadeInserida: registrosParaInserir.length,
    nomesSemMatricula,
    nomesJaRegistrados,
    mensagem: `Participação registrada com sucesso para ${registrosParaInserir.length} aluno(s).`
  };
}

/* =========================================================
   AÇÃO PRINCIPAL
========================================================= */
async function registrarParticipacao() {
  esconderMensagem();

  if (registrando) return;

  if (!evento) {
    mostrarMensagem("Evento não carregado.", "erro");
    return;
  }

  if (evento.ativo === false) {
    mostrarMensagem("Evento cancelado não pode ser registrado.", "erro");
    return;
  }

  const registrosExistentes = await buscarRegistrosJaExistentesPorEvento();

  if (eventoJaFoiRegistrado(evento, registrosExistentes)) {
    mostrarMensagem("Este evento já foi registrado.", "erro");

    if (btnRegistrarEvento) {
      btnRegistrarEvento.disabled = true;
    }

    return;
  }

  definirBotaoRegistrando(true);

  try {
    /*
      CASO 1:
      Evento aconteceu, mas ninguém participou.
      Não cria aula.
      Apenas marca o evento como registrado.
    */
    if (!participantes.length) {
      await registrarEventoSemParticipantes();

      mostrarMensagem(
        "✅ Evento registrado como realizado sem participantes.",
        "sucesso"
      );

      if (btnRegistrarEvento) {
        btnRegistrarEvento.disabled = true;
      }

      setTimeout(() => {
        window.location.href = "eventos.html";
      }, 1500);

      return;
    }

    /*
      CASO 2:
      Evento aconteceu com participantes.
      Cria aula com status Evento para os alunos selecionados.
    */
    const resultado = await registrarEventoComParticipantes();

    let mensagem = `✅ ${resultado.mensagem}`;

    if (resultado.nomesJaRegistrados.length) {
      mensagem += ` ${resultado.nomesJaRegistrados.length} aluno(s) já estavam registrados.`;
    }

    if (resultado.nomesSemMatricula.length) {
      mensagem += ` ${resultado.nomesSemMatricula.length} aluno(s) ficaram de fora por não terem matrícula ativa compatível.`;
    }

    mostrarMensagem(mensagem, "sucesso");

    participantes = [];
    renderizarParticipantes();

    if (btnRegistrarEvento) {
      btnRegistrarEvento.disabled = true;
    }

    setTimeout(() => {
      window.location.href = "eventos.html";
    }, 1500);
  } catch (erro) {
    console.error(erro);
    mostrarMensagem(erro.message || "Erro ao registrar participação.", "erro");
  } finally {
    definirBotaoRegistrando(false);

    if (
      (evento?.registrado === true || evento?.participacao_registrada === true) &&
      btnRegistrarEvento
    ) {
      btnRegistrarEvento.disabled = true;
    }
  }
}