import { supabase } from "./supabase.js";
import { exigirAluno } from "./guard.js";

await exigirAluno();

const msg = document.getElementById("msg");
const listaHorarios = document.getElementById("listaHorarios");
const minhasReposicoes = document.getElementById("minhasReposicoes");
const nomeAluno = document.getElementById("nomeAluno");


// pegar usuário logado
const { data: userData } = await supabase.auth.getUser();

const userId = userData.user.id;


// buscar aluno
const { data: aluno } = await supabase
    .from("aluno")
    .select("*")
    .eq("usuario_id", userId)
    .single();

nomeAluno.textContent = "Olá, " + aluno.nome;


// carregar horários
async function carregarHorarios() {

    const { data, error } = await supabase
        .from("horarios_reposicao")
        .select("*")
        .eq("disponivel", true)
        .order("data", { ascending: true });

    listaHorarios.innerHTML = "";

    data.forEach(h => {

        const div = document.createElement("div");

        div.innerHTML = `
            <p>
                ${h.data} - ${h.hora} - ${h.professora}
                <button data-id="${h.id}">
                    Agendar
                </button>
            </p>
        `;

        listaHorarios.appendChild(div);
    });

}


// agendar
listaHorarios.addEventListener("click", async (e) => {

    if (e.target.tagName === "BUTTON") {

        const horarioId = e.target.dataset.id;

        const { error } = await supabase
            .from("reposicao_agendada")
            .insert({
                aluno_id: aluno.id,
                horario_reposicao_id: horarioId
            });

        if (error) {
            msg.textContent = "Erro ao agendar";
            return;
        }

        await supabase
            .from("horarios_reposicao")
            .update({ disponivel: false })
            .eq("id", horarioId);

        msg.textContent = "Reposição agendada com sucesso";

        carregarHorarios();
        carregarMinhasReposicoes();
    }

});


// carregar minhas reposições
async function carregarMinhasReposicoes() {

    const { data } = await supabase
        .from("reposicao_agendada")
        .select(`
            id,
            horarios_reposicao (
                data,
                hora,
                professora
            )
        `)
        .eq("aluno_id", aluno.id)
        .eq("status", "agendada");

    minhasReposicoes.innerHTML = "";

    data.forEach(r => {

        const h = r.horarios_reposicao;

        const div = document.createElement("div");

        div.innerHTML = `
            <p>
                ${h.data} - ${h.hora} - ${h.professora}
                <button data-id="${r.id}">
                    Cancelar
                </button>
            </p>
        `;

        minhasReposicoes.appendChild(div);
    });

}


// cancelar
minhasReposicoes.addEventListener("click", async (e) => {

    if (e.target.tagName === "BUTTON") {

        const reposicaoId = e.target.dataset.id;

        await supabase
            .from("reposicao_agendada")
            .update({
                status: "cancelada"
            })
            .eq("id", reposicaoId);

        msg.textContent = "Reposição cancelada";

        carregarMinhasReposicoes();
        carregarHorarios();
    }

});


// iniciar
carregarHorarios();
carregarMinhasReposicoes();