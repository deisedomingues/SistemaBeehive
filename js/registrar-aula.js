import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";
await exigirProfessor();

const form = document.getElementById("form-aula");

// Campos
const inputDataAula = document.getElementById("dataAula");
const selectMatricula = document.getElementById("matricula");
const selectStatus = document.getElementById("status");
const selectParte = document.getElementById("parteAula");

const boxStatus = document.getElementById("boxStatus");

const boxJustificativa = document.getElementById("boxJustificativa");
const inputJustificativa = document.getElementById("justificativa");

const inputConteudo = document.getElementById("conteudo");
const inputLicaoCasa = document.getElementById("licaoCasa");

const msg = document.getElementById("msg");

// Aula coletiva
const aulaColetivaCheckbox = document.getElementById("aulaColetiva");
const listaAlunosBox = document.getElementById("listaAlunos");
const alunosSelecionadosDiv = document.getElementById("alunosSelecionados");

let alunosSelecionados = [];


// ======================
// Mensagem
// ======================
function mostrarMensagem(texto, ok = true) {
  msg.textContent = texto;
  msg.style.display = "block";

  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";

  setTimeout(() => {
    msg.style.display = "none";
  }, 2000);
}


// ======================
// Data automática
// ======================
function setarDataHoje() {
  const hoje = new Date();
  inputDataAula.value = hoje.toISOString().split("T")[0];
}


// ======================
// Renderizar alunos (COM STATUS INDIVIDUAL)
// ======================
function renderizarAlunos() {

  alunosSelecionadosDiv.innerHTML = "";

  alunosSelecionados.forEach((aluno, index) => {

    const div = document.createElement("div");

    div.style.background = "#e3f2fd";
    div.style.padding = "10px";
    div.style.margin = "5px";
    div.style.borderRadius = "10px";

    div.innerHTML = `
      <strong>${aluno.nome}</strong><br>

      Status:
      <select class="status-individual" data-index="${index}">
        <option value="Presente">Presente</option>
        <option value="Ausente">Ausente</option>
        <option value="Cancelada">Cancelada</option>
        <option value="Trancada">Trancada</option>
      </select>

      <button data-index="${index}" style="margin-left:10px;">❌</button>
    `;

    alunosSelecionadosDiv.appendChild(div);
  });

  listaAlunosBox.style.display =
    alunosSelecionados.length ? "block" : "none";
}


// ======================
// Carregar alunos
// ======================
async function carregarMatriculas() {

  const professorId = Number(localStorage.getItem("professorId"));

  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno:aluno_id ( nome ),
      materia:materia_id ( nome ),
      modulo:modulo_id ( nome )
    `)
    .eq("professor_id", professorId)
    .eq("ativa", true);

  if (error) {
    mostrarMensagem("Erro ao carregar alunos", false);
    return;
  }

  selectMatricula.innerHTML = `<option value="">Selecione o aluno</option>`;

  data.sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome));

  data.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = `${m.aluno.nome} — ${m.materia.nome}`;
    selectMatricula.appendChild(opt);
  });
}


// ======================
// EVENTOS
// ======================

// adicionar aluno (modo coletivo)
selectMatricula.addEventListener("change", () => {

  if (!aulaColetivaCheckbox.checked) return;

  const id = selectMatricula.value;
  const nome = selectMatricula.options[selectMatricula.selectedIndex].text;

  if (!id) return;

  if (alunosSelecionados.find(a => a.id === id)) {
    selectMatricula.value = "";
    return;
  }

  alunosSelecionados.push({ id, nome });

  renderizarAlunos();

  // remover do select
  const opt = selectMatricula.querySelector(`option[value="${id}"]`);
  if (opt) opt.remove();

  selectMatricula.value = "";
  selectMatricula.options[0].textContent = "Selecionar mais alunos...";
});


// remover aluno
alunosSelecionadosDiv.addEventListener("click", (e) => {

  if (e.target.tagName === "BUTTON") {

    const index = e.target.dataset.index;
    const aluno = alunosSelecionados[index];

    const opt = document.createElement("option");
    opt.value = aluno.id;
    opt.textContent = aluno.nome;

    selectMatricula.appendChild(opt);

    alunosSelecionados.splice(index, 1);

    renderizarAlunos();
  }
});


// alternar aula coletiva
aulaColetivaCheckbox.addEventListener("change", () => {

  alunosSelecionados = [];
  renderizarAlunos();

  const coletivo = aulaColetivaCheckbox.checked;

  // esconder status geral
  boxStatus.style.display = coletivo ? "none" : "block";

  // required dinâmico
  selectMatricula.required = !coletivo;

  carregarMatriculas();
});


// ======================
// INIT
// ======================
setarDataHoje();
carregarMatriculas();


// ======================
// SALVAR
// ======================
form.addEventListener("submit", async (e) => {

  e.preventDefault();

  const professorId = localStorage.getItem("professorId");
  const dataAula = inputDataAula.value;
  const parte = Number(selectParte.value);

  const justificativa = inputJustificativa.value.trim();
  const conteudo = inputConteudo.value.trim();
  const licaoCasa = inputLicaoCasa.value.trim();

  let registros = [];

  // ======================
  // AULA COLETIVA
  // ======================
  if (aulaColetivaCheckbox.checked) {

    if (alunosSelecionados.length === 0) {
      mostrarMensagem("Adicione alunos", false);
      return;
    }

    const selects = document.querySelectorAll(".status-individual");

    alunosSelecionados.forEach((aluno, i) => {

      const status = selects[i].value;

      registros.push({
        matricula_id: aluno.id,
        professor_id: professorId,
        data_aula: dataAula,
        parte,
        status,
        justificativa: status === "Cancelada" ? justificativa : null,
        conteudo: status === "Cancelada" ? null : conteudo,
        licao_casa: status === "Cancelada" ? null : licaoCasa
      });

    });

  }

  // ======================
  // AULA INDIVIDUAL
  // ======================
  else {

    const matriculaId = selectMatricula.value;
    const status = selectStatus.value;

    if (!matriculaId) {
      mostrarMensagem("Selecione um aluno", false);
      return;
    }

    registros = [{
      matricula_id: matriculaId,
      professor_id: professorId,
      data_aula: dataAula,
      parte,
      status,
      justificativa: status === "Cancelada" ? justificativa : null,
      conteudo: status === "Cancelada" ? null : conteudo,
      licao_casa: status === "Cancelada" ? null : licaoCasa
    }];
  }

  // ======================
  // SALVAR
  // ======================
  const { error } = await supabase
    .from("aula")
    .insert(registros);

  if (error) {
    console.error(error);
    mostrarMensagem("Erro ao salvar", false);
  } else {
    mostrarMensagem("Aula salva!");

    form.reset();
    alunosSelecionados = [];
    renderizarAlunos();

    setarDataHoje();
  }

});