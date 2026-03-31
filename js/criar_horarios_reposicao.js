import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const professorSelect = document.getElementById("professor");
const dataInput = document.getElementById("data");
const horariosContainer = document.getElementById("horariosContainer");
const addHorarioBtn = document.getElementById("addHorario");
const form = document.getElementById("formHorario");
const msg = document.getElementById("msg");
const listaReposicoes = document.getElementById("listaReposicoes");



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
// data de amanhã
// =============================
function definirDataAmanha() {

    const hoje = new Date();

    hoje.setDate(hoje.getDate() + 1);

    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");

    dataInput.value = `${ano}-${mes}-${dia}`;
}



// =============================
// carregar professores
// =============================
async function carregarProfessores() {

    const { data, error } = await supabase
        .from("professor")
        .select("id, nome")
        .order("nome");

    if (error) {
        console.error(error);
        mostrarMensagem("Erro ao carregar professores", true);
        return;
    }

    professorSelect.innerHTML = `
        <option value="">Escolha o professor</option>
    `;

    data.forEach(p => {

        const option = document.createElement("option");
        option.value = p.id;
        option.textContent = p.nome;

        professorSelect.appendChild(option);
    });
}



// =============================
// criar linha de horário
// =============================
function criarLinhaHorario(horaSugerida = "") {

    const div = document.createElement("div");

    div.style.display = "flex";
    div.style.gap = "10px";
    div.style.marginBottom = "10px";

    div.innerHTML = `
        <input type="time" class="horaInicio" value="${horaSugerida}">
        <input type="time" class="horaFim" readonly>
        <button type="button" class="remover btn">X</button>
    `;

    const horaInicio = div.querySelector(".horaInicio");
    const horaFim = div.querySelector(".horaFim");
    const remover = div.querySelector(".remover");



    function calcularHoraFim() {

        if (!horaInicio.value) {
            horaFim.value = "";
            return;
        }

        const [h, m] = horaInicio.value.split(":").map(Number);

        const dataHora = new Date();
        dataHora.setHours(h);
        dataHora.setMinutes(m + 40);
        dataHora.setSeconds(0);

        const hora = String(dataHora.getHours()).padStart(2, "0");
        const min = String(dataHora.getMinutes()).padStart(2, "0");

        horaFim.value = `${hora}:${min}`;
    }

    horaInicio.addEventListener("input", calcularHoraFim);

    calcularHoraFim();

    remover.addEventListener("click", () => {
        div.remove();
    });

    horariosContainer.appendChild(div);
}



// =============================
// sugerir próximo horário
// =============================
function sugerirProximoHorario() {

    const horarios = document.querySelectorAll(".horaFim");

    if (horarios.length === 0) return "";

    const ultimo = horarios[horarios.length - 1].value;

    return ultimo || "";
}



// =============================
// adicionar horário
// =============================
addHorarioBtn.addEventListener("click", () => {

    const proximo = sugerirProximoHorario();
    criarLinhaHorario(proximo);
});



// =============================
// carregar reposições futuras
// =============================
async function carregarReposicoes() {

    const hoje = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
        .from("horarios_reposicao")
        .select(`
            id,
            data,
            hora_inicio,
            hora_fim,
            professor (
                nome
            ),
            reposicao_agendada (
                aluno (
                    nome
                )
            )
        `)
        .gte("data", hoje)
        .order("data", { ascending: true })
        .order("hora_inicio", { ascending: true });

    if (error) {
        console.error(error);
        return;
    }

    listaReposicoes.innerHTML = "";

    if (!data.length) {
        listaReposicoes.innerHTML = "Nenhuma reposição futura.";
        return;
    }

    data.forEach(h => {

        let status = "Disponível";

        if (h.reposicao_agendada.length > 0) {
            status = `Escolhido por ${h.reposicao_agendada[0].aluno.nome}`;
        }

        // formatar data brasileira
        const [ano, mes, dia] = h.data.split("-");
        const dataBR = `${dia}/${mes}/${ano}`;

        const div = document.createElement("div");

        div.style.marginBottom = "15px";
        div.style.fontSize = "14px";

        div.innerHTML = `
            ${dataBR} | 
            ${h.hora_inicio} - ${h.hora_fim} | 
            ${h.professor.nome} | 
            ${status}
            <button class="btnExcluir" data-id="${h.id}" 
                style="margin-left:10px; background:#ff4d4d; color:white; border:none; padding:3px 8px; cursor:pointer;">
                x
            </button>
        `;

        listaReposicoes.appendChild(div);
    });

    ativarExclusao();
}

// =============================
// salvar
// =============================
form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const professorId = professorSelect.value;
    const data = dataInput.value;

    if (!professorId) {
        mostrarMensagem("Selecione um professor", true);
        return;
    }

    if (!data) {
        mostrarMensagem("Selecione a data", true);
        return;
    }

    const horasInicio = document.querySelectorAll(".horaInicio");
    const horasFim = document.querySelectorAll(".horaFim");

    if (horasInicio.length === 0) {
        mostrarMensagem("Adicione pelo menos um horário", true);
        return;
    }

    const { data: userData, error: errUser } = await supabase.auth.getUser();

    if (errUser || !userData?.user) {
        mostrarMensagem("Erro ao validar usuário", true);
        return;
    }

    const userId = userData.user.id;

    const registros = [];

    horasInicio.forEach((h, i) => {

        if (h.value && horasFim[i].value) {

            registros.push({
                data: data,
                hora_inicio: h.value,
                hora_fim: horasFim[i].value,
                professor_id: professorId,
                created_by: userId
            });

        }

    });

    if (!registros.length) {
        mostrarMensagem("Horários inválidos", true);
        return;
    }

    const { error } = await supabase
        .from("horarios_reposicao")
        .insert(registros);

    if (error) {
        console.error(error);
        mostrarMensagem("Erro ao salvar horários", true);
        return;
    }

    mostrarMensagem("Horários salvos com sucesso");

    form.reset();
    horariosContainer.innerHTML = "";

    definirDataAmanha();
    criarLinhaHorario();

    // atualizar lista
    carregarReposicoes();
});

// =============================
// excluir reposição
// =============================
function ativarExclusao() {

    const botoes = document.querySelectorAll(".btnExcluir");

    botoes.forEach(btn => {

        btn.addEventListener("click", async () => {

            const id = btn.dataset.id;

            if (!confirm("Deseja excluir esta reposição?")) return;

            const linha = btn.parentElement;

            const { error } = await supabase
                .from("horarios_reposicao")
                .delete()
                .eq("id", id);

            if (error) {
                console.error(error);
                mostrarMensagem("Erro ao excluir", true);
                return;
            }

            // mensagem no próprio lugar
            linha.innerHTML = "Reposição excluída";
            linha.style.color = "green";
            linha.style.marginBottom = "15px";

            // remover depois
            setTimeout(() => {
                linha.remove();
            }, 2000);
        });

    });
}


// =============================
// ENTER cria novo horário
// =============================
form.addEventListener("keydown", (e) => {

    if (e.key !== "Enter") return;

    const elemento = document.activeElement;

    if (!elemento.classList.contains("horaInicio")) return;

    e.preventDefault();

    const horarios = document.querySelectorAll(".horaInicio");
    const ultimo = horarios[horarios.length - 1];

    if (elemento !== ultimo) {

        const index = Array.from(horarios).indexOf(elemento);
        horarios[index + 1].focus();

        return;
    }

    const proximo = sugerirProximoHorario();

    criarLinhaHorario(proximo);

    setTimeout(() => {

        const novosHorarios = document.querySelectorAll(".horaInicio");
        novosHorarios[novosHorarios.length - 1].focus();

    }, 50);
});



// =============================
// iniciar
// =============================
carregarProfessores();
definirDataAmanha();
criarLinhaHorario();
carregarReposicoes();