import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";
import { carregarPaginas } from "./financeiro-aulas-dados.js";
import { dataBR, hojeFinanceiro, moeda, novoElemento, periodoMes } from "./financeiro-comum.js";

if (await exigirAdmin()) iniciar();

function iniciar() {
  const form = document.getElementById("form-custo");
  const mes = document.getElementById("mes");
  const msg = document.getElementById("mensagem");
  const lista = document.getElementById("lista");
  const total = document.getElementById("total");
  const salvar = form.querySelector('button[type="submit"]');
  const cancelar = document.getElementById("cancelar-edicao");
  const titulo = document.getElementById("titulo-form");
  let editando = null;
  let buscaAtual = 0;

  form.elements.data.value = hojeFinanceiro();
  mes.value = form.elements.data.value.slice(0, 7);

  function limparEdicao(data = hojeFinanceiro()) {
    editando = null;
    form.reset();
    form.elements.data.value = data;
    titulo.textContent = "Novo custo variável";
    salvar.textContent = "Registrar despesa";
    cancelar.hidden = true;
  }

  cancelar.addEventListener("click", () => limparEdicao());

  async function listar() {
    const busca = ++buscaAtual;
    total.textContent = "";
    lista.textContent = mes.value ? "Carregando despesas…" : "Selecione o mês.";
    if (!mes.value) return;
    const { inicio, fim } = periodoMes(mes.value);
    try {
      const despesas = await carregarPaginas(() => supabase.from("custo_adicional")
        .select("id,data_custo,descricao,valor,referencia").gte("data_custo", inicio).lt("data_custo", fim)
        .order("data_custo", { ascending: false }).order("id", { ascending: false }));
      if (busca !== buscaAtual) return;
      total.textContent = `Total do mês: ${moeda.format(despesas.reduce((soma, d) => soma + Number(d.valor), 0))}`;
      lista.replaceChildren();
      if (!despesas.length) lista.textContent = "Nenhuma despesa neste mês.";
      for (const despesa of despesas) {
        const item = novoElemento("article", undefined, "financeiro-linha");
        const info = novoElemento("div");
        info.append(
          novoElemento("h3", despesa.descricao),
          novoElemento("p", [dataBR(despesa.data_custo), despesa.referencia].filter(Boolean).join(" · "), "secundario")
        );
        const editar = novoElemento("button", "Editar", "beehive-voltar");
        editar.type = "button";
        editar.addEventListener("click", () => {
          if (salvar.disabled) return;
          editando = despesa.id;
          titulo.textContent = "Editar custo variável";
          salvar.textContent = "Salvar alterações";
          form.elements.data.value = despesa.data_custo;
          form.elements.valor.value = despesa.valor;
          form.elements.descricao.value = despesa.descricao;
          form.elements.referencia.value = despesa.referencia || "";
          cancelar.hidden = false;
          msg.textContent = "";
          form.elements.descricao.focus();
        });
        item.append(info, novoElemento("strong", moeda.format(despesa.valor)), editar);
        lista.append(item);
      }
    } catch (erro) {
      if (busca !== buscaAtual) return;
      console.error(erro);
      lista.textContent = "Não foi possível carregar as despesas.";
    }
  }

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = new FormData(form);
    const descricao = dados.get("descricao").trim();
    if (!descricao) {
      msg.textContent = "Informe a descrição da despesa.";
      form.elements.descricao.focus();
      return;
    }
    salvar.disabled = cancelar.disabled = true;
    try {
      const data = dados.get("data");
      const despesa = {
        data_custo: data,
        descricao,
        valor: Number(dados.get("valor")),
        referencia: dados.get("referencia").trim() || null
      };
      const tabela = supabase.from("custo_adicional");
      const consulta = editando ? tabela.update(despesa).eq("id", editando) : tabela.insert(despesa);
      const { data: gravada, error } = await consulta.select("id").maybeSingle();
      if (error || !gravada) throw error || new Error("Despesa indisponível.");
      msg.textContent = editando ? "Despesa atualizada." : "Despesa registrada.";
      limparEdicao(data);
      mes.value = data.slice(0, 7);
      await listar();
    } catch (erro) {
      console.error(erro);
      msg.textContent = "Não foi possível registrar a despesa.";
    } finally {
      salvar.disabled = cancelar.disabled = false;
    }
  });

  mes.addEventListener("change", listar);
  void listar();
}
