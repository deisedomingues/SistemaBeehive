import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

// ===============================
// ELEMENTOS
// ===============================

const btnVoltar = document.getElementById("btnVoltar");
const msg = document.getElementById("msg");

const formPacote = document.getElementById("formPacote");
const alunoSelect = document.getElementById("alunoSelect");
const materiaSelect = document.getElementById("materiaSelect");
const quantidadeAulas = document.getElementById("quantidadeAulas");
const dataInicio = document.getElementById("dataInicio");
const observacao = document.getElementById("observacao");

const listaPacotes = document.getElementById("listaPacotes");
const btnRecarregar = document.getElementById("btnRecarregar");

// ===============================
// ESTADO
// ===============================

let matriculas = [];

// ===============================
// FUNÇÕES AUXILIARES
// ===============================

function mostrarMensagem(texto, ok = true) {
  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";
  msg.style.padding = "10px 12px";
  msg.style.borderRadius = "10px";

  setTimeout(() => {
    msg.style.display = "none";
  }, 2600);
}

function hojeISO() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function formatarDataBR(dataISO) {
  if (!dataISO) return "-";
  const [yyyy, mm, dd] = dataISO.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

function escaparHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function voltar() {
  window.location.href = "home-admin.html";
}

// ===============================
// CARREGAR MATRÍCULAS
// ===============================

async function carregarMatriculas() {
  alunoSelect.innerHTML = `<option value="">Carregando alunos...</option>`;
  materiaSelect.innerHTML = `<option value="">Selecione primeiro o aluno</option>`;
  materiaSelect.disabled = true;

  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno_id,
      materia_id,
      ativa,
      aluno:aluno_id (
        id,
        nome
      ),
      materia:materia_id (
        id,
        nome
      )
    `)
    .eq("ativa", true);

  if (error) {
    console.error(error);
    alunoSelect.innerHTML = `<option value="">Erro ao carregar alunos</option>`;
    mostrarMensagem("Erro ao carregar alunos e matrículas.", false);
    return;
  }

  matriculas = data || [];

  const alunosMap = new Map();

  matriculas.forEach((m) => {
    if (!m.aluno?.id) return;

    alunosMap.set(Number(m.aluno.id), {
      id: Number(m.aluno.id),
      nome: m.aluno.nome || "Aluno sem nome"
    });
  });

  const alunos = Array.from(alunosMap.values())
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  alunoSelect.innerHTML = `<option value="">Selecione o aluno</option>`;

  alunos.forEach((aluno) => {
    const opt = document.createElement("option");
    opt.value = aluno.id;
    opt.textContent = aluno.nome;
    alunoSelect.appendChild(opt);
  });

  if (!alunos.length) {
    alunoSelect.innerHTML = `<option value="">Nenhum aluno com matrícula ativa</option>`;
  }
}

function carregarMateriasDoAluno(alunoId) {
  materiaSelect.innerHTML = `<option value="">Selecione o curso</option>`;

  if (!alunoId) {
    materiaSelect.disabled = true;
    materiaSelect.innerHTML = `<option value="">Selecione primeiro o aluno</option>`;
    return;
  }

  const materiasMap = new Map();

  matriculas
    .filter((m) => Number(m.aluno_id) === Number(alunoId))
    .forEach((m) => {
      if (!m.materia?.id) return;

      materiasMap.set(Number(m.materia.id), {
        id: Number(m.materia.id),
        nome: m.materia.nome || "Curso sem nome"
      });
    });

  const materias = Array.from(materiasMap.values())
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  if (!materias.length) {
    materiaSelect.disabled = true;
    materiaSelect.innerHTML = `<option value="">Aluno sem curso ativo</option>`;
    return;
  }

  materias.forEach((materia) => {
    const opt = document.createElement("option");
    opt.value = materia.id;
    opt.textContent = materia.nome;
    materiaSelect.appendChild(opt);
  });

  materiaSelect.disabled = false;
}

// ===============================
// VERIFICAR PACOTE ATIVO
// ===============================

async function buscarPacoteAtivo(alunoId, materiaId) {
  const { data, error } = await supabase
    .from("pacote_aulas")
    .select(`
      id,
      aluno_id,
      materia_id,
      quantidade_aulas,
      data_inicio,
      data_fim,
      status,
      observacao
    `)
    .eq("aluno_id", alunoId)
    .eq("materia_id", materiaId)
    .eq("status", "Ativo")
    .maybeSingle();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

// ===============================
// SALVAR PACOTE
// ===============================

async function salvarPacote(e) {
  e.preventDefault();

  const alunoId = Number(alunoSelect.value);
  const materiaId = Number(materiaSelect.value);
  const qtd = Number(quantidadeAulas.value);
  const inicio = dataInicio.value;
  const obs = observacao.value.trim();

  if (!alunoId || !materiaId || !qtd || !inicio) {
    mostrarMensagem("Preencha aluno, curso, quantidade e data de início.", false);
    return;
  }

  if (qtd <= 0) {
    mostrarMensagem("A quantidade de aulas precisa ser maior que zero.", false);
    return;
  }

  try {
    const pacoteAtivo = await buscarPacoteAtivo(alunoId, materiaId);

    if (pacoteAtivo) {
      mostrarMensagem(
        "Este aluno já possui um pacote ativo para este curso. Encerre o pacote atual antes de cadastrar uma renovação.",
        false
      );
      return;
    }

    const { error } = await supabase
      .from("pacote_aulas")
      .insert([
        {
          aluno_id: alunoId,
          materia_id: materiaId,
          quantidade_aulas: qtd,
          data_inicio: inicio,
          data_fim: null,
          status: "Ativo",
          observacao: obs || null
        }
      ]);

    if (error) {
      console.error(error);
      mostrarMensagem("Erro ao salvar pacote de aulas.", false);
      return;
    }

    mostrarMensagem("Pacote cadastrado com sucesso!");

    formPacote.reset();
    quantidadeAulas.value = 36;
    dataInicio.value = hojeISO();
    materiaSelect.disabled = true;
    materiaSelect.innerHTML = `<option value="">Selecione primeiro o aluno</option>`;

    await carregarPacotes();

  } catch (erro) {
    console.error(erro);
    mostrarMensagem("Erro inesperado ao salvar pacote.", false);
  }
}

// ===============================
// LISTAR PACOTES
// ===============================

async function carregarPacotes() {
  listaPacotes.innerHTML = `<p style="font-size:13px; opacity:0.8;">Carregando pacotes...</p>`;

  const { data, error } = await supabase
    .from("pacote_aulas")
    .select(`
      id,
      aluno_id,
      materia_id,
      quantidade_aulas,
      data_inicio,
      data_fim,
      status,
      observacao,
      created_at,
      aluno:aluno_id (
        nome
      ),
      materia:materia_id (
        nome
      )
    `)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error(error);
    listaPacotes.innerHTML = `<p style="font-size:13px; color:#b71c1c;">Erro ao carregar pacotes.</p>`;
    return;
  }

  const pacotes = data || [];

  if (!pacotes.length) {
    listaPacotes.innerHTML = `<p style="font-size:13px; opacity:0.8;">Nenhum pacote cadastrado ainda.</p>`;
    return;
  }

  listaPacotes.innerHTML = pacotes.map((p) => {
    const statusCor =
      p.status === "Ativo"
        ? "#1b5e20"
        : p.status === "Encerrado"
          ? "#555"
          : "#b71c1c";

    return `
      <div
        style="
          padding:12px 0;
          border-bottom:1px solid #e6dfcf;
          display:flex;
          flex-direction:column;
          gap:5px;
        "
      >
        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <strong>${escaparHtml(p.aluno?.nome || "Aluno")}</strong>
          <span style="font-size:12px; font-weight:700; color:${statusCor};">
            ${escaparHtml(p.status || "-")}
          </span>
        </div>

        <div style="font-size:13px;">
          ${escaparHtml(p.materia?.nome || "Curso")} •
          ${Number(p.quantidade_aulas || 0)} aulas
        </div>

        <div style="font-size:12px; opacity:0.85;">
          Início: ${formatarDataBR(p.data_inicio)}
          ${
            p.data_fim
              ? ` • Fim: ${formatarDataBR(p.data_fim)}`
              : " • Fim: em aberto"
          }
        </div>

        ${
          p.observacao
            ? `<div style="font-size:12px; opacity:0.85;">Obs: ${escaparHtml(p.observacao)}</div>`
            : ""
        }
      </div>
    `;
  }).join("");
}

// ===============================
// EVENTOS
// ===============================

btnVoltar?.addEventListener("click", voltar);

alunoSelect?.addEventListener("change", () => {
  carregarMateriasDoAluno(alunoSelect.value);
});

formPacote?.addEventListener("submit", salvarPacote);

btnRecarregar?.addEventListener("click", carregarPacotes);

// ===============================
// INIT
// ===============================

async function init() {
  dataInicio.value = hojeISO();
  quantidadeAulas.value = 36;

  await carregarMatriculas();
  await carregarPacotes();
}

init();