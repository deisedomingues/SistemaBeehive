import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

/* ======================================================
   ELEMENTOS
====================================================== */

const formPacote = document.getElementById("formPacote");

const pacoteId = document.getElementById("pacoteId");

const tituloFormulario = document.getElementById(
  "tituloFormulario"
);

const nomePacote = document.getElementById(
  "nomePacote"
);

const publico = document.getElementById(
  "publico"
);

const curso = document.getElementById(
  "curso"
);

const tipoOrcamento = document.getElementById(
  "tipoOrcamento"
);

const campoQuantidadeAlunos = document.getElementById(
  "campoQuantidadeAlunos"
);

const quantidadeAlunos = document.getElementById(
  "quantidadeAlunos"
);

const avisoIndividual = document.getElementById(
  "avisoIndividual"
);

const campoFaixaParticipantes = document.getElementById(
  "campoFaixaParticipantes"
);

const faixaParticipantes = document.getElementById(
  "faixaParticipantes"
);

const quantidadeAulas = document.getElementById(
  "quantidadeAulas"
);

const aulasPorSemana = document.getElementById(
  "aulasPorSemana"
);

const duracaoAula = document.getElementById(
  "duracaoAula"
);

const validadeDias = document.getElementById(
  "validadeDias"
);

const estrategia = document.getElementById(
  "estrategia"
);

const vantagensPlano = document.getElementById(
  "vantagensPlano"
);

const programaFidelidade = document.getElementById(
  "programaFidelidade"
);

const atividadesFidelidade = document.getElementById(
  "atividadesFidelidade"
);

const condicoesGerais = document.getElementById(
  "condicoesGerais"
);

const sobConsulta = document.getElementById(
  "sobConsulta"
);

const blocoPagamentos = document.getElementById(
  "blocoPagamentos"
);

const valorAvistaAnterior = document.getElementById(
  "valorAvistaAnterior"
);

const valorAvista = document.getElementById(
  "valorAvista"
);

const descricaoAvista = document.getElementById(
  "descricaoAvista"
);

const cartaoQuantidadeParcelas = document.getElementById(
  "cartaoQuantidadeParcelas"
);

const cartaoValorParcelaAnterior = document.getElementById(
  "cartaoValorParcelaAnterior"
);

const cartaoValorParcela = document.getElementById(
  "cartaoValorParcela"
);

const cartaoValorTotal = document.getElementById(
  "cartaoValorTotal"
);

const cartaoDescricao = document.getElementById(
  "cartaoDescricao"
);

const taxaMatricula = document.getElementById(
  "taxaMatricula"
);

const observacoesPagamento = document.getElementById(
  "observacoesPagamento"
);

const materialIncluso = document.getElementById(
  "materialIncluso"
);

const campoDescricaoMaterial = document.getElementById(
  "campoDescricaoMaterial"
);

const descricaoMaterial = document.getElementById(
  "descricaoMaterial"
);

const beneficios = document.getElementById(
  "beneficios"
);

const observacoes = document.getElementById(
  "observacoes"
);

const pacoteAtivo = document.getElementById(
  "pacoteAtivo"
);

const mensagemFormulario = document.getElementById(
  "mensagemFormulario"
);

const btnSalvarPacote = document.getElementById(
  "btnSalvarPacote"
);

const btnCancelarEdicao = document.getElementById(
  "btnCancelarEdicao"
);

const btnNovoPacote = document.getElementById(
  "btnNovoPacote"
);

const buscaPacote = document.getElementById(
  "buscaPacote"
);

const filtroStatus = document.getElementById(
  "filtroStatus"
);

const listaPacotes = document.getElementById(
  "listaPacotes"
);

let pacotesCarregados = [];

/* ======================================================
   SEGURANÇA DE TEXTO
====================================================== */

function escaparHTML(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ======================================================
   MOEDA
====================================================== */

function formatarMoeda(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "";
  }

  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function converterMoedaParaNumero(valor) {
  const texto = String(valor || "").trim();

  if (!texto) {
    return null;
  }

  const normalizado = texto
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numero = Number(normalizado);

  return Number.isFinite(numero)
    ? numero
    : null;
}

function formatarCampoMoeda(valor) {
  const numeros = String(valor || "")
    .replace(/\D/g, "");

  if (!numeros) {
    return "";
  }

  const numero = Number(numeros) / 100;

  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function numeroParaCampoMoeda(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "";
  }

  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/* ======================================================
   TEXTOS DA LISTA
====================================================== */

function textoPublico(valor) {
  const textos = {
    pessoal: "Pessoa física",
    empresa: "Empresa"
  };

  return textos[valor] || valor;
}

function textoCurso(valor) {
  const textos = {
    ingles: "Inglês",
    espanhol: "Espanhol",
    ambos: "Inglês e espanhol"
  };

  return textos[valor] || valor;
}

function textoFaixa(valor) {
  const textos = {
    "1_a_5": "Até 5 participantes",
    "6_a_15": "De 6 a 15 participantes",
    "16_a_40": "De 16 a 40 participantes",
    mais_de_40: "Mais de 40 participantes"
  };

  return textos[valor] || "";
}

function textoModalidade(orcamento) {
  if (orcamento.modalidade === "individual") {
    return "Individual — 1 aluno";
  }

  if (orcamento.modalidade === "grupo") {
    return `Coletivo — ${orcamento.quantidade_alunos} alunos`;
  }

  return "Empresarial";
}

/* ======================================================
   MENSAGENS
====================================================== */

function mostrarMensagem(texto, tipo = "erro") {
  mensagemFormulario.textContent = texto;

  mensagemFormulario.className =
    `mensagem ${tipo}`;

  mensagemFormulario.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function limparMensagem() {
  mensagemFormulario.textContent = "";
  mensagemFormulario.className = "mensagem";
}

/* ======================================================
   TIPO DE ORÇAMENTO
====================================================== */

function atualizarOpcoesTipoOrcamento() {
  const valorAnterior = tipoOrcamento.value;

  tipoOrcamento.innerHTML = `
    <option value="">
      Selecione
    </option>
  `;

  if (publico.value === "pessoal") {
    tipoOrcamento.innerHTML += `
      <option value="individual">
        Individual — 1 aluno
      </option>

      <option value="grupo">
        Coletivo — 2 ou 3 alunos
      </option>
    `;
  }

  if (publico.value === "empresa") {
    tipoOrcamento.innerHTML += `
      <option value="empresarial">
        Empresarial
      </option>
    `;

    tipoOrcamento.value = "empresarial";
  }

  if (
    valorAnterior &&
    [...tipoOrcamento.options].some(
      (option) => option.value === valorAnterior
    )
  ) {
    tipoOrcamento.value = valorAnterior;
  }

  atualizarCamposQuantidade();
}

function atualizarCamposQuantidade() {
  const eIndividual =
    publico.value === "pessoal" &&
    tipoOrcamento.value === "individual";

  const eColetivo =
    publico.value === "pessoal" &&
    tipoOrcamento.value === "grupo";

  const eEmpresa =
    publico.value === "empresa" &&
    tipoOrcamento.value === "empresarial";

  avisoIndividual.classList.toggle(
    "ativo",
    eIndividual
  );

  campoQuantidadeAlunos.classList.toggle(
    "ativo",
    eColetivo
  );

  campoFaixaParticipantes.classList.toggle(
    "ativo",
    eEmpresa
  );

  quantidadeAlunos.required = eColetivo;
  faixaParticipantes.required = eEmpresa;

  if (!eColetivo) {
    quantidadeAlunos.value = "";
  }

  if (!eEmpresa) {
    faixaParticipantes.value = "";
  }
}

/* ======================================================
   CAMPOS DE PAGAMENTO E MATERIAL
====================================================== */

function atualizarCamposPagamento() {
  blocoPagamentos.classList.toggle(
    "inativo",
    sobConsulta.checked
  );

  if (sobConsulta.checked) {
    limparCamposPagamento();
  }
}

function limparCamposPagamento() {
  valorAvistaAnterior.value = "";
  valorAvista.value = "";

  descricaoAvista.value =
    "Pagamento à vista ou no boleto";

  cartaoQuantidadeParcelas.value = "";
  cartaoValorParcelaAnterior.value = "";
  cartaoValorParcela.value = "";
  cartaoValorTotal.value = "";

  cartaoDescricao.value =
    "Pagamento parcelado no cartão de crédito";

  taxaMatricula.value = "0,00";
  observacoesPagamento.value = "";
}

function atualizarCampoMaterial() {
  campoDescricaoMaterial.classList.toggle(
    "ativo",
    materialIncluso.checked
  );

  if (!materialIncluso.checked) {
    descricaoMaterial.value = "";
  }
}

/* ======================================================
   TEXTAREA
====================================================== */

function obterListaTextarea(elemento) {
  return elemento.value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listaParaTextarea(lista) {
  return Array.isArray(lista)
    ? lista.join("\n")
    : "";
}

/* ======================================================
   VALIDAÇÃO
====================================================== */

function formaCartaoPreenchida() {
  return Boolean(
    cartaoQuantidadeParcelas.value ||
    cartaoValorParcela.value.trim() ||
    cartaoValorTotal.value.trim()
  );
}

function validarCartao() {
  if (!formaCartaoPreenchida()) {
    return true;
  }

  if (
    Number(cartaoQuantidadeParcelas.value) < 1 ||
    converterMoedaParaNumero(
      cartaoValorParcela.value
    ) === null ||
    converterMoedaParaNumero(
      cartaoValorTotal.value
    ) === null
  ) {
    mostrarMensagem(
      "Para oferecer pagamento no cartão, informe a quantidade de parcelas, o valor da parcela e o valor total."
    );

    return false;
  }

  return true;
}

function validarFormulario() {
  limparMensagem();

  if (nomePacote.value.trim().length < 3) {
    mostrarMensagem(
      "Digite um nome para o orçamento."
    );

    return false;
  }

  if (!publico.value) {
    mostrarMensagem(
      "Selecione para quem é o orçamento."
    );

    return false;
  }

  if (!curso.value) {
    mostrarMensagem(
      "Selecione o curso."
    );

    return false;
  }

  if (!tipoOrcamento.value) {
    mostrarMensagem(
      "Selecione o tipo de orçamento."
    );

    return false;
  }

  if (
    tipoOrcamento.value === "grupo" &&
    !quantidadeAlunos.value
  ) {
    mostrarMensagem(
      "Selecione se o orçamento coletivo é para 2 ou 3 alunos."
    );

    return false;
  }

  if (
    tipoOrcamento.value === "empresarial" &&
    !faixaParticipantes.value
  ) {
    mostrarMensagem(
      "Selecione a quantidade de funcionários ou participantes."
    );

    return false;
  }

  if (Number(quantidadeAulas.value) < 1) {
    mostrarMensagem(
      "Informe uma quantidade válida de aulas."
    );

    return false;
  }

  if (Number(aulasPorSemana.value) < 1) {
    mostrarMensagem(
      "Informe a quantidade de aulas por semana."
    );

    return false;
  }

  if (Number(duracaoAula.value) < 1) {
    mostrarMensagem(
      "Informe a duração das aulas."
    );

    return false;
  }

  if (Number(validadeDias.value) < 1) {
    mostrarMensagem(
      "Informe a validade do orçamento."
    );

    return false;
  }

  if (!sobConsulta.checked) {
    const temValorComum =
      converterMoedaParaNumero(
        valorAvista.value
      ) !== null;

    const temCartao =
      formaCartaoPreenchida();

    if (!temValorComum && !temCartao) {
      mostrarMensagem(
        "Informe o valor à vista ou no boleto, o pagamento no cartão ou marque o valor como sob consulta."
      );

      return false;
    }

    if (!validarCartao()) {
      return false;
    }
  }

  return true;
}

/* ======================================================
   DADOS PARA O SUPABASE
====================================================== */

function montarDadosOrcamento() {
  const modalidade =
    tipoOrcamento.value;

  let quantidade = null;
  let faixa = null;

  if (modalidade === "individual") {
    quantidade = 1;
  }

  if (modalidade === "grupo") {
    quantidade = Number(
      quantidadeAlunos.value
    );
  }

  if (modalidade === "empresarial") {
    faixa = faixaParticipantes.value;
  }

  const valorSobConsulta =
    sobConsulta.checked;

  const valorComum = valorSobConsulta
    ? null
    : converterMoedaParaNumero(
        valorAvista.value
      );

  const temCartao =
    !valorSobConsulta &&
    formaCartaoPreenchida();

  const cartaoTotal = temCartao
    ? converterMoedaParaNumero(
        cartaoValorTotal.value
      )
    : null;

  const valorTotalReferencia =
    valorComum ??
    cartaoTotal ??
    null;

  return {
    nome:
      nomePacote.value.trim(),

    publico:
      publico.value,

    curso:
      curso.value,

    modalidade,

    quantidade_alunos:
      quantidade,

    faixa_participantes:
      faixa,

    quantidade_aulas:
      Number(quantidadeAulas.value),

    aulas_por_semana:
      Number(aulasPorSemana.value),

    duracao_aula_minutos:
      Number(duracaoAula.value),

    validade_dias:
      Number(validadeDias.value),

    estrategia:
      estrategia.value.trim() || null,

    vantagens_plano:
      vantagensPlano.value.trim() || null,

    programa_fidelidade:
      programaFidelidade.value.trim() || null,

    atividades_fidelidade:
      atividadesFidelidade.value.trim() || null,

    condicoes_gerais:
      condicoesGerais.value.trim() || null,

    valor_avista_anterior:
      valorSobConsulta
        ? null
        : converterMoedaParaNumero(
            valorAvistaAnterior.value
          ),

    valor_avista:
      valorComum,

    descricao_avista:
      valorSobConsulta
        ? null
        : (
            descricaoAvista.value.trim() ||
            "Pagamento à vista ou no boleto"
          ),

    cartao_quantidade_parcelas:
      temCartao
        ? Number(
            cartaoQuantidadeParcelas.value
          )
        : null,

    cartao_valor_parcela_anterior:
      temCartao
        ? converterMoedaParaNumero(
            cartaoValorParcelaAnterior.value
          )
        : null,

    cartao_valor_parcela:
      temCartao
        ? converterMoedaParaNumero(
            cartaoValorParcela.value
          )
        : null,

    cartao_valor_total:
      cartaoTotal,

    cartao_descricao:
      temCartao
        ? (
            cartaoDescricao.value.trim() ||
            "Pagamento parcelado no cartão de crédito"
          )
        : null,

    boleto_quantidade_parcelas:
      null,

    boleto_valor_parcela_anterior:
      null,

    boleto_valor_parcela:
      null,

    boleto_valor_total:
      null,

    boleto_descricao:
      null,

    observacoes_pagamento:
      observacoesPagamento.value.trim() || null,

    taxa_matricula:
      valorSobConsulta
        ? 0
        : (
            converterMoedaParaNumero(
              taxaMatricula.value
            ) ?? 0
          ),

    material_incluso:
      materialIncluso.checked,

    descricao_material:
      materialIncluso.checked
        ? (
            descricaoMaterial.value.trim() ||
            null
          )
        : null,

    beneficios:
      obterListaTextarea(beneficios),

    observacoes:
      observacoes.value.trim() || null,

    sob_consulta:
      valorSobConsulta,

    ativo:
      pacoteAtivo.checked,

    valor_total:
      valorSobConsulta
        ? null
        : valorTotalReferencia,

    quantidade_parcelas:
      temCartao
        ? Number(
            cartaoQuantidadeParcelas.value
          )
        : null,

    valor_parcela:
      temCartao
        ? converterMoedaParaNumero(
            cartaoValorParcela.value
          )
        : null
  };
}

/* ======================================================
   FORMULÁRIO
====================================================== */

function definirCarregamento(estaCarregando) {
  btnSalvarPacote.disabled =
    estaCarregando;

  btnSalvarPacote.innerHTML =
    estaCarregando
      ? `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Salvando...
      `
      : `
        <i class="fa-solid fa-floppy-disk"></i>
        Salvar orçamento
      `;
}

function limparFormulario() {
  formPacote.reset();

  pacoteId.value = "";

  quantidadeAulas.value = "36";
  aulasPorSemana.value = "2";
  duracaoAula.value = "40";
  validadeDias.value = "7";

  taxaMatricula.value = "0,00";

  descricaoAvista.value =
    "Pagamento à vista ou no boleto";

  cartaoDescricao.value =
    "Pagamento parcelado no cartão de crédito";

  pacoteAtivo.checked = true;
  sobConsulta.checked = false;
  materialIncluso.checked = false;

  tituloFormulario.textContent =
    "Cadastrar orçamento";

  btnCancelarEdicao.classList.remove(
    "ativo"
  );

  btnNovoPacote.classList.remove(
    "ativo"
  );

  limparMensagem();

  atualizarOpcoesTipoOrcamento();
  atualizarCamposPagamento();
  atualizarCampoMaterial();
}

function preencherFormulario(orcamento) {
  pacoteId.value =
    orcamento.id;

  nomePacote.value =
    orcamento.nome || "";

  publico.value =
    orcamento.publico || "";

  curso.value =
    orcamento.curso || "";

  atualizarOpcoesTipoOrcamento();

  tipoOrcamento.value =
    orcamento.modalidade || "";

  atualizarCamposQuantidade();

  if (orcamento.modalidade === "grupo") {
    quantidadeAlunos.value = String(
      orcamento.quantidade_alunos || ""
    );
  }

  if (
    orcamento.modalidade === "empresarial"
  ) {
    faixaParticipantes.value =
      orcamento.faixa_participantes || "";
  }

  quantidadeAulas.value =
    orcamento.quantidade_aulas ?? 36;

  aulasPorSemana.value =
    orcamento.aulas_por_semana ?? 2;

  duracaoAula.value =
    orcamento.duracao_aula_minutos ?? 40;

  validadeDias.value =
    orcamento.validade_dias ?? 7;

  estrategia.value =
    orcamento.estrategia || "";

  vantagensPlano.value =
    orcamento.vantagens_plano || "";

  programaFidelidade.value =
    orcamento.programa_fidelidade || "";

  atividadesFidelidade.value =
    orcamento.atividades_fidelidade || "";

  condicoesGerais.value =
    orcamento.condicoes_gerais || "";

  sobConsulta.checked = Boolean(
    orcamento.sob_consulta
  );

  valorAvistaAnterior.value =
    numeroParaCampoMoeda(
      orcamento.valor_avista_anterior
    );

  valorAvista.value =
    numeroParaCampoMoeda(
      orcamento.valor_avista
    );

  descricaoAvista.value =
    orcamento.descricao_avista ||
    "Pagamento à vista ou no boleto";

  cartaoQuantidadeParcelas.value =
    orcamento.cartao_quantidade_parcelas ?? "";

  cartaoValorParcelaAnterior.value =
    numeroParaCampoMoeda(
      orcamento.cartao_valor_parcela_anterior
    );

  cartaoValorParcela.value =
    numeroParaCampoMoeda(
      orcamento.cartao_valor_parcela
    );

  cartaoValorTotal.value =
    numeroParaCampoMoeda(
      orcamento.cartao_valor_total
    );

  cartaoDescricao.value =
    orcamento.cartao_descricao ||
    "Pagamento parcelado no cartão de crédito";

  taxaMatricula.value =
    numeroParaCampoMoeda(
      orcamento.taxa_matricula ?? 0
    );

  observacoesPagamento.value =
    orcamento.observacoes_pagamento || "";

  materialIncluso.checked = Boolean(
    orcamento.material_incluso
  );

  descricaoMaterial.value =
    orcamento.descricao_material || "";

  beneficios.value =
    listaParaTextarea(
      orcamento.beneficios
    );

  observacoes.value =
    orcamento.observacoes || "";

  pacoteAtivo.checked = Boolean(
    orcamento.ativo
  );

  tituloFormulario.textContent =
    "Editar orçamento";

  btnCancelarEdicao.classList.add(
    "ativo"
  );

  btnNovoPacote.classList.add(
    "ativo"
  );

  limparMensagem();

  atualizarCamposPagamento();
  atualizarCampoMaterial();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* ======================================================
   SALVAR OU EDITAR
====================================================== */

formPacote.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    if (!validarFormulario()) {
      return;
    }

    definirCarregamento(true);

    const dadosOrcamento =
      montarDadosOrcamento();

    const idEmEdicao =
      pacoteId.value;

    try {
      let resposta;

      if (idEmEdicao) {
        resposta = await supabase
          .from("pacote_orcamento")
          .update(dadosOrcamento)
          .eq("id", idEmEdicao);
      } else {
        resposta = await supabase
          .from("pacote_orcamento")
          .insert(dadosOrcamento);
      }

      if (resposta.error) {
        throw resposta.error;
      }

      mostrarMensagem(
        idEmEdicao
          ? "Orçamento atualizado com sucesso."
          : "Orçamento cadastrado com sucesso.",
        "sucesso"
      );

      await carregarPacotes();

      setTimeout(() => {
        limparFormulario();
      }, 900);
    } catch (error) {
      console.error(
        "Erro ao salvar orçamento:",
        error
      );

      if (error.code === "23505") {
        mostrarMensagem(
          "Já existe um orçamento ativo para essa mesma combinação de curso, modalidade e quantidade de participantes."
        );

        return;
      }

      if (error.code === "23514") {
        mostrarMensagem(
          "Confira o tipo do orçamento, a quantidade de alunos, a faixa empresarial e os valores."
        );

        return;
      }

      mostrarMensagem(
        error.message ||
        "Não foi possível salvar o orçamento."
      );
    } finally {
      definirCarregamento(false);
    }
  }
);

/* ======================================================
   LISTAGEM
====================================================== */

async function carregarPacotes() {
  listaPacotes.innerHTML = `
    <div class="estado-lista">
      <i class="fa-solid fa-spinner fa-spin"></i>
      Carregando orçamentos...
    </div>
  `;

  const { data, error } = await supabase
    .from("pacote_orcamento")
    .select("*")
    .order("ativo", {
      ascending: false
    })
    .order("nome", {
      ascending: true
    });

  if (error) {
    console.error(
      "Erro ao carregar orçamentos:",
      error
    );

    listaPacotes.innerHTML = `
      <div class="estado-lista">
        <i class="fa-solid fa-triangle-exclamation"></i>
        Não foi possível carregar os orçamentos.
      </div>
    `;

    return;
  }

  pacotesCarregados = data || [];

  renderizarPacotes();
}

function renderizarPacotes() {
  const termo = buscaPacote.value
    .trim()
    .toLowerCase();

  const status =
    filtroStatus.value;

  const filtrados =
    pacotesCarregados.filter(
      (orcamento) => {
        const texto = [
          orcamento.nome,
          textoPublico(
            orcamento.publico
          ),
          textoCurso(
            orcamento.curso
          ),
          textoModalidade(
            orcamento
          ),
          textoFaixa(
            orcamento.faixa_participantes
          )
        ]
          .join(" ")
          .toLowerCase();

        const correspondeBusca =
          !termo ||
          texto.includes(termo);

        const correspondeStatus =
          status === "todos" ||
          (
            status === "ativos" &&
            orcamento.ativo
          ) ||
          (
            status === "inativos" &&
            !orcamento.ativo
          );

        return (
          correspondeBusca &&
          correspondeStatus
        );
      }
    );

  if (!filtrados.length) {
    listaPacotes.innerHTML = `
      <div class="estado-lista">
        <i class="fa-solid fa-file-invoice-dollar"></i>
        Nenhum orçamento encontrado.
      </div>
    `;

    return;
  }

  listaPacotes.innerHTML =
    filtrados
      .map(criarHTMLOrcamento)
      .join("");

  configurarBotoesOrcamentos();
}

function criarHTMLOrcamento(orcamento) {
  const valorPrincipal =
    orcamento.valor_avista ??
    orcamento.cartao_valor_total;

  const valorHTML =
    orcamento.sob_consulta
      ? `
        <div class="pacote-valor">
          Sob consulta
        </div>
      `
      : `
        <div class="pacote-valor">
          ${formatarMoeda(valorPrincipal)}

          <small>
            ${
              orcamento.valor_avista !== null
                ? "à vista ou boleto"
                : "valor total"
            }
          </small>
        </div>
      `;

  const participantesHTML =
    orcamento.modalidade === "empresarial"
      ? `
        <div class="pacote-detalhe">
          <i class="fa-solid fa-building"></i>

          <span>
            ${escaparHTML(
              textoFaixa(
                orcamento.faixa_participantes
              )
            )}
          </span>
        </div>
      `
      : `
        <div class="pacote-detalhe">
          <i class="fa-solid fa-users"></i>

          <span>
            ${
              orcamento.quantidade_alunos === 1
                ? "1 aluno"
                : `${orcamento.quantidade_alunos} alunos`
            }
          </span>
        </div>
      `;

  const cartaoHTML =
    orcamento.cartao_quantidade_parcelas &&
    orcamento.cartao_valor_parcela !== null
      ? `
        <div class="pacote-detalhe">
          <i class="fa-solid fa-credit-card"></i>

          <span>
            Cartão:
            ${orcamento.cartao_quantidade_parcelas}x de
            ${formatarMoeda(
              orcamento.cartao_valor_parcela
            )}
          </span>
        </div>
      `
      : "";

  return `
    <article
      class="pacote-item ${
        orcamento.ativo
          ? ""
          : "inativo"
      }"
    >
      <div class="pacote-topo">

        <div>
          <h3>
            ${escaparHTML(
              orcamento.nome
            )}
          </h3>

          <div class="pacote-tags">

            <span class="tag">
              ${escaparHTML(
                textoPublico(
                  orcamento.publico
                )
              )}
            </span>

            <span class="tag">
              ${escaparHTML(
                textoCurso(
                  orcamento.curso
                )
              )}
            </span>

            <span class="tag">
              ${escaparHTML(
                textoModalidade(
                  orcamento
                )
              )}
            </span>

            <span
              class="tag ${
                orcamento.ativo
                  ? "ativo"
                  : "inativo"
              }"
            >
              ${
                orcamento.ativo
                  ? "Ativo"
                  : "Inativo"
              }
            </span>

            ${
              orcamento.sob_consulta
                ? `
                  <span class="tag consulta">
                    Sob consulta
                  </span>
                `
                : ""
            }

          </div>
        </div>

        ${valorHTML}

      </div>

      <div class="pacote-detalhes">

        ${participantesHTML}

        <div class="pacote-detalhe">
          <i class="fa-solid fa-layer-group"></i>

          <span>
            ${orcamento.quantidade_aulas} aulas
          </span>
        </div>

        <div class="pacote-detalhe">
          <i class="fa-solid fa-calendar-week"></i>

          <span>
            ${orcamento.aulas_por_semana}
            aulas por semana
          </span>
        </div>

        <div class="pacote-detalhe">
          <i class="fa-regular fa-clock"></i>

          <span>
            ${orcamento.duracao_aula_minutos}
            minutos por aula
          </span>
        </div>

        <div class="pacote-detalhe">
          <i class="fa-regular fa-calendar-check"></i>

          <span>
            Validade:
            ${orcamento.validade_dias}
            dias
          </span>
        </div>

        ${cartaoHTML}

      </div>

      <div class="acoes-pacote">

        <button
          type="button"
          class="btn-item btn-editar"
          data-acao="editar"
          data-id="${orcamento.id}"
        >
          <i class="fa-solid fa-pen"></i>
          Editar orçamento
        </button>

        <button
          type="button"
          class="btn-item btn-status"
          data-acao="status"
          data-id="${orcamento.id}"
        >
          <i class="fa-solid ${
            orcamento.ativo
              ? "fa-eye-slash"
              : "fa-eye"
          }"></i>

          ${
            orcamento.ativo
              ? "Desativar"
              : "Ativar"
          }
        </button>

        <button
          type="button"
          class="btn-item btn-excluir"
          data-acao="excluir"
          data-id="${orcamento.id}"
        >
          <i class="fa-solid fa-trash"></i>
          Excluir
        </button>

      </div>
    </article>
  `;
}

function configurarBotoesOrcamentos() {
  const botoes =
    listaPacotes.querySelectorAll(
      "[data-acao][data-id]"
    );

  botoes.forEach((botao) => {
    botao.addEventListener(
      "click",
      async () => {
        const id = Number(
          botao.dataset.id
        );

        const orcamento =
          pacotesCarregados.find(
            (item) =>
              Number(item.id) === id
          );

        if (!orcamento) {
          return;
        }

        if (botao.dataset.acao === "editar") {
          preencherFormulario(orcamento);
          return;
        }

        if (botao.dataset.acao === "status") {
          await alterarStatusOrcamento(
            orcamento
          );

          return;
        }

        if (botao.dataset.acao === "excluir") {
          await excluirOrcamento(
            orcamento
          );
        }
      }
    );
  });
}

/* ======================================================
   ATIVAR OU DESATIVAR
====================================================== */

async function alterarStatusOrcamento(
  orcamento
) {
  const novoStatus =
    !orcamento.ativo;

  const confirmou = window.confirm(
    novoStatus
      ? `Deseja ativar o orçamento "${orcamento.nome}"?`
      : `Deseja desativar o orçamento "${orcamento.nome}"? Ele deixará de aparecer para novas consultas.`
  );

  if (!confirmou) {
    return;
  }

  const { error } = await supabase
    .from("pacote_orcamento")
    .update({
      ativo: novoStatus
    })
    .eq("id", orcamento.id);

  if (error) {
    console.error(
      "Erro ao alterar orçamento:",
      error
    );

    window.alert(
      error.code === "23505"
        ? "Já existe outro orçamento ativo com essa mesma combinação."
        : "Não foi possível alterar o orçamento."
    );

    return;
  }

  await carregarPacotes();
}

/* ======================================================
   EXCLUIR
====================================================== */

async function excluirOrcamento(
  orcamento
) {
  const confirmou = window.confirm(
    `Deseja excluir o orçamento "${orcamento.nome}"?\n\n` +
    "Se ele já tiver sido usado em uma consulta, desative-o em vez de excluir."
  );

  if (!confirmou) {
    return;
  }

  const { error } = await supabase
    .from("pacote_orcamento")
    .delete()
    .eq("id", orcamento.id);

  if (error) {
    console.error(
      "Erro ao excluir orçamento:",
      error
    );

    if (error.code === "23503") {
      window.alert(
        "Este orçamento já foi usado em uma consulta. Desative-o em vez de excluir."
      );

      return;
    }

    window.alert(
      "Não foi possível excluir o orçamento."
    );

    return;
  }

  if (
    Number(pacoteId.value) ===
    Number(orcamento.id)
  ) {
    limparFormulario();
  }

  await carregarPacotes();
}

/* ======================================================
   EVENTOS
====================================================== */

publico.addEventListener(
  "change",
  () => {
    tipoOrcamento.value = "";

    atualizarOpcoesTipoOrcamento();
  }
);

tipoOrcamento.addEventListener(
  "change",
  atualizarCamposQuantidade
);

sobConsulta.addEventListener(
  "change",
  atualizarCamposPagamento
);

materialIncluso.addEventListener(
  "change",
  atualizarCampoMaterial
);

const camposMoeda = [
  valorAvistaAnterior,
  valorAvista,
  cartaoValorParcelaAnterior,
  cartaoValorParcela,
  cartaoValorTotal,
  taxaMatricula
];

camposMoeda.forEach((campo) => {
  campo.addEventListener(
    "input",
    () => {
      campo.value = formatarCampoMoeda(
        campo.value
      );
    }
  );
});

btnCancelarEdicao.addEventListener(
  "click",
  limparFormulario
);

btnNovoPacote.addEventListener(
  "click",
  limparFormulario
);

buscaPacote.addEventListener(
  "input",
  renderizarPacotes
);

filtroStatus.addEventListener(
  "change",
  renderizarPacotes
);

/* ======================================================
   INICIALIZAÇÃO
====================================================== */

limparFormulario();

await carregarPacotes();