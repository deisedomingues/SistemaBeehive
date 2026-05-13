document.addEventListener("DOMContentLoaded", async () => {
  if (typeof exigirAdmin === "function") {
    await exigirAdmin();
  }

  const listaFixos = document.getElementById("listaFixos");
  const contadorFixos = document.getElementById("contadorFixos");
  const msg = document.getElementById("msg");

  const filtroTipo = document.getElementById("filtroTipo");
  const filtroStatus = document.getElementById("filtroStatus");
  const filtroNome = document.getElementById("filtroNome");

  let fixos = [];
  let parcelas = [];

  function mostrarMsg(texto, tipo = "erro") {
    msg.style.display = "block";
    msg.textContent = texto;
    msg.className = tipo === "erro" ? "msg-erro" : "msg-sucesso";
  }

  function formatarMoeda(valor) {
    const numero = Number(valor || 0);

    return numero.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function formatarData(data) {
    if (!data) return "Não informado";

    const partes = data.split("-");
    if (partes.length !== 3) return data;

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  function formatarTipo(tipo) {
    if (tipo === "administrativo") return "Administrativo";
    if (tipo === "professor") return "Professor";
    return tipo || "Não informado";
  }

  function formatarFormaPagamento(forma) {
    if (forma === "unica") return "Parcela única";
    if (forma === "duas_parcelas") return "Duas parcelas";
    return forma || "Não informado";
  }

  function montarTextoParcelas(fixo) {
    const parcelasDoFixo = parcelas
      .filter((parcela) => parcela.financeiro_fixo_id === fixo.id)
      .sort((a, b) => a.numero_parcela - b.numero_parcela);

    if (!parcelasDoFixo.length) {
      return "Parcelas não cadastradas.";
    }

    return parcelasDoFixo
      .map((parcela) => {
        return `${formatarMoeda(parcela.valor)} no dia ${parcela.dia_vencimento}`;
      })
      .join(" + ");
  }

  function aplicarFiltros() {
    const tipoSelecionado = filtroTipo.value;
    const statusSelecionado = filtroStatus.value;
    const nomeDigitado = filtroNome.value.trim().toLowerCase();

    return fixos.filter((fixo) => {
      const passaTipo = !tipoSelecionado || fixo.tipo === tipoSelecionado;

      const passaStatus =
        !statusSelecionado ||
        (statusSelecionado === "ativo" && fixo.ativo) ||
        (statusSelecionado === "inativo" && !fixo.ativo);

      const passaNome =
        !nomeDigitado ||
        fixo.pessoa_nome.toLowerCase().includes(nomeDigitado);

      return passaTipo && passaStatus && passaNome;
    });
  }

  function renderizarFixos() {
    const fixosFiltrados = aplicarFiltros();

    contadorFixos.textContent =
      fixosFiltrados.length === 1
        ? "1 registro"
        : `${fixosFiltrados.length} registros`;

    if (!fixosFiltrados.length) {
      listaFixos.innerHTML = `
        <p style="margin:0;">
          Nenhum custo fixo encontrado com os filtros selecionados.
        </p>
      `;
      return;
    }

    listaFixos.innerHTML = fixosFiltrados
      .map((fixo) => {
        const statusTexto = fixo.ativo ? "Ativo" : "Inativo";
        const observacao = fixo.observacao
          ? fixo.observacao
          : "Sem observações.";

        const dataFim = fixo.data_fim
          ? formatarData(fixo.data_fim)
          : "Sem data final";

        return `
          <article style="border:1px solid rgba(0,0,0,0.08); border-radius:14px; padding:14px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
              <div>
                <strong style="font-size:18px;">${fixo.pessoa_nome}</strong>
                <p style="margin:4px 0 0 0; opacity:0.8;">
                  ${formatarTipo(fixo.tipo)} • ${fixo.descricao}
                </p>
              </div>

              <span style="font-size:13px; font-weight:700;">
                ${statusTexto}
              </span>
            </div>

            <p style="margin:0 0 6px 0;">
              <strong>Valor mensal:</strong> ${formatarMoeda(fixo.valor_mensal)}
            </p>

            <p style="margin:0 0 6px 0;">
              <strong>Forma de pagamento:</strong> ${formatarFormaPagamento(fixo.forma_pagamento)}
            </p>

            <p style="margin:0 0 6px 0;">
              <strong>Parcelas:</strong> ${montarTextoParcelas(fixo)}
            </p>

            <p style="margin:0 0 6px 0;">
              <strong>Vigência:</strong> ${formatarData(fixo.data_inicio)} até ${dataFim}
            </p>

            <p style="margin:0;">
              <strong>Observação:</strong> ${observacao}
            </p>
          </article>
        `;
      })
      .join("");
  }

  async function carregarDados() {
    listaFixos.innerHTML = "<p>Carregando custos fixos...</p>";

    const { data: dadosFixos, error: erroFixos } = await supabase
      .from("financeiro_fixo")
      .select("*")
      .order("ativo", { ascending: false })
      .order("tipo", { ascending: true })
      .order("pessoa_nome", { ascending: true });

    if (erroFixos) {
      console.error(erroFixos);
      mostrarMsg("Erro ao carregar os custos fixos.");
      listaFixos.innerHTML = "<p>Não foi possível carregar os custos fixos.</p>";
      return;
    }

    const { data: dadosParcelas, error: erroParcelas } = await supabase
      .from("financeiro_fixo_parcela")
      .select("*")
      .order("numero_parcela", { ascending: true });

    if (erroParcelas) {
      console.error(erroParcelas);
      mostrarMsg("Erro ao carregar as parcelas dos custos fixos.");
      listaFixos.innerHTML = "<p>Não foi possível carregar as parcelas.</p>";
      return;
    }

    fixos = dadosFixos || [];
    parcelas = dadosParcelas || [];

    renderizarFixos();
  }

  filtroTipo.addEventListener("change", renderizarFixos);
  filtroStatus.addEventListener("change", renderizarFixos);
  filtroNome.addEventListener("input", renderizarFixos);

  await carregarDados();
});