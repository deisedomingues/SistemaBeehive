const PAINEIS = {
  admin: "home-admin.html",
  pedagogico: "home-pedagogico.html"
};

export function origemBuscaAlunos(params = new URLSearchParams(location.search)) {
  const origem = params.get("busca");
  return Object.hasOwn(PAINEIS, origem) ? origem : null;
}

export function prepararRetornoBusca(origem, seletor) {
  if (!origem) return;

  const destino = `${PAINEIS[origem]}?retorno=busca#busca-alunos`;
  document.querySelectorAll(seletor).forEach((link) => {
    link.href = destino;
    link.textContent = "← Voltar à busca";
  });
}
