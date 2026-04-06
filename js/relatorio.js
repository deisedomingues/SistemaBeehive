import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

/* =========================================================
   ELEMENTOS
========================================================= */
const btnSair = document.getElementById("btnSair");
const btnImprimir = document.getElementById("btnImprimir");

const form = document.getElementById("form-relatorio");
const msg = document.getElementById("msg");

const tipoRelatorio = document.getElementById("tipoRelatorio");
const selectEmpresa = document.getElementById("empresaparceira");
const inicioInput = document.getElementById("inicio");
const fimInput = document.getElementById("fim");
const textoDeclaracao = document.getElementById("textoDeclaracao");
const observacaoComplementar = document.getElementById("observacaoComplementar");

const areaAlunosEmpresa = document.getElementById("areaAlunosEmpresa");
const listaAlunosEmpresa = document.getElementById("listaAlunosEmpresa");

const areaRelatorio = document.getElementById("area-relatorio");
const documentoRelatorio = document.getElementById("documentoRelatorio");

const radiosModoEmpresa = document.querySelectorAll(
  'input[name="modoAlunosEmpresa"]'
);

/* =========================================================
   LOGOUT
========================================================= */
btnSair.addEventListener("click", async () => {
  try {
    await supabase.auth.signOut();

    localStorage.removeItem("role");
    localStorage.removeItem("professorId");
    localStorage.removeItem("professorNome");
    localStorage.removeItem("professorEmail");

    window.location.href = "index.html";
  } catch (error) {
    console.error("Erro ao sair:", error);
    mostrarMensagem("Não foi possível sair neste momento.", false);
  }
});

/* =========================================================
   UTILITÁRIOS
========================================================= */
function mostrarMensagem(texto, ok = true) {
  msg.textContent = texto;
  msg.className = `msg-box show ${ok ? "ok" : "erro"} no-print`;

  setTimeout(() => {
    msg.className = "msg-box no-print";
    msg.textContent = "";
  }, 3000);
}

function limparSelect(select, textoInicial) {
  select.innerHTML = `<option value="">${textoInicial}</option>`;
}

function formatarDataBR(dataISO) {
  if (!dataISO) return "-";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarDataExtensa(data = new Date()) {
  const cidade = "Guarulhos";
  const dia = String(data.getDate()).padStart(2, "0");
  const meses = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro"
  ];
  const mes = meses[data.getMonth()];
  const ano = data.getFullYear();

  return `${cidade}, ${dia} de ${mes} de ${ano}.`;
}

function obterModoAlunosEmpresa() {
  const radioMarcado = document.querySelector(
    'input[name="modoAlunosEmpresa"]:checked'
  );
  return radioMarcado ? radioMarcado.value : "todos";
}

function obterIdsAlunosSelecionadosEmpresa() {
  const checkboxes = document.querySelectorAll(
    ".checkbox-aluno-empresa:checked"
  );
  return Array.from(checkboxes).map((item) => Number(item.value));
}

function escapeHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function atualizarTextoModelo() {
  if (tipoRelatorio.value === "empresa") {
    textoDeclaracao.value =
      "Declaramos, para os devidos fins, que os alunos citados neste relatório estão devidamente matriculados nos cursos regulares de língua inglesa e/ou espanhola, e que as informações contidas nele se baseiam em documentações oficiais da escola, as quais estão disponíveis para consulta caso haja necessidade.";
    textoDeclaracao.readOnly = true;
    return;
  }

  if (tipoRelatorio.value === "professor") {
    textoDeclaracao.value =
      "Apresentamos, para os devidos fins, o demonstrativo de aulas ministradas no período informado, com base nos registros oficiais da escola.";
    textoDeclaracao.readOnly = true;
    return;
  }

  textoDeclaracao.value =
    "Declaramos, para os devidos fins, que as informações apresentadas neste relatório se baseiam nos registros acadêmicos oficiais da escola.";
  textoDeclaracao.readOnly = true;
}

function atualizarVisibilidadeSelecaoAlunosEmpresa() {
  const modo = obterModoAlunosEmpresa();
  areaAlunosEmpresa.style.display = modo === "selecionados" ? "block" : "none";
}

function esconderRelatorio() {
  areaRelatorio.style.display = "none";
  documentoRelatorio.innerHTML = "";
}

function traduzirStatus(status) {
  if (status === "Presente") return "Presente";
  if (status === "Ausente") return "Faltou";
  if (status === "Cancelada") return "Cancelada";
  if (status === "Trancada") return "Trancamento";
  if (status === "Reposição" || status === "Reposicao") return "Reposição";
  return status || "-";
}

function montarLinhaOcorrencia(aula) {
  const data = formatarDataBR(aula.data_aula);
  const status = traduzirStatus(aula.status);

  let texto = `${data} - ${status}`;

  if (aula.justificativa && aula.justificativa.trim()) {
    texto += ` (${aula.justificativa.trim()})`;
  }

  return texto;
}

/* =========================================================
   CARREGAMENTOS
========================================================= */
async function carregarEmpresas() {
  limparSelect(selectEmpresa, "Selecione a empresa");

  const { data, error } = await supabase
    .from("empresaparceira")
    .select("cnpj, nome")
    .order("nome");

  if (error) {
    console.error(error);
    mostrarMensagem("Erro ao carregar empresas.", false);
    return;
  }

  (data || []).forEach((emp) => {
    const option = document.createElement("option");
    option.value = emp.cnpj;
    option.textContent = emp.nome;
    selectEmpresa.appendChild(option);
  });
}

async function carregarAlunosEmpresaNaChecklist(cnpj) {
  listaAlunosEmpresa.innerHTML =
    `<p class="texto-vazio-relatorio">Carregando alunos...</p>`;

  if (!cnpj) {
    listaAlunosEmpresa.innerHTML = `
      <p class="texto-vazio-relatorio">Selecione uma empresa para carregar os alunos.</p>
    `;
    return;
  }

  const { data, error } = await supabase
    .from("aluno")
    .select("id, nome")
    .eq("empresa_cnpj", cnpj)
    .order("nome");

  if (error) {
    console.error(error);
    listaAlunosEmpresa.innerHTML = `
      <p class="texto-vazio-relatorio">Erro ao carregar alunos da empresa.</p>
    `;
    return;
  }

  if (!data || data.length === 0) {
    listaAlunosEmpresa.innerHTML = `
      <p class="texto-vazio-relatorio">Nenhum aluno encontrado para esta empresa.</p>
    `;
    return;
  }

  listaAlunosEmpresa.innerHTML = data
    .map(
      (aluno) => `
        <label class="item-checkbox-relatorio">
          <input
            type="checkbox"
            class="checkbox-aluno-empresa"
            value="${aluno.id}"
          />
          <span>${escapeHtml(aluno.nome)}</span>
        </label>
      `
    )
    .join("");
}

/* =========================================================
   EVENTOS
========================================================= */
tipoRelatorio.addEventListener("change", () => {
  atualizarTextoModelo();

  if (tipoRelatorio.value !== "empresa") {
    mostrarMensagem(
      "Nesta etapa, o documento oficial completo está pronto para relatório por empresa.",
      false
    );
  }
});

selectEmpresa.addEventListener("change", async () => {
  esconderRelatorio();
  await carregarAlunosEmpresaNaChecklist(selectEmpresa.value);
});

radiosModoEmpresa.forEach((radio) => {
  radio.addEventListener("change", () => {
    atualizarVisibilidadeSelecaoAlunosEmpresa();
  });
});

btnImprimir.addEventListener("click", () => {
  window.print();
});

/* =========================================================
   DOCUMENTO OFICIAL - EMPRESA
========================================================= */
async function gerarDocumentoEmpresa({ empresaCnpj, inicio, fim }) {
  const nomeEmpresaSelecionada =
    selectEmpresa.options[selectEmpresa.selectedIndex]?.text || "Empresa";

  const { data, error } = await supabase
    .from("aula")
    .select(`
      id,
      status,
      data_aula,
      justificativa,
      matricula:matricula_id (
        aluno:aluno_id (
          id,
          nome,
          empresa_cnpj
        ),
        materia:materia_id ( nome ),
        modulo:modulo_id ( nome ),
        professor:professor_id ( nome )
      )
    `)
    .gte("data_aula", inicio)
    .lte("data_aula", fim)
    .order("data_aula", { ascending: true });

  if (error) {
    console.error(error);
    mostrarMensagem("Erro ao gerar relatório.", false);
    return;
  }

  if (!data || data.length === 0) {
    mostrarMensagem("Nenhuma aula encontrada no período.", false);
    return;
  }

  let filtrados = data.filter(
    (aula) => aula?.matricula?.aluno?.empresa_cnpj === empresaCnpj
  );

  if (obterModoAlunosEmpresa() === "selecionados") {
    const idsSelecionados = obterIdsAlunosSelecionadosEmpresa();

    if (idsSelecionados.length === 0) {
      mostrarMensagem("Selecione pelo menos um aluno da empresa.", false);
      return;
    }

    filtrados = filtrados.filter((aula) =>
      idsSelecionados.includes(Number(aula?.matricula?.aluno?.id))
    );
  }

  if (filtrados.length === 0) {
    mostrarMensagem("Nenhum registro encontrado com os filtros informados.", false);
    return;
  }

  const alunos = {};

  filtrados.forEach((aula) => {
    const alunoId = aula?.matricula?.aluno?.id;
    if (!alunoId) return;

    if (!alunos[alunoId]) {
      alunos[alunoId] = {
        nome: aula.matricula.aluno.nome,
        professor: aula.matricula.professor?.nome || "-",
        curso: aula.matricula.materia?.nome || "-",
        modulo: aula.matricula.modulo?.nome || "-",
        aulasPrevistas: 0,
        totalPresencas: 0,
        totalFaltas: 0,
        totalCanceladas: 0,
        totalReposicoes: 0,
        aulasGravadas: 0,
        aulasRepostas: 0,
        ocorrencias: []
      };
    }

    alunos[alunoId].aulasPrevistas++;

    if (aula.status === "Presente") {
      alunos[alunoId].totalPresencas++;
    }

    if (aula.status === "Ausente") {
      alunos[alunoId].totalFaltas++;
    }

    if (aula.status === "Cancelada") {
      alunos[alunoId].totalCanceladas++;
    }

    if (aula.status === "Reposição" || aula.status === "Reposicao") {
      alunos[alunoId].totalReposicoes++;
      alunos[alunoId].aulasRepostas++;
    }

    const justificativaLower = (aula.justificativa || "").toLowerCase();

    if (
      justificativaLower.includes("gravada") ||
      justificativaLower.includes("aula gravada")
    ) {
      alunos[alunoId].aulasGravadas++;
    }

    if (
      justificativaLower.includes("reposição") ||
      justificativaLower.includes("reposicao") ||
      justificativaLower.includes("a repor") ||
      justificativaLower.includes("agendou reposição") ||
      justificativaLower.includes("agendou reposicao")
    ) {
      alunos[alunoId].aulasRepostas++;
    }

    alunos[alunoId].ocorrencias.push(montarLinhaOcorrencia(aula));
  });

  const lista = Object.values(alunos).sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR")
  );

  const observacao = observacaoComplementar.value.trim();
  const dataExtensa = formatarDataExtensa(new Date());

  const blocosAlunos = lista
    .map((aluno) => {
      const presencasConsideradasNaFrequencia =
        aluno.totalPresencas + aluno.totalCanceladas;

      const porcentagem =
        aluno.aulasPrevistas > 0
          ? ((presencasConsideradasNaFrequencia / aluno.aulasPrevistas) * 100)
              .toFixed(1)
              .replace(".", ",")
          : "0,0";

      return `
        <section class="bloco-aluno-documento">
          <div class="titulo-aluno-documento">
            <strong>Aluno(a): ${escapeHtml(aluno.nome)}</strong>
          </div>

          <div class="grade-info-aluno-documento">
            <p><strong>Curso:</strong> ${escapeHtml(aluno.curso)}</p>
            <p><strong>Professor(a):</strong> ${escapeHtml(aluno.professor)}</p>
            <p><strong>Módulo atual:</strong> ${escapeHtml(aluno.modulo)}</p>
            <p><strong>Total de aulas:</strong> ${aluno.aulasPrevistas}</p>
            <p><strong>Total de presenças:</strong> ${aluno.totalPresencas}</p>
            <p><strong>Total de faltas:</strong> ${aluno.totalFaltas}</p>
            <p><strong>Total de canceladas:</strong> ${aluno.totalCanceladas}</p>
            <p><strong>Total de reposições:</strong> ${aluno.totalReposicoes}</p>
            <p><strong>Aulas gravadas:</strong> ${aluno.aulasGravadas}</p>
            <p><strong>Aulas repostas:</strong> ${aluno.aulasRepostas}</p>
            <p><strong>Presenças consideradas na frequência:</strong> ${presencasConsideradasNaFrequencia}</p>
            <p><strong>Porcentagem de frequência:</strong> ${porcentagem}%</p>
          </div>

          <div class="ocorrencias-documento">
            ${aluno.ocorrencias
              .map((item) => `<p>${escapeHtml(item)}</p>`)
              .join("")}
          </div>
        </section>
      `;
    })
    .join("");

  documentoRelatorio.innerHTML = `
    <section class="pagina-documento pagina-quebra">
      <div class="cabecalho-documento">
        <div class="cabecalho-documento-linha">
          <img src="images/logo.png" alt="Beehive" class="logo-documento" />
          <div class="dados-escola-documento">
            <h2>Beehive Idiomas – Inglês e Espanhol</h2>
            <p>Viela Caray, 76 – Vila Augusta – Guarulhos/SP</p>
            <p>Tel. (11) 95617-7084 – contato.beehiveidiomas@gmail.com</p>
            <p>CNPJ: 50.715.902/0001-82</p>
          </div>
        </div>

        <div class="titulo-documento-wrap">
          <h1>RELATÓRIO DE FREQUÊNCIA</h1>
        </div>

        <p class="texto-declaracao-documento">
          ${escapeHtml(textoDeclaracao.value)}
        </p>

        ${
          observacao
            ? `
              <p class="texto-observacao-documento">
                <strong>Observação complementar:</strong> ${escapeHtml(observacao)}
              </p>
            `
            : ""
        }

        <div class="resumo-geral-documento">
          <p><strong>Empresa:</strong> ${escapeHtml(nomeEmpresaSelecionada)}</p>
          <p><strong>Período:</strong> de ${formatarDataBR(inicio)} até ${formatarDataBR(fim)}</p>
        </div>
      </div>

      <div class="lista-alunos-documento">
        ${blocosAlunos}
      </div>

      <div class="rodape-documento">
        <p>${dataExtensa}</p>
        <div class="assinatura-documento">
          <div class="linha-assinatura"></div>
          <p>Gretha Mayer Camargo – Diretora Pedagógica</p>
        </div>
      </div>
    </section>
  `;

  areaRelatorio.style.display = "block";
  mostrarMensagem("Documento gerado com sucesso.");
}

/* =========================================================
   SUBMIT
========================================================= */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  esconderRelatorio();

  const tipo = tipoRelatorio.value;
  const empresaCnpj = selectEmpresa.value;
  const inicio = inicioInput.value;
  const fim = fimInput.value;

  if (tipo !== "empresa") {
    mostrarMensagem(
      "Nesta versão, o documento oficial completo foi montado para relatório por empresa.",
      false
    );
    return;
  }

  if (!empresaCnpj) {
    mostrarMensagem("Selecione a empresa.", false);
    return;
  }

  if (!inicio || !fim) {
    mostrarMensagem("Selecione o período.", false);
    return;
  }

  if (inicio > fim) {
    mostrarMensagem("A data inicial não pode ser maior que a data final.", false);
    return;
  }

  await gerarDocumentoEmpresa({
    empresaCnpj,
    inicio,
    fim
  });
});

/* =========================================================
   INICIALIZAÇÃO
========================================================= */
await carregarEmpresas();
atualizarTextoModelo();
atualizarVisibilidadeSelecaoAlunosEmpresa();