export const MAX_AVALIACOES_POR_MODULO = 2;

const dataConclusaoNaEscola = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function resolverAvaliacoesPrevistas({
  avaliacoesEsperadas,
  notasAvaliacao,
  extrairNumeroAvaliacaoDaNota,
  obterEnvio,
  statusAvaliacaoConcluida
}) {
  const numerosResolvidos = new Set();
  const datasNotasSemNumero = [];

  for (const nota of notasAvaliacao) {
    const numero = extrairNumeroAvaliacaoDaNota(nota);
    if (numero) {
      numerosResolvidos.add(numero);
    } else {
      datasNotasSemNumero.push(nota.data);
    }
  }

  for (let numero = 1; numero <= MAX_AVALIACOES_POR_MODULO; numero++) {
    const envio = obterEnvio(numero);
    if (numerosResolvidos.has(numero) || !statusAvaliacaoConcluida(envio?.status)) {
      continue;
    }

    numerosResolvidos.add(numero);

    // Notas antigas sem número podem registrar o mesmo lançamento que concluiu o envio.
    const conclusao = Date.parse(envio.concluida_em);
    if (Number.isFinite(conclusao)) {
      const dataConclusao = dataConclusaoNaEscola.format(conclusao);
      const indice = datasNotasSemNumero.indexOf(dataConclusao);
      if (indice !== -1) {
        datasNotasSemNumero.splice(indice, 1);
      }
    }
  }

  const numerosPendentes = [];
  for (let numero = 1; numero <= avaliacoesEsperadas; numero++) {
    if (numerosResolvidos.has(numero)) {
      continue;
    }
    if (datasNotasSemNumero.length) {
      datasNotasSemNumero.pop();
      continue;
    }
    numerosPendentes.push(numero);
  }

  return {
    totalResolvidas: avaliacoesEsperadas - numerosPendentes.length,
    numerosPendentes
  };
}
