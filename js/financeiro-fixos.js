import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";
import { carregarPaginas } from "./financeiro-aulas-dados.js";
import { carregarPessoas, dataBR, hojeFinanceiro, moeda, novoElemento } from "./financeiro-comum.js";

if (await exigirAdmin()) iniciar();

async function iniciar() {
  const form = document.getElementById("form-custo");
  const lista = document.getElementById("lista");
  const msg = document.getElementById("mensagem");
  const pessoa = form.elements.pessoa;
  const nome = form.elements.nome;
  const salvar = form.querySelector("button");
  let pessoas = [];

  form.elements.inicio.value = hojeFinanceiro();
  pessoa.addEventListener("change", sincronizarNome);
  function sincronizarNome() {
    nome.disabled = Boolean(pessoa.value);
    document.getElementById("campo-nome").hidden = nome.disabled;
  }

  async function listar() {
    const fixos = await carregarPaginas(() => supabase.from("financeiro_fixo")
      .select("id,pessoa_nome,descricao,valor_mensal,data_inicio,data_fim,ativo,observacao,financeiro_fixo_parcela(numero_parcela,dia_vencimento,valor)")
      .order("id", { ascending: false }));
    lista.replaceChildren();
    if (!fixos.length) lista.textContent = "Nenhum custo fixo cadastrado.";
    for (const fixo of fixos) {
      const linha = novoElemento("article", undefined, "financeiro-linha");
      const info = novoElemento("div");
      info.append(
        novoElemento("h3", fixo.pessoa_nome),
        novoElemento("p", fixo.descricao),
        novoElemento("p", `Vigência: ${dataBR(fixo.data_inicio)}${fixo.data_fim ? " a " + dataBR(fixo.data_fim) : " em diante"}${fixo.ativo ? "" : " · Inativo"}`, "secundario")
      );
      const parcelas = fixo.financeiro_fixo_parcela || [];
      if (parcelas.length) {
        info.append(novoElemento("p", parcelas.sort((a,b) => a.numero_parcela-b.numero_parcela)
          .map((p) => `${moeda.format(p.valor)} no dia ${p.dia_vencimento}`).join(" + "), "secundario"));
      }
      if (fixo.observacao) info.append(novoElemento("p", fixo.observacao, "secundario"));
      const valor = novoElemento("strong", `${moeda.format(fixo.valor_mensal)} / mês`);
      linha.append(info, valor);
      if (fixo.ativo && !fixo.data_fim) {
        const encerrar = novoElemento("button", "Encerrar vigência", "btn");
        encerrar.type = "button";
        encerrar.addEventListener("click", async () => {
          const data = prompt("Último dia da vigência (AAAA-MM-DD)", hojeFinanceiro());
          if (data === null) return;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data < fixo.data_inicio) {
            msg.textContent = "Informe uma data válida, a partir do início da vigência.";
            return;
          }
          encerrar.disabled = true;
          try {
            const { data: alterado, error } = await supabase.from("financeiro_fixo")
              .update({ data_fim: data }).eq("id", fixo.id).is("data_fim", null).select("id").maybeSingle();
            if (error || !alterado) throw error || new Error("Vigência já atualizada.");
            msg.textContent = "Vigência encerrada.";
            await listar();
          } catch (erro) {
            console.error(erro);
            msg.textContent = "Não foi possível concluir a alteração da vigência.";
            encerrar.disabled = false;
          }
        });
        linha.append(encerrar);
      }
      lista.append(linha);
    }
  }

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = new FormData(form);
    const favorecido = pessoas.find((p) => p.chave === pessoa.value);
    const valor2 = dados.get("valor2");
    const dia2 = dados.get("dia2");
    if (Boolean(valor2) !== Boolean(dia2)) {
      msg.textContent = "Informe o valor e o dia da segunda parcela, ou deixe ambos em branco.";
      form.elements[valor2 ? "dia2" : "valor2"].focus();
      return;
    }
    const nomeFavorecido = favorecido?.nome || nome.value.trim();
    const descricao = dados.get("descricao").trim();
    if (!nomeFavorecido || !descricao || (dados.get("fim") && dados.get("fim") < dados.get("inicio"))) {
      msg.textContent = "Confira o nome, a descrição e as datas da vigência.";
      return;
    }

    salvar.disabled = true;
    try {
      const { error } = await supabase.rpc("cadastrar_custo_fixo", {
        p_nome: nomeFavorecido,
        p_descricao: descricao,
        p_inicio: dados.get("inicio"),
        p_fim: dados.get("fim") || null,
        p_professor_id: favorecido?.tipo === "professor" ? favorecido.id : null,
        p_funcionario_id: favorecido?.tipo === "funcionario" ? favorecido.id : null,
        p_dias: [Number(dados.get("dia1")), ...(dia2 ? [Number(dia2)] : [])],
        p_valores: [Number(dados.get("valor1")), ...(valor2 ? [Number(valor2)] : [])],
        p_observacao: dados.get("observacao")
      });
      if (error) throw error;
      form.reset();
      sincronizarNome();
      form.elements.inicio.value = hojeFinanceiro();
      msg.textContent = "Custo fixo cadastrado.";
      try { await listar(); } catch (erro) {
        console.error(erro);
        lista.textContent = "O custo foi salvo. Recarregue a página para atualizar a lista.";
      }
    } catch (erro) {
      console.error(erro);
      msg.textContent = "Não foi possível cadastrar o custo fixo.";
    } finally {
      salvar.disabled = false;
    }
  });

  try {
    pessoas = await carregarPessoas();
    for (const p of pessoas.filter((x) => x.ativo)) {
      pessoa.add(new Option(`${p.nome} · ${p.tipo === "professor" ? "Professor(a)" : "Funcionário(a)"}`, p.chave));
    }
    salvar.disabled = false;
    await listar();
  } catch (erro) {
    console.error(erro);
    lista.textContent = "Não foi possível carregar os custos ou os favorecidos.";
  }
}
