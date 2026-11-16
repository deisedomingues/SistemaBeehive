import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const form = document.getElementById("form-empresa");
const msg = document.getElementById("msg");

// ==========================
// Mensagem
// ==========================
let timeoutMensagem;

function mostrarMensagem(texto, ok = true) {

    msg.textContent = texto;
    msg.style.display = "block";

    msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
    msg.style.color = ok ? "#1b5e20" : "#b71c1c";

    clearTimeout(timeoutMensagem);
    timeoutMensagem = setTimeout(() => {
        msg.style.display = "none";
        msg.textContent = "";
    }, 2500);
}

const tipoCadastro = document.getElementById("tipo-cadastro");
const camposEmpresa = document.getElementById("campos-empresa");
const nome = document.getElementById("nome");
const observacao = document.getElementById("observacao");
const botaoSalvar = form.querySelector('button[type="submit"]');

function atualizarCampos() {
    const equipe = tipoCadastro.value === "equipe";
    camposEmpresa.hidden = equipe;
    camposEmpresa.querySelectorAll("input").forEach((campo) => {
        campo.disabled = equipe;
    });
    nome.placeholder = equipe ? "Ex: Turma 1" : "Ex: Empresa ABC";
    observacao.placeholder = equipe ? "Ex: Inglês às terças e quintas" : "Ex: Enviar relatório mensal";
}

tipoCadastro.addEventListener("change", atualizarCampos);
atualizarCampos();

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (botaoSalvar.disabled) return;

    const campos = new FormData(form);
    const registro = Object.fromEntries(
        [...campos].map(([campo, valor]) => [campo, valor.trim() || null])
    );

    if (!registro.nome) {
        mostrarMensagem("Informe o nome da empresa ou equipe.", false);
        nome.focus();
        return;
    }

    if (registro.cnpj) {
        registro.cnpj = registro.cnpj.replace(/[.\/\s-]/g, "").toUpperCase();
        if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(registro.cnpj)) {
            mostrarMensagem("Informe um CNPJ de 14 caracteres ou deixe o campo vazio.", false);
            document.getElementById("cnpj").focus();
            return;
        }
    }

    botaoSalvar.disabled = true;
    try {
        const { error } = await supabase.from("empresaparceira").insert(registro);
        if (error) {
            if (error.code === "23505") {
                mostrarMensagem("Já existe um cadastro com esse identificador.", false);
                return;
            }
            throw error;
        }

        mostrarMensagem("Cadastro salvo com sucesso.");
        form.reset();
        atualizarCampos();
    } catch (error) {
        console.error(error);
        mostrarMensagem("Erro ao salvar o cadastro.", false);
    } finally {
        botaoSalvar.disabled = false;
    }
});
