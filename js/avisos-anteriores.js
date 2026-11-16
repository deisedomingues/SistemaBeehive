export function criarAvisosAnteriores(avisos, renderizarCard, aberto) {
  if (!avisos.length) return null;

  const historico = document.createElement("details");
  historico.className = "avisos-anteriores";
  historico.open = aberto;

  const titulo = document.createElement("summary");
  titulo.textContent = `Avisos anteriores (${avisos.length})`;
  historico.appendChild(titulo);

  const lista = document.createElement("div");
  lista.className = "avisos-anteriores-lista";
  avisos.forEach((aviso) => lista.appendChild(renderizarCard(aviso)));
  historico.appendChild(lista);

  return historico;
}
