import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const professorSelect = document.getElementById("professor");
const listaMaterias = document.getElementById("listaMaterias");
const recorrenteInput = document.getElementById("recorrente");
const dataInicioInput = document.getElementById("dataInicio");
const dataFimInput = document.getElementById("dataFim");
const grupoDataFim = document.getElementById("grupoDataFim");
const faixasContainer = document.getElementById("faixasContainer");
const addFaixaBtn = document.getElementById("addFaixa");
const form = document.getElementById("formHorario");
const btnSalvar = document.getElementById("btnSalvar");
const msg = document.getElementById("msg");

const DIAS = [
  { valor: 1, nome: "Segunda" },
  { valor: 2, nome: "Terça" },
  { valor: 3, nome: "Quarta" },
  { valor: 4, nome: "Quinta" },
  { valor: 5, nome: "Sexta" },
  { valor: 6, nome: "Sábado" }
];

function mostrarMensagem(texto, erro = false) {
  msg.textContent = texto;
  msg.style.color = erro ? "#b42318" : "#027a48";
  msg.style.fontWeight = "bold";
}

function formatarISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return ano + "-" + mes + "-" + dia;
}

function parseDataLocal(valor) {
  const partes = valor.split("-").map(Number);
  return new Date(partes[0], partes[1] - 1, partes[2]);
}

function somarDias(data, quantidade) {
  const nova = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  nova.setDate(nova.getDate() + quantidade);
  return nova;
}

function obterMinutos(hora) {
  const partes = hora.split(":").map(Number);
  return partes[0] * 60 + partes[1];
}

function formatarMinutos(total) {
  const horas = Math.floor(total / 60);
  const minutos = total % 60;
  return String(horas).padStart(2, "0") + ":" + String(minutos).padStart(2, "0");
}

function horariosSeSobrepoem(inicioA, fimA, inicioB, fimB) {
  return inicioA < fimB && fimA > inicioB;
}

function obterAmanhaISO() {
  return formatarISO(somarDias(new Date(), 1));
}

function atualizarModoRecorrencia() {
  const recorrente = recorrenteInput.checked;
  grupoDataFim.style.display = recorrente ? "block" : "none";
  dataFimInput.required = recorrente;
  document.querySelectorAll(".dias-faixa").forEach((el) => {
    el.style.display = recorrente ? "flex" : "none";
  });
}

function criarFaixa() {
  const faixa = document.createElement("fieldset");
  faixa.className = "faixa-horario";
  faixa.style.cssText = "margin:12px 0;padding:12px;border:1px solid #ddd;border-radius:10px;";

  const legenda = document.createElement("legend");
  legenda.textContent = "Faixa de atendimento";
  faixa.appendChild(legenda);

  const dias = document.createElement("div");
  dias.className = "dias-faixa";
  dias.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;";

  DIAS.forEach((dia) => {
    const label = document.createElement("label");
    label.style.cssText = "display:flex;align-items:center;gap:5px;";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "dia-semana";
    checkbox.value = String(dia.valor);
    const texto = document.createElement("span");
    texto.textContent = dia.nome;
    label.append(checkbox, texto);
    dias.appendChild(label);
  });

  faixa.appendChild(dias);

  const campos = document.createElement("div");
  campos.style.cssText = "display:flex;gap:12px;flex-wrap:wrap;align-items:end;";

  const labelInicio = document.createElement("label");
  labelInicio.textContent = "A partir de ";
  const inputInicio = document.createElement("input");
  inputInicio.type = "time";
  inputInicio.className = "hora-inicio";
  inputInicio.required = true;
  labelInicio.appendChild(inputInicio);

  const labelFim = document.createElement("label");
  labelFim.textContent = "Até ";
  const inputFim = document.createElement("input");
  inputFim.type = "time";
  inputFim.className = "hora-fim";
  inputFim.required = true;
  labelFim.appendChild(inputFim);

  const remover = document.createElement("button");
  remover.type = "button";
  remover.className = "btn";
  remover.textContent = "Remover faixa";
  remover.addEventListener("click", () => {
    if (document.querySelectorAll(".faixa-horario").length === 1) {
      mostrarMensagem("Mantenha pelo menos uma faixa de horário.", true);
      return;
    }
    faixa.remove();
  });

  campos.append(labelInicio, labelFim, remover);
  faixa.appendChild(campos);
  faixasContainer.appendChild(faixa);
}

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

  professorSelect.innerHTML = '<option value="">Escolha a professora</option>';
  (data || []).forEach((professor) => {
    const option = document.createElement("option");
    option.value = String(professor.id);
    option.textContent = professor.nome;
    professorSelect.appendChild(option);
  });
}

async function carregarMaterias(professorId) {
  listaMaterias.textContent = "";

  if (!professorId) {
    listaMaterias.textContent = "Escolha a professora primeiro.";
    return;
  }

  const { data, error } = await supabase
    .from("professor_materia")
    .select("materia_id, materia:materia_id(id, nome)")
    .eq("professor_id", professorId);

  if (error) {
    console.error("Erro ao carregar cursos da professora:", error);
    mostrarMensagem("Erro ao carregar os cursos da professora.", true);
    return;
  }

  const materias = (data || [])
    .filter((item) => item.materia)
    .map((item) => item.materia)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  if (!materias.length) {
    listaMaterias.textContent = "Esta professora não tem cursos vinculados.";
    return;
  }

  materias.forEach((materia) => {
    const label = document.createElement("label");
    label.style.cssText = "display:inline-flex;align-items:center;gap:7px;margin:5px 14px 5px 0;";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "materia-selecionada";
    checkbox.value = String(materia.id);

    const nome = document.createElement("span");
    nome.textContent = materia.nome;

    label.append(checkbox, nome);
    listaMaterias.appendChild(label);
  });
}

function coletarFaixas(recorrente) {
  const faixas = [...document.querySelectorAll(".faixa-horario")].map((el) => {
    const inicio = el.querySelector(".hora-inicio").value;
    const fim = el.querySelector(".hora-fim").value;
    const dias = [...el.querySelectorAll(".dia-semana:checked")].map((cb) => Number(cb.value));

    if (!inicio || !fim || obterMinutos(fim) <= obterMinutos(inicio)) {
      throw new Error("Em cada faixa, o horário final precisa ser depois do horário inicial.");
    }

    if (recorrente && !dias.length) {
      throw new Error("Marque pelo menos um dia da semana em cada faixa.");
    }

    return { inicio, fim, dias };
  });

  if (!faixas.length) {
    throw new Error("Adicione pelo menos uma faixa de horário.");
  }

  if (recorrente) {
    for (let i = 0; i < faixas.length; i++) {
      for (let j = i + 1; j < faixas.length; j++) {
        const diasEmComum = !recorrente || faixas[i].dias.some((dia) => faixas[j].dias.includes(dia));
        if (
          diasEmComum &&
          horariosSeSobrepoem(
            obterMinutos(faixas[i].inicio),
            obterMinutos(faixas[i].fim),
            obterMinutos(faixas[j].inicio),
            obterMinutos(faixas[j].fim)
          )
        ) {
          throw new Error("Há faixas sobrepostas no mesmo dia da semana. Ajuste os horários antes de continuar.");
        }
      }
    }
  }

  return faixas;
}

function criarDatas(dataInicio, dataFim, diasPermitidos, recorrente) {
  if (!recorrente) return [dataInicio];

  const inicio = parseDataLocal(dataInicio);
  const fim = parseDataLocal(dataFim);
  const resultado = [];

  for (let data = inicio; data <= fim; data = somarDias(data, 1)) {
    const diaSemana = data.getDay() === 0 ? 7 : data.getDay();
    if (diasPermitidos.has(diaSemana)) resultado.push(formatarISO(data));
  }

  return resultado;
}

function coletarCandidatos(dataInicio, dataFim, faixas, recorrente) {
  const candidatos = new Map();

  for (const faixa of faixas) {
    const datas = criarDatas(
      dataInicio,
      dataFim,
      new Set(faixa.dias),
      recorrente
    );

    for (const data of datas) {
      const inicioFaixa = obterMinutos(faixa.inicio);
      const fimFaixa = obterMinutos(faixa.fim);

      for (let inicio = inicioFaixa; inicio + 40 <= fimFaixa; inicio += 40) {
        const horaInicio = formatarMinutos(inicio);
        const horaFim = formatarMinutos(inicio + 40);
        const chave = data + "|" + horaInicio + "|" + horaFim;
        candidatos.set(chave, {
          data,
          hora_inicio: horaInicio,
          hora_fim: horaFim,
          inicioMinutos: inicio,
          fimMinutos: inicio + 40
        });
      }
    }
  }

  return [...candidatos.values()].sort((a, b) =>
    (a.data + a.hora_inicio).localeCompare(b.data + b.hora_inicio)
  );
}

async function carregarAulasRegulares(professorId) {
  const { data, error } = await supabase
    .from("aluno_horario_aula")
    .select("dia_semana, hora_inicio, hora_fim")
    .eq("professor_id", professorId)
    .eq("ativo", true);

  if (error) {
    console.error("Erro ao consultar aulas regulares:", error);
    throw new Error("Não foi possível consultar as aulas regulares da professora.");
  }

  return data || [];
}

async function carregarHorariosExistentes(professorId, dataInicio, dataFim) {
  const { data, error } = await supabase
    .from("horarios_reposicao")
    .select("id, data, hora_inicio, hora_fim, materia_id, disponivel")
    .eq("professor_id", professorId)
    .gte("data", dataInicio)
    .lte("data", dataFim);

  if (error) {
    console.error("Erro ao consultar horários já cadastrados:", error);
    throw new Error("Não foi possível conferir os horários que já existem.");
  }

  return data || [];
}

async function salvarEmLotes(registros) {
  let salvos = 0;
  const tamanhoLote = 250;

  for (let i = 0; i < registros.length; i += tamanhoLote) {
    const lote = registros.slice(i, i + tamanhoLote);
    const { error } = await supabase.from("horarios_reposicao").insert(lote);

    if (error) {
      console.error("Erro ao salvar lote de horários:", error);
      throw new Error(
        salvos
          ? "Foram salvos " + salvos + " horários, mas um lote seguinte falhou. Confira a lista antes de tentar novamente."
          : "Não foi possível salvar os horários."
      );
    }

    salvos += lote.length;
  }

  return salvos;
}

professorSelect.addEventListener("change", async () => {
  mostrarMensagem("");
  await carregarMaterias(professorSelect.value);
});

recorrenteInput.addEventListener("change", atualizarModoRecorrencia);
addFaixaBtn.addEventListener("click", criarFaixa);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  mostrarMensagem("");

  const professorId = professorSelect.value;
  const recorrente = recorrenteInput.checked;
  const dataInicio = dataInicioInput.value;
  const dataFim = recorrente ? dataFimInput.value : dataInicio;

  const materiasIds = [...document.querySelectorAll(".materia-selecionada:checked")]
    .map((checkbox) => Number(checkbox.value));

  if (!professorId) return mostrarMensagem("Selecione uma professora.", true);
  if (!materiasIds.length) return mostrarMensagem("Marque pelo menos um curso.", true);
  if (!dataInicio) return mostrarMensagem("Informe a data inicial.", true);
  if (recorrente && !dataFim) return mostrarMensagem("Informe até quando repetir.", true);
  if (dataInicio < obterAmanhaISO()) {
    return mostrarMensagem("Cadastre horários somente a partir de amanhã.", true);
  }
  if (dataFim < dataInicio) {
    return mostrarMensagem("A data final não pode ser anterior à data inicial.", true);
  }

  const diasEntre = Math.round(
    (parseDataLocal(dataFim) - parseDataLocal(dataInicio)) / 86400000
  );
  if (diasEntre > 180) {
    return mostrarMensagem("Escolha um período de até 180 dias por vez.", true);
  }

  let faixas;
  try {
    faixas = coletarFaixas(recorrente);
  } catch (error) {
    return mostrarMensagem(error.message, true);
  }

  const candidatos = coletarCandidatos(dataInicio, dataFim, faixas, recorrente);
  if (!candidatos.length) {
    return mostrarMensagem("Não há datas para os dias selecionados dentro desse período.", true);
  }

  btnSalvar.disabled = true;
  btnSalvar.textContent = "Verificando e gerando...";

  try {
    const aulasRegulares = await carregarAulasRegulares(professorId);
    const horariosExistentes = await carregarHorariosExistentes(
      professorId,
      dataInicio,
      dataFim
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user?.id) {
      throw new Error("Não foi possível identificar o usuário logado.");
    }

    const candidatasSemConflito = [];
    let ignorados = 0;

    for (const candidato of candidatos) {
      const dataObj = parseDataLocal(candidato.data);
      const diaSemana = dataObj.getDay() === 0 ? 7 : dataObj.getDay();

      const conflitoAula = aulasRegulares.some((aula) =>
        Number(aula.dia_semana) === diaSemana &&
        horariosSeSobrepoem(
          candidato.inicioMinutos,
          candidato.fimMinutos,
          obterMinutos(String(aula.hora_inicio).slice(0, 5)),
          obterMinutos(String(aula.hora_fim).slice(0, 5))
        )
      );

      const existentesNaData = horariosExistentes.filter(
        (horario) => horario.data === candidato.data
      );
      const conflitosExistentes = existentesNaData.filter((horario) =>
        horariosSeSobrepoem(
          candidato.inicioMinutos,
          candidato.fimMinutos,
          obterMinutos(String(horario.hora_inicio).slice(0, 5)),
          obterMinutos(String(horario.hora_fim).slice(0, 5))
        )
      );

      const mesmaFaixa = conflitosExistentes.filter(
        (horario) =>
          String(horario.hora_inicio).slice(0, 5) === candidato.hora_inicio &&
          String(horario.hora_fim).slice(0, 5) === candidato.hora_fim
      );

      const conflitoParcial = conflitosExistentes.some(
        (horario) =>
          String(horario.hora_inicio).slice(0, 5) !== candidato.hora_inicio ||
          String(horario.hora_fim).slice(0, 5) !== candidato.hora_fim
      );

      const indisponivelExistente = mesmaFaixa.some(
        (horario) => horario.disponivel === false
      );

      if (conflitoAula || conflitoParcial || indisponivelExistente) {
        ignorados++;
        continue;
      }

      candidatasSemConflito.push({
        ...candidato,
        materiasExistentes: new Set(mesmaFaixa.map((h) => Number(h.materia_id)))
      });
    }

    const registros = [];
    candidatasSemConflito.forEach((candidato) => {
      materiasIds.forEach((materiaId) => {
        if (candidato.materiasExistentes.has(materiaId)) return;

        registros.push({
          data: candidato.data,
          hora_inicio: candidato.hora_inicio,
          hora_fim: candidato.hora_fim,
          professor_id: Number(professorId),
          materia_id: materiaId,
          created_by: userData.user.id,
          disponivel: true
        });
      });
    });

    if (!registros.length) {
      mostrarMensagem(
        "Nenhum horário novo foi criado. Os horários já existem, estão ocupados ou coincidem com aulas regulares.",
        true
      );
      return;
    }

    const quantidadeSalva = await salvarEmLotes(registros);
    const textoIgnorados = ignorados
      ? " " + ignorados + " bloco(s) foram pulados por conflito."
      : "";

    mostrarMensagem(
      quantidadeSalva + " horário(s) criado(s) para " +
      candidatasSemConflito.length + " bloco(s) de 40 minutos." + textoIgnorados
    );
  } catch (error) {
    console.error("Erro ao gerar horários:", error);
    mostrarMensagem(error.message || "Erro ao gerar horários.", true);
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = "Gerar horários disponíveis";
  }
});

dataInicioInput.min = obterAmanhaISO();
dataFimInput.min = obterAmanhaISO();
dataInicioInput.value = obterAmanhaISO();
const fimPadrao = somarDias(parseDataLocal(obterAmanhaISO()), 56);
dataFimInput.value = formatarISO(fimPadrao);

atualizarModoRecorrencia();
criarFaixa();
carregarProfessores();