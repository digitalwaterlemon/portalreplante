import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.PORTAL_CONFIG || {};
const supabase = createClient(config.SUPABASE_URL || "", config.SUPABASE_ANON_KEY || "");

const STATUS_OPCOES = ["novo", "analisando", "proposta_enviada", "ganho", "perdido", "descartado"];
const STATUS_FILTRO = [
    ["ativos", "Ativos"],
    ["todos", "Todos"],
    ["novo", "Novo"],
    ["analisando", "Analisando"],
    ["proposta_enviada", "Proposta enviada"],
    ["ganho", "Ganho"],
    ["perdido", "Perdido"],
    ["descartado", "Descartado"],
];
const PRIORIDADES = ["alta", "media", "baixa", "irrelevante"];
const PROJETO_STATUS = [
    ["prospeccao", "Prospeccao"],
    ["orcamento", "Orcamento"],
    ["contratado", "Contratado"],
    ["em_execucao", "Em execucao"],
    ["monitoramento", "Monitoramento"],
    ["concluido", "Concluido"],
    ["pausado", "Pausado"],
    ["arquivado", "Arquivado"],
];
const TIPOS_REGRA = ["positivo", "negativo", "combinacao"];

const $ = (selector) => document.querySelector(selector);
const conteudo = $("#conteudo");
const mensagem = $("#mensagem");

let session = null;
let cache = {
    fontes: [],
    oportunidades: [],
    projetos: [],
    regras: [],
};

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setMensagem(texto, tipo = "ok") {
    mensagem.textContent = texto;
    mensagem.classList.toggle("oculto", !texto);
    mensagem.classList.toggle("alerta", tipo === "erro");
}

function setPage(titulo, eyebrow, actions = "") {
    $("#pageTitle").textContent = titulo;
    $("#eyebrow").textContent = eyebrow;
    $("#topbarActions").innerHTML = actions;
    document.querySelectorAll(".nav a").forEach((link) => {
        link.classList.toggle("ativo", link.dataset.route === rotaAtual());
    });
}

function rotaAtual() {
    return (location.hash || "#dashboard").replace("#", "") || "dashboard";
}

function formatStatus(status) {
    return (status || "").replaceAll("_", " ");
}

function prioridadeOrdem(valor) {
    return { alta: 1, media: 2, baixa: 3 }[valor] || 4;
}

function opcoesSelect(opcoes, atual) {
    return opcoes
        .map(([valor, rotulo]) => `<option value="${valor}" ${valor === atual ? "selected" : ""}>${rotulo}</option>`)
        .join("");
}

function opcoesTexto(opcoes, atual) {
    return opcoes
        .map((valor) => `<option value="${valor}" ${valor === atual ? "selected" : ""}>${formatStatus(valor)}</option>`)
        .join("");
}

async function carregarDados() {
    const [fontes, oportunidades, projetos, regras] = await Promise.all([
        supabase.from("fontes").select("*").order("nome"),
        supabase.from("oportunidades").select("*, fontes(nome)").order("data_encontrado", { ascending: false }),
        supabase.from("projetos").select("*").order("atualizado_em", { ascending: false }),
        supabase.from("regras_prad").select("*").order("ordem").order("id"),
    ]);

    for (const result of [fontes, oportunidades, projetos, regras]) {
        if (result.error) throw result.error;
    }

    cache.fontes = fontes.data || [];
    cache.oportunidades = (oportunidades.data || []).map((row) => ({
        ...row,
        fonte_nome: row.fontes?.nome || "",
    }));
    cache.projetos = projetos.data || [];
    cache.regras = regras.data || [];
}

async function render() {
    setMensagem("");
    try {
        await carregarDados();
        const rota = rotaAtual();
        if (rota === "projetos") renderProjetos();
        else if (rota === "licitacoes") renderLicitacoes();
        else if (rota === "regras") renderRegras();
        else renderDashboard();
    } catch (error) {
        console.error(error);
        setPage("Erro", "Nao foi possivel carregar");
        conteudo.innerHTML = `<p class="alerta">Nao foi possivel carregar os dados. Verifique login, permissao e conexao.</p>`;
    }
}

function renderDashboard() {
    setPage("Inicio", "Visao geral", `<a class="botao" href="#projetos">Projetos</a><a class="botao secundario" href="#licitacoes">Licitacoes</a>`);

    const projetosAtivos = cache.projetos.filter((p) => !["concluido", "arquivado"].includes(p.status));
    const projetosExecucao = cache.projetos.filter((p) => ["contratado", "em_execucao", "monitoramento"].includes(p.status));
    const licitacoesAtivas = cache.oportunidades.filter((o) => !["perdido", "descartado"].includes(o.status));
    const licitacoesRelevantes = licitacoesAtivas.filter((o) => ["alta", "media"].includes(o.prioridade_prad));
    const licitacoesAlta = licitacoesAtivas.filter((o) => o.prioridade_prad === "alta");
    const projetosRecentes = cache.projetos.filter((p) => p.status !== "arquivado").slice(0, 5);
    const licitacoesRecentes = [...licitacoesRelevantes]
        .sort((a, b) => (b.pontuacao_prad || 0) - (a.pontuacao_prad || 0))
        .slice(0, 5);

    conteudo.innerHTML = `
        <section class="metricas">
            <div class="metric-card"><span>Projetos ativos</span><strong>${projetosAtivos.length}</strong></div>
            <div class="metric-card"><span>Em execucao</span><strong>${projetosExecucao.length}</strong></div>
            <div class="metric-card"><span>Licitacoes PRAD</span><strong>${licitacoesRelevantes.length}</strong></div>
            <div class="metric-card alerta-card"><span>Alta prioridade</span><strong>${licitacoesAlta.length}</strong></div>
        </section>
        <section class="grid-duas-colunas">
            <div class="painel">
                <div class="painel-topo"><h2>Projetos recentes</h2><a href="#projetos">Ver todos</a></div>
                ${projetosRecentes.length ? `<div class="lista-compacta">${projetosRecentes.map((p) => `
                    <article><div><strong>${escapeHtml(p.nome)}</strong><span>${escapeHtml(p.cliente || "Cliente nao informado")} · ${escapeHtml(p.local || "Local nao informado")}</span></div><em>${escapeHtml(formatStatus(p.status))}</em></article>
                `).join("")}</div>` : `<p class="vazio compacto">Nenhum projeto cadastrado ainda.</p>`}
            </div>
            <div class="painel">
                <div class="painel-topo"><h2>Licitacoes em foco</h2><a href="#licitacoes">Ver radar</a></div>
                ${licitacoesRecentes.length ? `<div class="lista-compacta">${licitacoesRecentes.map((o) => `
                    <article><div><strong>${escapeHtml(o.titulo)}</strong><span>${escapeHtml(o.fonte_nome)} · ${escapeHtml(o.motivos_prad || "Sem motivo registrado")}</span></div><em>${escapeHtml(o.prioridade_prad)} · ${o.pontuacao_prad || 0}</em></article>
                `).join("")}</div>` : `<p class="vazio compacto">Nenhuma licitacao relevante ativa no momento.</p>`}
            </div>
        </section>
    `;
}

function renderProjetos() {
    setPage("Projetos", "ERP simples");
    const params = new URLSearchParams(location.hash.split("?")[1] || "");
    const statusFiltro = params.get("status") || "ativos";
    const busca = params.get("busca") || "";
    let projetos = [...cache.projetos];

    if (statusFiltro === "ativos") projetos = projetos.filter((p) => !["concluido", "arquivado"].includes(p.status));
    else if (statusFiltro !== "todos") projetos = projetos.filter((p) => p.status === statusFiltro);
    if (busca) {
        const termo = busca.toLowerCase();
        projetos = projetos.filter((p) => [p.nome, p.cliente, p.local, p.descricao].join(" ").toLowerCase().includes(termo));
    }

    conteudo.innerHTML = `
        <section class="painel">
            <div class="painel-topo"><h2>Novo projeto</h2></div>
            <form id="novoProjetoForm" class="form-grid">
                <label>Nome<input name="nome" required placeholder="Ex.: PRAD Barreirinha"></label>
                <label>Cliente<input name="cliente" placeholder="Ex.: SANEPAR"></label>
                <label>Local<input name="local" placeholder="Municipio / area"></label>
                <label>Status<select name="status">${opcoesSelect(PROJETO_STATUS, "prospeccao")}</select></label>
                <label>Responsavel<input name="responsavel"></label>
                <label>Inicio<input name="data_inicio" type="date"></label>
                <label>Prazo<input name="prazo" type="date"></label>
                <label>Valor estimado<input name="valor_estimado" placeholder="Ex.: R$ 45.000"></label>
                <label class="campo-largo">Descricao<textarea name="descricao"></textarea></label>
                <label class="campo-largo">Observacoes<textarea name="observacoes"></textarea></label>
                <button type="submit">Criar projeto</button>
            </form>
        </section>
        <form id="filtroProjetos" class="filtros">
            <label>Status:<select name="status"><option value="ativos" ${statusFiltro === "ativos" ? "selected" : ""}>Ativos</option><option value="todos" ${statusFiltro === "todos" ? "selected" : ""}>Todos</option>${opcoesSelect(PROJETO_STATUS, statusFiltro)}</select></label>
            <label class="busca">Buscar:<input name="busca" value="${escapeHtml(busca)}" placeholder="cliente, local, projeto"></label>
            <button type="submit">Filtrar</button>
        </form>
        <section class="lista-projetos">
            ${projetos.length ? projetos.map(renderProjetoCard).join("") : `<p class="vazio">Nenhum projeto encontrado com esse filtro.</p>`}
        </section>
    `;

    $("#novoProjetoForm").addEventListener("submit", criarProjeto);
    $("#filtroProjetos").addEventListener("submit", filtrarProjetos);
    document.querySelectorAll(".projeto-form").forEach((form) => form.addEventListener("submit", salvarProjeto));
}

function renderProjetoCard(projeto) {
    return `
        <article class="projeto-card status-projeto-${escapeHtml(projeto.status)}">
            <form class="projeto-form" data-id="${projeto.id}">
                <div class="projeto-topo">
                    <input class="titulo-editavel" name="nome" value="${escapeHtml(projeto.nome)}" required>
                    <select name="status">${opcoesSelect(PROJETO_STATUS, projeto.status)}</select>
                </div>
                <div class="form-grid">
                    <label>Cliente<input name="cliente" value="${escapeHtml(projeto.cliente || "")}"></label>
                    <label>Local<input name="local" value="${escapeHtml(projeto.local || "")}"></label>
                    <label>Responsavel<input name="responsavel" value="${escapeHtml(projeto.responsavel || "")}"></label>
                    <label>Inicio<input name="data_inicio" type="date" value="${escapeHtml(projeto.data_inicio || "")}"></label>
                    <label>Prazo<input name="prazo" type="date" value="${escapeHtml(projeto.prazo || "")}"></label>
                    <label>Valor estimado<input name="valor_estimado" value="${escapeHtml(projeto.valor_estimado || "")}"></label>
                    <label class="campo-largo">Descricao<textarea name="descricao">${escapeHtml(projeto.descricao || "")}</textarea></label>
                    <label class="campo-largo">Observacoes<textarea name="observacoes">${escapeHtml(projeto.observacoes || "")}</textarea></label>
                </div>
                <div class="card-acoes"><span>Atualizado em ${escapeHtml(projeto.atualizado_em || "")}</span><button type="submit">Salvar</button></div>
            </form>
        </article>
    `;
}

async function criarProjeto(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target).entries());
    dados.criado_em = new Date().toISOString();
    dados.atualizado_em = dados.criado_em;
    const { error } = await supabase.from("projetos").insert(normalizarProjeto(dados));
    if (error) return setMensagem(error.message, "erro");
    setMensagem("Projeto criado.");
    await render();
}

async function salvarProjeto(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target).entries());
    dados.atualizado_em = new Date().toISOString();
    const { error } = await supabase.from("projetos").update(normalizarProjeto(dados)).eq("id", event.target.dataset.id);
    if (error) return setMensagem(error.message, "erro");
    setMensagem("Projeto salvo.");
    await render();
}

function normalizarProjeto(dados) {
    return {
        nome: dados.nome,
        cliente: dados.cliente || null,
        local: dados.local || null,
        status: dados.status || "prospeccao",
        responsavel: dados.responsavel || null,
        data_inicio: dados.data_inicio || null,
        prazo: dados.prazo || null,
        valor_estimado: dados.valor_estimado || null,
        descricao: dados.descricao || null,
        observacoes: dados.observacoes || null,
        criado_em: dados.criado_em,
        atualizado_em: dados.atualizado_em,
    };
}

function filtrarProjetos(event) {
    event.preventDefault();
    const params = new URLSearchParams(new FormData(event.target));
    location.hash = `projetos?${params.toString()}`;
}

function renderLicitacoes() {
    setPage("Licitacoes", "Radar PRAD e servicos ambientais", `<a class="botao" href="#regras">Regras PRAD</a>`);
    const params = new URLSearchParams(location.hash.split("?")[1] || "");
    const status = params.get("status") || "ativos";
    const fonte = params.get("fonte") || "";
    const prioridade = params.get("prioridade") || "";
    const relevantes = params.get("relevantes") === "1";
    let oportunidades = [...cache.oportunidades];

    if (status === "ativos") oportunidades = oportunidades.filter((o) => !["perdido", "descartado"].includes(o.status));
    else if (status !== "todos") oportunidades = oportunidades.filter((o) => o.status === status);
    if (fonte) oportunidades = oportunidades.filter((o) => o.fonte_nome === fonte);
    if (prioridade) oportunidades = oportunidades.filter((o) => o.prioridade_prad === prioridade);
    if (relevantes) oportunidades = oportunidades.filter((o) => o.relevante_prad);
    oportunidades.sort((a, b) => prioridadeOrdem(a.prioridade_prad) - prioridadeOrdem(b.prioridade_prad) || String(b.data_encontrado || "").localeCompare(String(a.data_encontrado || "")) || (b.id || 0) - (a.id || 0));
    const visiveis = oportunidades.slice(0, 120);

    conteudo.innerHTML = `
        <form id="filtroLicitacoes" class="filtros">
            <label>Status:<select name="status">${STATUS_FILTRO.map(([v, r]) => `<option value="${v}" ${v === status ? "selected" : ""}>${r}</option>`).join("")}</select></label>
            <label>Fonte:<select name="fonte"><option value="">Todas</option>${cache.fontes.map((f) => `<option value="${escapeHtml(f.nome)}" ${f.nome === fonte ? "selected" : ""}>${escapeHtml(f.nome)}</option>`).join("")}</select></label>
            <label>Prioridade:<select name="prioridade"><option value="">Todas</option>${PRIORIDADES.map((p) => `<option value="${p}" ${p === prioridade ? "selected" : ""}>${p}</option>`).join("")}</select></label>
            <label class="checkbox"><input type="checkbox" name="relevantes" value="1" ${relevantes ? "checked" : ""}> So relevantes para PRAD</label>
            <button type="submit">Filtrar</button>
        </form>
        ${oportunidades.length > visiveis.length ? `<p class="mensagem">Mostrando ${visiveis.length} de ${oportunidades.length} oportunidades. Use os filtros para refinar.</p>` : ""}
        <div class="lista">${visiveis.length ? visiveis.map(renderOportunidadeCard).join("") : `<p class="vazio">Nenhuma oportunidade encontrada com esse filtro.</p>`}</div>
    `;

    $("#filtroLicitacoes").addEventListener("submit", filtrarLicitacoes);
    document.querySelectorAll(".oportunidade-form").forEach((form) => form.addEventListener("submit", salvarOportunidade));
}

function renderOportunidadeCard(o) {
    return `
        <div class="card prioridade-card-${escapeHtml(o.prioridade_prad || "irrelevante")} status-${escapeHtml(o.status)}">
            <div class="card-topo">
                <span class="fonte-badge">${escapeHtml(o.fonte_nome)}</span>
                ${o.prioridade_prad && o.prioridade_prad !== "irrelevante" ? `<span class="prad-badge prioridade-${escapeHtml(o.prioridade_prad)}">PRAD ${escapeHtml(o.prioridade_prad)} · ${o.pontuacao_prad || 0}</span>` : ""}
                <span class="data">encontrado em ${escapeHtml(o.data_encontrado || "")}</span>
            </div>
            <a class="titulo" href="${escapeHtml(o.url)}" target="_blank" rel="noopener">${escapeHtml(o.titulo)}</a>
            ${o.descricao ? `<p class="descricao">${escapeHtml(o.descricao)}</p>` : ""}
            ${o.motivos_prad ? `<p class="motivos">Sinais: ${escapeHtml(o.motivos_prad)}</p>` : ""}
            ${o.data_publicacao ? `<p class="pub">Publicado: ${escapeHtml(o.data_publicacao)}</p>` : ""}
            <form class="form-status oportunidade-form" data-id="${o.id}">
                <select name="status">${opcoesTexto(STATUS_OPCOES, o.status)}</select>
                <textarea name="observacoes" placeholder="Observacoes...">${escapeHtml(o.observacoes || "")}</textarea>
                <button type="submit">Salvar</button>
            </form>
        </div>
    `;
}

function filtrarLicitacoes(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    if (!form.get("relevantes")) form.delete("relevantes");
    const params = new URLSearchParams(form);
    location.hash = `licitacoes?${params.toString()}`;
}

async function salvarOportunidade(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target).entries());
    const { error } = await supabase.from("oportunidades").update({
        status: dados.status,
        observacoes: dados.observacoes || null,
    }).eq("id", event.target.dataset.id);
    if (error) return setMensagem(error.message, "erro");
    setMensagem("Oportunidade atualizada.");
    await render();
}

function renderRegras() {
    setPage("Regras PRAD", "Sinais de classificacao", `<a class="botao secundario" href="#licitacoes">Voltar ao radar</a>`);
    conteudo.innerHTML = `
        <section class="painel">
            <div class="painel-topo"><h2>Regras atuais</h2><button id="novaRegraBtn" type="button">Adicionar regra</button></div>
            <form id="regrasForm">
                <div class="tabela-wrap">
                    <table>
                        <thead><tr><th>Ativo</th><th>Tipo</th><th>Termos</th><th>Peso</th><th>Motivo</th><th>Excluir</th></tr></thead>
                        <tbody>${cache.regras.map(renderRegraRow).join("")}</tbody>
                    </table>
                </div>
                <div class="card-acoes" style="margin-top: .8rem;"><button type="submit">Salvar regras</button></div>
            </form>
        </section>
    `;
    $("#novaRegraBtn").addEventListener("click", adicionarLinhaRegra);
    $("#regrasForm").addEventListener("submit", salvarRegras);
}

function renderRegraRow(regra) {
    return `
        <tr>
            <td><input type="hidden" name="id" value="${escapeHtml(regra.id)}"><input type="checkbox" name="ativo" ${regra.ativo ? "checked" : ""}></td>
            <td><select name="tipo">${TIPOS_REGRA.map((t) => `<option value="${t}" ${t === regra.tipo ? "selected" : ""}>${t}</option>`).join("")}</select></td>
            <td><input name="termos" value="${escapeHtml(regra.termos)}"></td>
            <td><input name="peso" type="number" min="0" max="100" value="${regra.peso || 0}"></td>
            <td><input name="motivo" value="${escapeHtml(regra.motivo)}"></td>
            <td><input type="checkbox" name="excluir"></td>
        </tr>
    `;
}

function adicionarLinhaRegra() {
    const tbody = document.querySelector("#regrasForm tbody");
    const id = `nova-${Date.now()}`;
    tbody.insertAdjacentHTML("beforeend", renderRegraRow({ id, tipo: "positivo", termos: "", peso: 25, motivo: "", ativo: true }));
}

async function salvarRegras(event) {
    event.preventDefault();
    const rows = [...document.querySelectorAll("#regrasForm tbody tr")];
    const antigas = new Set(cache.regras.map((r) => r.id));
    const payload = [];
    const excluir = [];

    rows.forEach((row, index) => {
        const idInput = row.querySelector('[name="id"]');
        let id = idInput.value;
        const tipo = row.querySelector('[name="tipo"]').value;
        const termos = row.querySelector('[name="termos"]').value.trim();
        const peso = Number(row.querySelector('[name="peso"]').value || 0);
        const motivo = row.querySelector('[name="motivo"]').value.trim() || termos;
        const ativo = row.querySelector('[name="ativo"]').checked;
        const excluirRow = row.querySelector('[name="excluir"]').checked;
        if (excluirRow && antigas.has(id)) excluir.push(id);
        if (excluirRow || !termos) return;
        if (id.startsWith("nova-")) id = `${tipo[0]}${Date.now()}${index}`;
        payload.push({ id, tipo, termos, peso, motivo, ativo, ordem: index + 1 });
    });

    for (const id of excluir) {
        const { error } = await supabase.from("regras_prad").delete().eq("id", id);
        if (error) return setMensagem(error.message, "erro");
    }
    if (payload.length) {
        const { error } = await supabase.from("regras_prad").upsert(payload, { onConflict: "id" });
        if (error) return setMensagem(error.message, "erro");
    }
    setMensagem("Regras salvas.");
    await render();
}

async function iniciar() {
    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
        $("#loginView").classList.remove("oculto");
        $("#loginErro").textContent = "Configuração Supabase ausente.";
        $("#loginErro").classList.remove("oculto");
        return;
    }

    const current = await supabase.auth.getSession();
    session = current.data.session;
    atualizarAuthView();
    supabase.auth.onAuthStateChange((_event, newSession) => {
        session = newSession;
        atualizarAuthView();
    });
}

function atualizarAuthView() {
    $("#loginView").classList.toggle("oculto", Boolean(session));
    $("#appView").classList.toggle("oculto", !session);
    if (session) {
        $("#usuarioAtual").textContent = session.user.email;
        render();
    }
}

$("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    $("#loginErro").classList.add("oculto");
    const { error } = await supabase.auth.signInWithPassword({
        email: $("#email").value,
        password: $("#senha").value,
    });
    if (error) {
        $("#loginErro").textContent = "Email ou senha invalidos, ou usuario sem permissao.";
        $("#loginErro").classList.remove("oculto");
    }
});

$("#logoutBtn").addEventListener("click", async () => {
    await supabase.auth.signOut();
});

window.addEventListener("hashchange", render);
iniciar();
