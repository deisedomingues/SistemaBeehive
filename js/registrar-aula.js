import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

const form = document.getElementById("form-aula");

// CAMPOS

const inputDataAula = document.getElementById("dataAula");
const selectMatricula = document.getElementById("matricula");
const selectStatus = document.getElementById("status");
const selectParte = document.getElementById("parteAula");
const moduloAula = document.getElementById("moduloAula");

const boxJustificativa = document.getElementById("boxJustificativa");
const boxAusencia = document.getElementById("boxAusencia");
const boxReposicao = document.getElementById("boxReposicao");

const inputJustificativa = document.getElementById("justificativa");
const inputConteudo = document.getElementById("conteudo");
const inputLicaoCasa = document.getElementById("licaoCasa");

const aulaGravada = document.getElementById("aulaGravada");
const precisaReposicao = document.getElementById("precisaReposicao");

const aulaOriginalId = document.getElementById("aulaOriginalId");
const reposicaoComCusto = document.getElementById("reposicaoComCusto");

const msg = document.getElementById("msg");


// ======================
// MENSAGEM
// ======================

function mostrarMensagem(texto, ok = true) {

    msg.textContent = texto;
    msg.style.display = "block";

    msg.style.backgroundColor =
        ok ? "#e8f5e9" : "#ffebee";

    msg.style.color =
        ok ? "#1b5e20" : "#b71c1c";

    setTimeout(() => {
        msg.style.display = "none";
    }, 3000);
}


// ======================
// DATA
// ======================

function setarDataHoje() {

    const hoje = new Date();

    inputDataAula.value =
        hoje.toISOString().split("T")[0];
}


// ======================
// PARTE AUTOMÁTICA
// ======================

async function atualizarParteAula() {

    const matriculaId = selectMatricula.value;
    const dataAula = inputDataAula.value;

    if (!matriculaId || !dataAula) return;

    const { data } = await supabase
        .from("aula")
        .select("parte")
        .eq("matricula_id", matriculaId)
        .eq("data_aula", dataAula)
        .order("parte", { ascending: false })
        .limit(1);

    if (data && data.length > 0) {

        let proximaParte = data[0].parte + 1;

        if (proximaParte > 5)
            proximaParte = 5;

        selectParte.value = proximaParte;
    }
    else {
        selectParte.value = 1;
    }
}


// ======================
// CARREGAR MODULOS
// ======================

async function carregarModulos(materiaId, moduloAtual) {

    const { data, error } =
        await supabase
            .from("modulo")
            .select("id, nome, ordem")
            .eq("materia_id", materiaId)
            .order("ordem", { ascending: true });

    if (error) {
        console.error(error);
        mostrarMensagem("Erro ao carregar módulos", false);
        return;
    }

    moduloAula.innerHTML =
        `<option value="">Selecione o módulo</option>`;

    data.forEach(m => {

        const opt = document.createElement("option");

        opt.value = m.id;
        opt.textContent = m.nome;

        if (m.id == moduloAtual)
            opt.selected = true;

        moduloAula.appendChild(opt);
    });
}


// ======================
// CARREGAR AULAS PENDENTES
// ======================

async function carregarAulasPendentes() {

    const matriculaId = selectMatricula.value;

    if (!matriculaId) return;

    aulaOriginalId.innerHTML =
        `<option>Carregando...</option>`;

    const { data, error } = await supabase
        .from("aula")
        .select("id, data_aula, status")
        .eq("matricula_id", matriculaId)
        .eq("precisa_reposicao", true)
        .order("data_aula", { ascending: true });

    if (error) {

        console.error(error);
        mostrarMensagem("Erro ao carregar aulas", false);
        return;
    }

    aulaOriginalId.innerHTML =
        `<option value="">Selecione a aula</option>`;

    if (!data.length) {

        aulaOriginalId.innerHTML =
            `<option>Nenhuma aula pendente</option>`;

        return;
    }

    data.forEach(aula => {

        const opt = document.createElement("option");

        opt.value = aula.id;

        opt.textContent =
            `${aula.data_aula} — ${aula.status}`;

        aulaOriginalId.appendChild(opt);
    });
}


// ======================
// STATUS
// ======================

selectStatus.addEventListener("change", async () => {

    const status = selectStatus.value;

    boxJustificativa.style.display =
        status === "Cancelada" ? "block" : "none";

    boxAusencia.style.display =
        status === "Ausente" ? "block" : "none";

    if (status === "Reposicao") {

        boxReposicao.style.display = "block";
        await carregarAulasPendentes();
    }
    else {
        boxReposicao.style.display = "none";
    }
});


// evitar conflito

precisaReposicao.addEventListener("change", () => {
    if (precisaReposicao.checked)
        aulaGravada.checked = false;
});

aulaGravada.addEventListener("change", () => {
    if (aulaGravada.checked)
        precisaReposicao.checked = false;
});


// ======================
// CARREGAR MATRICULAS
// ======================

async function carregarMatriculas() {

    const professorId =
        Number(localStorage.getItem("professorId"));

    const { data, error } =
        await supabase
            .from("matricula")
            .select(`
                id,
                materia_id,
                modulo_id,
                aluno:aluno_id ( nome ),
                materia:materia_id ( nome )
            `)
            .eq("professor_id", professorId)
            .eq("ativa", true);

    if (error) {
        console.error(error);
        mostrarMensagem("Erro ao carregar alunos", false);
        return;
    }

    selectMatricula.innerHTML =
        `<option value="">Selecione o aluno</option>`;

    data.sort(
        (a, b) =>
            a.aluno.nome.localeCompare(b.aluno.nome)
    );

    data.forEach(m => {

        const opt = document.createElement("option");

        opt.value = m.id;

        opt.textContent =
            `${m.aluno.nome} — ${m.materia.nome}`;

        opt.dataset.materiaId = m.materia_id;
        opt.dataset.moduloAtual = m.modulo_id;

        selectMatricula.appendChild(opt);
    });
}


// ======================
// EVENTOS
// ======================

selectMatricula.addEventListener(
    "change",
    async () => {

        atualizarParteAula();

        const opt =
            selectMatricula.selectedOptions[0];

        const materiaId = opt?.dataset.materiaId;
        const moduloAtual = opt?.dataset.moduloAtual;

        if (materiaId)
            await carregarModulos(
                materiaId,
                moduloAtual
            );

        if (selectStatus.value === "Reposicao")
            carregarAulasPendentes();
    }
);

inputDataAula.addEventListener(
    "change",
    atualizarParteAula
);


// ======================
// INIT
// ======================

setarDataHoje();
carregarMatriculas();


// ======================
// SALVAR
// ======================

form.addEventListener(
    "submit",
    async e => {

        e.preventDefault();

        const professorId =
            Number(localStorage.getItem("professorId"));

        const matriculaId = selectMatricula.value;
        const status = selectStatus.value;
        const dataAula = inputDataAula.value;
        const parte = Number(selectParte.value);
        const moduloId = Number(moduloAula.value);

        if (!matriculaId)
            return mostrarMensagem("Selecione o aluno", false);

        if (!moduloId)
            return mostrarMensagem("Selecione o módulo", false);

        if (status === "Reposicao" && !aulaOriginalId.value)
            return mostrarMensagem("Selecione a aula faltada", false);


        const registro = {

            matricula_id: matriculaId,
            professor_id: professorId,
            data_aula: dataAula,
            parte,
            modulo_id: moduloId,
            status,

            justificativa:
                status === "Cancelada"
                    ? inputJustificativa.value.trim()
                    : null,

            conteudo:
                status === "Cancelada"
                    ? null
                    : inputConteudo.value.trim(),

            licao_casa:
                status === "Cancelada"
                    ? null
                    : inputLicaoCasa.value.trim(),

            aula_gravada:
                status === "Ausente"
                    ? aulaGravada.checked
                    : status === "Presente",

            precisa_reposicao:
                status === "Ausente"
                    ? precisaReposicao.checked
                    : status === "Cancelada",

            aula_original_id:
                status === "Reposicao"
                    ? aulaOriginalId.value
                    : null,

            reposicao_com_custo:
                status === "Reposicao"
                    ? reposicaoComCusto.checked
                    : false
        };


        const { error } =
            await supabase
                .from("aula")
                .insert([registro]);

        if (error) {

            console.error(error);
            mostrarMensagem("Erro ao salvar aula", false);
        }
        else {

            mostrarMensagem("Aula salva com sucesso!");

            form.reset();

            aulaGravada.checked = false;
            precisaReposicao.checked = false;
            reposicaoComCusto.checked = false;

            aulaOriginalId.innerHTML =
                `<option>Selecione o aluno primeiro</option>`;

            boxAusencia.style.display = "none";
            boxReposicao.style.display = "none";
            boxJustificativa.style.display = "none";

            setarDataHoje();
            carregarMatriculas();
        }
    }
);