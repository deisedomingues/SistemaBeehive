import { supabase } from "./supabase.js";

import {
    exigirAlunoOuProfessorFuncionario
} from "./guard.js";

/* =====================================================
   1) GARANTIR ACESSO À ÁREA DO ALUNO
===================================================== */

const acessoAluno =
    await exigirAlunoOuProfessorFuncionario();

if (!acessoAluno) {
    throw new Error(
        "Usuário sem acesso à área do aluno."
    );
}

/*
    Este é o ID REAL do aluno que deve
    ser utilizado nesta página.

    ALUNO COMUM:
    → perfil.aluno_id

    PROFESSOR VISUALIZANDO COMO ALUNO:
    → alunoIdVisualizacao
*/
const alunoId =
    Number(
        acessoAluno.alunoIdEfetivo
    );

/* =====================================================
   2) ELEMENTOS
===================================================== */

const listaProximasAulas =
    document.getElementById(
        "listaProximasAulas"
    );

const msgAusencia =
    document.getElementById(
        "msgAusencia"
    );

/* =====================================================
   3) ESTADO
===================================================== */

let matriculasAtivas = [];

let horariosAtivos = [];

let avisosExistentes = [];

/*
    Quantidade máxima de aulas exibidas.
*/
const LIMITE_AULAS = 8;

/*
    Procuramos ocorrências dentro
    dos próximos 45 dias.
*/
const DIAS_PARA_PROCURAR = 45;

/*
    Prazo mínimo para solicitar reposição.
*/
const PRAZO_REPOSICAO_MINUTOS = 15;

/* =====================================================
   4) MENSAGENS
===================================================== */

function mostrarMensagem(
    texto,
    ok = true
) {
    if (!msgAusencia) {
        return;
    }

    msgAusencia.textContent =
        texto;

    msgAusencia.style.display =
        "block";

    msgAusencia.style.background =
        ok
            ? "#e8f5e9"
            : "#ffebee";

    msgAusencia.style.color =
        ok
            ? "#1b5e20"
            : "#b71c1c";

    msgAusencia.style.border =
        ok
            ? "1px solid #a5d6a7"
            : "1px solid #ef9a9a";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function esconderMensagem() {
    if (!msgAusencia) {
        return;
    }

    msgAusencia.style.display =
        "none";

    msgAusencia.textContent =
        "";
}

/* =====================================================
   5) ESCAPAR HTML
===================================================== */

function escaparHtml(
    texto
) {
    return String(
        texto ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}

/* =====================================================
   6) DATAS
===================================================== */

function formatarDataISO(
    data
) {
    const ano =
        data.getFullYear();

    const mes =
        String(
            data.getMonth() + 1
        ).padStart(
            2,
            "0"
        );

    const dia =
        String(
            data.getDate()
        ).padStart(
            2,
            "0"
        );

    return (
        `${ano}-${mes}-${dia}`
    );
}

function criarDataLocal(
    dataISO
) {
    const [
        ano,
        mes,
        dia
    ] =
        String(
            dataISO
        )
            .split("-")
            .map(Number);

    return new Date(
        ano,
        mes - 1,
        dia,
        12,
        0,
        0,
        0
    );
}

function formatarDataBR(
    dataISO
) {
    const data =
        criarDataLocal(
            dataISO
        );

    return new Intl.DateTimeFormat(
        "pt-BR",
        {
            weekday:
                "long",

            day:
                "2-digit",

            month:
                "2-digit",

            year:
                "numeric"
        }
    ).format(
        data
    );
}

function formatarHora(
    hora
) {
    if (!hora) {
        return "";
    }

    return String(
        hora
    ).slice(
        0,
        5
    );
}

function criarDataHoraLocal(
    dataISO,
    hora
) {
    const [
        ano,
        mes,
        dia
    ] =
        String(
            dataISO
        )
            .split("-")
            .map(Number);

    const partesHora =
        String(
            hora || ""
        ).split(":");

    const horas =
        Number(
            partesHora[0] ||
            0
        );

    const minutos =
        Number(
            partesHora[1] ||
            0
        );

    return new Date(
        ano,
        mes - 1,
        dia,
        horas,
        minutos,
        0,
        0
    );
}

/* =====================================================
   7) CARREGAR MATRÍCULAS ATIVAS
===================================================== */

async function carregarMatriculasAtivas() {
    const {
        data,
        error
    } =
        await supabase
            .from(
                "matricula"
            )
            .select(`
                id,
                aluno_id,
                materia_id,
                modulo_id,
                professor_id,
                ativa,

                materia:materia_id (
                    id,
                    nome
                ),

                modulo:modulo_id (
                    id,
                    nome
                ),

                professor:professor_id (
                    id,
                    nome
                )
            `)
            .eq(
                "aluno_id",
                alunoId
            )
            .eq(
                "ativa",
                true
            );

    if (error) {
        console.error(
            "Erro ao carregar matrículas:",
            error
        );

        throw new Error(
            "Não foi possível carregar suas matrículas."
        );
    }

    matriculasAtivas =
        data || [];
}

/* =====================================================
   8) CARREGAR HORÁRIOS
===================================================== */

async function carregarHorariosAtivos() {
    const matriculaIds =
        matriculasAtivas
            .map(
                matricula =>
                    Number(
                        matricula.id
                    )
            )
            .filter(
                Number.isFinite
            );

    if (
        !matriculaIds.length
    ) {
        horariosAtivos = [];

        return;
    }

    const {
        data,
        error
    } =
        await supabase
            .from(
                "aluno_horario_aula"
            )
            .select(`
                id,
                aluno_id,
                matricula_id,
                materia_id,
                modulo_id,
                professor_id,
                dia_semana,
                hora_inicio,
                hora_fim,
                ativo
            `)
            .eq(
                "aluno_id",
                alunoId
            )
            .in(
                "matricula_id",
                matriculaIds
            )
            .eq(
                "ativo",
                true
            )
            .order(
                "dia_semana",
                {
                    ascending:
                        true
                }
            )
            .order(
                "hora_inicio",
                {
                    ascending:
                        true
                }
            );

    if (error) {
        console.error(
            "Erro ao carregar horários:",
            error
        );

        throw new Error(
            "Não foi possível carregar seus horários de aula."
        );
    }

    horariosAtivos =
        (data || [])
            .map(
                horario => {
                    const matricula =
                        matriculasAtivas
                            .find(
                                item =>
                                    Number(
                                        item.id
                                    ) ===
                                    Number(
                                        horario
                                            .matricula_id
                                    )
                            );

                    if (
                        !matricula
                    ) {
                        return null;
                    }

                    return {
                        ...horario,

                        aluno_id:
                            matricula
                                .aluno_id,

                        materia_id:
                            matricula
                                .materia_id,

                        modulo_id:
                            matricula
                                .modulo_id,

                        professor_id:
                            matricula
                                .professor_id,

                        materia:
                            matricula
                                .materia,

                        modulo:
                            matricula
                                .modulo,

                        professor:
                            matricula
                                .professor
                    };
                }
            )
            .filter(Boolean);
}

/* =====================================================
   9) MONTAR PRÓXIMAS AULAS
===================================================== */

function montarProximasAulas() {
    const agora =
        new Date();

    const ocorrencias =
        [];

    for (
        let offset = 0;
        offset <=
        DIAS_PARA_PROCURAR;
        offset++
    ) {
        const data =
            new Date();

        data.setHours(
            12,
            0,
            0,
            0
        );

        data.setDate(
            data.getDate() +
            offset
        );

        /*
            JavaScript:

            domingo = 0
            segunda = 1
            terça = 2
            quarta = 3
            quinta = 4
            sexta = 5
            sábado = 6
        */
        const diaSemana =
            data.getDay();

        if (
            diaSemana < 1 ||
            diaSemana > 6
        ) {
            continue;
        }

        const horariosDoDia =
            horariosAtivos
                .filter(
                    horario =>
                        Number(
                            horario
                                .dia_semana
                        ) ===
                        diaSemana
                );

        if (
            !horariosDoDia
                .length
        ) {
            continue;
        }

        const dataISO =
            formatarDataISO(
                data
            );

        horariosDoDia.forEach(
            horario => {
                const inicio =
                    criarDataHoraLocal(
                        dataISO,
                        horario
                            .hora_inicio
                    );

                /*
                    Se já começou, não mostra.
                */
                if (
                    inicio.getTime() <=
                    agora.getTime()
                ) {
                    return;
                }

                ocorrencias.push({
                    ...horario,

                    data_aula:
                        dataISO,

                    dataHoraInicio:
                        inicio
                });
            }
        );
    }

    ocorrencias.sort(
        (
            a,
            b
        ) =>
            a
                .dataHoraInicio
                .getTime() -
            b
                .dataHoraInicio
                .getTime()
    );

    return ocorrencias.slice(
        0,
        LIMITE_AULAS
    );
}

/* =====================================================
   10) CARREGAR AVISOS EXISTENTES
===================================================== */

async function carregarAvisosExistentes(
    proximasAulas
) {
    if (
        !alunoId ||
        !proximasAulas.length
    ) {
        avisosExistentes =
            [];

        return;
    }

    const primeiraData =
        proximasAulas[0]
            .data_aula;

    const ultimaData =
        proximasAulas[
            proximasAulas.length -
            1
        ].data_aula;

    const {
        data,
        error
    } =
        await supabase
            .from(
                "aviso_ausencia"
            )
            .select(`
                id,
                aluno_id,
                matricula_id,
                horario_aula_id,
                professor_id,
                data_aula,
                hora_inicio,
                hora_fim,
                tipo_solicitacao,
                dentro_prazo_reposicao,
                antecedencia_minutos,
                status,
                criado_em
            `)
            .eq(
                "aluno_id",
                alunoId
            )
            .gte(
                "data_aula",
                primeiraData
            )
            .lte(
                "data_aula",
                ultimaData
            )
            .neq(
                "status",
                "cancelado"
            );

    if (error) {
        console.error(
            "Erro ao carregar avisos existentes:",
            error
        );

        avisosExistentes =
            [];

        return;
    }

    avisosExistentes =
        data || [];
}

function encontrarAvisoDaAula(
    aula
) {
    return avisosExistentes
        .find(
            aviso =>
                Number(
                    aviso
                        .horario_aula_id
                ) ===
                    Number(
                        aula.id
                    ) &&

                String(
                    aviso
                        .data_aula
                ) ===
                    String(
                        aula
                            .data_aula
                    )
        );
}

/* =====================================================
   11) REGRA DOS 15 MINUTOS
===================================================== */

function calcularAntecedenciaMinutos(
    aula
) {
    const agora =
        new Date();

    const inicio =
        criarDataHoraLocal(
            aula.data_aula,
            aula.hora_inicio
        );

    const diferencaMs =
        inicio.getTime() -
        agora.getTime();

    return Math.floor(
        diferencaMs /
        60000
    );
}

function podeSolicitarReposicao(
    aula
) {
    return (
        calcularAntecedenciaMinutos(
            aula
        ) >=
        PRAZO_REPOSICAO_MINUTOS
    );
}

/* =====================================================
   12) TEXTO DO TIPO
===================================================== */

function textoTipoSolicitacao(
    tipo
) {
    if (
        tipo ===
        "reposicao"
    ) {
        return (
            "Reposição solicitada"
        );
    }

    return (
        "Gravação solicitada"
    );
}

/* =====================================================
   13) RENDERIZAR AULAS
===================================================== */

function renderizarProximasAulas(
    proximasAulas
) {
    if (
        !listaProximasAulas
    ) {
        return;
    }

    listaProximasAulas
        .innerHTML =
        "";

    if (
        !proximasAulas.length
    ) {
        listaProximasAulas
            .innerHTML = `
                <div
                    class="
                        card
                        estado-vazio-ausencia
                    "
                >

                    <div class="icone">
                        📅
                    </div>

                    <h2>
                        Nenhuma aula encontrada
                    </h2>

                    <p>
                        Não encontramos próximas aulas
                        cadastradas para suas matrículas ativas.
                    </p>

                </div>
            `;

        return;
    }

    proximasAulas.forEach(
        (
            aula,
            indice
        ) => {
            const aviso =
                encontrarAvisoDaAula(
                    aula
                );

            const curso =
                aula
                    .materia
                    ?.nome ||
                "Curso";

            const modulo =
                aula
                    .modulo
                    ?.nome ||
                "";

            const professor =
                aula
                    .professor
                    ?.nome ||
                "Professor não informado";

            const dentroPrazo =
                podeSolicitarReposicao(
                    aula
                );

            let badgeHtml =
                "";

            if (aviso) {
                badgeHtml = `
                    <span
                        class="
                            badge-ausencia
                            badge-ausencia-informada
                        "
                    >
                        ✓ Ausência informada
                    </span>
                `;
            } else if (
                dentroPrazo
            ) {
                badgeHtml = `
                    <span
                        class="
                            badge-ausencia
                            badge-prazo-ok
                        "
                    >
                        Reposição disponível
                    </span>
                `;
            } else {
                badgeHtml = `
                    <span
                        class="
                            badge-ausencia
                            badge-prazo-expirado
                        "
                    >
                        Somente gravação
                    </span>
                `;
            }

            let conteudoAviso =
                "";

            if (aviso) {
                conteudoAviso = `
                    <div
                        class="aviso-regra-ausencia"
                        style="
                            margin-top:14px;
                            margin-bottom:0;
                        "
                    >

                        <strong>
                            Aviso já registrado
                        </strong>

                        ${escaparHtml(
                            textoTipoSolicitacao(
                                aviso
                                    .tipo_solicitacao
                            )
                        )}.

                        A escola já recebeu seu aviso
                        para esta aula.

                    </div>
                `;
            }

            const card =
                document
                    .createElement(
                        "article"
                    );

            card.className =
                "card-aula-ausencia";

            card.innerHTML = `

                <div
                    class="card-aula-ausencia-topo"
                >

                    <div>

                        <h2>
                            ${escaparHtml(
                                curso
                            )}
                        </h2>

                        <p
                            class="dados-aula-ausencia"
                        >
                            ${
                                modulo
                                    ? `${escaparHtml(
                                        modulo
                                    )} · `
                                    : ""
                            }

                            ${escaparHtml(
                                professor
                            )}
                        </p>

                        <p
                            class="data-aula-destaque"
                        >
                            ${escaparHtml(
                                formatarDataBR(
                                    aula
                                        .data_aula
                                )
                            )}

                            ·

                            ${escaparHtml(
                                formatarHora(
                                    aula
                                        .hora_inicio
                                )
                            )}

                            às

                            ${escaparHtml(
                                formatarHora(
                                    aula
                                        .hora_fim
                                )
                            )}
                        </p>

                    </div>

                    ${badgeHtml}

                </div>

                ${conteudoAviso}

                ${
                    !aviso
                        ? `
                            <div
                                class="acoes-ausencia"
                            >

                                <button
                                    type="button"

                                    class="
                                        btn
                                        btn-informar-ausencia
                                    "

                                    data-acao="abrir"

                                    data-indice="${indice}"
                                >
                                    Informar que vou faltar
                                </button>

                            </div>

                            <div
                                id="opcoes-${indice}"

                                class="box-opcoes-ausencia"

                                style="
                                    display:none;
                                "
                            ></div>
                        `
                        : ""
                }
            `;

            listaProximasAulas
                .appendChild(
                    card
                );
        }
    );

    adicionarEventosBotoes(
        proximasAulas
    );
}

/* =====================================================
   14) ABRIR OPÇÕES
===================================================== */

function abrirOpcoes(
    aula,
    indice
) {
    esconderMensagem();

    /*
        Recalculamos aqui porque a página
        pode estar aberta há algum tempo.
    */
    const dentroPrazo =
        podeSolicitarReposicao(
            aula
        );

    const box =
        document
            .getElementById(
                `opcoes-${indice}`
            );

    if (!box) {
        return;
    }

    /*
        Fecha outras opções abertas.
    */
    document
        .querySelectorAll(
            ".box-opcoes-ausencia"
        )
        .forEach(
            item => {
                if (
                    item !== box
                ) {
                    item.style.display =
                        "none";

                    item.innerHTML =
                        "";
                }
            }
        );

    if (dentroPrazo) {
        box.innerHTML = `

            <h3>
                Como você prefere seguir?
            </h3>

            <div
                class="opcoes-ausencia"
            >

                <label
                    class="opcao-ausencia"
                >

                    <input
                        type="radio"

                        name="tipoAusencia-${indice}"

                        value="gravacao"
                    >

                    <div>

                        <strong>
                            Quero que minha aula seja gravada
                        </strong>

                        <span>
                            O professor será avisado para
                            gravar a aula e disponibilizá-la
                            na sua playlist do YouTube.
                        </span>

                    </div>

                </label>

                <label
                    class="opcao-ausencia"
                >

                    <input
                        type="radio"

                        name="tipoAusencia-${indice}"

                        value="reposicao"
                    >

                    <div>

                        <strong>
                            Quero solicitar reposição
                        </strong>

                        <span>
                            Esta aula ficará indicada para
                            reposição e você poderá realizar
                            o agendamento posteriormente.
                        </span>

                    </div>

                </label>

            </div>

            <div
                class="botoes-confirmacao-ausencia"
            >

                <button
                    type="button"

                    class="btn"

                    data-acao="confirmar"

                    data-indice="${indice}"
                >
                    Confirmar ausência
                </button>

                <button
                    type="button"

                    class="btn-secundario-ausencia"

                    data-acao="cancelar"

                    data-indice="${indice}"
                >
                    Voltar
                </button>

            </div>
        `;
    } else {
        box.innerHTML = `

            <div
                class="aviso-prazo-expirado"
            >

                <strong>
                    O prazo para solicitar reposição
                    já expirou.
                </strong>

                <br><br>

                Como faltam menos de 15 minutos
                para o início da aula, não é mais
                possível solicitar reposição.

                Sua aula será gravada e disponibilizada
                na sua playlist do YouTube.

            </div>

            <div
                class="botoes-confirmacao-ausencia"
            >

                <button
                    type="button"

                    class="btn"

                    data-acao="confirmar-gravacao"

                    data-indice="${indice}"
                >
                    Confirmar ausência
                </button>

                <button
                    type="button"

                    class="btn-secundario-ausencia"

                    data-acao="cancelar"

                    data-indice="${indice}"
                >
                    Voltar
                </button>

            </div>
        `;
    }

    box.style.display =
        "block";

    adicionarEventosInternos(
        aula,
        indice
    );
}

/* =====================================================
   15) EVENTOS DOS CARDS
===================================================== */

function adicionarEventosBotoes(
    proximasAulas
) {
    document
        .querySelectorAll(
            '[data-acao="abrir"]'
        )
        .forEach(
            botao => {
                botao.addEventListener(
                    "click",
                    () => {
                        const indice =
                            Number(
                                botao
                                    .dataset
                                    .indice
                            );

                        const aula =
                            proximasAulas[
                                indice
                            ];

                        if (!aula) {
                            return;
                        }

                        abrirOpcoes(
                            aula,
                            indice
                        );
                    }
                );
            }
        );
}

/* =====================================================
   16) EVENTOS INTERNOS
===================================================== */

function adicionarEventosInternos(
    aula,
    indice
) {
    const box =
        document
            .getElementById(
                `opcoes-${indice}`
            );

    if (!box) {
        return;
    }

    const btnCancelar =
        box.querySelector(
            '[data-acao="cancelar"]'
        );

    btnCancelar
        ?.addEventListener(
            "click",
            () => {
                box.style.display =
                    "none";

                box.innerHTML =
                    "";
            }
        );

    const btnConfirmar =
        box.querySelector(
            '[data-acao="confirmar"]'
        );

    btnConfirmar
        ?.addEventListener(
            "click",
            async () => {
                const radio =
                    box.querySelector(
                        `input[name="tipoAusencia-${indice}"]:checked`
                    );

                if (!radio) {
                    mostrarMensagem(
                        "Escolha se deseja gravação ou reposição.",
                        false
                    );

                    return;
                }

                await registrarAviso(
                    aula,
                    radio.value,
                    btnConfirmar
                );
            }
        );

    const btnConfirmarGravacao =
        box.querySelector(
            '[data-acao="confirmar-gravacao"]'
        );

    btnConfirmarGravacao
        ?.addEventListener(
            "click",
            async () => {
                await registrarAviso(
                    aula,
                    "gravacao",
                    btnConfirmarGravacao
                );
            }
        );
}

/* =====================================================
   17) REGISTRAR AVISO
===================================================== */

async function registrarAviso(
    aula,
    tipoSolicitado,
    botao
) {
    esconderMensagem();

    if (
        !alunoId ||
        !aula?.id ||
        !aula?.matricula_id ||
        !aula?.data_aula
    ) {
        mostrarMensagem(
            "Não foi possível identificar os dados desta aula.",
            false
        );

        return;
    }

    /*
        Recalculamos novamente no momento
        EXATO da confirmação.
    */
    const antecedencia =
        calcularAntecedenciaMinutos(
            aula
        );

    const dentroPrazo =
        antecedencia >=
        PRAZO_REPOSICAO_MINUTOS;

    let tipoFinal =
        tipoSolicitado;

    /*
        Segurança:
        reposição fora do prazo nunca
        será gravada como reposição.
    */
    if (
        !dentroPrazo &&
        tipoSolicitado ===
            "reposicao"
    ) {
        tipoFinal =
            "gravacao";
    }

    if (botao) {
        botao.disabled =
            true;

        botao.textContent =
            "Registrando...";
    }

    try {
        /*
            Confere se já existe.
        */
        const {
            data: existente,
            error:
                erroConsulta
        } =
            await supabase
                .from(
                    "aviso_ausencia"
                )
                .select(
                    "id"
                )
                .eq(
                    "aluno_id",
                    alunoId
                )
                .eq(
                    "horario_aula_id",
                    aula.id
                )
                .eq(
                    "data_aula",
                    aula.data_aula
                )
                .maybeSingle();

        if (erroConsulta) {
            console.error(
                "Erro ao verificar aviso:",
                erroConsulta
            );

            throw new Error(
                "Não foi possível verificar esta aula."
            );
        }

        if (
            existente?.id
        ) {
            mostrarMensagem(
                "Você já informou ausência para esta aula.",
                false
            );

            await carregarTudo();

            return;
        }

        const registro = {
            aluno_id:
                Number(
                    alunoId
                ),

            matricula_id:
                Number(
                    aula
                        .matricula_id
                ),

            horario_aula_id:
                Number(
                    aula.id
                ),

            professor_id:
                aula.professor_id
                    ? Number(
                        aula
                            .professor_id
                    )
                    : null,

            data_aula:
                aula.data_aula,

            hora_inicio:
                aula.hora_inicio,

            hora_fim:
                aula.hora_fim ||
                null,

            tipo_solicitacao:
                tipoFinal,

            dentro_prazo_reposicao:
                dentroPrazo,

            antecedencia_minutos:
                Math.max(
                    antecedencia,
                    0
                ),

            status:
                "pendente"
        };

        const {
            error
        } =
            await supabase
                .from(
                    "aviso_ausencia"
                )
                .insert(
                    registro
                );

        if (error) {
            console.error(
                "Erro ao registrar ausência:",
                error
            );

            /*
                23505 = registro duplicado.
            */
            if (
                String(
                    error.code
                ) ===
                "23505"
            ) {
                mostrarMensagem(
                    "Você já informou ausência para esta aula.",
                    false
                );

                await carregarTudo();

                return;
            }

            throw new Error(
                "Não foi possível registrar sua ausência."
            );
        }

        if (
            tipoFinal ===
            "reposicao"
        ) {
            mostrarMensagem(
                "Ausência informada com sucesso. Sua solicitação de reposição foi registrada."
            );
        } else if (
            dentroPrazo
        ) {
            mostrarMensagem(
                "Ausência informada com sucesso. O professor será avisado de que a aula deverá ser gravada."
            );
        } else {
            mostrarMensagem(
                "Ausência informada com sucesso. Como o prazo para reposição já havia expirado, a aula deverá ser gravada."
            );
        }

        await carregarTudo(
            false
        );
    } catch (erro) {
        console.error(
            "Erro ao registrar aviso de ausência:",
            erro
        );

        mostrarMensagem(
            erro?.message ||
            "Ocorreu um erro ao registrar sua ausência.",
            false
        );
    } finally {
        if (
            botao &&
            document.body.contains(
                botao
            )
        ) {
            botao.disabled =
                false;

            botao.textContent =
                "Confirmar ausência";
        }
    }
}

/* =====================================================
   18) CARREGAMENTO GERAL
===================================================== */

async function carregarTudo(
    limparMensagem = true
) {
    if (
        limparMensagem
    ) {
        esconderMensagem();
    }

    if (
        listaProximasAulas
    ) {
        listaProximasAulas
            .innerHTML = `
                <div class="card">
                    Carregando suas próximas aulas...
                </div>
            `;
    }

    try {
        if (
            !alunoId ||
            !Number.isFinite(
                alunoId
            )
        ) {
            throw new Error(
                "Não foi possível identificar seu cadastro de aluno."
            );
        }

        await carregarMatriculasAtivas();

        if (
            !matriculasAtivas.length
        ) {
            listaProximasAulas
                .innerHTML = `
                    <div
                        class="
                            card
                            estado-vazio-ausencia
                        "
                    >

                        <div class="icone">
                            🎓
                        </div>

                        <h2>
                            Nenhuma matrícula ativa
                        </h2>

                        <p>
                            Você não possui matrícula ativa
                            no momento.
                        </p>

                    </div>
                `;

            return;
        }

        await carregarHorariosAtivos();

        const proximasAulas =
            montarProximasAulas();

        await carregarAvisosExistentes(
            proximasAulas
        );

        renderizarProximasAulas(
            proximasAulas
        );
    } catch (erro) {
        console.error(
            "Erro ao carregar tela de ausência:",
            erro
        );

        if (
            listaProximasAulas
        ) {
            listaProximasAulas
                .innerHTML = `
                    <div
                        class="
                            card
                            estado-vazio-ausencia
                        "
                    >

                        <div class="icone">
                            ⚠️
                        </div>

                        <h2>
                            Não foi possível carregar suas aulas
                        </h2>

                        <p>
                            Tente novamente em alguns instantes.
                        </p>

                    </div>
                `;
        }

        mostrarMensagem(
            erro?.message ||
            "Ocorreu um erro ao carregar suas aulas.",
            false
        );
    }
}

/* =====================================================
   19) INICIAR
===================================================== */

await carregarTudo();