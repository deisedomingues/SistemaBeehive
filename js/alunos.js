import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const form = document.getElementById("form-aluno");
const msg = document.getElementById("msg");
const cursosDiv = document.getElementById("cursos");
const btnAddCurso = document.getElementById("btnAddCurso");

let materiasCache = [];

/**
 * Mapa: materia_id -> [{ id, nome }, ...]
 * Ex: professoresPorMateria["1"] = [{id: 3, nome: "Gretha"}, ...]
 */
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

// Carrega matérias e vínculos professor_materia no início
async function carregarBases() {
  // 1) matérias
  const { data: materias, error: errMat } = await supabase
    .from("materia")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (errMat) {
    console.error(errMat);
    mostrarMensagem("❌ Erro ao carregar matérias", false);
    return;
  }
  materiasCache = materias || [];

  // 2) vínculos professor_materia + professor(nome)
  const { data: vinculos, error: errVinc } = await supabase
    .from("professor_materia")
    .select(`
      materia_id,
      professor:professor_id ( id, nome )
    `);

  if (errVinc) {
    console.error(errVinc);
    mostrarMensagem("❌ Erro ao carregar professores", false);
    return;
  }

  // Monta o mapa materia_id -> lista de professores
  professoresPorMateria = {};
  (vinculos || []).forEach((v) => {
    const mid = String(v.materia_id);
    if (!professoresPorMateria[mid]) professoresPorMateria[mid] = [];

    // evita duplicar
    if (
      v.professor?.id &&
      !professoresPorMateria[mid].some((p) => String(p.id) === String(v.professor.id))
    ) {
      professoresPorMateria[mid].push({ id: v.professor.id, nome: v.professor.nome });
    }
  });

  // Ordena nomes dentro de cada matéria
  Object.keys(professoresPorMateria).forEach((mid) => {
    professoresPorMateria[mid].sort((a, b) => a.nome.localeCompare(b.nome));
  });

  // cria pelo menos 1 curso padrão
  adicionarCurso();
}

// Busca módulos por matéria (para preencher o select)
async function carregarModulosPorMateria(materiaId) {
  const { data, error } = await supabase
    .from("modulo")
    .select("id, nome, ordem, materia_id")
    .eq("materia_id", materiaId)
    .order("ordem", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

function criarOption(value, label) {
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = label;
  return opt;
}

/**
 * Retorna um array com os IDs de matérias já selecionadas nos blocos,
 * exceto o bloco "atual" (para ele não se bloquear sozinho).
 */
function getMateriasSelecionadas(excetoSelectMateria = null) {
  const selects = [...cursosDiv.querySelectorAll(".materia")];

  return selects
    .filter((s) => s !== excetoSelectMateria)
    .map((s) => s.value)
    .filter((v) => v);
}

/**
 * Atualiza as opções do select de matéria em TODOS os blocos:
 * - Remove matérias já escolhidas em outros blocos
 * - Mantém a matéria do próprio bloco, se ele já escolheu
 */
function atualizarOpcoesMaterias() {
  const todosSelectsMateria = [...cursosDiv.querySelectorAll(".materia")];

  todosSelectsMateria.forEach((selectMateria) => {
    const valorAtual = selectMateria.value;
    const jaSelecionadasNosOutros = new Set(getMateriasSelecionadas(selectMateria));

    selectMateria.innerHTML = "";
    selectMateria.appendChild(criarOption("", "Selecione a matéria"));

    materiasCache.forEach((m) => {
      const mId = String(m.id);

      // Se já está em outro bloco, não mostra aqui (exceto se for a própria do bloco)
      if (jaSelecionadasNosOutros.has(mId) && mId !== String(valorAtual)) return;

      selectMateria.appendChild(criarOption(m.id, m.nome));
    });

    // restaura seleção se existir
    if (valorAtual) {
      selectMateria.value = valorAtual;
      if (selectMateria.value !== valorAtual) selectMateria.value = "";
    }
  });

  // Desativa botão se já usou todas as matérias
  const materiasUsadas = new Set(getMateriasSelecionadas(null));
  const todasUsadas = materiasUsadas.size >= materiasCache.length;
  btnAddCurso.disabled = todasUsadas;
  btnAddCurso.style.opacity = todasUsadas ? "0.6" : "1";
  btnAddCurso.style.cursor = todasUsadas ? "not-allowed" : "pointer";
}

// Cria um bloco de curso (matéria + módulo + professor)
function adicionarCurso() {
  const wrapper = document.createElement("div");
  wrapper.className = "curso-box";
  wrapper.style.border = "1px solid #eee";
  wrapper.style.borderRadius = "10px";
  wrapper.style.padding = "8px";
  wrapper.style.marginBottom = "8px";

  wrapper.innerHTML = `
    <label style="margin-bottom:6px;">
      Matéria
      <select class="materia" required style="margin-top:4px; padding:8px;">
        <option value="">Selecione a matéria</option>
      </select>
    </label>

    <label style="margin-bottom:6px;">
      Módulo
      <select class="modulo" required disabled style="margin-top:4px; padding:8px;">
        <option value="">Selecione a matéria primeiro</option>
      </select>
    </label>

    <label style="margin-bottom:6px;">
      Professor
      <select class="professor" required disabled style="margin-top:4px; padding:8px;">
        <option value="">Selecione a matéria primeiro</option>
      </select>
    </label>

    <div style="text-align:right; margin-top:6px;">
      <button
        type="button"
        class="remover"
        style="
          background: transparent;
          border: none;
          color: #000;
          font-size: 12px;
          cursor: pointer;
          text-decoration: underline;
          padding: 0;
        "
      >
        Remover curso
      </button>
    </div>
  `;

  cursosDiv.appendChild(wrapper);

  const selMateria = wrapper.querySelector(".materia");
  const selModulo = wrapper.querySelector(".modulo");
  const selProfessor = wrapper.querySelector(".professor");
  const btnRemover = wrapper.querySelector(".remover");

  // Atualiza opções de matérias considerando os blocos existentes
  atualizarOpcoesMaterias();

  // Quando escolher a matéria: carrega módulos e professores da matéria escolhida
  selMateria.addEventListener("change", async () => {
    const materiaId = selMateria.value;

    // Atualiza matérias disponíveis nos outros blocos
    atualizarOpcoesMaterias();

    // Reset módulo/professor
    selModulo.innerHTML = "";
    selProfessor.innerHTML = "";

    if (!materiaId) {
      selModulo.disabled = true;
      selProfessor.disabled = true;
      selModulo.appendChild(criarOption("", "Selecione a matéria primeiro"));
      selProfessor.appendChild(criarOption("", "Selecione a matéria primeiro"));
      return;
    }

    // Módulos
    selModulo.disabled = false;
    selModulo.appendChild(criarOption("", "Selecione o módulo"));
    const modulos = await carregarModulosPorMateria(materiaId);
    modulos.forEach((mod) => {
      selModulo.appendChild(criarOption(mod.id, mod.nome));
    });

    // Professores (filtrados por matéria via professor_materia)
    selProfessor.disabled = false;
    selProfessor.appendChild(criarOption("", "Selecione o professor"));

    const listaProf = professoresPorMateria[String(materiaId)] || [];
    if (listaProf.length === 0) {
      selProfessor.appendChild(criarOption("", "Nenhum professor cadastrado para esta matéria"));
      selProfessor.disabled = true;
    } else {
      listaProf.forEach((p) => {
        selProfessor.appendChild(criarOption(p.id, p.nome));
      });
    }
  });

  // Remover curso
  btnRemover.addEventListener("click", () => {
    wrapper.remove();

    // garante que sempre exista pelo menos 1 curso
    if (cursosDiv.querySelectorAll(".curso-box").length === 0) {
      adicionarCurso();
      return;
    }

    atualizarOpcoesMaterias();
  });
}

// Botão adicionar curso
btnAddCurso.addEventListener("click", () => {
  const materiasUsadas = new Set(getMateriasSelecionadas(null));
  if (materiasUsadas.size >= materiasCache.length) {
    mostrarMensagem("⚠️ Este aluno já está em todos os cursos disponíveis.", false);
    return;
  }
  adicionarCurso();
});

// ==========================
// SALVAR: cria aluno + cria matrículas
// ==========================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome = document.getElementById("nome").value.trim();
  const dataNascimento = document.getElementById("dataNascimento").value;

  // novos campos
  const email = (document.getElementById("email")?.value || "").trim().toLowerCase();
  const telefone = (document.getElementById("telefone")?.value || "").trim();

  if (!nome || !dataNascimento) {
    mostrarMensagem("⚠️ Preencha nome e data de nascimento.", false);
    return;
  }

  const cursos = [...cursosDiv.querySelectorAll(".curso-box")].map((box) => {
    return {
      materia_id: box.querySelector(".materia").value,
      modulo_id: box.querySelector(".modulo").value,
      professor_id: box.querySelector(".professor").value,
    };
  });

  if (cursos.length === 0) {
    mostrarMensagem("⚠️ Adicione pelo menos 1 curso.", false);
    return;
  }

  for (const c of cursos) {
    if (!c.materia_id || !c.modulo_id || !c.professor_id) {
      mostrarMensagem("⚠️ Preencha Matéria, Módulo e Professor em todos os cursos.", false);
      return;
    }
  }

  // Evita duplicar a mesma matéria no mesmo aluno
  const materiasSelecionadas = cursos.map((c) => c.materia_id);
  const materiasUnicas = new Set(materiasSelecionadas);
  if (materiasUnicas.size !== materiasSelecionadas.length) {
    mostrarMensagem("⚠️ Você adicionou a mesma matéria duas vezes. Remova uma delas.", false);
    return;
  }

  // 1) inserir aluno (agora com email/telefone)
  const payloadAluno = {
    nome: nome,
    data_nascimento: dataNascimento,
    email: email || null,
    telefone: telefone || null
  };

  const { data: alunoInserido, error: errAluno } = await supabase
    .from("aluno")
    .insert([payloadAluno])
    .select("id")
    .single();

  if (errAluno) {
    console.error(errAluno);
    mostrarMensagem("❌ Erro ao salvar aluno.", false);
    return;
  }

  const alunoId = alunoInserido.id;

  // 2) inserir matrículas
  const matriculasPayload = cursos.map((c) => ({
    aluno_id: alunoId,
    materia_id: c.materia_id,
    modulo_id: c.modulo_id,
    professor_id: c.professor_id,
    data_inicio: new Date().toISOString().slice(0, 10),
    ativa: true
  }));

  const { error: errMatriculas } = await supabase
    .from("matricula")
    .insert(matriculasPayload);

  if (errMatriculas) {
    console.error(errMatriculas);
    mostrarMensagem("❌ Erro ao salvar cursos do aluno (matrícula).", false);
    return;
  }

  mostrarMensagem("✅ Salvo!");
  form.reset();
  cursosDiv.innerHTML = "";
  adicionarCurso();
  atualizarOpcoesMaterias();
});

// inicia
carregarBases();
