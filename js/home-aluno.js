import { supabase } from "./supabase.js";
import { exigirAluno } from "./guard.js";

await exigirAluno();

const saudacao = document.getElementById("saudacao");
const btnSair = document.getElementById("btnSair");


// pegar usuário logado
const { data: userData } = await supabase.auth.getUser();

const user = userData.user;

if (!user) {
  window.location.href = "login.html";
}


// buscar aluno
const { data: aluno, error } = await supabase
  .from("aluno")
  .select("nome")
  .eq("usuario_id", user.id)
  .single();

if (error) {
  saudacao.textContent = "Olá aluno";
} else {
  saudacao.textContent = "Olá, " + aluno.nome;
}


// botão sair
btnSair.addEventListener("click", async () => {

  await supabase.auth.signOut();

  localStorage.clear();

  window.location.href = "login.html";

});