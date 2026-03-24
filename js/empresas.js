import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const form = document.getElementById("form-empresa");
const msg = document.getElementById("msg");

// ==========================
// Mensagem
// ==========================
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

// ==========================
// Salvar empresa
// ==========================
form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const cnpj = document.getElementById("cnpj").value.trim();
    const nome = document.getElementById("nome").value.trim();
    const email = document.getElementById("email").value.trim();
    const telefone = document.getElementById("telefone").value.trim();
    const observacao = document.getElementById("observacao").value.trim();

    if (!cnpj || !nome) {
        mostrarMensagem("Preencha CNPJ e Nome", false);
        return;
    }

    // ==========================
    // Verifica se já existe
    // ==========================
    const { data: existente } = await supabase
        .from("empresaparceira")
        .select("cnpj")
        .eq("cnpj", cnpj)
        .maybeSingle();

    if (existente) {
        mostrarMensagem("Empresa já cadastrada", false);
        return;
    }

    // ==========================
    // Inserir empresa
    // ==========================
    const { error } = await supabase
        .from("empresaparceira")
        .insert({
            cnpj,
            nome,
            email: email || null,
            telefone: telefone || null,
            observacao: observacao || null
        });

    if (error) {
        console.error(error);
        mostrarMensagem("Erro ao salvar empresa", false);
        return;
    }

    mostrarMensagem("Empresa cadastrada com sucesso");

    form.reset();
});