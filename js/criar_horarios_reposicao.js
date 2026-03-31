import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const professorSelect = document.getElementById("professor");
const materiaSelect = document.getElementById("materia");
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

    professorSelect.innerHTML = `<option value="">Escolha o professor</option>`;

    data.forEach(p => {

        const option = document.createElement("option");
        option.value = p.id;
        option.textContent = p.nome;

        professorSelect.appendChild(option);
    });
}



// =============================
// carregar materias
// =============================
async function carregarMaterias() {

    const { data, error } = await supabase
        .from("materia")
        .select("id, nome")
        .order("nome");

    if (error) {
        console.error(error);
        mostrarMensagem("Erro ao carregar cursos", true);
        return;
    }

    materiaSelect.innerHTML = `<option value="">Escolha o curso</option>`;

    data.forEach(m => {

        const option = document.createElement("option");
        option.value = m.id;
        option.textContent = m.nome;

        materiaSelect.appendChild(option);
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
        <input type="time" class="horaInicio">
        <input type="time" class="horaFim" readonly>
        <button type="button" class="remover btn">x</button>
    `;

    const horaInicio = div.querySelector(".horaInicio");
    const horaFim = div.querySelector(".horaFim");
    const remover = div.querySelector(".remover");

    horaInicio.value = horaSugerida;

    function calcularHoraFim() {

        if (!horaInicio.value) {
            horaFim.value = "";
            return;
        }

        const [h, m] = horaInicio.value.split(":").map(Number);

        const dataHora = new Date();
        dataHora.setHours(h);
        dataHora.setMinutes(m + 40);

        const hora = String(dataHora.getHours()).padStart(2, "0");
        const min = String(dataHora.getMinutes()).padStart(2, "0");

        horaFim.value = `${hora}:${min}`;
    }

    horaInicio.addEventListener("input", calcularHoraFim);

    calcularHoraFim();

    remover.addEventListener("click", () => div.remove());

    horariosContainer.appendChild(div);
}



// =============================
// sugerir próximo horário
// =============================
function sugerirProximoHorario() {

    const horarios = document.querySelectorAll(".horaFim");

    if (!horarios.length) return "";

    return horarios[horarios.length - 1].value;
}



// =============================
// adicionar horário
// =============================
addHorarioBtn.addEventListener("click", () => {

    criarLinhaHorario(sugerirProximoHorario());
});



// =============================
// popup bonito
// =============================
function mostrarPopupConfirmacao(texto, callback) {

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
            <button id="sim">Sim</button>
            <button id="nao">Cancelar</button>
        </div>
    `;

    document.body.appendChild(popup);

    popup.querySelector("#sim").onclick = () => {
        callback();
        popup.remove();
    };

    popup.querySelector("#nao").onclick = () => popup.remove();
}



// =============================
// carregar reposições
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
            professor (nome),
            materia (nome),
            reposicao_agendada (
                aluno (nome)
            )
        `)
        .gte("data", hoje)
        .order("data")
        .order("hora_inicio");

    if (error) {
        console.error(error);
        return;
    }

    listaReposicoes.innerHTML = "";

    data.forEach(h => {

        let status = "Disponível";

        if (h.reposicao_agendada.length > 0) {
            status = `Escolhido por ${h.reposicao_agendada[0].aluno.nome}`;
        }

        const [ano, mes, dia] = h.data.split("-");
        const dataBR = `${dia}/${mes}/${ano}`;

        const div = document.createElement("div");

        div.style.marginBottom = "15px";

        div.innerHTML = `
            ${dataBR} |
            ${h.hora_inicio} - ${h.hora_fim} |
            ${h.professor.nome} |
            ${h.materia.nome} |
            ${status}
            <button class="btnExcluir" data-id="${h.id}">x</button>
        `;

        listaReposicoes.appendChild(div);
    });

    ativarExclusao();
}



// =============================
// excluir com fade
// =============================
function ativarExclusao() {

    document.querySelectorAll(".btnExcluir").forEach(btn => {

        btn.onclick = () => {

            const id = btn.dataset.id;
            const linha = btn.parentElement;

            mostrarPopupConfirmacao(
                "Deseja excluir esta reposição?",
                async () => {

                    const { error } = await supabase
                        .from("horarios_reposicao")
                        .delete()
                        .eq("id", id);

                    if (error) {
                        mostrarMensagem("Erro ao excluir", true);
                        return;
                    }

                    linha.innerHTML = "Reposição excluída";
                    linha.style.color = "green";
                    linha.style.transition = "opacity 1.5s ease";

                    setTimeout(() => linha.style.opacity = "0", 500);
                    setTimeout(() => linha.remove(), 2000);
                }
            );
        };
    });
}



// =============================
// salvar
// =============================
form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const professorId = professorSelect.value;
    const materiaId = materiaSelect.value;
    const data = dataInput.value;

    if (!professorId) return mostrarMensagem("Selecione o professor", true);
    if (!materiaId) return mostrarMensagem("Selecione o curso", true);
    if (!data) return mostrarMensagem("Selecione a data", true);

    const horasInicio = document.querySelectorAll(".horaInicio");
    const horasFim = document.querySelectorAll(".horaFim");

    if (!horasInicio.length)
        return mostrarMensagem("Adicione horários", true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user.id;

    const registros = [];

    horasInicio.forEach((h, i) => {

        if (h.value && horasFim[i].value) {

            registros.push({
                data,
                hora_inicio: h.value,
                hora_fim: horasFim[i].value,
                professor_id: professorId,
                materia_id: materiaId,
                created_by: userId
            });
        }
    });

    const { error } = await supabase
        .from("horarios_reposicao")
        .insert(registros);

    if (error) {
        console.error(error);
        mostrarMensagem("Erro ao salvar", true);
        return;
    }

    mostrarMensagem("Horários salvos");

    form.reset();
    horariosContainer.innerHTML = "";

    definirDataAmanha();
    criarLinhaHorario();
    carregarReposicoes();
});



// =============================
// ENTER cria novo horário
// =============================
form.addEventListener("keydown", (e) => {

    if (e.key !== "Enter") return;

    const el = document.activeElement;

    if (!el.classList.contains("horaInicio")) return;

    e.preventDefault();

    const horarios = document.querySelectorAll(".horaInicio");
    const ultimo = horarios[horarios.length - 1];

    if (el !== ultimo) {
        const index = Array.from(horarios).indexOf(el);
        horarios[index + 1].focus();
        return;
    }

    criarLinhaHorario(sugerirProximoHorario());

    setTimeout(() => {
        document
            .querySelectorAll(".horaInicio")
            .item(horarios.length)
            .focus();
    }, 50);
});



// =============================
// iniciar
// =============================
carregarProfessores();
carregarMaterias();
definirDataAmanha();
criarLinhaHorario();
carregarReposicoes();