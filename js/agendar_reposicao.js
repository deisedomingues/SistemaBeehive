import { supabase } from "./supabase.js";
import { exigirAluno } from "./guard.js";

await exigirAluno();

const listaReposicoes = document.getElementById("listaReposicoes");
const msg = document.getElementById("msg");
const faltasAluno = document.getElementById("faltasAluno");

let totalFaltas = 0;


// =============================
// mensagem
// =============================
function mostrarMensagem(texto, erro = false) {

    msg.textContent = texto;
    msg.style.color = erro ? "red" : "green";

    setTimeout(() => {
        msg.textContent = "";
    }, 3000);
}



// =============================
// buscar aluno via perfil
// =============================
async function buscarAluno() {

    const { data: userData, error } = await supabase.auth.getUser();

    if (error || !userData.user) {
        console.error(error);
        return null;
    }

    const userId = userData.user.id;

    const { data: perfil, error: errPerfil } = await supabase
        .from("perfil")
        .select("aluno_id")
        .eq("user_id", userId)
        .eq("role", "aluno")
        .single();

    if (errPerfil || !perfil) {
        console.error(errPerfil);
        mostrarMensagem("Perfil do aluno não encontrado", true);
        return null;
    }

    const { data: aluno, error: errAluno } = await supabase
        .from("aluno")
        .select("id, nome")
        .eq("id", perfil.aluno_id)
        .single();

    if (errAluno) {
        console.error(errAluno);
        mostrarMensagem("Aluno não encontrado", true);
        return null;
    }

    const { data: matricula, error: errMatricula } = await supabase
        .from("matricula")
        .select("id, materia_id")
        .eq("aluno_id", aluno.id)
        .eq("ativa", true)
        .single();

    if (errMatricula) {
        console.error(errMatricula);
        mostrarMensagem("Matrícula não encontrada", true);
        return null;
    }

    return {
        id: aluno.id,
        nome: aluno.nome,
        materia_id: matricula.materia_id,
        matricula_id: matricula.id
    };
}



// =============================
// carregar faltas
// =============================
async function carregarFaltas(matriculaId) {

    const { data, error } = await supabase
        .from("aula")
        .select("id, data_aula, status")
        .eq("matricula_id", matriculaId)
        .eq("status", "falta")
        .order("data_aula", { ascending: false });

    if (error) {
        console.error(error);
        faltasAluno.innerHTML = "Erro ao carregar faltas";
        return;
    }

    totalFaltas = data.length;

    if (!data.length) {
        faltasAluno.innerHTML = "Você não possui faltas.";
        return;
    }

    let html = "<ul>";

    data.forEach(f => {

        const [ano, mes, dia] = f.data_aula.split("-");
        const dataBR = `${dia}/${mes}/${ano}`;

        html += `<li>Falta em ${dataBR}</li>`;
    });

    html += "</ul>";

    html += `<p><strong>Total de faltas: ${totalFaltas}</strong></p>`;

    faltasAluno.innerHTML = html;
}



// =============================
// carregar reposições
// =============================
async function carregarReposicoes() {

    const aluno = await buscarAluno();

    if (!aluno) return;

    await carregarFaltas(aluno.matricula_id);

    if (totalFaltas === 0) {
        listaReposicoes.innerHTML = "Você não possui faltas para repor.";
        return;
    }

    const hoje = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
        .from("horarios_reposicao")
        .select(`
            id,
            data,
            hora_inicio,
            hora_fim,
            professor (nome),
            materia (nome)
        `)
        .eq("materia_id", aluno.materia_id)
        .eq("disponivel", true)
        .gte("data", hoje)
        .order("data")
        .order("hora_inicio");

    if (error) {
        console.error(error);
        mostrarMensagem("Erro ao carregar reposições", true);
        return;
    }

    listaReposicoes.innerHTML = "";

    if (!data.length) {
        listaReposicoes.innerHTML = "Nenhum horário disponível.";
        return;
    }

    data.forEach(h => {

        const [ano, mes, dia] = h.data.split("-");
        const dataBR = `${dia}/${mes}/${ano}`;

        const div = document.createElement("div");

        div.style.marginBottom = "15px";

        div.innerHTML = `
            ${dataBR} |
            ${h.hora_inicio} - ${h.hora_fim} |
            ${h.professor.nome} |
            ${h.materia.nome}
            <button class="btnEscolher" data-id="${h.id}">
                Escolher
            </button>
        `;

        listaReposicoes.appendChild(div);
    });

    ativarEscolha(aluno.id);
}



// =============================
// escolher reposição
// =============================
function ativarEscolha(alunoId) {

    document.querySelectorAll(".btnEscolher").forEach(btn => {

        btn.onclick = async () => {

            if (totalFaltas === 0) {
                mostrarMensagem("Você não possui faltas para repor", true);
                return;
            }

            const horarioId = btn.dataset.id;

            const confirmar = confirm("Deseja agendar esta reposição?");

            if (!confirmar) return;

            const { error } = await supabase
                .from("reposicao_agendada")
                .insert({
                    horario_reposicao_id: horarioId,
                    aluno_id: alunoId
                });

            if (error) {
                console.error(error);
                mostrarMensagem("Erro ao agendar", true);
                return;
            }

            await supabase
                .from("horarios_reposicao")
                .update({ disponivel: false })
                .eq("id", horarioId);

            mostrarMensagem("Reposição agendada com sucesso!");

            carregarReposicoes();
        };
    });
}



// =============================
// iniciar
// =============================
carregarReposicoes();