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

// =============================
// mensagem
// =============================
function mostrarMensagem(texto, erro = false) {
    msg.textContent = texto;
    msg.style.color = erro ? "#b42318" : "#027a48";

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

    data.forEach((p) => {
        const option = document.createElement("option");
        option.value = p.id;
        option.textContent = p.nome;
        professorSelect.appendChild(option);
    });
}

// =============================
// carregar matérias
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

    data.forEach((m) => {
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
    div.className = "linha-horario-reposicao";

    div.style.display = "flex";
    div.style.gap = "10px";
    div.style.marginBottom = "10px";
    div.style.flexWrap = "wrap";
    div.style.alignItems = "center";

    div.innerHTML = `
        <input type="time" class="horaInicio" required>
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
// salvar horários
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

    if (!horasInicio.length) {
        return mostrarMensagem("Adicione horários", true);
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user?.id) {
        console.error(userError);
        return mostrarMensagem("Não foi possível identificar o usuário logado", true);
    }

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
                created_by: userId,
                disponivel: true
            });
        }
    });

    if (!registros.length) {
        return mostrarMensagem("Preencha pelo menos um horário válido", true);
    }

    const { error } = await supabase
        .from("horarios_reposicao")
        .insert(registros);

    if (error) {
        console.error(error);
        mostrarMensagem("Erro ao salvar", true);
        return;
    }

    mostrarMensagem("Horários salvos com sucesso!");

    form.reset();
    horariosContainer.innerHTML = "";

    definirDataAmanha();
    criarLinhaHorario();
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
        horarios[index + 1]?.focus();
        return;
    }

    criarLinhaHorario(sugerirProximoHorario());

    setTimeout(() => {
        const novosHorarios = document.querySelectorAll(".horaInicio");
        novosHorarios[novosHorarios.length - 1]?.focus();
    }, 50);
});

// =============================
// iniciar
// =============================
carregarProfessores();
carregarMaterias();
definirDataAmanha();
criarLinhaHorario();