import { supabase } from "./supabase.js";

const listaComunicados = document.getElementById("listaComunicados");
const msg = document.getElementById("msg");
const linkVoltar = document.getElementById("linkVoltar");

const alunoId =
  localStorage.getItem("alunoIdVisualizacao") ||
  localStorage.getItem("alunoId") ||
  localStorage.getItem("aluno_id") ||
  localStorage.getItem("idAluno");

if (!alunoId) {
  window.location.href = "index.html";
}

function mostrarMsg(texto, tipo = "erro") {
  msg.style.display = "block";
  msg.className = tipo === "ok" ? "msg-sucesso" : "msg-erro";
  msg.textContent = texto;
}

function formatarData(data) {
  if (!data) return "";

  const d = new Date(data);

  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function comunicadoEstaExpirado(comunicado) {
  if (!comunicado.data_expiracao) return false;

  const partes = String(comunicado.data_expiracao).split("-");
  const ano = Number(partes[0]);
  const mes = Number(partes[1]) - 1;
  const dia = Number(partes[2]);

  const fimDoDiaDaExpiracao = new Date(ano, mes, dia, 23, 59, 59, 999);
  const agora = new Date();

  return fimDoDiaDaExpiracao < agora;
}

function comunicadoServeParaAluno(comunicado, matriculasAluno) {
  if (!comunicado.ativo) return false;
  if (comunicadoEstaExpirado(comunicado)) return false;

  if (comunicado.publico_alvo === "todos") {
    return true;
  }

  if (!matriculasAluno.length) return false;

  if (comunicado.publico_alvo === "materia") {
    return matriculasAluno.some((matricula) => {
      return Number(matricula.materia_id) === Number(comunicado.materia_id);
    });
  }

  if (comunicado.publico_alvo === "modulo_exato") {
    return matriculasAluno.some((matricula) => {
      return (
        Number(matricula.materia_id) === Number(comunicado.materia_id) &&
        Number(matricula.modulo_id) === Number(comunicado.modulo_id)
      );
    });
  }

  if (comunicado.publico_alvo === "modulo_a_partir") {
    const ordemComunicado = comunicado.modulo?.ordem ?? null;

    if (ordemComunicado === null) return false;

    return matriculasAluno.some((matricula) => {
      const mesmaMateria =
        Number(matricula.materia_id) === Number(comunicado.materia_id);

      const ordemAluno = matricula.modulo?.ordem ?? null;

      return (
        mesmaMateria &&
        ordemAluno !== null &&
        Number(ordemAluno) >= Number(ordemComunicado)
      );
    });
  }

  return false;
}

function renderizarComunicados(comunicados, visualizacoes) {
  if (!comunicados.length) {
    listaComunicados.innerHTML = `
      <div class="card">
        <h2>Nenhum comunicado disponível</h2>
        <p style="margin:0;">
          No momento, não há comunicados ativos para você.
        </p>
      </div>
    `;
    return;
  }

  const idsVistos = new Set(
    visualizacoes
      .filter((v) => v.visto)
      .map((v) => Number(v.comunicado_id))
  );

  listaComunicados.innerHTML = comunicados
    .map((comunicado) => {
      const dataPublicacao = formatarData(
        comunicado.data_publicacao || comunicado.criado_em
      );

      const visto = idsVistos.has(Number(comunicado.id));

      const imagem = comunicado.imagem_url
        ? `
          <a
            href="${comunicado.imagem_url}"
            target="_blank"
            rel="noopener noreferrer"
            title="Clique para abrir a imagem"
          >
            <img
              src="${comunicado.imagem_url}"
              alt="Imagem do comunicado"
              style="
                width:100%;
                max-height:260px;
                object-fit:cover;
                border-radius:14px;
                margin-bottom:14px;
                border:1px solid #f1df9a;
                cursor:pointer;
              "
            />
          </a>
        `
        : "";

      return `
        <article class="card card-evento-compacto">
          ${imagem}

          <div class="topo-card-evento-compacto">
            <h2>${comunicado.titulo}</h2>

            <span class="badge-evento ${visto ? "badge-evento-encerrado" : "badge-evento-ativo"}">
              ${visto ? "Visto" : "Novo"}
            </span>
          </div>

          ${
            dataPublicacao
              ? `<p class="meta-evento-compacto">Publicado em ${dataPublicacao}</p>`
              : ""
          }

          <p style="white-space:pre-line; line-height:1.6; margin-top:12px;">
            ${comunicado.texto}
          </p>
        </article>
      `;
    })
    .join("");
}

async function verificarSessao() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    window.location.href = "index.html";
    return null;
  }

  return data.user;
}

async function carregarMatriculasAluno() {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno_id,
      materia_id,
      modulo_id,
      ativa,
      modulo:modulo_id (
        id,
        nome,
        ordem,
        materia_id
      )
    `)
    .eq("aluno_id", alunoId)
    .eq("ativa", true);

  if (error) {
    console.error("Erro ao carregar matrículas:", error);
    return [];
  }

  return data || [];
}

async function carregarComunicados() {
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
      data_publicacao,
      data_expiracao,
      ativo,
      criado_em,
      modulo:modulo_id (
        id,
        nome,
        ordem,
        materia_id
      )
    `)
    .eq("ativo", true)
    .order("data_publicacao", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

async function carregarVisualizacoesAluno() {
  const { data, error } = await supabase
    .from("comunicado_visualizacao_aluno")
    .select("id, comunicado_id, aluno_id, visto, visto_em")
    .eq("aluno_id", alunoId);

  if (error) {
    console.error("Erro ao carregar visualizações:", error);
    return [];
  }

  return data || [];
}

async function marcarComunicadosComoVistos(comunicados) {
  if (!comunicados.length) return;

  const registros = comunicados.map((comunicado) => {
    return {
      comunicado_id: Number(comunicado.id),
      aluno_id: Number(alunoId),
      visto: true,
      visto_em: new Date().toISOString()
    };
  });

  const { error } = await supabase
    .from("comunicado_visualizacao_aluno")
    .upsert(registros, {
      onConflict: "comunicado_id,aluno_id"
    });

  if (error) {
    console.error("Erro ao marcar comunicados como vistos:", error);
  }
}

async function iniciarTela() {
  try {
    await verificarSessao();

    if (localStorage.getItem("alunoIdVisualizacao")) {
      linkVoltar.href = "home-aluno-funcionario.html";
    } else {
      linkVoltar.href = "home-aluno.html";
    }

    const matriculasAluno = await carregarMatriculasAluno();
    const comunicados = await carregarComunicados();
    const visualizacoes = await carregarVisualizacoesAluno();

    const comunicadosFiltrados = comunicados.filter((comunicado) => {
      return comunicadoServeParaAluno(comunicado, matriculasAluno);
    });

    renderizarComunicados(comunicadosFiltrados, visualizacoes);

    await marcarComunicadosComoVistos(comunicadosFiltrados);
  } catch (error) {
    console.error("Erro ao carregar comunicados:", error);

    listaComunicados.innerHTML = "";

    mostrarMsg("Não foi possível carregar os comunicados neste momento.");
  }
}

iniciarTela();