import { supabase } from "./supabase.js";
import { exigirAluno } from "./guard.js";

await exigirAluno();

const listaReposicoes = document.getElementById("listaReposicoes");
const msg = document.getElementById("msg");
const faltasAluno = document.getElementById("faltasAluno");
const textoSelecao = document.getElementById("textoSelecao");
const alertaCobrancaReposicao = document.getElementById("alertaCobrancaReposicao");

const blocoCursoReposicao = document.getElementById("blocoCursoReposicao");
const textoCursoReposicao = document.getElementById("textoCursoReposicao");
const labelSelectMatriculaReposicao = document.getElementById("labelSelectMatriculaReposicao");
const selectMatriculaReposicao = document.getElementById("selectMatriculaReposicao");

let alunoAtual = null;
let matriculasAtivas = [];
let matriculaSelecionada = null;
let aulasPendentes = [];
let aulaSelecionadaId = null;

// =============================
// whatsapp da escola
// =============================
const TELEFONE_ESCOLA = "5511956177084";
const MENSAGEM_CANCELAMENTO = "Olá! Gostaria de cancelar uma reposição agendada.";

function gerarLinkWhatsApp() {
  return `https://wa.me/${TELEFONE_ESCOLA}?text=${encodeURIComponent(MENSAGEM_CANCELAMENTO)}`;
}

// =============================
// mensagem
// =============================
function mostrarMensagem(texto, erro = false) {
  if (!msg) return;

  msg.textContent = texto;
  msg.className = erro ? "msg-erro" : "msg-sucesso";
  msg.style.display = "block";

  setTimeout(() => {
    msg.textContent = "";
    msg.className = "";
    msg.style.display = "none";
  }, 4000);
}

// =============================
// utilitários gerais
// =============================
function formatarDataBR(dataISO) {
  if (!dataISO) return "";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function textoStatusBonito(status) {
  if (!status) return "Aula";

  const s = status.trim().toLowerCase();

  if (s === "ausente") return "Ausente";
  if (s === "cancelada") return "Cancelada";

  return status;
}

function textoJustificativa(justificativa) {
  if (!justificativa || !justificativa.trim()) {
    return "Sem justificativa informada.";
  }

  return justificativa.trim();
}

function montarNomeCurso(matricula) {
  const materia = matricula?.materia?.nome || "Curso";
  const modulo = matricula?.modulo?.nome || "Módulo não informado";
  return `${materia} — ${modulo}`;
}

function salvarMatriculaSelecionada(matricula) {
  if (!matricula?.id) return;

  localStorage.setItem("matriculaSelecionadaId", String(matricula.id));
  localStorage.setItem("materiaSelecionadaId", String(matricula.materia_id || ""));
  localStorage.setItem("moduloSelecionadoId", String(matricula.modulo_id || ""));
  localStorage.setItem("nomeCursoSelecionado", montarNomeCurso(matricula));
}

function obterAlunoIdLogado() {
  return (
    localStorage.getItem("alunoId") ||
    localStorage.getItem("aluno_id") ||
    localStorage.getItem("idAluno") ||
    sessionStorage.getItem("alunoId") ||
    sessionStorage.getItem("aluno_id") ||
    sessionStorage.getItem("idAluno")
  );
}

// =============================
// datas locais
// =============================
function criarDataLocal(dataISO, hora = 0, minuto = 0, segundo = 0) {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  return new Date(ano, mes - 1, dia, hora, minuto, segundo);
}

// =============================
// regra do prazo
// até 21h do dia anterior
// =============================
function obterPrazoLimiteAgendamento(dataReposicao) {
  const limite = criarDataLocal(dataReposicao, 21, 0, 0);
  limite.setDate(limite.getDate() - 1);
  return limite;
}

function podeAgendarHorario(dataReposicao) {
  const agora = new Date();
  const limite = obterPrazoLimiteAgendamento(dataReposicao);
  return agora <= limite;
}

function formatarPrazoLimite(dataReposicao) {
  const limite = obterPrazoLimiteAgendamento(dataReposicao);

  const dia = String(limite.getDate()).padStart(2, "0");
  const mes = String(limite.getMonth() + 1).padStart(2, "0");
  const ano = limite.getFullYear();
  const hora = String(limite.getHours()).padStart(2, "0");
  const minuto = String(limite.getMinutes()).padStart(2, "0");

  return `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
}

// =============================
// regra cobrança
// ausente + mês diferente = cobra
// cancelada = nunca cobra
// =============================
function extrairAnoMes(dataISO) {
  const [ano, mes] = dataISO.split("-");
  return { ano: Number(ano), mes: Number(mes) };
}

function reposicaoGeraCobranca(statusAula, dataAulaFaltada, dataReposicao) {
  if (!statusAula || !dataAulaFaltada || !dataReposicao) return false;

  const statusNormalizado = statusAula.trim().toLowerCase();

  if (statusNormalizado === "cancelada") {
    return false;
  }

  if (statusNormalizado !== "ausente") {
    return false;
  }

  const aula = extrairAnoMes(dataAulaFaltada);
  const reposicao = extrairAnoMes(dataReposicao);

  return aula.ano !== reposicao.ano || aula.mes !== reposicao.mes;
}

function atualizarAlertaCobranca() {
  if (!alertaCobrancaReposicao) return;

  if (!aulaSelecionadaId) {
    alertaCobrancaReposicao.style.display = "none";
    alertaCobrancaReposicao.innerHTML = "";
    return;
  }

  const aulaSelecionada = aulasPendentes.find((a) => a.id === aulaSelecionadaId);

  if (!aulaSelecionada) {
    alertaCobrancaReposicao.style.display = "none";
    alertaCobrancaReposicao.innerHTML = "";
    return;
  }

  const dataDaFalta = formatarDataBR(aulaSelecionada.data_aula);
  const statusNormalizado = (aulaSelecionada.status || "").trim().toLowerCase();

  alertaCobrancaReposicao.style.display = "block";

  if (statusNormalizado === "cancelada") {
    alertaCobrancaReposicao.innerHTML = `
      <div style="padding:12px; border-radius:10px; background:#ecfdf3; border:1px solid #12b76a;">
        <p style="margin:0;">
          <strong>Atenção:</strong> a aula selecionada foi <strong>cancelada</strong> em <strong>${dataDaFalta}</strong>.
          Reposições de aulas canceladas <strong>não geram cobrança</strong>, mesmo quando agendadas para outro mês.
        </p>
      </div>
    `;
    return;
  }

  alertaCobrancaReposicao.innerHTML = `
    <div style="padding:12px; border-radius:10px; background:rgba(255,245,204,0.88); border:1px solid #f1bc32;">
      <p style="margin:0;">
        <strong>Atenção:</strong> se esta reposição for agendada para <strong>mês diferente</strong> da aula ausente de
        <strong>${dataDaFalta}</strong>, será gerada cobrança de <strong>R$ 25,00</strong>.
      </p>
    </div>
  `;
}

// =============================
// curso selecionado
// =============================
function definirMatriculaSelecionadaInicial() {
  if (!matriculasAtivas.length) {
    matriculaSelecionada = null;
    return;
  }

  const idSalvo = localStorage.getItem("matriculaSelecionadaId");

  const encontrada = matriculasAtivas.find(
    (m) => String(m.id) === String(idSalvo)
  );

  if (encontrada) {
    matriculaSelecionada = encontrada;
    return;
  }

  matriculaSelecionada = matriculasAtivas[0];
  salvarMatriculaSelecionada(matriculaSelecionada);
}

function preencherSelectMatriculas() {
  if (!blocoCursoReposicao || !textoCursoReposicao || !labelSelectMatriculaReposicao || !selectMatriculaReposicao) {
    return;
  }

  blocoCursoReposicao.style.display = "block";
  selectMatriculaReposicao.innerHTML = "";

  matriculasAtivas.forEach((matricula) => {
    const option = document.createElement("option");
    option.value = String(matricula.id);
    option.textContent = montarNomeCurso(matricula);
    selectMatriculaReposicao.appendChild(option);
  });

  if (matriculasAtivas.length > 1) {
    labelSelectMatriculaReposicao.style.display = "block";
  } else {
    labelSelectMatriculaReposicao.style.display = "none";
  }

  if (matriculaSelecionada?.id) {
    selectMatriculaReposicao.value = String(matriculaSelecionada.id);
    textoCursoReposicao.textContent =
      `Você está visualizando as reposições do curso ${montarNomeCurso(matriculaSelecionada)}.`;
  } else {
    textoCursoReposicao.textContent = "Nenhum curso ativo encontrado.";
  }
}

// =============================
// buscar aluno logado
// =============================
async function buscarAluno() {
  const alunoId = obterAlunoIdLogado();

  if (!alunoId) {
    mostrarMensagem("Erro ao identificar o aluno.", true);
    return null;
  }

  const { data: aluno, error: errAluno } = await supabase
    .from("aluno")
    .select("id, nome")
    .eq("id", alunoId)
    .maybeSingle();

  if (errAluno || !aluno) {
    console.error("Aluno não encontrado:", errAluno);
    mostrarMensagem("Aluno não encontrado.", true);
    return null;
  }

  return {
    id: aluno.id,
    nome: aluno.nome
  };
}

// =============================
// buscar matrículas ativas
// =============================
async function buscarMatriculasAtivas(alunoId) {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno_id,
      materia_id,
      modulo_id,
      ativa,
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
    console.error("Erro ao carregar matrículas ativas:", error);
    throw error;
  }

  return data || [];
}

// =============================
// buscar aulas pendentes
// =============================
async function buscarAulasPendentes(matriculaId) {
  const { data, error } = await supabase
    .from("aula")
    .select("id, data_aula, status, justificativa, aula_gravada, precisa_reposicao")
    .eq("matricula_id", matriculaId)
    .in("status", ["Ausente", "Cancelada", "ausente", "cancelada"])
    .eq("aula_gravada", false)
    .eq("precisa_reposicao", true)
    .order("data_aula", { ascending: true });

  if (error) {
    console.error("Erro ao buscar aulas pendentes:", error);
    throw error;
  }

  return data || [];
}

// =============================
// buscar reposições ativas da matrícula
// =============================
async function buscarReposicoesAtivasDaMatricula(matriculaId) {
  const { data, error } = await supabase
    .from("reposicao_agendada")
    .select(`
      id,
      aula_id,
      horario_reposicao_id,
      cancelado,
      matricula_id,
      horarios_reposicao (
        id,
        data,
        hora_inicio,
        hora_fim
      )
    `)
    .eq("matricula_id", matriculaId)
    .eq("cancelado", false);

  if (error) {
    console.error("Erro ao buscar reposições ativas:", error);
    throw error;
  }

  return data || [];
}

// =============================
// renderizar aulas pendentes
// =============================
function renderizarAulasPendentes(aulasLivres, reposicoesAtivas) {
  if (!aulasLivres.length) {
    faltasAluno.innerHTML = `<p>Você não possui reposições pendentes para este curso.</p>`;
    textoSelecao.textContent = "Você não possui aulas pendentes para repor neste curso.";
    listaReposicoes.innerHTML = "";
    aulaSelecionadaId = null;
    atualizarAlertaCobranca();
    return;
  }

  let html = `
    <div class="resumo-pendencias">
      <p><strong>Total de reposições pendentes:</strong> ${aulasLivres.length}</p>
      ${
        reposicoesAtivas.length > 0
          ? `<p><strong>Reposições já agendadas neste curso:</strong> ${reposicoesAtivas.length}</p>`
          : ""
      }
    </div>

    <div class="lista-aulas-pendentes">
  `;

  aulasLivres.forEach((aula) => {
    const selecionada = aula.id === aulaSelecionadaId;
    const status = textoStatusBonito(aula.status);
    const dataBR = formatarDataBR(aula.data_aula);
    const justificativa = textoJustificativa(aula.justificativa);

    html += `
      <div class="item-pendente ${selecionada ? "item-pendente-selecionado" : ""}">
        <div class="item-pendente-conteudo">
          <p><strong>${status} em ${dataBR}</strong></p>
          <p class="justificativa-aula">${status} em ${dataBR} - ${justificativa}</p>
        </div>

        <button
          type="button"
          class="btn btnSelecionarAula"
          data-aula-id="${aula.id}"
        >
          ${selecionada ? "Selecionada" : "Escolher esta aula"}
        </button>
      </div>
    `;
  });

  html += `</div>`;

  if (reposicoesAtivas.length > 0) {
    html += `
      <div class="agendamentos-ativos">
        <p><strong>Reposições já marcadas neste curso:</strong></p>
        <ul>
    `;

    reposicoesAtivas.forEach((item) => {
      const h = item.horarios_reposicao;
      if (!h) return;

      html += `
        <li>
          ${formatarDataBR(h.data)} - ${h.hora_inicio} às ${h.hora_fim}
        </li>
      `;
    });

    html += `
        </ul>

        <div class="aviso-cancelamento-reposicao" style="margin-top: 12px; padding: 12px; border-radius: 10px; background: rgba(255, 245, 204, 0.85); border: 1px solid #f1bc32;">
          <p style="margin: 0 0 10px 0;">
            Para cancelar uma reposição agendada, entre em contato com a escola.
          </p>

          <a
            href="${gerarLinkWhatsApp()}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn"
            style="display: inline-block; text-decoration: none;"
          >
            WhatsApp da escola
          </a>
        </div>
      </div>
    `;
  }

  faltasAluno.innerHTML = html;
  atualizarAlertaCobranca();

  document.querySelectorAll(".btnSelecionarAula").forEach((btn) => {
    btn.addEventListener("click", async () => {
      aulaSelecionadaId = Number(btn.dataset.aulaId);

      const aulaEscolhida = aulasLivres.find((a) => a.id === aulaSelecionadaId);

      if (aulaEscolhida) {
        const status = textoStatusBonito(aulaEscolhida.status);
        const dataBR = formatarDataBR(aulaEscolhida.data_aula);
        textoSelecao.textContent = `Você está escolhendo um horário para: ${status} em ${dataBR}.`;
      }

      renderizarAulasPendentes(aulasLivres, reposicoesAtivas);
      await carregarHorariosDisponiveis();
    });
  });
}

// =============================
// carregar pendências
// =============================
async function carregarPendencias() {
  const aulas = await buscarAulasPendentes(matriculaSelecionada.id);
  const reposicoesAtivas = await buscarReposicoesAtivasDaMatricula(matriculaSelecionada.id);

  const aulasJaAgendadasIds = new Set(
    reposicoesAtivas
      .filter((item) => item.aula_id !== null)
      .map((item) => item.aula_id)
  );

  aulasPendentes = aulas.filter((aula) => !aulasJaAgendadasIds.has(aula.id));

  if (aulasPendentes.length > 0 && !aulaSelecionadaId) {
    aulaSelecionadaId = aulasPendentes[0].id;
  }

  if (aulaSelecionadaId && !aulasPendentes.some((a) => a.id === aulaSelecionadaId)) {
    aulaSelecionadaId = aulasPendentes.length ? aulasPendentes[0].id : null;
  }

  renderizarAulasPendentes(aulasPendentes, reposicoesAtivas);
}

// =============================
// buscar horários livres
// =============================
async function buscarHorariosLivres() {
  const hoje = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("horarios_reposicao")
    .select(`
      id,
      data,
      hora_inicio,
      hora_fim,
      disponivel,
      professor (nome),
      materia (nome),
      reposicao_agendada (
        id,
        cancelado
      )
    `)
    .eq("materia_id", matriculaSelecionada.materia_id)
    .gte("data", hoje)
    .order("data", { ascending: true })
    .order("hora_inicio", { ascending: true });

  if (error) {
    console.error("Erro ao buscar horários livres:", error);
    throw error;
  }

  return (data || []).filter((horario) => {
    if (horario.disponivel === false) return false;

    const temAgendamentoAtivo = (horario.reposicao_agendada || []).some(
      (ag) => ag.cancelado === false
    );

    return !temAgendamentoAtivo;
  });
}

// =============================
// renderizar horários disponíveis
// =============================
async function carregarHorariosDisponiveis() {
  if (!aulaSelecionadaId) {
    listaReposicoes.innerHTML = `
      <p>Selecione uma aula pendente para visualizar os horários disponíveis.</p>
    `;
    return;
  }

  const aulaSelecionada = aulasPendentes.find((a) => a.id === aulaSelecionadaId);

  if (!aulaSelecionada) {
    listaReposicoes.innerHTML = `<p>Selecione uma aula pendente.</p>`;
    return;
  }

  const horariosLivres = await buscarHorariosLivres();

  if (!horariosLivres.length) {
    listaReposicoes.innerHTML = `<p>Nenhum horário disponível no momento para este curso.</p>`;
    return;
  }

  listaReposicoes.innerHTML = "";

  horariosLivres.forEach((horario) => {
    const dentroDoPrazo = podeAgendarHorario(horario.data);
    const prazoTexto = formatarPrazoLimite(horario.data);
    const geraCobranca = reposicaoGeraCobranca(
      aulaSelecionada.status,
      aulaSelecionada.data_aula,
      horario.data
    );

    const div = document.createElement("div");
    div.className = "card card-horario";

    div.innerHTML = `
      <p><strong>Data:</strong> ${formatarDataBR(horario.data)}</p>
      <p><strong>Horário:</strong> ${horario.hora_inicio} - ${horario.hora_fim}</p>
      <p><strong>Professor:</strong> ${horario.professor?.nome || "Não informado"}</p>
      <p><strong>Curso:</strong> ${horario.materia?.nome || "Não informado"}</p>
      <p class="prazo-agendamento">
        <strong>Prazo para agendar:</strong> ${prazoTexto}
      </p>

      ${
        geraCobranca
          ? `
            <div style="margin:10px 0; padding:10px; border-radius:10px; background:#fff3cd; border:1px solid #f1bc32; font-size:14px;">
              <strong>Atenção:</strong> esta reposição gerará cobrança de <strong>R$ 25,00</strong>,
              pois está em mês diferente da aula ausente. Aguarde o financeiro entrar em contato.
            </div>
          `
          : `
            <div style="margin:10px 0; padding:10px; border-radius:10px; background:#ecfdf3; border:1px solid #12b76a; font-size:14px;">
              <strong>Sem cobrança adicional.</strong>
            </div>
          `
      }

      ${
        dentroDoPrazo
          ? `
            <button
              type="button"
              class="btn btnEscolherHorario"
              data-horario-id="${horario.id}"
            >
              Agendar este horário
            </button>
          `
          : `
            <p class="prazo-encerrado">Prazo encerrado para este horário</p>
          `
      }
    `;

    listaReposicoes.appendChild(div);
  });

  ativarEscolhaHorario();
}

// =============================
// agendar horário
// =============================
function ativarEscolhaHorario() {
  document.querySelectorAll(".btnEscolherHorario").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!aulaSelecionadaId) {
        mostrarMensagem("Selecione uma aula pendente primeiro.", true);
        return;
      }

      const horarioId = Number(btn.dataset.horarioId);

      btn.disabled = true;
      btn.textContent = "Agendando...";

      try {
        const aulaEscolhida = aulasPendentes.find((a) => a.id === aulaSelecionadaId);

        if (!aulaEscolhida) {
          mostrarMensagem("A aula selecionada não está mais disponível para reposição.", true);
          await carregarTudo();
          return;
        }

        const { data: horarioAtual, error: erroHorario } = await supabase
          .from("horarios_reposicao")
          .select(`
            id,
            data,
            disponivel,
            reposicao_agendada (
              id,
              cancelado
            )
          `)
          .eq("id", horarioId)
          .maybeSingle();

        if (erroHorario || !horarioAtual) {
          throw erroHorario || new Error("Horário não encontrado.");
        }

        if (!podeAgendarHorario(horarioAtual.data)) {
          mostrarMensagem("O prazo para agendar esta reposição já foi encerrado.", true);
          await carregarTudo();
          return;
        }

        const horarioOcupado = (horarioAtual.reposicao_agendada || []).some(
          (item) => item.cancelado === false
        );

        if (horarioAtual.disponivel === false || horarioOcupado) {
          mostrarMensagem("Este horário não está mais disponível.", true);
          await carregarTudo();
          return;
        }

        const { data: aulaJaAgendada, error: erroAulaJaAgendada } = await supabase
          .from("reposicao_agendada")
          .select("id")
          .eq("aula_id", aulaSelecionadaId)
          .eq("cancelado", false);

        if (erroAulaJaAgendada) {
          throw erroAulaJaAgendada;
        }

        if (aulaJaAgendada && aulaJaAgendada.length > 0) {
          mostrarMensagem("Esta aula já possui uma reposição agendada.", true);
          await carregarTudo();
          return;
        }

        const geraCobranca = reposicaoGeraCobranca(
          aulaEscolhida.status,
          aulaEscolhida.data_aula,
          horarioAtual.data
        );

        const textoConfirmacao = geraCobranca
          ? "Esta reposição gerará cobrança de R$ 25,00. Deseja continuar?"
          : "Deseja agendar esta reposição?";

        const confirmar = confirm(textoConfirmacao);

        if (!confirmar) {
          btn.disabled = false;
          btn.textContent = "Agendar este horário";
          return;
        }

        const { error: erroInsert } = await supabase
          .from("reposicao_agendada")
          .insert({
            horario_reposicao_id: horarioId,
            aluno_id: alunoAtual.id,
            matricula_id: matriculaSelecionada.id,
            aula_id: aulaSelecionadaId,
            cancelado: false
          });

        if (erroInsert) {
          throw erroInsert;
        }

        const { error: erroUpdate } = await supabase
          .from("horarios_reposicao")
          .update({ disponivel: false })
          .eq("id", horarioId);

        if (erroUpdate) {
          throw erroUpdate;
        }

        mostrarMensagem(
          geraCobranca
            ? "Reposição agendada com sucesso! Esta reposição gerará cobrança de R$ 25,00."
            : "Reposição agendada com sucesso!"
        );

        await carregarTudo();

      } catch (err) {
        console.error("Erro ao agendar reposição:", err);
        mostrarMensagem("Erro ao agendar reposição.", true);
      } finally {
        btn.disabled = false;
        btn.textContent = "Agendar este horário";
      }
    });
  });
}

// =============================
// carregar tudo da matrícula
// =============================
async function carregarTudo() {
  faltasAluno.innerHTML = "Carregando pendências...";
  listaReposicoes.innerHTML = "Carregando horários...";

  if (alertaCobrancaReposicao) {
    alertaCobrancaReposicao.style.display = "none";
    alertaCobrancaReposicao.innerHTML = "";
  }

  try {
    if (!alunoAtual) {
      alunoAtual = await buscarAluno();
    }

    if (!alunoAtual) {
      faltasAluno.innerHTML = "Não foi possível identificar o aluno.";
      listaReposicoes.innerHTML = "";
      return;
    }

    if (!matriculasAtivas.length) {
      matriculasAtivas = await buscarMatriculasAtivas(alunoAtual.id);
      definirMatriculaSelecionadaInicial();
      preencherSelectMatriculas();
    }

    if (!matriculaSelecionada) {
      faltasAluno.innerHTML = "Nenhum curso ativo encontrado.";
      listaReposicoes.innerHTML = "";
      return;
    }

    salvarMatriculaSelecionada(matriculaSelecionada);

    await carregarPendencias();
    await carregarHorariosDisponiveis();

  } catch (error) {
    console.error("Erro geral:", error);
    faltasAluno.innerHTML = "Erro ao carregar as reposições pendentes.";
    listaReposicoes.innerHTML = "Erro ao carregar os horários disponíveis.";
    mostrarMensagem("Não foi possível carregar os dados.", true);
  }
}

// =============================
// troca de curso
// =============================
if (selectMatriculaReposicao) {
  selectMatriculaReposicao.addEventListener("change", async () => {
    const idSelecionado = selectMatriculaReposicao.value;

    const encontrada = matriculasAtivas.find(
      (m) => String(m.id) === String(idSelecionado)
    );

    if (!encontrada) return;

    matriculaSelecionada = encontrada;
    aulaSelecionadaId = null;
    aulasPendentes = [];

    salvarMatriculaSelecionada(matriculaSelecionada);
    preencherSelectMatriculas();
    await carregarTudo();
  });
}

// =============================
// iniciar
// =============================
carregarTudo();