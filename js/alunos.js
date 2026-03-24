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

function mostrarMensagem(texto, ok = true) {

  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
  }, 2200);
}

// ======================
// carregar empresas
// ======================
async function carregarEmpresas() {

  const { data, error } = await supabase
    .from("empresaparceira")
    .select("cnpj, nome")
    .order("nome");

  if (error) {
    console.error(error);
    return;
  }

  (data || []).forEach(emp => {

    const option = document.createElement("option");

    option.value = emp.cnpj;
    option.textContent = emp.nome;

    selectEmpresa.appendChild(option);
  });
}

// ======================
// carregar bases
// ======================
async function carregarBases() {

  await carregarEmpresas();

  // matérias
  const { data: materias } = await supabase
    .from("materia")
    .select("id, nome")
    .order("nome");

  materiasCache = materias || [];

  // professor x matéria
  const { data: vinculos } = await supabase
    .from("professor_materia")
    .select(`
      materia_id,
      professor:professor_id ( id, nome )
    `);

  professoresPorMateria = {};

  (vinculos || []).forEach((v) => {

    const mid = String(v.materia_id);

    if (!professoresPorMateria[mid])
      professoresPorMateria[mid] = [];

    if (v.professor?.id) {

      professoresPorMateria[mid].push({
        id: v.professor.id,
        nome: v.professor.nome
      });

    }
  });

  adicionarCurso();
}

// ======================
// módulos
// ======================
async function carregarModulosPorMateria(materiaId) {

  const { data } = await supabase
    .from("modulo")
    .select("id, nome, ordem")
    .eq("materia_id", materiaId)
    .order("ordem");

  return data || [];
}

function criarOption(value, label) {

  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = label;
  return opt;
}

// ======================
// adicionar curso
// ======================
function adicionarCurso() {

  const wrapper = document.createElement("div");
  wrapper.className = "curso-box";

  wrapper.innerHTML = `
    <label>
      Matéria
      <select class="materia" required></select>
    </label>

    <label>
      Módulo
      <select class="modulo" required disabled></select>
    </label>

    <label>
      Professor
      <select class="professor" required disabled></select>
    </label>

    <button type="button" class="remover">
      Remover
    </button>
  `;

  cursosDiv.appendChild(wrapper);

  const selMateria = wrapper.querySelector(".materia");
  const selModulo = wrapper.querySelector(".modulo");
  const selProfessor = wrapper.querySelector(".professor");

  selMateria.appendChild(
    criarOption("", "Selecione a matéria")
  );

  materiasCache.forEach((m) => {
    selMateria.appendChild(
      criarOption(m.id, m.nome)
    );
  });

  selMateria.addEventListener("change", async () => {

    const materiaId = selMateria.value;

    selModulo.innerHTML = "";
    selProfessor.innerHTML = "";

    selModulo.disabled = true;
    selProfessor.disabled = true;

    if (!materiaId) return;

    // módulos
    const modulos =
      await carregarModulosPorMateria(materiaId);

    selModulo.disabled = false;

    selModulo.appendChild(
      criarOption("", "Selecione o módulo")
    );

    modulos.forEach((m) => {
      selModulo.appendChild(
        criarOption(m.id, m.nome)
      );
    });

    // professores
    const professores =
      professoresPorMateria[materiaId] || [];

    selProfessor.disabled = false;

    selProfessor.appendChild(
      criarOption("", "Selecione o professor")
    );

    professores.forEach((p) => {
      selProfessor.appendChild(
        criarOption(p.id, p.nome)
      );
    });

  });

  wrapper.querySelector(".remover").onclick =
    () => wrapper.remove();
}

btnAddCurso.onclick = adicionarCurso;

// ======================
// salvar aluno
// ======================
form.addEventListener("submit", async (e) => {

  e.preventDefault();

  const nome =
    document.getElementById("nome").value.trim();

  const dataNascimento =
    document.getElementById("dataNascimento").value;

  const email =
    document.getElementById("email")
      .value.trim()
      .toLowerCase();

  const telefone =
    document.getElementById("telefone").value.trim();

  const observacao =
    document.getElementById("observacao").value.trim();

  const empresaCnpj = selectEmpresa.value || null;

  if (!nome) {
    mostrarMensagem("Preencha o nome", false);
    return;
  }

  const cursos = [
    ...cursosDiv.querySelectorAll(".curso-box")
  ].map((box) => ({

    materia_id:
      box.querySelector(".materia").value,

    modulo_id:
      box.querySelector(".modulo").value,

    professor_id:
      box.querySelector(".professor").value
  }));

  // ======================
  // salvar aluno
  // ======================
  const { data: alunoInserido, error: errAluno }
    = await supabase
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

    console.error(errAluno);

    mostrarMensagem(
      "Erro ao salvar aluno",
      false
    );

    return;
  }

  const alunoId = alunoInserido.id;

  // ======================
  // salvar matrículas
  // ======================
  await supabase
    .from("matricula")
    .insert(

      cursos.map((c) => ({

        aluno_id: alunoId,
        ...c,
        data_inicio:
          new Date()
            .toISOString()
            .slice(0, 10),

        ativa: true
      }))

    );

  mostrarMensagem(
    "Aluno cadastrado com sucesso!"
  );

  form.reset();

  cursosDiv.innerHTML = "";

  adicionarCurso();
});

// iniciar
carregarBases();