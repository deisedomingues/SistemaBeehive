import { supabase } from "./supabase.js";
import { exigirAlunoOuProfessorFuncionario } from "./guard.js";

/* =========================================
   PROTEÇÃO DA PÁGINA
========================================= */

const acessoAreaAluno =
  await exigirAlunoOuProfessorFuncionario();

if (!acessoAreaAluno) {
  throw new Error(
    "Não foi possível autorizar o acesso às configurações do aluno."
  );
}

const alunoId =
  Number(acessoAreaAluno.alunoIdEfetivo);

/* =========================================
   ELEMENTOS DA PÁGINA
========================================= */

const mensagemPagina = document.getElementById("mensagemPagina");

const nomeAluno = document.getElementById("nomeAluno");
const emailAluno = document.getElementById("emailAluno");

const blocoStatusNotificacoes = document.getElementById(
  "blocoStatusNotificacoes"
);

const iconeStatusNotificacoes = document.getElementById(
  "iconeStatusNotificacoes"
);

const tituloStatusNotificacoes = document.getElementById(
  "tituloStatusNotificacoes"
);

const textoStatusNotificacoes = document.getElementById(
  "textoStatusNotificacoes"
);

const btnAtivarNotificacoes = document.getElementById(
  "btnAtivarNotificacoes"
);

const btnVerificarNotificacoes = document.getElementById(
  "btnVerificarNotificacoes"
);

const instrucoesNotificacoes = document.getElementById(
  "instrucoesNotificacoes"
);

const formAlterarSenha = document.getElementById(
  "formAlterarSenha"
);

const novaSenha = document.getElementById("novaSenha");

const confirmarNovaSenha = document.getElementById(
  "confirmarNovaSenha"
);

const btnAlterarSenha = document.getElementById(
  "btnAlterarSenha"
);

const preenchimentoForcaSenha = document.getElementById(
  "preenchimentoForcaSenha"
);

const textoForcaSenha = document.getElementById(
  "textoForcaSenha"
);

const btnSair = document.getElementById("btnSair");

const botoesMostrarSenha = document.querySelectorAll(
  "[data-campo-senha]"
);

/* =========================================
   MENSAGENS DA PÁGINA
========================================= */

let temporizadorMensagem = null;

function esconderMensagem() {
  if (!mensagemPagina) return;

  mensagemPagina.style.display = "none";
  mensagemPagina.textContent = "";

  mensagemPagina.classList.remove(
    "mensagem-sucesso",
    "mensagem-erro",
    "mensagem-aviso"
  );
}

function mostrarMensagem(texto, tipo = "aviso") {
  if (!mensagemPagina) return;

  if (temporizadorMensagem) {
    clearTimeout(temporizadorMensagem);
  }

  esconderMensagem();

  mensagemPagina.textContent = texto;
  mensagemPagina.style.display = "block";

  if (tipo === "sucesso") {
    mensagemPagina.classList.add("mensagem-sucesso");
  } else if (tipo === "erro") {
    mensagemPagina.classList.add("mensagem-erro");
  } else {
    mensagemPagina.classList.add("mensagem-aviso");
  }

  mensagemPagina.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  temporizadorMensagem = setTimeout(() => {
    esconderMensagem();
  }, 9000);
}

/* =========================================
   CONTROLE DOS BOTÕES
========================================= */

function alterarEstadoBotao(
  botao,
  carregando,
  textoCarregando,
  textoNormal
) {
  if (!botao) return;

  botao.disabled = carregando;
  botao.textContent = carregando
    ? textoCarregando
    : textoNormal;
}

/* =========================================
   CARREGAR DADOS DO USUÁRIO
========================================= */

async function carregarDadosDaConta() {
  try {
    /*
      auth.getUser() busca o usuário atualmente autenticado
      no Supabase.
    */
    const {
      data: dadosUsuario,
      error: erroUsuario
    } = await supabase.auth.getUser();

    if (erroUsuario) {
      console.error(
        "Erro ao carregar usuário autenticado:",
        erroUsuario
      );
    }

    const usuario = dadosUsuario?.user || null;

    if (emailAluno) {
      emailAluno.textContent =
        usuario?.email || "E-mail não identificado";

      emailAluno.classList.remove("texto-carregando");
    }

    /*
      O nome é buscado na tabela aluno porque é nela que
      ficam os dados cadastrais do estudante.
    */
    const {
      data: aluno,
      error: erroAluno
    } = await supabase
      .from("aluno")
      .select("id, nome")
      .eq("id", alunoId)
      .maybeSingle();

    if (erroAluno) {
      console.error(
        "Erro ao carregar dados do aluno:",
        erroAluno
      );
    }

    if (nomeAluno) {
      nomeAluno.textContent =
        aluno?.nome || "Nome não identificado";

      nomeAluno.classList.remove("texto-carregando");
    }
  } catch (erro) {
    console.error(
      "Erro inesperado ao carregar a conta:",
      erro
    );

    if (nomeAluno) {
      nomeAluno.textContent = "Não foi possível carregar";
      nomeAluno.classList.remove("texto-carregando");
    }

    if (emailAluno) {
      emailAluno.textContent = "Não foi possível carregar";
      emailAluno.classList.remove("texto-carregando");
    }

    mostrarMensagem(
      "Não foi possível carregar todos os dados da sua conta.",
      "erro"
    );
  }
}

/* =========================================
   NOTIFICAÇÕES — INTERFACE
========================================= */

function removerClassesDeStatus() {
  if (!blocoStatusNotificacoes) return;

  blocoStatusNotificacoes.classList.remove(
    "status-ativo",
    "status-pendente",
    "status-bloqueado",
    "status-indisponivel"
  );
}

function exibirStatusNotificacoes({
  classe,
  icone,
  titulo,
  texto,
  mostrarBotaoAtivar,
  textoBotaoAtivar,
  mostrarInstrucoes
}) {
  removerClassesDeStatus();

  if (classe && blocoStatusNotificacoes) {
    blocoStatusNotificacoes.classList.add(classe);
  }

  if (iconeStatusNotificacoes) {
    iconeStatusNotificacoes.textContent = icone;
  }

  if (tituloStatusNotificacoes) {
    tituloStatusNotificacoes.textContent = titulo;
  }

  if (textoStatusNotificacoes) {
    textoStatusNotificacoes.textContent = texto;
  }

  if (btnAtivarNotificacoes) {
    btnAtivarNotificacoes.style.display =
      mostrarBotaoAtivar ? "inline-flex" : "none";

    btnAtivarNotificacoes.textContent =
      textoBotaoAtivar || "Ativar notificações";
  }

  if (instrucoesNotificacoes) {
    instrucoesNotificacoes.style.display =
      mostrarInstrucoes ? "block" : "none";
  }
}

/* =========================================
   NOTIFICAÇÕES — VERIFICAÇÃO
========================================= */

async function verificarInscricaoPushExistente() {
  try {
    if (!("serviceWorker" in navigator)) {
      return false;
    }

    const registro =
      await navigator.serviceWorker.getRegistration();

    if (!registro || !registro.pushManager) {
      return false;
    }

    const inscricao =
      await registro.pushManager.getSubscription();

    return Boolean(inscricao);
  } catch (erro) {
    console.warn(
      "Não foi possível verificar a inscrição push:",
      erro
    );

    return false;
  }
}

async function verificarStatusNotificacoes() {
  /*
    Alguns navegadores ou ambientes não oferecem
    a API de notificações.
  */
  if (!("Notification" in window)) {
    exibirStatusNotificacoes({
      classe: "status-indisponivel",
      icone: "⚠️",
      titulo: "Notificações indisponíveis",
      texto:
        "Este navegador não oferece suporte às notificações do sistema.",
      mostrarBotaoAtivar: false,
      textoBotaoAtivar: "",
      mostrarInstrucoes: false
    });

    return;
  }

  const permissao = Notification.permission;

  if (permissao === "granted") {
    const possuiInscricao =
      await verificarInscricaoPushExistente();

    exibirStatusNotificacoes({
      classe: "status-ativo",
      icone: "✅",
      titulo: "Notificações permitidas",
      texto: possuiInscricao
        ? "Este aparelho está autorizado e possui uma inscrição ativa para receber avisos."
        : "O navegador permitiu as notificações. O sistema tentará concluir o registro deste aparelho.",
      mostrarBotaoAtivar: !possuiInscricao,
      textoBotaoAtivar: possuiInscricao
        ? "Notificações ativadas"
        : "Concluir ativação",
      mostrarInstrucoes: false
    });

    return;
  }

  if (permissao === "denied") {
    exibirStatusNotificacoes({
      classe: "status-bloqueado",
      icone: "🔕",
      titulo: "Notificações bloqueadas",
      texto:
        "O navegador está impedindo o Beehive de enviar notificações neste aparelho.",
      mostrarBotaoAtivar: false,
      textoBotaoAtivar: "",
      mostrarInstrucoes: true
    });

    return;
  }

  exibirStatusNotificacoes({
    classe: "status-pendente",
    icone: "🔔",
    titulo: "Notificações desativadas",
    texto:
      "Você ainda não autorizou o recebimento de notificações neste navegador.",
    mostrarBotaoAtivar: true,
    textoBotaoAtivar: "Ativar notificações",
    mostrarInstrucoes: false
  });
}

/* =========================================
   TENTATIVA DE REUTILIZAR O SISTEMA PUSH
========================================= */

/*
  Esta função procura uma função de ativação que já possa
  estar carregada no projeto.

  Isso evita duplicar a configuração do Firebase e mantém
  o mesmo sistema que já é usado no alerta inicial.
*/
async function executarFuncaoGlobalDeNotificacoes() {
  const funcoesPossiveis = [
    "ativarNotificacoes",
    "ativarNotificacoesPush",
    "registrarNotificacoes",
    "registrarTokenFCM",
    "registrarTokenPush",
    "solicitarPermissaoNotificacoes",
    "habilitarNotificacoes"
  ];

  for (const nomeFuncao of funcoesPossiveis) {
    if (typeof window[nomeFuncao] === "function") {
      await window[nomeFuncao]();
      return true;
    }
  }

  return false;
}

/*
  Caso a função não esteja disponível no objeto window,
  tentamos importar alguns nomes comuns de arquivos.

  Se nenhum deles existir, o erro é ignorado e a permissão
  do navegador continua sendo tratada normalmente.
*/
async function tentarImportarModuloDeNotificacoes() {
  const caminhosPossiveis = [
    "./notificacoes.js",
    "./notificacoes-push.js",
    "./push-notifications.js",
    "./firebase-notificacoes.js"
  ];

  const nomesDeFuncao = [
    "ativarNotificacoes",
    "ativarNotificacoesPush",
    "registrarNotificacoes",
    "registrarTokenFCM",
    "registrarTokenPush",
    "solicitarPermissaoNotificacoes",
    "habilitarNotificacoes"
  ];

  for (const caminho of caminhosPossiveis) {
    try {
      const modulo = await import(caminho);

      for (const nomeFuncao of nomesDeFuncao) {
        if (typeof modulo[nomeFuncao] === "function") {
          await modulo[nomeFuncao]();
          return true;
        }
      }

      if (typeof modulo.default === "function") {
        await modulo.default();
        return true;
      }
    } catch (erro) {
      /*
        O arquivo pode simplesmente não existir.
        Nesse caso seguimos para a próxima possibilidade.
      */
      console.debug(
        `Módulo de notificação não encontrado em ${caminho}.`
      );
    }
  }

  return false;
}

async function concluirRegistroDasNotificacoes() {
  /*
    Primeiro tenta usar uma função que já esteja carregada.
  */
  let executouRegistro =
    await executarFuncaoGlobalDeNotificacoes();

  /*
    Se não encontrou, tenta importar o módulo existente.
  */
  if (!executouRegistro) {
    executouRegistro =
      await tentarImportarModuloDeNotificacoes();
  }

  /*
    Este evento permite que o código atual de notificações
    do Beehive escute e conclua o cadastro do token.

    Não causa erro caso ainda não exista um ouvinte.
  */
  window.dispatchEvent(
    new CustomEvent("beehive:ativar-notificacoes", {
      detail: {
        alunoId: Number(alunoId),
        origem: "configuracoes-aluno"
      }
    })
  );

  return executouRegistro;
}

/* =========================================
   ATIVAR NOTIFICAÇÕES
========================================= */

async function ativarNotificacoes() {
  if (!("Notification" in window)) {
    mostrarMensagem(
      "Este navegador não oferece suporte às notificações.",
      "erro"
    );

    return;
  }

  if (Notification.permission === "denied") {
    mostrarMensagem(
      "As notificações estão bloqueadas no navegador. Siga as instruções exibidas na página para alterar a permissão.",
      "aviso"
    );

    await verificarStatusNotificacoes();
    return;
  }

  alterarEstadoBotao(
    btnAtivarNotificacoes,
    true,
    "Ativando...",
    "Ativar notificações"
  );

  try {
    /*
      Quando a permissão ainda está como "default",
      o navegador exibe a janela oficial perguntando
      se o usuário deseja permitir.
    */
    let permissao = Notification.permission;

    if (permissao === "default") {
      permissao = await Notification.requestPermission();
    }

    if (permissao === "denied") {
      mostrarMensagem(
        "A permissão não foi concedida. Você poderá liberá-la nas configurações do navegador.",
        "aviso"
      );

      await verificarStatusNotificacoes();
      return;
    }

    if (permissao !== "granted") {
      mostrarMensagem(
        "Não foi possível ativar as notificações neste momento.",
        "erro"
      );

      await verificarStatusNotificacoes();
      return;
    }

    /*
      Com a permissão concedida, tentamos registrar o token
      usando o sistema de notificações que já existe no projeto.
    */
    const registroExecutado =
      await concluirRegistroDasNotificacoes();

    await verificarStatusNotificacoes();

    if (registroExecutado) {
      mostrarMensagem(
        "Notificações ativadas com sucesso neste aparelho!",
        "sucesso"
      );
    } else {
      mostrarMensagem(
        "A permissão foi concedida. O sistema concluirá o registro deste aparelho ao carregar novamente a área do aluno.",
        "sucesso"
      );
    }
  } catch (erro) {
    console.error(
      "Erro ao ativar notificações:",
      erro
    );

    mostrarMensagem(
      "Não foi possível concluir a ativação das notificações. Tente novamente.",
      "erro"
    );
  } finally {
    alterarEstadoBotao(
      btnAtivarNotificacoes,
      false,
      "Ativando...",
      "Ativar notificações"
    );

    await verificarStatusNotificacoes();
  }
}

/* =========================================
   FORÇA DA SENHA
========================================= */

function calcularForcaSenha(senha) {
  let pontos = 0;

  if (senha.length >= 8) {
    pontos += 1;
  }

  if (senha.length >= 12) {
    pontos += 1;
  }

  if (/[a-z]/.test(senha)) {
    pontos += 1;
  }

  if (/[A-Z]/.test(senha)) {
    pontos += 1;
  }

  if (/[0-9]/.test(senha)) {
    pontos += 1;
  }

  if (/[^a-zA-Z0-9]/.test(senha)) {
    pontos += 1;
  }

  return pontos;
}

function atualizarIndicadorForcaSenha() {
  if (
    !novaSenha ||
    !preenchimentoForcaSenha ||
    !textoForcaSenha
  ) {
    return;
  }

  const senha = novaSenha.value;

  if (!senha) {
    preenchimentoForcaSenha.style.width = "0%";
    preenchimentoForcaSenha.style.background = "#b9b9b9";

    textoForcaSenha.textContent =
      "Digite uma senha para verificar a segurança.";

    return;
  }

  const pontos = calcularForcaSenha(senha);

  if (pontos <= 2) {
    preenchimentoForcaSenha.style.width = "33%";
    preenchimentoForcaSenha.style.background = "#c65f50";

    textoForcaSenha.textContent =
      "Senha fraca. Acrescente números, letras maiúsculas ou símbolos.";

    return;
  }

  if (pontos <= 4) {
    preenchimentoForcaSenha.style.width = "66%";
    preenchimentoForcaSenha.style.background = "#d3a92b";

    textoForcaSenha.textContent =
      "Senha razoável. Você pode deixá-la ainda mais segura.";

    return;
  }

  preenchimentoForcaSenha.style.width = "100%";
  preenchimentoForcaSenha.style.background = "#4d9858";

  textoForcaSenha.textContent =
    "Senha forte.";
}

/* =========================================
   VALIDAR ALTERAÇÃO DE SENHA
========================================= */

function validarNovaSenha() {
  const senha = novaSenha?.value || "";
  const confirmacao = confirmarNovaSenha?.value || "";

  if (!senha || !confirmacao) {
    mostrarMensagem(
      "Preencha a nova senha e a confirmação.",
      "aviso"
    );

    return false;
  }

  if (senha.length < 8) {
    mostrarMensagem(
      "A nova senha precisa ter pelo menos 8 caracteres.",
      "aviso"
    );

    novaSenha.focus();
    return false;
  }

  if (senha.length > 72) {
    mostrarMensagem(
      "A senha não pode ter mais de 72 caracteres.",
      "aviso"
    );

    novaSenha.focus();
    return false;
  }

  if (senha !== confirmacao) {
    mostrarMensagem(
      "A nova senha e a confirmação não são iguais.",
      "aviso"
    );

    confirmarNovaSenha.focus();
    return false;
  }

  /*
    Evita algumas senhas muito fáceis.
  */
  const senhasMuitoFaceis = [
    "12345678",
    "123456789",
    "password",
    "senha123",
    "beehive1",
    "abcdefgh"
  ];

  if (senhasMuitoFaceis.includes(senha.toLowerCase())) {
    mostrarMensagem(
      "Essa senha é muito fácil. Escolha uma senha mais segura.",
      "aviso"
    );

    novaSenha.focus();
    return false;
  }

  return true;
}

/* =========================================
   ALTERAR SENHA NO SUPABASE
========================================= */

async function alterarSenha(evento) {
  evento.preventDefault();

  esconderMensagem();

  if (!validarNovaSenha()) {
    return;
  }

  alterarEstadoBotao(
    btnAlterarSenha,
    true,
    "Salvando...",
    "Salvar nova senha"
  );

  try {
    const senha = novaSenha.value;

    /*
      updateUser() altera os dados do usuário que está
      autenticado. Neste caso, altera somente a senha.
    */
    const {
      data,
      error
    } = await supabase.auth.updateUser({
      password: senha
    });

    if (error) {
      console.error(
        "Erro retornado ao alterar senha:",
        error
      );

      /*
        Alguns erros comuns são traduzidos para mensagens
        mais fáceis de entender.
      */
      const mensagemErro =
        String(error.message || "").toLowerCase();

      if (
        mensagemErro.includes("same password") ||
        mensagemErro.includes("different from the old password")
      ) {
        throw new Error(
          "A nova senha precisa ser diferente da senha atual."
        );
      }

      if (
        mensagemErro.includes("weak") ||
        mensagemErro.includes("password")
      ) {
        throw new Error(
          "A senha não atende aos requisitos de segurança. Escolha outra senha."
        );
      }

      if (
        mensagemErro.includes("session") ||
        mensagemErro.includes("jwt")
      ) {
        throw new Error(
          "Sua sessão expirou. Entre novamente no sistema e tente alterar a senha."
        );
      }

      throw error;
    }

    if (!data?.user) {
      throw new Error(
        "O Supabase não confirmou a alteração da senha."
      );
    }

    formAlterarSenha.reset();
    atualizarIndicadorForcaSenha();

    mostrarMensagem(
      "Senha alterada com sucesso! Use a nova senha no próximo acesso.",
      "sucesso"
    );
  } catch (erro) {
    console.error(
      "Erro inesperado ao alterar senha:",
      erro
    );

    mostrarMensagem(
      erro?.message ||
        "Não foi possível alterar a senha. Tente novamente.",
      "erro"
    );
  } finally {
    alterarEstadoBotao(
      btnAlterarSenha,
      false,
      "Salvando...",
      "Salvar nova senha"
    );
  }
}

/* =========================================
   MOSTRAR OU ESCONDER SENHAS
========================================= */

function alternarVisibilidadeSenha(botao) {
  const campoId = botao.dataset.campoSenha;
  const campo = document.getElementById(campoId);

  if (!campo) return;

  const estaEscondida = campo.type === "password";

  campo.type = estaEscondida ? "text" : "password";
  botao.textContent = estaEscondida ? "🙈" : "👁️";

  botao.setAttribute(
    "aria-label",
    estaEscondida ? "Esconder senha" : "Mostrar senha"
  );
}

/* =========================================
   SAIR DA CONTA
========================================= */

function limparDadosLocaisDoAluno() {
  const chavesAluno = [
    "alunoId",
    "aluno_id",
    "idAluno",
    "alunoIdVisualizacao",
    "matriculaSelecionadaId",
    "materiaSelecionadaId",
    "moduloSelecionadoId",
    "nomeCursoSelecionado"
  ];

  chavesAluno.forEach((chave) => {
    localStorage.removeItem(chave);
    sessionStorage.removeItem(chave);
  });
}

async function sairDaConta() {
  if (btnSair) {
    btnSair.disabled = true;
    btnSair.textContent = "Saindo...";
  }

  try {
    const {
      error
    } = await supabase.auth.signOut();

    if (error) {
      console.warn(
        "O Supabase retornou erro ao sair:",
        error
      );
    }
  } catch (erro) {
    console.warn(
      "Erro inesperado ao encerrar a sessão:",
      erro
    );
  } finally {
    limparDadosLocaisDoAluno();
    window.location.href = "index.html";
  }
}

/* =========================================
   EVENTOS
========================================= */

if (btnAtivarNotificacoes) {
  btnAtivarNotificacoes.addEventListener(
    "click",
    ativarNotificacoes
  );
}

if (btnVerificarNotificacoes) {
  btnVerificarNotificacoes.addEventListener(
    "click",
    async () => {
      alterarEstadoBotao(
        btnVerificarNotificacoes,
        true,
        "Verificando...",
        "Verificar novamente"
      );

      try {
        await verificarStatusNotificacoes();

        if (
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          await concluirRegistroDasNotificacoes();

          mostrarMensagem(
            "A permissão de notificações está liberada neste navegador.",
            "sucesso"
          );
        } else if (
          "Notification" in window &&
          Notification.permission === "denied"
        ) {
          mostrarMensagem(
            "As notificações ainda estão bloqueadas nas configurações do navegador.",
            "aviso"
          );
        }
      } catch (erro) {
        console.error(
          "Erro ao verificar notificações:",
          erro
        );

        mostrarMensagem(
          "Não foi possível verificar as notificações.",
          "erro"
        );
      } finally {
        alterarEstadoBotao(
          btnVerificarNotificacoes,
          false,
          "Verificando...",
          "Verificar novamente"
        );
      }
    }
  );
}

if (formAlterarSenha) {
  formAlterarSenha.addEventListener(
    "submit",
    alterarSenha
  );
}

if (novaSenha) {
  novaSenha.addEventListener(
    "input",
    atualizarIndicadorForcaSenha
  );
}

botoesMostrarSenha.forEach((botao) => {
  botao.addEventListener("click", () => {
    alternarVisibilidadeSenha(botao);
  });
});

if (btnSair) {
  btnSair.addEventListener(
    "click",
    sairDaConta
  );
}

/*
  Quando o usuário volta das configurações do navegador,
  verificamos novamente a permissão.
*/
window.addEventListener("focus", async () => {
  await verificarStatusNotificacoes();
});

document.addEventListener(
  "visibilitychange",
  async () => {
    if (document.visibilityState === "visible") {
      await verificarStatusNotificacoes();
    }
  }
);

/* =========================================
   INICIALIZAÇÃO
========================================= */

async function iniciarPagina() {
  await Promise.all([
    carregarDadosDaConta(),
    verificarStatusNotificacoes()
  ]);
}

iniciarPagina();