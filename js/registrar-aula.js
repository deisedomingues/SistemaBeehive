import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

// ==========================================
// 1. MAPEAMENTO DE ELEMENTOS (IDs DO HTML)
// ==========================================
const form = document.getElementById("form-aula");
const inputDataAula = document.getElementById("dataAula");
const aulaColetivaCheckbox = document.getElementById("aulaColetiva");
const selectMatricula = document.getElementById("matricula");
const listaAlunosBox = document.getElementById("listaAlunos");
const alunosSelecionadosDiv = document.getElementById("alunosSelecionados");

// Elementos de Status Geral (Modo Simples)
const boxStatusGeral = document.getElementById("boxStatus");
const selectStatusGeral = document.getElementById("status");
const boxAusenciaGeral = document.getElementById("boxAusencia");
const boxReposicaoGeral = document.getElementById("boxReposicao");

// Campos de aula e conteúdo
const selectParte = document.getElementById("parteAula");
const moduloAula = document.getElementById("moduloAula");
const boxJustificativaGeral = document.getElementById("boxJustificativa");
const inputJustificativa = document.getElementById("justificativa");
const inputConteudo = document.getElementById("conteudo");
const inputLicaoCasa = document.getElementById("licaoCasa");

// Campos de Reposição Geral (Modo Simples)
const aulaOriginalIdGeral = document.getElementById("aulaOriginalId");
const reposicaoComCustoGeral = document.getElementById("reposicaoComCusto");

const msg = document.getElementById("msg");

// Variável de controle para os alunos na aula coletiva
let matriculasLista = []; 

// ==========================================
// 2. FUNÇÕES AUXILIARES E SUPABASE
// ==========================================

function mostrarMensagem(texto, ok = true) {
    msg.textContent = texto;
    msg.style.display = "block";
    msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
    msg.style.color = ok ? "#1b5e20" : "#b71c1c";
    setTimeout(() => { msg.style.display = "none"; }, 3000);
}

function setarDataHoje() {
    inputDataAula.value = new Date().toISOString().split("T")[0];
}

async function buscarAulasPendentes(matriculaId) {
    const { data } = await supabase
        .from("aula")
        .select("id, data_aula")
        .eq("matricula_id", matriculaId)
        .eq("precisa_reposicao", true)
        .order("data_aula", { ascending: true });
    return data || [];
}

async function carregarMatriculas() {
    const professorId = Number(localStorage.getItem("professorId"));
    const { data } = await supabase
        .from("matricula")
        .select(`id, materia_id, modulo_id, aluno:aluno_id(nome), materia:materia_id(nome)`)
        .eq("professor_id", professorId)
        .eq("ativa", true);
    
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

// ==========================================
// 3. RENDERIZAÇÃO DA LISTA COLETIVA
// ==========================================

async function renderizarAlunosColetivo() {
    alunosSelecionadosDiv.innerHTML = "";
    
    for (const [index, aluno] of matriculasLista.entries()) {
        const div = document.createElement("div");
        div.className = "aluno-box";
        div.style.cssText = "background:#FFF5CC; padding:15px; margin-bottom:10px; border-radius:10px; border:1px solid #FDCC0C; position:relative;";

        let htmlExtras = "";

        if (aluno.status === "Ausente") {
            htmlExtras = `
                <div style="margin-top:10px; background:#fff; padding:8px; border-radius:5px; border: 1px solid #eee;">
                    <label><input type="checkbox" class="gravada-ind" data-index="${index}" ${aluno.aulaGravada ? 'checked' : ''}> Aula Gravada</label><br>
                    <label><input type="checkbox" class="reposicao-ind" data-index="${index}" ${aluno.precisaReposicao ? 'checked' : ''}> Precisa Reposição</label>
                </div>`;
        } else if (aluno.status === "Reposicao") {
            const pendentes = await buscarAulasPendentes(aluno.id);
            htmlExtras = `
                <div style="margin-top:10px; background:#fff; padding:8px; border-radius:5px; border: 1px solid #eee;">
                    <label style="font-size: 11px; font-weight: bold;">Aula faltada:</label>
                    <select class="aula-original-ind" data-index="${index}" style="width:100%; margin-bottom:5px; font-size:12px;">
                        <option value="">Selecione a falta...</option>
                        ${pendentes.map(p => `<option value="${p.id}" ${aluno.aulaOriginalId == p.id ? 'selected' : ''}>${p.data_aula}</option>`).join('')}
                    </select>
                    <label style="font-size:12px;"><input type="checkbox" class="custo-ind" data-index="${index}" ${aluno.reposicaoComCusto ? 'checked' : ''}> Com custo</label>
                </div>`;
        }

        div.innerHTML = `
            <button type="button" class="btn-remover-aluno" data-index="${index}" style="position:absolute; right:10px; top:10px; background:#ff6b6b; color:white; border:none; border-radius:5px; cursor:pointer; width:22px; height:22px;">✕</button>
            <strong>${aluno.nome}</strong><br>
            <select class="status-individual" data-index="${index}" style="width:100%; margin-top:5px; padding:4px; border-radius:4px;">
                <option value="Presente" ${aluno.status === 'Presente' ? 'selected' : ''}>Presente</option>
                <option value="Ausente" ${aluno.status === 'Ausente' ? 'selected' : ''}>Ausente</option>
                <option value="Cancelada" ${aluno.status === 'Cancelada' ? 'selected' : ''}>Cancelada</option>
                <option value="Reposicao" ${aluno.status === 'Reposicao' ? 'selected' : ''}>Reposição</option>
                <option value="Trancada" ${aluno.status === 'Trancada' ? 'selected' : ''}>Trancada</option>
            </select>
            ${htmlExtras}
        `;
        alunosSelecionadosDiv.appendChild(div);
    }
    vincularEventosIndividuais();
}

function vincularEventosIndividuais() {
    document.querySelectorAll(".status-individual").forEach(sel => {
        sel.onchange = (e) => {
            matriculasLista[e.target.dataset.index].status = e.target.value;
            renderizarAlunosColetivo();
        };
    });

    document.querySelectorAll(".gravada-ind").forEach(chk => {
        chk.onchange = (e) => { matriculasLista[e.target.dataset.index].aulaGravada = e.target.checked; };
    });

    document.querySelectorAll(".reposicao-ind").forEach(chk => {
        chk.onchange = (e) => { matriculasLista[e.target.dataset.index].precisaReposicao = e.target.checked; };
    });

    document.querySelectorAll(".aula-original-ind").forEach(sel => {
        sel.onchange = (e) => { matriculasLista[e.target.dataset.index].aulaOriginalId = e.target.value; };
    });

    document.querySelectorAll(".custo-ind").forEach(chk => {
        chk.onchange = (e) => { matriculasLista[e.target.dataset.index].reposicaoComCusto = e.target.checked; };
    });

    document.querySelectorAll(".btn-remover-aluno").forEach(btn => {
        btn.onclick = (e) => {
            const idx = e.target.closest('button').dataset.index;
            matriculasLista.splice(idx, 1);
            renderizarAlunosColetivo();
            if(matriculasLista.length === 0) listaAlunosBox.style.display = "none";
        };
    });
}

// ==========================================
// 4. EVENTOS DE INTERFACE (TOGGLES) - CORRIGIDO
// ==========================================

aulaColetivaCheckbox.addEventListener("change", () => {
    const isColetivo = aulaColetivaCheckbox.checked;
    
    // Controle do Status Geral
    if (boxStatusGeral) {
        boxStatusGeral.style.display = isColetivo ? "none" : "block";
        
        // Remove 'required' se estiver escondido para evitar o erro "not focusable"
        if (isColetivo) {
            selectStatusGeral.removeAttribute("required");
        } else {
            selectStatusGeral.setAttribute("required", "required");
        }
    }

    // Reseta campos de auxílio
    boxAusenciaGeral.style.display = "none";
    boxReposicaoGeral.style.display = "none";
    
    // Justificativa pode ser usada para cancelamento coletivo
    boxJustificativaGeral.style.display = isColetivo ? "block" : "none"; 
    
    if (!isColetivo) {
        matriculasLista = [];
        renderizarAlunosColetivo();
        listaAlunosBox.style.display = "none";
    } else if (matriculasLista.length > 0) {
        listaAlunosBox.style.display = "block";
    }
});

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
        await carregarModulos(opt.dataset.materiaId, opt.dataset.moduloAtual);
        if (selectStatusGeral.value === "Reposicao") {
            carregarAulasPendentesGeral();
        }
    }
});

selectStatusGeral.addEventListener("change", async () => {
    const s = selectStatusGeral.value;
    boxJustificativaGeral.style.display = s === "Cancelada" ? "block" : "none";
    boxAusenciaGeral.style.display = s === "Ausente" ? "block" : "none";
    boxReposicaoGeral.style.display = s === "Reposicao" ? "block" : "none";
    
    if (s === "Reposicao") {
        carregarAulasPendentesGeral();
    }
});

async function carregarAulasPendentesGeral() {
    const id = selectMatricula.value;
    if(!id) return;
    const pendentes = await buscarAulasPendentes(id);
    if (aulaOriginalIdGeral) {
        aulaOriginalIdGeral.innerHTML = `<option value="">Selecione a aula faltada...</option>`;
        pendentes.forEach(a => {
            const opt = document.createElement("option");
            opt.value = a.id; 
            opt.textContent = a.data_aula;
            aulaOriginalIdGeral.appendChild(opt);
        });
    }
}
// ==========================================
// 5. SALVAMENTO (SUBMIT)
// ==========================================

form.addEventListener("submit", async e => {
    e.preventDefault();
    const professorId = Number(localStorage.getItem("professorId"));
    const moduloId = Number(moduloAula.value);
    const conteudo = inputConteudo.value.trim();
    const licaoCasa = inputLicaoCasa.value.trim();
    const justificativa = inputJustificativa.value.trim();

    if (!moduloId) return mostrarMensagem("Selecione o módulo", false);

    let registros = [];

    if (aulaColetivaCheckbox.checked) {
        if (matriculasLista.length === 0) return mostrarMensagem("Adicione alunos", false);
        registros = matriculasLista.map(aluno => ({
            matricula_id: aluno.id,
            professor_id: professorId,
            data_aula: inputDataAula.value,
            parte: Number(selectParte.value),
            modulo_id: moduloId,
            status: aluno.status,
            conteudo: aluno.status === "Cancelada" ? null : conteudo,
            licao_casa: aluno.status === "Cancelada" ? null : licaoCasa,
            justificativa: aluno.status === "Cancelada" ? justificativa : null,
            aula_original_id: aluno.status === "Reposicao" ? aluno.aulaOriginalId : null,
            reposicao_com_custo: aluno.status === "Reposicao" ? aluno.reposicaoComCusto : false,
            aula_gravada: aluno.status === "Ausente" ? aluno.aulaGravada : (aluno.status === "Presente"),
            precisa_reposicao: aluno.status === "Ausente" ? aluno.precisaReposicao : (aluno.status === "Cancelada")
        }));
    } else {
        const status = selectStatusGeral.value;
        const matriculaId = selectMatricula.value;
        if (!matriculaId) return mostrarMensagem("Selecione o aluno", false);
        
        registros = [{
            matricula_id: matriculaId,
            professor_id: professorId,
            data_aula: inputDataAula.value,
            parte: Number(selectParte.value),
            modulo_id: moduloId,
            status: status,
            conteudo: status === "Cancelada" ? null : conteudo,
            licao_casa: status === "Cancelada" ? null : licaoCasa,
            justificativa: status === "Cancelada" ? justificativa : null,
            aula_original_id: status === "Reposicao" ? aulaOriginalIdGeral.value : null,
            reposicao_com_custo: status === "Reposicao" ? reposicaoComCustoGeral.checked : false,
            aula_gravada: status === "Ausente" ? document.getElementById("aulaGravada").checked : (status === "Presente"),
            precisa_reposicao: status === "Ausente" ? document.getElementById("precisaReposicao").checked : (status === "Cancelada")
        }];
    }

    const { error } = await supabase.from("aula").insert(registros);
    if (error) {
        console.error(error);
        mostrarMensagem("Erro ao salvar dados", false);
    } else {
        mostrarMensagem("Aula(s) registrada(s) com sucesso!");
        setTimeout(() => location.reload(), 1500); 
    }
});

// Inicialização
setarDataHoje();
carregarMatriculas();