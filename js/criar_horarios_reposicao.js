import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const professorSelect = document.getElementById("professor");
const materiaSelect = document.getElementById("materia");
const dataInput = document.getElementById("data");
const horariosContainer = document.getElementById("horariosContainer");
const addHorarioBtn = document.getElementById("addHorario");
const form = document.getElementById("formHorario");
const msg = document.getElementById("msg");

// =============================
// Mensagem
// =============================
function mostrarMensagem(texto, erro = false) {
  msg.textContent = texto;
  msg.style.color = erro ? "#b42318" : "#027a48";
  msg.style.fontWeight = "bold";

  setTimeout(() => {
    msg.textContent = "";
    msg.style.fontWeight = "";
  }, 4000);
}

// =============================
// Data de amanhã
// =============================
function obterDataAmanhaISO() {
  const hoje = new Date();
  hoje.setDate(hoje.getDate() + 1);

  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function definirDataAmanha() {
  const amanha = obterDataAmanhaISO();
  dataInput.value = amanha;
  dataInput.min = amanha;
}

// =============================
// Estado inicial do select de curso
// =============================
function limparSelectMaterias(texto = "Escolha primeiro o professor") {
  materiaSelect.innerHTML = `<option value="">${texto}</option>`;
  materiaSelect.value = "";
  materiaSelect.disabled = true;
}

// =============================
// Carregar professores
// =============================
async function carregarProfessores() {
  const { data, error } = await supabase
    .from("professor")
    .select("id, nome, ativo")
    .eq("ativo", true)
    .order("nome");

  if (error) {
    console.error("Erro ao carregar professores:", error);
    mostrarMensagem("Erro ao carregar professores.", true);
    return;
  }

  professorSelect.innerHTML = `<option value="">Escolha o professor</option>`;

  (data || []).forEach((p) => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = p.nome;
    professorSelect.appendChild(option);
  });
}

// =============================
// Buscar cursos vinculados ao professor
// pela tabela professor_materia
// =============================
async function carregarMateriasDoProfessor(professorId) {
  limparSelectMaterias("Carregando cursos...");

  if (!professorId) {
    limparSelectMaterias("Escolha primeiro o professor");
    return;
  }

  const { data, error } = await supabase
    .from("professor_materia")
    .select(`
      id,
      professor_id,
      materia_id,
      materia:materia_id (
        id,
        nome
      )
    `)
    .eq("professor_id", professorId);

  if (error) {
    console.error("Erro ao carregar cursos do professor:", error);
    limparSelectMaterias("Erro ao carregar cursos");
    mostrarMensagem("Erro ao carregar os cursos deste professor.", true);
    return;
  }

  const cursos = (data || [])
    .filter((item) => item.materia)
    .map((item) => ({
      id: item.materia.id,
      nome: item.materia.nome
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  if (!cursos.length) {
    limparSelectMaterias("Professor sem curso vinculado");
    mostrarMensagem(
      "Este professor não possui curso vinculado em professor_materia.",
      true
    );
    return;
  }

  materiaSelect.innerHTML = "";

  cursos.forEach((curso) => {
    const option = document.createElement("option");
    option.value = curso.id;
    option.textContent = curso.nome;
    materiaSelect.appendChild(option);
  });

  if (cursos.length === 1) {
    materiaSelect.value = String(cursos[0].id);
    materiaSelect.disabled = true;

    mostrarMensagem(
      `Curso selecionado automaticamente: ${cursos[0].nome}.`
    );
    return;
  }

  materiaSelect.disabled = false;

  materiaSelect.innerHTML = `<option value="">Escolha o curso</option>` + materiaSelect.innerHTML;
  materiaSelect.value = "";
}

// =============================
// Criar linha de horário
// =============================
function criarLinhaHorario(horaSugerida = "") {
  const div = document.createElement("div");
  div.className = "linha-horario-reposicao";

  div.style.display = "flex";
  div.style.gap = "10px";
  div.style.marginBottom = "10px";
  div.style.flexWrap = "wrap";
  div.style.alignItems = "center";

  div.innerHTML = `
    <input type="time" class="horaInicio" required>
    <input type="time" class="horaFim" readonly>
    <button type="button" class="remover btn">x</button>
  `;

  const horaInicio = div.querySelector(".horaInicio");
  const horaFim = div.querySelector(".horaFim");
  const remover = div.querySelector(".remover");

  horaInicio.value = horaSugerida;

  function calcularHoraFim() {
    if (!horaInicio.value) {
      horaFim.value = "";
      return;
    }

    const [h, m] = horaInicio.value.split(":").map(Number);

    const dataHora = new Date();
    dataHora.setHours(h);
    dataHora.setMinutes(m + 40);
    dataHora.setSeconds(0);

    const hora = String(dataHora.getHours()).padStart(2, "0");
    const min = String(dataHora.getMinutes()).padStart(2, "0");

    horaFim.value = `${hora}:${min}`;
  }

  horaInicio.addEventListener("input", calcularHoraFim);
  calcularHoraFim();

  remover.addEventListener("click", () => {
    if (document.querySelectorAll(".linha-horario-reposicao").length <= 1) {
      mostrarMensagem("Mantenha pelo menos um horário.", true);
      return;
    }

    div.remove();
  });

  horariosContainer.appendChild(div);
}

// =============================
// Sugerir próximo horário
// =============================
function sugerirProximoHorario() {
  const horariosFim = document.querySelectorAll(".horaFim");

  if (!horariosFim.length) return "";

  return horariosFim[horariosFim.length - 1].value || "";
}

// =============================
// Coletar horários do formulário
// =============================
function coletarHorariosDoFormulario() {
  const horasInicio = document.querySelectorAll(".horaInicio");
  const horasFim = document.querySelectorAll(".horaFim");

  const horarios = [];

  horasInicio.forEach((h, i) => {
    if (h.value && horasFim[i]?.value) {
      horarios.push({
        hora_inicio: h.value,
        hora_fim: horasFim[i].value
      });
    }
  });

  return horarios;
}

// =============================
// Remover duplicados internos
// Exemplo: se colocou 14:00 duas vezes,
// salva só uma vez.
// =============================
function removerDuplicadosInternos(horarios) {
  const vistos = new Set();
  const resultado = [];

  horarios.forEach((h) => {
    const chave = `${h.hora_inicio}-${h.hora_fim}`;

    if (!vistos.has(chave)) {
      vistos.add(chave);
      resultado.push(h);
    }
  });

  return resultado;
}

// =============================
// Buscar horários já existentes
// =============================
async function buscarHorariosJaExistentes({ professorId, materiaId, data }) {
  const { data: existentes, error } = await supabase
    .from("horarios_reposicao")
    .select("id, hora_inicio, hora_fim")
    .eq("professor_id", professorId)
    .eq("materia_id", materiaId)
    .eq("data", data);

  if (error) {
    console.error("Erro ao buscar horários existentes:", error);
    throw error;
  }

  return existentes || [];
}

// =============================
// Conferir se o professor realmente dá o curso
// Segurança extra antes de salvar
// =============================
async function professorDaMateria(professorId, materiaId) {
  const { data, error } = await supabase
    .from("professor_materia")
    .select("id")
    .eq("professor_id", professorId)
    .eq("materia_id", materiaId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao conferir vínculo professor/matéria:", error);
    throw error;
  }

  return !!data;
}

// =============================
// Troca de professor
// =============================
professorSelect.addEventListener("change", async () => {
  const professorId = professorSelect.value;
  await carregarMateriasDoProfessor(professorId);
});

// =============================
// Adicionar horário
// =============================
addHorarioBtn.addEventListener("click", () => {
  criarLinhaHorario(sugerirProximoHorario());
});

// =============================
// Salvar horários
// =============================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const professorId = professorSelect.value;
  const materiaId = materiaSelect.value;
  const data = dataInput.value;

  if (!professorId) {
    return mostrarMensagem("Selecione o professor.", true);
  }

  if (!materiaId) {
    return mostrarMensagem("Selecione o curso.", true);
  }

  if (!data) {
    return mostrarMensagem("Selecione a data.", true);
  }

  const amanha = obterDataAmanhaISO();

  if (data < amanha) {
    return mostrarMensagem("Cadastre horários somente a partir de amanhã.", true);
  }

  let horarios = coletarHorariosDoFormulario();

  if (!horarios.length) {
    return mostrarMensagem("Adicione pelo menos um horário.", true);
  }

  horarios = removerDuplicadosInternos(horarios);

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user?.id) {
    console.error("Erro ao identificar usuário:", userError);
    return mostrarMensagem("Não foi possível identificar o usuário logado.", true);
  }

  try {
    const vinculoExiste = await professorDaMateria(professorId, materiaId);

    if (!vinculoExiste) {
      return mostrarMensagem(
        "Este professor não está vinculado a este curso. Verifique o cadastro do professor.",
        true
      );
    }

    const existentes = await buscarHorariosJaExistentes({
      professorId,
      materiaId,
      data
    });

    const chavesExistentes = new Set(
      existentes.map((h) => {
        const inicio = String(h.hora_inicio).slice(0, 5);
        const fim = String(h.hora_fim).slice(0, 5);
        return `${inicio}-${fim}`;
      })
    );

    const horariosNovos = horarios.filter((h) => {
      const chave = `${h.hora_inicio}-${h.hora_fim}`;
      return !chavesExistentes.has(chave);
    });

    if (!horariosNovos.length) {
      return mostrarMensagem(
        "Todos os horários informados já existem para este professor, curso e data.",
        true
      );
    }

    const registros = horariosNovos.map((h) => ({
      data,
      hora_inicio: h.hora_inicio,
      hora_fim: h.hora_fim,
      professor_id: Number(professorId),
      materia_id: Number(materiaId),
      created_by: userData.user.id,
      disponivel: true
    }));

    const { error } = await supabase
      .from("horarios_reposicao")
      .insert(registros);

    if (error) {
      console.error("Erro ao salvar horários:", error);
      mostrarMensagem("Erro ao salvar horários.", true);
      return;
    }

    mostrarMensagem(`${registros.length} horário(s) salvo(s) com sucesso!`);

    const professorSelecionadoAposSalvar = professorId;

    form.reset();
    horariosContainer.innerHTML = "";

    definirDataAmanha();
    criarLinhaHorario();

    professorSelect.value = professorSelecionadoAposSalvar;
    await carregarMateriasDoProfessor(professorSelecionadoAposSalvar);

  } catch (error) {
    console.error("Erro geral ao salvar horários:", error);
    mostrarMensagem("Erro ao salvar horários.", true);
  }
});

// =============================
// ENTER cria novo horário
// =============================
form.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;

  const el = document.activeElement;

  if (!el.classList.contains("horaInicio")) return;

  e.preventDefault();

  const horarios = document.querySelectorAll(".horaInicio");
  const ultimo = horarios[horarios.length - 1];

  if (el !== ultimo) {
    const index = Array.from(horarios).indexOf(el);
    horarios[index + 1]?.focus();
    return;
  }

  criarLinhaHorario(sugerirProximoHorario());

  setTimeout(() => {
    const novosHorarios = document.querySelectorAll(".horaInicio");
    novosHorarios[novosHorarios.length - 1]?.focus();
  }, 50);
});

// =============================
// Iniciar
// =============================
limparSelectMaterias();
carregarProfessores();
definirDataAmanha();
criarLinhaHorario();