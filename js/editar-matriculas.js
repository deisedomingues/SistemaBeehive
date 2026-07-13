import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

// =====================
// Constantes
// =====================
const CNPJ_ALUNO_PARTICULAR = "00000000000000";

// =====================
// Elementos da tela
// =====================
const msg = document.getElementById("msg");

const selectAluno = document.getElementById("selectAluno");
const selectMatricula = document.getElementById("selectMatricula");

const resumoAluno = document.getElementById("resumoAluno");
const nomeAlunoResumo = document.getElementById("nomeAlunoResumo");
const infoCursosAluno = document.getElementById("infoCursosAluno");

const blocoEdicao = document.getElementById("blocoEdicao");
const blocoRematricula = document.getElementById("blocoRematricula");

const tituloEdicao = document.getElementById("tituloEdicao");
const subtituloEdicao = document.getElementById("subtituloEdicao");

const formEditar = document.getElementById("formEditar");
const materiaSel = document.getElementById("materia");
const moduloSel = document.getElementById("modulo");
const professorSel = document.getElementById("professor");
const empresaCursoSel = document.getElementById("empresaCurso");
const linkZoomInput = document.getElementById("linkZoom");
const linkYoutubeInput = document.getElementById("linkYoutube");

const infoMatricula = document.getElementById("infoMatricula");
const btnSalvar = document.getElementById("btnSalvar");

const areaBotaoAdicionarCurso = document.getElementById(
  "areaBotaoAdicionarCurso"
);

const btnAddCurso = document.getElementById("btnAddCurso");
const btnDesmatricular = document.getElementById("btnDesmatricular");
const btnRematricular = document.getElementById("btnRematricular");

const textoRematricula = document.getElementById("textoRematricula");
const infoMatriculaInativa = document.getElementById(
  "infoMatriculaInativa"
);

// =====================
// Cache
// =====================
let professoresCache = [];
let modulosCache = [];
let materiasCache = [];
let empresasCache = [];
let alunosCache = [];

let matriculasAluno = [];
let matriculaAtual = null;

let modoCriacao = false;
let modoRematriculaEdicao = false;

// =====================
// Mensagens
// =====================
function mostrarMensagem(texto, ok = true) {
  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.padding = "10px 12px";
  msg.style.marginBottom = "14px";
  msg.style.borderRadius = "10px";
  msg.style.fontSize = "13px";
  msg.style.fontWeight = "600";
  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";
  msg.style.border = ok
    ? "1px solid #66bb6a"
    : "1px solid #ef5350";

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
  }, 2600);
}

// =====================
// Helpers
// =====================
function criarOption(value, label) {
  const option = document.createElement("option");

  option.value = value;
  option.textContent = label;

  return option;
}

function formatarDataBR(dataISO) {
  if (!dataISO) {
    return "—";
  }

  const [ano, mes, dia] = dataISO.split("-");

  return `${dia}/${mes}/${ano}`;
}

function obterHojeLocalISO() {
  const hoje = new Date();

  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function valorTextoOuTraco(valor) {
  if (!valor || !String(valor).trim()) {
    return "—";
  }

  return valor;
}

function normalizarEmpresaCnpj(cnpj) {
  if (!cnpj) {
    return CNPJ_ALUNO_PARTICULAR;
  }

  return String(cnpj);
}

function nomeEmpresaPorCnpj(cnpj) {
  const cnpjNormalizado = normalizarEmpresaCnpj(cnpj);

  if (cnpjNormalizado === CNPJ_ALUNO_PARTICULAR) {
    return "Aluno particular";
  }

  const empresa = empresasCache.find(
    (item) =>
      String(item.cnpj) === String(cnpjNormalizado)
  );

  return empresa?.nome || "Empresa não encontrada";
}

function obterAlunoSelecionado() {
  const alunoId = selectAluno.value;

  return (
    alunosCache.find(
      (aluno) =>
        String(aluno.id) === String(alunoId)
    ) || null
  );
}

// =====================
// Resumo do aluno
// =====================
function atualizarResumoAluno() {
  const aluno = obterAlunoSelecionado();

  if (!aluno) {
    resumoAluno.style.display = "none";
    nomeAlunoResumo.textContent = "—";
    return;
  }

  resumoAluno.style.display = "block";
  nomeAlunoResumo.textContent = aluno.nome;
}

function preencherResumoDeCursos() {
  if (!selectAluno.value) {
    infoCursosAluno.textContent = "";
    return;
  }

  const matriculasAtivas = matriculasAluno.filter(
    (matricula) => matricula.ativa !== false
  );

  const matriculasInativas = matriculasAluno.filter(
    (matricula) => matricula.ativa === false
  );

  const partes = [];

  if (matriculasAtivas.length > 0) {
    const cursosAtivos = matriculasAtivas.map((matricula) => {
      const curso =
        matricula.materia?.nome || "Curso";

      const empresa = nomeEmpresaPorCnpj(
        matricula.empresa_cnpj
      );

      return `${curso} (${empresa})`;
    });

    partes.push(
      `Cursos ativos deste aluno: ${cursosAtivos.join(", ")}.`
    );
  }

  if (matriculasInativas.length > 0) {
    const cursosInativos = matriculasInativas.map(
      (matricula) => {
        const curso =
          matricula.materia?.nome || "Curso";

        const empresa = nomeEmpresaPorCnpj(
          matricula.empresa_cnpj
        );

        return `${curso} (${empresa})`;
      }
    );

    partes.push(
      `Cursos desmatriculados: ${cursosInativos.join(", ")}.`
    );
  }

  infoCursosAluno.textContent = partes.join(" ");
}

// =====================
// Botão adicionar curso
// =====================
function obterMateriasJaExistentesNoHistorico() {
  return new Set(
    matriculasAluno
      .map((matricula) =>
        String(matricula.materia?.id || "")
      )
      .filter(Boolean)
  );
}

function obterMateriasNuncaMatriculadas() {
  const materiasExistentes =
    obterMateriasJaExistentesNoHistorico();

  return materiasCache.filter(
    (materia) =>
      !materiasExistentes.has(String(materia.id))
  );
}

function alunoAindaPodeReceberNovoCurso() {
  return obterMateriasNuncaMatriculadas().length > 0;
}

function esconderBotaoAdicionarCurso() {
  if (!areaBotaoAdicionarCurso) {
    return;
  }

  areaBotaoAdicionarCurso.style.display = "none";
}

function mostrarBotaoAdicionarCurso() {
  if (!areaBotaoAdicionarCurso) {
    return;
  }

  areaBotaoAdicionarCurso.style.display = "flex";
}

function atualizarVisibilidadeBotaoAdicionarCurso() {
  if (!selectAluno.value) {
    esconderBotaoAdicionarCurso();
    return;
  }

  if (alunoAindaPodeReceberNovoCurso()) {
    mostrarBotaoAdicionarCurso();
  } else {
    esconderBotaoAdicionarCurso();
  }
}

// =====================
// Botão salvar
// =====================
function atualizarTextoBotaoSalvar() {
  if (modoCriacao) {
    btnSalvar.textContent = "Salvar novo curso";
    return;
  }

  if (modoRematriculaEdicao) {
    btnSalvar.textContent = "Salvar rematrícula";
    return;
  }

  btnSalvar.textContent = "Salvar alterações";
}

// =====================
// Preenchimento dos selects
// =====================
function preencherSelectEmpresa(
  valorAtual = CNPJ_ALUNO_PARTICULAR
) {
  const valorNormalizado =
    normalizarEmpresaCnpj(valorAtual);

  empresaCursoSel.innerHTML = "";

  empresaCursoSel.appendChild(
    criarOption(
      CNPJ_ALUNO_PARTICULAR,
      "Aluno particular"
    )
  );

  empresasCache.forEach((empresa) => {
    const cnpj = String(empresa.cnpj || "");

    if (cnpj === CNPJ_ALUNO_PARTICULAR) {
      return;
    }

    empresaCursoSel.appendChild(
      criarOption(cnpj, empresa.nome)
    );
  });

  empresaCursoSel.value = valorNormalizado;
}

function preencherModulosPorMateria(
  materiaId,
  moduloAtual = ""
) {
  moduloSel.innerHTML = "";

  moduloSel.appendChild(
    criarOption("", "Selecione o módulo")
  );

  modulosCache
    .filter(
      (modulo) =>
        String(modulo.materia_id) ===
        String(materiaId)
    )
    .forEach((modulo) => {
      moduloSel.appendChild(
        criarOption(modulo.id, modulo.nome)
      );
    });

  moduloSel.value = moduloAtual || "";
}

function preencherProfessoresPorMateria(
  materiaId,
  professorAtual = ""
) {
  professorSel.innerHTML = "";

  professorSel.appendChild(
    criarOption("", "Selecione o professor(a)")
  );

  const professoresInseridos = new Set();

  professoresCache
    .filter(
      (professor) =>
        String(professor.materia_id) ===
        String(materiaId)
    )
    .forEach((professor) => {
      const professorId = String(professor.id);

      if (professoresInseridos.has(professorId)) {
        return;
      }

      professoresInseridos.add(professorId);

      professorSel.appendChild(
        criarOption(professor.id, professor.nome)
      );
    });

  professorSel.value = professorAtual || "";
}

// =====================
// Limpar área de edição
// =====================
function resetEdicao() {
  modoCriacao = false;
  modoRematriculaEdicao = false;
  matriculaAtual = null;

  blocoEdicao.style.display = "none";
  blocoRematricula.style.display = "none";

  btnDesmatricular.style.display = "none";
  btnDesmatricular.hidden = true;

  tituloEdicao.textContent = "Editar matrícula";
  subtituloEdicao.textContent =
    "Selecione uma matrícula para editar.";

  materiaSel.innerHTML = `
    <option value="">—</option>
  `;

  moduloSel.innerHTML = `
    <option value="">Selecione uma matrícula</option>
  `;

  professorSel.innerHTML = `
    <option value="">Selecione uma matrícula</option>
  `;

  preencherSelectEmpresa(CNPJ_ALUNO_PARTICULAR);

  linkZoomInput.value = "";
  linkYoutubeInput.value = "";

  materiaSel.disabled = true;
  moduloSel.disabled = true;
  professorSel.disabled = true;
  empresaCursoSel.disabled = true;
  linkZoomInput.disabled = true;
  linkYoutubeInput.disabled = true;

  btnSalvar.disabled = true;

  atualizarTextoBotaoSalvar();
  atualizarVisibilidadeBotaoAdicionarCurso();

  infoMatricula.textContent = "—";
  textoRematricula.textContent = "—";
  infoMatriculaInativa.textContent = "—";
}

// =====================
// Sincronização com a agenda
// =====================
async function sincronizarHorariosDaMatricula(
  matriculaId,
  dados
) {
  const atualizacoes = {};

  if (dados.professorId !== undefined) {
    atualizacoes.professor_id = Number(
      dados.professorId
    );
  }

  if (dados.materiaId !== undefined) {
    atualizacoes.materia_id = Number(
      dados.materiaId
    );
  }

  if (dados.moduloId !== undefined) {
    atualizacoes.modulo_id = Number(
      dados.moduloId
    );
  }

  if (dados.ativo !== undefined) {
    atualizacoes.ativo = Boolean(dados.ativo);
  }

  if (Object.keys(atualizacoes).length === 0) {
    return;
  }

  const { error } = await supabase
    .from("aluno_horario_aula")
    .update(atualizacoes)
    .eq("matricula_id", Number(matriculaId));

  if (error) {
    console.error(
      "Erro ao sincronizar horários da matrícula:",
      error
    );

    throw error;
  }
}

async function atualizarMatriculaComAgenda({
  matriculaId,
  dadosMatricula,
  dadosHorarios,
  dadosRollback
}) {
  const { error: erroMatricula } = await supabase
    .from("matricula")
    .update(dadosMatricula)
    .eq("id", Number(matriculaId));

  if (erroMatricula) {
    throw erroMatricula;
  }

  try {
    await sincronizarHorariosDaMatricula(
      matriculaId,
      dadosHorarios
    );
  } catch (erroHorarios) {
    const { error: erroRollback } = await supabase
      .from("matricula")
      .update(dadosRollback)
      .eq("id", Number(matriculaId));

    if (erroRollback) {
      console.error(
        "Não foi possível restaurar a matrícula depois do erro da agenda:",
        erroRollback
      );
    }

    throw erroHorarios;
  }
}

// =====================
// Carregar dados básicos
// =====================
async function carregarBases() {
  const {
    data: materias,
    error: erroMaterias
  } = await supabase
    .from("materia")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (erroMaterias) {
    console.error(erroMaterias);
    mostrarMensagem(
      "Erro ao carregar matérias.",
      false
    );
    return;
  }

  materiasCache = materias || [];

  const {
    data: empresas,
    error: erroEmpresas
  } = await supabase
    .from("empresaparceira")
    .select("cnpj, nome")
    .order("nome", { ascending: true });

  if (erroEmpresas) {
    console.error(erroEmpresas);
    mostrarMensagem(
      "Erro ao carregar empresas.",
      false
    );
    return;
  }

  empresasCache = empresas || [];

  const {
    data: modulos,
    error: erroModulos
  } = await supabase
    .from("modulo")
    .select("id, nome, ordem, materia_id")
    .order("ordem", { ascending: true });

  if (erroModulos) {
    console.error(erroModulos);
    mostrarMensagem(
      "Erro ao carregar módulos.",
      false
    );
    return;
  }

  modulosCache = modulos || [];

  const {
    data: professorMateria,
    error: erroProfessorMateria
  } = await supabase
    .from("professor_materia")
    .select(`
      materia_id,
      professor:professor_id (
        id,
        nome
      )
    `);

  if (erroProfessorMateria) {
    console.error(erroProfessorMateria);
    mostrarMensagem(
      "Erro ao carregar professores.",
      false
    );
    return;
  }

  professoresCache = (professorMateria || [])
    .map((registro) => ({
      id: registro.professor?.id,
      nome: registro.professor?.nome,
      materia_id: registro.materia_id
    }))
    .filter(
      (professor) =>
        professor.id &&
        professor.nome &&
        professor.materia_id
    )
    .sort((professorA, professorB) =>
      professorA.nome.localeCompare(
        professorB.nome
      )
    );

  const {
    data: alunos,
    error: erroAlunos
  } = await supabase
    .from("aluno")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (erroAlunos) {
    console.error(erroAlunos);
    mostrarMensagem(
      "Erro ao carregar alunos.",
      false
    );
    return;
  }

  alunosCache = alunos || [];

  selectAluno.innerHTML = `
    <option value="">Selecione o aluno</option>
  `;

  alunosCache.forEach((aluno) => {
    selectAluno.appendChild(
      criarOption(aluno.id, aluno.nome)
    );
  });

  const alunoPreSelecionado =
    localStorage.getItem(
      "alunoSelecionadoAdmin"
    );

  if (alunoPreSelecionado) {
    const alunoExiste = alunosCache.some(
      (aluno) =>
        String(aluno.id) ===
        String(alunoPreSelecionado)
    );

    if (alunoExiste) {
      selectAluno.value = alunoPreSelecionado;

      selectAluno.dispatchEvent(
        new Event("change")
      );
    }

    localStorage.removeItem(
      "alunoSelecionadoAdmin"
    );
  }
}

// =====================
// Carregar matrículas
// =====================
async function carregarMatriculasDoAluno(alunoId) {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      ativa,
      data_inicio,
      data_fim,
      link_zoom,
      link_youtube,
      empresa_cnpj,
      aluno:aluno_id (
        id,
        nome
      ),
      materia:materia_id (
        id,
        nome
      ),
      modulo:modulo_id (
        id,
        nome
      ),
      professor:professor_id (
        id,
        nome
      )
    `)
    .eq("aluno_id", alunoId)
    .order("id", { ascending: true });

  if (error) {
    console.error(error);

    mostrarMensagem(
      "Erro ao carregar matrículas do aluno.",
      false
    );

    return [];
  }

  return data || [];
}

function preencherSelectMatriculas() {
  selectMatricula.innerHTML = `
    <option value="">Selecione um curso</option>
  `;

  if (matriculasAluno.length === 0) {
    selectMatricula.innerHTML = `
      <option value="">
        Nenhuma matrícula encontrada
      </option>
    `;

    selectMatricula.disabled = true;
    return;
  }

  matriculasAluno.forEach((matricula) => {
    const status =
      matricula.ativa === false
        ? " (desmatriculado)"
        : "";

    const empresa = nomeEmpresaPorCnpj(
      matricula.empresa_cnpj
    );

    const materia =
      matricula.materia?.nome || "Curso";

    const modulo =
      matricula.modulo?.nome || "Sem módulo";

    const professor =
      matricula.professor?.nome ||
      "Sem professor";

    const label =
      `${materia} — ${modulo} — ` +
      `Prof(a). ${professor} — ` +
      `${empresa}${status}`;

    selectMatricula.appendChild(
      criarOption(matricula.id, label)
    );
  });

  selectMatricula.disabled = false;
}

// =====================
// Edição de matrícula ativa
// =====================
function preencherEdicaoDaMatricula(matricula) {
  modoCriacao = false;
  modoRematriculaEdicao = false;
  matriculaAtual = matricula;

  blocoRematricula.style.display = "none";
  blocoEdicao.style.display = "block";

  atualizarVisibilidadeBotaoAdicionarCurso();

  if (matricula.ativa === false) {
    btnDesmatricular.style.display = "none";
    btnDesmatricular.hidden = true;
  } else {
    btnDesmatricular.style.display =
      "inline-block";

    btnDesmatricular.hidden = false;
  }

  tituloEdicao.textContent =
    "Editar matrícula";

  subtituloEdicao.textContent =
    `Curso selecionado: ${
      matricula.materia?.nome || "—"
    }`;

  materiaSel.innerHTML = "";

  materiaSel.appendChild(
    criarOption(
      matricula.materia?.id || "",
      matricula.materia?.nome || "—"
    )
  );

  const materiaId =
    matricula.materia?.id;

  preencherModulosPorMateria(
    materiaId,
    matricula.modulo?.id || ""
  );

  preencherProfessoresPorMateria(
    materiaId,
    matricula.professor?.id || ""
  );

  preencherSelectEmpresa(
    matricula.empresa_cnpj ||
      CNPJ_ALUNO_PARTICULAR
  );

  linkZoomInput.value =
    matricula.link_zoom || "";

  linkYoutubeInput.value =
    matricula.link_youtube || "";

  materiaSel.disabled = true;
  moduloSel.disabled = false;
  professorSel.disabled = false;
  empresaCursoSel.disabled = false;
  linkZoomInput.disabled = false;
  linkYoutubeInput.disabled = false;
  btnSalvar.disabled = false;

  atualizarTextoBotaoSalvar();

  const inicio = formatarDataBR(
    matricula.data_inicio
  );

  const fim = matricula.data_fim
    ? formatarDataBR(matricula.data_fim)
    : "—";

  const empresa = nomeEmpresaPorCnpj(
    matricula.empresa_cnpj
  );

  infoMatricula.innerHTML = `
    <strong>Status:</strong> Ativo |
    <strong>Início:</strong> ${inicio} |
    <strong>Fim:</strong> ${fim} |
    <strong>Empresa:</strong> ${empresa}
  `;
}

// =====================
// Matrícula desmatriculada
// =====================
function preencherBlocoRematricula(matricula) {
  modoCriacao = false;
  modoRematriculaEdicao = false;
  matriculaAtual = matricula;

  blocoEdicao.style.display = "none";
  blocoRematricula.style.display = "block";

  btnDesmatricular.style.display = "none";
  btnDesmatricular.hidden = true;

  esconderBotaoAdicionarCurso();

  const inicio = formatarDataBR(
    matricula.data_inicio
  );

  const fim = matricula.data_fim
    ? formatarDataBR(matricula.data_fim)
    : "—";

  const empresa = nomeEmpresaPorCnpj(
    matricula.empresa_cnpj
  );

  textoRematricula.innerHTML = `
    Este curso está desmatriculado no momento.
    <br>
    <strong>
      Após a rematrícula, você poderá editar
      módulo, professor(a), empresa e links.
    </strong>
  `;

  infoMatriculaInativa.innerHTML = `
    <strong>
      Últimos dados salvos nesta matrícula:
    </strong>
    <br>

    Curso:
    ${matricula.materia?.nome || "—"} |

    Módulo anterior:
    ${matricula.modulo?.nome || "—"} |

    Professor anterior:
    ${matricula.professor?.nome || "—"} |

    Empresa:
    ${empresa} |

    Início:
    ${inicio} |

    Fim:
    ${fim}

    <br><br>

    <strong>Link Zoom:</strong>
    ${valorTextoOuTraco(
      matricula.link_zoom
    )}

    <br>

    <strong>Link YouTube:</strong>
    ${valorTextoOuTraco(
      matricula.link_youtube
    )}
  `;
}

// =====================
// Adicionar novo curso
// =====================
function entrarModoCriacao() {
  const alunoId = selectAluno.value;

  if (!alunoId) {
    mostrarMensagem(
      "Selecione um aluno antes.",
      false
    );

    return;
  }

  const materiasDisponiveis =
    obterMateriasNuncaMatriculadas();

  if (materiasDisponiveis.length === 0) {
    mostrarMensagem(
      "Este aluno já possui histórico em todos os cursos disponíveis. Para um curso desmatriculado, use a rematrícula.",
      false
    );

    atualizarVisibilidadeBotaoAdicionarCurso();
    return;
  }

  modoCriacao = true;
  modoRematriculaEdicao = false;
  matriculaAtual = null;

  blocoRematricula.style.display = "none";
  blocoEdicao.style.display = "block";

  btnDesmatricular.style.display = "none";
  btnDesmatricular.hidden = true;

  atualizarVisibilidadeBotaoAdicionarCurso();

  tituloEdicao.textContent =
    "Adicionar novo curso";

  subtituloEdicao.textContent =
    "Use esta opção apenas para um curso que o aluno nunca teve antes.";

  materiaSel.disabled = false;
  moduloSel.disabled = true;
  professorSel.disabled = true;
  empresaCursoSel.disabled = false;
  linkZoomInput.disabled = false;
  linkYoutubeInput.disabled = false;
  btnSalvar.disabled = false;

  materiaSel.innerHTML = `
    <option value="">
      Selecione a matéria
    </option>
  `;

  materiasDisponiveis.forEach((materia) => {
    materiaSel.appendChild(
      criarOption(materia.id, materia.nome)
    );
  });

  moduloSel.innerHTML = `
    <option value="">
      Selecione a matéria primeiro
    </option>
  `;

  professorSel.innerHTML = `
    <option value="">
      Selecione a matéria primeiro
    </option>
  `;

  preencherSelectEmpresa(
    CNPJ_ALUNO_PARTICULAR
  );

  linkZoomInput.value = "";
  linkYoutubeInput.value = "";

  infoMatricula.textContent =
    "Novo curso ainda não salvo.";

  selectMatricula.value = "";

  atualizarTextoBotaoSalvar();
}

// =====================
// Preparar rematrícula
// =====================
function entrarModoEdicaoRematricula(
  matricula
) {
  modoCriacao = false;
  modoRematriculaEdicao = true;
  matriculaAtual = matricula;

  blocoRematricula.style.display = "none";
  blocoEdicao.style.display = "block";

  btnDesmatricular.style.display = "none";
  btnDesmatricular.hidden = true;

  esconderBotaoAdicionarCurso();

  tituloEdicao.textContent =
    "Rematricular curso";

  subtituloEdicao.textContent =
    `Curso selecionado: ${
      matricula.materia?.nome || "—"
    }`;

  materiaSel.innerHTML = "";

  materiaSel.appendChild(
    criarOption(
      matricula.materia?.id || "",
      matricula.materia?.nome || "—"
    )
  );

  const materiaId =
    matricula.materia?.id;

  preencherModulosPorMateria(
    materiaId,
    matricula.modulo?.id || ""
  );

  preencherProfessoresPorMateria(
    materiaId,
    matricula.professor?.id || ""
  );

  preencherSelectEmpresa(
    matricula.empresa_cnpj ||
      CNPJ_ALUNO_PARTICULAR
  );

  linkZoomInput.value =
    matricula.link_zoom || "";

  linkYoutubeInput.value =
    matricula.link_youtube || "";

  materiaSel.disabled = true;
  moduloSel.disabled = false;
  professorSel.disabled = false;
  empresaCursoSel.disabled = false;
  linkZoomInput.disabled = false;
  linkYoutubeInput.disabled = false;
  btnSalvar.disabled = false;

  atualizarTextoBotaoSalvar();

  const inicio = formatarDataBR(
    matricula.data_inicio
  );

  const fim = matricula.data_fim
    ? formatarDataBR(matricula.data_fim)
    : "—";

  const empresa = nomeEmpresaPorCnpj(
    matricula.empresa_cnpj
  );

  infoMatricula.innerHTML = `
    <strong>Status anterior:</strong>
    Desmatriculado |

    <strong>Início anterior:</strong>
    ${inicio} |

    <strong>Fim anterior:</strong>
    ${fim} |

    <strong>Empresa anterior:</strong>
    ${empresa}
  `;
}

// =====================
// Mudança da matéria
// =====================
materiaSel.addEventListener("change", () => {
  if (!modoCriacao) {
    return;
  }

  const materiaId = materiaSel.value;

  moduloSel.innerHTML = "";
  professorSel.innerHTML = "";

  if (!materiaId) {
    moduloSel.disabled = true;
    professorSel.disabled = true;

    moduloSel.appendChild(
      criarOption(
        "",
        "Selecione a matéria primeiro"
      )
    );

    professorSel.appendChild(
      criarOption(
        "",
        "Selecione a matéria primeiro"
      )
    );

    return;
  }

  preencherModulosPorMateria(materiaId);
  preencherProfessoresPorMateria(materiaId);

  moduloSel.disabled = false;
  professorSel.disabled = false;
});

// =====================
// Selecionar aluno
// =====================
selectAluno.addEventListener(
  "change",
  async () => {
    const alunoId = selectAluno.value;

    resetEdicao();
    atualizarResumoAluno();

    if (!alunoId) {
      selectMatricula.disabled = true;

      selectMatricula.innerHTML = `
        <option value="">
          Selecione um aluno acima
        </option>
      `;

      infoCursosAluno.textContent = "";
      esconderBotaoAdicionarCurso();

      return;
    }

    matriculasAluno =
      await carregarMatriculasDoAluno(
        alunoId
      );

    preencherSelectMatriculas();
    preencherResumoDeCursos();
    atualizarVisibilidadeBotaoAdicionarCurso();
  }
);

// =====================
// Selecionar matrícula
// =====================
selectMatricula.addEventListener(
  "change",
  () => {
    const matriculaId =
      selectMatricula.value;

    resetEdicao();

    if (!matriculaId) {
      return;
    }

    const matricula =
      matriculasAluno.find(
        (item) =>
          String(item.id) ===
          String(matriculaId)
      );

    if (!matricula) {
      return;
    }

    if (matricula.ativa === false) {
      preencherBlocoRematricula(
        matricula
      );
    } else {
      preencherEdicaoDaMatricula(
        matricula
      );
    }
  }
);

// =====================
// Botão adicionar curso
// =====================
btnAddCurso.addEventListener(
  "click",
  entrarModoCriacao
);

// =====================
// Desmatricular
// =====================
btnDesmatricular.addEventListener(
  "click",
  async () => {
    if (!matriculaAtual) {
      mostrarMensagem(
        "Selecione uma matrícula antes.",
        false
      );

      return;
    }

    const confirmar = confirm(
      "Deseja realmente desmatricular este aluno deste curso? Os horários fixos desta matrícula serão desativados na agenda."
    );

    if (!confirmar) {
      return;
    }

    const hojeISO = obterHojeLocalISO();
    const alunoId = selectAluno.value;
    const matriculaId =
      matriculaAtual.id;

    btnDesmatricular.disabled = true;
    btnDesmatricular.textContent =
      "Desmatriculando...";

    try {
      await atualizarMatriculaComAgenda({
        matriculaId,
        dadosMatricula: {
          ativa: false,
          data_fim: hojeISO
        },
        dadosHorarios: {
          ativo: false
        },
        dadosRollback: {
          ativa:
            matriculaAtual.ativa !== false,
          data_fim:
            matriculaAtual.data_fim || null
        }
      });

      mostrarMensagem(
        "Curso desmatriculado e horários desativados com sucesso."
      );

      matriculasAluno =
        await carregarMatriculasDoAluno(
          alunoId
        );

      preencherSelectMatriculas();
      preencherResumoDeCursos();
      atualizarVisibilidadeBotaoAdicionarCurso();

      selectMatricula.value =
        matriculaId;

      const matriculaAtualizada =
        matriculasAluno.find(
          (item) =>
            String(item.id) ===
            String(matriculaId)
        );

      if (matriculaAtualizada) {
        preencherBlocoRematricula(
          matriculaAtualizada
        );
      }
    } catch (error) {
      console.error(error);

      mostrarMensagem(
        "Não foi possível desmatricular porque a matrícula e a agenda precisam ser atualizadas juntas.",
        false
      );
    } finally {
      btnDesmatricular.disabled = false;
      btnDesmatricular.textContent =
        "Desmatricular";
    }
  }
);

// =====================
// Rematricular
// =====================
btnRematricular.addEventListener(
  "click",
  () => {
    if (!matriculaAtual) {
      mostrarMensagem(
        "Selecione um curso desmatriculado.",
        false
      );

      return;
    }

    const matriculaAtualizada =
      matriculasAluno.find(
        (item) =>
          String(item.id) ===
          String(matriculaAtual.id)
      );

    if (!matriculaAtualizada) {
      mostrarMensagem(
        "Não foi possível carregar esta matrícula.",
        false
      );

      return;
    }

    entrarModoEdicaoRematricula(
      matriculaAtualizada
    );
  }
);

// =====================
// Salvar formulário
// =====================
formEditar.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const alunoId = selectAluno.value;

    if (!alunoId) {
      mostrarMensagem(
        "Selecione um aluno.",
        false
      );

      return;
    }

    const hojeISO = obterHojeLocalISO();

    // =====================
    // Criar novo curso
    // =====================
    if (modoCriacao) {
      const materiaId = materiaSel.value;
      const moduloId = moduloSel.value;
      const professorId =
        professorSel.value;

      const empresaCnpj =
        empresaCursoSel.value ||
        CNPJ_ALUNO_PARTICULAR;

      const linkZoom =
        linkZoomInput.value.trim();

      const linkYoutube =
        linkYoutubeInput.value.trim();

      if (
        !materiaId ||
        !moduloId ||
        !professorId
      ) {
        mostrarMensagem(
          "Preencha matéria, módulo e professor(a).",
          false
        );

        return;
      }

      const materiaJaExiste =
        matriculasAluno.some(
          (matricula) =>
            String(
              matricula.materia?.id
            ) === String(materiaId)
        );

      if (materiaJaExiste) {
        mostrarMensagem(
          "Este aluno já possui histórico nesta matéria. Use a matrícula existente ou a rematrícula.",
          false
        );

        return;
      }

      btnSalvar.disabled = true;
      btnSalvar.textContent =
        "Salvando novo curso...";

      const { error } = await supabase
        .from("matricula")
        .insert([
          {
            aluno_id: Number(alunoId),
            materia_id: Number(materiaId),
            modulo_id: Number(moduloId),
            professor_id: Number(
              professorId
            ),
            empresa_cnpj: empresaCnpj,
            link_zoom:
              linkZoom || null,
            link_youtube:
              linkYoutube || null,
            data_inicio: hojeISO,
            data_fim: null,
            ativa: true
          }
        ]);

      btnSalvar.disabled = false;
      atualizarTextoBotaoSalvar();

      if (error) {
        console.error(error);

        mostrarMensagem(
          "Erro ao adicionar curso.",
          false
        );

        return;
      }

      mostrarMensagem(
        "Novo curso adicionado com sucesso."
      );

      matriculasAluno =
        await carregarMatriculasDoAluno(
          alunoId
        );

      preencherSelectMatriculas();
      preencherResumoDeCursos();
      atualizarVisibilidadeBotaoAdicionarCurso();
      resetEdicao();

      return;
    }

    // =====================
    // Verificar matrícula
    // =====================
    if (!matriculaAtual) {
      mostrarMensagem(
        "Selecione uma matrícula para editar.",
        false
      );

      return;
    }

    const novoModuloId =
      moduloSel.value;

    const novoProfessorId =
      professorSel.value;

    const novaEmpresaCnpj =
      empresaCursoSel.value ||
      CNPJ_ALUNO_PARTICULAR;

    const novoLinkZoom =
      linkZoomInput.value.trim();

    const novoLinkYoutube =
      linkYoutubeInput.value.trim();

    if (
      !novoModuloId ||
      !novoProfessorId
    ) {
      mostrarMensagem(
        "Selecione módulo e professor(a).",
        false
      );

      return;
    }

    const matriculaId =
      matriculaAtual.id;

    const materiaIdAtual =
      matriculaAtual.materia?.id;

    // =====================
    // Salvar rematrícula
    // =====================
    if (modoRematriculaEdicao) {
      btnSalvar.disabled = true;
      btnSalvar.textContent =
        "Salvando rematrícula...";

      try {
        await atualizarMatriculaComAgenda({
          matriculaId,

          dadosMatricula: {
            ativa: true,
            data_fim: null,
            data_inicio: hojeISO,
            modulo_id: Number(
              novoModuloId
            ),
            professor_id: Number(
              novoProfessorId
            ),
            empresa_cnpj:
              novaEmpresaCnpj,
            link_zoom:
              novoLinkZoom || null,
            link_youtube:
              novoLinkYoutube || null
          },

          dadosHorarios: {
            professorId:
              novoProfessorId,
            materiaId:
              materiaIdAtual,
            moduloId:
              novoModuloId,
            ativo: true
          },

          dadosRollback: {
            ativa:
              matriculaAtual.ativa !==
              false,

            data_fim:
              matriculaAtual.data_fim ||
              null,

            data_inicio:
              matriculaAtual.data_inicio ||
              null,

            modulo_id: Number(
              matriculaAtual.modulo?.id
            ),

            professor_id: Number(
              matriculaAtual.professor?.id
            ),

            empresa_cnpj:
              normalizarEmpresaCnpj(
                matriculaAtual.empresa_cnpj
              ),

            link_zoom:
              matriculaAtual.link_zoom ||
              null,

            link_youtube:
              matriculaAtual.link_youtube ||
              null
          }
        });

        mostrarMensagem(
          "Rematrícula salva e horários da agenda reativados com sucesso."
        );

        matriculasAluno =
          await carregarMatriculasDoAluno(
            alunoId
          );

        preencherSelectMatriculas();
        preencherResumoDeCursos();
        atualizarVisibilidadeBotaoAdicionarCurso();

        selectMatricula.value =
          matriculaId;

        const matriculaAtualizada =
          matriculasAluno.find(
            (item) =>
              String(item.id) ===
              String(matriculaId)
          );

        if (matriculaAtualizada) {
          preencherEdicaoDaMatricula(
            matriculaAtualizada
          );
        }
      } catch (error) {
        console.error(error);

        mostrarMensagem(
          "Não foi possível salvar a rematrícula porque a matrícula e a agenda precisam ser atualizadas juntas.",
          false
        );
      } finally {
        btnSalvar.disabled = false;
        atualizarTextoBotaoSalvar();
      }

      return;
    }

    // =====================
    // Salvar edição normal
    // =====================
    btnSalvar.disabled = true;
    btnSalvar.textContent =
      "Salvando alterações...";

    try {
      await atualizarMatriculaComAgenda({
        matriculaId,

        dadosMatricula: {
          modulo_id: Number(
            novoModuloId
          ),

          professor_id: Number(
            novoProfessorId
          ),

          empresa_cnpj:
            novaEmpresaCnpj,

          link_zoom:
            novoLinkZoom || null,

          link_youtube:
            novoLinkYoutube || null
        },

        dadosHorarios: {
          professorId:
            novoProfessorId,

          materiaId:
            materiaIdAtual,

          moduloId:
            novoModuloId,

          ativo: true
        },

        dadosRollback: {
          modulo_id: Number(
            matriculaAtual.modulo?.id
          ),

          professor_id: Number(
            matriculaAtual.professor?.id
          ),

          empresa_cnpj:
            normalizarEmpresaCnpj(
              matriculaAtual.empresa_cnpj
            ),

          link_zoom:
            matriculaAtual.link_zoom ||
            null,

          link_youtube:
            matriculaAtual.link_youtube ||
            null
        }
      });

      mostrarMensagem(
        "Alterações salvas e agenda atualizada com sucesso."
      );

      matriculasAluno =
        await carregarMatriculasDoAluno(
          alunoId
        );

      preencherSelectMatriculas();
      preencherResumoDeCursos();
      atualizarVisibilidadeBotaoAdicionarCurso();

      selectMatricula.value =
        matriculaId;

      const matriculaAtualizada =
        matriculasAluno.find(
          (item) =>
            String(item.id) ===
            String(matriculaId)
        );

      if (matriculaAtualizada) {
        preencherEdicaoDaMatricula(
          matriculaAtualizada
        );
      }
    } catch (error) {
      console.error(error);

      mostrarMensagem(
        "Não foi possível salvar porque a matrícula e a agenda precisam ser atualizadas juntas.",
        false
      );
    } finally {
      btnSalvar.disabled = false;
      atualizarTextoBotaoSalvar();
    }
  }
);

// =====================
// Inicialização
// =====================
esconderBotaoAdicionarCurso();

await carregarBases();