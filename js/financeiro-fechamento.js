import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";
import {
  carregarItensHoraAula, carregarPaginas, calcularValorItem
} from "./financeiro-aulas-dados.js";
import {
  carregarPessoas, dataBR, hojeFinanceiro, moeda, novoElemento, periodoMes
} from "./financeiro-comum.js";

const centavos = (valor) => Math.round(Number(valor || 0) * 100);
const emReais = (valor) => moeda.format(valor / 100);

if (await exigirAdmin()) iniciar();

function consolidar(pessoas, aulas, fixos, lancamentos, pagamentos, inicio, fim) {
  const porPessoa = new Map();
  function linha(chave, nome, tipo = "favorecido") {
    if (!porPessoa.has(chave)) {
      porPessoa.set(chave, { chave, nome, tipo, aulas: 0, fixos: 0, pagoFixo: 0, pendencias: 0, pagamento: null });
    }
    return porPessoa.get(chave);
  }

  const cadastro = new Map(pessoas.map((p) => [p.chave, p]));
  for (const p of pessoas) if (p.ativo && p.tipo === "funcionario") linha(p.chave, p.nome, p.tipo);
  const porCusto = new Map();
  for (const lancamento of lancamentos) {
    const chave = String(lancamento.financeiro_fixo_id);
    const registros = porCusto.get(chave) || [];
    registros.push(lancamento);
    porCusto.set(chave, registros);
  }
  const regimesFixos = new Map();
  for (const fixo of fixos) {
    const registros = porCusto.get(String(fixo.id)) || [];
    if (!registros.length && (
      (!fixo.ativo && !fixo.data_fim) || fixo.data_inicio >= fim ||
      (fixo.data_fim && fixo.data_fim < inicio)
    )) continue;

    if (fixo.substitui_hora_aula && (fixo.ativo || fixo.data_fim)
      && (!registros.length || registros.some((r) => r.status !== "cancelado"))) {
      const chaveProfessor = String(fixo.professor_id);
      const vigencias = regimesFixos.get(chaveProfessor) || [];
      vigencias.push(fixo);
      regimesFixos.set(chaveProfessor, vigencias);
    }
    const chave = fixo.professor_id ? `professor:${fixo.professor_id}`
      : fixo.funcionario_id ? `funcionario:${fixo.funcionario_id}` : `fixo:${fixo.id}`;
    const tipo = chave.split(":")[0];
    const item = linha(chave, cadastro.get(chave)?.nome || fixo.pessoa_nome, tipo);
    item.fixos += registros.length
      ? registros.filter((r) => r.status !== "cancelado").reduce((soma, r) => soma + centavos(r.valor), 0)
      : centavos(fixo.valor_mensal);
    item.pagoFixo += registros.filter((r) => r.status === "pago").reduce((soma, r) => soma + centavos(r.valor), 0);
  }
  let semProfessor = 0;
  for (const aula of aulas) {
    if (!aula.professor_id) {
      semProfessor++;
      continue;
    }
    const regimes = regimesFixos.get(String(aula.professor_id)) || [];
    if (regimes.some((fixo) => aula.data_aula >= fixo.data_inicio &&
      (!fixo.data_fim || aula.data_aula <= fixo.data_fim))) continue;

    const chave = `professor:${aula.professor_id}`;
    const item = linha(chave, cadastro.get(chave)?.nome || `Professor(a) #${aula.professor_id}`, "professor");
    if (aula.duracao_segundos_salva == null || (aula.valor_hora == null && Number(aula.duracao_segundos_salva) > 0)) {
      item.pendencias++;
    }
    item.aulas += calcularValorItem(aula);
  }

  for (const pagamento of pagamentos) {
    linha(pagamento.beneficiario, pagamento.nome, pagamento.beneficiario.split(":")[0]).pagamento = pagamento;
  }

  const itens = [...porPessoa.values()].map((item) => {
    item.aulas = centavos(item.aulas);
    const pagoMensal = item.pagamento?.pago_em
      ? centavos(item.pagamento.valor_hora_aula) + centavos(item.pagamento.valor_fixo) : 0;
    item.pago = item.pagoFixo + pagoMensal;
    item.total = item.aulas + item.fixos;
    item.saldo = Math.max(0, item.total - item.pago);
    return item;
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { itens, semProfessor };
}

async function carregarMes(inicio, fim) {
  const [pessoas, aulas, fixos, lancamentos, pagamentos, despesas] = await Promise.all([
    carregarPessoas(),
    carregarItensHoraAula({ inicio, fim }),
    carregarPaginas(() => supabase.from("financeiro_fixo")
      .select("id,pessoa_nome,professor_id,funcionario_id,valor_mensal,ativo,data_inicio,data_fim,substitui_hora_aula").order("id")),
    carregarPaginas(() => supabase.from("financeiro_fixo_lancamento")
      .select("id,financeiro_fixo_id,valor,status").eq("competencia", inicio).order("id")),
    carregarPaginas(() => supabase.from("financeiro_pagamento_mensal")
      .select("*").eq("competencia", inicio).order("beneficiario")),
    carregarPaginas(() => supabase.from("custo_adicional")
      .select("id,valor").gte("data_custo", inicio).lt("data_custo", fim).order("id"))
  ]);
  return {
    ...consolidar(pessoas, aulas, fixos, lancamentos, pagamentos, inicio, fim),
    variaveis: despesas.reduce((soma, despesa) => soma + centavos(despesa.valor), 0)
  };
}

function iniciar() {
  const resumo = new URLSearchParams(location.search).get("aba") === "resumo";
  const mes = document.getElementById("mes");
  const filtro = document.getElementById("filtro");
  const msg = document.getElementById("mensagem");
  const lista = document.getElementById("lista");
  const totais = document.getElementById("totais");
  const dataPagamento = document.getElementById("data-pagamento");
  let competencia = null;
  let resultado = null;
  let sequencia = 0;
  let gravando = false;

  dataPagamento.max = dataPagamento.value = hojeFinanceiro();
  mes.value = dataPagamento.value.slice(0, 7);
  document.getElementById("filtros").addEventListener("submit", (e) => e.preventDefault());
  if (resumo) {
    document.title = "Resumo financeiro | Beehive";
    document.getElementById("titulo").textContent = "Resumo financeiro";
    document.getElementById("campo-filtro").hidden = true;
    document.getElementById("pagamentos").hidden = true;
  }

  function renderizar() {
    if (!resultado) return;
    const { itens, variaveis, semProfessor } = resultado;
    const somar = (campo) => itens.reduce((soma, item) => soma + item[campo], 0);
    const pendencias = itens.reduce((soma, item) => soma + item.pendencias, 0);
    totais.replaceChildren();
    for (const [titulo, valor] of [
      ["Hora-aula", somar("aulas")], ["Custos fixos", somar("fixos")],
      ["Custos variáveis", variaveis], ["Total do mês", somar("total") + variaveis],
      ["Pagamentos registrados", somar("pago")], ["A pagar a favorecidos", somar("saldo")]
    ]) {
      const caixa = novoElemento("div");
      caixa.append(novoElemento("dt", titulo), novoElemento("dd", emReais(valor)));
      totais.append(caixa);
    }
    msg.textContent = [
      pendencias ? `${pendencias} aula(s) com minutagem ou valor-hora pendente. Os totais são parciais.` : "",
      semProfessor ? `${semProfessor} aula(s) sem professor identificado ficaram fora dos pagamentos.` : ""
    ].filter(Boolean).join(" ");
    if (resumo) return;

    lista.replaceChildren();
    for (const item of itens) {
      const pago = item.pago > 0 && item.saldo === 0 && item.pendencias === 0;
      const pendente = item.saldo > 0 || item.pendencias > 0;
      if ((filtro.value === "pago" && !pago) || (filtro.value === "pendente" && !pendente)) continue;

      const card = novoElemento("article", undefined, "financeiro-linha");
      const info = novoElemento("div");
      const situacao = item.pendencias ? "Conferir hora-aula"
        : pago ? "Pago" : item.pago > 0 ? "Pagamento parcial"
          : item.saldo > 0 ? "Pendente" : "Sem valor a pagar";
      info.append(
        novoElemento("h3", item.nome),
        novoElemento("p", `Hora-aula: ${emReais(item.aulas)} · Fixo: ${emReais(item.fixos)}`, "secundario"),
        novoElemento("p", `${situacao} · Pago: ${emReais(item.pago)}${item.pagamento?.pago_em ? " em " + dataBR(item.pagamento.pago_em) : ""}`, pago ? "financeiro-pago" : "financeiro-pendente")
      );
      if (item.pendencias) {
        const link = novoElemento("a", "Conferir registro de hora-aula");
        link.href = "financeiro-hora-aula.html";
        info.append(link);
      }
      card.append(info, novoElemento("strong", `A pagar: ${emReais(item.saldo)}`));
      if (item.pagamento?.pago_em || (item.saldo > 0 && !item.pendencias)) {
        const desfazer = Boolean(item.pagamento?.pago_em);
        const botao = novoElemento("button", desfazer ? "Corrigir marcação" : "Marcar como pago", "btn");
        botao.type = "button";
        botao.addEventListener("click", () => registrar(item, botao, desfazer));
        card.append(botao);
      }
      if (item.pagamento?.pago_em && item.saldo > 0) {
        info.append(novoElemento("p", "O valor mudou depois do pagamento. Confira a diferença.", "secundario"));
      }
      lista.append(card);
    }
    if (!lista.children.length) lista.textContent = "Nenhum favorecido para este filtro.";
  }

  async function atualizar() {
    const atual = ++sequencia;
    resultado = null;
    totais.replaceChildren();
    lista.replaceChildren();
    msg.textContent = mes.value ? "Carregando mês…" : "Selecione o mês de referência.";
    if (!mes.value) return;
    const { inicio, fim } = periodoMes(mes.value);
    try {
      const dados = await carregarMes(inicio, fim);
      if (atual !== sequencia) return;
      competencia = inicio;
      resultado = dados;
      renderizar();
    } catch (erro) {
      if (atual !== sequencia) return;
      console.error(erro);
      msg.textContent = "Não foi possível carregar o fechamento.";
    }
  }

  async function registrar(item, botao, desfazer) {
    if (gravando || !resultado) return;
    if (!desfazer && !dataPagamento.reportValidity()) return;
    const pergunta = desfazer
      ? `Corrigir a marcação de ${item.nome}? Faça isso somente se o pagamento não ocorreu.`
      : `Registrar o pagamento de ${emReais(item.saldo)} para ${item.nome}?`;
    if (!confirm(pergunta)) return;
    gravando = true;
    botao.disabled = mes.disabled = true;
    const chave = { competencia, beneficiario: item.chave };
    try {
      const tabela = supabase.from("financeiro_pagamento_mensal");
      const dados = {
        ...chave, nome: item.nome, valor_hora_aula: item.aulas / 100,
        valor_fixo: Math.max(0, item.fixos - item.pagoFixo) / 100,
        pago_em: dataPagamento.value, alterado_em: new Date().toISOString()
      };
      const consulta = item.pagamento
        ? tabela.update(desfazer ? { pago_em: null, alterado_em: dados.alterado_em } : dados)
          .eq("competencia", competencia).eq("beneficiario", item.chave)
          .eq("alterado_em", item.pagamento.alterado_em)
        : tabela.insert(dados);
      const { data, error } = await consulta.select("beneficiario").maybeSingle();
      if (error || !data) throw error || new Error("Pagamento alterado em outra sessão.");
      await atualizar();
      const aviso = desfazer ? "Marcação corrigida." : "Pagamento registrado.";
      msg.textContent = [aviso, msg.textContent].filter(Boolean).join(" ");
    } catch (erro) {
      console.error(erro);
      msg.textContent = "Não foi possível alterar o pagamento. Atualize o mês e confira a situação.";
    } finally {
      gravando = false;
      botao.disabled = mes.disabled = false;
    }
  }

  mes.addEventListener("change", atualizar);
  filtro.addEventListener("change", renderizar);
  void atualizar();
}
