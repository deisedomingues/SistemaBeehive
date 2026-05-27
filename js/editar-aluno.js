import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const msg = document.getElementById("msg");
const msgSalvar = document.getElementById("msgSalvar");

const inputAluno = document.getElementById("inputAluno");
const listaSugestoes = document.getElementById("listaSugestoes");
const btnVerMatriculas = document.getElementById("btnVerMatriculas");

const form = document.getElementById("form-editar");
const inputNome = document.getElementById("nome");
const inputData = document.getElementById("dataNascimento");
const inputEmail = document.getElementById("email");
const inputTelefone = document.getElementById("telefone");
const inputEmpresa = document.getElementById("empresa");

const btnSalvar = document.getElementById("btnSalvar");
const secaoHorarios = document.getElementById("secaoHorarios");
const horariosCursosDiv = document.getElementById("horariosCursos");

let alunosCache = [];
let empresasCache = [];
let alunoAtualId = null;
let matriculasAlunoAtual = [];

/* =========================
   MENSAGEM DO TOPO
========================= */
function mostrarMensagem(texto, ok = true) {
  if (!msg) return;

  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.padding = "10px";
  msg.style.borderRadius = "8px";
  msg.style.marginBottom = "10px";
  msg.style.fontSize = "14px";

  if (ok) {
    msg.style.background = "#e8f5e9";
    msg.style.color = "#1b5e20";
    msg.style.border = "1px solid #a5d6a7";
  } else {
    msg.style.background = "#ffebee";
    msg.style.color = "#b71c1c";
    msg.style.border = "1px solid #ef9a9a";
  }

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
  }, 3500);
}

/* =========================
   MENSAGEM PERTO DO BOTÃO
========================= */
function mostrarMsgSalvar(texto, ok = true) {
  if (!msgSalvar) return;

  msgSalvar.textContent = texto;
  msgSalvar.style.display = "block";
  msgSalvar.style.marginTop = "10px";
  msgSalvar.style.padding = "10px";
  msgSalvar.style.borderRadius = "8px";
  msgSalvar.style.fontSize = "14px";
  msgSalvar.style.textAlign = "center";

  if (ok) {
    msgSalvar.style.background = "#e8f5e9";
    msgSalvar.style.color = "#1b5e20";
    msgSalvar.style.border = "1px solid #a5d6a7";
  } else {
    msgSalvar.style.background = "#ffebee";
    msgSalvar.style.color = "#b71c1c";
    msgSalvar.style.border = "1px solid #ef9a9a";
  }

  setTimeout(() => {
    msgSalvar.style.display = "none";
    msgSalvar.textContent = "";
  }, 4000);
}

/* =========================
   LIMPAR FORMULÁRIO
========================= */
function limparFormulario() {
  alunoAtualId = null;
  matriculasAlunoAtual = [];

  inputNome.value = "";
  inputData.value = "";
  inputEmail.value = "";
  inputTelefone.value = "";
  inputEmpresa.value = "";

  btnSalvar.disabled = true;
  btnSalvar.textContent = "Salvar alterações";

  btnVerMatriculas.disabled = true;

  if (secaoHorarios) {
    secaoHorarios.style.display = "none";
  }

  if (horariosCursosDiv) {
    horariosCursosDiv.innerHTML = "";
  }
}

/* =========================
   CARREGAR EMPRESAS
========================= */
async function carregarEmpresas() {
  const { data, error } = await supabase
    .from("empresaparceira")
    .select("cnpj, nome")
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao carregar empresas:", error);
    mostrarMensagem("Erro ao carregar empresas.", false);
    return;
  }

  empresasCache = data || [];

  inputEmpresa.innerHTML = "";

  const optionSemEmpresa = document.createElement("option");
  optionSemEmpresa.value = "";
  optionSemEmpresa.textContent = "Sem empresa vinculada";
  inputEmpresa.appendChild(optionSemEmpresa);

  empresasCache.forEach((emp) => {
    const option = document.createElement("option");
    option.value = emp.cnpj;
    option.textContent = emp.nome;
    inputEmpresa.appendChild(option);
  });
}

/* =========================
   CARREGAR ALUNOS COM QUANTIDADE DE CURSOS
========================= */
async function carregarAlunosComQtdCursos() {
  const { data: alunos, error: errAluno } = await supabase
    .from("aluno")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (errAluno) {
    console.error("Erro ao carregar alunos:", errAluno);
    mostrarMensagem("Erro ao carregar alunos.", false);
    return;
  }

  const { data: mats, error: errMat } = await supabase
    .from("matricula")
    .select("aluno_id");

  if (errMat) {
    console.error("Erro ao carregar matrículas:", errMat);
    mostrarMensagem("Erro ao carregar matrículas.", false);
    return;
  }

  const contador = {};

  (mats || []).forEach((m) => {
    const alunoId = String(m.aluno_id);
    contador[alunoId] = (contador[alunoId] || 0) + 1;
  });

  alunosCache = (alunos || []).map((a) => ({
    id: a.id,
    nome: a.nome,
    qtdCursos: contador[String(a.id)] || 0
  }));
}

/* =========================
   MOSTRAR SUGESTÕES
========================= */
function mostrarSugestoes(lista) {
  listaSugestoes.innerHTML = "";

  if (!lista || lista.length === 0) {
    listaSugestoes.style.display = "none";
    return;
  }

  lista.forEach((aluno) => {
    const div = document.createElement("div");

    div.className = "item-sugestao";
    div.textContent = `${aluno.nome} (${aluno.qtdCursos} curso${aluno.qtdCursos === 1 ? "" : "s"})`;

    div.addEventListener("click", () => {
      selecionarAluno(aluno);
    });

    listaSugestoes.appendChild(div);
  });

  listaSugestoes.style.display = "block";
}

/* =========================
   CARREGAR ALUNO POR ID
========================= */
async function carregarAlunoPorId(id) {
  const { data, error } = await supabase
    .from("aluno")
    .select("id, nome, data_nascimento, email, telefone, empresa_cnpj")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Erro ao carregar dados do aluno:", error);
    mostrarMensagem("Erro ao carregar dados do aluno.", false);
    return null;
  }

  return data;
}

/* =========================
   HORÁRIOS - HELPERS
========================= */
function somarMinutos(hora, minutosParaSomar) {
  if (!hora) return "";

  const [horas, minutos] = hora.split(":").map(Number);

  const data = new Date();
  data.setHours(horas);
  data.setMinutes(minutos + minutosParaSomar);
  data.setSeconds(0);
  data.setMilliseconds(0);

  const novaHora = String(data.getHours()).padStart(2, "0");
  const novoMinuto = String(data.getMinutes()).padStart(2, "0");

  return `${novaHora}:${novoMinuto}`;
}

function nomeDiaSemana(numero) {
  const nomes = {
    1: "Segunda-feira",
    2: "Terça-feira",
    3: "Quarta-feira",
    4: "Quinta-feira",
    5: "Sexta-feira",
    6: "Sábado"
  };

  return nomes[Number(numero)] || "";
}

function criarLinhaHorario(cardCurso, horario = {}) {
  const lista = cardCurso.querySelector(".lista-horarios-curso");

  const linha = document.createElement("div");
  linha.className = "linha-horario-aula";
  linha.dataset.horarioId = horario.id || "";

  linha.style.display = "grid";
  linha.style.gridTemplateColumns = "1.4fr 1fr 1fr auto";
  linha.style.gap = "8px";
  linha.style.alignItems = "end";
  linha.style.marginBottom = "8px";

  linha.innerHTML = `
    <label style="margin-bottom:0;">
      Dia
      <select class="horario-dia" style="padding:8px;">
        <option value="">Selecione</option>
        <option value="1">Segunda-feira</option>
        <option value="2">Terça-feira</option>
        <option value="3">Quarta-feira</option>
        <option value="4">Quinta-feira</option>
        <option value="5">Sexta-feira</option>
        <option value="6">Sábado</option>
      </select>
    </label>

    <label style="margin-bottom:0;">
      Início
      <input
        type="time"
        class="horario-inicio"
        style="padding:8px;"
      />
    </label>

    <label style="margin-bottom:0;">
      Fim
      <input
        type="time"
        class="horario-fim"
        style="padding:8px;"
      />
    </label>

    <button
      type="button"
      class="btn-remover-horario"
      style="background:#fff; border:1px solid #d8d8d8; color:#444; padding:8px 10px; border-radius:8px; cursor:pointer; font-size:12px;"
    >
      Remover
    </button>
  `;

  const selectDia = linha.querySelector(".horario-dia");
  const inputInicio = linha.querySelector(".horario-inicio");
  const inputFim = linha.querySelector(".horario-fim");
  const btnRemover = linha.querySelector(".btn-remover-horario");

  if (horario.dia_semana) {
    selectDia.value = String(horario.dia_semana);
  }

  if (horario.hora_inicio) {
    inputInicio.value = String(horario.hora_inicio).slice(0, 5);
  }

  if (horario.hora_fim) {
    inputFim.value = String(horario.hora_fim).slice(0, 5);
  }

  inputInicio.addEventListener("change", () => {
    if (!inputInicio.value) return;
    inputFim.value = somarMinutos(inputInicio.value, 40);
  });

  btnRemover.addEventListener("click", () => {
    linha.remove();
  });

  lista.appendChild(linha);
}

async function carregarMatriculasDoAluno(alunoId) {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno_id,
      materia_id,
      modulo_id,
      professor_id,
      ativa,
      materia:materia_id ( id, nome ),
      modulo:modulo_id ( id, nome ),
      professor:professor_id ( id, nome )
    `)
    .eq("aluno_id", alunoId)
    .order("id", { ascending: true });

  if (error) {
    console.error("Erro ao carregar matrículas do aluno:", error);
    mostrarMensagem("Erro ao carregar matrículas do aluno.", false);
    return [];
  }

  return data || [];
}

async function carregarHorariosDoAluno(alunoId) {
  const { data, error } = await supabase
    .from("aluno_horario_aula")
    .select(`
      id,
      aluno_id,
      matricula_id,
      materia_id,
      modulo_id,
      professor_id,
      dia_semana,
      hora_inicio,
      hora_fim,
      ativo
    `)
    .eq("aluno_id", alunoId)
    .eq("ativo", true)
    .order("dia_semana", { ascending: true })
    .order("hora_inicio", { ascending: true });

  if (error) {
    console.error("Erro ao carregar horários do aluno:", error);
    mostrarMensagem("Erro ao carregar horários do aluno.", false);
    return [];
  }

  return data || [];
}

function encontrarHorariosDaMatricula(horarios, matricula) {
  return horarios.filter((h) => {
    if (h.matricula_id) {
      return Number(h.matricula_id) === Number(matricula.id);
    }

    return (
      Number(h.materia_id) === Number(matricula.materia_id) &&
      Number(h.professor_id) === Number(matricula.professor_id)
    );
  });
}

function renderizarHorariosDoAluno(matriculas, horarios) {
  horariosCursosDiv.innerHTML = "";

  if (!matriculas.length) {
    secaoHorarios.style.display = "block";
    horariosCursosDiv.innerHTML = `
      <div style="padding:10px; border:1px solid #eee; background:#fffdf4; border-radius:10px; font-size:13px; color:#5f4b00;">
        Este aluno ainda não possui matrícula cadastrada. Cadastre a matrícula primeiro para vincular horários.
      </div>
    `;
    return;
  }

  secaoHorarios.style.display = "block";

  matriculas.forEach((matricula) => {
    const card = document.createElement("div");
    card.className = "card-horario-curso";
    card.dataset.matriculaId = matricula.id;
    card.dataset.materiaId = matricula.materia_id || "";
    card.dataset.moduloId = matricula.modulo_id || "";
    card.dataset.professorId = matricula.professor_id || "";

    card.style.border = "1px solid #f1e4a7";
    card.style.background = "#fffdf4";
    card.style.borderRadius = "12px";
    card.style.padding = "12px";
    card.style.marginBottom = "10px";

    const nomeMateria = matricula.materia?.nome || "Curso sem nome";
    const nomeModulo = matricula.modulo?.nome || "Módulo não informado";
    const nomeProfessor = matricula.professor?.nome || "Professor(a) não informado";

    card.innerHTML = `
      <div style="margin-bottom:10px;">
        <strong style="font-size:13px; color:#5f4b00;">
          ${nomeMateria}
        </strong>

        <p style="margin:4px 0 0 0; font-size:12px; color:#555; line-height:1.4;">
          ${nomeModulo} | ${nomeProfessor}
        </p>
      </div>

      <div class="lista-horarios-curso"></div>

      <div style="text-align:right;">
        <button
          type="button"
          class="btn-add-horario-curso"
          style="background-color:#FFF5CC; border:1px solid #F1BC32; color:#000; padding:5px 10px; border-radius:8px; font-size:11.5px; cursor:pointer;"
        >
          + adicionar horário
        </button>
      </div>
    `;

    horariosCursosDiv.appendChild(card);

    const horariosDessaMatricula = encontrarHorariosDaMatricula(horarios, matricula);

    if (horariosDessaMatricula.length) {
      horariosDessaMatricula.forEach((horario) => {
        criarLinhaHorario(card, horario);
      });
    } else {
      criarLinhaHorario(card);
    }

    const btnAddHorario = card.querySelector(".btn-add-horario-curso");

    btnAddHorario.addEventListener("click", () => {
      criarLinhaHorario(card);
    });
  });
}

function coletarHorariosDaTela() {
  const cards = [...document.querySelectorAll(".card-horario-curso")];

  const horarios = [];

  cards.forEach((card) => {
    const matriculaId = Number(card.dataset.matriculaId);
    const materiaId = Number(card.dataset.materiaId);
    const moduloId = card.dataset.moduloId ? Number(card.dataset.moduloId) : null;
    const professorId = Number(card.dataset.professorId);

    const linhas = [...card.querySelectorAll(".linha-horario-aula")];

    linhas.forEach((linha) => {
      const diaSemana = linha.querySelector(".horario-dia")?.value || "";
      const horaInicio = linha.querySelector(".horario-inicio")?.value || "";
      const horaFim = linha.querySelector(".horario-fim")?.value || "";

      const vazia = !diaSemana && !horaInicio && !horaFim;

      if (vazia) {
        return;
      }

      if (!diaSemana || !horaInicio || !horaFim) {
        throw new Error("Preencha dia, início e fim em todos os horários adicionados.");
      }

      if (horaFim <= horaInicio) {
        throw new Error("O horário final precisa ser maior que o horário inicial.");
      }

      horarios.push({
        aluno_id: Number(alunoAtualId),
        matricula_id: matriculaId,
        materia_id: materiaId,
        modulo_id: moduloId,
        professor_id: professorId,
        dia_semana: Number(diaSemana),
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        ativo: true
      });
    });
  });

  return horarios;
}

function validarConflitoDeHorariosDoAluno(horarios) {
  for (let i = 0; i < horarios.length; i++) {
    for (let j = i + 1; j < horarios.length; j++) {
      const atual = horarios[i];
      const outro = horarios[j];

      const mesmoDia = atual.dia_semana === outro.dia_semana;

      const horariosCruzam =
        atual.hora_inicio < outro.hora_fim &&
        atual.hora_fim > outro.hora_inicio;

      if (mesmoDia && horariosCruzam) {
        throw new Error(
          `Conflito de horário do aluno: ${nomeDiaSemana(atual.dia_semana)} das ${atual.hora_inicio} às ${atual.hora_fim} cruza com outro horário cadastrado.`
        );
      }
    }
  }
}

async function validarConflitoProfessorAntesDeSalvar(horarios) {
  for (const horario of horarios) {
    const { data, error } = await supabase
      .from("aluno_horario_aula")
      .select("id, aluno_id, hora_inicio, hora_fim")
      .eq("professor_id", horario.professor_id)
      .eq("dia_semana", horario.dia_semana)
      .eq("ativo", true);

    if (error) {
      console.error("Erro ao validar agenda do professor:", error);
      throw new Error("Erro ao validar agenda do professor.");
    }

    const conflitos = (data || []).filter((existente) => {
      const ehDoMesmoAluno = Number(existente.aluno_id) === Number(alunoAtualId);

      if (ehDoMesmoAluno) {
        return false;
      }

      const cruza =
        horario.hora_inicio < String(existente.hora_fim).slice(0, 5) &&
        horario.hora_fim > String(existente.hora_inicio).slice(0, 5);

      const mesmoHorarioExato =
        horario.hora_inicio === String(existente.hora_inicio).slice(0, 5) &&
        horario.hora_fim === String(existente.hora_fim).slice(0, 5);

      return cruza && !mesmoHorarioExato;
    });

    if (conflitos.length) {
      throw new Error(
        `Conflito na agenda do professor: ${nomeDiaSemana(horario.dia_semana)} das ${horario.hora_inicio} às ${horario.hora_fim} cruza com outro horário já cadastrado.`
      );
    }
  }
}

async function salvarHorariosDoAluno() {
  const horarios = coletarHorariosDaTela();

  validarConflitoDeHorariosDoAluno(horarios);
  await validarConflitoProfessorAntesDeSalvar(horarios);

  const { error: erroDelete } = await supabase
    .from("aluno_horario_aula")
    .delete()
    .eq("aluno_id", alunoAtualId);

  if (erroDelete) {
    console.error("Erro ao apagar horários antigos:", erroDelete);
    throw new Error("Erro ao atualizar horários antigos do aluno.");
  }

  if (!horarios.length) {
    return;
  }

  const { error: erroInsert } = await supabase
    .from("aluno_horario_aula")
    .insert(horarios);

  if (erroInsert) {
    console.error("Erro ao salvar novos horários:", erroInsert);

    const mensagemBanco = erroInsert.message || "";

    if (
      mensagemBanco.includes("Conflito de horário") ||
      mensagemBanco.includes("conflito")
    ) {
      throw new Error("Erro ao salvar horários: existe conflito de horário.");
    }

    throw new Error("Erro ao salvar horários do aluno.");
  }
}

/* =========================
   SELECIONAR ALUNO
========================= */
async function selecionarAluno(aluno) {
  alunoAtualId = aluno.id;

  inputAluno.value = aluno.nome;
  listaSugestoes.style.display = "none";

  const dados = await carregarAlunoPorId(aluno.id);

  if (!dados) {
    limparFormulario();
    return;
  }

  inputNome.value = dados.nome || "";
  inputData.value = dados.data_nascimento || "";
  inputEmail.value = dados.email || "";
  inputTelefone.value = dados.telefone || "";
  inputEmpresa.value = dados.empresa_cnpj || "";

  matriculasAlunoAtual = await carregarMatriculasDoAluno(aluno.id);
  const horarios = await carregarHorariosDoAluno(aluno.id);

  renderizarHorariosDoAluno(matriculasAlunoAtual, horarios);

  btnSalvar.disabled = false;
  btnSalvar.textContent = "Salvar alterações";

  btnVerMatriculas.disabled = false;
}

/* =========================
   BUSCAR ALUNO
========================= */
inputAluno.addEventListener("input", () => {
  const texto = inputAluno.value.toLowerCase().trim();

  if (!texto) {
    listaSugestoes.style.display = "none";
    limparFormulario();
    return;
  }

  const filtrados = alunosCache.filter((a) =>
    a.nome.toLowerCase().includes(texto)
  );

  mostrarSugestoes(filtrados);
});

/* =========================
   VER MATRÍCULAS
========================= */
btnVerMatriculas.addEventListener("click", () => {
  if (!alunoAtualId) {
    mostrarMensagem("Selecione um aluno.", false);
    return;
  }

  localStorage.setItem("alunoSelecionadoAdmin", alunoAtualId);
  window.location.href = "editar-matriculas.html";
});

/* =========================
   SALVAR ALTERAÇÕES
========================= */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!alunoAtualId) {
    mostrarMsgSalvar("Selecione um aluno antes de salvar.", false);
    return;
  }

  const nome = inputNome.value.trim();
  const dataNascimento = inputData.value || null;
  const email = inputEmail.value.trim().toLowerCase();
  const telefone = inputTelefone.value.trim();
  const empresa = inputEmpresa.value || null;

  if (!nome) {
    mostrarMsgSalvar("Preencha o nome do aluno.", false);
    return;
  }

  let horariosColetados = [];

  try {
    horariosColetados = coletarHorariosDaTela();
    validarConflitoDeHorariosDoAluno(horariosColetados);
  } catch (erro) {
    mostrarMsgSalvar(erro.message, false);
    return;
  }

  btnSalvar.disabled = true;
  btnSalvar.textContent = "Salvando...";

  const patch = {
    nome,
    data_nascimento: dataNascimento,
    email: email || null,
    telefone: telefone || null,
    empresa_cnpj: empresa
  };

  try {
    const { error } = await supabase
      .from("aluno")
      .update(patch)
      .eq("id", alunoAtualId);

    if (error) {
      console.error("Erro ao salvar alterações:", error);
      mostrarMsgSalvar("Erro ao salvar dados do aluno. Verifique os dados e tente novamente.", false);
      return;
    }

    await salvarHorariosDoAluno();

    btnSalvar.textContent = "✔ Salvo";
    mostrarMsgSalvar("Dados e horários salvos com sucesso!", true);

    await carregarAlunosComQtdCursos();

    const alunoAtualizado = alunosCache.find((a) => Number(a.id) === Number(alunoAtualId));

    if (alunoAtualizado) {
      inputAluno.value = alunoAtualizado.nome;
    }

    const horariosAtualizados = await carregarHorariosDoAluno(alunoAtualId);
    renderizarHorariosDoAluno(matriculasAlunoAtual, horariosAtualizados);

  } catch (erro) {
    console.error("Erro inesperado ao salvar:", erro);
    mostrarMsgSalvar(
      erro.message || "Erro inesperado ao salvar. Veja o console para detalhes.",
      false
    );

  } finally {
    setTimeout(() => {
      btnSalvar.textContent = "Salvar alterações";
      btnSalvar.disabled = false;
    }, 1200);
  }
});

/* =========================
   FECHAR SUGESTÕES AO CLICAR FORA
========================= */
document.addEventListener("click", (e) => {
  const clicouNoInput = inputAluno.contains(e.target);
  const clicouNaLista = listaSugestoes.contains(e.target);

  if (!clicouNoInput && !clicouNaLista) {
    listaSugestoes.style.display = "none";
  }
});

/* =========================
   INICIALIZAÇÃO
========================= */
limparFormulario();

await carregarEmpresas();
await carregarAlunosComQtdCursos();