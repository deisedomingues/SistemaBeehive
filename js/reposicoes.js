import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const listaReposicoesDisponiveis = document.getElementById("listaReposicoesDisponiveis");
const listaReposicoesEscolhidas = document.getElementById("listaReposicoesEscolhidas");
const contadorDisponiveis = document.getElementById("contadorDisponiveis");
const contadorEscolhidas = document.getElementById("contadorEscolhidas");
const msg = document.getElementById("msg");

function mostrarMensagem(texto, erro = false) {
  msg.textContent = texto;
  msg.style.color = erro ? "#b42318" : "#027a48";

  setTimeout(() => {
    msg.textContent = "";
  }, 3000);
}

function mostrarPopupConfirmacao(texto, callback) {
  const popup = document.createElement("div");

  popup.style.position = "fixed";
  popup.style.top = "0";
  popup.style.left = "0";
  popup.style.width = "100%";
  popup.style.height = "100%";
  popup.style.background = "rgba(0,0,0,0.4)";
  popup.style.display = "flex";
  popup.style.alignItems = "center";
  popup.style.justifyContent = "center";
  popup.style.zIndex = "9999";

  popup.innerHTML = `
    <div style="background:white;padding:20px;border-radius:12px;text-align:center;max-width:320px;width:90%;">
      <p style="margin-bottom:16px;">${texto}</p>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="sim" class="btn" type="button">Sim</button>
        <button id="nao" class="btn" type="button">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  popup.querySelector("#sim").onclick = () => {
    callback();
    popup.remove();
  };

  popup.querySelector("#nao").onclick = () => popup.remove();
}

function atualizarContadores(disponiveis, escolhidas) {
  contadorDisponiveis.textContent = disponiveis;
  contadorEscolhidas.textContent = escolhidas;
}

function formatarDataBR(dataISO) {
  if (!dataISO) return "";
  const [ano, mes, dia] = String(dataISO).split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarHora(hora) {
  if (!hora) return "-";
  return String(hora).slice(0, 5);
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textoStatusBonito(status) {
  if (!status) return "-";

  const s = status.trim().toLowerCase();

  if (s === "ausente") return "Ausente";
  if (s === "cancelada") return "Cancelada";
  if (s === "trancada") return "Trancada";

  return status;
}

function extrairAnoMes(dataISO) {
  const [ano, mes] = String(dataISO).split("-");
  return { ano: Number(ano), mes: Number(mes) };
}

function reposicaoGeraCobranca(statusAula, dataAulaFaltada, dataReposicao) {
  if (!statusAula || !dataAulaFaltada || !dataReposicao) return false;

  const statusNormalizado = statusAula.trim().toLowerCase();

  if (statusNormalizado === "cancelada") return false;
  if (statusNormalizado === "trancada") return false;
  if (statusNormalizado !== "ausente") return false;

  const aula = extrairAnoMes(dataAulaFaltada);
  const reposicao = extrairAnoMes(dataReposicao);

  return aula.ano !== reposicao.ano || aula.mes !== reposicao.mes;
}

function normalizarTipoAgendamento(tipo) {
  if (!tipo) return "Reposição";
  return tipo;
}

function obterEmojiTipo(tipo) {
  const t = normalizarTipoAgendamento(tipo);

  if (t === "Plantão de dúvidas") return "💡";
  if (t === "Aula Instrumental") return "🧰";
  return "🔁";
}

function obterCoresTipo(tipo) {
  const t = normalizarTipoAgendamento(tipo);

  if (t === "Plantão de dúvidas") {
    return {
      bg: "#e8f0ff",
      color: "#173f8a",
      border: "#9bbcff"
    };
  }

  if (t === "Aula Instrumental") {
    return {
      bg: "#f3e8ff",
      color: "#5b21b6",
      border: "#c4b5fd"
    };
  }

  return {
    bg: "#fff3cd",
    color: "#7a4b00",
    border: "#f1bc32"
  };
}

function criarBadgeTipo(tipo) {
  const tipoFinal = normalizarTipoAgendamento(tipo);
  const cores = obterCoresTipo(tipoFinal);
  const emoji = obterEmojiTipo(tipoFinal);

  return `
    <span style="
      display:inline-block;
      padding:6px 10px;
      border-radius:999px;
      font-size:12px;
      font-weight:700;
      background:${cores.bg};
      color:${cores.color};
      border:1px solid ${cores.border};
      white-space:nowrap;
    ">
      ${emoji} ${escaparHtml(tipoFinal)}
    </span>
  `;
}

function criarCardReposicao(horario, status, detalhes = {}) {
  const dataBR = formatarDataBR(horario.data);

  const card = document.createElement("div");
  card.className = "card-reposicao-item";

  card.style.border = "1px solid #e7d98b";
  card.style.borderRadius = "12px";
  card.style.padding = "12px";
  card.style.marginBottom = "12px";
  card.style.background = status === "escolhida" ? "#fff7d6" : "#fffdf2";
  card.style.boxShadow =
    status === "escolhida"
      ? "0 4px 14px rgba(0,0,0,0.10)"
      : "0 2px 8px rgba(0,0,0,0.05)";

  const badgeTexto = status === "escolhida" ? "Escolhido" : "Disponível";
  const badgeBg = status === "escolhida" ? "#f1bc32" : "#e9f7ef";
  const badgeColor = status === "escolhida" ? "#000" : "#067647";

  let blocoExtra = "";

  if (status === "escolhida") {
    const tipoAgendamento = normalizarTipoAgendamento(detalhes.tipoAgendamento);
    const alunoNome = detalhes.alunoNome || "Aluno não identificado";
    const observacaoAluno = detalhes.observacaoAluno || "";
    const dataAulaFaltada = detalhes.dataAulaFaltada || "";
    const statusAula = detalhes.statusAula || "";
    const geraCobranca = detalhes.geraCobranca === true;
    const motivoCusto = detalhes.motivoCusto || "";

    if (tipoAgendamento === "Reposição") {
      blocoExtra = `
        <div style="font-size:14px; margin-bottom:4px;">
          <strong>Aluno:</strong> <strong>${escaparHtml(alunoNome)}</strong>
        </div>

        <div style="font-size:14px; margin-bottom:4px;">
          <strong>Aula que será reposta:</strong> ${dataAulaFaltada ? formatarDataBR(dataAulaFaltada) : "-"}
        </div>

        <div style="font-size:14px; margin-bottom:4px;">
          <strong>Status da aula original:</strong> ${escaparHtml(textoStatusBonito(statusAula))}
        </div>

        ${
          observacaoAluno
            ? `
              <div style="font-size:14px; margin-bottom:4px;">
                <strong>Observação do aluno:</strong> ${escaparHtml(observacaoAluno)}
              </div>
            `
            : ""
        }

        <div style="
          margin-top:8px;
          display:inline-block;
          padding:6px 10px;
          border-radius:999px;
          font-size:12px;
          font-weight:700;
          background:${geraCobranca ? "#fff3cd" : "#ecfdf3"};
          color:${geraCobranca ? "#7a4b00" : "#067647"};
          border:1px solid ${geraCobranca ? "#f1bc32" : "#12b76a"};
        ">
          ${geraCobranca ? "Enviar cobrança: R$ 25,00" : "Sem cobrança"}
        </div>

        ${
          motivoCusto
            ? `
              <div style="font-size:12px; opacity:0.85; margin-top:6px;">
                ${escaparHtml(motivoCusto)}
              </div>
            `
            : ""
        }
      `;
    } else {
      blocoExtra = `
        <div style="font-size:14px; margin-bottom:4px;">
          <strong>Aluno:</strong> <strong>${escaparHtml(alunoNome)}</strong>
        </div>

        <div style="font-size:14px; margin-bottom:4px;">
          <strong>Solicitação:</strong> ${escaparHtml(tipoAgendamento)}
        </div>

        <div style="font-size:14px; margin-bottom:4px;">
          <strong>Observação do aluno:</strong>
          ${observacaoAluno ? escaparHtml(observacaoAluno) : "Nenhuma observação informada."}
        </div>

      `;
    }
  }

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
      <div>
        <div style="font-weight:700; margin-bottom:4px;">
          ${escaparHtml(dataBR)} • ${formatarHora(horario.hora_inicio)} às ${formatarHora(horario.hora_fim)}
        </div>

        <div style="font-size:14px; margin-bottom:4px;">
          <strong>Professor:</strong> ${escaparHtml(horario.professor?.nome || "-")}
        </div>

        <div style="font-size:14px; margin-bottom:4px;">
          <strong>Curso:</strong> ${escaparHtml(horario.materia?.nome || "-")}
        </div>

        ${
          status === "escolhida"
            ? `<div style="margin:8px 0;">${criarBadgeTipo(detalhes.tipoAgendamento)}</div>`
            : ""
        }

        ${blocoExtra}
      </div>

      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
        <span style="
          display:inline-block;
          padding:6px 10px;
          border-radius:999px;
          font-size:12px;
          font-weight:700;
          background:${badgeBg};
          color:${badgeColor};
        ">
          ${badgeTexto}
        </span>

        <button class="btnExcluir btn" data-id="${horario.id}" type="button">x</button>
      </div>
    </div>
  `;

  return card;
}

async function carregarReposicoes() {
  const hoje = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("horarios_reposicao")
    .select(`
      id,
      data,
      hora_inicio,
      hora_fim,
      professor_id,
      materia_id,
      professor:professor_id (nome),
      materia:materia_id (nome),
      reposicao_agendada (
        id,
        cancelado,
        aula_id,
        tipo_agendamento,
        observacao_aluno,
        tem_custo,
        motivo_custo,
        aluno:aluno_id (nome),
        aula:aula_id (
          data_aula,
          status
        )
      )
    `)
    .gte("data", hoje)
    .order("data")
    .order("hora_inicio");

  if (error) {
    console.error(error);
    mostrarMensagem("Erro ao carregar agendamentos", true);
    listaReposicoesDisponiveis.innerHTML = "<p>Erro ao carregar.</p>";
    listaReposicoesEscolhidas.innerHTML = "<p>Erro ao carregar.</p>";
    return;
  }

  listaReposicoesDisponiveis.innerHTML = "";
  listaReposicoesEscolhidas.innerHTML = "";

  const disponiveis = [];
  const escolhidas = [];

  /*
    Um professor pode ter o mesmo intervalo cadastrado para
    matérias diferentes (ex.: Alexandra - Inglês / Espanhol).

    Se QUALQUER um desses registros tiver um agendamento ativo,
    todos os registros do mesmo professor/data/intervalo devem
    ser considerados ocupados.

    A matéria NÃO faz parte da chave de ocupação.
  */
  const horariosOcupados = new Set();

  (data || []).forEach((h) => {
    const agendamentoAtivo = (h.reposicao_agendada || []).find(
      (item) => item.cancelado === false
    );

    if (!agendamentoAtivo) return;

    const chaveHorario = [
      h.professor_id,
      h.data,
      formatarHora(h.hora_inicio),
      formatarHora(h.hora_fim)
    ].join("|");

    horariosOcupados.add(chaveHorario);
  });

  (data || []).forEach((h) => {
    const agendamentoAtivo = (h.reposicao_agendada || []).find(
      (item) => item.cancelado === false
    );

    const chaveHorario = [
      h.professor_id,
      h.data,
      formatarHora(h.hora_inicio),
      formatarHora(h.hora_fim)
    ].join("|");

    if (agendamentoAtivo) {
      const tipoAgendamento = normalizarTipoAgendamento(
        agendamentoAtivo.tipo_agendamento
      );

      const alunoNome =
        agendamentoAtivo?.aluno?.nome || "Aluno não identificado";

      const observacaoAluno =
        agendamentoAtivo?.observacao_aluno || "";

      const dataAulaFaltada =
        agendamentoAtivo?.aula?.data_aula || "";

      const statusAula =
        agendamentoAtivo?.aula?.status || "";

      const geraCobranca =
        agendamentoAtivo.tem_custo === true ||
        (
          tipoAgendamento === "Reposição" &&
          reposicaoGeraCobranca(
            statusAula,
            dataAulaFaltada,
            h.data
          )
        );

      escolhidas.push({
        horario: h,
        tipoAgendamento,
        alunoNome,
        observacaoAluno,
        dataAulaFaltada,
        statusAula,
        geraCobranca,
        motivoCusto: agendamentoAtivo.motivo_custo || ""
      });

      return;
    }

    /*
      Mesmo que ESTE registro não tenha agendamento, ele não
      pode aparecer como disponível se outro registro do mesmo
      professor, na mesma data e no mesmo intervalo, já estiver
      ocupado por outra matéria.
    */
    if (horariosOcupados.has(chaveHorario)) {
      return;
    }

    disponiveis.push(h);
  });

  atualizarContadores(disponiveis.length, escolhidas.length);

  if (!disponiveis.length) {
    listaReposicoesDisponiveis.innerHTML = `
      <p style="margin:0; opacity:0.8;">
        Nenhum horário disponível no momento.
      </p>
    `;
  } else {
    disponiveis.forEach((h) => {
      const card = criarCardReposicao(h, "disponivel");
      listaReposicoesDisponiveis.appendChild(card);
    });
  }

  if (!escolhidas.length) {
    listaReposicoesEscolhidas.innerHTML = `
      <p style="margin:0; opacity:0.8;">
        Nenhum horário foi escolhido ainda.
      </p>
    `;
  } else {
    escolhidas.forEach((item) => {
      const card = criarCardReposicao(item.horario, "escolhida", {
        tipoAgendamento: item.tipoAgendamento,
        alunoNome: item.alunoNome,
        observacaoAluno: item.observacaoAluno,
        dataAulaFaltada: item.dataAulaFaltada,
        statusAula: item.statusAula,
        geraCobranca: item.geraCobranca,
        motivoCusto: item.motivoCusto
      });

      listaReposicoesEscolhidas.appendChild(card);
    });
  }

  ativarExclusao();
}

function ativarExclusao() {
  document.querySelectorAll(".btnExcluir").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const card = btn.closest(".card-reposicao-item");

      mostrarPopupConfirmacao("Deseja excluir este horário?", async () => {
        const { error } = await supabase
          .from("horarios_reposicao")
          .delete()
          .eq("id", id);

        if (error) {
          console.error(error);
          mostrarMensagem("Erro ao excluir", true);
          return;
        }

        if (card) {
          card.innerHTML = `<span style="color:green;font-weight:600;">Horário excluído</span>`;
          card.style.transition = "opacity 0.5s ease";

          setTimeout(() => {
            card.style.opacity = "0";
          }, 400);

          setTimeout(() => {
            card.remove();
            carregarReposicoes();
          }, 900);
        } else {
          carregarReposicoes();
        }
      });
    };
  });
}

carregarReposicoes();