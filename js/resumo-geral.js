import { supabase } from "./supabase.js";

const inputBusca = document.getElementById("buscaAluno");
const listaResultados = document.getElementById("listaResultados");

let matriculas = [];

async function carregarMatriculas() {

  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno:aluno_id ( nome ),
      materia:materia_id ( nome ),
      modulo:modulo_id ( nome )
    `);

  if (error) {
    console.error("Erro ao carregar:", error);
    return;
  }

  matriculas = data;
}

function mostrarResultados(texto) {

  listaResultados.innerHTML = "";

  const busca = texto.toLowerCase();

  const filtrados = matriculas.filter(m =>
    m.aluno.nome.toLowerCase().includes(busca)
  );

  filtrados.slice(0,10).forEach(m => {

    const li = document.createElement("li");

    li.style.cursor = "pointer";
    li.style.padding = "6px";

    li.textContent =
      `${m.aluno.nome} — ${m.materia.nome} (${m.modulo.nome})`;

    li.onclick = () => {

      localStorage.setItem("matriculaSelecionada", m.id);

      window.location.href = "detalhes-aluno-admin.html";

    };

    listaResultados.appendChild(li);

  });

}

inputBusca.addEventListener("input", () => {

  const texto = inputBusca.value;

  if (texto.length < 2) {
    listaResultados.innerHTML = "";
    return;
  }

  mostrarResultados(texto);

});

carregarMatriculas();