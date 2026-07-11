import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

/* =========================
   Elementos da página
========================= */

const btnSair = document.getElementById("btnSair");
const msg = document.getElementById("msg");

const formCriarAcesso = document.getElementById(
  "formCriarAcesso"
);

const tipoUsuario = document.getElementById(
  "tipoUsuario"
);

const grupoPessoaCadastrada = document.getElementById(
  "grupoPessoaCadastrada"
);

const pessoaCadastrada = document.getElementById(
  "pessoaCadastrada"
);

const grupoCadastroManual = document.getElementById(
  "grupoCadastroManual"
);

const nomeManual = document.getElementById(
  "nomeManual"
);

const grupoEmail = document.getElementById(
  "grupoEmail"
);

const emailUsuario = document.getElementById(
  "emailUsuario"
);

const avisoAlunoExperimental = document.getElementById(
  "avisoAlunoExperimental"
);

const grupoConfirmacaoAluno = document.getElementById(
  "grupoConfirmacaoAluno"
);

const confirmarMatriculaAluno = document.getElementById(
  "confirmarMatriculaAluno"
);

const resumoConvite = document.getElementById(
  "resumoConvite"
);

const resumoNome = document.getElementById(
  "resumoNome"
);

const resumoEmail = document.getElementById(
  "resumoEmail"
);

const resumoTipo = document.getElementById(
  "resumoTipo"
);

const btnCriarAcesso = document.getElementById(
  "btnCriarAcesso"
);

let pessoasCarregadas = [];

/* =========================
   Mensagens
========================= */

function mostrarMensagem(
  texto,
  tipo = "sucesso"
) {
  msg.style.display = "block";
  msg.textContent = texto;

  if (tipo === "erro") {
    msg.className = "msg erro";
  } else {
    msg.className = "msg sucesso";
  }

  msg.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function esconderMensagem() {
  msg.style.display = "none";
  msg.textContent = "";
  msg.className = "";
}

/* =========================
   Funções auxiliares
========================= */

function normalizarTexto(valor) {
  return String(valor || "").trim();
}

function normalizarEmail(valor) {
  return normalizarTexto(valor)
    .toLowerCase();
}

function obterNomePessoa(registro) {
  return normalizarTexto(
    registro.nome ||
    registro.nome_completo ||
    registro.nome_aluno ||
    registro.nome_professor
  );
}

function obterEmailPessoa(registro) {
  return normalizarEmail(
    registro.email ||
    registro.email_aluno ||
    registro.email_professor
  );
}

function obterTipoPorExtenso(tipo) {
  const tipos = {
    aluno: "Aluno",
    professor: "Professor",
    admin: "Funcionário administrativo"
  };

  return tipos[tipo] || "—";
}

function limparSelectPessoa() {
  pessoaCadastrada.innerHTML = `
    <option value="">
      Selecione uma pessoa
    </option>
  `;
}

function redefinirFormulario(
  preservarMensagem = false
) {
  if (!preservarMensagem) {
    esconderMensagem();
  }

  pessoasCarregadas = [];

  limparSelectPessoa();

  pessoaCadastrada.disabled = true;
  pessoaCadastrada.required = false;

  nomeManual.value = "";
  nomeManual.required = false;

  emailUsuario.value = "";
  emailUsuario.disabled = true;
  emailUsuario.required = false;

  confirmarMatriculaAluno.checked = false;

  grupoPessoaCadastrada.style.display =
    "none";

  grupoCadastroManual.style.display =
    "none";

  grupoEmail.style.display =
    "none";

  avisoAlunoExperimental.style.display =
    "none";

  grupoConfirmacaoAluno.style.display =
    "none";

  resumoConvite.style.display =
    "none";

  btnCriarAcesso.disabled = true;
}

function obterDadosAtuais() {
  const tipo = tipoUsuario.value;

  if (!tipo) {
    return {
      tipo: "",
      cadastroId: "",
      nome: "",
      email: ""
    };
  }

  if (tipo === "admin") {
    return {
      tipo,
      cadastroId: null,
      nome: normalizarTexto(
        nomeManual.value
      ),
      email: normalizarEmail(
        emailUsuario.value
      )
    };
  }

  const cadastroId =
    pessoaCadastrada.value;

  const pessoa =
    pessoasCarregadas.find(
      (item) =>
        String(item.id) ===
        String(cadastroId)
    );

  return {
    tipo,
    cadastroId: cadastroId || "",
    nome: pessoa
      ? obterNomePessoa(pessoa)
      : "",
    email: normalizarEmail(
      emailUsuario.value
    )
  };
}

function emailPareceValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

function formularioEstaValido() {
  const dados = obterDadosAtuais();

  if (!dados.tipo) {
    return false;
  }

  if (!dados.nome) {
    return false;
  }

  if (
    !dados.email ||
    !emailPareceValido(dados.email)
  ) {
    return false;
  }

  if (
    dados.tipo !== "admin" &&
    !dados.cadastroId
  ) {
    return false;
  }

  if (
    dados.tipo === "aluno" &&
    !confirmarMatriculaAluno.checked
  ) {
    return false;
  }

  return true;
}

function atualizarResumo() {
  const dados = obterDadosAtuais();

  const temDadosMinimos =
    dados.tipo &&
    dados.nome &&
    dados.email;

  if (!temDadosMinimos) {
    resumoConvite.style.display =
      "none";

    btnCriarAcesso.disabled = true;
    return;
  }

  resumoNome.textContent =
    dados.nome;

  resumoEmail.textContent =
    dados.email;

  resumoTipo.textContent =
    obterTipoPorExtenso(dados.tipo);

  resumoConvite.style.display =
    "block";

  btnCriarAcesso.disabled =
    !formularioEstaValido();
}

/* =========================
   Carregar pessoas
========================= */

async function carregarPessoas(tipo) {
  grupoPessoaCadastrada.style.display =
    "block";

  pessoaCadastrada.disabled = true;

  pessoaCadastrada.innerHTML = `
    <option value="">
      Carregando cadastros...
    </option>
  `;

  try {
    const tabela =
      tipo === "aluno"
        ? "aluno"
        : "professor";

    const { data, error } =
      await supabase
        .from(tabela)
        .select("*");

    if (error) {
      throw error;
    }

    pessoasCarregadas = [
      ...(data || [])
    ].sort(
      (pessoaA, pessoaB) => {
        const nomeA =
          obterNomePessoa(pessoaA);

        const nomeB =
          obterNomePessoa(pessoaB);

        return nomeA.localeCompare(
          nomeB,
          "pt-BR"
        );
      }
    );

    limparSelectPessoa();

    if (
      pessoasCarregadas.length === 0
    ) {
      pessoaCadastrada.innerHTML = `
        <option value="">
          Nenhum cadastro encontrado
        </option>
      `;

      mostrarMensagem(
        `Nenhum ${
          tipo === "aluno"
            ? "aluno"
            : "professor"
        } foi encontrado.`,
        "erro"
      );

      return;
    }

    pessoasCarregadas.forEach(
      (pessoa) => {
        const option =
          document.createElement(
            "option"
          );

        const nome =
          obterNomePessoa(pessoa);

        const email =
          obterEmailPessoa(pessoa);

        option.value = pessoa.id;

        option.textContent = email
          ? `${nome} — ${email}`
          : `${nome} — sem e-mail cadastrado`;

        pessoaCadastrada.appendChild(
          option
        );
      }
    );

    pessoaCadastrada.disabled = false;
    pessoaCadastrada.required = true;
  } catch (error) {
    console.error(
      "Erro ao carregar cadastros:",
      error
    );

    pessoaCadastrada.innerHTML = `
      <option value="">
        Não foi possível carregar os cadastros
      </option>
    `;

    mostrarMensagem(
      "Não foi possível carregar os cadastros. Verifique sua conexão e tente novamente.",
      "erro"
    );
  }
}

/* =========================
   Eventos
========================= */

tipoUsuario.addEventListener(
  "change",
  async () => {
    redefinirFormulario();

    const tipo = tipoUsuario.value;

    if (!tipo) {
      return;
    }

    grupoEmail.style.display =
      "block";

    emailUsuario.required = true;

    if (tipo === "admin") {
      grupoCadastroManual.style.display =
        "block";

      nomeManual.required = true;
      emailUsuario.disabled = false;

      atualizarResumo();
      return;
    }

    if (tipo === "aluno") {
      avisoAlunoExperimental.style.display =
        "block";

      grupoConfirmacaoAluno.style.display =
        "block";
    }

    await carregarPessoas(tipo);
  }
);

pessoaCadastrada.addEventListener(
  "change",
  () => {
    esconderMensagem();

    const cadastroId =
      pessoaCadastrada.value;

    const pessoa =
      pessoasCarregadas.find(
        (item) =>
          String(item.id) ===
          String(cadastroId)
      );

    if (!pessoa) {
      emailUsuario.value = "";
      emailUsuario.disabled = true;

      atualizarResumo();
      return;
    }

    emailUsuario.value =
      obterEmailPessoa(pessoa);

    emailUsuario.disabled = false;

    atualizarResumo();
  }
);

nomeManual.addEventListener(
  "input",
  atualizarResumo
);

emailUsuario.addEventListener(
  "input",
  atualizarResumo
);

confirmarMatriculaAluno.addEventListener(
  "change",
  atualizarResumo
);

/* =========================
   Criar acesso
========================= */

formCriarAcesso.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    esconderMensagem();

    if (!formularioEstaValido()) {
      mostrarMensagem(
        "Preencha todos os campos obrigatórios antes de criar o acesso.",
        "erro"
      );

      return;
    }

    const dados = obterDadosAtuais();

    const confirmarEnvio =
      window.confirm(
        `Deseja criar o acesso de ${dados.nome} e enviar o convite para ${dados.email}?`
      );

    if (!confirmarEnvio) {
      return;
    }

    const textoOriginalBotao =
      btnCriarAcesso.textContent;

    btnCriarAcesso.disabled = true;

    btnCriarAcesso.textContent =
      "Criando acesso e enviando e-mail...";

    try {
      const { data, error } =
        await supabase.functions.invoke(
          "criar-acesso-usuario",
          {
            body: {
              tipo: dados.tipo,
              cadastro_id:
                dados.cadastroId,
              nome: dados.nome,
              email: dados.email
            }
          }
        );

      if (error) {
        throw error;
      }

      if (data?.erro) {
        throw new Error(data.erro);
      }

      formCriarAcesso.reset();
      tipoUsuario.value = "";

      redefinirFormulario(true);

      mostrarMensagem(
        data?.mensagem ||
        `E-mail de boas-vindas com solicitação de criação de senha enviado com sucesso para ${dados.email}.`,
        "sucesso"
      );
    } catch (error) {
      console.error(
        "Erro ao criar acesso:",
        error
      );

      const mensagemErro =
        error?.context?.body?.erro ||
        error?.context?.body?.mensagem ||
        error?.message ||
        "Não foi possível criar o acesso nem enviar o e-mail.";

      mostrarMensagem(
        mensagemErro,
        "erro"
      );

      btnCriarAcesso.disabled =
        !formularioEstaValido();
    } finally {
      btnCriarAcesso.textContent =
        textoOriginalBotao;
    }
  }
);

/* =========================
   Sair
========================= */

btnSair.addEventListener(
  "click",
  async () => {
    try {
      const { error } =
        await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      localStorage.removeItem("role");
      localStorage.removeItem(
        "professorId"
      );
      localStorage.removeItem(
        "professorNome"
      );
      localStorage.removeItem(
        "professorEmail"
      );

      window.location.href =
        "index.html";
    } catch (error) {
      console.error(
        "Erro ao sair:",
        error
      );

      alert(
        "Não foi possível sair neste momento."
      );
    }
  }
);