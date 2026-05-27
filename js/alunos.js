import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const form = document.getElementById("form-aluno");
const msg = document.getElementById("msg");
const cursosDiv = document.getElementById("cursos");
const btnAddCurso = document.getElementById("btnAddCurso");
const selectEmpresa = document.getElementById("empresa");

let materiasCache = [];
let professoresPorMateria = {};
let modulosPorMateria = {};

// =====================================================
// mensagem visual
// =====================================================
function mostrarMensagem(texto, ok = true) {
  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.padding = "10px 12px";
  msg.style.borderRadius = "10px";
  msg.style.fontSize = "13px";
  msg.style.fontWeight = "600";
  msg.style.border = ok
    ? "1px solid #a5d6a7"
    : "1px solid #ef9a9a";
  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
  }, 5000);
}

// =====================================================
// data local
// =====================================================
function obterDataHojeLocalISO() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

// =====================================================
// carregar empresas
// =====================================================
async function carregarEmpresas() {
  const { data, error } = await supabase
    .from("empresaparceira")
    .select("cnpj, nome")
    .order("nome");

  if (error) {
    console.error("Erro ao carregar empresas:", error);
    return;
  }

  (data || []).forEach((emp) => {
    const option = document.createElement("option");
    option.value = emp.cnpj;
    option.textContent = emp.nome;
    selectEmpresa.appendChild(option);
  });
}

// =====================================================
// carregar bases
// =====================================================
async function carregarBases() {
  await carregarEmpresas();

  const { data: materias, error: errMaterias } = await supabase
    .from("materia")
    .select("id, nome")
    .order("nome");

  if (errMaterias) {
    console.error("Erro ao carregar matérias:", errMaterias);
    mostrarMensagem("Erro ao carregar os cursos.", false);
    return;
  }

  materiasCache = materias || [];

  const { data: vinculos, error: errVinculos } = await supabase
    .from("professor_materia")
    .select(`
      materia_id,
      professor:professor_id ( id, nome )
    `);

  if (errVinculos) {
    console.error("Erro ao carregar professores por matéria:", errVinculos);
    mostrarMensagem("Erro ao carregar professores.", false);
    return;
  }

  professoresPorMateria = {};

  (vinculos || []).forEach((v) => {
    const materiaId = String(v.materia_id);

    if (!professoresPorMateria[materiaId]) {
      professoresPorMateria[materiaId] = [];
    }

    if (v.professor?.id) {
      professoresPorMateria[materiaId].push({
        id: v.professor.id,
        nome: v.professor.nome
      });
    }
  });

  const { data: modulos, error: errModulos } = await supabase
    .from("modulo")
    .select("id, nome, ordem, materia_id")
    .order("ordem");

  if (errModulos) {
    console.error("Erro ao carregar módulos:", errModulos);
    mostrarMensagem("Erro ao carregar módulos.", false);
    return;
  }

  modulosPorMateria = {};

  (modulos || []).forEach((modulo) => {
    const materiaId = String(modulo.materia_id);

    if (!modulosPorMateria[materiaId]) {
      modulosPorMateria[materiaId] = [];
    }

    modulosPorMateria[materiaId].push(modulo);
  });

  adicionarCurso();
}

// =====================================================
// helpers
// =====================================================
function criarOption(value, label) {
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = label;
  return opt;
}

function obterCursoBoxes() {
  return [...cursosDiv.querySelectorAll(".curso-box")];
}

function obterMateriasSelecionadas(excluirBox = null) {
  return obterCursoBoxes()
    .filter((box) => box !== excluirBox)
    .map((box) => box.querySelector(".materia")?.value || "")
    .filter(Boolean);
}

function quantidadeMateriasSelecionadas() {
  const selecionadas = obterCursoBoxes()
    .map((box) => box.querySelector(".materia")?.value || "")
    .filter(Boolean);

  return new Set(selecionadas).size;
}

function aindaHaMateriaDisponivel() {
  return quantidadeMateriasSelecionadas() < materiasCache.length;
}

function atualizarTextoTitulosCursos() {
  const boxes = obterCursoBoxes();

  boxes.forEach((box, index) => {
    const titulo = box.querySelector(".curso-titulo");
    if (titulo) {
      titulo.textContent = `Curso ${index + 1}`;
    }
  });
}

function atualizarVisibilidadeBotoesRemover() {
  const boxes = obterCursoBoxes();

  boxes.forEach((box) => {
    const btnRemover = box.querySelector(".remover");
    if (!btnRemover) return;

    btnRemover.style.display = boxes.length > 1 ? "inline-block" : "none";
  });
}

function atualizarEstadoBotaoAdicionar() {
  btnAddCurso.disabled = false;
  btnAddCurso.style.opacity = "1";
  btnAddCurso.style.cursor = "pointer";
}

function preencherSelectMateria(selectMateria, valorAtual = "") {
  const boxAtual = selectMateria.closest(".curso-box");
  const materiasJaEscolhidasNasOutrasCaixas = obterMateriasSelecionadas(boxAtual);

  selectMateria.innerHTML = "";
  selectMateria.appendChild(criarOption("", "Selecione o curso"));

  materiasCache.forEach((materia) => {
    const materiaId = String(materia.id);

    const podeExibir =
      materiaId === String(valorAtual) ||
      !materiasJaEscolhidasNasOutrasCaixas.includes(materiaId);

    if (podeExibir) {
      selectMateria.appendChild(criarOption(materiaId, materia.nome));
    }
  });

  selectMateria.value = valorAtual || "";
}

function preencherSelectModulo(selectModulo, materiaId, valorAtual = "") {
  selectModulo.innerHTML = "";
  selectModulo.appendChild(criarOption("", "Selecione o módulo"));

  if (!materiaId) {
    selectModulo.disabled = true;
    selectModulo.value = "";
    return;
  }

  const modulos = modulosPorMateria[String(materiaId)] || [];

  modulos.forEach((modulo) => {
    selectModulo.appendChild(criarOption(modulo.id, modulo.nome));
  });

  selectModulo.disabled = false;
  selectModulo.value = valorAtual || "";
}

function preencherSelectProfessor(selectProfessor, materiaId, valorAtual = "") {
  selectProfessor.innerHTML = "";
  selectProfessor.appendChild(criarOption("", "Selecione o professor(a)"));

  if (!materiaId) {
    selectProfessor.disabled = true;
    selectProfessor.value = "";
    return;
  }

  const professores = professoresPorMateria[String(materiaId)] || [];

  professores.forEach((prof) => {
    selectProfessor.appendChild(criarOption(prof.id, prof.nome));
  });

  selectProfessor.disabled = false;
  selectProfessor.value = valorAtual || "";
}

function atualizarOpcoesDeMateriaEmTodasAsCaixas() {
  const boxes = obterCursoBoxes();

  boxes.forEach((box) => {
    const selectMateria = box.querySelector(".materia");
    const valorAtual = selectMateria.value;

    preencherSelectMateria(selectMateria, valorAtual);
  });
}

function atualizarTudoDosCursos() {
  atualizarOpcoesDeMateriaEmTodasAsCaixas();
  atualizarTextoTitulosCursos();
  atualizarVisibilidadeBotoesRemover();
  atualizarEstadoBotaoAdicionar();
}

// =====================================================
// horários de aula
// =====================================================
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

function adicionarLinhaHorario(boxCurso, horario = {}) {
  const listaHorarios = boxCurso.querySelector(".lista-horarios-aula");

  const linha = document.createElement("div");
  linha.className = "linha-horario-aula";
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

  if (horario.dia_semana) selectDia.value = String(horario.dia_semana);
  if (horario.hora_inicio) inputInicio.value = String(horario.hora_inicio).slice(0, 5);
  if (horario.hora_fim) inputFim.value = String(horario.hora_fim).slice(0, 5);

  inputInicio.addEventListener("change", () => {
    if (!inputInicio.value) return;
    inputFim.value = somarMinutos(inputInicio.value, 40);
  });

  btnRemover.addEventListener("click", () => {
    linha.remove();
  });

  listaHorarios.appendChild(linha);
}

function coletarHorariosDoCurso(boxCurso) {
  const linhas = [...boxCurso.querySelectorAll(".linha-horario-aula")];

  const horarios = [];

  linhas.forEach((linha) => {
    const diaSemana = linha.querySelector(".horario-dia")?.value || "";
    const horaInicio = linha.querySelector(".horario-inicio")?.value || "";
    const horaFim = linha.querySelector(".horario-fim")?.value || "";

    const linhaTotalmenteVazia = !diaSemana && !horaInicio && !horaFim;

    if (linhaTotalmenteVazia) {
      return;
    }

    if (!diaSemana || !horaInicio || !horaFim) {
      throw new Error("Preencha dia, início e fim em todos os horários adicionados.");
    }

    if (horaFim <= horaInicio) {
      throw new Error("O horário final precisa ser maior que o horário inicial.");
    }

    horarios.push({
      dia_semana: Number(diaSemana),
      hora_inicio: horaInicio,
      hora_fim: horaFim
    });
  });

  return horarios;
}

function validarHorariosDuplicadosDentroDoCurso(horarios) {
  const chaves = horarios.map((h) => {
    return `${h.dia_semana}-${h.hora_inicio}-${h.hora_fim}`;
  });

  const unicos = new Set(chaves);

  return chaves.length === unicos.size;
}

function validarConflitoDeHorariosDoAluno(cursos) {
  const horariosComCurso = [];

  cursos.forEach((curso, indiceCurso) => {
    (curso.horarios || []).forEach((horario) => {
      horariosComCurso.push({
        indiceCurso,
        materia_id: curso.materia_id,
        professor_id: curso.professor_id,
        dia_semana: Number(horario.dia_semana),
        hora_inicio: horario.hora_inicio,
        hora_fim: horario.hora_fim
      });
    });
  });

  for (let i = 0; i < horariosComCurso.length; i++) {
    for (let j = i + 1; j < horariosComCurso.length; j++) {
      const atual = horariosComCurso[i];
      const outro = horariosComCurso[j];

      const mesmoDia = atual.dia_semana === outro.dia_semana;

      const horariosCruzam =
        atual.hora_inicio < outro.hora_fim &&
        atual.hora_fim > outro.hora_inicio;

      if (mesmoDia && horariosCruzam) {
        throw new Error(
          "Este aluno possui dois horários que batem no mesmo dia. Um aluno não pode ter dois cursos ou professores no mesmo horário."
        );
      }
    }
  }
}

// =====================================================
// adicionar curso
// =====================================================
function adicionarCurso() {
  if (!aindaHaMateriaDisponivel()) {
    mostrarMensagem(
      "Este aluno já foi matriculado em todos os cursos disponíveis na Beehive.",
      false
    );
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "curso-box";
  wrapper.style.border = "1px solid #f1e4a7";
  wrapper.style.background = "#fffdf4";
  wrapper.style.borderRadius = "12px";
  wrapper.style.padding = "12px";
  wrapper.style.marginBottom = "10px";

  wrapper.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:10px; flex-wrap:wrap;">
      <strong class="curso-titulo" style="font-size:13px; color:#5f4b00;">
        Curso
      </strong>

      <button
        type="button"
        class="remover"
        style="background:#fff; border:1px solid #d8d8d8; color:#444; padding:5px 10px; border-radius:8px; cursor:pointer; font-size:12px;"
      >
        Remover
      </button>
    </div>

    <label style="margin-bottom:8px;">
      Curso
      <select class="materia" required style="padding:8px;"></select>
    </label>

    <label style="margin-bottom:8px;">
      Módulo
      <select class="modulo" required disabled style="padding:8px;"></select>
    </label>

    <label style="margin-bottom:8px;">
      Professor(a)
      <select class="professor" required disabled style="padding:8px;"></select>
    </label>

    <div style="margin: 10px 0 8px 0; padding: 8px 10px; border-left: 4px solid #F1BC32; background: #fff7dd; border-radius: 8px;">
      <p style="margin:0; font-size:12px; line-height:1.45; color:#5f4b00;">
        <strong>Horários deste curso:</strong> adicione os dias e horários fixos deste aluno. 
        Se tiver duas aulas no mesmo dia, adicione duas linhas.
      </p>
    </div>

    <div class="lista-horarios-aula" style="margin-bottom:8px;"></div>

    <div style="text-align:right; margin-bottom:10px;">
      <button
        type="button"
        class="btn-add-horario"
        style="background-color:#FFF5CC; border:1px solid #F1BC32; color:#000; padding:5px 10px; border-radius:8px; font-size:11.5px; cursor:pointer;"
      >
        + adicionar horário
      </button>
    </div>

    <div style="margin: 10px 0 8px 0; padding: 8px 10px; border-left: 4px solid #F1BC32; background: #fff7dd; border-radius: 8px;">
      <p style="margin:0; font-size:12px; line-height:1.45; color:#5f4b00;">
        <strong>Links deste curso:</strong> preencha abaixo o acesso da aula ao vivo e da playlist gravada.
      </p>
    </div>

    <label style="margin-bottom:8px;">
      Link da aula ao vivo (Zoom)
      <input
        type="text"
        class="linkZoomCurso"
        placeholder="https://zoom.us/j/..."
        style="padding:8px;"
      />
    </label>

    <label style="margin-bottom:0;">
      Link da playlist (YouTube)
      <input
        type="text"
        class="linkYoutubeCurso"
        placeholder="https://youtube.com/playlist..."
        style="padding:8px;"
      />
    </label>
  `;

  cursosDiv.appendChild(wrapper);

  const selMateria = wrapper.querySelector(".materia");
  const selModulo = wrapper.querySelector(".modulo");
  const selProfessor = wrapper.querySelector(".professor");
  const btnRemover = wrapper.querySelector(".remover");
  const btnAddHorario = wrapper.querySelector(".btn-add-horario");

  preencherSelectMateria(selMateria);
  preencherSelectModulo(selModulo, null);
  preencherSelectProfessor(selProfessor, null);

  adicionarLinhaHorario(wrapper);

  selMateria.addEventListener("change", () => {
    const materiaId = selMateria.value;

    preencherSelectModulo(selModulo, materiaId);
    preencherSelectProfessor(selProfessor, materiaId);

    atualizarOpcoesDeMateriaEmTodasAsCaixas();
  });

  btnAddHorario.addEventListener("click", () => {
    adicionarLinhaHorario(wrapper);
  });

  btnRemover.addEventListener("click", () => {
    wrapper.remove();
    atualizarTudoDosCursos();

    if (obterCursoBoxes().length === 0) {
      adicionarCurso();
    }
  });

  atualizarTudoDosCursos();
}

btnAddCurso.addEventListener("click", () => {
  adicionarCurso();
});

// =====================================================
// validar cursos antes de salvar
// =====================================================
function validarCursosAntesDeSalvar(cursos) {
  if (!cursos.length) {
    mostrarMensagem("Adicione pelo menos um curso para o aluno.", false);
    return false;
  }

  for (const curso of cursos) {
    if (!curso.materia_id || !curso.modulo_id || !curso.professor_id) {
      mostrarMensagem("Preencha corretamente os campos de curso, módulo e professor(a).", false);
      return false;
    }

    if (!validarHorariosDuplicadosDentroDoCurso(curso.horarios || [])) {
      mostrarMensagem(
        "Existe horário repetido no mesmo curso. Remova a linha duplicada antes de salvar.",
        false
      );
      return false;
    }
  }

  const materiasSelecionadas = cursos.map((c) => String(c.materia_id));
  const materiasUnicas = new Set(materiasSelecionadas);

  if (materiasSelecionadas.length !== materiasUnicas.size) {
    mostrarMensagem(
      "O mesmo curso não pode ser selecionado mais de uma vez para o mesmo aluno.",
      false
    );
    return false;
  }

  try {
    validarConflitoDeHorariosDoAluno(cursos);
  } catch (erro) {
    mostrarMensagem(erro.message, false);
    return false;
  }

  return true;
}

// =====================================================
// montar dados dos cursos
// =====================================================
function montarCursosDaTela() {
  return obterCursoBoxes().map((box) => {
    const horarios = coletarHorariosDoCurso(box);

    return {
      materia_id: box.querySelector(".materia").value,
      modulo_id: box.querySelector(".modulo").value,
      professor_id: box.querySelector(".professor").value,
      link_zoom: box.querySelector(".linkZoomCurso").value.trim(),
      link_youtube: box.querySelector(".linkYoutubeCurso").value.trim(),
      horarios
    };
  });
}

// =====================================================
// salvar horários
// =====================================================
async function salvarHorariosDosCursos({
  alunoId,
  cursos,
  matriculasInseridas
}) {
  const registrosHorarios = [];

  cursos.forEach((curso) => {
    const matricula = matriculasInseridas.find((m) => {
      return String(m.materia_id) === String(curso.materia_id);
    });

    if (!matricula) {
      throw new Error("Não foi possível localizar a matrícula para salvar os horários.");
    }

    (curso.horarios || []).forEach((horario) => {
      registrosHorarios.push({
        aluno_id: alunoId,
        matricula_id: matricula.id,
        materia_id: Number(curso.materia_id),
        modulo_id: Number(curso.modulo_id),
        professor_id: Number(curso.professor_id),
        dia_semana: Number(horario.dia_semana),
        hora_inicio: horario.hora_inicio,
        hora_fim: horario.hora_fim,
        ativo: true
      });
    });
  });

  if (!registrosHorarios.length) {
    return;
  }

  const { error } = await supabase
    .from("aluno_horario_aula")
    .insert(registrosHorarios);

  if (error) {
    console.error("Erro ao salvar horários:", error);

    const mensagemBanco = error.message || "";

    if (
      mensagemBanco.includes("Conflito de horário") ||
      mensagemBanco.includes("conflito")
    ) {
      throw new Error(
        "Cadastro cancelado. Existe conflito de horário. Verifique se o aluno já tem aula neste mesmo dia e horário."
      );
    }

    if (
      mensagemBanco.includes("duplicate key") ||
      mensagemBanco.includes("aluno_horario_aula_unico_por_aluno")
    ) {
      throw new Error("Cadastro cancelado. Existe horário duplicado para este aluno.");
    }

    throw new Error("Cadastro cancelado. Houve erro ao cadastrar os horários.");
  }
}

// =====================================================
// desfazer cadastro parcial
// =====================================================
async function desfazerCadastroParcial(alunoId) {
  if (!alunoId) return;

  const { data: matriculas } = await supabase
    .from("matricula")
    .select("id")
    .eq("aluno_id", alunoId);

  const matriculaIds = (matriculas || []).map((m) => m.id);

  await supabase
    .from("aluno_horario_aula")
    .delete()
    .eq("aluno_id", alunoId);

  if (matriculaIds.length) {
    await supabase
      .from("matricula")
      .delete()
      .in("id", matriculaIds);
  }

  const { error: erroAluno } = await supabase
    .from("aluno")
    .delete()
    .eq("id", alunoId);

  if (erroAluno) {
    console.error("Erro ao apagar aluno no desfazer:", erroAluno);
    throw new Error(
      "Houve erro no cadastro e não foi possível desfazer automaticamente. Verifique este aluno no sistema."
    );
  }
}

// =====================================================
// salvar aluno
// =====================================================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome = document.getElementById("nome").value.trim();
  const dataNascimento = document.getElementById("dataNascimento").value;
  const email = document.getElementById("email").value.trim().toLowerCase();
  const telefone = document.getElementById("telefone").value.trim();
  const observacao = document.getElementById("observacao").value.trim();
  const empresaCnpj = selectEmpresa.value || null;

  if (!nome) {
    mostrarMensagem("Preencha o nome do aluno.", false);
    return;
  }

  let cursos = [];

  try {
    cursos = montarCursosDaTela();
  } catch (erro) {
    mostrarMensagem(erro.message, false);
    return;
  }

  if (!validarCursosAntesDeSalvar(cursos)) {
    return;
  }

  const botaoSalvar = form.querySelector("button[type='submit']");
  botaoSalvar.disabled = true;
  botaoSalvar.textContent = "Salvando...";

  let alunoId = null;

  try {
    const { data: alunoInserido, error: errAluno } = await supabase
      .from("aluno")
      .insert([{
        nome,
        data_nascimento: dataNascimento || null,
        email: email || null,
        telefone: telefone || null,
        observacao: observacao || null,
        empresa_cnpj: empresaCnpj
      }])
      .select("id")
      .single();

    if (errAluno) {
      console.error("Erro ao salvar aluno:", errAluno);
      mostrarMensagem("Erro ao salvar aluno.", false);
      return;
    }

    alunoId = alunoInserido.id;

    const { data: matriculasInseridas, error: errMatriculas } = await supabase
      .from("matricula")
      .insert(
        cursos.map((curso) => ({
          aluno_id: alunoId,
          materia_id: Number(curso.materia_id),
          modulo_id: Number(curso.modulo_id),
          professor_id: Number(curso.professor_id),
          link_zoom: curso.link_zoom || null,
          link_youtube: curso.link_youtube || null,
          data_inicio: obterDataHojeLocalISO(),
          ativa: true
        }))
      )
      .select("id, aluno_id, materia_id, modulo_id, professor_id");

    if (errMatriculas) {
      console.error("Erro ao salvar matrículas:", errMatriculas);
      await desfazerCadastroParcial(alunoId);

      mostrarMensagem(
        "Cadastro cancelado. Houve erro ao cadastrar as matrículas.",
        false
      );
      return;
    }

    await salvarHorariosDosCursos({
      alunoId,
      cursos,
      matriculasInseridas: matriculasInseridas || []
    });

    mostrarMensagem("Aluno cadastrado com sucesso!");

    form.reset();
    cursosDiv.innerHTML = "";
    adicionarCurso();

  } catch (erro) {
    console.error("Erro no cadastro:", erro);

    if (alunoId) {
      try {
        await desfazerCadastroParcial(alunoId);

        mostrarMensagem(
          erro.message || "Cadastro cancelado. Nenhum aluno foi salvo.",
          false
        );
      } catch (erroDesfazer) {
        console.error("Erro ao desfazer cadastro:", erroDesfazer);

        mostrarMensagem(
          erroDesfazer.message ||
          "Houve erro no cadastro e não foi possível desfazer automaticamente. Verifique este aluno no sistema.",
          false
        );
      }
    } else {
      mostrarMensagem(
        erro.message || "Erro ao cadastrar aluno.",
        false
      );
    }
  } finally {
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar aluno";
  }
});

// iniciar
carregarBases();