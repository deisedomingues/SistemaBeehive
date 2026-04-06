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
  }, 2600);
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
      selectMateria.appendChild(
        criarOption(materiaId, materia.nome)
      );
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
    selectModulo.appendChild(
      criarOption(modulo.id, modulo.nome)
    );
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
    selectProfessor.appendChild(
      criarOption(prof.id, prof.nome)
    );
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

  preencherSelectMateria(selMateria);
  preencherSelectModulo(selModulo, null);
  preencherSelectProfessor(selProfessor, null);

  selMateria.addEventListener("change", () => {
    const materiaId = selMateria.value;

    preencherSelectModulo(selModulo, materiaId);
    preencherSelectProfessor(selProfessor, materiaId);

    atualizarOpcoesDeMateriaEmTodasAsCaixas();
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

// =====================================================
// clique no botão adicionar curso
// =====================================================
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
      mostrarMensagem(
        "Preencha corretamente os campos de curso, módulo e professor(a).",
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

  return true;
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

  const cursos = obterCursoBoxes().map((box) => ({
    materia_id: box.querySelector(".materia").value,
    modulo_id: box.querySelector(".modulo").value,
    professor_id: box.querySelector(".professor").value,
    link_zoom: box.querySelector(".linkZoomCurso").value.trim(),
    link_youtube: box.querySelector(".linkYoutubeCurso").value.trim()
  }));

  if (!validarCursosAntesDeSalvar(cursos)) {
    return;
  }

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

  const alunoId = alunoInserido.id;

  const { error: errMatriculas } = await supabase
    .from("matricula")
    .insert(
      cursos.map((curso) => ({
        aluno_id: alunoId,
        materia_id: curso.materia_id,
        modulo_id: curso.modulo_id,
        professor_id: curso.professor_id,
        link_zoom: curso.link_zoom || null,
        link_youtube: curso.link_youtube || null,
        data_inicio: new Date().toISOString().slice(0, 10),
        ativa: true
      }))
    );

  if (errMatriculas) {
    console.error("Erro ao salvar matrículas:", errMatriculas);
    mostrarMensagem("Aluno salvo, mas houve erro ao cadastrar as matrículas.", false);
    return;
  }

  mostrarMensagem("Aluno cadastrado com sucesso!");

  form.reset();
  cursosDiv.innerHTML = "";
  adicionarCurso();
});

// iniciar
carregarBases();