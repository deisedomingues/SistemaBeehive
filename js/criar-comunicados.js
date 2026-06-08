import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const form = document.getElementById("form-comunicado");
const msg = document.getElementById("msg");

const titulo = document.getElementById("titulo");
const texto = document.getElementById("texto");
const publicoAlvo = document.getElementById("publicoAlvo");

const blocoMateria = document.getElementById("blocoMateria");
const blocoModulo = document.getElementById("blocoModulo");

const materiaId = document.getElementById("materiaId");
const moduloId = document.getElementById("moduloId");
const textoAjudaModulo = document.getElementById("textoAjudaModulo");

const imagem = document.getElementById("imagem");
const dataExpiracao = document.getElementById("dataExpiracao");
const ativo = document.getElementById("ativo");

const listaComunicadosAtivos = document.getElementById("listaComunicadosAtivos");

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

  materiaId.innerHTML = `<option value="">Selecione a matéria</option>`;

  (data || []).forEach((materia) => {
    materiaId.innerHTML += `
      <option value="${materia.id}">
        ${escaparHtml(materia.nome)}
      </option>
    `;
  });
}

async function carregarModulos() {
  const idMateria = materiaId.value;

  moduloId.innerHTML = `<option value="">Selecione o módulo</option>`;

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
    moduloId.innerHTML = `<option value="">Selecione o módulo</option>`;
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

  const imagemReduzida = await reduzirImagem(arquivo);

  const nomeArquivo = `comunicado-${Date.now()}.jpg`;

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
        <li>
          ${escaparHtml(nomeAluno)}${data ? ` — ${escaparHtml(data)}` : ""}
        </li>
      `;
    })
    .join("");

  return `
    <details style="margin-top:10px;">
      <summary>
        Visualizações: ${visualizacoes.length}
      </summary>

      <ul style="margin-top:8px; padding-left:20px;">
        ${nomes}
      </ul>
    </details>
  `;
}

async function carregarComunicadosAtivos() {
  listaComunicadosAtivos.innerHTML = `
    <p class="subtitulo">Carregando comunicados ativos...</p>
  `;

  const hoje = new Date().toISOString().slice(0, 10);

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
    .eq("ativo", true)
    .or(`data_expiracao.is.null,data_expiracao.gte.${hoje}`)
    .order("criado_em", { ascending: false });

  if (error) {
    console.error("Erro ao carregar comunicados ativos:", error);

    listaComunicadosAtivos.innerHTML = `
      <p class="msg-erro">
        Não foi possível carregar os comunicados ativos.
      </p>
    `;
    return;
  }

  const comunicados = data || [];

  if (comunicados.length === 0) {
    listaComunicadosAtivos.innerHTML = `
      <p class="subtitulo">
        Nenhum comunicado ativo no momento.
      </p>
    `;
    return;
  }

  const ids = comunicados.map((comunicado) => comunicado.id);
  const visualizacoesPorComunicado = await buscarVisualizacoes(ids);

  listaComunicadosAtivos.innerHTML = comunicados
    .map((comunicado) => {
      const visualizacoes = visualizacoesPorComunicado[comunicado.id] || [];

      return `
        <article class="card" style="margin-bottom:16px;">
          <h3>${escaparHtml(comunicado.titulo)}</h3>

          <p style="white-space:pre-line;">
            ${escaparHtml(comunicado.texto)}
          </p>

          ${
            comunicado.imagem_url
              ? `
                <img
                  src="${escaparHtml(comunicado.imagem_url)}"
                  alt="Imagem do comunicado"
                  style="max-width:100%; border-radius:12px; margin-top:12px;"
                />
              `
              : ""
          }

          <div style="margin-top:12px;">
            <p class="subtitulo">
              <strong>Público:</strong> ${escaparHtml(nomePublico(comunicado.publico_alvo))}
            </p>

            ${
              comunicado.materia?.nome
                ? `<p class="subtitulo"><strong>Matéria:</strong> ${escaparHtml(comunicado.materia.nome)}</p>`
                : ""
            }

            ${
              comunicado.modulo?.nome
                ? `<p class="subtitulo"><strong>Módulo:</strong> ${escaparHtml(comunicado.modulo.nome)}</p>`
                : ""
            }

            <p class="subtitulo">
              <strong>Expira em:</strong> ${escaparHtml(formatarData(comunicado.data_expiracao))}
            </p>

            <p class="subtitulo">
              <strong>Criado em:</strong> ${escaparHtml(formatarDataHora(comunicado.criado_em))}
            </p>
          </div>

          ${montarHtmlVisualizacoes(visualizacoes)}
        </article>
      `;
    })
    .join("");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  limparMsg();

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

    if (publico === "modulo_exato" || publico === "modulo_a_partir") {
      moduloSelecionado = moduloId.value || null;
    }

    const imagemUrl = await enviarImagem();

    const novoComunicado = {
      titulo: titulo.value.trim(),
      texto: texto.value.trim(),
      publico_alvo: publico,
      materia_id: materiaSelecionada,
      modulo_id: moduloSelecionado,
      imagem_url: imagemUrl,
      data_expiracao: dataExpiracao.value || null,
      ativo: ativo.checked
    };

    const { error } = await supabase
      .from("comunicado")
      .insert([novoComunicado]);

    if (error) {
      console.error("Erro ao salvar comunicado:", error);
      throw error;
    }

    mostrarMsg("Comunicado salvo com sucesso!", "ok");

    form.reset();
    atualizarCamposPublico();

    await carregarComunicadosAtivos();
  } catch (error) {
    console.error("Erro geral ao salvar comunicado:", error);
    mostrarMsg("Não foi possível salvar o comunicado.");
  }
});

publicoAlvo.addEventListener("change", atualizarCamposPublico);

materiaId.addEventListener("change", async () => {
  await carregarModulos();
});

await carregarMaterias();
atualizarCamposPublico();
await carregarComunicadosAtivos();