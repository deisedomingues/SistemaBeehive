import { supabase } from "./supabase.js";
import { carregarPaginas } from "./financeiro-aulas-dados.js";

export const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function hojeFinanceiro() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function periodoMes(mes) {
  const [ano, numero] = mes.split("-").map(Number);
  return {
    inicio: `${mes}-01`,
    fim: new Date(Date.UTC(ano, numero, 1)).toISOString().slice(0, 10)
  };
}

export async function carregarPessoas() {
  const [professores, funcionarios] = await Promise.all([
    carregarPaginas(() => supabase.from("professor").select("id,nome,ativo").order("id")),
    carregarPaginas(() => supabase.from("funcionario").select("id,nome,ativo").order("id"))
  ]);
  return [
    ...professores.map((pessoa) => ({ ...pessoa, tipo: "professor", chave: `professor:${pessoa.id}` })),
    ...funcionarios.map((pessoa) => ({ ...pessoa, tipo: "funcionario", chave: `funcionario:${pessoa.id}` }))
  ].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function novoElemento(tag, texto, classe) {
  const elemento = document.createElement(tag);
  if (texto !== undefined) elemento.textContent = texto;
  if (classe) elemento.className = classe;
  return elemento;
}

export function dataBR(data) {
  return data ? data.split("-").reverse().join("/") : "—";
}
