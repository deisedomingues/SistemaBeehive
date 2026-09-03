import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

/* =====================================================
   1) ACESSO
===================================================== */

await exigirAdmin();

/* =====================================================
   2) ELEMENTOS
===================================================== */

const btnSair =
  document.getElementById(
    "btnSair"
  );

const badgeNotificacoesPedagogico =
  document.getElementById(
    "badgeNotificacoesPedagogico"
  );

const textoNotificacoesPedagogico =
  document.getElementById(
    "textoNotificacoesPedagogico"
  );

const listaNotificacoesPedagogico =
  document.getElementById(
    "listaNotificacoesPedagogico"
  );

const btnAtualizarNotificacoesPedagogico =
  document.getElementById(
    "btnAtualizarNotificacoesPedagogico"
  );

const btnMarcarTodasVistas =
  document.getElementById(
    "btnMarcarTodasVistas"
  );

/* =====================================================
   3) CONFIGURAÇÕES
===================================================== */

const CHAVE_VISTOS_PEDAGOGICO =
  "beehive_notificacoes_pedagogico_vistas";

const FUSO_HORARIO =
  "America/Sao_Paulo";

let notificacoesAtuais = [];
let mostrarAnteriores = false;

/* =====================================================
   4) SEGURANÇA PARA TEXTO
===================================================== */

function escaparHTML(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =====================================================
   5) DATAS
===================================================== */

function formatarDataBR(valor) {
  if (!valor) {
    return "";
  }

  const texto =
    String(valor).trim();

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      texto
    )
  ) {
    const [
      ano,
      mes,
      dia
    ] =
      texto.split("-");

    return `${dia}/${mes}/${ano}`;
  }

  const data =
    new Date(texto);

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return texto;
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      timeZone:
        FUSO_HORARIO,

      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric"
    }
  ).format(data);
}

function formatarHora(
  hora
) {
  if (!hora) {
    return "";
  }

  return String(hora)
    .slice(0, 5);
}

function obterPartesDataNoFuso(data = new Date()) {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_HORARIO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(data);

  const valores = {};

  partes.forEach((parte) => {
    if (parte.type !== "literal") {
      valores[parte.type] = parte.value;
    }
  });

  return {
    ano: valores.year,
    mes: valores.month,
    dia: valores.day
  };
}

function hojeISO() {
  const { ano, mes, dia } = obterPartesDataNoFuso();
  return `${ano}-${mes}-${dia}`;
}

/* =====================================================
   6) VISTOS
===================================================== */

function carregarIdsVistos() {
  try {
    const salvos =
      JSON.parse(
        localStorage.getItem(
          CHAVE_VISTOS_PEDAGOGICO
        ) || "[]"
      );

    return new Set(
      (salvos || []).map(
        id =>
          String(id)
      )
    );

  } catch (error) {
    console.warn(
      "Não foi possível carregar notificações vistas:",
      error
    );

    return new Set();
  }
}

function salvarIdsVistos(
  ids
) {
  localStorage.setItem(
    CHAVE_VISTOS_PEDAGOGICO,
    JSON.stringify(
      [...ids].map(
        String
      )
    )
  );
}

function estaVisto(
  notificacaoId
) {
  return carregarIdsVistos()
    .has(
      String(
        notificacaoId
      )
    );
}

function marcarVistoLocal(
  notificacaoId
) {
  const ids =
    carregarIdsVistos();

  ids.add(
    String(
      notificacaoId
    )
  );

  salvarIdsVistos(
    ids
  );
}

function marcarTodosVistosLocal(
  notificacoes
) {
  const ids =
    carregarIdsVistos();

  notificacoes.forEach(
    item => {
      if (
        item.notificacao_id
      ) {
        ids.add(
          String(
            item.notificacao_id
          )
        );
      }
    }
  );

  salvarIdsVistos(
    ids
  );
}

/* =====================================================
   7) BADGE
===================================================== */

function atualizarBadge(
  total
) {
  if (
    !badgeNotificacoesPedagogico
  ) {
    return;
  }

  const quantidade =
    Number(total || 0);

  if (
    quantidade > 0
  ) {
    badgeNotificacoesPedagogico
      .textContent =
      quantidade > 99
        ? "99+"
        : String(
            quantidade
          );

    badgeNotificacoesPedagogico
      .style.display =
      "inline-flex";

    return;
  }

  badgeNotificacoesPedagogico
    .textContent =
    "0";

  badgeNotificacoesPedagogico
    .style.display =
    "none";
}

/* =====================================================
   8) BUSCAR AVISOS DE AUSÊNCIA
===================================================== */

async function buscarAvisosAusencia() {
  const {
    data,
    error
  } =
    await supabase
      .from(
        "aviso_ausencia"
      )
      .select(`
        id,
        aluno_id,
        matricula_id,
        horario_aula_id,
        professor_id,
        data_aula,
        hora_inicio,
        hora_fim,
        justificativa,
        tipo_solicitacao,
        dentro_prazo_reposicao,
        antecedencia_minutos,
        status,
        criado_em
      `)
      .eq(
        "status",
        "pendente"
      )
      .order(
        "data_aula",
        {
          ascending: true
        }
      )
      .order(
        "hora_inicio",
        {
          ascending: true
        }
      );

  if (error) {
    console.error(
      "Erro ao buscar avisos de ausência:",
      error
    );

    throw error;
  }

  return data || [];
}

/* =====================================================
   9) BUSCAR ALUNOS
===================================================== */

async function buscarAlunosPorIds(
  alunosIds
) {
  if (
    !alunosIds.length
  ) {
    return new Map();
  }

  const {
    data,
    error
  } =
    await supabase
      .from("aluno")
      .select(`
        id,
        nome
      `)
      .in(
        "id",
        alunosIds
      );

  if (error) {
    console.error(
      "Erro ao buscar alunos:",
      error
    );

    return new Map();
  }

  return new Map(
    (data || []).map(
      aluno => [
        Number(
          aluno.id
        ),
        aluno
      ]
    )
  );
}

/* =====================================================
   10) BUSCAR PROFESSORES
===================================================== */

async function buscarProfessoresPorIds(
  professoresIds
) {
  if (
    !professoresIds.length
  ) {
    return new Map();
  }

  const {
    data,
    error
  } =
    await supabase
      .from("professor")
      .select(`
        id,
        nome
      `)
      .in(
        "id",
        professoresIds
      );

  if (error) {
    console.error(
      "Erro ao buscar professores:",
      error
    );

    return new Map();
  }

  return new Map(
    (data || []).map(
      professor => [
        Number(
          professor.id
        ),
        professor
      ]
    )
  );
}

/* =====================================================
   11) BUSCAR MATRÍCULAS
===================================================== */

async function buscarMatriculasPorIds(
  matriculasIds
) {
  if (
    !matriculasIds.length
  ) {
    return new Map();
  }

  const {
    data,
    error
  } =
    await supabase
      .from("matricula")
      .select(`
        id,
        materia_id,
        modulo_id
      `)
      .in(
        "id",
        matriculasIds
      );

  if (error) {
    console.error(
      "Erro ao buscar matrículas:",
      error
    );

    return new Map();
  }

  return new Map(
    (data || []).map(
      matricula => [
        Number(
          matricula.id
        ),
        matricula
      ]
    )
  );
}

/* =====================================================
   12) BUSCAR MATÉRIAS
===================================================== */

async function buscarMateriasPorIds(
  materiasIds
) {
  if (
    !materiasIds.length
  ) {
    return new Map();
  }

  const {
    data,
    error
  } =
    await supabase
      .from("materia")
      .select(`
        id,
        nome
      `)
      .in(
        "id",
        materiasIds
      );

  if (error) {
    console.error(
      "Erro ao buscar matérias:",
      error
    );

    return new Map();
  }

  return new Map(
    (data || []).map(
      materia => [
        Number(
          materia.id
        ),
        materia
      ]
    )
  );
}

/* =====================================================
   13) BUSCAR MÓDULOS
===================================================== */

async function buscarModulosPorIds(
  modulosIds
) {
  if (
    !modulosIds.length
  ) {
    return new Map();
  }

  const {
    data,
    error
  } =
    await supabase
      .from("modulo")
      .select(`
        id,
        nome
      `)
      .in(
        "id",
        modulosIds
      );

  if (error) {
    console.error(
      "Erro ao buscar módulos:",
      error
    );

    return new Map();
  }

  return new Map(
    (data || []).map(
      modulo => [
        Number(
          modulo.id
        ),
        modulo
      ]
    )
  );
}

/* =====================================================
   14) MONTAR NOTIFICAÇÕES
===================================================== */

async function montarNotificacoes() {
  const avisos =
    await buscarAvisosAusencia();

  if (
    !avisos.length
  ) {
    return [];
  }

  const alunosIds = [
    ...new Set(
      avisos
        .map(
          item =>
            Number(
              item.aluno_id
            )
        )
        .filter(Boolean)
    )
  ];

  const professoresIds = [
    ...new Set(
      avisos
        .map(
          item =>
            Number(
              item.professor_id
            )
        )
        .filter(Boolean)
    )
  ];

  const matriculasIds = [
    ...new Set(
      avisos
        .map(
          item =>
            Number(
              item.matricula_id
            )
        )
        .filter(Boolean)
    )
  ];

  const mapaAlunos =
    await buscarAlunosPorIds(
      alunosIds
    );

  const mapaProfessores =
    await buscarProfessoresPorIds(
      professoresIds
    );

  const mapaMatriculas =
    await buscarMatriculasPorIds(
      matriculasIds
    );

  const materiasIds = [
    ...new Set(
      [...mapaMatriculas.values()]
        .map(
          item =>
            Number(
              item.materia_id
            )
        )
        .filter(Boolean)
    )
  ];

  const modulosIds = [
    ...new Set(
      [...mapaMatriculas.values()]
        .map(
          item =>
            Number(
              item.modulo_id
            )
        )
        .filter(Boolean)
    )
  ];

  const mapaMaterias =
    await buscarMateriasPorIds(
      materiasIds
    );

  const mapaModulos =
    await buscarModulosPorIds(
      modulosIds
    );

  return avisos.map(
    aviso => {
      const aluno =
        mapaAlunos.get(
          Number(
            aviso.aluno_id
          )
        );

      const professor =
        mapaProfessores.get(
          Number(
            aviso.professor_id
          )
        );

      const matricula =
        mapaMatriculas.get(
          Number(
            aviso.matricula_id
          )
        );

      const materia =
        mapaMaterias.get(
          Number(
            matricula?.materia_id
          )
        );

      const modulo =
        mapaModulos.get(
          Number(
            matricula?.modulo_id
          )
        );

      return {
        ...aviso,

        notificacao_id:
          `ausencia_${aviso.id}`,

        aluno_nome:
          aluno?.nome ||
          "Aluno não informado",

        professor_nome:
          professor?.nome ||
          "Professor não informado",

        materia_nome:
          materia?.nome ||
          "Curso não informado",

        modulo_nome:
          modulo?.nome ||
          "Módulo não informado"
      };
    }
  );
}

/* =====================================================
   15) TEXTO DA SOLICITAÇÃO
===================================================== */

function textoSolicitacao(
  tipo
) {
  if (
    tipo === "reposicao"
  ) {
    return "Aluno prefere reposição";
  }

  return "Gravar esta aula";
}

/* =====================================================
   16) CARD DE AUSÊNCIA
===================================================== */

function renderizarCardAusencia(
  item
) {
  const card =
    document.createElement(
      "article"
    );

  card.className =
    "card-admin card-professor notificacao-professor-card";

  const visto =
    estaVisto(
      item.notificacao_id
    );

  const statusHTML =
    visto
      ? `
        <span
          style="
            display:inline-flex;
            padding:4px 9px;
            border-radius:999px;
            background:#e8f5e9;
            color:#1b5e20;
            font-size:12px;
            font-weight:bold;
          "
        >
          Visto
        </span>
      `
      : `
        <span
          style="
            display:inline-flex;
            padding:4px 9px;
            border-radius:999px;
            background:#c62828;
            color:#ffffff;
            font-size:12px;
            font-weight:bold;
          "
        >
          Novo
        </span>
      `;

  card.innerHTML = `
    <div class="card-admin-icone">
      ${visto ? "✅" : "⚠️"}
    </div>

    <div class="card-admin-conteudo">

      <div
        style="
          display:flex;
          align-items:center;
          gap:8px;
          flex-wrap:wrap;
          margin-bottom:5px;
        "
      >

        <h2
          style="
            margin:0;
          "
        >
          Aviso de ausência
        </h2>

        ${statusHTML}

      </div>

      <p>
        <strong>
          ${escaparHTML(
            item.aluno_nome
          )}
        </strong>
        informou que não poderá comparecer à aula.
      </p>

      <p>
        <strong>Professor:</strong>
        ${escaparHTML(
          item.professor_nome
        )}
      </p>

      <p>
        <strong>Curso:</strong>
        ${escaparHTML(
          item.materia_nome
        )}
        •
        ${escaparHTML(
          item.modulo_nome
        )}
      </p>

      <p>
        <strong>Data:</strong>
        ${escaparHTML(
          formatarDataBR(
            item.data_aula
          )
        )}
      </p>

      <p>
        <strong>Horário:</strong>
        ${escaparHTML(
          formatarHora(
            item.hora_inicio
          )
        )}
        às
        ${escaparHTML(
          formatarHora(
            item.hora_fim
          )
        )}
      </p>

      <div
        style="
          margin-top:10px;
          padding:10px 12px;
          border-radius:10px;
          background:#fff8dc;
          border:1px solid #f1bc32;
          color:#5f4700;
        "
      >

        <strong>
          Justificativa:
        </strong>

        <br>

        ${escaparHTML(
          item.justificativa ||
          "Não informada"
        )}

      </div>

      <div
        style="
          margin-top:10px;
          padding:10px 12px;
          border-radius:10px;
          background:#f7f7f7;
          border:1px solid #dddddd;
        "
      >

        <strong>
          Solicitação:
        </strong>

        ${escaparHTML(
          textoSolicitacao(
            item.tipo_solicitacao
          )
        )}

      </div>

      ${
        item.antecedencia_minutos !== null &&
        item.antecedencia_minutos !== undefined
          ? `
            <p
              style="
                margin-top:10px;
                font-size:13px;
                opacity:0.85;
              "
            >
              Aviso realizado com
              <strong>
                ${escaparHTML(
                  item.antecedencia_minutos
                )} minuto(s)
              </strong>
              de antecedência.
            </p>
          `
          : ""
      }

      <div
        style="
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          margin-top:12px;
        "
      >

        <button
          type="button"
          class="btn-principal btn-marcar-visto"
          data-notificacao-id="${
            escaparHTML(
              item.notificacao_id
            )
          }"
          ${visto ? "disabled" : ""}
        >
          ${
            visto
              ? "Já visto"
              : "Marcar como visto"
          }
        </button>

      </div>

    </div>
  `;

  return card;
}

/* =====================================================
   17) ESTADO VAZIO
===================================================== */

function renderizarEstadoVazio() {
  textoNotificacoesPedagogico
    .textContent =
    "Nenhum aviso de ausência pendente no momento.";

  atualizarBadge(0);

  listaNotificacoesPedagogico
    .innerHTML = `
      <article
        class="
          card-admin
          card-professor
          notificacao-professor-card
        "
      >

        <div class="card-admin-icone">
          ✅
        </div>

        <div class="card-admin-conteudo">

          <h2>
            Tudo certo por aqui
          </h2>

          <p>
            Quando um aluno informar que vai faltar,
            o aviso aparecerá nesta tela.
          </p>

        </div>

      </article>
    `;
}

/* =====================================================
   18) RENDERIZAR
===================================================== */

function adicionarBotaoAnteriores(totalAnteriores) {
  if (!listaNotificacoesPedagogico || totalAnteriores <= 0) {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    display:flex;
    justify-content:center;
    margin:8px 0 14px;
  `;

  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "btn-secundario";
  botao.textContent = mostrarAnteriores
    ? "Ocultar anteriores"
    : `Ver anteriores (${totalAnteriores})`;

  botao.addEventListener("click", () => {
    mostrarAnteriores = !mostrarAnteriores;
    renderizarNotificacoes(notificacoesAtuais);
  });

  wrapper.appendChild(botao);
  listaNotificacoesPedagogico.appendChild(wrapper);
}

function renderizarNotificacoes(
  notificacoes
) {
  notificacoesAtuais =
    notificacoes || [];

  listaNotificacoesPedagogico.innerHTML = "";

  if (!notificacoesAtuais.length) {
    renderizarEstadoVazio();
    return;
  }

  const hoje = hojeISO();

  const avisosAtuais = notificacoesAtuais
    .filter((item) => item.data_aula >= hoje)
    .sort((a, b) => {
      const chaveA = `${a.data_aula || "9999-99-99"} ${a.hora_inicio || "00:00"}`;
      const chaveB = `${b.data_aula || "9999-99-99"} ${b.hora_inicio || "00:00"}`;
      return chaveA.localeCompare(chaveB);
    });

  const avisosAnteriores = notificacoesAtuais
    .filter((item) => item.data_aula < hoje)
    .sort((a, b) => {
      const chaveA = `${a.data_aula || "0000-00-00"} ${a.hora_inicio || "00:00"}`;
      const chaveB = `${b.data_aula || "0000-00-00"} ${b.hora_inicio || "00:00"}`;
      return chaveB.localeCompare(chaveA);
    });

  const totalNovasAtuais = avisosAtuais
    .filter((item) => !estaVisto(item.notificacao_id))
    .length;

  atualizarBadge(totalNovasAtuais);

  if (avisosAtuais.length > 0) {
    textoNotificacoesPedagogico.textContent =
      totalNovasAtuais === 0
        ? avisosAtuais.length === 1
          ? "Você tem 1 aviso de ausência futuro já visto."
          : `Você tem ${avisosAtuais.length} avisos de ausência futuros já vistos.`
        : totalNovasAtuais === 1
          ? `Você tem 1 novo aviso de ausência e ${avisosAtuais.length} aviso(s) futuro(s) no total.`
          : `Você tem ${totalNovasAtuais} novos avisos de ausência e ${avisosAtuais.length} aviso(s) futuro(s) no total.`;
  } else {
    textoNotificacoesPedagogico.textContent =
      avisosAnteriores.length > 0
        ? "Nenhum aviso de ausência futuro. Você pode consultar os anteriores abaixo."
        : "Nenhum aviso de ausência pendente no momento.";
  }

  avisosAtuais.forEach((item) => {
    listaNotificacoesPedagogico.appendChild(
      renderizarCardAusencia(item)
    );
  });

  adicionarBotaoAnteriores(avisosAnteriores.length);

  if (mostrarAnteriores && avisosAnteriores.length > 0) {
    const titulo = document.createElement("div");
    titulo.innerHTML = `
      <h2 style="margin:6px 0 10px; font-size:18px;">
        Avisos anteriores
      </h2>
    `;
    listaNotificacoesPedagogico.appendChild(titulo);

    avisosAnteriores.forEach((item) => {
      listaNotificacoesPedagogico.appendChild(
        renderizarCardAusencia(item)
      );
    });
  }

  document
    .querySelectorAll(".btn-marcar-visto")
    .forEach((botao) => {
      botao.addEventListener("click", () => {
        const notificacaoId = botao.dataset.notificacaoId;

        if (!notificacaoId) {
          return;
        }

        marcarComoVista(notificacaoId);
      });
    });
}

/* =====================================================
   19) CARREGAR
===================================================== */

async function carregarNotificacoes() {
  textoNotificacoesPedagogico
    .textContent =
    "Carregando notificações...";

  listaNotificacoesPedagogico
    .innerHTML = `
      <article
        class="
          card-admin
          card-professor
          notificacao-professor-card
        "
      >

        <div class="card-admin-icone">
          ⏳
        </div>

        <div class="card-admin-conteudo">

          <h2>
            Carregando...
          </h2>

          <p>
            Aguarde enquanto buscamos os avisos
            de ausência.
          </p>

        </div>

      </article>
    `;

  atualizarBadge(0);

  try {
    const notificacoes =
      await montarNotificacoes();

    renderizarNotificacoes(
      notificacoes
    );

  } catch (error) {
    console.error(
      "Erro ao carregar notificações pedagógicas:",
      error
    );

    textoNotificacoesPedagogico
      .textContent =
      "Não foi possível carregar as notificações.";

    listaNotificacoesPedagogico
      .innerHTML = `
        <article
          class="
            card-admin
            card-professor
            notificacao-professor-card
          "
        >

          <div class="card-admin-icone">
            ⚠️
          </div>

          <div class="card-admin-conteudo">

            <h2>
              Erro ao carregar
            </h2>

            <p>
              Tente atualizar a página.
            </p>

          </div>

        </article>
      `;
  }
}

/* =====================================================
   20) MARCAR COMO VISTO
===================================================== */

function marcarComoVista(
  notificacaoId
) {
  marcarVistoLocal(
    notificacaoId
  );

  renderizarNotificacoes(
    notificacoesAtuais
  );
}

function marcarTodasComoVistas() {
  if (
    !notificacoesAtuais.length
  ) {
    alert(
      "Não há notificações para marcar como vistas."
    );

    return;
  }

  const confirmar =
    confirm(
      "Deseja marcar todos os avisos como vistos? Eles continuarão aparecendo enquanto estiverem ativos."
    );

  if (!confirmar) {
    return;
  }

  marcarTodosVistosLocal(
    notificacoesAtuais
  );

  renderizarNotificacoes(
    notificacoesAtuais
  );
}

/* =====================================================
   21) BOTÕES
===================================================== */

btnAtualizarNotificacoesPedagogico
  ?.addEventListener(
    "click",
    async () => {
      await carregarNotificacoes();
    }
  );

btnMarcarTodasVistas
  ?.addEventListener(
    "click",
    () => {
      marcarTodasComoVistas();
    }
  );

/* =====================================================
   22) SAIR
===================================================== */

btnSair?.addEventListener(
  "click",
  async () => {
    try {
      await supabase.auth.signOut();

    } catch (error) {
      console.error(
        "Erro ao sair:",
        error
      );
    }

    localStorage.removeItem(
      "role"
    );

    localStorage.removeItem(
      "professorId"
    );

    localStorage.removeItem(
      "professorNome"
    );

    localStorage.removeItem(
      "professorEmail"
    );

    localStorage.removeItem(
      "matriculaSelecionada"
    );

    localStorage.removeItem(
      "alunoIdVisualizacao"
    );

    window.location.href =
      "index.html";
  }
);

/* =====================================================
   23) INICIAR
===================================================== */

await carregarNotificacoes();