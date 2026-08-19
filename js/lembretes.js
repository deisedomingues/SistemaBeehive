import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

/* =========================================================
   ACESSO
========================================================= */

const perfilAdmin = await exigirAdmin();

if (!perfilAdmin) {
  throw new Error("Acesso não autorizado.");
}

/* =========================================================
   CONFIGURAÇÕES
========================================================= */

// Mesmo CNPJ já usado no resumo-geral.js para identificar
// funcionários/alunos internos da própria Beehive.
const CNPJ_BEEHIVE = "50715902000182";

// Quantidade de próximos aniversariantes mostrados antes de expandir.
const LIMITE_PROXIMOS_RECOLHIDO = 6;

// Tamanho de página para evitar o limite padrão de registros do Supabase.
const TAMANHO_PAGINA_SUPABASE = 1000;

/* =========================================================
   ELEMENTOS
========================================================= */

const msgLembretes = document.getElementById("msgLembretes");
const semanaAniversarios = document.getElementById("semanaAniversarios");
const proximosAniversarios = document.getElementById("proximosAniversarios");
const btnToggleProximos = document.getElementById("btnToggleProximos");

const qtdSemana = document.getElementById("qtdSemana");
const proximoResumo = document.getElementById("proximoResumo");
const periodoSemana = document.getElementById("periodoSemana");

const btnSair = document.getElementById("btnSair");

/* =========================================================
   ESTADO
========================================================= */

let pessoas = [];
let proximosExpandido = false;

/* =========================================================
   UTILITÁRIOS
========================================================= */

function escapeHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mostrarMensagem(texto, tipo = "erro") {
  if (!msgLembretes) return;

  msgLembretes.textContent = texto;
  msgLembretes.className = `lembretes-status ${tipo}`;
}

function limparMensagem() {
  if (!msgLembretes) return;

  msgLembretes.textContent = "";
  msgLembretes.className = "lembretes-status";
}

function inicioDoDia(data) {
  return new Date(
    data.getFullYear(),
    data.getMonth(),
    data.getDate()
  );
}

function adicionarDias(data, quantidade) {
  const novaData = new Date(
    data.getFullYear(),
    data.getMonth(),
    data.getDate()
  );

  novaData.setDate(novaData.getDate() + quantidade);

  return novaData;
}

function mesmaData(dataA, dataB) {
  return (
    dataA.getFullYear() === dataB.getFullYear() &&
    dataA.getMonth() === dataB.getMonth() &&
    dataA.getDate() === dataB.getDate()
  );
}

function formatarDataCurta(data) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit"
  }).format(data);
}

function formatarDataComAno(data) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(data);
}

function nomeDiaSemana(data) {
  const nome = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long"
  }).format(data);

  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

function diasEntre(dataInicial, dataFinal) {
  const msPorDia = 24 * 60 * 60 * 1000;

  const inicio = Date.UTC(
    dataInicial.getFullYear(),
    dataInicial.getMonth(),
    dataInicial.getDate()
  );

  const fim = Date.UTC(
    dataFinal.getFullYear(),
    dataFinal.getMonth(),
    dataFinal.getDate()
  );

  return Math.round((fim - inicio) / msPorDia);
}

function obterPartesDataNascimento(dataNascimento) {
  if (!dataNascimento) return null;

  const texto = String(dataNascimento).trim();

  // Esperado no banco: YYYY-MM-DD
  const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) return null;

  const ano = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);

  if (!ano || !mes || !dia) return null;

  return { ano, mes, dia };
}

function ultimoDiaDoMes(ano, mesHumano) {
  return new Date(ano, mesHumano, 0).getDate();
}

function criarDataAniversarioNoAno(partesNascimento, ano) {
  const ultimoDia = ultimoDiaDoMes(ano, partesNascimento.mes);
  const diaValido = Math.min(partesNascimento.dia, ultimoDia);

  return new Date(
    ano,
    partesNascimento.mes - 1,
    diaValido
  );
}

function obterProximaDataAniversario(dataNascimento, referencia = new Date()) {
  const partes = obterPartesDataNascimento(dataNascimento);

  if (!partes) return null;

  const hoje = inicioDoDia(referencia);

  let aniversario = criarDataAniversarioNoAno(
    partes,
    hoje.getFullYear()
  );

  if (aniversario < hoje) {
    aniversario = criarDataAniversarioNoAno(
      partes,
      hoje.getFullYear() + 1
    );
  }

  return aniversario;
}

function calcularIdadeNoAniversario(dataNascimento, dataAniversario) {
  const partes = obterPartesDataNascimento(dataNascimento);

  if (!partes || !dataAniversario) return null;

  return dataAniversario.getFullYear() - partes.ano;
}

function rotuloTipo(tipo) {
  return tipo === "professor"
    ? "Professor(a)"
    : "Aluno(a)";
}

function rotuloIdade(idade) {
  if (!Number.isFinite(idade) || idade < 0) {
    return "idade não informada";
  }

  return `${idade} ${idade === 1 ? "ano" : "anos"}`;
}

function obterInicioFimSemana(referencia = new Date()) {
  const hoje = inicioDoDia(referencia);

  // JavaScript: domingo = 0, segunda = 1, ..., sábado = 6.
  const domingo = adicionarDias(hoje, -hoje.getDay());
  const sabado = adicionarDias(domingo, 6);

  return { domingo, sabado };
}

function pessoaEstaNaSemana(pessoa, domingo, sabado) {
  const partes = obterPartesDataNascimento(pessoa.data_nascimento);

  if (!partes) return null;

  // A semana pode atravessar a virada do ano.
  const anosPossiveis = Array.from(
    new Set([domingo.getFullYear(), sabado.getFullYear()])
  );

  for (const ano of anosPossiveis) {
    const aniversario = criarDataAniversarioNoAno(partes, ano);

    if (aniversario >= domingo && aniversario <= sabado) {
      return aniversario;
    }
  }

  return null;
}

function textoDiasAte(dataAniversario) {
  const hoje = inicioDoDia(new Date());
  const diferenca = diasEntre(hoje, dataAniversario);

  if (diferenca === 0) return "Hoje";
  if (diferenca === 1) return "Amanhã";

  return `Em ${diferenca} dias`;
}

/* =========================================================
   GOOGLE AGENDA
========================================================= */

function dataGoogleAgenda(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");

  return `${ano}${mes}${dia}`;
}

function criarLinkGoogleAgenda(pessoa, dataAniversario) {
  const inicio = dataGoogleAgenda(dataAniversario);
  const fim = dataGoogleAgenda(adicionarDias(dataAniversario, 1));

  const idade = calcularIdadeNoAniversario(
    pessoa.data_nascimento,
    dataAniversario
  );

  const titulo = `Aniversário - ${pessoa.nome}`;

  const detalhes = [
    `Aniversário de ${pessoa.nome}.`,
    `${rotuloTipo(pessoa.tipo)} da Beehive.`,
    `Faz ${rotuloIdade(idade)} nesta data.`,
    "Lembrete para preparar a homenagem/postagem de aniversário."
  ].join("\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: titulo,
    dates: `${inicio}/${fim}`,
    details: detalhes,
    recur: "RRULE:FREQ=YEARLY"
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/* =========================================================
   BUSCA PAGINADA NO SUPABASE
========================================================= */

async function buscarTodasAsPaginas(criarConsulta) {
  let todos = [];
  let inicio = 0;

  while (true) {
    const fim = inicio + TAMANHO_PAGINA_SUPABASE - 1;

    const { data, error } = await criarConsulta().range(inicio, fim);

    if (error) {
      throw error;
    }

    const lote = data || [];

    todos = todos.concat(lote);

    if (lote.length < TAMANHO_PAGINA_SUPABASE) {
      break;
    }

    inicio += TAMANHO_PAGINA_SUPABASE;
  }

  return todos;
}

/* =========================================================
   CARREGAMENTO DE DADOS
========================================================= */

async function carregarAlunosAtivos() {
  /*
    Usamos matrícula ativa, igual ao padrão do resumo-geral.js.
    Assim, não aparecem ex-alunos sem matrícula ativa.

    Também ignoramos alunos internos ligados ao CNPJ da própria
    Beehive, porque Gretha/Marina, por exemplo, podem aparecer
    como professoras e como alunas. Para o lembrete de aniversário,
    queremos evitar duplicidade.
  */

  const matriculas = await buscarTodasAsPaginas(() =>
    supabase
      .from("matricula")
      .select(`
        id,
        ativa,
        aluno_id,
        aluno:aluno_id (
          id,
          nome,
          email,
          data_nascimento,
          empresa_cnpj
        )
      `)
      .eq("ativa", true)
  );

  const alunosPorId = new Map();

  (matriculas || []).forEach((matricula) => {
    const aluno = matricula?.aluno;

    if (!aluno?.id) return;
    if (!aluno?.data_nascimento) return;

    const empresaCnpj = String(aluno?.empresa_cnpj || "").trim();

    if (empresaCnpj === CNPJ_BEEHIVE) {
      return;
    }

    if (!alunosPorId.has(aluno.id)) {
      alunosPorId.set(aluno.id, {
        id: aluno.id,
        nome: aluno.nome || "Aluno(a)",
        email: aluno.email || "",
        data_nascimento: aluno.data_nascimento,
        tipo: "aluno"
      });
    }
  });

  return Array.from(alunosPorId.values());
}

async function carregarProfessoresAtivos() {
  const professores = await buscarTodasAsPaginas(() =>
    supabase
      .from("professor")
      .select("id, nome, email, ativo, data_nascimento")
      .eq("ativo", true)
      .order("nome", { ascending: true })
  );

  return (professores || [])
    .filter((professor) => professor?.data_nascimento)
    .map((professor) => ({
      id: professor.id,
      nome: professor.nome || "Professor(a)",
      email: professor.email || "",
      data_nascimento: professor.data_nascimento,
      tipo: "professor"
    }));
}

async function carregarPessoas() {
  const [alunos, professores] = await Promise.all([
    carregarAlunosAtivos(),
    carregarProfessoresAtivos()
  ]);

  pessoas = [...alunos, ...professores]
    .filter((pessoa) => obterPartesDataNascimento(pessoa.data_nascimento))
    .sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR")
    );
}

/* =========================================================
   CÁLCULOS
========================================================= */

function obterAniversariantesDaSemana() {
  const { domingo, sabado } = obterInicioFimSemana();

  return pessoas
    .map((pessoa) => {
      const dataAniversario = pessoaEstaNaSemana(
        pessoa,
        domingo,
        sabado
      );

      if (!dataAniversario) return null;

      return {
        ...pessoa,
        dataAniversario,
        idade: calcularIdadeNoAniversario(
          pessoa.data_nascimento,
          dataAniversario
        )
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const diferencaData =
        a.dataAniversario.getTime() -
        b.dataAniversario.getTime();

      if (diferencaData !== 0) {
        return diferencaData;
      }

      return a.nome.localeCompare(b.nome, "pt-BR");
    });
}

function obterProximosAniversariantes() {
  const hoje = inicioDoDia(new Date());
  const { sabado } = obterInicioFimSemana(hoje);

  return pessoas
    .map((pessoa) => {
      let dataAniversario = obterProximaDataAniversario(
        pessoa.data_nascimento,
        hoje
      );

      if (!dataAniversario) return null;

      // A seção "Próximos aniversariantes" começa DEPOIS
      // do sábado da semana atual.
      if (dataAniversario <= sabado) {
        const partes = obterPartesDataNascimento(
          pessoa.data_nascimento
        );

        dataAniversario = criarDataAniversarioNoAno(
          partes,
          dataAniversario.getFullYear() + 1
        );
      }

      return {
        ...pessoa,
        dataAniversario,
        idade: calcularIdadeNoAniversario(
          pessoa.data_nascimento,
          dataAniversario
        )
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const diferencaData =
        a.dataAniversario.getTime() -
        b.dataAniversario.getTime();

      if (diferencaData !== 0) {
        return diferencaData;
      }

      return a.nome.localeCompare(b.nome, "pt-BR");
    });
}

/* =========================================================
   RENDER - SEMANA
========================================================= */

function renderSemana() {
  if (!semanaAniversarios) return;

  const hoje = inicioDoDia(new Date());
  const { domingo, sabado } = obterInicioFimSemana(hoje);
  const aniversariantesSemana = obterAniversariantesDaSemana();

  if (qtdSemana) {
    qtdSemana.textContent = String(aniversariantesSemana.length);
  }

  if (periodoSemana) {
    periodoSemana.textContent =
      `${formatarDataCurta(domingo)} a ${formatarDataCurta(sabado)}`;
  }

  const dias = [];

  for (let i = 0; i < 7; i += 1) {
    dias.push(adicionarDias(domingo, i));
  }

  semanaAniversarios.innerHTML = dias
    .map((dia) => {
      const pessoasDoDia = aniversariantesSemana.filter(
        (pessoa) => mesmaData(pessoa.dataAniversario, dia)
      );

      const ehHoje = mesmaData(dia, hoje);

      const conteudo = pessoasDoDia.length
        ? pessoasDoDia
            .map((pessoa) => {
              const linkAgenda = criarLinkGoogleAgenda(
                pessoa,
                pessoa.dataAniversario
              );

              return `
                <div class="aniversariante-item">
                  <div class="aniversariante-nome">
                    ${escapeHtml(formatarDataCurta(dia))} - ${escapeHtml(pessoa.nome)}
                  </div>

                  <div class="aniversariante-detalhes">
                    ${escapeHtml(rotuloTipo(pessoa.tipo))}
                    • faz ${escapeHtml(rotuloIdade(pessoa.idade))}
                  </div>

                  <a
                    class="btn-google-agenda"
                    href="${escapeHtml(linkAgenda)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Adicionar aniversário ao Google Agenda"
                  >
                    📅 Google Agenda
                  </a>
                </div>
              `;
            })
            .join("")
        : `
          <p class="sem-aniversario-dia">
            Nenhum aniversariante.
          </p>
        `;

      return `
        <article class="dia-aniversario ${ehHoje ? "hoje" : ""}">
          <div class="dia-aniversario-cabecalho">
            <span class="dia-aniversario-semana">
              ${escapeHtml(nomeDiaSemana(dia))}
            </span>

            <span class="dia-aniversario-data">
              ${escapeHtml(formatarDataComAno(dia))}
            </span>

            ${
              ehHoje
                ? '<span class="badge-hoje">HOJE</span>'
                : ""
            }
          </div>

          ${conteudo}
        </article>
      `;
    })
    .join("");
}

/* =========================================================
   RENDER - PRÓXIMOS
========================================================= */

function renderProximos() {
  if (!proximosAniversarios) return;

  const proximos = obterProximosAniversariantes();

  if (!proximos.length) {
    proximosAniversarios.innerHTML = `
      <div class="lembretes-vazio">
        Não há próximos aniversários cadastrados.
      </div>
    `;

    if (btnToggleProximos) {
      btnToggleProximos.style.display = "none";
    }

    if (proximoResumo) {
      proximoResumo.textContent = "Nenhum";
    }

    return;
  }

  const primeiro = proximos[0];

  if (proximoResumo) {
    proximoResumo.textContent =
      `${formatarDataCurta(primeiro.dataAniversario)} · ${primeiro.nome}`;
  }

  const listaParaMostrar = proximosExpandido
    ? proximos
    : proximos.slice(0, LIMITE_PROXIMOS_RECOLHIDO);

  proximosAniversarios.innerHTML = listaParaMostrar
    .map((pessoa) => {
      const linkAgenda = criarLinkGoogleAgenda(
        pessoa,
        pessoa.dataAniversario
      );

      return `
        <article class="proximo-aniversario">
          <div class="proximo-data">
            ${escapeHtml(formatarDataCurta(pessoa.dataAniversario))}
            <small>
              ${escapeHtml(textoDiasAte(pessoa.dataAniversario))}
            </small>
          </div>

          <div class="proximo-info">
            <strong>
              ${escapeHtml(pessoa.nome)}
            </strong>

            <span>
              ${escapeHtml(rotuloTipo(pessoa.tipo))}
              • fará ${escapeHtml(rotuloIdade(pessoa.idade))}
            </span>
          </div>

          <a
            class="btn-google-agenda"
            href="${escapeHtml(linkAgenda)}"
            target="_blank"
            rel="noopener noreferrer"
            title="Adicionar aniversário ao Google Agenda"
          >
            📅 Google Agenda
          </a>
        </article>
      `;
    })
    .join("");

  if (btnToggleProximos) {
    if (proximos.length > LIMITE_PROXIMOS_RECOLHIDO) {
      btnToggleProximos.style.display = "block";
      btnToggleProximos.textContent = proximosExpandido
        ? "Recolher lista"
        : `Ver todos (${proximos.length})`;
    } else {
      btnToggleProximos.style.display = "none";
    }
  }
}

/* =========================================================
   EVENTOS
========================================================= */

if (btnToggleProximos) {
  btnToggleProximos.addEventListener("click", () => {
    proximosExpandido = !proximosExpandido;
    renderProximos();

    if (!proximosExpandido) {
      document
        .querySelector(".lembretes-secao:nth-of-type(2)")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
    }
  });
}

if (btnSair) {
  btnSair.addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Erro ao sair:", error);
      mostrarMensagem(
        "Não foi possível sair do sistema. Tente novamente.",
        "erro"
      );
      return;
    }

    localStorage.clear();
    window.location.href = "index.html";
  });
}

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

async function iniciar() {
  try {
    limparMensagem();

    await carregarPessoas();

    renderSemana();
    renderProximos();
  } catch (erro) {
    console.error("Erro ao carregar lembretes:", erro);

    if (semanaAniversarios) {
      semanaAniversarios.innerHTML = `
        <div class="lembretes-vazio">
          Não foi possível carregar os aniversariantes.
        </div>
      `;
    }

    if (proximosAniversarios) {
      proximosAniversarios.innerHTML = `
        <div class="lembretes-vazio">
          Não foi possível carregar os próximos aniversários.
        </div>
      `;
    }

    mostrarMensagem(
      "Erro ao buscar os aniversários. Verifique se os campos de data de nascimento estão preenchidos e se as permissões do Supabase permitem a consulta.",
      "erro"
    );
  }
}

await iniciar();