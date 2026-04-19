import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

/* =========================================================
   ELEMENTOS
========================================================= */
const form = document.getElementById("form-evento");
const msg = document.getElementById("msg");

const tituloInput = document.getElementById("titulo");
const tipoEventoSelect = document.getElementById("tipoEvento");
const descricaoInput = document.getElementById("descricao");
const localInput = document.getElementById("local"); // no banco continua "local"
const dataEventoInput = document.getElementById("dataEvento");
const horaEventoInput = document.getElementById("horaEvento");

const professorResponsavelSelect = document.getElementById("professorResponsavelId");

const publicoAlvoSelect = document.getElementById("publicoAlvo");
const blocoMateria = document.getElementById("blocoMateria");
const blocoModulo = document.getElementById("blocoModulo");
const materiaSelect = document.getElementById("materiaId");
const moduloSelect = document.getElementById("moduloId");
const textoAjudaModulo = document.getElementById("textoAjudaModulo");

const limiteConfirmacaoPreview = document.getElementById("limiteConfirmacaoPreview");
const ativoCheckbox = document.getElementById("ativo");

/* =========================================================
   INICIALIZAÇÃO
========================================================= */
async function init() {
  try {
    definirDataMinima();
    await carregarProfessoresAtivos();
    await carregarMaterias();
    controlarCamposPublico();
    atualizarPreviewLimiteConfirmacao();
    configurarCampoLinkParticipacao();
  } catch (erro) {
    console.error("Erro na inicialização da página de evento:", erro);
    mostrarMensagem("Erro ao inicializar a página de cadastro de evento.", "erro");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  await init();
}

/* =========================================================
   UTILITÁRIOS
========================================================= */
function mostrarMensagem(texto, tipo = "sucesso") {
  msg.style.display = "block";
  msg.textContent = texto;
  msg.style.padding = "10px";
  msg.style.borderRadius = "10px";
  msg.style.marginBottom = "12px";

  if (tipo === "erro") {
    msg.style.background = "#ffe5e5";
    msg.style.border = "1px solid #e7b4b4";
    msg.style.color = "#7a1f1f";
  } else {
    msg.style.background = "#e8f7e8";
    msg.style.border = "1px solid #b8deb8";
    msg.style.color = "#1d5e1d";
  }
}

function esconderMensagem() {
  msg.style.display = "none";
  msg.textContent = "";
}

function limparSelect(select, textoPadrao) {
  if (!select) return;
  select.innerHTML = `<option value="">${textoPadrao}</option>`;
}

function definirDataMinima() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  dataEventoInput.min = `${ano}-${mes}-${dia}`;
}

function calcularLimiteConfirmacao(dataEventoStr) {
  if (!dataEventoStr) return null;

  const [ano, mes, dia] = dataEventoStr.split("-").map(Number);
  const dataLimite = new Date(ano, mes - 1, dia);

  dataLimite.setDate(dataLimite.getDate() - 1);
  dataLimite.setHours(23, 59, 59, 0);

  return dataLimite;
}

function atualizarPreviewLimiteConfirmacao() {
  const dataEventoStr = dataEventoInput.value;

  if (!dataEventoStr) {
    limiteConfirmacaoPreview.value = "";
    return;
  }

  const limite = calcularLimiteConfirmacao(dataEventoStr);

  if (!limite) {
    limiteConfirmacaoPreview.value = "";
    return;
  }

  const dia = String(limite.getDate()).padStart(2, "0");
  const mes = String(limite.getMonth() + 1).padStart(2, "0");
  const ano = limite.getFullYear();

  limiteConfirmacaoPreview.value = `${dia}/${mes}/${ano} às 23:59`;
}

function dateToISOString(date) {
  return date ? date.toISOString() : null;
}

function limparFormularioVisual() {
  form.reset();
  ativoCheckbox.checked = true;

  blocoMateria.style.display = "none";
  blocoModulo.style.display = "none";
  textoAjudaModulo.textContent = "";

  materiaSelect.required = false;
  moduloSelect.required = false;

  limparSelect(moduloSelect, "Selecione o módulo");
  atualizarPreviewLimiteConfirmacao();
  configurarCampoLinkParticipacao();
}

function obterOrdemDoModuloSelecionado() {
  const optionSelecionada = moduloSelect.options[moduloSelect.selectedIndex];
  if (!optionSelecionada) return null;

  const ordem = optionSelecionada.dataset.ordem;
  return ordem ? Number(ordem) : null;
}

function configurarCampoLinkParticipacao() {
  if (!localInput) return;

  localInput.type = "url";
  localInput.placeholder = "Ex: https://meet.google.com/abc-defg-hij";
  localInput.setAttribute("inputmode", "url");
}

function normalizarLinkParticipacao(link) {
  const valor = String(link || "").trim();

  if (!valor) return null;

  if (
    valor.startsWith("http://") ||
    valor.startsWith("https://")
  ) {
    return valor;
  }

  return `https://${valor}`;
}

function validarLinkParticipacao(link) {
  if (!link) {
    return "Informe o link para participação do evento.";
  }

  try {
    const url = new URL(link);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "O link para participação precisa começar com http:// ou https://";
    }

    return null;
  } catch {
    return "Informe um link válido para participação.";
  }
}

/* =========================================================
   CARREGAMENTO DE DADOS
========================================================= */
async function carregarProfessoresAtivos() {
  limparSelect(professorResponsavelSelect, "Selecione o professor responsável");

  const { data, error } = await supabase
    .from("professor")
    .select("id, nome, ativo")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao carregar professores:", error);
    mostrarMensagem("Erro ao carregar os professores responsáveis.", "erro");
    return;
  }

  if (!data || !data.length) {
    mostrarMensagem("Nenhum professor ativo foi encontrado.", "erro");
    return;
  }

  data.forEach((professor) => {
    const option = document.createElement("option");
    option.value = professor.id;
    option.textContent = professor.nome;
    professorResponsavelSelect.appendChild(option);
  });
}

async function carregarMaterias() {
  limparSelect(materiaSelect, "Selecione a matéria");

  const { data, error } = await supabase
    .from("materia")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao carregar matérias:", error);
    mostrarMensagem("Erro ao carregar as matérias.", "erro");
    return;
  }

  (data || []).forEach((materia) => {
    const option = document.createElement("option");
    option.value = materia.id;
    option.textContent = materia.nome;
    materiaSelect.appendChild(option);
  });
}

async function carregarModulosPorMateria(materiaId) {
  limparSelect(moduloSelect, "Selecione o módulo");

  if (!materiaId) return;

  const { data, error } = await supabase
    .from("modulo")
    .select("id, nome, materia_id, ordem")
    .eq("materia_id", materiaId)
    .order("ordem", { ascending: true });

  if (error) {
    console.error("Erro ao carregar módulos:", error);
    mostrarMensagem("Erro ao carregar os módulos.", "erro");
    return;
  }

  (data || []).forEach((modulo) => {
    const option = document.createElement("option");
    option.value = modulo.id;
    option.textContent = modulo.nome;
    option.dataset.ordem = modulo.ordem;
    moduloSelect.appendChild(option);
  });
}

/* =========================================================
   CONTROLE DE EXIBIÇÃO
========================================================= */
function controlarCamposPublico() {
  const publico = publicoAlvoSelect.value;

  blocoMateria.style.display = "none";
  blocoModulo.style.display = "none";
  textoAjudaModulo.textContent = "";

  materiaSelect.required = false;
  moduloSelect.required = false;

  if (publico === "todos") {
    return;
  }

  if (publico === "materia") {
    blocoMateria.style.display = "block";
    materiaSelect.required = true;
    return;
  }

  if (publico === "modulo_exato") {
    blocoMateria.style.display = "block";
    blocoModulo.style.display = "block";
    materiaSelect.required = true;
    moduloSelect.required = true;
    textoAjudaModulo.textContent =
      "Somente alunos com matrícula ativa exatamente neste módulo poderão visualizar e confirmar presença.";
    return;
  }

  if (publico === "modulo_a_partir") {
    blocoMateria.style.display = "block";
    blocoModulo.style.display = "block";
    materiaSelect.required = true;
    moduloSelect.required = true;
    textoAjudaModulo.textContent =
      "O evento aparecerá para alunos com matrícula ativa neste módulo e nos módulos acima, dentro do mesmo curso.";
  }
}

/* =========================================================
   REGRAS DE CONVITE
========================================================= */
async function buscarMatriculasAtivasRelacionadas() {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno_id,
      materia_id,
      modulo_id,
      ativa,
      modulo:modulo_id (
        id,
        nome,
        ordem,
        materia_id
      )
    `)
    .eq("ativa", true);

  if (error) {
    console.error("Erro ao buscar matrículas ativas:", error);
    throw new Error("Não foi possível buscar as matrículas ativas.");
  }

  return data || [];
}

function obterAlunosUnicosPorListaDeMatriculas(listaMatriculas) {
  const mapa = new Map();

  for (const matricula of listaMatriculas) {
    const alunoId = Number(matricula.aluno_id);
    if (!mapa.has(alunoId)) {
      mapa.set(alunoId, alunoId);
    }
  }

  return Array.from(mapa.values());
}

function filtrarAlunosElegiveis(matriculas, evento) {
  const publico = evento.publico_alvo;
  const materiaId = evento.materia_id ? Number(evento.materia_id) : null;
  const moduloId = evento.modulo_id ? Number(evento.modulo_id) : null;
  const ordemBase = evento.ordem_modulo_base ?? null;

  if (publico === "todos") {
    return obterAlunosUnicosPorListaDeMatriculas(matriculas);
  }

  if (publico === "materia") {
    const lista = matriculas.filter(
      (matricula) => Number(matricula.materia_id) === materiaId
    );
    return obterAlunosUnicosPorListaDeMatriculas(lista);
  }

  if (publico === "modulo_exato") {
    const lista = matriculas.filter(
      (matricula) =>
        Number(matricula.materia_id) === materiaId &&
        Number(matricula.modulo_id) === moduloId
    );
    return obterAlunosUnicosPorListaDeMatriculas(lista);
  }

  if (publico === "modulo_a_partir") {
    const lista = matriculas.filter((matricula) => {
      const mesmaMateria = Number(matricula.materia_id) === materiaId;
      const ordemAluno = matricula.modulo?.ordem ?? null;

      return (
        mesmaMateria &&
        ordemAluno !== null &&
        ordemBase !== null &&
        Number(ordemAluno) >= Number(ordemBase)
      );
    });

    return obterAlunosUnicosPorListaDeMatriculas(lista);
  }

  return [];
}

async function gerarConvitesParaEvento(evento) {
  const matriculasAtivas = await buscarMatriculasAtivasRelacionadas();
  const alunosIds = filtrarAlunosElegiveis(matriculasAtivas, evento);

  if (!alunosIds.length) {
    return 0;
  }

  const payloadConvites = alunosIds.map((alunoId) => ({
    evento_id: evento.id,
    aluno_id: alunoId
  }));

  const { error } = await supabase
    .from("evento_convite_aluno")
    .upsert(payloadConvites, {
      onConflict: "evento_id,aluno_id",
      ignoreDuplicates: true
    });

  if (error) {
    console.error("Erro ao gerar convites do evento:", error);
    throw new Error("O evento foi salvo, mas houve erro ao gerar os convites dos alunos.");
  }

  return payloadConvites.length;
}

/* =========================================================
   EVENTOS DA TELA
========================================================= */
publicoAlvoSelect.addEventListener("change", async () => {
  controlarCamposPublico();
  limparSelect(moduloSelect, "Selecione o módulo");

  const publico = publicoAlvoSelect.value;
  const materiaId = materiaSelect.value;

  if ((publico === "modulo_exato" || publico === "modulo_a_partir") && materiaId) {
    await carregarModulosPorMateria(materiaId);
  }
});

materiaSelect.addEventListener("change", async () => {
  limparSelect(moduloSelect, "Selecione o módulo");

  const publico = publicoAlvoSelect.value;
  const materiaId = materiaSelect.value;

  if ((publico === "modulo_exato" || publico === "modulo_a_partir") && materiaId) {
    await carregarModulosPorMateria(materiaId);
  }
});

dataEventoInput.addEventListener("change", atualizarPreviewLimiteConfirmacao);

localInput?.addEventListener("blur", () => {
  const linkNormalizado = normalizarLinkParticipacao(localInput.value);
  if (linkNormalizado) {
    localInput.value = linkNormalizado;
  }
});

/* =========================================================
   VALIDAÇÕES
========================================================= */
function validarFormulario() {
  const titulo = tituloInput.value.trim();
  const tipoEvento = tipoEventoSelect.value;
  const dataEvento = dataEventoInput.value;
  const horaEvento = horaEventoInput.value;
  const publico = publicoAlvoSelect.value;
  const materiaId = materiaSelect.value;
  const moduloId = moduloSelect.value;
  const professorResponsavelId = professorResponsavelSelect.value;
  const linkParticipacao = normalizarLinkParticipacao(localInput.value);

  if (!titulo) {
    mostrarMensagem("Informe o título do evento.", "erro");
    return false;
  }

  if (!tipoEvento) {
    mostrarMensagem("Selecione o tipo do evento.", "erro");
    return false;
  }

  if (!dataEvento) {
    mostrarMensagem("Selecione a data do evento.", "erro");
    return false;
  }

  if (!horaEvento) {
    mostrarMensagem("Selecione a hora do evento.", "erro");
    return false;
  }

  if (!professorResponsavelId) {
    mostrarMensagem("Selecione o professor responsável pelo evento.", "erro");
    return false;
  }

  if (!publico) {
    mostrarMensagem("Selecione o público do evento.", "erro");
    return false;
  }

  if (!linkParticipacao) {
    mostrarMensagem("Informe o link para participação.", "erro");
    return false;
  }

  const erroLink = validarLinkParticipacao(linkParticipacao);
  if (erroLink) {
    mostrarMensagem(erroLink, "erro");
    return false;
  }

  if (publico !== "todos" && !materiaId) {
    mostrarMensagem("Selecione a matéria do evento.", "erro");
    return false;
  }

  if ((publico === "modulo_exato" || publico === "modulo_a_partir") && !moduloId) {
    mostrarMensagem("Selecione o módulo.", "erro");
    return false;
  }

  const limite = calcularLimiteConfirmacao(dataEvento);
  const agora = new Date();

  if (limite && limite < agora) {
    mostrarMensagem(
      "Escolha uma data futura maior, porque o prazo de confirmação já ficaria vencido.",
      "erro"
    );
    return false;
  }

  return true;
}

/* =========================================================
   SALVAR
========================================================= */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  esconderMensagem();

  if (!validarFormulario()) return;

  const titulo = tituloInput.value.trim();
  const tipoEvento = tipoEventoSelect.value;
  const descricao = descricaoInput.value.trim();
  const linkParticipacao = normalizarLinkParticipacao(localInput.value);
  const dataEvento = dataEventoInput.value;
  const horaEvento = horaEventoInput.value;
  const publico = publicoAlvoSelect.value;

  const professorResponsavelId = Number(professorResponsavelSelect.value);
  const materiaId = materiaSelect.value ? Number(materiaSelect.value) : null;
  const moduloId = moduloSelect.value ? Number(moduloSelect.value) : null;
  const ativo = ativoCheckbox.checked;

  const limiteConfirmacao = calcularLimiteConfirmacao(dataEvento);
  const ordemModuloBase =
    publico === "modulo_a_partir" ? obterOrdemDoModuloSelecionado() : null;

  const payload = {
    titulo,
    descricao: descricao || null,
    tipo_evento: tipoEvento,
    data_evento: dataEvento,
    hora_evento: horaEvento,
    local: linkParticipacao || null,
    publico_alvo: publico,
    materia_id: publico === "todos" ? null : materiaId,
    modulo_id:
      publico === "modulo_exato" || publico === "modulo_a_partir"
        ? moduloId
        : null,
    professor_responsavel_id: professorResponsavelId,
    limite_confirmacao: dateToISOString(limiteConfirmacao),
    ativo
  };

  const { data: eventoSalvo, error } = await supabase
    .from("evento")
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error("Erro ao salvar evento:", error);
    mostrarMensagem("Erro ao salvar evento. Verifique a estrutura da tabela.", "erro");
    return;
  }

  try {
    const totalConvites = await gerarConvitesParaEvento({
      ...eventoSalvo,
      ordem_modulo_base: ordemModuloBase
    });

    mostrarMensagem(
      `✅ Evento cadastrado com sucesso! ${totalConvites} convite(s) interno(s) foram gerados para alunos aptos.`
    );
    limparFormularioVisual();
  } catch (erroConvite) {
    console.error(erroConvite);
    mostrarMensagem(
      "O evento foi salvo, mas houve problema ao gerar os convites dos alunos.",
      "erro"
    );
  }
});