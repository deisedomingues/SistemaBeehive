import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

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
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];

  return `${cidade}, ${dia} de ${meses[data.getMonth()]} de ${data.getFullYear()}.`;
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

function normalizarStatus(status) {
  return String(status || "").trim();
}

function statusEhReposicao(status) {
  const s = normalizarStatus(status);
  return s === "Reposição" || s === "Reposicao";
}

function traduzirStatus(status) {
  const s = normalizarStatus(status);

  if (s === "Presente") return "Presente";
  if (s === "Ausente") return "Faltou";
  if (s === "Cancelada") return "Cancelada pela escola";
  if (s === "Trancada") return "Trancamento";
  if (statusEhReposicao(s)) return "Reposição";

  return s || "-";
}

function aulaFoiGravada(aula) {
  return aula?.aula_gravada === true;
}

function montarLinhaOcorrencia(aula, mapaAulasPorId) {
  const data = formatarDataBR(aula.data_aula);
  const status = traduzirStatus(aula.status);

  let texto = `${data} - ${status}`;

  if (statusEhReposicao(aula.status)) {
    const aulaOriginalId = aula.aula_original_id;
    const aulaOriginal = aulaOriginalId ? mapaAulasPorId[aulaOriginalId] : null;

    if (aulaOriginal?.data_aula) {
      texto += ` da aula de ${formatarDataBR(aulaOriginal.data_aula)}`;
    }
  }

  if (aula.justificativa && aula.justificativa.trim()) {
    texto += ` (${aula.justificativa.trim()})`;
  }

  return texto;
}

async function carregarEmpresas() {
  limparSelect(selectEmpresa, "Selecione a empresa");

  const { data, error } = await supabase
    .from("empresaparceira")
    .select("cnpj, nome")
    .neq("cnpj", "00000000000000")
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
    .from("matricula")
    .select(`
      id,
      empresa_cnpj,
      aluno:aluno_id (
        id,
        nome
      )
    `)
    .eq("empresa_cnpj", cnpj)
    .eq("ativa", true);

  if (error) {
    console.error(error);
    listaAlunosEmpresa.innerHTML = `
      <p class="texto-vazio-relatorio">Erro ao carregar alunos da empresa.</p>
    `;
    return;
  }

  const alunosMap = new Map();

  (data || []).forEach((matricula) => {
    const aluno = matricula.aluno;
    if (aluno?.id) {
      alunosMap.set(aluno.id, aluno);
    }
  });

  const alunos = Array.from(alunosMap.values()).sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR")
  );

  if (alunos.length === 0) {
    listaAlunosEmpresa.innerHTML = `
      <p class="texto-vazio-relatorio">Nenhum aluno encontrado para esta empresa.</p>
    `;
    return;
  }

  listaAlunosEmpresa.innerHTML = alunos
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
      aula_gravada,
      aula_original_id,
      matricula_id,
      matricula:matricula_id (
        id,
        empresa_cnpj,
        aluno:aluno_id (
          id,
          nome
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

  const mapaAulasPorId = {};

  data.forEach((aula) => {
    mapaAulasPorId[aula.id] = aula;
  });

  let filtrados = data.filter(
    (aula) => aula?.matricula?.empresa_cnpj === empresaCnpj
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

  const grupos = {};

  filtrados.forEach((aula) => {
    const alunoId = aula?.matricula?.aluno?.id;
    const matriculaId = aula?.matricula?.id || aula?.matricula_id;

    if (!alunoId || !matriculaId) return;

    const chaveGrupo = `${alunoId}-${matriculaId}`;

    if (!grupos[chaveGrupo]) {
      grupos[chaveGrupo] = {
        alunoId,
        matriculaId,
        nome: aula.matricula.aluno.nome,
        professor: aula.matricula.professor?.nome || "-",
        curso: aula.matricula.materia?.nome || "-",
        modulo: aula.matricula.modulo?.nome || "-",
        aulasPrevistas: 0,
        presencasHorarioRegular: 0,
        faltasAluno: 0,
        canceladasEscola: 0,
        reposicoesRealizadas: 0,
        aulasGravadasTotal: 0,
        aulasGravadasPorAusencia: 0,
        ocorrencias: []
      };
    }

    const grupo = grupos[chaveGrupo];
    const status = normalizarStatus(aula.status);

    grupo.aulasPrevistas++;

    if (status === "Presente") {
      grupo.presencasHorarioRegular++;
    }

    if (status === "Ausente") {
      grupo.faltasAluno++;
    }

    if (status === "Cancelada") {
      grupo.canceladasEscola++;
    }

    if (statusEhReposicao(status)) {
      grupo.reposicoesRealizadas++;
    }

    if (aulaFoiGravada(aula)) {
      grupo.aulasGravadasTotal++;
    }

    if (status === "Ausente" && aulaFoiGravada(aula)) {
      grupo.aulasGravadasPorAusencia++;
    }

    grupo.ocorrencias.push(montarLinhaOcorrencia(aula, mapaAulasPorId));
  });

  const lista = Object.values(grupos).sort((a, b) => {
    const nomeComparacao = a.nome.localeCompare(b.nome, "pt-BR");
    if (nomeComparacao !== 0) return nomeComparacao;

    return a.curso.localeCompare(b.curso, "pt-BR");
  });

  const observacaoDigitada = observacaoComplementar.value.trim();

  const observacoesFixas = `
    <p>
      * Presenças no horário regular são as aulas em que o aluno compareceu no dia e horário programados.
      Presenças consideradas na frequência incluem as presenças no horário regular, as reposições realizadas e as aulas canceladas pela escola, pois estas não devem prejudicar a frequência do aluno.
    </p>
    <p>
      * Aulas gravadas por ausência do aluno indicam aulas em que o aluno faltou, mas recebeu acesso à gravação disponibilizada pela escola.
    </p>
  `;

  const dataExtensa = formatarDataExtensa(new Date());

  const blocosAlunos = lista
    .map((aluno) => {
      const presencasConsideradasNaFrequencia =
        aluno.presencasHorarioRegular +
        aluno.reposicoesRealizadas +
        aluno.canceladasEscola;

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

            <p><strong>Presenças no horário regular:</strong> ${aluno.presencasHorarioRegular}</p>
            <p><strong>Faltas do aluno:</strong> ${aluno.faltasAluno}</p>
            <p><strong>Aulas canceladas pela escola:</strong> ${aluno.canceladasEscola}</p>
            <p><strong>Reposições realizadas:</strong> ${aluno.reposicoesRealizadas}</p>

            <p><strong>Total de aulas gravadas:</strong> ${aluno.aulasGravadasTotal}</p>
            <p><strong>Aulas gravadas por ausência do aluno:</strong> ${aluno.aulasGravadasPorAusencia}</p>

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
            <p>Rua Felício Geronazzo, 252A - Ponte Grande - Guarulhos</p>
            <p>CEP: 07033-040</p>
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

        <div class="texto-observacao-documento">
          ${
            observacaoDigitada
              ? `<p><strong>Observação complementar:</strong> ${escapeHtml(observacaoDigitada)}</p>`
              : ""
          }
          ${observacoesFixas}
        </div>

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

await carregarEmpresas();
atualizarTextoModelo();
atualizarVisibilidadeSelecaoAlunosEmpresa();