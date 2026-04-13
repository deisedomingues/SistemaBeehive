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
const eventoId = Number(params.get("evento"));

let evento = null;
let participantes = [];

/* =========================================================
   INICIALIZAÇÃO
========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  if (!eventoId) {
    mostrarMensagem("Evento não informado na URL.", "erro");
    tituloEventoEl.textContent = "Evento não encontrado";
    btnRegistrarEvento.disabled = true;
    return;
  }

  await carregarTela();
});

/* =========================================================
   UTILITÁRIOS
========================================================= */
function mostrarMensagem(texto, tipo = "sucesso") {
  msg.style.display = "block";
  msg.textContent = texto;
  msg.style.padding = "10px";
  msg.style.borderRadius = "10px";

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
  msg.style.display = "none";
  msg.textContent = "";
}

function formatarData(dataStr) {
  if (!dataStr) return "-";
  const [ano, mes, dia] = dataStr.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarHora(horaStr) {
  if (!horaStr) return "-";
  return horaStr.slice(0, 5);
}

function escaparHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
    }));

  lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

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
      data_inicio,
      ativa
    `)
    .in("aluno_id", alunosIds)
    .eq("ativa", true)
    .order("data_inicio", { ascending: true });

  if (error) {
    console.error("Erro ao buscar matrículas ativas:", error);
    throw new Error("Não foi possível buscar as matrículas ativas dos alunos.");
  }

  return data || [];
}

async function buscarRegistrosJaExistentes(alunosIds) {
  if (!alunosIds.length) return [];

  const matriculasAtivas = await buscarMatriculasAtivasDosAlunos(alunosIds);
  const matriculasIds = matriculasAtivas.map((item) => item.id);

  if (!matriculasIds.length) return [];

  const { data, error } = await supabase
    .from("aula")
    .select("id, matricula_id, evento_id, status")
    .eq("evento_id", eventoId)
    .eq("status", "Evento")
    .in("matricula_id", matriculasIds);

  if (error) {
    console.error("Erro ao buscar registros existentes:", error);
    throw new Error("Não foi possível verificar registros já existentes do evento.");
  }

  return data || [];
}

/* =========================================================
   REGRAS
========================================================= */
function escolherMatriculaParaEvento(matriculasDoAluno, eventoAtual) {
  if (!matriculasDoAluno.length) return null;

  if (eventoAtual.materia_id) {
    const matriculaDaMateria = matriculasDoAluno.find(
      (matricula) => Number(matricula.materia_id) === Number(eventoAtual.materia_id)
    );

    if (matriculaDaMateria) {
      return matriculaDaMateria;
    }
  }

  return matriculasDoAluno[0] || null;
}

/* =========================================================
   RENDER
========================================================= */
function renderizarCabecalhoEvento() {
  if (!evento) return;

  const responsavel = evento.professor_responsavel?.nome || "Não informado";

  tituloEventoEl.textContent = evento.titulo || "Evento";
  subtituloEventoEl.textContent =
    `${evento.tipo_evento || "Evento"} • ${formatarData(evento.data_evento)} às ${formatarHora(evento.hora_evento)} • Responsável: ${responsavel}`;
}

function atualizarTotal() {
  totalSelecionadosEl.textContent = participantes.length;
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
        <div>
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

    if (!evento.ativo) {
      mostrarMensagem("Este evento está cancelado e não pode ser registrado.", "erro");
      btnRegistrarEvento.disabled = true;
    }

    participantes = await buscarConfirmadosDoEvento();

    renderizarCabecalhoEvento();
    renderizarParticipantes();

    if (!participantes.length) {
      mostrarMensagem("Este evento ainda não possui alunos confirmados.", "erro");
      btnRegistrarEvento.disabled = true;
    }
  } catch (erro) {
    console.error(erro);
    mostrarMensagem(erro.message || "Erro ao carregar a tela.", "erro");
    tituloEventoEl.textContent = "Erro ao carregar evento";
    btnRegistrarEvento.disabled = true;
  }
}

async function registrarParticipacao() {
  esconderMensagem();

  if (!evento) {
    mostrarMensagem("Evento não carregado.", "erro");
    return;
  }

  if (!evento.ativo) {
    mostrarMensagem("Evento cancelado não pode ser registrado.", "erro");
    return;
  }

  if (!participantes.length) {
    mostrarMensagem("Não há participantes para registrar.", "erro");
    return;
  }

  btnRegistrarEvento.disabled = true;
  btnRegistrarEvento.textContent = "Registrando...";

  try {
    const alunosIds = participantes.map((item) => item.aluno_id);

    const matriculasAtivas = await buscarMatriculasAtivasDosAlunos(alunosIds);
    const registrosExistentes = await buscarRegistrosJaExistentes(alunosIds);

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
        modulo_id: matriculaEscolhida.modulo_id ? Number(matriculaEscolhida.modulo_id) : null,
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

    const { error } = await supabase
      .from("aula")
      .insert(registrosParaInserir);

    if (error) {
      console.error("Erro ao registrar participação:", error);
      throw new Error("Não foi possível registrar a participação dos alunos.");
    }

    let mensagem = `✅ Participação registrada com sucesso para ${registrosParaInserir.length} aluno(s).`;

    if (nomesJaRegistrados.length) {
      mensagem += ` ${nomesJaRegistrados.length} já estavam registrados.`;
    }

    if (nomesSemMatricula.length) {
      mensagem += ` ${nomesSemMatricula.length} ficaram de fora por não terem matrícula ativa compatível.`;
    }

    mostrarMensagem(mensagem, "sucesso");

    setTimeout(() => {
      window.location.href = "eventos.html";
    }, 1800);
  } catch (erro) {
    console.error(erro);
    mostrarMensagem(erro.message || "Erro ao registrar participação.", "erro");
  } finally {
    btnRegistrarEvento.disabled = false;
    btnRegistrarEvento.textContent = "Registrar participação";
  }
}

/* =========================================================
   EVENTOS
========================================================= */
btnRegistrarEvento.addEventListener("click", registrarParticipacao);