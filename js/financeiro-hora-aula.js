import {
  carregarItensHoraAula, formatarSegundosParaCampo, normalizarDuracaoSegundos,
  deveAplicarValorColetivo, obterValorHoraAplicado, calcularValorItem
} from "./financeiro-aulas-dados.js";
import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

if (!await exigirAdmin()) throw new Error("Acesso administrativo necessário.");

// ======================================================
// ELEMENTOS DA TELA
// ======================================================

const msg = document.getElementById("msg");

const filtroProfessor = document.getElementById(
  "filtroProfessor"
);

const filtroDia = document.getElementById(
  "filtroDia"
);

const filtroMes = document.getElementById(
  "filtroMes"
);

const filtroAno = document.getElementById(
  "filtroAno"
);

const filtroMinutagem = document.getElementById(
  "filtroMinutagem"
);

const btnBuscar = document.getElementById(
  "btnBuscar"
);

const listaAulas = document.getElementById(
  "listaAulas"
);

const resumoQtdAulas = document.getElementById(
  "resumoQtdAulas"
);

const resumoMinutos = document.getElementById(
  "resumoMinutos"
);

const resumoValor = document.getElementById(
  "resumoValor"
);

// ======================================================
// ESTADO
// ======================================================

let professoresCache = [];
let todosItens = [];
let itensFinanceiroCache = [];

// ======================================================
// HELPERS DE INTERFACE
// ======================================================

function mostrarMensagem(
  texto,
  ok = true
) {
  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.padding = "10px 12px";
  msg.style.borderRadius = "10px";
  msg.style.fontSize = "13px";
  msg.style.fontWeight = "600";

  msg.style.backgroundColor = ok
    ? "#e8f5e9"
    : "#ffebee";

  msg.style.color = ok
    ? "#1b5e20"
    : "#b71c1c";

  msg.style.border = ok
    ? "1px solid #66bb6a"
    : "1px solid #ef5350";

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
  }, 3200);
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarData(dataIso) {
  if (!dataIso) {
    return "-";
  }

  const partes = String(dataIso).split("-");

  if (partes.length !== 3) {
    return dataIso;
  }

  const [ano, mes, dia] = partes;

  return `${dia}/${mes}/${ano}`;
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  );
}

function formatarParte(parte) {
  return `Parte ${Number(parte || 1)}`;
}

function preencherAnos() {
  filtroAno.innerHTML = `
    <option value="">
      Todos os anos
    </option>
  `;

  const anoAtual = new Date().getFullYear();

  for (
    let ano = anoAtual + 1;
    ano >= 2024;
    ano--
  ) {
    const option = document.createElement("option");

    option.value = String(ano);
    option.textContent = String(ano);

    filtroAno.appendChild(option);
  }
}

// ======================================================
// TEMPO E DURAÇÃO
// ======================================================

function somenteDigitos(valor) {
  return String(valor || "")
    .replace(/\D/g, "");
}

function formatarTempoDigitado(digitos) {
  const limpo = somenteDigitos(digitos);

  if (!limpo) {
    return "";
  }

  /*
    Até dois dígitos:
    5  = 5 minutos
    30 = 30 minutos
    60 = 60 minutos
  */
  if (limpo.length <= 2) {
    return limpo;
  }

  /*
    Três ou quatro dígitos:
    305  = 3:05
    3050 = 30:50
  */
  if (limpo.length <= 4) {
    const minutos = limpo.slice(
      0,
      -2
    );

    const segundos = limpo
      .slice(-2)
      .padStart(2, "0");

    return `${Number(minutos)}:${segundos}`;
  }

  /*
    Cinco ou mais dígitos:
    13050 = 1:30:50
  */
  const segundos = limpo.slice(-2);

  const minutos = limpo
    .slice(-4, -2)
    .padStart(2, "0");

  const horas = limpo.slice(
    0,
    -4
  );

  return `${Number(horas)}:${minutos}:${segundos}`;
}

function converterTempoDigitadoParaSegundos(
  valorDigitado
) {
  const limpo = somenteDigitos(
    valorDigitado
  );

  if (!limpo) {
    return null;
  }

  if (limpo.length <= 2) {
    return Number(limpo) * 60;
  }

  if (limpo.length <= 4) {
    const minutos = Number(
      limpo.slice(0, -2) || 0
    );

    const segundos = Number(
      limpo.slice(-2) || 0
    );

    return (
      minutos * 60 +
      segundos
    );
  }

  const segundos = Number(
    limpo.slice(-2) || 0
  );

  const minutos = Number(
    limpo.slice(-4, -2) || 0
  );

  const horas = Number(
    limpo.slice(0, -4) || 0
  );

  return (
    horas * 3600 +
    minutos * 60 +
    segundos
  );
}

function formatarSegundosResumo(
  totalSegundos
) {
  const total = Number(
    totalSegundos || 0
  );

  const horas = Math.floor(
    total / 3600
  );

  const resto = total % 3600;

  const minutos = Math.floor(
    resto / 60
  );

  const segundos = resto % 60;

  if (horas > 0) {
    return (
      `${horas}h ` +
      `${String(minutos).padStart(2, "0")}min ` +
      `${String(segundos).padStart(2, "0")}s`
    );
  }

  return (
    `${minutos}min ` +
    `${String(segundos).padStart(2, "0")}s`
  );
}

// ======================================================
// REGRAS DE EVENTOS E CÁLCULO
// ======================================================

function obterEstadoMinutagem(item) {
  const salvo = normalizarDuracaoSegundos(
    item.duracao_segundos_salva
  );

  const atual = normalizarDuracaoSegundos(
    item.duracao_segundos
  );

  if (salvo === null) {
    return {
      texto: "Sem minutagem",
      fundo: "#ffebee",
      cor: "#b71c1c",
      borda: "#ef9a9a"
    };
  }

  if (atual !== salvo) {
    return {
      texto: "Alteração não salva",
      fundo: "#fff8e1",
      cor: "#8a5a00",
      borda: "#f1d98a"
    };
  }

  return {
    texto: "Minutagem salva",
    fundo: "#e8f5e9",
    cor: "#1b5e20",
    borda: "#81c784"
  };
}

// ======================================================
// RESUMO
// ======================================================

function atualizarResumo() {
  const quantidade =
    itensFinanceiroCache.length;

  const totalSegundos =
    itensFinanceiroCache.reduce(
      (acumulado, item) => {
        return (
          acumulado +
          Number(
            item.duracao_segundos || 0
          )
        );
      },
      0
    );

  const totalValor =
    itensFinanceiroCache.reduce(
      (acumulado, item) => {
        return (
          acumulado +
          calcularValorItem(item)
        );
      },
      0
    );

  resumoQtdAulas.textContent =
    String(quantidade);

  resumoMinutos.textContent =
    formatarSegundosResumo(
      totalSegundos
    );

  resumoValor.textContent =
    formatarMoeda(totalValor);
}

// ======================================================
// FILTROS
// ======================================================

function aplicarFiltroMinutagem(itens) {
  const tipoFiltro =
    filtroMinutagem.value;

  if (!tipoFiltro) {
    return itens;
  }

  return itens.filter((item) => {
    const possuiMinutagem =
      normalizarDuracaoSegundos(
        item.duracao_segundos_salva
      ) !== null;

    if (tipoFiltro === "sem") {
      return !possuiMinutagem;
    }

    if (tipoFiltro === "com") {
      return possuiMinutagem;
    }

    return true;
  });
}

// ======================================================
// RENDERIZAÇÃO
// ======================================================

function montarHtmlAlunos(alunos) {
  return `
    <ul
      style="
        margin:6px 0 0 18px;
        padding:0;
        line-height:1.55;
      "
    >
      ${alunos
        .map((nome) => {
          return `
            <li style="margin-bottom:4px;">
              <strong style="font-size:15px;">
                ${escaparHtml(nome)}
              </strong>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

function obterTipoTextoItem(item) {
  if (item.eh_evento) {
    return "Evento coletivo";
  }

  if (item.aula_coletiva) {
    return "Aula coletiva";
  }

  if (item.aula_sabado) {
    return (
      "Aula individual — " +
      "valor coletivo por ser sábado"
    );
  }

  return "Aula individual";
}

function montarBadgesExtras(item) {
  let html = "";

  if (item.eh_evento) {
    html += `
      <span
        style="
          font-size:12px;
          padding:4px 8px;
          border-radius:999px;
          background:#e8f0ff;
          color:#173f8a;
          border:1px solid #9bbcff;
          font-weight:700;
          white-space:nowrap;
        "
      >
        Evento coletivo
      </span>
    `;
  }

  if (
    item.aula_sabado &&
    !item.eh_evento
  ) {
    html += `
      <span
        style="
          font-size:12px;
          padding:4px 8px;
          border-radius:999px;
          background:#fff3cd;
          color:#7a5200;
          border:1px solid #f1bc32;
          font-weight:700;
          white-space:nowrap;
        "
      >
        Sábado: valor coletivo
      </span>
    `;
  }

  return html;
}

function montarTituloConteudo(item) {
  if (item.eh_evento) {
    return "Evento";
  }

  return "Conteúdo";
}

function renderItensFinanceiro() {
  listaAulas.innerHTML = "";

  if (!itensFinanceiroCache.length) {
    listaAulas.innerHTML = `
      <div
        style="
          opacity:0.8;
          font-size:13px;
        "
      >
        Nenhuma aula ou evento encontrado para este filtro.
      </div>
    `;

    atualizarResumo();

    return;
  }

  itensFinanceiroCache.forEach(
    (item) => {
      const estadoMinutagem =
        obterEstadoMinutagem(item);

      const temMinutagemSalva =
        normalizarDuracaoSegundos(
          item.duracao_segundos_salva
        ) !== null;

      const estaEditando =
        Boolean(item.editando);

      const campoTravado =
        temMinutagemSalva &&
        !estaEditando;

      const textoBotao =
        campoTravado
          ? "Editar"
          : "Salvar";

      const acaoBotao =
        campoTravado
          ? "editar"
          : "salvar";

      const aplicaValorColetivo =
        deveAplicarValorColetivo(
          item
        );

      const card =
        document.createElement("div");

      card.style.border =
        aplicaValorColetivo
          ? "1px solid #f1d98a"
          : "1px solid #eee";

      card.style.borderRadius =
        "12px";

      card.style.padding =
        "14px";

      card.style.marginBottom =
        "14px";

      card.style.background =
        aplicaValorColetivo
          ? "#fff8e8"
          : "#fffdf8";

      const titulo =
        document.createElement("div");

      titulo.style.display =
        "flex";

      titulo.style.justifyContent =
        "space-between";

      titulo.style.alignItems =
        "flex-start";

      titulo.style.gap =
        "10px";

      titulo.style.flexWrap =
        "wrap";

      titulo.style.marginBottom =
        "12px";

      const tipoTexto =
        obterTipoTextoItem(item);

      titulo.innerHTML = `
        <div>
          <div style="margin-bottom:4px;">
            <strong>
              ${formatarData(item.data_aula)}
            </strong>

            <span style="font-weight:400;">
              — ${escaparHtml(tipoTexto)}
            </span>
          </div>
        </div>

        <div
          style="
            display:flex;
            gap:8px;
            flex-wrap:wrap;
            justify-content:flex-end;
          "
        >

          <span
            style="
              font-size:12px;
              padding:4px 8px;
              border-radius:999px;
              background:#fff2c4;
              color:#6b5200;
              white-space:nowrap;
            "
          >
            ${escaparHtml(item.materia_nome)}
          </span>
          <span>
            ${escaparHtml(professoresCache.find((p) => String(p.id) === String(item.professor_id))?.nome || "Professor não identificado")}
          </span>

          ${montarBadgesExtras(item)}

          <span
            style="
              font-size:12px;
              padding:4px 8px;
              border-radius:999px;
              background:${estadoMinutagem.fundo};
              color:${estadoMinutagem.cor};
              border:1px solid ${estadoMinutagem.borda};
              font-weight:700;
              white-space:nowrap;
            "
          >
            ${estadoMinutagem.texto}
          </span>

        </div>
      `;

      card.appendChild(titulo);

      const tituloParticipantes =
        document.createElement("div");

      tituloParticipantes.style.fontSize =
        "13px";

      tituloParticipantes.style.marginBottom =
        "4px";

      tituloParticipantes.innerHTML = `
        <strong>
          ${
            item.eh_evento
              ? "Participantes do evento:"
              : item.aula_coletiva
                ? "Alunos da aula:"
                : "Aluno:"
          }
        </strong>
      `;

      card.appendChild(
        tituloParticipantes
      );

      const blocoAlunos =
        document.createElement("div");

      blocoAlunos.style.marginBottom =
        "12px";

      blocoAlunos.innerHTML =
        montarHtmlAlunos(
          item.alunos
        );

      card.appendChild(
        blocoAlunos
      );

      const linhaInfo =
        document.createElement("div");

      linhaInfo.style.display =
        "flex";

      linhaInfo.style.flexWrap =
        "wrap";

      linhaInfo.style.gap =
        "16px";

      linhaInfo.style.marginBottom =
        "10px";

      linhaInfo.style.fontSize =
        "13px";

      linhaInfo.innerHTML = `
        <span>
          <strong>Status:</strong>
          ${escaparHtml(item.status || "-")}
        </span>

        ${
          !item.eh_evento
            ? `
              <span>
                <strong>
                  ${formatarParte(item.parte)}
                </strong>
              </span>
            `
            : ""
        }

        <span>
          <strong>
            ${
              item.eh_evento
                ? "Participantes:"
                : "Qtd. alunos:"
            }
          </strong>

          ${Number(
            item.quantidade_alunos ||
            item.alunos.length ||
            1
          )}
        </span>
      `;

      card.appendChild(
        linhaInfo
      );

      const blocoConteudo =
        document.createElement("div");

      blocoConteudo.style.marginBottom =
        "12px";

      blocoConteudo.innerHTML = `
        <div style="font-size:14px;">
          <strong>
            ${montarTituloConteudo(item)}:
          </strong>

          ${escaparHtml(
            item.conteudo || "-"
          )}
        </div>
      `;

      card.appendChild(
        blocoConteudo
      );

      if (item.eh_evento) {
        const avisoEvento =
          document.createElement("div");

        avisoEvento.style.marginBottom =
          "12px";

        avisoEvento.style.padding =
          "10px";

        avisoEvento.style.borderRadius =
          "10px";

        avisoEvento.style.background =
          "#e8f0ff";

        avisoEvento.style.border =
          "1px solid #9bbcff";

        avisoEvento.style.fontSize =
          "13px";

        avisoEvento.innerHTML = `
          <strong>Regra aplicada:</strong>
          este evento é coletivo e será contabilizado apenas
          uma vez para o professor, independentemente da
          quantidade de participantes.
        `;

        card.appendChild(
          avisoEvento
        );
      } else if (
        item.aula_sabado &&
        !item.aula_coletiva
      ) {
        const avisoSabado =
          document.createElement("div");

        avisoSabado.style.marginBottom =
          "12px";

        avisoSabado.style.padding =
          "10px";

        avisoSabado.style.borderRadius =
          "10px";

        avisoSabado.style.background =
          "#fff3cd";

        avisoSabado.style.border =
          "1px solid #f1bc32";

        avisoSabado.style.fontSize =
          "13px";

        avisoSabado.innerHTML = `
          <strong>Regra aplicada:</strong>
          esta aula foi dada em sábado, por isso o valor
          usado é o mesmo da hora-aula coletiva.
        `;

        card.appendChild(
          avisoSabado
        );
      }

      const valorHoraAplicado =
        obterValorHoraAplicado(item);

      const valorPrevio =
        calcularValorItem(item);

      const linhaFinal =
        document.createElement("div");

      linhaFinal.style.display =
        "grid";

      linhaFinal.style.gridTemplateColumns =
        "repeat(auto-fit, minmax(170px, 1fr))";

      linhaFinal.style.gap =
        "12px";

      linhaFinal.style.alignItems =
        "end";

      linhaFinal.innerHTML = `
        <div>
          <div
            style="
              font-size:12px;
              opacity:0.75;
            "
          >
            Hora-aula aplicada
          </div>

          <div
            style="
              font-weight:700;
              margin-top:4px;
            "
          >
            ${item.valor_hora == null ? "Não cadastrada" : formatarMoeda(valorHoraAplicado)}
          </div>
        </div>

        <div>
          <div
            style="
              font-size:12px;
              opacity:0.75;
            "
          >
            Minutagem
          </div>

          <input
            type="text"
            inputmode="numeric"
            value="${escaparHtml(
              item.duracao_input || ""
            )}"
            data-chave-item="${escaparHtml(
              item.chave
            )}"
            class="input-duracao-aula"
            style="
              margin-top:6px;
              ${
                campoTravado
                  ? `
                    background:#f3f3f3;
                    cursor:not-allowed;
                    opacity:0.85;
                  `
                  : ""
              }
            "
            placeholder="Ex.: 60 ou 3050"
            ${campoTravado ? "disabled" : ""}
          />

          <div
            style="
              font-size:11px;
              opacity:0.7;
              margin-top:4px;
            "
          >
            ${
              campoTravado
                ? "Clique em editar para alterar a minutagem."
                : "Digite 60 para uma hora ou 3050 para 30min50s."
            }
          </div>
        </div>

        <div>
          <div
            style="
              font-size:12px;
              opacity:0.75;
            "
          >
            Valor estimado
          </div>

          <div
            id="valor-item-${escaparHtml(
              item.chave
            )}"
            style="
              font-weight:700;
              margin-top:4px;
            "
          >
            ${formatarMoeda(
              valorPrevio
            )}
          </div>
        </div>
      `;

      card.appendChild(
        linhaFinal
      );

      const rodape =
        document.createElement("div");

      rodape.style.display =
        "flex";

      rodape.style.justifyContent =
        "flex-end";

      rodape.style.alignItems =
        "center";

      rodape.style.marginTop =
        "14px";

      rodape.innerHTML = `
        <button
          type="button"
          class="btn btn-acao-item"
          data-chave-item="${escaparHtml(
            item.chave
          )}"
          data-acao="${acaoBotao}"
          style="
            padding:10px 14px;
          "
        >
          ${textoBotao}
        </button>
      `;

      card.appendChild(
        rodape
      );

      listaAulas.appendChild(
        card
      );
    }
  );

  adicionarEventosCamposDuracao();
  adicionarEventosBotoes();

  atualizarResumo();
}
function adicionarEventosCamposDuracao() {
  document
    .querySelectorAll(
      ".input-duracao-aula"
    )
    .forEach((input) => {
      input.addEventListener(
        "input",
        (evento) => {
          const chave =
            evento.target.dataset.chaveItem;

          const item =
            itensFinanceiroCache.find(
              (registro) => {
                return (
                  registro.chave ===
                  chave
                );
              }
            );

          if (!item) {
            return;
          }

          const limpo =
            somenteDigitos(
              evento.target.value
            );

          const formatado =
            formatarTempoDigitado(
              limpo
            );

          evento.target.value =
            formatado;

          item.duracao_input =
            formatado;

          item.duracao_segundos =
            converterTempoDigitadoParaSegundos(
              limpo
            );

          const valorElemento =
            document.getElementById(
              `valor-item-${chave}`
            );

          if (valorElemento) {
            valorElemento.textContent =
              formatarMoeda(
                calcularValorItem(
                  item
                )
              );
          }

          atualizarResumo();
        }
      );
    });
}

function adicionarEventosBotoes() {
  document
    .querySelectorAll(
      ".btn-acao-item"
    )
    .forEach((botao) => {
      botao.addEventListener(
        "click",
        async (evento) => {
          const chave =
            evento.currentTarget.dataset.chaveItem;

          const acao =
            evento.currentTarget.dataset.acao;

          const item =
            itensFinanceiroCache.find(
              (registro) => {
                return (
                  registro.chave ===
                  chave
                );
              }
            );

          if (!item) {
            mostrarMensagem(
              "Aula ou evento não encontrado.",
              false
            );

            return;
          }

          if (acao === "editar") {
            item.editando = true;

            renderItensFinanceiro();

            setTimeout(() => {
              const input =
                document.querySelector(
                  `.input-duracao-aula[data-chave-item="${chave}"]`
                );

              if (input) {
                input.focus();
                input.select();
              }
            }, 50);

            return;
          }

          await salvarDuracaoItem(
            chave,
            evento.currentTarget
          );
        }
      );
    });
}

// ======================================================
// CARREGAMENTO DE DADOS
// ======================================================

async function carregarProfessores() {
  const { data, error } =
    await supabase
      .from("professor")
      .select("id, nome, ativo")
      .order(
        "nome",
        {
          ascending: true
        }
      );

  if (error) {
    console.error(
      "Erro ao carregar professores:",
      error
    );

    filtroProfessor.innerHTML = `
      <option value="">
        Todos
      </option>
    `;

    mostrarMensagem(
      "Não foi possível carregar os professores.",
      false
    );

    return;
  }

  professoresCache =
    data || [];

  filtroProfessor.innerHTML = `
    <option value="">
      Todos
    </option>
  `;

  professoresCache.forEach(
    (professor) => {
      const option =
        document.createElement("option");

      option.value =
        professor.id;

      option.textContent =
        professor.ativo ? professor.nome : `${professor.nome} · Inativo`;

      filtroProfessor.appendChild(
        option
      );
    }
  );
}

async function buscarAulas() {
  const data = filtroDia.value;
  const mes = filtroMes.value;
  const ano = filtroAno.value;
  const professorId = filtroProfessor.value;
  btnBuscar.disabled = true;
  btnBuscar.textContent = "Buscando…";
  listaAulas.textContent = "Carregando aulas e eventos…";
  todosItens = [];
  itensFinanceiroCache = [];
  atualizarResumo();

  try {
    const inicio = ano ? `${ano}-${(mes || "1").padStart(2, "0")}-01` : undefined;
    const fim = ano ? new Date(Date.UTC(Number(ano) + (mes ? 0 : 1), Number(mes || 0), 1))
      .toISOString().slice(0, 10) : undefined;
    const itens = await carregarItensHoraAula({ data, inicio, fim, professorId });
    todosItens = !data && mes && !ano
      ? itens.filter((item) => Number(item.data_aula.slice(5, 7)) === Number(mes))
      : itens;
    itensFinanceiroCache = aplicarFiltroMinutagem(todosItens);
    renderItensFinanceiro();
  } catch (error) {
    console.error("Erro ao buscar aulas e eventos:", error);
    listaAulas.textContent = "Não foi possível carregar as aulas e os eventos.";
    mostrarMensagem("Erro ao buscar as aulas e os eventos.", false);
  } finally {
    btnBuscar.disabled = false;
    btnBuscar.textContent = "Buscar aulas e eventos";
  }
}

// ======================================================
// SALVAR DURAÇÃO
// ======================================================

async function salvarDuracaoItem(
  chave,
  botao
) {
  const item =
    itensFinanceiroCache.find(
      (registro) => {
        return (
          registro.chave ===
          chave
        );
      }
    );

  if (!item) {
    mostrarMensagem(
      "Aula ou evento não encontrado.",
      false
    );

    return;
  }

  const valorDuracao =
    normalizarDuracaoSegundos(
      item.duracao_segundos
    );

  if (
    valorDuracao === null ||
    valorDuracao <= 0
  ) {
    mostrarMensagem(
      "Informe uma minutagem maior que zero antes de salvar.",
      false
    );

    return;
  }

  if (
    !Array.isArray(item.ids_aula) ||
    !item.ids_aula.length
  ) {
    mostrarMensagem(
      "Nenhum registro foi encontrado para salvar.",
      false
    );

    return;
  }

  botao.disabled = true;

  const textoOriginal =
    botao.textContent;

  botao.textContent =
    "Salvando...";

  try {
    /*
      Em aulas coletivas e eventos, todos os registros
      do grupo recebem a mesma duração.

      O financeiro, porém, continuará exibindo e
      calculando somente um lançamento.
    */
    const { error } =
      await supabase
        .from("aula")
        .update({
          duracao_segundos:
            valorDuracao
        })
        .in(
          "id",
          item.ids_aula.map(Number)
        );

    if (error) {
      throw error;
    }

    item.duracao_segundos_salva =
      valorDuracao;

    item.duracao_segundos =
      valorDuracao;

    item.duracao_input =
      formatarSegundosParaCampo(
        valorDuracao
      );

    item.editando = false;

    mostrarMensagem(
      item.eh_evento
        ? "Minutagem do evento salva com sucesso!"
        : "Minutagem da aula salva com sucesso!",
      true
    );

    itensFinanceiroCache = aplicarFiltroMinutagem(todosItens);
    renderItensFinanceiro();
  } catch (error) {
    console.error(
      "Erro ao salvar minutagem:",
      error
    );

    mostrarMensagem(
      item.eh_evento
        ? "Erro ao salvar a minutagem do evento."
        : "Erro ao salvar a minutagem da aula.",
      false
    );

    botao.disabled = false;

    botao.textContent =
      textoOriginal;
  }
}

// ======================================================
// EVENTOS DA PÁGINA
// ======================================================

btnBuscar.addEventListener(
  "click",
  buscarAulas
);

filtroProfessor.addEventListener(
  "change",
  () => {
    todosItens = [];
    itensFinanceiroCache = [];

    listaAulas.innerHTML = `
      <div
        style="
          opacity:0.8;
          font-size:13px;
        "
      >
        Clique em buscar para visualizar as aulas e os eventos.
      </div>
    `;

    atualizarResumo();
  }
);

// ======================================================
// INICIALIZAÇÃO
// ======================================================

filtroMinutagem.addEventListener("change", () => {
  if (btnBuscar.disabled) return;
  itensFinanceiroCache = aplicarFiltroMinutagem(todosItens);
  renderItensFinanceiro();
});

filtroDia.addEventListener("change", () => {
  filtroMes.disabled = filtroAno.disabled = Boolean(filtroDia.value);
});

function inicializarPagina() {
  preencherAnos();

  const hoje = new Date();

  filtroDia.value = "";

  filtroMes.value =
    String(
      hoje.getMonth() + 1
    );

  filtroAno.value =
    String(
      hoje.getFullYear()
    );

  filtroMinutagem.value = "";

  carregarProfessores();
}

inicializarPagina();