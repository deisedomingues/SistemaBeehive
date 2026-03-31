import { supabase } from "./supabase.js";
import { exigirAluno } from "./guard.js";

await exigirAluno();

const listaReposicoes = document.getElementById("listaReposicoes");
const msg = document.getElementById("msg");


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

    // buscar perfil
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

    // buscar aluno
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

    // buscar matrícula ativa
    const { data: matricula, error: errMatricula } = await supabase
        .from("matricula")
        .select("materia_id")
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
        materia_id: matricula.materia_id
    };
}



// =============================
// popup
// =============================
function mostrarPopup(texto, callback) {

    const popup = document.createElement("div");

    popup.style.position = "fixed";
    popup.style.top = "0";
    popup.style.left = "0";
    popup.style.width = "100%";
    popup.style.height = "100%";
    popup.style.background = "rgba(0,0,0,0.4)";
    popup.style.display = "flex";
    popup.style.alignItems = "center";
    popup.style.justifyContent = "center";

    popup.innerHTML = `
        <div style="background:white;padding:20px;border-radius:8px;text-align:center;">
            <p>${texto}</p>
            <button id="confirmar">Confirmar</button>
            <button id="cancelar">Cancelar</button>
        </div>
    `;

    document.body.appendChild(popup);

    popup.querySelector("#confirmar").onclick = () => {
        callback();
        popup.remove();
    };

    popup.querySelector("#cancelar").onclick = () => popup.remove();
}



// =============================
// carregar reposições
// =============================
async function carregarReposicoes() {

    const aluno = await buscarAluno();

    if (!aluno) return;

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
        listaReposicoes.innerHTML = "Nenhum horário disponível no momento.";
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

        btn.onclick = () => {

            const horarioId = btn.dataset.id;
            const linha = btn.parentElement;

            mostrarPopup(
                "Deseja agendar esta reposição?",
                async () => {

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

                    linha.innerHTML = "Reposição agendada";
                    linha.style.color = "green";

                    setTimeout(() => linha.remove(), 1500);

                    mostrarMensagem("Reposição agendada com sucesso!");
                }
            );
        };
    });
}



// =============================
// iniciar
// =============================
carregarReposicoes();