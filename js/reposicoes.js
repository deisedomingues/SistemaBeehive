import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const listaReposicoesDisponiveis = document.getElementById("listaReposicoesDisponiveis");
const listaReposicoesEscolhidas = document.getElementById("listaReposicoesEscolhidas");
const contadorDisponiveis = document.getElementById("contadorDisponiveis");
const contadorEscolhidas = document.getElementById("contadorEscolhidas");
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
// popup confirmação
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
    popup.style.zIndex = "9999";

    popup.innerHTML = `
        <div style="background:white;padding:20px;border-radius:12px;text-align:center;max-width:320px;width:90%;">
            <p style="margin-bottom:16px;">${texto}</p>
            <div style="display:flex;gap:10px;justify-content:center;">
                <button id="sim" class="btn" type="button">Sim</button>
                <button id="nao" class="btn" type="button">Cancelar</button>
            </div>
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
// contadores
// =============================
function atualizarContadores(disponiveis, escolhidas) {
    contadorDisponiveis.textContent = disponiveis;
    contadorEscolhidas.textContent = escolhidas;
}

// =============================
// utilitários
// =============================
function formatarDataBR(dataISO) {
    if (!dataISO) return "";
    const [ano, mes, dia] = dataISO.split("-");
    return `${dia}/${mes}/${ano}`;
}

function textoStatusBonito(status) {
    if (!status) return "-";

    const s = status.trim().toLowerCase();

    if (s === "ausente") return "Ausente";
    if (s === "cancelada") return "Cancelada";

    return status;
}

function extrairAnoMes(dataISO) {
    const [ano, mes] = dataISO.split("-");
    return { ano: Number(ano), mes: Number(mes) };
}

function reposicaoGeraCobranca(statusAula, dataAulaFaltada, dataReposicao) {
    if (!statusAula || !dataAulaFaltada || !dataReposicao) return false;

    const statusNormalizado = statusAula.trim().toLowerCase();

    if (statusNormalizado === "cancelada") {
        return false;
    }

    if (statusNormalizado !== "ausente") {
        return false;
    }

    const aula = extrairAnoMes(dataAulaFaltada);
    const reposicao = extrairAnoMes(dataReposicao);

    return aula.ano !== reposicao.ano || aula.mes !== reposicao.mes;
}

// =============================
// criar card
// =============================
function criarCardReposicao(horario, status, detalhes = {}) {
    const dataBR = formatarDataBR(horario.data);

    const card = document.createElement("div");
    card.className = "card-reposicao-item";

    card.style.border = "1px solid #e7d98b";
    card.style.borderRadius = "12px";
    card.style.padding = "12px";
    card.style.marginBottom = "12px";
    card.style.background = status === "escolhida" ? "#fff7d6" : "#fffdf2";
    card.style.boxShadow =
        status === "escolhida"
            ? "0 4px 14px rgba(0,0,0,0.10)"
            : "0 2px 8px rgba(0,0,0,0.05)";

    const badgeTexto = status === "escolhida" ? "Escolhida" : "Disponível";
    const badgeBg = status === "escolhida" ? "#f1bc32" : "#e9f7ef";
    const badgeColor = status === "escolhida" ? "#000" : "#067647";

    let blocoExtra = "";

    if (status === "escolhida") {
        const alunoNome = detalhes.alunoNome || "Aluno não identificado";
        const dataAulaFaltada = detalhes.dataAulaFaltada || "";
        const statusAula = detalhes.statusAula || "";
        const geraCobranca = detalhes.geraCobranca === true;

        blocoExtra = `
            <div style="font-size:14px; margin-bottom:4px;">
                <strong>Aluno:</strong> ${alunoNome}
            </div>

            <div style="font-size:14px; margin-bottom:4px;">
                <strong>Aula que será reposta:</strong> ${dataAulaFaltada ? formatarDataBR(dataAulaFaltada) : "-"}
            </div>

            <div style="font-size:14px; margin-bottom:4px;">
                <strong>Status da aula original:</strong> ${textoStatusBonito(statusAula)}
            </div>

            <div style="
                margin-top:8px;
                display:inline-block;
                padding:6px 10px;
                border-radius:999px;
                font-size:12px;
                font-weight:700;
                background:${geraCobranca ? "#fff3cd" : "#ecfdf3"};
                color:${geraCobranca ? "#7a4b00" : "#067647"};
                border:1px solid ${geraCobranca ? "#f1bc32" : "#12b76a"};
            ">
                ${geraCobranca ? "Enviar cobrança: R$ 25,00" : "Sem cobrança"}
            </div>
        `;
    }

    card.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
            <div>
                <div style="font-weight:700; margin-bottom:4px;">
                    ${dataBR} • ${horario.hora_inicio} às ${horario.hora_fim}
                </div>

                <div style="font-size:14px; margin-bottom:4px;">
                    <strong>Professor:</strong> ${horario.professor?.nome || "-"}
                </div>

                <div style="font-size:14px; margin-bottom:4px;">
                    <strong>Curso:</strong> ${horario.materia?.nome || "-"}
                </div>

                ${blocoExtra}
            </div>

            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
                <span style="
                    display:inline-block;
                    padding:6px 10px;
                    border-radius:999px;
                    font-size:12px;
                    font-weight:700;
                    background:${badgeBg};
                    color:${badgeColor};
                ">
                    ${badgeTexto}
                </span>

                <button class="btnExcluir btn" data-id="${horario.id}" type="button">x</button>
            </div>
        </div>
    `;

    return card;
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
            professor:professor_id (nome),
            materia:materia_id (nome),
            reposicao_agendada (
                id,
                cancelado,
                aula_id,
                aluno:aluno_id (nome),
                aula:aula_id (
                    data_aula,
                    status
                )
            )
        `)
        .gte("data", hoje)
        .order("data")
        .order("hora_inicio");

    if (error) {
        console.error(error);
        mostrarMensagem("Erro ao carregar reposições", true);
        listaReposicoesDisponiveis.innerHTML = "<p>Erro ao carregar.</p>";
        listaReposicoesEscolhidas.innerHTML = "<p>Erro ao carregar.</p>";
        return;
    }

    listaReposicoesDisponiveis.innerHTML = "";
    listaReposicoesEscolhidas.innerHTML = "";

    const disponiveis = [];
    const escolhidas = [];

    (data || []).forEach((h) => {
        const agendamentoAtivo = (h.reposicao_agendada || []).find(item => item.cancelado === false);

        if (agendamentoAtivo) {
            const alunoNome = agendamentoAtivo?.aluno?.nome || "Aluno não identificado";
            const dataAulaFaltada = agendamentoAtivo?.aula?.data_aula || "";
            const statusAula = agendamentoAtivo?.aula?.status || "";
            const geraCobranca = reposicaoGeraCobranca(statusAula, dataAulaFaltada, h.data);

            escolhidas.push({
                horario: h,
                alunoNome,
                dataAulaFaltada,
                statusAula,
                geraCobranca
            });
        } else {
            disponiveis.push(h);
        }
    });

    atualizarContadores(disponiveis.length, escolhidas.length);

    if (!disponiveis.length) {
        listaReposicoesDisponiveis.innerHTML = `
            <p style="margin:0; opacity:0.8;">Nenhuma reposição disponível no momento.</p>
        `;
    } else {
        disponiveis.forEach((h) => {
            const card = criarCardReposicao(h, "disponivel");
            listaReposicoesDisponiveis.appendChild(card);
        });
    }

    if (!escolhidas.length) {
        listaReposicoesEscolhidas.innerHTML = `
            <p style="margin:0; opacity:0.8;">Nenhuma reposição foi escolhida ainda.</p>
        `;
    } else {
        escolhidas.forEach((item) => {
            const card = criarCardReposicao(item.horario, "escolhida", {
                alunoNome: item.alunoNome,
                dataAulaFaltada: item.dataAulaFaltada,
                statusAula: item.statusAula,
                geraCobranca: item.geraCobranca
            });
            listaReposicoesEscolhidas.appendChild(card);
        });
    }

    ativarExclusao();
}

// =============================
// exclusão
// =============================
function ativarExclusao() {
    document.querySelectorAll(".btnExcluir").forEach((btn) => {
        btn.onclick = () => {
            const id = btn.dataset.id;
            const card = btn.closest(".card-reposicao-item");

            mostrarPopupConfirmacao("Deseja excluir esta reposição?", async () => {
                const { error } = await supabase
                    .from("horarios_reposicao")
                    .delete()
                    .eq("id", id);

                if (error) {
                    console.error(error);
                    mostrarMensagem("Erro ao excluir", true);
                    return;
                }

                if (card) {
                    card.innerHTML = `<span style="color:green;font-weight:600;">Reposição excluída</span>`;
                    card.style.transition = "opacity 0.5s ease";

                    setTimeout(() => {
                        card.style.opacity = "0";
                    }, 400);

                    setTimeout(() => {
                        card.remove();
                        carregarReposicoes();
                    }, 900);
                } else {
                    carregarReposicoes();
                }
            });
        };
    });
}

// =============================
// iniciar
// =============================
carregarReposicoes();