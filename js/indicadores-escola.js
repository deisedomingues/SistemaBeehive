import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

const inteiro = new Intl.NumberFormat("pt-BR");
const percentual = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const nomeMes = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });

function elemento(tag, texto, classe) {
  const node = document.createElement(tag);
  if (texto !== undefined) node.textContent = texto;
  if (classe) node.className = classe;
  return node;
}

function formatarData(data) {
  return data.split("-").reverse().join("/");
}

function preencherLista(id, itens, vazio) {
  const lista = document.getElementById(id);
  lista.replaceChildren();
  if (!itens.length) {
    lista.append(elemento("div", vazio, "indicadores-nota"));
    return;
  }
  for (const [titulo, valor] of itens) {
    const linha = elemento("div");
    linha.append(elemento("dt", titulo), elemento("dd", typeof valor === "number" ? inteiro.format(valor) : valor));
    lista.append(linha);
  }
}

function preencherRanking(id, colunas, linhas, vazio) {
  const local = document.getElementById(id);
  local.replaceChildren();
  if (!linhas.length) {
    local.append(elemento("p", vazio, "indicadores-nota"));
    return;
  }
  const tabela = elemento("table", undefined, "indicadores-table");
  tabela.setAttribute("aria-label", id === "ranking-faltas" ? "Alunos com mais faltas" : "Alunos mais ativos no sistema");
  const cabecalho = tabela.createTHead().insertRow();
  for (const coluna of colunas) {
    const th = elemento("th", coluna);
    th.scope = "col";
    cabecalho.append(th);
  }
  const corpo = tabela.createTBody();
  for (const dados of linhas) {
    const linha = corpo.insertRow();
    for (const valor of dados) linha.insertCell().textContent = valor;
  }
  local.append(tabela);
}

function preencherMovimento(meses) {
  const local = document.getElementById("movimento-mensal");
  local.replaceChildren();
  if (!meses.some((m) => m.entradas || m.saidas)) {
    local.append(elemento("p", "Nenhuma entrada ou saída registrada no período.", "indicadores-nota"));
    return;
  }
  const maximo = Math.max(1, ...meses.flatMap((m) => [m.entradas, m.saidas]));
  for (const mes of meses) {
    const linha = elemento("div", undefined, "indicadores-mes");
    const titulo = nomeMes.format(new Date(`${mes.mes}-01T12:00:00Z`));
    linha.append(elemento("h3", titulo));
    for (const [tipo, tituloBarra] of [["entradas", "Entradas"], ["saidas", "Saídas"]]) {
      const barra = elemento("div", undefined, `indicadores-barra ${tipo}`);
      const medidor = elemento("meter");
      medidor.max = maximo;
      medidor.value = mes[tipo];
      medidor.setAttribute("aria-hidden", "true");
      barra.append(elemento("span", `${tituloBarra} ${inteiro.format(mes[tipo])}`), medidor);
      linha.append(barra);
    }
    local.append(linha);
  }
}

function renderizar(dados, inicio) {
  const presencas = dados.aulas.Presente || 0;
  const faltas = dados.aulas.Ausente || 0;
  const frequencia = presencas + faltas ? percentual.format(presencas / (presencas + faltas)) : "—";
  preencherLista("indicadores-totais", [
    ["Alunos ativos no fim", dados.ativos],
    ["Entradas registradas", dados.entradas],
    ["Saídas registradas", dados.saidas],
    ["Presença nas aulas", frequencia],
    ["Alunos com acesso medido", dados.usuarios_com_acesso]
  ]);
  preencherMovimento(dados.movimento);
  preencherRanking("ranking-faltas", ["Aluno", "Faltas", "% de faltas"],
    dados.faltas.map((a) => [a.nome, inteiro.format(a.faltas), percentual.format(a.faltas / a.total)]),
    "Nenhuma falta registrada no período.");
  preencherRanking("ranking-uso", ["Aluno", "Dias de acesso"],
    dados.uso.map((a) => [a.nome, inteiro.format(a.dias)]),
    "Nenhum acesso medido no período.");
  document.getElementById("cobertura-acessos").textContent = dados.primeiro_acesso_medido
    ? `Dias em que o aluno abriu a página inicial. Primeiro acesso medido em ${formatarData(dados.primeiro_acesso_medido)}.${inicio < dados.primeiro_acesso_medido ? " Parte do período antecede a medição." : ""}`
    : "A medição começa nesta versão. Cada dia com abertura da página inicial conta uma vez.";
  preencherLista("indicadores-cursos", dados.cursos.map((c) => [c.nome, c.alunos]), "Sem matrículas no fim do período.");
  preencherLista("indicadores-modalidades", dados.modalidades.map((m) => [m.modalidade, m.matriculas]), "Sem vínculos no fim do período.");
  preencherLista("indicadores-rotina", [
    ["Presenças", presencas], ["Faltas", faltas],
    ["Aulas canceladas", dados.aulas.Cancelada || 0],
    ["Reposições registradas em aula", dados.aulas["Reposição"] || 0],
    ["Reposições agendadas no período", dados.reposicoes.solicitadas],
    ["Agendamentos de reposição concluídos", dados.reposicoes.concluidas],
    ["Agendamentos de reposição cancelados", dados.reposicoes.canceladas],
    ["Notas lançadas", dados.avaliacoes.lancadas],
    ["Alunos com nota lançada", dados.avaliacoes.alunos]
  ]);
}

if (await exigirAdmin()) {
  const form = document.getElementById("form-periodo");
  const inicio = document.getElementById("inicio");
  const fim = document.getElementById("fim");
  const status = document.getElementById("indicadores-status");
  const resultado = document.getElementById("indicadores-resultado");
  const botao = form.querySelector("button");
  const hoje = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const primeirosDias = new Date(`${hoje}T12:00:00Z`);
  primeirosDias.setUTCDate(primeirosDias.getUTCDate() - 89);
  inicio.max = fim.max = fim.value = hoje;
  inicio.value = primeirosDias.toISOString().slice(0, 10);

  async function buscar() {
    if (inicio.value > fim.value) {
      status.textContent = "A data inicial precisa ser anterior ou igual à data final.";
      inicio.focus();
      return;
    }
    const dataInicial = inicio.value;
    const dataFinal = fim.value;
    botao.disabled = true;
    resultado.hidden = true;
    status.textContent = "Carregando indicadores…";
    try {
      const { data, error } = await supabase.rpc("indicadores_escola", {
        p_inicio: dataInicial, p_fim: dataFinal
      });
      if (error) throw error;
      renderizar(data, dataInicial);
      resultado.hidden = false;
      status.textContent = `Período de ${formatarData(dataInicial)} a ${formatarData(dataFinal)}.`;
    } catch (erro) {
      console.error("Erro ao carregar indicadores:", erro);
      status.textContent = "Não foi possível carregar os indicadores. Tente aplicar o período novamente.";
    } finally {
      botao.disabled = false;
    }
  }

  form.addEventListener("submit", (evento) => {
    evento.preventDefault();
    if (!botao.disabled) void buscar();
  });
  void buscar();
}
