import { carregarHorariosDoDia, dataAgendaISO } from "./agenda-professor-dados.js";

function agruparHorarios(horarios) {
  const grupos = new Map();
  for (const horario of horarios) {
    const { matricula } = horario;
    const equipe = matricula?.empresa?.tipo_cadastro === "equipe";
    const chave = equipe
      ? [matricula.empresa_cnpj, horario.materia_id, horario.modulo_id, horario.hora_inicio, horario.hora_fim].join("|")
      : String(horario.id);

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        titulo: equipe ? matricula.empresa.nome : horario.aluno?.nome || "Aluno",
        horarios: []
      });
    }
    grupos.get(chave).horarios.push(horario);
  }
  return [...grupos.values()];
}

function linkReuniao(horarios) {
  const links = new Set(horarios.map(({ matricula }) => matricula?.link_zoom?.trim()).filter(Boolean));
  if (links.size !== 1) return null;

  try {
    const url = new URL(links.values().next().value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function criarCard({ titulo, horarios }, dataISO) {
  const primeiro = horarios[0];
  const pendentes = horarios.filter((horario) => !horario.registrada);
  const ausencias = horarios.filter((horario) => horario.aviso_ausencia);
  const card = document.createElement("li");
  card.className = "agenda-hoje-aula";

  const hora = document.createElement("span");
  hora.className = "agenda-hoje-hora";
  hora.textContent = [primeiro.hora_inicio, primeiro.hora_fim]
    .filter(Boolean).map((valor) => valor.slice(0, 5)).join("–");

  const corpo = document.createElement("div");
  const nome = document.createElement("h3");
  nome.textContent = titulo;
  corpo.append(nome);

  const curso = document.createElement("p");
  curso.textContent = [primeiro.materia?.nome, primeiro.modulo?.nome].filter(Boolean).join(" · ");
  if (curso.textContent) corpo.append(curso);

  if (ausencias.length) {
    const aviso = document.createElement("p");
    aviso.className = "agenda-hoje-ausencia";
    const nomes = ausencias.map((horario) => horario.aluno?.nome || "Aluno");
    aviso.textContent = nomes.length === 1
      ? `${nomes[0]} avisou que vai faltar.`
      : `${new Intl.ListFormat("pt-BR").format(nomes)} avisaram que vão faltar.`;
    corpo.append(aviso);
  }

  const acoes = document.createElement("div");
  acoes.className = "agenda-hoje-acoes";
  if (!pendentes.length) {
    const concluida = document.createElement("span");
    concluida.className = "agenda-hoje-registrada";
    concluida.textContent = "Aula registrada";
    acoes.append(concluida);
  } else if (pendentes.length < horarios.length) {
    const parcial = document.createElement("span");
    parcial.textContent = "Registro parcial";
    const conferir = document.createElement("a");
    conferir.href = "agenda-professor.html";
    conferir.textContent = "Conferir na agenda";
    acoes.append(parcial, conferir);
  } else {
    const reuniao = linkReuniao(horarios);
    if (reuniao) {
      const abrir = document.createElement("a");
      abrir.href = reuniao;
      abrir.target = "_blank";
      abrir.rel = "noopener noreferrer";
      abrir.textContent = "Abrir aula";
      acoes.append(abrir);
    }

    const params = new URLSearchParams({ origem: "agenda-hoje", data: dataISO });
    for (const horario of pendentes) {
      if (horario.matricula_id) params.append("matricula", horario.matricula_id);
    }
    const registrar = document.createElement("a");
    registrar.href = `registrar-aula.html?${params}`;
    registrar.className = "agenda-hoje-registrar";
    registrar.textContent = "Registrar aula";
    acoes.append(registrar);
  }
  card.append(hora, corpo, acoes);
  return card;
}

export async function iniciarAgendaHoje(professorId) {
  const lista = document.getElementById("agenda-hoje-lista");
  const status = document.getElementById("agenda-hoje-status");

  try {
    const dataISO = dataAgendaISO();
    const horarios = await carregarHorariosDoDia(professorId, dataISO);
    const grupos = agruparHorarios(horarios);
    if (!grupos.length) {
      status.textContent = "Nenhuma aula regular prevista para hoje.";
      return;
    }

    lista.replaceChildren(...grupos.map((grupo) => criarCard(grupo, dataISO)));
    lista.hidden = false;
    status.hidden = true;
  } catch (erro) {
    console.error("Erro ao carregar agenda de hoje:", erro);
    status.textContent = "Não foi possível carregar as aulas de hoje.";
  }
}
