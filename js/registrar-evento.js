import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

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
const eventoId = Number(params.get("evento"));

let evento = null;
let participantes = [];
let registrando = false;

/* =========================================================
   INICIALIZAÇÃO
========================================================= */
inicializar();

async function inicializar() {
  try {
    await exigirAdmin();

    if (!Number.isFinite(eventoId) || eventoId <= 0) {
      mostrarMensagem("Evento não informado ou inválido na URL.", "erro");
      tituloEventoEl.textContent = "Evento não encontrado";
      subtituloEventoEl.textContent = "";
      btnRegistrarEvento.disabled = true;
      return;
    }

    btnRegistrarEvento.addEventListener("click", registrarParticipacao);

    await carregarTela();
  } catch (erro) {
    console.error("Erro na inicialização da página:", erro);
    mostrarMensagem("Não foi possível abrir esta página.", "erro");
    tituloEventoEl.textContent = "Erro ao carregar";
    subtituloEventoEl.textContent = "";
    btnRegistrarEvento.disabled = true;
  }
}

/* =========================================================
   UTILITÁRIOS
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

function formatarData(dataStr) {
  if (!dataStr) return "-";
  const [ano, mes, dia] = String(dataStr).split("-");
  if (!ano || !mes || !dia) return dataStr;
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
  totalSelecionadosEl.textContent = participantes.length;
}

function definirBotaoRegistrando(ativo) {
  registrando = ativo;
  btnRegistrarEvento.disabled = ativo;

  if (ativo) {
    btnRegistrarEvento.textContent = "Registrando...";
  } else {
    btnRegistrarEvento.textContent = "Registrar participação";
  }
}

/* =========================================================
   BUSCAS
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
      participacao_registrada,
      professor_responsavel_id,
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

  const lista = (data || [])
    .filter((item) => item.aluno?.id && item.aluno?.nome)
    .map((item) => ({
      aluno_id: Number(item.aluno.id),
      nome: item.aluno.nome
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return lista;
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
    .select("id, matricula_id, evento_id, status")
    .eq("evento_id", eventoId)
    .eq("status", "Evento");

  if (error) {
    console.error("Erro ao buscar registros existentes:", error);
    throw new Error("Não foi possível verificar registros já existentes do evento.");
  }

  return data || [];
}

/* =========================================================
   REGRAS DE ESCOLHA DA MATRÍCULA
========================================================= */
function escolherMatriculaParaEvento(matriculasDoAluno, eventoAtual) {
  if (!matriculasDoAluno.length) return null;

  if (eventoAtual.materia_id) {
    const daMateria = matriculasDoAluno.find(
      (matricula) => Number(matricula.materia_id) === Number(eventoAtual.materia_id)
    );

    if (daMateria) return daMateria;
  }

  if (eventoAtual.professor_responsavel_id) {
    const doProfessor = matriculasDoAluno.find(
      (matricula) =>
        Number(matricula.professor_id) === Number(eventoAtual.professor_responsavel_id)
    );

    if (doProfessor) return doProfessor;
  }

  return matriculasDoAluno[0];
}

/* =========================================================
   RENDER
========================================================= */
function renderizarCabecalhoEvento() {
  if (!evento) return;

  const responsavel = evento.professor_responsavel?.nome || "Não informado";
  const local = evento.local ? ` • Local: ${evento.local}` : "";

  tituloEventoEl.textContent = evento.titulo || "Evento";
  subtituloEventoEl.textContent =
    `${evento.tipo_evento || "Evento"} • ${formatarData(evento.data_evento)} às ${formatarHora(evento.hora_evento)} • Responsável: ${responsavel}${local}`;
}

function renderizarParticipantes() {
  if (!participantes.length) {
    listaParticipantesEl.innerHTML = `
      <p style="margin:0;">Nenhum participante restante na lista.</p>
    `;
    atualizarTotal();
    return;
  }

  listaParticipantesEl.innerHTML = participantes
    .map((participante, index) => `
      <div
        class="card"
        style="display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px; margin-bottom:10px;"
      >
        <div style="min-width:0;">
          <strong>${escaparHtml(participante.nome)}</strong>
        </div>

        <button
          type="button"
          class="btn-remover-participante"
          data-index="${index}"
          style="
            background:#ff6b6b;
            color:white;
            border:none;
            border-radius:8px;
            cursor:pointer;
            width:34px;
            height:34px;
            font-size:18px;
            flex-shrink:0;
          "
          aria-label="Remover participante"
          title="Remover participante"
        >
          ✕
        </button>
      </div>
    `)
    .join("");

  document.querySelectorAll(".btn-remover-participante").forEach((botao) => {
    botao.addEventListener("click", () => {
      const index = Number(botao.dataset.index);

      if (!Number.isInteger(index) || index < 0 || index >= participantes.length) return;

      participantes.splice(index, 1);
      renderizarParticipantes();
    });
  });

  atualizarTotal();
}

/* =========================================================
   FLUXO
========================================================= */
async function carregarTela() {
  esconderMensagem();

  try {
    evento = await buscarEvento();

    renderizarCabecalhoEvento();

    if (!evento.ativo) {
      mostrarMensagem("Este evento está inativo/cancelado e não pode ser registrado.", "erro");
      btnRegistrarEvento.disabled = true;
      return;
    }

    if (evento.participacao_registrada) {
      mostrarMensagem("A participação deste evento já foi registrada anteriormente.", "erro");
      btnRegistrarEvento.disabled = true;
      return;
    }

    participantes = await buscarConfirmadosDoEvento();
    renderizarParticipantes();

    if (!participantes.length) {
      mostrarMensagem("Este evento ainda não possui alunos confirmados.", "erro");
      btnRegistrarEvento.disabled = true;
      return;
    }

    btnRegistrarEvento.disabled = false;
  } catch (erro) {
    console.error(erro);
    mostrarMensagem(erro.message || "Erro ao carregar a tela.", "erro");
    tituloEventoEl.textContent = "Erro ao carregar evento";
    subtituloEventoEl.textContent = "";
    btnRegistrarEvento.disabled = true;
  }
}

async function registrarParticipacao() {
  esconderMensagem();

  if (registrando) return;

  if (!evento) {
    mostrarMensagem("Evento não carregado.", "erro");
    return;
  }

  if (!evento.ativo) {
    mostrarMensagem("Evento cancelado não pode ser registrado.", "erro");
    return;
  }

  if (evento.participacao_registrada) {
    mostrarMensagem("A participação deste evento já foi registrada.", "erro");
    return;
  }

  if (!participantes.length) {
    mostrarMensagem("Não há participantes para registrar.", "erro");
    return;
  }

  definirBotaoRegistrando(true);

  try {
    const alunosIds = participantes.map((item) => Number(item.aluno_id));

    const [matriculasAtivas, registrosExistentes] = await Promise.all([
      buscarMatriculasAtivasDosAlunos(alunosIds),
      buscarRegistrosJaExistentesPorEvento()
    ]);

    const matriculasPorAluno = new Map();

    for (const matricula of matriculasAtivas) {
      const alunoId = Number(matricula.aluno_id);

      if (!matriculasPorAluno.has(alunoId)) {
        matriculasPorAluno.set(alunoId, []);
      }

      matriculasPorAluno.get(alunoId).push(matricula);
    }

    const matriculasJaRegistradas = new Set(
      registrosExistentes.map((item) => Number(item.matricula_id))
    );

    const registrosParaInserir = [];
    const nomesSemMatricula = [];
    const nomesJaRegistrados = [];

    for (const participante of participantes) {
      const matriculasDoAluno = matriculasPorAluno.get(Number(participante.aluno_id)) || [];
      const matriculaEscolhida = escolherMatriculaParaEvento(matriculasDoAluno, evento);

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
        duracao_minutos: null,
        professor_id: evento.professor_responsavel_id
          ? Number(evento.professor_responsavel_id)
          : null,
        parte: 1,
        modulo_id: matriculaEscolhida.modulo_id
          ? Number(matriculaEscolhida.modulo_id)
          : null,
        aula_gravada: false,
        precisa_reposicao: false,
        aula_original_id: null,
        reposicao_com_custo: false,
        evento_id: Number(evento.id)
      });

      matriculasJaRegistradas.add(Number(matriculaEscolhida.id));
    }

    if (!registrosParaInserir.length) {
      let mensagem = "Nenhum novo registro foi criado.";

      if (nomesJaRegistrados.length) {
        mensagem += " Os participantes já haviam sido registrados anteriormente.";
      } else if (nomesSemMatricula.length) {
        mensagem += " Nenhum participante restante possui matrícula ativa compatível.";
      }

      mostrarMensagem(mensagem, "erro");
      return;
    }

    const { error: erroInsert } = await supabase
      .from("aula")
      .insert(registrosParaInserir);

    if (erroInsert) {
      console.error("Erro ao registrar participação:", erroInsert);
      throw new Error("Não foi possível registrar a participação dos alunos.");
    }

    const { error: erroEvento } = await supabase
      .from("evento")
      .update({ participacao_registrada: true })
      .eq("id", eventoId);

    if (erroEvento) {
      console.error("Erro ao marcar evento como registrado:", erroEvento);
      throw new Error("A participação foi salva nas aulas, mas não foi possível marcar o evento como registrado.");
    }

    evento.participacao_registrada = true;

    let mensagem = `✅ Participação registrada com sucesso para ${registrosParaInserir.length} aluno(s).`;

    if (nomesJaRegistrados.length) {
      mensagem += ` ${nomesJaRegistrados.length} já estavam registrados.`;
    }

    if (nomesSemMatricula.length) {
      mensagem += ` ${nomesSemMatricula.length} ficaram de fora por não terem matrícula ativa compatível.`;
    }

    mostrarMensagem(mensagem, "sucesso");

    participantes = [];
    renderizarParticipantes();
    btnRegistrarEvento.disabled = true;

    setTimeout(() => {
      window.location.href = "eventos.html";
    }, 1500);
  } catch (erro) {
    console.error(erro);
    mostrarMensagem(erro.message || "Erro ao registrar participação.", "erro");
  } finally {
    definirBotaoRegistrando(false);

    if (evento?.participacao_registrada) {
      btnRegistrarEvento.disabled = true;
    }
  }
}