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

const boxStatus = document.getElementById("boxStatus");
const boxJustificativa = document.getElementById("boxJustificativa");

const inputJustificativa = document.getElementById("justificativa");
const inputConteudo = document.getElementById("conteudo");
const inputLicaoCasa = document.getElementById("licaoCasa");

const msg = document.getElementById("msg");

const aulaColetivaCheckbox = document.getElementById("aulaColetiva");
const listaAlunosBox = document.getElementById("listaAlunos");
const alunosSelecionadosDiv = document.getElementById("alunosSelecionados");

let alunosSelecionados = [];


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

    if (aulaColetivaCheckbox.checked) return;

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

        let proximaParte =
            data[0].parte + 1;

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

async function carregarModulos(
    materiaId,
    moduloAtual
) {

    const { data, error } =
        await supabase
            .from("modulo")
            .select("id, nome, ordem")
            .eq("materia_id", materiaId)
            .order("ordem", { ascending: true });

    if (error) {

        console.error(error);

        mostrarMensagem(
            "Erro ao carregar módulos",
            false
        );

        return;
    }

    moduloAula.innerHTML =
        `<option value="">Selecione o módulo</option>`;

    data.forEach(m => {

        const opt =
            document.createElement("option");

        opt.value = m.id;
        opt.textContent = m.nome;

        if (m.id == moduloAtual)
            opt.selected = true;

        moduloAula.appendChild(opt);
    });
}


// ======================
// VERIFICAR CANCELAMENTO
// ======================

function verificarCancelamentoColetivo() {

    const temCancelada =
        alunosSelecionados.some(
            a => a.status === "Cancelada"
        );

    boxJustificativa.style.display =
        temCancelada ? "block" : "none";
}


// ======================
// RENDERIZAR ALUNOS
// ======================

function renderizarAlunos() {

    alunosSelecionadosDiv.innerHTML = "";

    alunosSelecionados.forEach(
        (aluno, index) => {

            const div =
                document.createElement("div");

            div.classList.add("aluno-box");

            div.innerHTML = `
                <strong>${aluno.nome}</strong><br>

                Status:
                <select class="status-individual"
                        data-index="${index}">

                    <option value="Presente"
                    ${aluno.status === "Presente" ? "selected" : ""}>
                        Presente
                    </option>

                    <option value="Ausente"
                    ${aluno.status === "Ausente" ? "selected" : ""}>
                        Ausente
                    </option>

                    <option value="Cancelada"
                    ${aluno.status === "Cancelada" ? "selected" : ""}>
                        Cancelada
                    </option>

                    <option value="Trancada"
                    ${aluno.status === "Trancada" ? "selected" : ""}>
                        Trancada
                    </option>

                </select>

                <button
                    class="btn-remover-aluno"
                    data-index="${index}">
                    ✖
                </button>
            `;

            alunosSelecionadosDiv.appendChild(div);
        });

    listaAlunosBox.style.display =
        alunosSelecionados.length
            ? "block"
            : "none";

    document
        .querySelectorAll(
            ".status-individual"
        )
        .forEach(select => {

            select.addEventListener(
                "change",
                e => {

                    const index =
                        e.target.dataset.index;

                    alunosSelecionados[index]
                        .status =
                        e.target.value;

                    verificarCancelamentoColetivo();
                }
            );
        });
}


// ======================
// CARREGAR MATRICULAS
// ======================

async function carregarMatriculas() {

    const professorId =
        Number(
            localStorage.getItem(
                "professorId"
            )
        );

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

        mostrarMensagem(
            "Erro ao carregar alunos",
            false
        );

        return;
    }

    selectMatricula.innerHTML =
        `<option value="">Selecione o aluno</option>`;

    data.sort(
        (a, b) =>
            a.aluno.nome.localeCompare(
                b.aluno.nome
            )
    );

    data.forEach(m => {

        const opt =
            document.createElement("option");

        opt.value = m.id;

        opt.textContent =
            `${m.aluno.nome} — ${m.materia.nome}`;

        opt.dataset.materiaId =
            m.materia_id;

        opt.dataset.moduloAtual =
            m.modulo_id;

        selectMatricula.appendChild(opt);
    });
}


// ======================
// EVENTOS
// ======================

selectMatricula.addEventListener(
    "change",
    async () => {

        if (!aulaColetivaCheckbox.checked)
            atualizarParteAula();

        const opt =
            selectMatricula.selectedOptions[0];

        const materiaId =
            opt?.dataset.materiaId;

        const moduloAtual =
            opt?.dataset.moduloAtual;

        if (materiaId)
            await carregarModulos(
                materiaId,
                moduloAtual
            );

        if (aulaColetivaCheckbox.checked) {

            const id =
                selectMatricula.value;

            const nome =
                selectMatricula.options[
                    selectMatricula.selectedIndex
                ].text;

            if (!id) return;

            if (
                alunosSelecionados.find(
                    a => a.id == id
                )
            ) return;

            alunosSelecionados.push({
                id,
                nome,
                status: "Presente"
            });

            renderizarAlunos();

            selectMatricula.value = "";
        }
    }
);


// remover aluno

alunosSelecionadosDiv.addEventListener(
    "click",
    e => {

        if (
            e.target.classList.contains(
                "btn-remover-aluno"
            )
        ) {

            const index =
                e.target.dataset.index;

            alunosSelecionados.splice(
                index,
                1
            );

            renderizarAlunos();
        }
    }
);


// aula coletiva

aulaColetivaCheckbox.addEventListener(
    "change",
    () => {

        alunosSelecionados = [];

        renderizarAlunos();

        const coletivo =
            aulaColetivaCheckbox.checked;

        boxStatus.style.display =
            coletivo ? "none" : "block";

        selectStatus.required =
            !coletivo;

        selectStatus.disabled =
            coletivo;

        boxJustificativa.style.display =
            "none";

        carregarMatriculas();
    }
);


// justificativa

selectStatus.addEventListener(
    "change",
    () => {

        boxJustificativa.style.display =
            selectStatus.value ===
            "Cancelada"
                ? "block"
                : "none";
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
            Number(
                localStorage.getItem(
                    "professorId"
                )
            );

        const dataAula =
            inputDataAula.value;

        const parte =
            Number(selectParte.value);

        const moduloId =
            Number(moduloAula.value);

        const justificativa =
            inputJustificativa.value.trim();

        const conteudo =
            inputConteudo.value.trim();

        const licaoCasa =
            inputLicaoCasa.value.trim();

        let registros = [];

        if (!moduloId) {

            mostrarMensagem(
                "Selecione o módulo",
                false
            );

            return;
        }


        // COLETIVA

        if (aulaColetivaCheckbox.checked) {

            if (
                alunosSelecionados.length === 0
            ) {

                mostrarMensagem(
                    "Adicione alunos",
                    false
                );

                return;
            }

            registros =
                alunosSelecionados.map(
                    aluno => ({

                        matricula_id:
                            aluno.id,

                        professor_id:
                            professorId,

                        data_aula:
                            dataAula,

                        parte,

                        modulo_id:
                            moduloId,

                        status:
                            aluno.status,

                        justificativa:
                            aluno.status ===
                            "Cancelada"
                                ? justificativa
                                : null,

                        conteudo:
                            aluno.status ===
                            "Cancelada"
                                ? null
                                : conteudo,

                        licao_casa:
                            aluno.status ===
                            "Cancelada"
                                ? null
                                : licaoCasa
                    })
                );
        }

        // INDIVIDUAL

        else {

            const matriculaId =
                selectMatricula.value;

            const status =
                selectStatus.value;

            if (!matriculaId) {

                mostrarMensagem(
                    "Selecione um aluno",
                    false
                );

                return;
            }

            registros = [{

                matricula_id:
                    matriculaId,

                professor_id:
                    professorId,

                data_aula:
                    dataAula,

                parte,

                modulo_id:
                    moduloId,

                status,

                justificativa:
                    status ===
                    "Cancelada"
                        ? justificativa
                        : null,

                conteudo:
                    status ===
                    "Cancelada"
                        ? null
                        : conteudo,

                licao_casa:
                    status ===
                    "Cancelada"
                        ? null
                        : licaoCasa
            }];
        }


        const { error } =
            await supabase
                .from("aula")
                .insert(registros);

        if (error) {

            console.error(error);

            mostrarMensagem(
                "Erro ao salvar aula",
                false
            );
        }
        else {

            mostrarMensagem(
                "Aula salva com sucesso!"
            );

            form.reset();

            alunosSelecionados = [];

            renderizarAlunos();

            setarDataHoje();

            carregarMatriculas();
        }
    }
);