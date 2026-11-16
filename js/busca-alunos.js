import { supabase } from "./supabase.js";

const POR_PAGINA = 12;
const LOTE_BANCO = 200;

function normalizar(texto) {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

async function carregarIndice() {
  const alunos = [];
  for (let inicio = 0; ; inicio += LOTE_BANCO) {
    const { data, error } = await supabase.from("aluno")
      .select(`
        id, nome,
        matriculas:matricula!matricula_aluno_id_fkey (
          id, ativa, materia:materia_id(nome), modulo:modulo_id(nome)
        )
      `)
      .order("id")
      .range(inicio, inicio + LOTE_BANCO - 1);
    if (error) throw error;
    alunos.push(...data);
    if (data.length < LOTE_BANCO) break;
  }
  return alunos.sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
}

function filtrarAlunos(alunos, consulta, filtro) {
  const termos = normalizar(consulta.trim()).split(/\s+/);
  return alunos.flatMap((aluno) => {
    const nome = normalizar(aluno.nome || "");
    if (!termos.every((termo) => nome.includes(termo))) return [];
    const matriculas = (aluno.matriculas || [])
      .filter((m) => filtro === "todos" || (filtro === "ativas" ? m.ativa === true : m.ativa === false))
      .sort((a, b) => Number(b.ativa === true) - Number(a.ativa === true) ||
        (a.materia?.nome || "").localeCompare(b.materia?.nome || "", "pt-BR"));
    return filtro === "todos" || matriculas.length ? [{ ...aluno, matriculas }] : [];
  });
}

function criarLink(url, texto, contexto) {
  const link = document.createElement("a");
  link.href = url;
  link.textContent = texto;
  if (contexto) link.setAttribute("aria-label", `${texto} · ${contexto}`);
  return link;
}

function criarResultado(aluno, origem) {
  const item = document.createElement("li");
  const nome = document.createElement("h3");
  nome.textContent = aluno.nome || "Aluno sem nome";
  item.append(nome);

  const params = new URLSearchParams({ busca: origem, aluno_id: aluno.id });
  if (!aluno.matriculas.length) {
    const descricao = document.createElement("p");
    descricao.textContent = "Sem matrícula cadastrada";
    item.append(descricao, criarLink(`editar-matriculas.html?${params}`, "Gerenciar cursos", nome.textContent));
  }

  for (const m of aluno.matriculas) {
    const linha = document.createElement("div");
    linha.className = "busca-alunos__curso";
    const curso = document.createElement("p");
    const idioma = m.materia?.nome || "Curso";
    curso.textContent = [idioma, m.modulo?.nome, m.ativa === false ? "Inativa" : null].filter(Boolean).join(" · ");
    params.set("matricula_id", m.id);
    const acoes = document.createElement("div");
    acoes.className = "busca-alunos__acoes";
    const contexto = `${nome.textContent}, ${idioma}`;
    acoes.append(
      criarLink(`detalhes-aluno-admin.html?${params}`, "Ver ficha", contexto),
      criarLink(`editar-matriculas.html?${params}`, "Editar matrícula", contexto)
    );
    linha.append(curso, acoes);
    item.append(linha);
  }
  return item;
}

export function iniciarBuscaAlunos(origem, usuarioId) {
  const secao = document.getElementById("busca-alunos");
  if (!secao || !usuarioId) return;
  const campo = secao.querySelector("input");
  const filtro = secao.querySelector("select");
  const status = secao.querySelector("[role='status']");
  const lista = secao.querySelector("ul");
  const mais = secao.querySelector("[data-busca-mais]");
  const chave = `beehive:busca-alunos:${usuarioId}:${origem}`;
  let limite = POR_PAGINA;
  let indice;
  let rodada = 0;

  function guardarBusca() {
    try {
      sessionStorage.setItem(chave, JSON.stringify({
        consulta: campo.value,
        filtro: filtro.value,
        limite,
        rolagem: window.scrollY
      }));
    } catch {
      // A busca também funciona quando o navegador bloqueia armazenamento.
    }
  }

  async function renderizar(rolagem = null) {
    const atual = ++rodada;
    const consulta = campo.value.trim();
    lista.replaceChildren();
    mais.hidden = true;
    if (consulta.length < 2) {
      status.textContent = consulta ? "Digite pelo menos duas letras." : "";
      return;
    }

    status.textContent = "Buscando alunos…";
    try {
      indice ??= carregarIndice().catch((erro) => {
        indice = null;
        throw erro;
      });
      const alunos = await indice;
      if (atual !== rodada) return;

      const resultados = filtrarAlunos(alunos, consulta, filtro.value);
      lista.replaceChildren(...resultados.slice(0, limite).map((aluno) => criarResultado(aluno, origem)));
      mais.hidden = resultados.length <= limite;
      status.textContent = resultados.length === 0 ? "Nenhum aluno encontrado."
        : resultados.length === 1 ? "1 aluno encontrado." : `${resultados.length} alunos encontrados.`;

      if (rolagem !== null) requestAnimationFrame(() => window.scrollTo(0, rolagem));
    } catch (erro) {
      if (atual !== rodada) return;
      console.error("Erro ao buscar alunos:", erro);
      status.textContent = "Não foi possível buscar alunos. Tente buscar novamente.";
    }
  }

  function atualizarBusca() {
    limite = POR_PAGINA;
    void renderizar();
  }

  campo.addEventListener("input", atualizarBusca);
  filtro.addEventListener("change", atualizarBusca);
  secao.addEventListener("submit", (evento) => {
    evento.preventDefault();
    atualizarBusca();
  });
  mais.addEventListener("click", () => {
    limite += POR_PAGINA;
    void renderizar();
  });
  lista.addEventListener("click", (evento) => {
    if (evento.target.closest("a")) guardarBusca();
  });
  window.addEventListener("pagehide", guardarBusca);
  secao.hidden = false;

  if (new URLSearchParams(location.search).get("retorno") === "busca") {
    try {
      const salvo = JSON.parse(sessionStorage.getItem(chave));
      if (salvo) {
        campo.value = salvo.consulta;
        filtro.value = salvo.filtro;
        limite = Math.max(POR_PAGINA, Number(salvo.limite) || 0);
        void renderizar(Number(salvo.rolagem) || 0);
      }
    } catch {
      // O formulário inicia vazio se o estado não estiver disponível.
    }
  }
}
