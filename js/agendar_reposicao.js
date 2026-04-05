import { supabase } from "./supabase.js";
import { exigirAluno } from "./guard.js";

await exigirAluno();

const listaReposicoes = document.getElementById("listaReposicoes");
const msg = document.getElementById("msg");
const faltasAluno = document.getElementById("faltasAluno");
const textoSelecao = document.getElementById("textoSelecao");

let alunoAtual = null;
let aulasPendentes = [];
let aulaSelecionadaId = null;

// =============================
// mensagem
// =============================
function mostrarMensagem(texto, erro = false) {
    msg.textContent = texto;
    msg.className = erro ? "msg-erro" : "msg-sucesso";
    msg.style.display = "block";

    setTimeout(() => {
        msg.textContent = "";
        msg.className = "";
        msg.style.display = "none";
    }, 4000);
}

// =============================
// formatação
// =============================
function formatarDataBR(dataISO) {
    if (!dataISO) return "";

    const [ano, mes, dia] = dataISO.split("-");
    return `${dia}/${mes}/${ano}`;
}

function textoStatusBonito(status) {
    if (!status) return "Aula";

    const s = status.trim().toLowerCase();

    if (s === "ausente") return "Ausente";
    if (s === "cancelada") return "Cancelada";

    return status;
}

function textoJustificativa(justificativa) {
    if (!justificativa || !justificativa.trim()) {
        return "Sem justificativa informada.";
    }

    return justificativa.trim();
}

// =============================
// datas locais
// evita problema de fuso
// =============================
function criarDataLocal(dataISO, hora = 0, minuto = 0, segundo = 0) {
    const [ano, mes, dia] = dataISO.split("-").map(Number);
    return new Date(ano, mes - 1, dia, hora, minuto, segundo);
}

// =============================
// regra do prazo
// até 21h do dia anterior
// =============================
function obterPrazoLimiteAgendamento(dataReposicao) {
    const limite = criarDataLocal(dataReposicao, 21, 0, 0);
    limite.setDate(limite.getDate() - 1);
    return limite;
}

function podeAgendarHorario(dataReposicao) {
    const agora = new Date();
    const limite = obterPrazoLimiteAgendamento(dataReposicao);
    return agora <= limite;
}

function formatarPrazoLimite(dataReposicao) {
    const limite = obterPrazoLimiteAgendamento(dataReposicao);

    const dia = String(limite.getDate()).padStart(2, "0");
    const mes = String(limite.getMonth() + 1).padStart(2, "0");
    const ano = limite.getFullYear();
    const hora = String(limite.getHours()).padStart(2, "0");
    const minuto = String(limite.getMinutes()).padStart(2, "0");

    return `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
}

// =============================
// buscar aluno logado
// =============================
async function buscarAluno() {
    const { data: userData, error } = await supabase.auth.getUser();

    if (error || !userData?.user) {
        console.error("Erro ao identificar usuário:", error);
        mostrarMensagem("Erro ao identificar o aluno.", true);
        return null;
    }

    const userId = userData.user.id;

    const { data: perfil, error: errPerfil } = await supabase
        .from("perfil")
        .select("aluno_id")
        .eq("user_id", userId)
        .eq("role", "aluno")
        .maybeSingle();

    if (errPerfil || !perfil) {
        console.error("Perfil do aluno não encontrado:", errPerfil);
        mostrarMensagem("Perfil do aluno não encontrado.", true);
        return null;
    }

    const { data: aluno, error: errAluno } = await supabase
        .from("aluno")
        .select("id, nome")
        .eq("id", perfil.aluno_id)
        .maybeSingle();

    if (errAluno || !aluno) {
        console.error("Aluno não encontrado:", errAluno);
        mostrarMensagem("Aluno não encontrado.", true);
        return null;
    }

    const { data: matricula, error: errMatricula } = await supabase
        .from("matricula")
        .select("id, materia_id")
        .eq("aluno_id", aluno.id)
        .eq("ativa", true)
        .maybeSingle();

    if (errMatricula || !matricula) {
        console.error("Matrícula ativa não encontrada:", errMatricula);
        mostrarMensagem("Matrícula ativa não encontrada.", true);
        return null;
    }

    return {
        id: aluno.id,
        nome: aluno.nome,
        matricula_id: matricula.id,
        materia_id: matricula.materia_id
    };
}

// =============================
// buscar aulas que geram reposição
// regra:
// - status ausente ou cancelada
// - aula_gravada = false
// - precisa_reposicao = true
// =============================
async function buscarAulasPendentes(matriculaId) {
    const { data, error } = await supabase
        .from("aula")
        .select("id, data_aula, status, justificativa, aula_gravada, precisa_reposicao")
        .eq("matricula_id", matriculaId)
        .in("status", ["Ausente", "Cancelada", "ausente", "cancelada"])
        .eq("aula_gravada", false)
        .eq("precisa_reposicao", true)
        .order("data_aula", { ascending: true });

    if (error) {
        console.error("Erro ao buscar aulas pendentes:", error);
        throw error;
    }

    return data || [];
}

// =============================
// buscar reposições ativas
// =============================
async function buscarReposicoesAtivasDoAluno(alunoId) {
    const { data, error } = await supabase
        .from("reposicao_agendada")
        .select(`
            id,
            aula_id,
            horario_reposicao_id,
            cancelado,
            horarios_reposicao (
                id,
                data,
                hora_inicio,
                hora_fim
            )
        `)
        .eq("aluno_id", alunoId)
        .eq("cancelado", false);

    if (error) {
        console.error("Erro ao buscar reposições ativas:", error);
        throw error;
    }

    return data || [];
}

// =============================
// renderizar aulas pendentes
// =============================
function renderizarAulasPendentes(aulasLivres, reposicoesAtivas) {
    if (!aulasLivres.length) {
        faltasAluno.innerHTML = `
            <p>Você não possui reposições pendentes.</p>
        `;

        textoSelecao.textContent = "Você não possui aulas pendentes para repor.";
        listaReposicoes.innerHTML = "";
        aulaSelecionadaId = null;
        return;
    }

    let html = `
        <div class="resumo-pendencias">
            <p><strong>Total de reposições pendentes:</strong> ${aulasLivres.length}</p>
            ${
                reposicoesAtivas.length > 0
                    ? `<p><strong>Reposições já agendadas:</strong> ${reposicoesAtivas.length}</p>`
                    : ""
            }
        </div>

        <div class="lista-aulas-pendentes">
    `;

    aulasLivres.forEach(aula => {
        const selecionada = aula.id === aulaSelecionadaId;
        const status = textoStatusBonito(aula.status);
        const dataBR = formatarDataBR(aula.data_aula);
        const justificativa = textoJustificativa(aula.justificativa);

        html += `
            <div class="item-pendente ${selecionada ? "item-pendente-selecionado" : ""}">
                <div class="item-pendente-conteudo">
                    <p><strong>${status} em ${dataBR}</strong></p>
                    <p class="justificativa-aula">${status} em ${dataBR} - ${justificativa}</p>
                </div>

                <button
                    type="button"
                    class="btn btnSelecionarAula"
                    data-aula-id="${aula.id}"
                >
                    ${selecionada ? "Selecionada" : "Escolher esta aula"}
                </button>
            </div>
        `;
    });

    html += `</div>`;

    if (reposicoesAtivas.length > 0) {
        html += `
            <div class="agendamentos-ativos">
                <p><strong>Reposições já marcadas:</strong></p>
                <ul>
        `;

        reposicoesAtivas.forEach(item => {
            const h = item.horarios_reposicao;
            if (!h) return;

            html += `
                <li>
                    ${formatarDataBR(h.data)} - ${h.hora_inicio} às ${h.hora_fim}
                </li>
            `;
        });

        html += `
                </ul>
            </div>
        `;
    }

    faltasAluno.innerHTML = html;

    document.querySelectorAll(".btnSelecionarAula").forEach(btn => {
        btn.addEventListener("click", async () => {
            aulaSelecionadaId = Number(btn.dataset.aulaId);

            const aulaEscolhida = aulasLivres.find(a => a.id === aulaSelecionadaId);

            if (aulaEscolhida) {
                const status = textoStatusBonito(aulaEscolhida.status);
                const dataBR = formatarDataBR(aulaEscolhida.data_aula);
                textoSelecao.textContent = `Você está escolhendo um horário para: ${status} em ${dataBR}.`;
            }

            renderizarAulasPendentes(aulasLivres, reposicoesAtivas);
            await carregarHorariosDisponiveis();
        });
    });
}

// =============================
// carregar pendências
// remove da lista as aulas
// que já possuem reposição ativa
// =============================
async function carregarPendencias() {
    const aulas = await buscarAulasPendentes(alunoAtual.matricula_id);
    const reposicoesAtivas = await buscarReposicoesAtivasDoAluno(alunoAtual.id);

    const aulasJaAgendadasIds = new Set(
        reposicoesAtivas
            .filter(item => item.aula_id !== null)
            .map(item => item.aula_id)
    );

    aulasPendentes = aulas.filter(aula => !aulasJaAgendadasIds.has(aula.id));

    if (aulasPendentes.length > 0 && !aulaSelecionadaId) {
        aulaSelecionadaId = aulasPendentes[0].id;
    }

    if (aulaSelecionadaId && !aulasPendentes.some(a => a.id === aulaSelecionadaId)) {
        aulaSelecionadaId = aulasPendentes.length ? aulasPendentes[0].id : null;
    }

    renderizarAulasPendentes(aulasPendentes, reposicoesAtivas);
}

// =============================
// buscar horários livres
// =============================
async function buscarHorariosLivres() {
    const hoje = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
        .from("horarios_reposicao")
        .select(`
            id,
            data,
            hora_inicio,
            hora_fim,
            disponivel,
            professor (nome),
            materia (nome),
            reposicao_agendada (
                id,
                cancelado
            )
        `)
        .eq("materia_id", alunoAtual.materia_id)
        .gte("data", hoje)
        .order("data", { ascending: true })
        .order("hora_inicio", { ascending: true });

    if (error) {
        console.error("Erro ao buscar horários livres:", error);
        throw error;
    }

    return (data || []).filter(horario => {
        if (horario.disponivel === false) return false;

        const temAgendamentoAtivo = (horario.reposicao_agendada || []).some(
            ag => ag.cancelado === false
        );

        return !temAgendamentoAtivo;
    });
}

// =============================
// renderizar horários disponíveis
// =============================
async function carregarHorariosDisponiveis() {
    if (!aulaSelecionadaId) {
        listaReposicoes.innerHTML = `
            <p>Selecione uma aula pendente para visualizar os horários disponíveis.</p>
        `;
        return;
    }

    const horariosLivres = await buscarHorariosLivres();

    if (!horariosLivres.length) {
        listaReposicoes.innerHTML = `
            <p>Nenhum horário disponível no momento.</p>
        `;
        return;
    }

    listaReposicoes.innerHTML = "";

    horariosLivres.forEach(horario => {
        const dentroDoPrazo = podeAgendarHorario(horario.data);
        const prazoTexto = formatarPrazoLimite(horario.data);

        const div = document.createElement("div");
        div.className = "card card-horario";

        div.innerHTML = `
            <p><strong>Data:</strong> ${formatarDataBR(horario.data)}</p>
            <p><strong>Horário:</strong> ${horario.hora_inicio} - ${horario.hora_fim}</p>
            <p><strong>Professor:</strong> ${horario.professor?.nome || "Não informado"}</p>
            <p><strong>Curso:</strong> ${horario.materia?.nome || "Não informado"}</p>
            <p class="prazo-agendamento">
                <strong>Prazo para agendar:</strong> ${prazoTexto}
            </p>

            ${
                dentroDoPrazo
                    ? `
                        <button
                            type="button"
                            class="btn btnEscolherHorario"
                            data-horario-id="${horario.id}"
                        >
                            Agendar este horário
                        </button>
                    `
                    : `
                        <p class="prazo-encerrado">Prazo encerrado para este horário</p>
                    `
            }
        `;

        listaReposicoes.appendChild(div);
    });

    ativarEscolhaHorario();
}

// =============================
// agendar horário
// =============================
function ativarEscolhaHorario() {
    document.querySelectorAll(".btnEscolherHorario").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!aulaSelecionadaId) {
                mostrarMensagem("Selecione uma aula pendente primeiro.", true);
                return;
            }

            const horarioId = Number(btn.dataset.horarioId);

            btn.disabled = true;
            btn.textContent = "Agendando...";

            try {
                const aulaEscolhida = aulasPendentes.find(a => a.id === aulaSelecionadaId);

                if (!aulaEscolhida) {
                    mostrarMensagem("A aula selecionada não está mais disponível para reposição.", true);
                    await carregarTudo();
                    return;
                }

                const { data: horarioAtual, error: erroHorario } = await supabase
                    .from("horarios_reposicao")
                    .select(`
                        id,
                        data,
                        disponivel,
                        reposicao_agendada (
                            id,
                            cancelado
                        )
                    `)
                    .eq("id", horarioId)
                    .maybeSingle();

                if (erroHorario || !horarioAtual) {
                    throw erroHorario || new Error("Horário não encontrado.");
                }

                if (!podeAgendarHorario(horarioAtual.data)) {
                    mostrarMensagem("O prazo para agendar esta reposição já foi encerrado.", true);
                    await carregarTudo();
                    return;
                }

                const horarioOcupado = (horarioAtual.reposicao_agendada || []).some(
                    item => item.cancelado === false
                );

                if (horarioAtual.disponivel === false || horarioOcupado) {
                    mostrarMensagem("Este horário não está mais disponível.", true);
                    await carregarTudo();
                    return;
                }

                const { data: aulaJaAgendada, error: erroAulaJaAgendada } = await supabase
                    .from("reposicao_agendada")
                    .select("id")
                    .eq("aula_id", aulaSelecionadaId)
                    .eq("cancelado", false);

                if (erroAulaJaAgendada) {
                    throw erroAulaJaAgendada;
                }

                if (aulaJaAgendada && aulaJaAgendada.length > 0) {
                    mostrarMensagem("Esta aula já possui uma reposição agendada.", true);
                    await carregarTudo();
                    return;
                }

                const confirmar = confirm("Deseja agendar esta reposição?");
                if (!confirmar) {
                    btn.disabled = false;
                    btn.textContent = "Agendar este horário";
                    return;
                }

                const { error: erroInsert } = await supabase
                    .from("reposicao_agendada")
                    .insert({
                        horario_reposicao_id: horarioId,
                        aluno_id: alunoAtual.id,
                        aula_id: aulaSelecionadaId,
                        cancelado: false
                    });

                if (erroInsert) {
                    throw erroInsert;
                }

                const { error: erroUpdate } = await supabase
                    .from("horarios_reposicao")
                    .update({ disponivel: false })
                    .eq("id", horarioId);

                if (erroUpdate) {
                    throw erroUpdate;
                }

                mostrarMensagem("Reposição agendada com sucesso!");
                await carregarTudo();

            } catch (err) {
                console.error("Erro ao agendar reposição:", err);
                mostrarMensagem("Erro ao agendar reposição.", true);
            } finally {
                btn.disabled = false;
                btn.textContent = "Agendar este horário";
            }
        });
    });
}

// =============================
// carregar tudo
// =============================
async function carregarTudo() {
    faltasAluno.innerHTML = "Carregando pendências...";
    listaReposicoes.innerHTML = "Carregando horários...";

    try {
        if (!alunoAtual) {
            alunoAtual = await buscarAluno();
        }

        if (!alunoAtual) {
            faltasAluno.innerHTML = "Não foi possível identificar o aluno.";
            listaReposicoes.innerHTML = "";
            return;
        }

        await carregarPendencias();
        await carregarHorariosDisponiveis();

    } catch (error) {
        console.error("Erro geral:", error);
        faltasAluno.innerHTML = "Erro ao carregar as reposições pendentes.";
        listaReposicoes.innerHTML = "Erro ao carregar os horários disponíveis.";
        mostrarMensagem("Não foi possível carregar os dados.", true);
    }
}

// =============================
// iniciar
// =============================
carregarTudo();