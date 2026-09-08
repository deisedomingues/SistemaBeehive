import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

/* =========================================================
   ELEMENTOS DA TELA
========================================================= */

const form = document.getElementById("form-comunicado");
const msg = document.getElementById("msg");

const titulo = document.getElementById("titulo");
const texto = document.getElementById("texto");
const contadorTexto = document.getElementById("contadorTexto");

const publicoAlvo = document.getElementById("publicoAlvo");
const blocoMateria = document.getElementById("blocoMateria");
const blocoModulo = document.getElementById("blocoModulo");

const materiaId = document.getElementById("materiaId");
const moduloId = document.getElementById("moduloId");
const textoAjudaModulo = document.getElementById("textoAjudaModulo");

const imagem = document.getElementById("imagem");
const blocoImagemAtual = document.getElementById("blocoImagemAtual");
const previewImagemAtual = document.getElementById("previewImagemAtual");
const btnRemoverImagem = document.getElementById("btnRemoverImagem");

const dataExpiracao = document.getElementById("dataExpiracao");
const ativo = document.getElementById("ativo");

const tituloFormulario = document.getElementById("tituloFormulario");
const subtituloFormulario = document.getElementById("subtituloFormulario");
const btnSalvar = document.getElementById("btnSalvar");
const btnCancelarEdicao = document.getElementById("btnCancelarEdicao");

const buscaComunicado = document.getElementById("buscaComunicado");
const filtroStatus = document.getElementById("filtroStatus");
const listaComunicados = document.getElementById("listaComunicados");

const resumoAtivos = document.getElementById("resumoAtivos");
const resumoAgendados = document.getElementById("resumoAgendados");
const resumoHistorico = document.getElementById("resumoHistorico");

/* =========================================================
   ESTADO DA TELA
========================================================= */

let comunicadosCarregados = [];

let comunicadoEmEdicao = null;
let imagemAtualUrl = null;
let removerImagemAtual = false;

/* =========================================================
   UTILITÁRIOS
========================================================= */

function hojeIso() {
  const agora = new Date();

  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function mostrarMsg(textoMsg, tipo = "erro") {
  msg.style.display = "block";
  msg.className = tipo === "ok" ? "msg-sucesso" : "msg-erro";
  msg.textContent = textoMsg;
}

function limparMsg() {
  msg.style.display = "none";
  msg.textContent = "";
  msg.className = "";
}

function escaparHtml(valor) {
  if (valor === null || valor === undefined) return "";

  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarData(data) {
  if (!data) return "Sem expiração";

  const partes = String(data).split("-");

  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  const d = new Date(data);

  if (Number.isNaN(d.getTime())) {
    return "Sem expiração";
  }

  return d.toLocaleDateString("pt-BR");
}

function formatarDataHora(data) {
  if (!data) return "";

  const d = new Date(data);

  if (Number.isNaN(d.getTime())) {
    return "";
  }

  return d.toLocaleString("pt-BR");
}

function nomePublico(publico) {
  const nomes = {
    todos: "Todos os alunos",
    materia: "Alunos de uma matéria",
    modulo_exato: "Alunos de um módulo específico",
    modulo_a_partir: "Alunos a partir de um módulo"
  };

  return nomes[publico] || publico || "Não informado";
}

function comunicadoExpirou(comunicado) {
  if (!comunicado.data_expiracao) return false;

  return comunicado.data_expiracao < hojeIso();
}

function statusComunicado(comunicado) {
  if (!comunicado.ativo) {
    return {
      codigo: "inativo",
      texto: "Desativado",
      fundo: "#f2f4f7",
      cor: "#475467"
    };
  }

  if (comunicadoExpirou(comunicado)) {
    return {
      codigo: "expirado",
      texto: "Expirado",
      fundo: "#fff4e5",
      cor: "#b54708"
    };
  }

  return {
    codigo: "ativo",
    texto: "Ativo",
    fundo: "#e9f7ef",
    cor: "#067647"
  };
}

function rolarParaFormulario() {
  form.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function atualizarContadorTexto() {
  contadorTexto.textContent = `${texto.value.length} / 3000`;
}

/* =========================================================
   MATÉRIAS E MÓDULOS
========================================================= */

async function carregarMaterias() {
  const { data, error } = await supabase
    .from("materia")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao carregar matérias:", error);
    mostrarMsg("Não foi possível carregar as matérias.");
    return;
  }

  materiaId.innerHTML = `
    <option value="">Selecione a matéria</option>
  `;

  (data || []).forEach((materia) => {
    materiaId.innerHTML += `
      <option value="${materia.id}">
        ${escaparHtml(materia.nome)}
      </option>
    `;
  });
}

async function carregarModulos(materiaSelecionada = null) {
  const idMateria = materiaSelecionada || materiaId.value;

  moduloId.innerHTML = `
    <option value="">Selecione o módulo</option>
  `;

  if (!idMateria) return;

  const { data, error } = await supabase
    .from("modulo")
    .select("id, nome, ordem, materia_id")
    .eq("materia_id", idMateria)
    .order("ordem", { ascending: true });

  if (error) {
    console.error("Erro ao carregar módulos:", error);
    mostrarMsg("Não foi possível carregar os módulos.");
    return;
  }

  (data || []).forEach((modulo) => {
    moduloId.innerHTML += `
      <option value="${modulo.id}">
        ${escaparHtml(modulo.nome)}
      </option>
    `;
  });
}

function atualizarCamposPublico() {
  const valor = publicoAlvo.value;

  blocoMateria.style.display = "none";
  blocoModulo.style.display = "none";

  materiaId.required = false;
  moduloId.required = false;

  textoAjudaModulo.textContent = "";

  if (valor === "todos") {
    materiaId.value = "";
    moduloId.innerHTML = `
      <option value="">Selecione o módulo</option>
    `;
    return;
  }

  if (valor === "materia") {
    blocoMateria.style.display = "block";
    materiaId.required = true;
    moduloId.value = "";
    return;
  }

  if (valor === "modulo_exato") {
    blocoMateria.style.display = "block";
    blocoModulo.style.display = "block";

    materiaId.required = true;
    moduloId.required = true;

    textoAjudaModulo.textContent =
      "O comunicado aparecerá apenas para alunos matriculados neste módulo.";

    return;
  }

  if (valor === "modulo_a_partir") {
    blocoMateria.style.display = "block";
    blocoModulo.style.display = "block";

    materiaId.required = true;
    moduloId.required = true;

    textoAjudaModulo.textContent =
      "O comunicado aparecerá para alunos deste módulo e dos módulos seguintes.";
  }
}

/* =========================================================
   IMAGENS
========================================================= */

async function reduzirImagem(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");

        const larguraMaxima = 1000;
        const escala = Math.min(1, larguraMaxima / img.width);

        canvas.width = img.width * escala;
        canvas.height = img.height * escala;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Erro ao reduzir imagem."));
              return;
            }

            resolve(blob);
          },
          "image/jpeg",
          0.75
        );
      };

      img.onerror = reject;
      img.src = event.target.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function enviarImagem() {
  const arquivo = imagem.files[0];

  if (!arquivo) return null;

  if (!arquivo.type.startsWith("image/")) {
    throw new Error("O arquivo selecionado não é uma imagem.");
  }

  const limiteMb = 8;

  if (arquivo.size > limiteMb * 1024 * 1024) {
    throw new Error(`A imagem deve ter no máximo ${limiteMb} MB.`);
  }

  const imagemReduzida = await reduzirImagem(arquivo);

  const nomeArquivo = `comunicado-${Date.now()}-${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from("comunicados")
    .upload(nomeArquivo, imagemReduzida, {
      contentType: "image/jpeg",
      upsert: false
    });

  if (error) {
    console.error("Erro ao enviar imagem:", error);
    throw new Error("Não foi possível enviar a imagem.");
  }

  const { data } = supabase.storage
    .from("comunicados")
    .getPublicUrl(nomeArquivo);

  return data.publicUrl;
}

function obterCaminhoStorageDaUrl(url) {
  if (!url) return null;

  try {
    const marcador = "/storage/v1/object/public/comunicados/";
    const indice = url.indexOf(marcador);

    if (indice === -1) return null;

    return decodeURIComponent(
      url.substring(indice + marcador.length)
    );
  } catch (error) {
    console.warn("Não foi possível identificar o caminho da imagem:", error);
    return null;
  }
}

async function excluirImagemDoStorage(url) {
  const caminho = obterCaminhoStorageDaUrl(url);

  if (!caminho) return;

  const { error } = await supabase.storage
    .from("comunicados")
    .remove([caminho]);

  if (error) {
    console.warn("A imagem não pôde ser removida do Storage:", error);
  }
}

function mostrarImagemAtual(url) {
  imagemAtualUrl = url || null;
  removerImagemAtual = false;

  if (!imagemAtualUrl) {
    blocoImagemAtual.style.display = "none";
    previewImagemAtual.src = "";
    return;
  }

  previewImagemAtual.src = imagemAtualUrl;
  blocoImagemAtual.style.display = "block";

  btnRemoverImagem.textContent = "Remover imagem";
  btnRemoverImagem.disabled = false;
}

function marcarImagemParaRemocao() {
  if (!imagemAtualUrl) return;

  removerImagemAtual = true;

  previewImagemAtual.style.opacity = "0.35";
  btnRemoverImagem.textContent = "Imagem será removida";

  mostrarMsg(
    "A imagem será removida quando você salvar as alterações.",
    "ok"
  );
}

/* =========================================================
   VISUALIZAÇÕES
========================================================= */

async function buscarVisualizacoes(comunicadoIds) {
  if (!comunicadoIds.length) return {};

  const visualizacoesPorComunicado = {};

  const { data, error } = await supabase
    .from("comunicado_visualizacao_aluno")
    .select(`
      comunicado_id,
      visto,
      visto_em,
      aluno:aluno_id (
        id,
        nome
      )
    `)
    .in("comunicado_id", comunicadoIds)
    .eq("visto", true)
    .order("visto_em", { ascending: false });

  if (error) {
    console.warn("Não foi possível carregar visualizações:", error);
    return {};
  }

  (data || []).forEach((item) => {
    if (!visualizacoesPorComunicado[item.comunicado_id]) {
      visualizacoesPorComunicado[item.comunicado_id] = [];
    }

    visualizacoesPorComunicado[item.comunicado_id].push(item);
  });

  return visualizacoesPorComunicado;
}

function montarHtmlVisualizacoes(visualizacoes) {
  if (!visualizacoes || visualizacoes.length === 0) {
    return `
      <p class="subtitulo" style="margin-top:10px;">
        Nenhuma visualização registrada ainda.
      </p>
    `;
  }

  const nomes = visualizacoes
    .map((item) => {
      const nomeAluno = item.aluno?.nome || "Aluno não identificado";
      const data = formatarDataHora(item.visto_em);

      return `
        <li style="margin-bottom:4px;">
          ${escaparHtml(nomeAluno)}
          ${data ? ` — ${escaparHtml(data)}` : ""}
        </li>
      `;
    })
    .join("");

  return `
    <details style="margin-top:12px;">
      <summary style="cursor:pointer;">
        Visualizações: ${visualizacoes.length}
      </summary>

      <ul style="margin-top:8px; padding-left:20px;">
        ${nomes}
      </ul>
    </details>
  `;
}

/* =========================================================
   CARREGAMENTO E LISTAGEM
========================================================= */

async function carregarComunicados() {
  listaComunicados.innerHTML = `
    <p class="subtitulo">Carregando comunicados...</p>
  `;

  const { data, error } = await supabase
    .from("comunicado")
    .select(`
      id,
      titulo,
      texto,
      publico_alvo,
      materia_id,
      modulo_id,
      imagem_url,
      data_expiracao,
      ativo,
      criado_em,
      materia:materia_id (
        nome
      ),
      modulo:modulo_id (
        nome
      )
    `)
    .order("criado_em", { ascending: false });

  if (error) {
    console.error("Erro ao carregar comunicados:", error);

    listaComunicados.innerHTML = `
      <p class="msg-erro">
        Não foi possível carregar os comunicados.
      </p>
    `;

    return;
  }

  comunicadosCarregados = data || [];

  atualizarResumo();
  aplicarFiltros();
}

function atualizarResumo() {
  const ativos = comunicadosCarregados.filter((comunicado) => {
    return comunicado.ativo && !comunicadoExpirou(comunicado);
  });

  const comExpiracao = ativos.filter((comunicado) => {
    return Boolean(comunicado.data_expiracao);
  });

  const historico = comunicadosCarregados.filter((comunicado) => {
    return !comunicado.ativo || comunicadoExpirou(comunicado);
  });

  resumoAtivos.textContent = ativos.length;
  resumoAgendados.textContent = comExpiracao.length;
  resumoHistorico.textContent = historico.length;
}

function aplicarFiltros() {
  const termo = buscaComunicado.value.trim().toLowerCase();
  const filtro = filtroStatus.value;

  const filtrados = comunicadosCarregados.filter((comunicado) => {
    const status = statusComunicado(comunicado);

    let passaStatus = true;

    if (filtro === "ativos") {
      passaStatus = status.codigo === "ativo";
    }

    if (filtro === "expirados") {
      passaStatus = status.codigo === "expirado";
    }

    if (filtro === "inativos") {
      passaStatus = status.codigo === "inativo";
    }

    const conteudoBusca = `
      ${comunicado.titulo || ""}
      ${comunicado.texto || ""}
      ${comunicado.materia?.nome || ""}
      ${comunicado.modulo?.nome || ""}
    `.toLowerCase();

    const passaBusca =
      !termo || conteudoBusca.includes(termo);

    return passaStatus && passaBusca;
  });

  renderizarComunicados(filtrados);
}

async function renderizarComunicados(comunicados) {
  if (comunicados.length === 0) {
    listaComunicados.innerHTML = `
      <div class="card">
        <p class="subtitulo" style="margin:0;">
          Nenhum comunicado encontrado para este filtro.
        </p>
      </div>
    `;

    return;
  }

  const ids = comunicados.map((comunicado) => comunicado.id);
  const visualizacoesPorComunicado = await buscarVisualizacoes(ids);

  listaComunicados.innerHTML = comunicados
    .map((comunicado) => {
      const visualizacoes =
        visualizacoesPorComunicado[comunicado.id] || [];

      const status = statusComunicado(comunicado);

      return `
        <article class="card" style="margin-bottom:16px;">
          <div
            style="
              display:flex;
              justify-content:space-between;
              gap:12px;
              align-items:flex-start;
              flex-wrap:wrap;
            "
          >
            <div style="min-width:0; flex:1;">
              <h3 style="margin-top:0; margin-bottom:6px;">
                ${escaparHtml(comunicado.titulo)}
              </h3>

              <span
                style="
                  display:inline-block;
                  padding:5px 9px;
                  border-radius:999px;
                  font-size:12px;
                  font-weight:700;
                  background:${status.fundo};
                  color:${status.cor};
                "
              >
                ${status.texto}
              </span>
            </div>

            <div
              style="
                display:flex;
                gap:8px;
                flex-wrap:wrap;
              "
            >
              <button
                type="button"
                class="btn"
                data-acao="editar"
                data-id="${comunicado.id}"
                style="width:auto;"
              >
                Editar
              </button>

              <button
                type="button"
                class="btn"
                data-acao="alternar-ativo"
                data-id="${comunicado.id}"
                style="width:auto;"
              >
                ${comunicado.ativo ? "Desativar" : "Reativar"}
              </button>

              <button
                type="button"
                class="btn"
                data-acao="excluir"
                data-id="${comunicado.id}"
                style="width:auto;"
              >
                Excluir
              </button>
            </div>
          </div>

          <p style="white-space:pre-line; margin-top:14px;">
            ${escaparHtml(comunicado.texto)}
          </p>

          ${
            comunicado.imagem_url
              ? `
                <img
                  src="${escaparHtml(comunicado.imagem_url)}"
                  alt="Imagem do comunicado"
                  style="
                    width:min(100%, 520px);
                    max-height:320px;
                    object-fit:cover;
                    border-radius:12px;
                    margin-top:12px;
                  "
                />
              `
              : ""
          }

          <div style="margin-top:14px;">
            <p class="subtitulo">
              <strong>Público:</strong>
              ${escaparHtml(nomePublico(comunicado.publico_alvo))}
            </p>

            ${
              comunicado.materia?.nome
                ? `
                  <p class="subtitulo">
                    <strong>Matéria:</strong>
                    ${escaparHtml(comunicado.materia.nome)}
                  </p>
                `
                : ""
            }

            ${
              comunicado.modulo?.nome
                ? `
                  <p class="subtitulo">
                    <strong>Módulo:</strong>
                    ${escaparHtml(comunicado.modulo.nome)}
                  </p>
                `
                : ""
            }

            <p class="subtitulo">
              <strong>Expiração:</strong>
              ${escaparHtml(formatarData(comunicado.data_expiracao))}
            </p>

            <p class="subtitulo">
              <strong>Publicado em:</strong>
              ${escaparHtml(formatarDataHora(comunicado.criado_em))}
            </p>
          </div>

          ${montarHtmlVisualizacoes(visualizacoes)}
        </article>
      `;
    })
    .join("");
}

/* =========================================================
   EDIÇÃO
========================================================= */

async function iniciarEdicao(id) {
  const comunicado = comunicadosCarregados.find(
    (item) => String(item.id) === String(id)
  );

  if (!comunicado) {
    mostrarMsg("Não foi possível localizar o comunicado.");
    return;
  }

  comunicadoEmEdicao = comunicado;

  limparMsg();

  tituloFormulario.textContent = "Editar comunicado";
  subtituloFormulario.textContent =
    "Altere as informações abaixo e salve para atualizar a publicação.";

  btnSalvar.textContent = "Salvar alterações";
  btnCancelarEdicao.style.display = "inline-block";

  titulo.value = comunicado.titulo || "";
  texto.value = comunicado.texto || "";
  publicoAlvo.value = comunicado.publico_alvo || "todos";

  atualizarCamposPublico();

  if (comunicado.materia_id) {
    materiaId.value = String(comunicado.materia_id);
  }

  if (
    comunicado.publico_alvo === "modulo_exato" ||
    comunicado.publico_alvo === "modulo_a_partir"
  ) {
    await carregarModulos(comunicado.materia_id);

    if (comunicado.modulo_id) {
      moduloId.value = String(comunicado.modulo_id);
    }
  }

  dataExpiracao.value = comunicado.data_expiracao || "";
  ativo.checked = Boolean(comunicado.ativo);

  imagem.value = "";
  mostrarImagemAtual(comunicado.imagem_url);

  previewImagemAtual.style.opacity = "1";

  atualizarContadorTexto();
  rolarParaFormulario();
}

function cancelarEdicao() {
  comunicadoEmEdicao = null;
  imagemAtualUrl = null;
  removerImagemAtual = false;

  form.reset();

  publicoAlvo.value = "todos";
  ativo.checked = true;

  tituloFormulario.textContent = "Novo comunicado";
  subtituloFormulario.textContent =
    "Publique um aviso para todos os alunos ou para um público específico.";

  btnSalvar.textContent = "Publicar comunicado";
  btnCancelarEdicao.style.display = "none";

  blocoImagemAtual.style.display = "none";
  previewImagemAtual.src = "";
  previewImagemAtual.style.opacity = "1";

  atualizarCamposPublico();
  atualizarContadorTexto();
  limparMsg();
}

/* =========================================================
   SALVAR / ATUALIZAR
========================================================= */

async function salvarComunicado(event) {
  event.preventDefault();
  limparMsg();

  btnSalvar.disabled = true;
  const textoOriginalBotao = btnSalvar.textContent;
  btnSalvar.textContent = comunicadoEmEdicao
    ? "Salvando..."
    : "Publicando...";

  let novaImagemUrl = null;

  try {
    const publico = publicoAlvo.value;

    let materiaSelecionada = null;
    let moduloSelecionado = null;

    if (
      publico === "materia" ||
      publico === "modulo_exato" ||
      publico === "modulo_a_partir"
    ) {
      materiaSelecionada = materiaId.value || null;
    }

    if (
      publico === "modulo_exato" ||
      publico === "modulo_a_partir"
    ) {
      moduloSelecionado = moduloId.value || null;
    }

    if (
      dataExpiracao.value &&
      !comunicadoEmEdicao &&
      dataExpiracao.value < hojeIso()
    ) {
      throw new Error(
        "A data de expiração não pode ser anterior à data de hoje."
      );
    }

    if (imagem.files[0]) {
      novaImagemUrl = await enviarImagem();
    }

    let imagemFinal = imagemAtualUrl;

    if (removerImagemAtual) {
      imagemFinal = null;
    }

    if (novaImagemUrl) {
      imagemFinal = novaImagemUrl;
    }

    const dadosComunicado = {
      titulo: titulo.value.trim(),
      texto: texto.value.trim(),
      publico_alvo: publico,
      materia_id: materiaSelecionada,
      modulo_id: moduloSelecionado,
      imagem_url: imagemFinal || null,
      data_expiracao: dataExpiracao.value || null,
      ativo: ativo.checked
    };

    if (comunicadoEmEdicao) {
      const imagemAntiga = comunicadoEmEdicao.imagem_url;

      const { error } = await supabase
        .from("comunicado")
        .update(dadosComunicado)
        .eq("id", comunicadoEmEdicao.id);

      if (error) {
        console.error("Erro ao editar comunicado:", error);
        throw new Error("Não foi possível salvar as alterações.");
      }

      if (
        imagemAntiga &&
        (
          removerImagemAtual ||
          (novaImagemUrl && novaImagemUrl !== imagemAntiga)
        )
      ) {
        await excluirImagemDoStorage(imagemAntiga);
      }

      cancelarEdicao();
      mostrarMsg("Comunicado atualizado com sucesso!", "ok");
    } else {
      const { error } = await supabase
        .from("comunicado")
        .insert([dadosComunicado]);

      if (error) {
        console.error("Erro ao salvar comunicado:", error);
        throw new Error("Não foi possível publicar o comunicado.");
      }

      form.reset();
      publicoAlvo.value = "todos";
      ativo.checked = true;

      atualizarCamposPublico();
      atualizarContadorTexto();

      mostrarMsg("Comunicado publicado com sucesso!", "ok");
    }

    await carregarComunicados();
  } catch (error) {
    console.error("Erro ao salvar comunicado:", error);

    if (novaImagemUrl) {
      await excluirImagemDoStorage(novaImagemUrl);
    }

    mostrarMsg(
      error?.message || "Não foi possível salvar o comunicado."
    );
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = comunicadoEmEdicao
      ? "Salvar alterações"
      : "Publicar comunicado";

    if (!comunicadoEmEdicao && textoOriginalBotao === "Salvar alterações") {
      btnSalvar.textContent = "Publicar comunicado";
    }
  }
}

/* =========================================================
   ATIVAR / DESATIVAR
========================================================= */

async function alternarAtivo(id) {
  const comunicado = comunicadosCarregados.find(
    (item) => String(item.id) === String(id)
  );

  if (!comunicado) return;

  const novoValor = !comunicado.ativo;

  const mensagemConfirmacao = novoValor
    ? "Deseja reativar este comunicado?"
    : "Deseja desativar este comunicado? Ele deixará de aparecer para os alunos, mas continuará salvo no histórico.";

  if (!window.confirm(mensagemConfirmacao)) return;

  const { error } = await supabase
    .from("comunicado")
    .update({
      ativo: novoValor
    })
    .eq("id", comunicado.id);

  if (error) {
    console.error("Erro ao alterar status:", error);
    window.alert("Não foi possível alterar o status do comunicado.");
    return;
  }

  await carregarComunicados();
}

/* =========================================================
   EXCLUSÃO PERMANENTE
========================================================= */

async function excluirComunicado(id) {
  const comunicado = comunicadosCarregados.find(
    (item) => String(item.id) === String(id)
  );

  if (!comunicado) return;

  const confirmou = window.confirm(
    `Excluir permanentemente o comunicado "${comunicado.titulo}"?\n\n` +
    "Essa ação apaga o comunicado e o histórico de visualizações. " +
    "Se você apenas não quiser mais mostrá-lo aos alunos, prefira Desativar."
  );

  if (!confirmou) return;

  const confirmouNovamente = window.confirm(
    "Tem certeza? Esta exclusão não poderá ser desfeita."
  );

  if (!confirmouNovamente) return;

  /*
    O comunicado é excluído primeiro para evitar apagar visualizações
    e depois descobrir que o banco impediu a exclusão do comunicado.

    O ideal é que a chave estrangeira de comunicado_visualizacao_aluno
    esteja configurada com ON DELETE CASCADE. Assim, ao excluir o
    comunicado, as visualizações relacionadas são apagadas pelo banco.
  */
  const { error: erroComunicado } = await supabase
    .from("comunicado")
    .delete()
    .eq("id", comunicado.id);

  if (erroComunicado) {
    console.error("Erro ao excluir comunicado:", erroComunicado);

    window.alert(
      "Não foi possível excluir o comunicado. " +
      "Se ele possui visualizações registradas, pode ser necessário " +
      "configurar a exclusão em cascata no banco. Até isso ser ajustado, " +
      "você pode usar Desativar sem perder o histórico."
    );

    return;
  }

  if (comunicado.imagem_url) {
    await excluirImagemDoStorage(comunicado.imagem_url);
  }

  if (
    comunicadoEmEdicao &&
    String(comunicadoEmEdicao.id) === String(comunicado.id)
  ) {
    cancelarEdicao();
  }

  await carregarComunicados();

  window.alert("Comunicado excluído permanentemente.");
}

/* =========================================================
   EVENTOS
========================================================= */

form.addEventListener("submit", salvarComunicado);

publicoAlvo.addEventListener("change", () => {
  atualizarCamposPublico();
});

materiaId.addEventListener("change", async () => {
  await carregarModulos();
});

texto.addEventListener("input", atualizarContadorTexto);

buscaComunicado.addEventListener("input", aplicarFiltros);
filtroStatus.addEventListener("change", aplicarFiltros);

btnCancelarEdicao.addEventListener("click", cancelarEdicao);

btnRemoverImagem.addEventListener("click", marcarImagemParaRemocao);

listaComunicados.addEventListener("click", async (event) => {
  const botao = event.target.closest("button[data-acao]");

  if (!botao) return;

  const acao = botao.dataset.acao;
  const id = botao.dataset.id;

  if (acao === "editar") {
    await iniciarEdicao(id);
    return;
  }

  if (acao === "alternar-ativo") {
    await alternarAtivo(id);
    return;
  }

  if (acao === "excluir") {
    await excluirComunicado(id);
  }
});

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

dataExpiracao.min = hojeIso();

await carregarMaterias();

atualizarCamposPublico();
atualizarContadorTexto();

await carregarComunicados();