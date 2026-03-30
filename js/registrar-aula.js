import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

// ======================
// CAMPOS
// ======================
const form = document.getElementById("form-aula");
const inputDataAula = document.getElementById("dataAula");
const aulaColetivaCheckbox = document.getElementById("aulaColetiva");
const selectMatricula = document.getElementById("matricula");
const listaAlunosBox = document.getElementById("listaAlunos");
const alunosSelecionadosDiv = document.getElementById("alunosSelecionados");

const boxStatusGeral = document.getElementById("boxStatus");
const selectStatusGeral = document.getElementById("status");
const selectParte = document.getElementById("parteAula");
const moduloAula = document.getElementById("moduloAula");

const boxJustificativaGeral = document.getElementById("boxJustificativa");
const boxAusenciaGeral = document.getElementById("boxAusencia");
const boxReposicaoGeral = document.getElementById("boxReposicao");

const inputJustificativa = document.getElementById("justificativa");
const inputConteudo = document.getElementById("conteudo");
const inputLicaoCasa = document.getElementById("licaoCasa");

// Campos de Reposição (Individual/Geral)
const aulaOriginalId = document.getElementById("aulaOriginalId");
const reposicaoComCusto = document.getElementById("reposicaoComCusto");

const msg = document.getElementById("msg");

let matriculasLista = []; 

// ======================
// MENSAGEM
// ======================
function mostrarMensagem(texto, ok = true) {
    msg.textContent = texto;
    msg.style.display = "block";
    msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
    msg.style.color = ok ? "#1b5e20" : "#b71c1c";
    setTimeout(() => { msg.style.display = "none"; }, 3000);
}

// ======================
// DATA HOJE
// ======================
function setarDataHoje() {
    const hoje = new Date();
    inputDataAula.value = hoje.toISOString().split("T")[0];
}

// ======================
// BUSCAR AULAS PENDENTES (PARA REPOSIÇÃO)
// ======================
async function buscarAulasPendentes(matriculaId) {
    const { data } = await supabase
        .from("aula")
        .select("id, data_aula, status")
        .eq("matricula_id", matriculaId)
        .eq("precisa_reposicao", true)
        .order("data_aula", { ascending: true });
    return data || [];
}

// ======================
// RENDERIZAR CAIXINHAS (COLETIVO)
// ======================
async function renderizarAlunosColetivo() {
    alunosSelecionadosDiv.innerHTML = "";
    
    for (const [index, aluno] of matriculasLista.entries()) {
        const div = document.createElement("div");
        div.className = "aluno-box";
        div.style.cssText = "background:#FFF5CC; padding:15px; margin-bottom:10px; border-radius:10px; border:1px solid #FDCC0C; position:relative;";

        let htmlExtras = "";

        if (aluno.status === "Ausente") {
            htmlExtras = `
                <div class="row-extra" style="margin-top:10px; background:#fff; padding:8px; border-radius:5px;">
                    <label><input type="checkbox" class="gravada-ind" data-index="${index}" ${aluno.aulaGravada ? 'checked' : ''}> Aula Gravada</label><br>
                    <label><input type="checkbox" class="reposicao-ind" data-index="${index}" ${aluno.precisaReposicao ? 'checked' : ''}> Precisa Reposição</label>
                </div>`;
        } else if (aluno.status === "Reposicao") {
            const pendentes = await buscarAulasPendentes(aluno.id);
            htmlExtras = `
                <div class="row-extra" style="margin-top:10px; background:#fff; padding:8px; border-radius:5px;">
                    <label>Aula faltada:
                        <select class="aula-original-ind" data-index="${index}" style="width:100%">
                            <option value="">Selecione a aula</option>
                            ${pendentes.map(p => `<option value="${p.id}" ${aluno.aulaOriginalId == p.id ? 'selected' : ''}>${p.data_aula} - ${p.status}</option>`).join('')}
                        </select>
                    </label>
                    <label><input type="checkbox" class="custo-ind" data-index="${index}" ${aluno.reposicaoComCusto ? 'checked' : ''}> Reposição com custo</label>
                </div>`;
        }

        div.innerHTML = `
            <button type="button" class="btn-remover-aluno" data-index="${index}" style="position:absolute; right:10px; top:10px; background:#ff6b6b; color:white; border:none; border-radius:5px; cursor:pointer; width:25px; height:25px;">✕</button>
            <strong>${aluno.nome}</strong><br>
            
            <div style="margin-top:8px;">
                <label>Status:
                    <select class="status-individual" data-index="${index}" style="width:100%">
                        <option value="Presente" ${aluno.status === 'Presente' ? 'selected' : ''}>Presente</option>
                        <option value="Ausente" ${aluno.status === 'Ausente' ? 'selected' : ''}>Ausente</option>
                        <option value="Cancelada" ${aluno.status === 'Cancelada' ? 'selected' : ''}>Cancelada</option>
                        <option value="Reposicao" ${aluno.status === 'Reposicao' ? 'selected' : ''}>Reposição</option>
                        <option value="Trancada" ${aluno.status === 'Trancada' ? 'selected' : ''}>Trancada</option>
                    </select>
                </label>
                ${htmlExtras}
            </div>
        `;
        alunosSelecionadosDiv.appendChild(div);
    }

    // Eventos dos controles individuais
    adicionarEventosIndividuais();
}

function adicionarEventosIndividuais() {
    document.querySelectorAll(".status-individual").forEach(sel => {
        sel.addEventListener("change", (e) => {
            const idx = e.target.dataset.index;
            matriculasLista[idx].status = e.target.value;
            renderizarAlunosColetivo();
        });
    });

    document.querySelectorAll(".gravada-ind").forEach(chk => {
        chk.addEventListener("change", (e) => {
            const idx = e.target.dataset.index;
            matriculasLista[idx].aulaGravada = e.target.checked;
            if(e.target.checked) matriculasLista[idx].precisaReposicao = false;
            renderizarAlunosColetivo();
        });
    });

    document.querySelectorAll(".reposicao-ind").forEach(chk => {
        chk.addEventListener("change", (e) => {
            const idx = e.target.dataset.index;
            matriculasLista[idx].precisaReposicao = e.target.checked;
            if(e.target.checked) matriculasLista[idx].aulaGravada = false;
            renderizarAlunosColetivo();
        });
    });

    document.querySelectorAll(".aula-original-ind").forEach(sel => {
        sel.addEventListener("change", (e) => {
            const idx = e.target.dataset.index;
            matriculasLista[idx].aulaOriginalId = e.target.value;
        });
    });

    document.querySelectorAll(".custo-ind").forEach(chk => {
        chk.addEventListener("change", (e) => {
            const idx = e.target.dataset.index;
            matriculasLista[idx].reposicaoComCusto = e.target.checked;
        });
    });

    document.querySelectorAll(".btn-remover-aluno").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const idx = e.target.dataset.index;
            matriculasLista.splice(idx, 1);
            renderizarAlunosColetivo();
            if(matriculasLista.length === 0) listaAlunosBox.style.display = "none";
        });
    });
}

// ======================
// AULA COLETIVA TOGGLE
// ======================
aulaColetivaCheckbox.addEventListener("change", () => {
    const isColetivo = aulaColetivaCheckbox.checked;
    
    boxStatusGeral.style.display = isColetivo ? "none" : "block";
    boxAusenciaGeral.style.display = "none";
    boxReposicaoGeral.style.display = "none";
    boxJustificativaGeral.style.display = isColetivo ? "block" : "none"; 
    listaAlunosBox.style.display = isColetivo && matriculasLista.length > 0 ? "block" : "none";

    if (!isColetivo) {
        matriculasLista = [];
        renderizarAlunosColetivo();
    }
});

// ======================
// CARREGAR MATRICULAS
// ======================
async function carregarMatriculas() {
    const professorId = Number(localStorage.getItem("professorId"));
    const { data } = await supabase.from("matricula").select(`id, materia_id, modulo_id, aluno:aluno_id(nome), materia:materia_id(nome)` ).eq("professor_id", professorId).eq("ativa", true);
    
    selectMatricula.innerHTML = `<option value="">Selecione o aluno</option>`;
    data?.sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome)).forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = `${m.aluno.nome} — ${m.materia.nome}`;
        opt.dataset.materiaId = m.materia_id;
        opt.dataset.moduloAtual = m.modulo_id;
        selectMatricula.appendChild(opt);
    });
}

// ======================
// EVENTO SELEÇÃO ALUNO
// ======================
selectMatricula.addEventListener("change", async () => {
    const id = selectMatricula.value;
    if (!id) return;
    const opt = selectMatricula.selectedOptions[0];

    if (aulaColetivaCheckbox.checked) {
        if (!matriculasLista.find(a => a.id === id)) {
            matriculasLista.push({
                id: id,
                nome: opt.textContent,
                status: "Presente",
                aulaGravada: false,
                precisaReposicao: false,
                aulaOriginalId: null,
                reposicaoComCusto: false
            });
            listaAlunosBox.style.display = "block";
            renderizarAlunosColetivo();
        }
        selectMatricula.value = ""; 
    } else {
        const materiaId = opt.dataset.materiaId;
        const moduloAtual = opt.dataset.moduloAtual;
        await carregarModulos(materiaId, opt.dataset.moduloAtual);
        if (selectStatusGeral.value === "Reposicao") carregarAulasPendentesGeral();
    }
});

// ======================
// SALVAR
// ======================
form.addEventListener("submit", async e => {
    e.preventDefault();
    const professorId = Number(localStorage.getItem("professorId"));
    const dataAula = inputDataAula.value;
    const parte = Number(selectParte.value);
    const moduloId = Number(moduloAula.value);
    const justificativaGeral = inputJustificativa.value.trim();
    const conteudo = inputConteudo.value.trim();
    const licaoCasa = inputLicaoCasa.value.trim();

    if (!moduloId) return mostrarMensagem("Selecione o módulo", false);

    let registros = [];

    if (aulaColetivaCheckbox.checked) {
        if (matriculasLista.length === 0) return mostrarMensagem("Adicione alunos", false);
        
        registros = matriculasLista.map(aluno => ({
            matricula_id: aluno.id,
            professor_id: professorId,
            data_aula: dataAula,
            parte,
            modulo_id: moduloId,
            status: aluno.status,
            justificativa: aluno.status === "Cancelada" ? justificativaGeral : null,
            conteudo: aluno.status === "Cancelada" ? null : conteudo,
            licao_casa: aluno.status === "Cancelada" ? null : licaoCasa,
            aula_gravada: aluno.status === "Ausente" ? aluno.aulaGravada : (aluno.status === "Presente"),
            precisa_reposicao: aluno.status === "Ausente" ? aluno.precisaReposicao : (aluno.status === "Cancelada"),
            aula_original_id: aluno.status === "Reposicao" ? aluno.aulaOriginalId : null,
            reposicao_com_custo: aluno.status === "Reposicao" ? aluno.reposicaoComCusto : false
        }));
    } else {
        const status = selectStatusGeral.value;
        const matriculaId = selectMatricula.value;
        registros = [{
            matricula_id: matriculaId,
            professor_id: professorId,
            data_aula: dataAula,
            parte,
            modulo_id: moduloId,
            status,
            justificativa: status === "Cancelada" ? justificativaGeral : null,
            conteudo: status === "Cancelada" ? null : conteudo,
            licao_casa: status === "Cancelada" ? null : licaoCasa,
            aula_gravada: status === "Ausente" ? document.getElementById("aulaGravada").checked : (status === "Presente"),
            precisa_reposicao: status === "Ausente" ? document.getElementById("precisaReposicao").checked : (status === "Cancelada"),
            aula_original_id: status === "Reposicao" ? aulaOriginalId.value : null,
            reposicao_com_custo: status === "Reposicao" ? reposicaoComCusto.checked : false
        }];
    }

    const { error } = await supabase.from("aula").insert(registros);

    if (error) {
        mostrarMensagem("Erro ao salvar", false);
    } else {
        mostrarMensagem("Aula(s) registrada(s)!");
        form.reset();
        matriculasLista = [];
        renderizarAlunosColetivo();
        setarDataHoje();
        carregarMatriculas();
    }
});

// Funções de apoio Modo Simples
async function carregarModulos(materiaId, moduloAtual) {
    const { data } = await supabase.from("modulo").select("id, nome").eq("materia_id", materiaId).order("ordem");
    moduloAula.innerHTML = `<option value="">Selecione o módulo</option>`;
    data?.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.nome;
        if (m.id == moduloAtual) opt.selected = true;
        moduloAula.appendChild(opt);
    });
}

async function carregarAulasPendentesGeral() {
    const id = selectMatricula.value;
    if(!id) return;
    const pendentes = await buscarAulasPendentes(id);
    aulaOriginalId.innerHTML = `<option value="">Selecione a aula</option>`;
    pendentes.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a.id;
        opt.textContent = `${a.data_aula} - ${a.status}`;
        aulaOriginalId.appendChild(opt);
    });
}

selectStatusGeral.addEventListener("change", async () => {
    const s = selectStatusGeral.value;
    boxJustificativaGeral.style.display = s === "Cancelada" ? "block" : "none";
    boxAusenciaGeral.style.display = s === "Ausente" ? "block" : "none";
    boxReposicaoGeral.style.display = s === "Reposicao" ? "block" : "none";
    if (s === "Reposicao") await carregarAulasPendentesGeral();
});

setarDataHoje();
carregarMatriculas();