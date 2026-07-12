import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { safeExternalUrl } from "./url_safety.js";

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
    ["prospeccao", "Prospecção"],
    ["orcamento", "Orçamento"],
    ["contratado", "Contratado"],
    ["em_execucao", "Em execução"],
    ["monitoramento", "Monitoramento"],
    ["concluido", "Concluído"],
    ["pausado", "Pausado"],
    ["arquivado", "Arquivado"],
];
const TIPOS_REGRA = ["positivo", "negativo", "combinacao"];
const INTERVENCAO_STATUS = [
    ["prevista", "Prevista"],
    ["confirmar_cliente", "Confirmar cliente"],
    ["confirmada", "Confirmada"],
    ["executada", "Executada"],
    ["reagendada", "Reagendada"],
    ["cancelada", "Cancelada"],
];
const ATIVIDADES_MANUTENCAO = [
    ["rocada", "Roçada"],
    ["coroamento", "Coroamento"],
    ["adubacao", "Adubação"],
    ["controle_formigas", "Controle de formigas"],
    ["replantio", "Replantio"],
];
const CATEGORIAS_LANCAMENTO = [
    ["recebimento", "Recebimento"],
    ["combustivel", "Combustível"],
    ["insumo", "Insumo"],
    ["diaria", "Diária"],
    ["equipamento", "Equipamento"],
];
const UNIDADES_INSUMO = [
    ["kg", "kg"],
    ["g", "g"],
    ["l", "L"],
    ["ml", "ml"],
    ["un", "unidade"],
    ["muda", "muda"],
];
const PROPOSTA_STATUS = [
    ["rascunho", "Rascunho"],
    ["enviada", "Enviada"],
    ["aprovada", "Aprovada"],
    ["recusada", "Recusada"],
    ["substituida", "Substituída"],
];
const TIPOS_LINK_PROJETO = [
    ["pasta_drive", "Pasta do Drive"],
    ["relatorio", "Relatório"],
    ["album_fotos", "Álbum de fotos"],
    ["documento", "Documento"],
];
const STATUS_EMAIL_PROSPECCAO = [
    ["pendente", "Pendente"],
    ["enviado", "Enviado"],
    ["respondido", "Respondido"],
    ["sem_resposta", "Sem resposta"],
    ["erro", "Erro"],
];
const STATUS_WHATSAPP_PROSPECCAO = [
    ["pendente", "Pendente"],
    ["enviado", "Enviado"],
    ["respondido", "Respondido"],
    ["sem_resposta", "Sem resposta"],
    ["nao_se_aplica", "Não se aplica"],
];
const STATUS_REUNIAO_PROSPECCAO = [
    ["nao_agendada", "Não agendada"],
    ["agendada", "Agendada"],
    ["realizada", "Realizada"],
    ["nao_interessado", "Não interessado"],
];

const $ = (selector) => document.querySelector(selector);
const conteudo = $("#conteudo");
const mensagem = $("#mensagem");

let session = null;
let cache = {
    fontes: [],
    oportunidades: [],
    projetos: [],
    regras: [],
    intervencoes: [],
    atividades: [],
    lancamentos: [],
    insumosUsados: [],
    insumos: [],
    opcoes: [],
    historico: [],
    propostas: [],
    propostaItens: [],
    projetoLinks: [],
    prospeccaoContatos: [],
    configuracoesAlertas: [],
};
let projetoModalAbertoId = null;
let intervencaoModalDestaqueId = null;

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
    atualizarAvatarTopo();
    document.querySelectorAll(".nav a").forEach((link) => {
        link.classList.toggle("ativo", link.dataset.route === rotaAtual());
    });
}

function rotaAtual() {
    return ((location.hash || "#dashboard").replace("#", "").split("?")[0]) || "dashboard";
}

function formatStatus(status) {
    const rotulos = {
        prospeccao: "Prospecção",
        orcamento: "Orçamento",
        em_execucao: "Em execução",
        concluido: "Concluído",
        confirmar_cliente: "Confirmar cliente",
        manutencao: "Manutenção",
        licitacoes: "Licitações",
        rocada: "Roçada",
        adubacao: "Adubação",
        controle_formigas: "Controle de formigas",
        combustivel: "Combustível",
        diaria: "Diária",
        rascunho: "Rascunho",
        enviada: "Enviada",
        aprovada: "Aprovada",
        recusada: "Recusada",
        substituida: "Substituída",
        pasta_drive: "Pasta do Drive",
        relatorio: "Relatório",
        album_fotos: "Álbum de fotos",
        documento: "Documento",
        sem_resposta: "Sem resposta",
        nao_se_aplica: "Não se aplica",
        nao_agendada: "Não agendada",
        nao_interessado: "Não interessado",
        agendada: "Agendada",
        realizada: "Realizada",
    };
    return rotulos[status] || (status || "").replaceAll("_", " ");
}

function formatMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatData(valor, dataExata = true) {
    if (!valor) return "Sem data";
    const [ano, mes, dia] = String(valor).split("-");
    if (!ano || !mes || !dia) return valor;
    if (!dataExata) return `${mes}/${ano}`;
    return `${dia}/${mes}/${ano}`;
}

function dataPrimeiroDiaMes(valor) {
    if (!valor) return null;
    return `${valor}-01`;
}

function prioridadeOrdem(valor) {
    return { alta: 1, media: 2, baixa: 3 }[valor] || 4;
}

function configuracaoAlerta(chave) {
    return cache.configuracoesAlertas.find((item) => item.chave === chave);
}

function alertasConfirmacaoManutencao() {
    const configuracao = configuracaoAlerta("confirmacao_manutencao") || { ativo: true, dias_antecedencia: 7 };
    if (!configuracao?.ativo) return [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + Number(configuracao.dias_antecedencia || 0));
    return cache.intervencoes.filter((item) => {
        if (item.tipo !== "manutencao" || !item.data_prevista || item.contato_cliente_em || ["executada", "cancelada"].includes(item.status)) return false;
        const data = new Date(`${item.data_prevista}T12:00:00`);
        return data >= hoje && data <= limite;
    });
}

function opcoesSelect(opcoes, atual) {
    return opcoes
        .map(([valor, rotulo]) => `<option value="${valor}" ${valor === atual ? "selected" : ""}>${rotulo}</option>`)
        .join("");
}

function opcoesConfig(tipo, fallback) {
    const opcoes = cache.opcoes
        .filter((opcao) => opcao.tipo === tipo && opcao.ativo)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || String(a.rotulo).localeCompare(String(b.rotulo)))
        .map((opcao) => [opcao.valor, opcao.rotulo]);
    return opcoes.length ? opcoes : fallback;
}

function slugOpcao(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function opcoesTexto(opcoes, atual) {
    return opcoes
        .map((valor) => `<option value="${valor}" ${valor === atual ? "selected" : ""}>${formatStatus(valor)}</option>`)
        .join("");
}

async function carregarDados() {
    const [fontes, oportunidades, projetos, regras, intervencoes, atividades, lancamentos, insumosUsados, insumos, opcoes, historico, propostas, propostaItens, projetoLinks, prospeccaoContatos, configuracoesAlertas] = await Promise.all([
        supabase.from("fontes").select("*").order("nome"),
        supabase.from("oportunidades").select("*, fontes(nome)").order("data_encontrado", { ascending: false }),
        supabase.from("projetos").select("*").order("atualizado_em", { ascending: false }),
        supabase.from("regras_prad").select("*").order("ordem").order("id"),
        supabase.from("intervencoes").select("*, projetos(nome, cliente, local)").order("data_prevista", { ascending: true }),
        supabase.from("intervencao_atividades").select("*").order("id"),
        supabase.from("intervencao_lancamentos").select("*").order("data_lancamento", { ascending: false }),
        supabase.from("intervencao_insumos").select("*").order("id"),
        supabase.from("insumos").select("*").order("nome"),
        supabase.from("configuracoes_opcoes").select("*").order("tipo").order("ordem").order("rotulo"),
        supabase.from("projeto_historico").select("*").order("criado_em", { ascending: false }).limit(300),
        supabase.from("propostas").select("*").order("versao", { ascending: false }),
        supabase.from("proposta_itens").select("*").order("id"),
        supabase.from("projeto_links").select("*").order("id", { ascending: false }),
        supabase.from("prospeccao_contatos").select("*").order("atualizado_em", { ascending: false }),
        supabase.from("configuracoes_alertas").select("*").order("chave"),
    ]);

    for (const result of [fontes, oportunidades, projetos, regras, intervencoes, atividades, lancamentos, insumosUsados, insumos, opcoes, historico, propostas, propostaItens, projetoLinks, prospeccaoContatos, configuracoesAlertas]) {
        if (result.error) throw result.error;
    }

    cache.fontes = fontes.data || [];
    cache.oportunidades = (oportunidades.data || []).map((row) => ({
        ...row,
        fonte_nome: row.fontes?.nome || "",
    }));
    cache.projetos = projetos.data || [];
    cache.regras = regras.data || [];
    cache.intervencoes = intervencoes.data || [];
    cache.atividades = atividades.data || [];
    cache.lancamentos = lancamentos.data || [];
    cache.insumosUsados = insumosUsados.data || [];
    cache.insumos = insumos.data || [];
    cache.opcoes = opcoes.data || [];
    cache.historico = historico.data || [];
    cache.propostas = propostas.data || [];
    cache.propostaItens = propostaItens.data || [];
    cache.projetoLinks = projetoLinks.data || [];
    cache.prospeccaoContatos = prospeccaoContatos.data || [];
    cache.configuracoesAlertas = configuracoesAlertas.data || [];
}

async function render() {
    setMensagem("");
    try {
        await carregarDados();
        const rota = rotaAtual();
        if (rota === "projetos") renderProjetos();
        else if (rota === "calendario") renderCalendario();
        else if (rota === "prospeccao") renderProspeccao();
        else if (rota === "perfil") renderPerfil();
        else if (rota === "licitacoes") renderLicitacoes();
        else if (rota === "regras") renderRegras();
        else if (rota === "configuracoes") renderConfiguracoes();
        else renderDashboard();
    } catch (error) {
        console.error(error);
        setPage("Erro", "Não foi possível carregar");
        conteudo.innerHTML = `<p class="alerta">Não foi possível carregar os dados. Verifique login, permissão e conexão.</p>`;
    }
}

function renderDashboard() {
    setPage("Início", "Visão geral", `<a class="botao" href="#projetos">Projetos</a><a class="botao secundario" href="#calendario">Calendário</a>`);

    const projetosAtivos = cache.projetos.filter((p) => !["concluido", "arquivado"].includes(p.status));
    const projetosExecucao = cache.projetos.filter((p) => ["contratado", "em_execucao", "monitoramento"].includes(p.status));
    const intervencoesPendentes = cache.intervencoes.filter((i) => !["executada", "cancelada"].includes(i.status));
    const licitacoesAtivas = cache.oportunidades.filter((o) => !["perdido", "descartado"].includes(o.status));
    const licitacoesRelevantes = licitacoesAtivas.filter((o) => ["alta", "media"].includes(o.prioridade_prad));
    const licitacoesAlta = licitacoesAtivas.filter((o) => o.prioridade_prad === "alta");
    const alertasConfirmacao = alertasConfirmacaoManutencao();
    const projetosRecentes = cache.projetos.filter((p) => p.status !== "arquivado").slice(0, 5);
    const licitacoesRecentes = [...licitacoesRelevantes]
        .sort((a, b) => (b.pontuacao_prad || 0) - (a.pontuacao_prad || 0))
        .slice(0, 5);

    conteudo.innerHTML = `
        <section class="metricas">
            <div class="metric-card"><span>Projetos ativos</span><strong>${projetosAtivos.length}</strong></div>
            <div class="metric-card"><span>Em execução</span><strong>${projetosExecucao.length}</strong></div>
            <div class="metric-card"><span>Intervenções abertas</span><strong>${intervencoesPendentes.length}</strong></div>
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
                <div class="painel-topo"><h2>Licitações em foco</h2><a href="#licitacoes">Ver radar</a></div>
                ${licitacoesRecentes.length ? `<div class="lista-compacta">${licitacoesRecentes.map((o) => `
                    <article><div><strong>${escapeHtml(o.titulo)}</strong><span>${escapeHtml(o.fonte_nome)} · ${escapeHtml(o.motivos_prad || "Sem motivo registrado")}</span></div><em>${escapeHtml(o.prioridade_prad)} · ${o.pontuacao_prad || 0}</em></article>
                `).join("")}</div>` : `<p class="vazio compacto">Nenhuma licitação relevante ativa no momento.</p>`}
            </div>
            <div class="painel painel-alertas">
                <div class="painel-topo"><h2>Confirmar manutenções</h2><a href="#configuracoes">Configurar</a></div>
                ${alertasConfirmacao.length ? `<div class="lista-compacta">${alertasConfirmacao.map((item) => `
                    <article><div><strong>${escapeHtml(item.titulo)}</strong><span>${escapeHtml(item.projetos?.nome || "Projeto")} · ${escapeHtml(formatData(item.data_prevista, item.data_exata))}</span></div><a href="#calendario">Abrir agenda</a></article>
                `).join("")}</div>` : `<p class="vazio compacto">Nenhuma confirmação pendente dentro do prazo configurado.</p>`}
            </div>
        </section>
    `;
}

function renderProjetos() {
    setPage("Projetos", "ERP simples", `<button id="novoProjetoBtn" type="button">Novo projeto</button>`);
    const params = new URLSearchParams(location.hash.split("?")[1] || "");
    const statusFiltro = params.get("status") || "ativos";
    const busca = params.get("busca") || "";
    const visualizacao = params.get("visualizacao") === "kanban" ? "kanban" : "lista";
    let projetos = [...cache.projetos];

    if (statusFiltro === "ativos") projetos = projetos.filter((p) => !["concluido", "arquivado"].includes(p.status));
    else if (statusFiltro !== "todos") projetos = projetos.filter((p) => p.status === statusFiltro);
    if (busca) {
        const termo = busca.toLowerCase();
        projetos = projetos.filter((p) => [p.nome, p.cliente, p.local, p.descricao].join(" ").toLowerCase().includes(termo));
    }

    const paramsLista = new URLSearchParams(params);
    paramsLista.set("visualizacao", "lista");
    const paramsKanban = new URLSearchParams(params);
    paramsKanban.set("visualizacao", "kanban");
    const statusKanban = statusFiltro === "todos"
        ? PROJETO_STATUS
        : statusFiltro === "ativos"
            ? PROJETO_STATUS.filter(([valor]) => !["concluido", "arquivado"].includes(valor))
            : PROJETO_STATUS.filter(([valor]) => valor === statusFiltro);

    conteudo.innerHTML = `
        <form id="filtroProjetos" class="filtros">
            <input type="hidden" name="visualizacao" value="${visualizacao}">
            <label>Status:<select name="status"><option value="ativos" ${statusFiltro === "ativos" ? "selected" : ""}>Ativos</option><option value="todos" ${statusFiltro === "todos" ? "selected" : ""}>Todos</option>${opcoesSelect(PROJETO_STATUS, statusFiltro)}</select></label>
            <label class="busca">Buscar:<input name="busca" value="${escapeHtml(busca)}" placeholder="cliente, local, projeto"></label>
            <button type="submit">Filtrar</button>
            <nav class="seletor-visualizacao" aria-label="Visualização dos projetos">
                <a class="${visualizacao === "lista" ? "ativo" : ""}" href="#projetos?${paramsLista.toString()}">Lista</a>
                <a class="${visualizacao === "kanban" ? "ativo" : ""}" href="#projetos?${paramsKanban.toString()}">Kanban</a>
            </nav>
        </form>
        ${visualizacao === "kanban"
            ? renderProjetoKanban(projetos, statusKanban)
            : `<section class="lista-projetos">${projetos.length ? projetos.map(renderProjetoCard).join("") : `<p class="vazio">Nenhum projeto encontrado com esse filtro.</p>`}</section>`}
        <dialog id="projetoModal" class="modal-projeto">
            <div id="projetoModalConteudo"></div>
        </dialog>
        <dialog id="novoProjetoModal" class="modal-novo-projeto">
            <form id="novoProjetoForm">
                <div class="modal-topo">
                    <div><small>Projetos</small><h2>Novo projeto</h2></div>
                    <button class="botao secundario fechar-novo-projeto" type="button">Fechar</button>
                </div>
                <div class="novo-projeto-conteudo form-grid">
                    <label>Nome<input name="nome" required placeholder="Ex.: PRAD Barreirinha" autofocus></label>
                    <label>Cliente<input name="cliente" placeholder="Ex.: SANEPAR"></label>
                    <label>Local<input name="local" placeholder="Município / área"></label>
                    <label>Status<select name="status">${opcoesSelect(PROJETO_STATUS, "prospeccao")}</select></label>
                    <label>Responsável<input name="responsavel"></label>
                    <label>Início<input name="data_inicio" type="date"></label>
                    <label>Prazo<input name="prazo" type="date"></label>
                    <label>Valor estimado<input name="valor_estimado" placeholder="Ex.: R$ 45.000"></label>
                    <label class="campo-largo">Descrição<textarea name="descricao"></textarea></label>
                    <label class="campo-largo">Observações<textarea name="observacoes"></textarea></label>
                    <div class="card-acoes campo-largo"><button type="submit">Criar projeto</button></div>
                </div>
            </form>
        </dialog>
    `;

    $("#novoProjetoBtn").addEventListener("click", () => $("#novoProjetoModal").showModal());
    $(".fechar-novo-projeto").addEventListener("click", () => $("#novoProjetoModal").close());
    $("#novoProjetoForm").addEventListener("submit", criarProjeto);
    $("#filtroProjetos").addEventListener("submit", filtrarProjetos);
    document.querySelectorAll(".abrir-projeto-modal").forEach((botao) => {
        botao.addEventListener("click", () => abrirProjetoModal(Number(botao.dataset.id)));
    });
    if (visualizacao === "kanban") bindProjetoKanban();
    if (projetoModalAbertoId) setTimeout(() => abrirProjetoModal(projetoModalAbertoId), 0);
}

function renderProjetoKanban(projetos, statusKanban) {
    return `
        <section class="kanban-projetos" aria-label="Projetos em Kanban">
            ${statusKanban.map(([status, rotulo]) => {
                const itens = projetos.filter((projeto) => projeto.status === status);
                return `
                    <section class="kanban-coluna status-projeto-${escapeHtml(status)}" data-status="${escapeHtml(status)}">
                        <header><h3>${escapeHtml(rotulo)}</h3><span>${itens.length}</span></header>
                        <div class="kanban-lista">
                            ${itens.length ? itens.map(renderProjetoKanbanCard).join("") : `<p class="kanban-vazio">Nenhum projeto</p>`}
                        </div>
                    </section>
                `;
            }).join("")}
        </section>
    `;
}

function renderProjetoKanbanCard(projeto) {
    const intervencoes = cache.intervencoes.filter((item) => item.projeto_id === projeto.id);
    const abertas = intervencoes.filter((item) => !["executada", "cancelada"].includes(item.status));
    const proxima = abertas
        .filter((item) => item.data_prevista)
        .sort((a, b) => String(a.data_prevista).localeCompare(String(b.data_prevista)))[0];
    const valorPrevisto = intervencoes.reduce((total, item) => total + Number(item.valor_receber || 0), 0);
    return `
        <article class="kanban-card" draggable="true" data-projeto-id="${projeto.id}" data-status="${escapeHtml(projeto.status)}">
            <div>
                <h4>${escapeHtml(projeto.nome)}</h4>
                <p>${escapeHtml(projeto.cliente || "Cliente não informado")}</p>
                <small>${escapeHtml(projeto.local || "Local não informado")}</small>
            </div>
            <dl>
                <div><dt>Previsto</dt><dd>${formatMoeda(valorPrevisto)}</dd></div>
                <div><dt>Próxima</dt><dd>${proxima ? formatData(proxima.data_prevista, proxima.data_exata) : "Sem agenda"}</dd></div>
            </dl>
            <footer>
                <span>${abertas.length} aberta(s)</span>
                <button class="abrir-projeto-modal" type="button" data-id="${projeto.id}">Abrir</button>
            </footer>
        </article>
    `;
}

function bindProjetoKanban() {
    let cartaoArrastado = null;
    document.querySelectorAll(".kanban-card").forEach((cartao) => {
        cartao.addEventListener("dragstart", (event) => {
            cartaoArrastado = cartao;
            cartao.classList.add("arrastando");
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", cartao.dataset.projetoId);
        });
        cartao.addEventListener("dragend", () => {
            cartao.classList.remove("arrastando");
            document.querySelectorAll(".kanban-coluna").forEach((coluna) => coluna.classList.remove("destino-arraste"));
            cartaoArrastado = null;
        });
    });
    document.querySelectorAll(".kanban-coluna").forEach((coluna) => {
        coluna.addEventListener("dragover", (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            if (cartaoArrastado?.dataset.status !== coluna.dataset.status) coluna.classList.add("destino-arraste");
        });
        coluna.addEventListener("dragleave", (event) => {
            if (!coluna.contains(event.relatedTarget)) coluna.classList.remove("destino-arraste");
        });
        coluna.addEventListener("drop", async (event) => {
            event.preventDefault();
            coluna.classList.remove("destino-arraste");
            const projetoId = Number(event.dataTransfer.getData("text/plain"));
            await moverProjetoKanban(projetoId, coluna.dataset.status);
        });
    });
}

async function moverProjetoKanban(projetoId, novoStatus) {
    const projeto = cache.projetos.find((item) => item.id === projetoId);
    if (!projeto || projeto.status === novoStatus || !PROJETO_STATUS.some(([status]) => status === novoStatus)) return;
    const statusAnterior = projeto.status;
    projeto.status = novoStatus;
    projeto.atualizado_em = new Date().toISOString();
    renderProjetos();
    const { error } = await supabase.from("projetos").update({
        status: novoStatus,
        atualizado_em: projeto.atualizado_em,
    }).eq("id", projetoId);
    if (error) {
        projeto.status = statusAnterior;
        setMensagem(`Não foi possível mover o projeto: ${error.message}`, "erro");
        await render();
        return;
    }
    setMensagem(`Projeto movido para ${formatStatus(novoStatus)}.`);
    await render();
}

function renderProjetoCard(projeto) {
    const intervencoes = cache.intervencoes.filter((item) => item.projeto_id === projeto.id);
    const abertas = intervencoes.filter((item) => !["executada", "cancelada"].includes(item.status));
    const proxima = abertas
        .filter((item) => item.data_prevista)
        .sort((a, b) => String(a.data_prevista).localeCompare(String(b.data_prevista)))[0];
    const valorPrevisto = intervencoes.reduce((total, item) => total + Number(item.valor_receber || 0), 0);

    return `
        <article class="projeto-card projeto-resumo status-projeto-${escapeHtml(projeto.status)}">
            <div class="projeto-resumo-topo">
                <div>
                    <h3>${escapeHtml(projeto.nome)}</h3>
                    <p>${escapeHtml(projeto.cliente || "Cliente não informado")} · ${escapeHtml(projeto.local || "Local não informado")}</p>
                </div>
                <span>${escapeHtml(formatStatus(projeto.status))}</span>
            </div>
            <div class="projeto-resumo-metricas">
                <span><strong>${intervencoes.length}</strong> intervenções</span>
                <span><strong>${abertas.length}</strong> abertas</span>
                <span><strong>${formatMoeda(valorPrevisto)}</strong> previsto</span>
                <span><strong>${proxima ? formatData(proxima.data_prevista, proxima.data_exata) : "Sem agenda"}</strong> próxima</span>
            </div>
            <div class="card-acoes">
                <small>Atualizado em ${escapeHtml(formatData((projeto.atualizado_em || "").slice(0, 10)))}</small>
                <button class="abrir-projeto-modal" type="button" data-id="${projeto.id}">Abrir detalhes</button>
            </div>
        </article>
    `;
}

function abrirProjetoModal(id, intervencaoId = null) {
    const projeto = cache.projetos.find((item) => item.id === id);
    const modal = $("#projetoModal");
    const modalConteudo = $("#projetoModalConteudo");
    if (!projeto || !modal || !modalConteudo) return;
    projetoModalAbertoId = id;
    intervencaoModalDestaqueId = intervencaoId;
    modalConteudo.innerHTML = renderProjetoDetalhe(projeto);
    bindProjetoDetalhe(modalConteudo);
    modal.showModal();
    if (intervencaoId) {
        const alvo = modalConteudo.querySelector(`[data-intervencao-card="${intervencaoId}"]`);
        alvo?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
}

function fecharProjetoModal() {
    const modal = $("#projetoModal");
    projetoModalAbertoId = null;
    intervencaoModalDestaqueId = null;
    if (modal?.open) modal.close();
}

function bindProjetoDetalhe(container) {
    container.querySelector(".fechar-modal")?.addEventListener("click", fecharProjetoModal);
    container.querySelector(".projeto-form")?.addEventListener("submit", salvarProjeto);
    container.querySelectorAll(".intervencao-acordeao").forEach((acordeao) => {
        acordeao.addEventListener("toggle", () => {
            if (!acordeao.open) return;
            container.querySelectorAll(".intervencao-acordeao[open]").forEach((outro) => {
                if (outro !== acordeao) outro.open = false;
            });
        });
    });
    container.querySelectorAll(".intervencao-form").forEach((form) => form.addEventListener("submit", salvarIntervencao));
    container.querySelectorAll(".nova-intervencao-form").forEach((form) => form.addEventListener("submit", criarIntervencao));
    container.querySelectorAll(".nova-atividade-form").forEach((form) => form.addEventListener("submit", criarAtividade));
    container.querySelectorAll(".atividade-check").forEach((input) => input.addEventListener("change", alternarAtividade));
    container.querySelectorAll(".novo-lancamento-form").forEach((form) => form.addEventListener("submit", criarLancamento));
    container.querySelectorAll(".novo-insumo-form").forEach((form) => form.addEventListener("submit", criarInsumoUsado));
    container.querySelectorAll(".nova-proposta-form").forEach((form) => form.addEventListener("submit", criarProposta));
    container.querySelectorAll(".proposta-form").forEach((form) => form.addEventListener("submit", salvarProposta));
    container.querySelectorAll(".novo-proposta-item-form").forEach((form) => form.addEventListener("submit", criarPropostaItem));
    container.querySelectorAll(".novo-projeto-link-form").forEach((form) => form.addEventListener("submit", criarProjetoLink));
}

function renderProjetoDetalhe(projeto) {
    const intervencoes = cache.intervencoes.filter((item) => item.projeto_id === projeto.id);
    const valorPrevisto = intervencoes.reduce((total, item) => total + Number(item.valor_receber || 0), 0);
    const abertas = intervencoes.filter((item) => !["executada", "cancelada"].includes(item.status)).length;
    const historico = cache.historico.filter((item) => item.projeto_id === projeto.id).slice(0, 40);
    return `
        <div class="modal-topo">
            <div>
                <p class="eyebrow">Projeto</p>
                <h2>${escapeHtml(projeto.nome)}</h2>
                <span>${escapeHtml(projeto.cliente || "Cliente não informado")} · ${escapeHtml(projeto.local || "Local não informado")}</span>
            </div>
            <button class="botao secundario fechar-modal" type="button">Fechar</button>
        </div>
        <article class="projeto-detalhe status-projeto-${escapeHtml(projeto.status)}">
            <section class="modal-resumo">
                <span><strong>${intervencoes.length}</strong> intervenções</span>
                <span><strong>${abertas}</strong> abertas</span>
                <span><strong>${formatMoeda(valorPrevisto)}</strong> previsto</span>
                <span><strong>${escapeHtml(formatStatus(projeto.status))}</strong> status</span>
            </section>
            <form class="projeto-form" data-id="${projeto.id}">
                <div class="secao-titulo">
                    <h3>Dados do projeto</h3>
                    <button type="submit">Salvar projeto</button>
                </div>
                <div class="projeto-topo">
                    <input class="titulo-editavel" name="nome" value="${escapeHtml(projeto.nome)}" required>
                    <select name="status">${opcoesSelect(PROJETO_STATUS, projeto.status)}</select>
                </div>
                <div class="form-grid">
                    <label>Cliente<input name="cliente" value="${escapeHtml(projeto.cliente || "")}"></label>
                    <label>Local<input name="local" value="${escapeHtml(projeto.local || "")}"></label>
                    <label>Responsável<input name="responsavel" value="${escapeHtml(projeto.responsavel || "")}"></label>
                    <label>Início<input name="data_inicio" type="date" value="${escapeHtml(projeto.data_inicio || "")}"></label>
                    <label>Prazo<input name="prazo" type="date" value="${escapeHtml(projeto.prazo || "")}"></label>
                    <label>Valor estimado<input name="valor_estimado" value="${escapeHtml(projeto.valor_estimado || "")}"></label>
                    <label class="campo-largo">Descrição<textarea name="descricao">${escapeHtml(projeto.descricao || "")}</textarea></label>
                    <label class="campo-largo">Observações<textarea name="observacoes">${escapeHtml(projeto.observacoes || "")}</textarea></label>
                </div>
                <p class="meta-linha">Atualizado em ${escapeHtml(formatDataHora(projeto.atualizado_em))}</p>
            </form>
            <section class="erp-projeto">
                <div class="painel-topo compacto">
                    <div>
                        <h3>Plantio e manutenções</h3>
                        <p class="subtexto">Cadastre o plantio inicial e as manutenções previstas no cronograma.</p>
                    </div>
                    <span>${intervencoes.length} intervenção(ões)</span>
                </div>
                <form class="nova-intervencao-form form-grid compacto-grid" data-projeto-id="${projeto.id}">
                    <label>Tipo<select name="tipo"><option value="manutencao">Manutenção</option><option value="plantio">Plantio inicial</option></select></label>
                    <label>Título<input name="titulo" placeholder="Ex.: Manutenção 01" required></label>
                    <label>Mês/data<input name="data_prevista" type="date"></label>
                    <label class="checkbox linha-checkbox"><input type="checkbox" name="data_exata" value="1" checked> Data exata</label>
                    <label>Valor a receber<input name="valor_receber" type="number" step="0.01" min="0" placeholder="0,00"></label>
                    <button type="submit">Adicionar</button>
                </form>
                <div class="lista-intervencoes">
                    ${intervencoes.length ? intervencoes.map(renderIntervencaoCard).join("") : `<p class="vazio compacto">Nenhum plantio ou manutenção cadastrado.</p>`}
                </div>
            </section>
            ${renderPropostasELinksProjeto(projeto)}
            <section class="historico-projeto">
                <div class="painel-topo compacto">
                    <div>
                        <h3>Histórico</h3>
                        <p class="subtexto">Registro automático das ações feitas neste projeto.</p>
                    </div>
                    <span>${historico.length} evento(s)</span>
                </div>
                <div class="historico-lista">
                    ${historico.length ? historico.map(renderHistoricoItem).join("") : `<p class="vazio compacto">Nenhum evento registrado ainda.</p>`}
                </div>
            </section>
        </article>
    `;
}

function renderIntervencaoCard(intervencao) {
    const atividades = cache.atividades.filter((item) => item.intervencao_id === intervencao.id);
    const opcoesAtividade = opcoesConfig("atividade", ATIVIDADES_MANUTENCAO);
    const lancamentos = cache.lancamentos.filter((item) => item.intervencao_id === intervencao.id);
    const insumosUsados = cache.insumosUsados.filter((item) => item.intervencao_id === intervencao.id);
    const gastos = lancamentos.filter((item) => item.tipo === "gasto").reduce((total, item) => total + Number(item.valor || 0), 0);
    const recebimentos = lancamentos.filter((item) => item.tipo === "recebimento").reduce((total, item) => total + Number(item.valor || 0), 0);
    const rateios = insumosUsados.reduce((total, item) => total + Number(item.valor_rateado || 0), 0);
    const previsto = Number(intervencao.valor_receber || 0);
    const saldoPrevisto = previsto + recebimentos - gastos - rateios;

    return `
        <article class="intervencao-card tipo-${escapeHtml(intervencao.tipo)} ${intervencao.id === intervencaoModalDestaqueId ? "intervencao-destaque" : ""}" data-intervencao-card="${intervencao.id}">
            <details class="intervencao-acordeao" ${intervencao.id === intervencaoModalDestaqueId ? "open" : ""}>
                <summary class="intervencao-topo">
                    <div class="intervencao-resumo">
                        <strong>${escapeHtml(intervencao.tipo === "plantio" ? "Plantio" : "Manutenção")}</strong>
                        <span>${escapeHtml(intervencao.titulo || "Sem título")}</span>
                        <small>${escapeHtml(formatData(intervencao.data_prevista, intervencao.data_exata))} · ${escapeHtml(formatStatus(intervencao.status))}</small>
                    </div>
                    <span class="saldo ${saldoPrevisto >= 0 ? "positivo" : "negativo"}">${formatMoeda(saldoPrevisto)}</span>
                </summary>
                <div class="intervencao-conteudo">
            <form class="intervencao-form" data-id="${intervencao.id}">
                <div class="form-grid compacto-grid">
                    <label>Título<input name="titulo" value="${escapeHtml(intervencao.titulo)}" required></label>
                    <label>Status<select name="status">${opcoesSelect(INTERVENCAO_STATUS, intervencao.status)}</select></label>
                    <label>Data<input name="data_prevista" type="date" value="${escapeHtml(intervencao.data_prevista || "")}"></label>
                    <label class="checkbox linha-checkbox"><input type="checkbox" name="data_exata" value="1" ${intervencao.data_exata ? "checked" : ""}> Data exata</label>
                    <label>Valor a receber<input name="valor_receber" type="number" step="0.01" min="0" value="${escapeHtml(intervencao.valor_receber || 0)}"></label>
                    <label>Contato cliente<input name="contato_cliente_em" type="date" value="${escapeHtml(intervencao.contato_cliente_em || "")}"></label>
                    <label class="campo-largo">Observações<textarea name="observacoes">${escapeHtml(intervencao.observacoes || "")}</textarea></label>
                </div>
                <div class="card-acoes"><span>Receber ${formatMoeda(previsto)} | Gastos ${formatMoeda(gastos + rateios)}</span><button type="submit">Salvar intervenção</button></div>
            </form>
            <div class="subgrid">
                <section>
                    <h4>Atividades</h4>
                    <div class="chips-lista">
                        ${atividades.length ? atividades.map(renderAtividade).join("") : `<span class="vazio compacto">Nenhuma atividade.</span>`}
                    </div>
                    <form class="nova-atividade-form mini-form" data-intervencao-id="${intervencao.id}">
                        <select name="atividade">${opcoesSelect(opcoesAtividade, opcoesAtividade[0]?.[0] || "rocada")}</select>
                        <input name="valor_previsto" type="number" step="0.01" min="0" placeholder="Valor">
                        <button type="submit">Adicionar</button>
                    </form>
                </section>
                <section>
                    <h4>Gastos e recebimentos</h4>
                    <div class="lista-mini">
                        ${lancamentos.length ? lancamentos.map((l) => `<span>${escapeHtml(formatStatus(l.categoria))}: ${formatMoeda(l.valor)} - ${escapeHtml(l.descricao)}</span>`).join("") : `<span class="vazio compacto">Sem lançamentos.</span>`}
                        ${insumosUsados.length ? insumosUsados.map((i) => `<span>Insumo rateado: ${escapeHtml(i.nome)} ${escapeHtml(i.quantidade_usada)} ${escapeHtml(i.unidade)} = ${formatMoeda(i.valor_rateado)}</span>`).join("") : ""}
                    </div>
                    <form class="novo-lancamento-form mini-form" data-intervencao-id="${intervencao.id}">
                        <select name="tipo"><option value="gasto">Gasto</option><option value="recebimento">Recebimento</option></select>
                        <select name="categoria">${opcoesSelect(opcoesConfig("categoria_lancamento", CATEGORIAS_LANCAMENTO).filter(([valor]) => valor !== "recebimento"), "combustivel")}</select>
                        <input name="descricao" placeholder="Descrição" required>
                        <input name="valor" type="number" step="0.01" min="0" placeholder="Valor" required>
                        <button type="submit">Lancar</button>
                    </form>
                    <form class="novo-insumo-form mini-form" data-intervencao-id="${intervencao.id}">
                        <input name="nome" placeholder="Insumo usado">
                        <select name="unidade">${opcoesSelect(opcoesConfig("unidade_insumo", UNIDADES_INSUMO), "kg")}</select>
                        <input name="quantidade_usada" type="number" step="0.001" min="0" placeholder="Usado">
                        <input name="quantidade_total_compra" type="number" step="0.001" min="0" placeholder="Total compra">
                        <input name="valor_total_compra" type="number" step="0.01" min="0" placeholder="Valor compra">
                        <button type="submit">Ratear</button>
                    </form>
                </section>
            </div>
                </div>
            </details>
        </article>
    `;
}

function renderPropostasELinksProjeto(projeto) {
    const propostas = cache.propostas.filter((item) => item.projeto_id === projeto.id);
    const links = cache.projetoLinks.filter((item) => item.projeto_id === projeto.id);
    const proximaVersao = Math.max(0, ...propostas.map((item) => Number(item.versao || 0))) + 1;
    return `
        <section class="propostas-links-projeto">
            <div class="painel-topo compacto">
                <div>
                    <h3>Propostas e arquivos</h3>
                    <p class="subtexto">Versões enviadas ao cliente e referências do Google Drive.</p>
                </div>
                <span>${propostas.length} proposta(s) · ${links.length} link(s)</span>
            </div>
            <div class="propostas-links-grade">
                <section>
                    <h4>Propostas comerciais</h4>
                    <form class="nova-proposta-form mini-form proposta-nova-form" data-projeto-id="${projeto.id}">
                        <input name="versao" type="number" min="1" value="${proximaVersao}" aria-label="Versão da proposta" required>
                        <input name="data_envio" type="date" aria-label="Data de envio">
                        <select name="status">${opcoesSelect(PROPOSTA_STATUS, "rascunho")}</select>
                        <button type="submit">Nova proposta</button>
                    </form>
                    <div class="lista-propostas">
                        ${propostas.length ? propostas.map(renderPropostaCard).join("") : `<p class="vazio compacto">Nenhuma proposta cadastrada.</p>`}
                    </div>
                </section>
                <section>
                    <h4>Drive e documentos</h4>
                    <form class="novo-projeto-link-form mini-form projeto-link-form" data-projeto-id="${projeto.id}">
                        <select name="tipo">${opcoesSelect(TIPOS_LINK_PROJETO, "pasta_drive")}</select>
                        <input name="titulo" placeholder="Ex.: Pasta do projeto" required>
                        <input name="url" type="url" placeholder="https://drive.google.com/..." required>
                        <button type="submit">Adicionar</button>
                    </form>
                    <div class="lista-mini lista-links-projeto">
                        ${links.length ? links.map(renderProjetoLink).join("") : `<span class="vazio compacto">Nenhum link cadastrado.</span>`}
                    </div>
                </section>
            </div>
        </section>
    `;
}

function renderPropostaCard(proposta) {
    const itens = cache.propostaItens.filter((item) => item.proposta_id === proposta.id);
    const linkDocumento = safeExternalUrl(proposta.link_documento);
    return `
        <details class="proposta-card">
            <summary>
                <span><strong>Proposta ${escapeHtml(proposta.versao)}</strong><small>${escapeHtml(formatStatus(proposta.status))} · ${escapeHtml(formatData(proposta.data_envio))}</small></span>
                <b>${formatMoeda(proposta.valor_total)}</b>
            </summary>
            <form class="proposta-form proposta-form-grid" data-id="${proposta.id}">
                <label>Versão<input name="versao" type="number" min="1" value="${escapeHtml(proposta.versao)}" required></label>
                <label>Data de envio<input name="data_envio" type="date" value="${escapeHtml(proposta.data_envio || "")}"></label>
                <label>Status<select name="status">${opcoesSelect(PROPOSTA_STATUS, proposta.status)}</select></label>
                <label class="campo-largo">Link do documento<input name="link_documento" type="url" value="${escapeHtml(proposta.link_documento || "")}" placeholder="https://drive.google.com/..."></label>
                <label class="campo-largo">Observações<textarea name="observacoes">${escapeHtml(proposta.observacoes || "")}</textarea></label>
                <div class="card-acoes"><span>${itens.length} item(ns) · ${linkDocumento ? `<a href="${escapeHtml(linkDocumento)}" target="_blank" rel="noopener">Abrir documento</a>` : "Sem documento vinculado"}</span><button type="submit">Salvar proposta</button></div>
            </form>
            <div class="itens-proposta">
                <h5>Itens e valores</h5>
                <div class="tabela-itens-proposta">
                    ${itens.length ? itens.map((item) => `<span>${escapeHtml(item.descricao)} · ${escapeHtml(item.quantidade)} ${escapeHtml(item.unidade)} × ${formatMoeda(item.valor_unitario)} <b>${formatMoeda(item.valor_total)}</b></span>`).join("") : `<span class="vazio compacto">Nenhum item cadastrado.</span>`}
                </div>
                <form class="novo-proposta-item-form mini-form proposta-item-form" data-proposta-id="${proposta.id}">
                    <input name="descricao" placeholder="Atividade ou serviço" required>
                    <input name="quantidade" type="number" min="0.001" step="0.001" value="1" required>
                    <input name="unidade" value="un" required>
                    <input name="valor_unitario" type="number" min="0" step="0.01" placeholder="Valor unitário" required>
                    <button type="submit">Adicionar item</button>
                </form>
            </div>
        </details>
    `;
}

function renderProjetoLink(link) {
    const url = safeExternalUrl(link.url);
    if (!url) return "";
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener"><strong>${escapeHtml(link.titulo)}</strong><small>${escapeHtml(formatStatus(link.tipo))}</small></a>`;
}

function renderAtividade(atividade) {
    return `
        <label class="chip-check">
            <input class="atividade-check" type="checkbox" data-id="${atividade.id}" ${atividade.concluida ? "checked" : ""}>
            <span>${escapeHtml(formatStatus(atividade.atividade))}${Number(atividade.valor_previsto || 0) ? ` - ${formatMoeda(atividade.valor_previsto)}` : ""}</span>
        </label>
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

async function criarIntervencao(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target).entries());
    const payload = {
        projeto_id: Number(event.target.dataset.projetoId),
        tipo: dados.tipo || "manutencao",
        titulo: dados.titulo,
        status: "prevista",
        data_prevista: dados.data_prevista || null,
        data_exata: Boolean(dados.data_exata),
        valor_receber: Number(dados.valor_receber || 0),
    };
    const { error } = await supabase.from("intervencoes").insert(payload);
    if (error) return setMensagem(error.message, "erro");
    setMensagem("Intervencao criada.");
    await render();
}

async function salvarIntervencao(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target).entries());
    const payload = {
        titulo: dados.titulo,
        status: dados.status || "prevista",
        data_prevista: dados.data_prevista || null,
        data_exata: Boolean(dados.data_exata),
        valor_receber: Number(dados.valor_receber || 0),
        contato_cliente_em: dados.contato_cliente_em || null,
        observacoes: dados.observacoes || null,
    };
    const { error } = await supabase.from("intervencoes").update(payload).eq("id", event.target.dataset.id);
    if (error) return setMensagem(error.message, "erro");
    setMensagem("Intervencao salva.");
    await render();
}

async function criarAtividade(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target).entries());
    const opcoesAtividade = opcoesConfig("atividade", ATIVIDADES_MANUTENCAO);
    const payload = {
        intervencao_id: Number(event.target.dataset.intervencaoId),
        atividade: dados.atividade || opcoesAtividade[0]?.[0] || "rocada",
        valor_previsto: Number(dados.valor_previsto || 0),
    };
    const { error } = await supabase.from("intervencao_atividades").insert(payload);
    if (error) return setMensagem(error.message, "erro");
    setMensagem("Atividade adicionada.");
    await render();
}

async function alternarAtividade(event) {
    const { error } = await supabase
        .from("intervencao_atividades")
        .update({ concluida: event.target.checked })
        .eq("id", event.target.dataset.id);
    if (error) return setMensagem(error.message, "erro");
    setMensagem("Atividade atualizada.");
}

async function criarLancamento(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target).entries());
    const categoriasGasto = opcoesConfig("categoria_lancamento", CATEGORIAS_LANCAMENTO).filter(([valor]) => valor !== "recebimento");
    const payload = {
        intervencao_id: Number(event.target.dataset.intervencaoId),
        tipo: dados.tipo || "gasto",
        categoria: dados.tipo === "recebimento" ? "recebimento" : (dados.categoria || categoriasGasto[0]?.[0] || "combustivel"),
        descricao: dados.descricao,
        valor: Number(dados.valor || 0),
        data_lancamento: new Date().toISOString().slice(0, 10),
    };
    const { error } = await supabase.from("intervencao_lancamentos").insert(payload);
    if (error) return setMensagem(error.message, "erro");
    setMensagem("Lancamento criado.");
    await render();
}

async function criarInsumoUsado(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target).entries());
    if (!dados.nome || !dados.quantidade_usada || !dados.quantidade_total_compra || !dados.valor_total_compra) {
        return setMensagem("Informe nome, quantidade usada, total da compra e valor da compra para ratear.", "erro");
    }
    const payload = {
        intervencao_id: Number(event.target.dataset.intervencaoId),
        nome: dados.nome,
        unidade: dados.unidade || "un",
        quantidade_usada: Number(dados.quantidade_usada || 0),
        quantidade_total_compra: Number(dados.quantidade_total_compra || 0),
        valor_total_compra: Number(dados.valor_total_compra || 0),
        compra_exclusiva: false,
    };
    const { error } = await supabase.from("intervencao_insumos").insert(payload);
    if (error) return setMensagem(error.message, "erro");
    setMensagem("Insumo rateado.");
    await render();
}

async function criarProposta(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target).entries());
    const payload = {
        projeto_id: Number(event.target.dataset.projetoId),
        versao: Number(dados.versao),
        data_envio: dados.data_envio || null,
        status: dados.status || "rascunho",
    };
    const { error } = await supabase.from("propostas").insert(payload);
    if (error) return setMensagem(error.message, "erro");
    setMensagem("Proposta criada.");
    await render();
}

async function salvarProposta(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target).entries());
    const linkDocumento = dados.link_documento ? safeExternalUrl(dados.link_documento) : "";
    if (dados.link_documento && !linkDocumento) {
        return setMensagem("Informe um link válido com http ou https.", "erro");
    }
    const payload = {
        versao: Number(dados.versao),
        data_envio: dados.data_envio || null,
        status: dados.status || "rascunho",
        link_documento: linkDocumento || null,
        observacoes: dados.observacoes || null,
    };
    const { error } = await supabase.from("propostas").update(payload).eq("id", event.target.dataset.id);
    if (error) return setMensagem(error.message, "erro");
    setMensagem("Proposta salva.");
    await render();
}

async function criarPropostaItem(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target).entries());
    const payload = {
        proposta_id: Number(event.target.dataset.propostaId),
        descricao: dados.descricao,
        quantidade: Number(dados.quantidade),
        unidade: dados.unidade,
        valor_unitario: Number(dados.valor_unitario),
    };
    const { error } = await supabase.from("proposta_itens").insert(payload);
    if (error) return setMensagem(error.message, "erro");
    setMensagem("Item adicionado à proposta.");
    await render();
}

async function criarProjetoLink(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target).entries());
    const url = safeExternalUrl(dados.url);
    if (!url) return setMensagem("Informe um link válido com http ou https.", "erro");
    const payload = {
        projeto_id: Number(event.target.dataset.projetoId),
        tipo: dados.tipo,
        titulo: dados.titulo.trim(),
        url,
    };
    const { error } = await supabase.from("projeto_links").insert(payload);
    if (error) return setMensagem(error.message, "erro");
    setMensagem("Link adicionado ao projeto.");
    await render();
}

function renderCalendario() {
    const params = new URLSearchParams(location.hash.split("?")[1] || "");
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    const mes = params.get("mes") || mesAtual;
    const inicio = dataPrimeiroDiaMes(mes);
    const fim = new Date(`${inicio}T12:00:00`);
    fim.setMonth(fim.getMonth() + 1);
    const fimIso = fim.toISOString().slice(0, 10);
    const itens = cache.intervencoes
        .filter((item) => item.data_prevista && item.data_prevista >= inicio && item.data_prevista < fimIso)
        .sort((a, b) => String(a.data_prevista).localeCompare(String(b.data_prevista)));
    const dias = montarDiasCalendario(mes, itens);

    setPage("Calendário", "Agenda de plantios e manutenções", `<a class="botao secundario" href="#projetos">Projetos</a>`);
    conteudo.innerHTML = `
        <form id="filtroCalendario" class="filtros">
            <label>Mês<input name="mes" type="month" value="${escapeHtml(mes)}"></label>
            <button type="submit">Ver agenda</button>
        </form>
        <section class="painel">
            <div class="painel-topo"><h2>Agenda de ${escapeHtml(mes)}</h2><span>${itens.length} intervenção(ões)</span></div>
            <div class="calendario-grade">
                ${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dia) => `<strong class="calendario-semana">${dia}</strong>`).join("")}
                ${dias.map(renderDiaCalendario).join("")}
            </div>
            <div class="agenda-lista">
                ${itens.length ? itens.map(renderAgendaItem).join("") : `<p class="vazio">Nenhum plantio ou manutenção previsto para este mês.</p>`}
            </div>
        </section>
        <dialog id="projetoModal" class="modal-projeto">
            <div id="projetoModalConteudo"></div>
        </dialog>
    `;
    $("#filtroCalendario").addEventListener("submit", (event) => {
        event.preventDefault();
        const form = new FormData(event.target);
        location.hash = `calendario?${new URLSearchParams(form).toString()}`;
    });
    document.querySelectorAll(".abrir-intervencao").forEach((botao) => {
        botao.addEventListener("click", () => {
            abrirProjetoModal(Number(botao.dataset.projetoId), Number(botao.dataset.intervencaoId));
        });
    });
}

function renderProspeccao() {
    const contatos = cache.prospeccaoContatos;
    const pendentes = contatos.filter((item) => item.status_reuniao !== "realizada" && item.status_reuniao !== "nao_interessado");
    setPage("Prospecção", "Clientes e contatos em desenvolvimento", `<a class="botao secundario" href="#projetos">Projetos</a>`);
    conteudo.innerHTML = `
        <section class="painel prospeccao-novo">
            <div class="painel-topo"><div><h2>Novo contato</h2><p class="subtexto">Cadastros manuais agora; importação do webscraping entra depois.</p></div><span>${contatos.length} contato(s)</span></div>
            <form id="novoContatoProspeccao" class="form-grid prospeccao-form-grid">
                <label>Nome fantasia<input name="nome_fantasia" placeholder="Ex.: Empresa Ambiental" required></label>
                <label>Razão social<input name="razao_social"></label>
                <label>CNPJ<input name="cnpj" inputmode="numeric"></label>
                <label>E-mail<input name="email" type="email"></label>
                <label>Telefones<input name="telefones" placeholder="(41) 99999-9999"></label>
                <label>Próxima ação<input name="proxima_acao_em" type="date"></label>
                <label>Status do e-mail<select name="status_email">${opcoesSelect(STATUS_EMAIL_PROSPECCAO, "pendente")}</select></label>
                <label>Status do WhatsApp<select name="status_whatsapp">${opcoesSelect(STATUS_WHATSAPP_PROSPECCAO, "pendente")}</select></label>
                <label>Status da reunião<select name="status_reuniao">${opcoesSelect(STATUS_REUNIAO_PROSPECCAO, "nao_agendada")}</select></label>
                <label class="campo-largo">Observações<textarea name="observacoes"></textarea></label>
                <div class="card-acoes campo-largo"><span>Os status ajudam a organizar e priorizar os próximos contatos.</span><button type="submit">Adicionar contato</button></div>
            </form>
        </section>
        <section class="painel lista-prospeccao-painel">
            <div class="painel-topo"><div><h2>Carteira de prospecção</h2><p class="subtexto">${pendentes.length} contato(s) ainda em acompanhamento.</p></div></div>
            <div class="lista-prospeccao">
                ${contatos.length ? contatos.map(renderContatoProspeccao).join("") : `<p class="vazio">Nenhum contato cadastrado.</p>`}
            </div>
        </section>
    `;
    $("#novoContatoProspeccao").addEventListener("submit", criarContatoProspeccao);
    document.querySelectorAll(".prospeccao-contato-form").forEach((form) => form.addEventListener("submit", salvarContatoProspeccao));
}

function renderContatoProspeccao(contato) {
    return `
        <details class="contato-prospeccao">
            <summary>
                <span><strong>${escapeHtml(contato.nome_fantasia)}</strong><small>${escapeHtml(contato.razao_social || contato.email || "Sem razão social")}</small></span>
                <em>${escapeHtml(formatStatus(contato.status_reuniao))}</em>
                <time>${escapeHtml(formatData(contato.proxima_acao_em))}</time>
            </summary>
            <form class="prospeccao-contato-form prospeccao-form-grid" data-id="${contato.id}">
                <label>Nome fantasia<input name="nome_fantasia" value="${escapeHtml(contato.nome_fantasia)}" required></label>
                <label>Razão social<input name="razao_social" value="${escapeHtml(contato.razao_social || "")}"></label>
                <label>CNPJ<input name="cnpj" value="${escapeHtml(contato.cnpj || "")}"></label>
                <label>E-mail<input name="email" type="email" value="${escapeHtml(contato.email || "")}"></label>
                <label>Telefones<input name="telefones" value="${escapeHtml(contato.telefones || "")}"></label>
                <label>Próxima ação<input name="proxima_acao_em" type="date" value="${escapeHtml(contato.proxima_acao_em || "")}"></label>
                <label>Status do e-mail<select name="status_email">${opcoesSelect(STATUS_EMAIL_PROSPECCAO, contato.status_email)}</select></label>
                <label>Status do WhatsApp<select name="status_whatsapp">${opcoesSelect(STATUS_WHATSAPP_PROSPECCAO, contato.status_whatsapp)}</select></label>
                <label>Status da reunião<select name="status_reuniao">${opcoesSelect(STATUS_REUNIAO_PROSPECCAO, contato.status_reuniao)}</select></label>
                <label class="campo-largo">Observações<textarea name="observacoes">${escapeHtml(contato.observacoes || "")}</textarea></label>
                <div class="card-acoes campo-largo"><span>Atualizado em ${escapeHtml(formatDataHora(contato.atualizado_em))}</span><button type="submit">Salvar contato</button></div>
            </form>
        </details>
    `;
}

function dadosContatoProspeccao(dados) {
    return {
        nome_fantasia: dados.nome_fantasia.trim(),
        razao_social: dados.razao_social?.trim() || null,
        cnpj: dados.cnpj?.trim() || null,
        email: dados.email?.trim() || null,
        telefones: dados.telefones?.trim() || null,
        status_email: dados.status_email || "pendente",
        status_whatsapp: dados.status_whatsapp || "pendente",
        status_reuniao: dados.status_reuniao || "nao_agendada",
        proxima_acao_em: dados.proxima_acao_em || null,
        observacoes: dados.observacoes?.trim() || null,
    };
}

async function criarContatoProspeccao(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target).entries());
    const { error } = await supabase.from("prospeccao_contatos").insert(dadosContatoProspeccao(dados));
    if (error) return setMensagem(error.message, "erro");
    setMensagem("Contato adicionado à prospecção.");
    await render();
}

async function salvarContatoProspeccao(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target).entries());
    const { error } = await supabase.from("prospeccao_contatos").update(dadosContatoProspeccao(dados)).eq("id", event.target.dataset.id);
    if (error) return setMensagem(error.message, "erro");
    setMensagem("Contato salvo.");
    await render();
}

function nomePerfilUsuario(usuario = session?.user) {
    return (usuario?.user_metadata?.display_name || usuario?.email || "Usuário").trim();
}

function avatarPerfilUsuario(usuario = session?.user) {
    return safeExternalUrl(usuario?.user_metadata?.avatar_url);
}

function atualizarAvatarTopo() {
    const avatarTopo = $("#avatarTopo");
    if (!avatarTopo || !session?.user) return;
    const nome = nomePerfilUsuario(session.user);
    const avatar = avatarPerfilUsuario(session.user);
    avatarTopo.innerHTML = avatar
        ? `<img src="${escapeHtml(avatar)}" alt="">`
        : escapeHtml(iniciaisPerfil(nome));
    const usuarioAtual = $("#usuarioAtual");
    const nomeContaMenu = $("#nomeContaMenu");
    const emailContaMenu = $("#emailContaMenu");
    if (usuarioAtual) usuarioAtual.textContent = nome;
    if (nomeContaMenu) nomeContaMenu.textContent = nome;
    if (emailContaMenu) emailContaMenu.textContent = session.user.email || "";
    $("#menuContaBtn")?.setAttribute("aria-label", `Abrir menu de ${nome}`);
}

function iniciaisPerfil(nome) {
    return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase() || "R";
}

function renderPerfil() {
    const usuario = session?.user;
    const nome = nomePerfilUsuario(usuario);
    const avatar = avatarPerfilUsuario(usuario);
    setPage("Perfil", "Dados da sua conta", `<a class="botao secundario" href="#dashboard">Início</a>`);
    conteudo.innerHTML = `
        <section class="perfil-layout">
            <article class="painel perfil-resumo">
                <div class="avatar-perfil ${avatar ? "com-imagem" : ""}">${avatar ? `<img src="${escapeHtml(avatar)}" alt="Avatar de ${escapeHtml(nome)}">` : `<span>${escapeHtml(iniciaisPerfil(nome))}</span>`}</div>
                <div><h2>${escapeHtml(nome)}</h2><p>${escapeHtml(usuario?.email || "")}</p></div>
            </article>
            <article class="painel perfil-card">
                <div class="painel-topo"><h2>Apresentação</h2></div>
                <form id="perfilDadosForm" class="form-grid">
                    <label>Nome de apresentação<input name="display_name" value="${escapeHtml(usuario?.user_metadata?.display_name || "")}" placeholder="Como aparecer no portal"></label>
                    <label>Link do avatar<input name="avatar_url" type="url" value="${escapeHtml(usuario?.user_metadata?.avatar_url || "")}" placeholder="https://..."></label>
                    <label class="avatar-upload">Foto do computador<span class="botao secundario">Escolher foto</span><input name="avatar_file" type="file" accept="image/jpeg,image/png,image/webp"></label>
                    <div class="card-acoes campo-largo"><span></span><button type="submit">Salvar perfil</button></div>
                </form>
            </article>
            <article class="painel perfil-card">
                <div class="painel-topo"><h2>E-mail</h2></div>
                <form id="perfilEmailForm" class="form-grid">
                    <label>E-mail cadastrado<input value="${escapeHtml(usuario?.email || "")}" disabled></label>
                    <label>Novo e-mail<input name="email" type="email" required></label>
                    <div class="card-acoes campo-largo"><span></span><button type="submit">Atualizar e-mail</button></div>
                </form>
            </article>
            <article class="painel perfil-card">
                <div class="painel-topo"><h2>Senha</h2></div>
                <form id="perfilSenhaForm" class="form-grid">
                    <label>Nova senha<input name="senha" type="password" autocomplete="new-password" minlength="6" required></label>
                    <label>Confirmar nova senha<input name="confirmacao" type="password" autocomplete="new-password" minlength="6" required></label>
                    <div class="card-acoes campo-largo"><span></span><button type="submit">Atualizar senha</button></div>
                </form>
            </article>
        </section>
    `;
    $("#perfilDadosForm").addEventListener("submit", salvarPerfilDados);
    $("#perfilEmailForm").addEventListener("submit", atualizarPerfilEmail);
    $("#perfilSenhaForm").addEventListener("submit", atualizarPerfilSenha);
}

async function salvarPerfilDados(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target).entries());
    const arquivo = event.target.querySelector('[name="avatar_file"]')?.files?.[0];
    let avatarUrl = dados.avatar_url ? safeExternalUrl(dados.avatar_url) : "";
    if (dados.avatar_url && !avatarUrl) return setMensagem("Informe um link de avatar válido com http ou https.", "erro");
    if (arquivo) {
        const tiposAceitos = ["image/jpeg", "image/png", "image/webp"];
        if (!tiposAceitos.includes(arquivo.type)) return setMensagem("Escolha uma imagem JPG, PNG ou WebP.", "erro");
        if (arquivo.size > 2 * 1024 * 1024) return setMensagem("A imagem deve ter no máximo 2 MB.", "erro");
        const caminho = `${session.user.id}/avatar`;
        const { error: erroUpload } = await supabase.storage.from("portal-avatars").upload(caminho, arquivo, {
            upsert: true,
            contentType: arquivo.type,
            cacheControl: "3600",
        });
        if (erroUpload) return setMensagem(erroUpload.message, "erro");
        const { data: urlPublica } = supabase.storage.from("portal-avatars").getPublicUrl(caminho);
        avatarUrl = `${urlPublica.publicUrl}?v=${Date.now()}`;
    }
    const { data, error } = await supabase.auth.updateUser({
        data: {
            ...(session?.user?.user_metadata || {}),
            display_name: dados.display_name.trim(),
            avatar_url: avatarUrl || null,
        },
    });
    if (error) return setMensagem(error.message, "erro");
    if (data.user && session) session = { ...session, user: data.user };
    $("#usuarioAtual").textContent = nomePerfilUsuario();
    await render();
    setMensagem("Perfil atualizado.");
}

async function atualizarPerfilEmail(event) {
    event.preventDefault();
    const email = new FormData(event.target).get("email").trim();
    const { error } = await supabase.auth.updateUser({ email });
    if (error) return setMensagem(error.message, "erro");
    setMensagem("Solicitação de alteração de e-mail enviada para confirmação.");
    event.target.reset();
}

async function atualizarPerfilSenha(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target).entries());
    if (dados.senha !== dados.confirmacao) return setMensagem("As duas senhas não coincidem.", "erro");
    const { error } = await supabase.auth.updateUser({ password: dados.senha });
    if (error) return setMensagem(error.message, "erro");
    setMensagem("Senha atualizada.");
    event.target.reset();
}

function renderAgendaItem(item) {
    const projeto = item.projetos || {};
    return `
        <article class="agenda-item">
            <time>${escapeHtml(formatData(item.data_prevista, item.data_exata))}</time>
            <div>
                <strong>${escapeHtml(item.titulo)}</strong>
                <span>${escapeHtml(projeto.nome || "Projeto")} - ${escapeHtml(projeto.cliente || "Cliente não informado")}</span>
            </div>
            <em>${escapeHtml(formatStatus(item.status))}</em>
            <button class="botao secundario abrir-intervencao" type="button" data-projeto-id="${item.projeto_id}" data-intervencao-id="${item.id}">Abrir</button>
        </article>
    `;
}

function montarDiasCalendario(mes, itens) {
    const [ano, mesNumero] = mes.split("-").map(Number);
    const primeiroDia = new Date(ano, mesNumero - 1, 1);
    const ultimoDia = new Date(ano, mesNumero, 0);
    const totalDias = ultimoDia.getDate();
    const offset = primeiroDia.getDay();
    const dias = [];
    for (let i = 0; i < offset; i += 1) dias.push({ vazio: true });
    for (let dia = 1; dia <= totalDias; dia += 1) {
        const data = `${ano}-${String(mesNumero).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
        dias.push({ data, dia, itens: itens.filter((item) => item.data_prevista === data) });
    }
    while (dias.length % 7 !== 0) dias.push({ vazio: true });
    return dias;
}

function renderDiaCalendario(dia) {
    if (dia.vazio) return `<div class="calendario-dia vazio-dia"></div>`;
    return `
        <div class="calendario-dia ${dia.itens.length ? "com-evento" : ""}">
            <span class="numero-dia">${dia.dia}</span>
            <div class="eventos-dia">
                ${dia.itens.map(renderEventoCalendario).join("")}
            </div>
        </div>
    `;
}

function renderEventoCalendario(item) {
    const projeto = item.projetos || {};
    return `
        <button class="evento-calendario abrir-intervencao" type="button" data-projeto-id="${item.projeto_id}" data-intervencao-id="${item.id}">
            <strong>${escapeHtml(item.titulo)}</strong>
            <span>${escapeHtml(projeto.nome || "Projeto")}</span>
        </button>
    `;
}

function renderHistoricoItem(item) {
    return `
        <article class="historico-item">
            <div>
                <strong>${escapeHtml(item.resumo)}</strong>
                <span>${escapeHtml(item.usuario_email || "sistema")} · ${escapeHtml(formatDataHora(item.criado_em))}</span>
            </div>
            ${renderAlteracoesHistorico(item.alteracoes)}
        </article>
    `;
}

function renderAlteracoesHistorico(alteracoes) {
    const entries = Object.entries(alteracoes || {});
    if (!entries.length) return "";
    return `
        <ul>
            ${entries.slice(0, 8).map(([campo, valores]) => `
                <li><span>${escapeHtml(formatCampoHistorico(campo))}</span><em>${escapeHtml(valorHistorico(valores?.antes))} → ${escapeHtml(valorHistorico(valores?.depois))}</em></li>
            `).join("")}
        </ul>
    `;
}

function formatCampoHistorico(campo) {
    const nomes = {
        nome: "Nome",
        cliente: "Cliente",
        local: "Local",
        status: "Status",
        responsavel: "Responsável",
        data_inicio: "Início",
        prazo: "Prazo",
        valor_estimado: "Valor estimado",
        descricao: "Descrição",
        observacoes: "Observações",
        titulo: "Título",
        data_prevista: "Data prevista",
        data_exata: "Data exata",
        valor_receber: "Valor a receber",
        contato_cliente_em: "Contato cliente",
        concluida: "Concluída",
        atividade: "Atividade",
        categoria: "Categoria",
        valor: "Valor",
        quantidade_usada: "Quantidade usada",
        valor_total_compra: "Valor da compra",
    };
    return nomes[campo] || formatStatus(campo);
}

function valorHistorico(valor) {
    if (valor === null || valor === undefined) return "vazio";
    if (typeof valor === "boolean") return valor ? "sim" : "não";
    if (typeof valor === "object") return JSON.stringify(valor);
    return String(valor);
}

function formatDataHora(valor) {
    if (!valor) return "";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return valor;
    return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function renderLicitacoes() {
    setPage("Licitações", "Radar PRAD e serviços ambientais", `<a class="botao" href="#regras">Regras PRAD</a>`);
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

function renderConfiguracoes() {
    setPage("Configurações", "Cadastros usados nos formulários", `<a class="botao secundario" href="#projetos">Projetos</a>`);
    const grupos = [
        ["atividade", "Atividades de manutenção", "Ex.: irrigação, poda, tutoramento"],
        ["categoria_lancamento", "Categorias financeiras", "Ex.: pedágio, hospedagem, frete"],
        ["unidade_insumo", "Unidades de insumo", "Ex.: saco, bandeja, m³"],
    ];

    conteudo.innerHTML = `
        <section class="grid-configuracoes">
            ${grupos.map(([tipo, titulo, placeholder]) => renderGrupoConfiguracao(tipo, titulo, placeholder)).join("")}
        </section>
        ${renderConfiguracaoAlertas()}
    `;
    document.querySelectorAll(".config-opcoes-form").forEach((form) => form.addEventListener("submit", salvarOpcoesConfiguracao));
    document.querySelectorAll(".nova-opcao-form").forEach((form) => form.addEventListener("submit", criarOpcaoConfiguracao));
    $("#configuracaoAlertasForm")?.addEventListener("submit", salvarConfiguracaoAlertas);
}

function renderConfiguracaoAlertas() {
    const confirmacao = configuracaoAlerta("confirmacao_manutencao") || { ativo: true, dias_antecedencia: 7 };
    return `
        <section class="painel configuracao-alertas">
            <div class="painel-topo"><div><h2>Alertas operacionais</h2><p class="subtexto">Avisos exibidos no painel para confirmar manutenções com o cliente.</p></div></div>
            <form id="configuracaoAlertasForm" class="mini-form configuracao-alertas-form">
                <label class="checkbox linha-checkbox"><input name="ativo" type="checkbox" ${confirmacao.ativo ? "checked" : ""}> Ativar alerta de confirmação</label>
                <label>Dias de antecedência<input name="dias_antecedencia" type="number" min="0" max="90" value="${escapeHtml(confirmacao.dias_antecedencia)}" required></label>
                <button type="submit">Salvar alertas</button>
            </form>
        </section>
    `;
}

function renderGrupoConfiguracao(tipo, titulo, placeholder) {
    const opcoes = cache.opcoes
        .filter((opcao) => opcao.tipo === tipo)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || String(a.rotulo).localeCompare(String(b.rotulo)));
    return `
        <article class="painel config-card">
            <div class="painel-topo"><h2>${escapeHtml(titulo)}</h2><span>${opcoes.filter((opcao) => opcao.ativo).length} ativos</span></div>
            <form class="config-opcoes-form" data-tipo="${tipo}">
                <div class="tabela-wrap">
                    <table>
                        <thead><tr><th>Ativo</th><th>Nome</th><th>Código</th><th>Ordem</th></tr></thead>
                        <tbody>
                            ${opcoes.map(renderOpcaoConfiguracao).join("") || `<tr><td colspan="4" class="vazio">Nenhum item cadastrado.</td></tr>`}
                        </tbody>
                    </table>
                </div>
                <div class="card-acoes" style="margin-top: .7rem;"><button type="submit">Salvar ${escapeHtml(titulo.toLowerCase())}</button></div>
            </form>
            <form class="nova-opcao-form mini-form config-nova-form" data-tipo="${tipo}">
                <input name="rotulo" placeholder="${escapeHtml(placeholder)}" required>
                <button type="submit">Adicionar</button>
            </form>
        </article>
    `;
}

function renderOpcaoConfiguracao(opcao) {
    return `
        <tr data-id="${opcao.id}">
            <td><input type="checkbox" name="ativo" ${opcao.ativo ? "checked" : ""}></td>
            <td><input name="rotulo" value="${escapeHtml(opcao.rotulo)}" required></td>
            <td><input name="valor" value="${escapeHtml(opcao.valor)}" required></td>
            <td><input name="ordem" type="number" value="${escapeHtml(opcao.ordem || 0)}"></td>
        </tr>
    `;
}

async function salvarOpcoesConfiguracao(event) {
    event.preventDefault();
    const rows = [...event.target.querySelectorAll("tbody tr[data-id]")];
    for (const row of rows) {
        const payload = {
            ativo: row.querySelector('[name="ativo"]').checked,
            rotulo: row.querySelector('[name="rotulo"]').value.trim(),
            valor: slugOpcao(row.querySelector('[name="valor"]').value) || slugOpcao(row.querySelector('[name="rotulo"]').value),
            ordem: Number(row.querySelector('[name="ordem"]').value || 0),
        };
        const { error } = await supabase.from("configuracoes_opcoes").update(payload).eq("id", row.dataset.id);
        if (error) return setMensagem(error.message, "erro");
    }
    setMensagem("Configurações salvas.");
    await render();
}

async function criarOpcaoConfiguracao(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target).entries());
    const rotulo = (dados.rotulo || "").trim();
    const valor = slugOpcao(rotulo);
    if (!rotulo || !valor) return setMensagem("Informe um nome válido.", "erro");
    const existentes = cache.opcoes.filter((opcao) => opcao.tipo === event.target.dataset.tipo);
    const payload = {
        tipo: event.target.dataset.tipo,
        rotulo,
        valor,
        ativo: true,
        ordem: Math.max(0, ...existentes.map((opcao) => Number(opcao.ordem || 0))) + 10,
    };
    const { error } = await supabase.from("configuracoes_opcoes").insert(payload);
    if (error) return setMensagem(error.message, "erro");
    setMensagem("Item adicionado.");
    await render();
}

async function salvarConfiguracaoAlertas(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target).entries());
    const payload = {
        chave: "confirmacao_manutencao",
        ativo: Boolean(dados.ativo),
        dias_antecedencia: Number(dados.dias_antecedencia),
    };
    const { error } = await supabase.from("configuracoes_alertas").upsert(payload, { onConflict: "chave" });
    if (error) return setMensagem(error.message, "erro");
    setMensagem("Alertas salvos.");
    await render();
}

function renderOportunidadeCard(o) {
    const url = safeExternalUrl(o.url);
    const titulo = escapeHtml(o.titulo);
    const tituloHtml = url
        ? `<a class="titulo" href="${escapeHtml(url)}" target="_blank" rel="noopener">${titulo}</a>`
        : `<span class="titulo">${titulo}</span>`;

    return `
        <div class="card prioridade-card-${escapeHtml(o.prioridade_prad || "irrelevante")} status-${escapeHtml(o.status)}">
            <div class="card-topo">
                <span class="fonte-badge">${escapeHtml(o.fonte_nome)}</span>
                ${o.prioridade_prad && o.prioridade_prad !== "irrelevante" ? `<span class="prad-badge prioridade-${escapeHtml(o.prioridade_prad)}">PRAD ${escapeHtml(o.prioridade_prad)} · ${o.pontuacao_prad || 0}</span>` : ""}
                <span class="data">encontrado em ${escapeHtml(o.data_encontrado || "")}</span>
            </div>
            ${tituloHtml}
            ${o.descricao ? `<p class="descricao">${escapeHtml(o.descricao)}</p>` : ""}
            ${o.motivos_prad ? `<p class="motivos">Sinais: ${escapeHtml(o.motivos_prad)}</p>` : ""}
            ${o.data_publicacao ? `<p class="pub">Publicado: ${escapeHtml(o.data_publicacao)}</p>` : ""}
            <form class="form-status oportunidade-form" data-id="${o.id}">
                <select name="status">${opcoesTexto(STATUS_OPCOES, o.status)}</select>
                <textarea name="observacoes" placeholder="Observações...">${escapeHtml(o.observacoes || "")}</textarea>
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
    setPage("Regras PRAD", "Sinais de classificação", `<a class="botao secundario" href="#licitacoes">Voltar ao radar</a>`);
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
        atualizarAvatarTopo();
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

$("#menuContaBtn").addEventListener("click", () => {
    const menu = $("#menuConta");
    const aberto = !menu.hidden;
    menu.hidden = aberto;
    $("#menuContaBtn").setAttribute("aria-expanded", String(!aberto));
});

document.addEventListener("click", (event) => {
    const contaMenu = document.querySelector(".conta-menu");
    const menu = $("#menuConta");
    if (!contaMenu?.contains(event.target) && menu && !menu.hidden) {
        menu.hidden = true;
        $("#menuContaBtn").setAttribute("aria-expanded", "false");
    }
});

window.addEventListener("hashchange", render);
iniciar();
