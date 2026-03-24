import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const selectEmpresa = document.getElementById("empresaparceira");
const form = document.getElementById("form-relatorio");
const msg = document.getElementById("msg");

const areaRelatorio = document.getElementById("area-relatorio");
const tabelaBody = document.querySelector("#tabela-relatorio tbody");
const tituloRelatorio = document.getElementById("tituloRelatorio");

let nomeEmpresaSelecionada = "";

// ======================
// Mensagem
// ======================
function mostrarMensagem(texto, ok = true) {

    msg.textContent = texto;
    msg.style.display = "block";

    msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
    msg.style.color = ok ? "#1b5e20" : "#b71c1c";

    setTimeout(() => {
        msg.style.display = "none";
        msg.textContent = "";
    }, 2500);
}

// ======================
// Carregar empresas
// ======================
async function carregarEmpresas() {

    const { data, error } = await supabase
        .from("empresaparceira")
        .select("*")
        .order("nome");

    if (error) {
        console.error(error);
        mostrarMensagem("Erro ao carregar empresas", false);
        return;
    }

    if (!data || data.length === 0) {
        mostrarMensagem("Nenhuma empresa cadastrada", false);
        return;
    }

    data.forEach(emp => {

        const option = document.createElement("option");

        option.value = emp.cnpj;
        option.textContent = emp.nome;

        selectEmpresa.appendChild(option);
    });
}

await carregarEmpresas();

// ======================
// Gerar relatório
// ======================
form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const empresaCnpj = selectEmpresa.value;
    const inicio = document.getElementById("inicio").value;
    const fim = document.getElementById("fim").value;

    nomeEmpresaSelecionada =
        selectEmpresa.options[selectEmpresa.selectedIndex].text;

    if (!empresaCnpj) {
        mostrarMensagem("Selecione a empresa", false);
        return;
    }

    if (!inicio || !fim) {
        mostrarMensagem("Selecione o período", false);
        return;
    }

    tabelaBody.innerHTML = "";
    areaRelatorio.style.display = "none";

    const { data, error } = await supabase
        .from("aula")
        .select(`
            status,
            data_aula,
            matricula:matricula_id (
                aluno:aluno_id (
                    id,
                    nome,
                    empresa_cnpj
                ),
                materia:materia_id ( nome ),
                modulo:modulo_id ( nome ),
                professor:professor_id ( nome )
            )
        `)
        .gte("data_aula", inicio)
        .lte("data_aula", fim);

    if (error) {
        console.error(error);
        mostrarMensagem("Erro ao gerar relatório", false);
        return;
    }

    if (!data || data.length === 0) {
        mostrarMensagem("Nenhuma aula encontrada no período", false);
        return;
    }

    // ======================
    // Filtrar pela empresa
    // ======================
    const filtrados = data.filter(aula =>
        aula?.matricula?.aluno?.empresa_cnpj === empresaCnpj
    );

    if (filtrados.length === 0) {
        mostrarMensagem("Nenhum aluno dessa empresa no período", false);
        return;
    }

    // ======================
    // Agrupar por aluno
    // ======================
    const alunos = {};

    filtrados.forEach(aula => {

        const alunoId = aula.matricula.aluno.id;

        if (!alunos[alunoId]) {

            alunos[alunoId] = {
                nome: aula.matricula.aluno.nome,
                professor: aula.matricula.professor?.nome || "-",
                curso: aula.matricula.materia?.nome || "-",
                modulo: aula.matricula.modulo?.nome || "-",
                presencas: 0,
                canceladas: 0,
                total: 0
            };
        }

        alunos[alunoId].total++;

        if (aula.status === "Presente") {
            alunos[alunoId].presencas++;
        }

        if (aula.status === "Cancelada") {
            alunos[alunoId].canceladas++;
        }
    });

    // ======================
    // Montar tabela
    // ======================
    Object.values(alunos).forEach(aluno => {

        const porcentagem =
            aluno.total > 0
                ? ((aluno.presencas / aluno.total) * 100).toFixed(1)
                : 0;

        tabelaBody.innerHTML += `
            <tr>
                <td>${aluno.nome}</td>
                <td>${aluno.professor}</td>
                <td>${aluno.curso}</td>
                <td>${aluno.modulo}</td>
                <td>${aluno.presencas}</td>
                <td>${aluno.canceladas}</td>
                <td>${aluno.total}</td>
                <td>${porcentagem}%</td>
            </tr>
        `;
    });

    // ======================
    // Título
    // ======================
    tituloRelatorio.textContent =
        `Relatório da empresa ${nomeEmpresaSelecionada} - ${inicio} até ${fim}`;

    areaRelatorio.style.display = "block";

    mostrarMensagem("Relatório gerado com sucesso");
});