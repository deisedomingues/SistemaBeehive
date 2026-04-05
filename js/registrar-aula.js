import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

// ==========================================
// 1. ELEMENTOS
// ==========================================
const form = document.getElementById("form-aula");
const inputDataAula = document.getElementById("dataAula");
const aulaColetivaCheckbox = document.getElementById("aulaColetiva");
const selectMatricula = document.getElementById("matricula");
const listaAlunosBox = document.getElementById("listaAlunos");
const alunosSelecionadosDiv = document.getElementById("alunosSelecionados");

const boxStatusGeral = document.getElementById("boxStatus");
const selectStatusGeral = document.getElementById("status");
const boxAusenciaGeral = document.getElementById("boxAusencia");
const boxReposicaoGeral = document.getElementById("boxReposicao");

const selectParte = document.getElementById("parteAula");
const moduloAula = document.getElementById("moduloAula");
const boxJustificativaGeral = document.getElementById("boxJustificativa");
const inputJustificativa = document.getElementById("justificativa");
const inputConteudo = document.getElementById("conteudo");
const inputLicaoCasa = document.getElementById("licaoCasa");

const inputAulaGravada = document.getElementById("aulaGravada");
const inputPrecisaReposicao = document.getElementById("precisaReposicao");

const aulaOriginalIdGeral = document.getElementById("aulaOriginalId");
const reposicaoComCustoGeral = document.getElementById("reposicaoComCusto");

const msg = document.getElementById("msg");

let matriculasLista = [];

// controle da aula coletiva
let materiaColetivaId = null;
let moduloBaseColetivo = null;

// ==========================================
// 2. FUNÇÕES AUXILIARES
// ==========================================
function mostrarMensagem(texto, ok = true) {
    msg.textContent = texto;
    msg.style.display = "block";
    msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
    msg.style.color = ok ? "#1b5e20" : "#b71c1c";
    msg.style.padding = "10px 12px";
    msg.style.borderRadius = "10px";
    msg.style.marginBottom = "16px";

    setTimeout(() => {
        msg.style.display = "none";
    }, 3500);
}

function setarDataHoje() {
    inputDataAula.value = new Date().toISOString().split("T")[0];
}

function formatarDataBR(dataISO) {
    if (!dataISO) return "";
    const [ano, mes, dia] = dataISO.split("-");
    return `${dia}/${mes}/${ano}`;
}

function limparCamposAuxiliaresGerais() {
    boxAusenciaGeral.style.display = "none";
    boxReposicaoGeral.style.display = "none";
    boxJustificativaGeral.style.display = "none";

    inputAulaGravada.checked = false;
    inputPrecisaReposicao.checked = false;
    aulaOriginalIdGeral.innerHTML = `<option value="">Selecione o aluno primeiro</option>`;
    reposicaoComCustoGeral.checked = false;
    inputJustificativa.value = "";
}

function limparEstadoColetivo() {
    matriculasLista = [];
    materiaColetivaId = null;
    moduloBaseColetivo = null;
    alunosSelecionadosDiv.innerHTML = "";
    listaAlunosBox.style.display = "none";
}

function precisaMostrarJustificativaGeral() {
    const status = selectStatusGeral.value;

    if (status === "Cancelada") return true;
    if (status === "Ausente" && inputPrecisaReposicao.checked) return true;

    return false;
}

function atualizarBoxJustificativaGeral() {
    boxJustificativaGeral.style.display = precisaMostrarJustificativaGeral() ? "block" : "none";
}

function validarJustificativaObrigatoria(status, precisaReposicao, justificativa) {
    const texto = (justificativa || "").trim();

    if (status === "Cancelada" && !texto) {
        return "Preencha a justificativa da aula cancelada.";
    }

    if (status === "Ausente" && precisaReposicao && !texto) {
        return "Preencha a justificativa da ausência com reposição.";
    }

    return null;
}

function criarOpcaoAulaPendente(aula) {
    const dataBR = formatarDataBR(aula.data_aula);
    const justificativa = aula.justificativa?.trim()
        ? ` - ${aula.justificativa.trim()}`
        : "";

    return `<option value="${aula.id}">${dataBR}${justificativa}</option>`;
}

// ==========================================
// 3. BUSCAS
// ==========================================
async function buscarAulasPendentes(matriculaId) {
    const { data, error } = await supabase
        .from("aula")
        .select("id, data_aula, status, justificativa")
        .eq("matricula_id", matriculaId)
        .eq("precisa_reposicao", true)
        .order("data_aula", { ascending: true });

    if (error) {
        console.error("Erro ao buscar aulas pendentes:", error);
        return [];
    }

    return data || [];
}

async function carregarMatriculas() {
    const professorId = Number(localStorage.getItem("professorId"));

    const { data, error } = await supabase
        .from("matricula")
        .select(`
            id,
            materia_id,
            modulo_id,
            aluno:aluno_id(nome),
            materia:materia_id(nome)
        `)
        .eq("professor_id", professorId)
        .eq("ativa", true);

    if (error) {
        console.error("Erro ao carregar matrículas:", error);
        selectMatricula.innerHTML = `<option value="">Erro ao carregar alunos</option>`;
        return;
    }

    selectMatricula.innerHTML = `<option value="">Selecione o aluno</option>`;

    (data || [])
        .sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome))
        .forEach(m => {
            const opt = document.createElement("option");
            opt.value = m.id;
            opt.textContent = `${m.aluno.nome} — ${m.materia.nome}`;
            opt.dataset.materiaId = m.materia_id;
            opt.dataset.moduloAtual = m.modulo_id;
            opt.dataset.materiaNome = m.materia.nome;
            selectMatricula.appendChild(opt);
        });
}

async function carregarModulos(materiaId, moduloAtual = null) {
    if (!materiaId) {
        moduloAula.innerHTML = `<option value="">Selecione o módulo</option>`;
        return;
    }

    const { data, error } = await supabase
        .from("modulo")
        .select("id, nome")
        .eq("materia_id", materiaId)
        .order("ordem");

    if (error) {
        console.error("Erro ao carregar módulos:", error);
        moduloAula.innerHTML = `<option value="">Erro ao carregar módulos</option>`;
        return;
    }

    moduloAula.innerHTML = `<option value="">Selecione o módulo</option>`;

    (data || []).forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.nome;

        if (moduloAtual && String(m.id) === String(moduloAtual)) {
            opt.selected = true;
        }

        moduloAula.appendChild(opt);
    });
}

// ==========================================
// 4. AULA COLETIVA
// ==========================================
async function renderizarAlunosColetivo() {
    alunosSelecionadosDiv.innerHTML = "";

    for (const [index, aluno] of matriculasLista.entries()) {
        let htmlExtras = "";

        const precisaJustificativa =
            aluno.status === "Cancelada" ||
            (aluno.status === "Ausente" && aluno.precisaReposicao);

        if (aluno.status === "Ausente") {
            htmlExtras = `
                <div style="margin-top:10px; background:#fff; padding:10px; border-radius:8px; border:1px solid #eee;">
                    <label style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                        <input type="checkbox" class="gravada-ind" data-index="${index}" ${aluno.aulaGravada ? "checked" : ""}>
                        Aula gravada
                    </label>

                    <label style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" class="reposicao-ind" data-index="${index}" ${aluno.precisaReposicao ? "checked" : ""}>
                        Precisa de reposição
                    </label>

                    ${
                        aluno.precisaReposicao
                            ? `
                                <div style="margin-top:10px;">
                                    <label style="font-size:13px;">
                                        Justificativa
                                        <input
                                            type="text"
                                            class="justificativa-ind"
                                            data-index="${index}"
                                            value="${aluno.justificativa || ""}"
                                            placeholder="Ex: reagendamento solicitado / compromisso / falta justificada"
                                            style="width:100%; margin-top:5px;"
                                        >
                                    </label>
                                </div>
                            `
                            : ""
                    }
                </div>
            `;
        } else if (aluno.status === "Cancelada") {
            htmlExtras = `
                <div style="margin-top:10px; background:#fff; padding:10px; border-radius:8px; border:1px solid #eee;">
                    <label style="font-size:13px;">
                        Justificativa
                        <input
                            type="text"
                            class="justificativa-ind"
                            data-index="${index}"
                            value="${aluno.justificativa || ""}"
                            placeholder="Ex: professor sem luz / escola fechada / professor doente"
                            style="width:100%; margin-top:5px;"
                        >
                    </label>
                </div>
            `;
        } else if (aluno.status === "Reposicao") {
            const pendentes = await buscarAulasPendentes(aluno.id);

            htmlExtras = `
                <div style="margin-top:10px; background:#fff; padding:10px; border-radius:8px; border:1px solid #eee;">
                    <label style="font-size:13px; font-weight:bold; display:block; margin-bottom:6px;">
                        Aula faltada
                    </label>

                    <select class="aula-original-ind" data-index="${index}" style="width:100%; margin-bottom:8px; font-size:12px;">
                        <option value="">Selecione a falta...</option>
                        ${pendentes.map(p => criarOpcaoAulaPendente(p)).join("")}
                    </select>

                    <label style="display:flex; align-items:center; gap:8px; font-size:12px;">
                        <input type="checkbox" class="custo-ind" data-index="${index}" ${aluno.reposicaoComCusto ? "checked" : ""}>
                        Reposição com custo
                    </label>
                </div>
            `;
        }

        const div = document.createElement("div");
        div.className = "aluno-box";
        div.style.cssText = `
            background:#FFF5CC;
            padding:15px;
            margin-bottom:10px;
            border-radius:10px;
            border:1px solid #FDCC0C;
            position:relative;
        `;

        div.innerHTML = `
            <button
                type="button"
                class="btn-remover-aluno"
                data-index="${index}"
                style="
                    position:absolute;
                    right:10px;
                    top:10px;
                    background:#ff6b6b;
                    color:white;
                    border:none;
                    border-radius:5px;
                    cursor:pointer;
                    width:24px;
                    height:24px;
                "
            >
                ✕
            </button>

            <strong>${aluno.nome}</strong><br>
            <small style="display:block; margin-top:4px; color:#555;">
                Curso: ${aluno.materiaNome}
            </small>

            <select
                class="status-individual"
                data-index="${index}"
                style="width:100%; margin-top:8px; padding:8px; border-radius:6px;"
            >
                <option value="Presente" ${aluno.status === "Presente" ? "selected" : ""}>Presente</option>
                <option value="Ausente" ${aluno.status === "Ausente" ? "selected" : ""}>Ausente</option>
                <option value="Cancelada" ${aluno.status === "Cancelada" ? "selected" : ""}>Cancelada</option>
                <option value="Reposicao" ${aluno.status === "Reposicao" ? "selected" : ""}>Reposição</option>
                <option value="Trancada" ${aluno.status === "Trancada" ? "selected" : ""}>Trancada</option>
            </select>

            ${htmlExtras}
        `;

        alunosSelecionadosDiv.appendChild(div);

        if (aluno.status === "Reposicao") {
            const selectAula = div.querySelector(".aula-original-ind");
            if (selectAula && aluno.aulaOriginalId) {
                selectAula.value = aluno.aulaOriginalId;
            }
        }

        if (precisaJustificativa) {
            const inputJust = div.querySelector(".justificativa-ind");
            if (inputJust) {
                inputJust.value = aluno.justificativa || "";
            }
        }
    }

    vincularEventosIndividuais();
}

function vincularEventosIndividuais() {
    document.querySelectorAll(".status-individual").forEach(sel => {
        sel.onchange = async (e) => {
            const index = Number(e.target.dataset.index);
            const novoStatus = e.target.value;

            matriculasLista[index].status = novoStatus;

            if (novoStatus !== "Ausente") {
                matriculasLista[index].aulaGravada = false;
                matriculasLista[index].precisaReposicao = false;
            }

            if (novoStatus !== "Reposicao") {
                matriculasLista[index].aulaOriginalId = null;
                matriculasLista[index].reposicaoComCusto = false;
            }

            if (novoStatus !== "Cancelada" && novoStatus !== "Ausente") {
                matriculasLista[index].justificativa = "";
            }

            await renderizarAlunosColetivo();
        };
    });

    document.querySelectorAll(".gravada-ind").forEach(chk => {
        chk.onchange = async (e) => {
            const index = Number(e.target.dataset.index);
            matriculasLista[index].aulaGravada = e.target.checked;

            if (e.target.checked) {
                matriculasLista[index].precisaReposicao = false;
                matriculasLista[index].justificativa = "";
            }

            await renderizarAlunosColetivo();
        };
    });

    document.querySelectorAll(".reposicao-ind").forEach(chk => {
        chk.onchange = async (e) => {
            const index = Number(e.target.dataset.index);
            matriculasLista[index].precisaReposicao = e.target.checked;

            if (e.target.checked) {
                matriculasLista[index].aulaGravada = false;
            }

            if (!e.target.checked) {
                matriculasLista[index].justificativa = "";
            }

            await renderizarAlunosColetivo();
        };
    });

    document.querySelectorAll(".justificativa-ind").forEach(input => {
        input.oninput = (e) => {
            const index = Number(e.target.dataset.index);
            matriculasLista[index].justificativa = e.target.value;
        };
    });

    document.querySelectorAll(".aula-original-ind").forEach(sel => {
        sel.onchange = (e) => {
            const index = Number(e.target.dataset.index);
            matriculasLista[index].aulaOriginalId = e.target.value || null;
        };
    });

    document.querySelectorAll(".custo-ind").forEach(chk => {
        chk.onchange = (e) => {
            const index = Number(e.target.dataset.index);
            matriculasLista[index].reposicaoComCusto = e.target.checked;
        };
    });

    document.querySelectorAll(".btn-remover-aluno").forEach(btn => {
        btn.onclick = async (e) => {
            const idx = Number(e.target.closest("button").dataset.index);
            matriculasLista.splice(idx, 1);

            if (matriculasLista.length === 0) {
                limparEstadoColetivo();
                moduloAula.innerHTML = `<option value="">Selecione o módulo</option>`;
                return;
            }

            await renderizarAlunosColetivo();
        };
    });
}

// ==========================================
// 5. EVENTOS DE INTERFACE
// ==========================================
aulaColetivaCheckbox.addEventListener("change", async () => {
    const isColetivo = aulaColetivaCheckbox.checked;

    if (boxStatusGeral) {
        boxStatusGeral.style.display = isColetivo ? "none" : "block";

        if (isColetivo) {
            selectStatusGeral.removeAttribute("required");
        } else {
            selectStatusGeral.setAttribute("required", "required");
        }
    }

    limparCamposAuxiliaresGerais();

    if (!isColetivo) {
        limparEstadoColetivo();
        moduloAula.innerHTML = `<option value="">Selecione o módulo</option>`;
    } else if (matriculasLista.length > 0) {
        listaAlunosBox.style.display = "block";
        await renderizarAlunosColetivo();
    }
});

selectMatricula.addEventListener("change", async () => {
    const id = selectMatricula.value;
    if (!id) return;

    const opt = selectMatricula.selectedOptions[0];
    const materiaId = opt.dataset.materiaId;
    const moduloAtual = opt.dataset.moduloAtual;
    const materiaNome = opt.dataset.materiaNome;

    if (aulaColetivaCheckbox.checked) {
        const jaExiste = matriculasLista.find(a => String(a.id) === String(id));

        if (jaExiste) {
            mostrarMensagem("Esse aluno já foi adicionado na aula coletiva.", false);
            selectMatricula.value = "";
            return;
        }

        // primeiro aluno da aula coletiva
        if (matriculasLista.length === 0) {
            materiaColetivaId = materiaId;
            moduloBaseColetivo = moduloAtual;

            await carregarModulos(materiaId, moduloAtual);
        } else {
            // impede misturar cursos diferentes
            if (String(materiaId) !== String(materiaColetivaId)) {
                mostrarMensagem("Em aula coletiva, todos os alunos precisam ser do mesmo curso.", false);
                selectMatricula.value = "";
                return;
            }
        }

        matriculasLista.push({
            id: id,
            nome: opt.textContent,
            materiaId: materiaId,
            materiaNome: materiaNome,
            moduloAtual: moduloAtual,
            status: "Presente",
            aulaGravada: false,
            precisaReposicao: false,
            justificativa: "",
            aulaOriginalId: null,
            reposicaoComCusto: false
        });

        listaAlunosBox.style.display = "block";
        await renderizarAlunosColetivo();

        selectMatricula.value = "";
        return;
    }

    await carregarModulos(materiaId, moduloAtual);

    if (selectStatusGeral.value === "Reposicao") {
        await carregarAulasPendentesGeral();
    }
});

selectStatusGeral.addEventListener("change", async () => {
    const status = selectStatusGeral.value;

    boxAusenciaGeral.style.display = status === "Ausente" ? "block" : "none";
    boxReposicaoGeral.style.display = status === "Reposicao" ? "block" : "none";

    if (status !== "Ausente") {
        inputAulaGravada.checked = false;
        inputPrecisaReposicao.checked = false;
    }

    if (status !== "Reposicao") {
        aulaOriginalIdGeral.innerHTML = `<option value="">Selecione o aluno primeiro</option>`;
        reposicaoComCustoGeral.checked = false;
    }

    atualizarBoxJustificativaGeral();

    if (status === "Reposicao") {
        await carregarAulasPendentesGeral();
    }
});

inputPrecisaReposicao.addEventListener("change", () => {
    if (inputPrecisaReposicao.checked) {
        inputAulaGravada.checked = false;
    }

    atualizarBoxJustificativaGeral();
});

inputAulaGravada.addEventListener("change", () => {
    if (inputAulaGravada.checked) {
        inputPrecisaReposicao.checked = false;
        inputJustificativa.value = "";
    }

    atualizarBoxJustificativaGeral();
});

async function carregarAulasPendentesGeral() {
    const matriculaId = selectMatricula.value;

    if (!matriculaId) {
        aulaOriginalIdGeral.innerHTML = `<option value="">Selecione o aluno primeiro</option>`;
        return;
    }

    const pendentes = await buscarAulasPendentes(matriculaId);

    aulaOriginalIdGeral.innerHTML = `<option value="">Selecione a aula faltada...</option>`;

    pendentes.forEach(aula => {
        aulaOriginalIdGeral.insertAdjacentHTML("beforeend", criarOpcaoAulaPendente(aula));
    });
}

// ==========================================
// 6. SUBMIT
// ==========================================
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const professorId = Number(localStorage.getItem("professorId"));
    const moduloId = Number(moduloAula.value);
    const conteudo = inputConteudo.value.trim();
    const licaoCasa = inputLicaoCasa.value.trim();

    if (!moduloId) {
        mostrarMensagem("Selecione o módulo.", false);
        return;
    }

    let registros = [];

    if (aulaColetivaCheckbox.checked) {
        if (matriculasLista.length === 0) {
            mostrarMensagem("Adicione pelo menos um aluno.", false);
            return;
        }

        for (const aluno of matriculasLista) {
            const erroJustificativa = validarJustificativaObrigatoria(
                aluno.status,
                aluno.precisaReposicao,
                aluno.justificativa
            );

            if (erroJustificativa) {
                mostrarMensagem(`Aluno ${aluno.nome}: ${erroJustificativa}`, false);
                return;
            }

            if (aluno.status === "Reposicao" && !aluno.aulaOriginalId) {
                mostrarMensagem(`Aluno ${aluno.nome}: selecione a aula faltada da reposição.`, false);
                return;
            }

            const ehCancelada = aluno.status === "Cancelada";
            const ehAusenteComReposicao = aluno.status === "Ausente" && aluno.precisaReposicao;

            registros.push({
                matricula_id: Number(aluno.id),
                professor_id: professorId,
                data_aula: inputDataAula.value,
                parte: Number(selectParte.value),
                modulo_id: moduloId,
                status: aluno.status,
                conteudo: ehCancelada ? null : conteudo,
                licao_casa: ehCancelada ? null : licaoCasa,
                justificativa: (ehCancelada || ehAusenteComReposicao)
                    ? (aluno.justificativa || "").trim()
                    : null,
                aula_original_id: aluno.status === "Reposicao" ? Number(aluno.aulaOriginalId) : null,
                reposicao_com_custo: aluno.status === "Reposicao" ? !!aluno.reposicaoComCusto : false,
                aula_gravada: aluno.status === "Ausente" ? !!aluno.aulaGravada : (aluno.status === "Presente"),
                precisa_reposicao: aluno.status === "Ausente" ? !!aluno.precisaReposicao : (aluno.status === "Cancelada")
            });
        }
    } else {
        const status = selectStatusGeral.value;
        const matriculaId = selectMatricula.value;
        const justificativa = inputJustificativa.value.trim();

        if (!matriculaId) {
            mostrarMensagem("Selecione o aluno.", false);
            return;
        }

        if (!status) {
            mostrarMensagem("Selecione o status da aula.", false);
            return;
        }

        const precisaReposicao = status === "Ausente" ? inputPrecisaReposicao.checked : (status === "Cancelada");
        const erroJustificativa = validarJustificativaObrigatoria(
            status,
            precisaReposicao,
            justificativa
        );

        if (erroJustificativa) {
            mostrarMensagem(erroJustificativa, false);
            return;
        }

        if (status === "Reposicao" && !aulaOriginalIdGeral.value) {
            mostrarMensagem("Selecione a aula faltada da reposição.", false);
            return;
        }

        const ehCancelada = status === "Cancelada";
        const ehAusenteComReposicao = status === "Ausente" && inputPrecisaReposicao.checked;

        registros = [{
            matricula_id: Number(matriculaId),
            professor_id: professorId,
            data_aula: inputDataAula.value,
            parte: Number(selectParte.value),
            modulo_id: moduloId,
            status: status,
            conteudo: ehCancelada ? null : conteudo,
            licao_casa: ehCancelada ? null : licaoCasa,
            justificativa: (ehCancelada || ehAusenteComReposicao) ? justificativa : null,
            aula_original_id: status === "Reposicao" ? Number(aulaOriginalIdGeral.value) : null,
            reposicao_com_custo: status === "Reposicao" ? reposicaoComCustoGeral.checked : false,
            aula_gravada: status === "Ausente" ? inputAulaGravada.checked : (status === "Presente"),
            precisa_reposicao: status === "Ausente" ? inputPrecisaReposicao.checked : (status === "Cancelada")
        }];
    }

    const { error } = await supabase.from("aula").insert(registros);

    if (error) {
        console.error("Erro ao salvar aulas:", error);
        mostrarMensagem("Erro ao salvar os dados.", false);
        return;
    }

    mostrarMensagem("Aula(s) registrada(s) com sucesso!");

    setTimeout(() => {
        location.reload();
    }, 1500);
});

// ==========================================
// 7. INICIAR
// ==========================================
setarDataHoje();
carregarMatriculas();
atualizarBoxJustificativaGeral();