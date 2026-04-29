import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const msg = document.getElementById("msgFinanceiro");

function mostrarMensagem(texto, ok = true) {
  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.padding = "10px 12px";
  msg.style.borderRadius = "10px";
  msg.style.fontSize = "13px";
  msg.style.fontWeight = "600";
  msg.style.backgroundColor = ok ? "#e8f5e9" : "#fff8e1";
  msg.style.color = ok ? "#1b5e20" : "#6b5200";
  msg.style.border = ok ? "1px solid #66bb6a" : "1px solid #f1d98a";

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
  }, 3000);
}

document.querySelectorAll(".card-financeiro-bloqueado").forEach((card) => {
  card.addEventListener("click", (e) => {
    e.preventDefault();
    const modulo = card.dataset.modulo || "Este módulo";
    mostrarMensagem(`${modulo} ainda será desenvolvido.`);
  });
});