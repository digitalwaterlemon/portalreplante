import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { safeExternalUrl } from "./url_safety.js";
import { decodificarOfx, lerOfx } from "./ofx.js";
import { ehExtratoMercadoPagoCsv, lerExtratoMercadoPagoCsv } from "./extrato_csv.js";

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
    opcoes: [],
    historico: [],
    propostas: [],
    propostaItens: [],
    projetoLinks: [],
    prospeccaoContatos: [],
    configuracoesAlertas: [],
    financeiroContas: [],
    financeiroCategorias: [],
    financeiroImportacoes: [],
    lancamentosProjetos: [],
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

// Data da intervencao, com o periodo quando o servico dura mais de um dia.
function formatPeriodo(item) {
    if (item.data_exata && item.data_fim && item.data_fim !== item.data_prevista) {
        return `${formatData(item.data_prevista)} a ${formatData(item.data_fim)}`;
    }
    return formatData(item.data_prevista, item.data_exata);
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

// Contato com o cliente antes de uma manutencao aberta: na "Data para contatar"
// (contato_cliente_em) ou, sem ela, na data prevista menos os dias de
// antecedencia configurados. Retorna null quando nao ha contato a acompanhar.
function contatoManutencao(item, hoje = dataIsoLocal(new Date())) {
    if (item.tipo !== "manutencao" || ["executada", "cancelada"].includes(item.status)) return null;
    const configuracao = configuracaoAlerta("confirmacao_manutencao") || { dias_antecedencia: 7 };
    const data = item.contato_cliente_em
        || (item.data_prevista ? subtrairDias(item.data_prevista, Number(configuracao.dias_antecedencia || 0)) : null);
    if (!data) return null;
    const situacao = item.contato_feito ? "feito" : data < hoje ? "atrasado" : "pendente";
    return { data, situacao };
}

function alertasConfirmacaoManutencao() {
    const configuracao = configuracaoAlerta("confirmacao_manutencao") || { ativo: true, dias_antecedencia: 7 };
    if (!configuracao?.ativo) return [];
    const hoje = dataIsoLocal(new Date());
    return intervencoesProjetosAtivos()
        .map((item) => ({ ...item, contato: contatoManutencao(item, hoje) }))
        .filter((item) => item.contato && item.contato.situacao !== "feito" && item.contato.data <= hoje)
        .sort((a, b) => a.contato.data.localeCompare(b.contato.data));
}

function buscarProjeto(id) {
    return cache.projetos.find((item) => item.id === id) || cache.projetosArquivados.find((item) => item.id === id);
}

// Plantios e manutencoes de projetos arquivados nao entram em agenda, alertas e indicadores.
function intervencoesProjetosAtivos() {
    const ativos = new Set(cache.projetos.map((p) => p.id));
    return cache.intervencoes.filter((item) => ativos.has(item.projeto_id));
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
    const [fontes, oportunidades, projetos, regras, intervencoes, atividades, opcoes, historico, propostas, propostaItens, projetoLinks, prospeccaoContatos, configuracoesAlertas, financeiroContas, financeiroCategorias, financeiroImportacoes] = await Promise.all([
        supabase.from("fontes").select("*").order("nome"),
        supabase.from("oportunidades").select("*, fontes(nome)").order("data_encontrado", { ascending: false }),
        supabase.from("projetos").select("*").order("atualizado_em", { ascending: false }),
        supabase.from("regras_prad").select("*").order("ordem").order("id"),
        supabase.from("intervencoes").select("*, projetos(nome, cliente, local)").order("data_prevista", { ascending: true }),
        supabase.from("intervencao_atividades").select("*").order("id"),
        supabase.from("configuracoes_opcoes").select("*").order("tipo").order("ordem").order("rotulo"),
        supabase.from("projeto_historico").select("*").order("criado_em", { ascending: false }).limit(300),
        supabase.from("propostas").select("*").order("versao", { ascending: false }),
        supabase.from("proposta_itens").select("*").order("id"),
        supabase.from("projeto_links").select("*").order("id", { ascending: false }),
        supabase.from("prospeccao_contatos").select("*").order("atualizado_em", { ascending: false }),
        supabase.from("configuracoes_alertas").select("*").order("chave"),
        supabase.from("financeiro_contas").select("*").order("id"),
        supabase.from("financeiro_categorias").select("*").order("ordem").order("nome"),
        supabase.from("financeiro_importacoes").select("*").order("criado_em", { ascending: false }),
    ]);

    for (const result of [fontes, oportunidades, projetos, regras, intervencoes, atividades, opcoes, historico, propostas, propostaItens, projetoLinks, prospeccaoContatos, configuracoesAlertas, financeiroContas, financeiroCategorias, financeiroImportacoes]) {
        if (result.error) throw result.error;
    }

    cache.fontes = fontes.data || [];
    cache.oportunidades = (oportunidades.data || []).map((row) => ({
        ...row,
        fonte_nome: row.fontes?.nome || "",
    }));
    cache.projetos = (projetos.data || []).filter((p) => !p.arquivado_em);
    cache.projetosArquivados = (projetos.data || []).filter((p) => p.arquivado_em);
    cache.regras = regras.data || [];
    cache.intervencoes = intervencoes.data || [];
    cache.atividades = atividades.data || [];
    cache.opcoes = opcoes.data || [];
    cache.historico = historico.data || [];
    cache.propostas = propostas.data || [];
    cache.propostaItens = propostaItens.data || [];
    cache.projetoLinks = projetoLinks.data || [];
    cache.prospeccaoContatos = prospeccaoContatos.data || [];
    cache.configuracoesAlertas = configuracoesAlertas.data || [];
    cache.financeiroContas = financeiroContas.data || [];
    cache.financeiroCategorias = financeiroCategorias.data || [];
    cache.financeiroImportacoes = financeiroImportacoes.data || [];
    cache.lancamentosProjetos = await buscarLancamentosProjetos();
    memoFinanceiroProjeto = new Map();
}

// Lancamentos do extrato vinculados a projetos (o Supabase devolve no maximo
// 1000 linhas por consulta).
async function buscarLancamentosProjetos() {
    const linhas = [];
    for (let inicio = 0; ; inicio += 1000) {
        const { data, error } = await supabase
            .from("financeiro_lancamentos")
            .select("id, data, descricao, valor, categoria_id, projeto_id, intervencao_id")
            .eq("destino", "projeto")
            .not("projeto_id", "is", null)
            .order("data")
            .order("id")
            .range(inicio, inicio + 999);
        if (error) throw error;
        linhas.push(...data);
        if (data.length < 1000) return linhas;
    }
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
        else if (rota === "financeiro") await renderFinanceiro();
        else renderDashboard();
    } catch (error) {
        console.error(error);
        setPage("Erro", "Não foi possível carregar");
        conteudo.innerHTML = `<p class="alerta">Não foi possível carregar os dados. Verifique login, permissão e conexão.</p>`;
    }
}

// Prospeccao e orcamento ainda nao sao contrato: ficam fora da analise financeira.
const STATUS_NEGOCIACAO = ["prospeccao", "orcamento"];
const STATUS_CONTRATO_ATIVO = ["contratado", "em_execucao", "monitoramento", "pausado"];

// valor_estimado do projeto e texto livre ("45000", "R$ 45.000", "45.000,50").
function valorNumero(texto) {
    let limpo = String(texto ?? "").replace(/[^\d,.-]/g, "");
    if (limpo.includes(",")) limpo = limpo.replaceAll(".", "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) limpo = limpo.replaceAll(".", "");
    const numero = Number(limpo);
    return Number.isFinite(numero) ? numero : 0;
}

function rotuloStatusProjeto(status) {
    return PROJETO_STATUS.find(([valor]) => valor === status)?.[1] || formatStatus(status);
}

function formatMoedaCompacta(valor) {
    const numero = Number(valor || 0);
    if (Math.abs(numero) >= 1000000) return `R$ ${(numero / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
    if (Math.abs(numero) >= 1000) return `R$ ${(numero / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
    return formatMoeda(numero);
}

function formatPercentual(valor) {
    return `${(valor * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// ---------------------------------------------------------------------------
// Financeiro por projeto: os lancamentos do extrato vinculados ao projeto sao
// distribuidos entre plantio e manutencoes pela data (ou pelo ajuste manual em
// financeiro_lancamentos.intervencao_id).

let memoFinanceiroProjeto = new Map();
const TOLERANCIA_TARIFA_RECEBIMENTO = 0.01;

function periodoIntervencao(intervencao) {
    if (!intervencao.data_prevista) return null;
    if (!intervencao.data_exata) {
        const [ano, mes] = intervencao.data_prevista.split("-").map(Number);
        return { inicio: `${intervencao.data_prevista.slice(0, 7)}-01`, fim: dataIsoLocal(new Date(ano, mes, 0)) };
    }
    const fim = intervencao.data_fim && intervencao.data_fim > intervencao.data_prevista ? intervencao.data_fim : intervencao.data_prevista;
    return { inicio: intervencao.data_prevista, fim };
}

// Saida: servico em andamento na data; senao o proximo (compras antecedem o
// servico); senao o ultimo. Entrada: em andamento; senao o ultimo ja feito (o
// cliente paga depois); senao o proximo.
function intervencaoAutomatica(lancamento, servicos) {
    const data = lancamento.data;
    const emAndamento = servicos.find((servico) => servico.periodo.inicio <= data && data <= servico.periodo.fim);
    if (emAndamento) return emAndamento.intervencao;
    const ultimo = servicos.filter((servico) => servico.periodo.fim < data).at(-1)?.intervencao;
    const proximo = servicos.find((servico) => servico.periodo.inicio > data)?.intervencao;
    return Number(lancamento.valor) < 0 ? (proximo || ultimo || null) : (ultimo || proximo || null);
}

// Uma parcela conta como recebida pelo "Recebido em" ou quando as entradas do
// extrato distribuidas para ela cobrem o valor a receber. Fica "em atraso"
// quando o servico foi executado ou terminou e ainda falta receber.
function financeiroProjeto(projetoId) {
    if (memoFinanceiroProjeto.has(projetoId)) return memoFinanceiroProjeto.get(projetoId);
    const hoje = dataIsoLocal(new Date());
    const intervencoes = cache.intervencoes
        .filter((i) => i.projeto_id === projetoId)
        .sort((a, b) => String(a.data_prevista || "9999").localeCompare(String(b.data_prevista || "9999")));
    const servicos = intervencoes
        .filter((i) => i.status !== "cancelada")
        .map((intervencao) => ({ intervencao, periodo: periodoIntervencao(intervencao) }))
        .filter((servico) => servico.periodo)
        .sort((a, b) => a.periodo.inicio.localeCompare(b.periodo.inicio));
    const grupos = new Map(intervencoes.map((i) => [i.id, { lancamentos: [], entradas: 0, saidas: 0 }]));
    const semServico = { lancamentos: [], entradas: 0, saidas: 0 };
    const porCategoria = new Map();
    for (const lancamento of cache.lancamentosProjetos.filter((l) => l.projeto_id === projetoId)) {
        const valor = Number(lancamento.valor);
        const manual = lancamento.intervencao_id && grupos.has(lancamento.intervencao_id)
            ? intervencoes.find((i) => i.id === lancamento.intervencao_id)
            : null;
        const alvo = manual || intervencaoAutomatica(lancamento, servicos);
        const grupo = alvo ? grupos.get(alvo.id) : semServico;
        grupo.lancamentos.push({ ...lancamento, valor, automatico: !manual, intervencaoAlvo: alvo });
        if (valor >= 0) {
            grupo.entradas += valor;
        } else {
            grupo.saidas += -valor;
            const categoria = categoriaFinanceira(lancamento.categoria_id)?.nome || "Sem categoria";
            porCategoria.set(categoria, (porCategoria.get(categoria) || 0) - valor);
        }
    }
    const parcelas = intervencoes.map((intervencao) => {
        const grupo = grupos.get(intervencao.id);
        const valor = intervencao.status === "cancelada" ? 0 : Number(intervencao.valor_receber || 0);
        const recebido = Math.max(intervencao.recebido_em ? valor : 0, grupo.entradas);
        // Ate 1% de diferenca e tarifa descontada pelo banco (ex.: R$ 1.698,01 de R$ 1.700).
        const falta = Math.round((valor - recebido) * 100) / 100;
        const pendente = falta > valor * TOLERANCIA_TARIFA_RECEBIMENTO ? falta : 0;
        const vencimento = intervencao.data_fim || intervencao.data_prevista;
        let situacao = "sem_valor";
        if (valor && !pendente) situacao = "recebida";
        else if (valor) situacao = intervencao.status === "executada" || (vencimento && vencimento < hoje) ? "atrasada" : "a_receber";
        return { intervencao, ...grupo, valor, recebido, pendente, vencimento, situacao, resultado: Math.max(valor, recebido) - grupo.saidas };
    });
    const soma = (lista, campo) => lista.reduce((total, item) => total + item[campo], 0);
    const total = {
        contratado: soma(parcelas, "valor"),
        recebido: soma(parcelas, "recebido") + semServico.entradas,
        aReceber: soma(parcelas.filter((p) => p.situacao === "a_receber"), "pendente"),
        atrasado: soma(parcelas.filter((p) => p.situacao === "atrasada"), "pendente"),
        gastos: soma(parcelas, "saidas") + semServico.saidas,
    };
    total.resultadoRealizado = total.recebido - total.gastos;
    const receitaPrevista = Math.max(total.contratado, total.recebido);
    total.resultado = receitaPrevista - total.gastos;
    total.margem = receitaPrevista ? total.resultado / receitaPrevista : null;
    const resultado = { total, parcelas, semServico, porCategoria, temExtrato: cache.lancamentosProjetos.some((l) => l.projeto_id === projetoId) };
    memoFinanceiroProjeto.set(projetoId, resultado);
    return resultado;
}

// Painel inicial: soma o financeiroProjeto() de cada contrato.
function analiseFinanceira() {
    const contratos = cache.projetos.filter((p) => !STATUS_NEGOCIACAO.includes(p.status));
    const inicioMes = new Date();
    inicioMes.setDate(1);
    const meses = Array.from({ length: 12 }, (_, indice) => {
        const data = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + indice, 1);
        return { chave: dataIsoLocal(data).slice(0, 7), rotulo: `${MESES_CURTOS[data.getMonth()]}/${String(data.getFullYear()).slice(2)}`, valor: 0 };
    });
    const mesPorChave = new Map(meses.map((mes) => [mes.chave, mes]));

    const total = { contratado: 0, recebido: 0, aReceber: 0, atrasado: 0, gastos: 0, semData: 0, depoisDoPeriodo: 0 };
    const atrasados = [];
    const porProjeto = contratos.map((projeto) => {
        const financeiro = financeiroProjeto(projeto.id);
        for (const parcela of financeiro.parcelas) {
            if (parcela.situacao === "atrasada") atrasados.push({ intervencao: parcela.intervencao, projeto, valor: parcela.pendente });
            if (parcela.situacao !== "a_receber") continue;
            // Agrupa pelo termino do servico (mesma data que define o atraso).
            const mes = parcela.vencimento ? mesPorChave.get(parcela.vencimento.slice(0, 7)) : null;
            if (mes) mes.valor += parcela.pendente;
            else if (parcela.vencimento) total.depoisDoPeriodo += parcela.pendente;
            else total.semData += parcela.pendente;
        }
        for (const chave of ["contratado", "recebido", "aReceber", "atrasado", "gastos"]) total[chave] += financeiro.total[chave];
        return { projeto, ...financeiro.total };
    });
    const receitaPrevista = Math.max(total.contratado, total.recebido);
    total.resultado = receitaPrevista - total.gastos;
    total.margem = receitaPrevista ? total.resultado / receitaPrevista : null;
    atrasados.sort((a, b) => String(a.intervencao.data_prevista).localeCompare(String(b.intervencao.data_prevista)));
    porProjeto.sort((a, b) => b.contratado - a.contratado);
    return { total, porProjeto, meses, atrasados };
}

function renderGraficoRecebimentos(meses) {
    const maximo = Math.max(...meses.map((mes) => mes.valor));
    if (!maximo) return `<p class="vazio compacto">Nenhum recebimento previsto para os próximos 12 meses.</p>`;
    const passo = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000].find((p) => maximo / p <= 4) || 1000000;
    const topo = Math.ceil(maximo / passo) * passo;
    const ticks = Array.from({ length: Math.round(topo / passo) + 1 }, (_, indice) => indice * passo);
    const maiorMes = meses.find((mes) => mes.valor === maximo);
    return `
        <figure class="grafico-colunas" aria-label="Recebimentos previstos por mês">
            <div class="grafico-area">
                ${ticks.map((tick) => `<span class="grafico-grade" style="bottom:${(tick / topo) * 100}%"><em>${escapeHtml(formatMoedaCompacta(tick))}</em></span>`).join("")}
                <div class="grafico-colunas-lista">
                    ${meses.map((mes) => `
                        <div class="grafico-coluna" tabindex="0" aria-label="${escapeHtml(`${mes.rotulo}: ${formatMoeda(mes.valor)}`)}">
                            ${mes.valor ? `<span class="grafico-barra" style="height:${(mes.valor / topo) * 100}%"></span>` : ""}
                            ${mes === maiorMes ? `<b class="grafico-rotulo" style="bottom:${(mes.valor / topo) * 100}%">${escapeHtml(formatMoedaCompacta(mes.valor))}</b>` : ""}
                            <span class="grafico-tooltip" role="tooltip"><strong>${escapeHtml(mes.rotulo)}</strong>${escapeHtml(formatMoeda(mes.valor))}</span>
                        </div>
                    `).join("")}
                </div>
            </div>
            <div class="grafico-eixo-x">${meses.map((mes) => `<span>${escapeHtml(mes.rotulo)}</span>`).join("")}</div>
        </figure>
        <details class="grafico-tabela">
            <summary>Ver valores em tabela</summary>
            <table>
                <thead><tr><th>Mês</th><th>A receber</th></tr></thead>
                <tbody>${meses.map((mes) => `<tr><td>${escapeHtml(mes.rotulo)}</td><td>${formatMoeda(mes.valor)}</td></tr>`).join("")}</tbody>
            </table>
        </details>
    `;
}

function renderAnaliseFinanceira(financeiro) {
    const { total, porProjeto, meses } = financeiro;
    const percentualRecebido = total.contratado ? total.recebido / total.contratado : 0;
    const notasPrevisao = [
        total.atrasado ? `${formatMoeda(total.atrasado)} em atraso não entram no gráfico` : "",
        total.depoisDoPeriodo ? `${formatMoeda(total.depoisDoPeriodo)} previstos depois de ${meses.at(-1).rotulo}` : "",
        total.semData ? `${formatMoeda(total.semData)} sem data definida` : "",
    ].filter(Boolean);
    return `
        <section class="painel analise-financeira">
            <div class="painel-topo">
                <div><h2>Análise financeira dos contratos</h2><p class="subtexto">Receita pelo cronograma de plantios e manutenções; prospecção e orçamento ficam fora.</p></div>
            </div>
            <div class="financeiro-kpis">
                <div class="kpi"><span>Valor contratado</span><strong>${formatMoeda(total.contratado)}</strong><small>${porProjeto.length} contrato(s)</small></div>
                <div class="kpi"><span>Recebido</span><strong>${formatMoeda(total.recebido)}</strong>
                    <div class="medidor" role="img" aria-label="${escapeHtml(`${formatPercentual(percentualRecebido)} do contratado`)}"><span style="width:${Math.min(percentualRecebido, 1) * 100}%"></span></div>
                    <small>${formatPercentual(percentualRecebido)} do contratado</small></div>
                <div class="kpi"><span>A receber</span><strong>${formatMoeda(total.aReceber)}</strong><small>parcelas futuras</small></div>
                <div class="kpi ${total.atrasado ? "kpi-alerta" : ""}"><span>Em atraso</span><strong>${formatMoeda(total.atrasado)}</strong><small>${total.atrasado ? `${financeiro.atrasados.length} parcela(s) sem recebimento` : "nenhuma parcela vencida"}</small></div>
                <div class="kpi"><span>Gastos</span><strong>${formatMoeda(total.gastos)}</strong><small>saídas do extrato vinculadas aos contratos</small></div>
                <div class="kpi"><span>Resultado previsto</span><strong>${formatMoeda(total.resultado)}</strong><small>${total.margem === null ? "sem valores contratados" : `margem de ${formatPercentual(total.margem)}`}</small></div>
            </div>
            <div class="financeiro-previsao">
                <h3>Recebimentos previstos nos próximos 12 meses</h3>
                ${renderGraficoRecebimentos(meses)}
                ${notasPrevisao.length ? `<p class="subtexto">${escapeHtml(notasPrevisao.join(" · "))}.</p>` : ""}
            </div>
            <div class="financeiro-tabela">
                <h3>Por contrato</h3>
                <div class="tabela-rolagem">
                    <table>
                        <thead><tr><th>Projeto</th><th>Contratado</th><th>Recebido</th><th>A receber</th><th>Em atraso</th><th>Gastos</th><th>Resultado</th><th>Margem</th></tr></thead>
                        <tbody>
                            ${porProjeto.map((linha) => `
                                <tr>
                                    <td><button class="link-projeto abrir-projeto-dashboard" type="button" data-id="${linha.projeto.id}">${escapeHtml(linha.projeto.nome)}</button><small>${escapeHtml(rotuloStatusProjeto(linha.projeto.status))}</small></td>
                                    <td>${formatMoeda(linha.contratado)}</td>
                                    <td>${formatMoeda(linha.recebido)}</td>
                                    <td>${formatMoeda(linha.aReceber)}</td>
                                    <td class="${linha.atrasado ? "valor-alerta" : ""}">${formatMoeda(linha.atrasado)}</td>
                                    <td>${formatMoeda(linha.gastos)}</td>
                                    <td class="${linha.resultado < 0 ? "valor-alerta" : ""}">${formatMoeda(linha.resultado)}</td>
                                    <td>${linha.margem === null ? "—" : formatPercentual(linha.margem)}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                        <tfoot><tr><th>Total</th><th>${formatMoeda(total.contratado)}</th><th>${formatMoeda(total.recebido)}</th><th>${formatMoeda(total.aReceber)}</th><th>${formatMoeda(total.atrasado)}</th><th>${formatMoeda(total.gastos)}</th><th>${formatMoeda(total.resultado)}</th><th>${total.margem === null ? "—" : formatPercentual(total.margem)}</th></tr></tfoot>
                    </table>
                </div>
                ${porProjeto.some((linha) => !linha.contratado) ? `<p class="subtexto">Contratos com valor contratado zerado ainda não têm valores a receber nos plantios e manutenções.</p>` : ""}
            </div>
        </section>
    `;
}

function renderDashboard() {
    setPage("Início", "Visão geral", `<a class="botao" href="#projetos">Projetos</a><a class="botao secundario" href="#calendario">Calendário</a>`);

    const contratosAtivos = cache.projetos.filter((p) => STATUS_CONTRATO_ATIVO.includes(p.status));
    const emNegociacao = cache.projetos.filter((p) => STATUS_NEGOCIACAO.includes(p.status));
    const valorNegociacao = emNegociacao.reduce((soma, p) => soma + valorNumero(p.valor_estimado), 0);
    const financeiro = analiseFinanceira();
    const intervencoesPendentes = intervencoesProjetosAtivos().filter((i) => !["executada", "cancelada"].includes(i.status) && !STATUS_NEGOCIACAO.includes(buscarProjeto(i.projeto_id)?.status));
    const licitacoesAtivas = cache.oportunidades.filter((o) => !["perdido", "descartado"].includes(o.status));
    const licitacoesRelevantes = licitacoesAtivas.filter((o) => ["alta", "media"].includes(o.prioridade_prad));
    const licitacoesAlta = licitacoesAtivas.filter((o) => o.prioridade_prad === "alta");
    const alertasConfirmacao = alertasConfirmacaoManutencao();
    const licitacoesRecentes = [...licitacoesRelevantes]
        .sort((a, b) => (b.pontuacao_prad || 0) - (a.pontuacao_prad || 0))
        .slice(0, 5);

    conteudo.innerHTML = `
        <section class="metricas">
            <div class="metric-card"><span>Contratos ativos</span><strong>${contratosAtivos.length}</strong><small>contratado, em execução, monitoramento ou pausado</small></div>
            <div class="metric-card negociacao-card"><span>Em negociação</span><strong>${emNegociacao.length}</strong><small>${formatMoeda(valorNegociacao)} estimados · ainda sem contrato</small></div>
            <div class="metric-card"><span>Intervenções abertas</span><strong>${intervencoesPendentes.length}</strong><small>dos contratos</small></div>
            <div class="metric-card alerta-card"><span>Licitações alta prioridade</span><strong>${licitacoesAlta.length}</strong></div>
        </section>
        ${renderAnaliseFinanceira(financeiro)}
        <section class="grid-duas-colunas">
            <div class="painel painel-negociacao">
                <div class="painel-topo"><div><h2>Em negociação</h2><p class="subtexto">Prospecção e orçamento: ainda não são contratos ativos.</p></div><a href="#projetos?status=todos">Ver projetos</a></div>
                ${emNegociacao.length ? `<div class="lista-compacta">${emNegociacao.map((p) => `
                    <article><div><button class="link-projeto abrir-projeto-dashboard" type="button" data-id="${p.id}">${escapeHtml(p.nome)}</button><span>${escapeHtml(p.cliente || "Cliente não informado")} · ${escapeHtml(rotuloStatusProjeto(p.status))}</span></div><em>${valorNumero(p.valor_estimado) ? formatMoeda(valorNumero(p.valor_estimado)) : "Sem valor estimado"}</em></article>
                `).join("")}</div>
                <p class="total-negociacao"><span>Total estimado</span><strong>${formatMoeda(valorNegociacao)}</strong></p>` : `<p class="vazio compacto">Nenhum projeto em prospecção ou orçamento.</p>`}
            </div>
            <div class="painel ${financeiro.atrasados.length ? "painel-alertas" : ""}">
                <div class="painel-topo"><div><h2>Recebimentos em atraso</h2><p class="subtexto">Serviços executados ou com data passada que ainda não foram pagos (nem pelo extrato, nem por "Recebido em").</p></div></div>
                ${financeiro.atrasados.length ? `<div class="lista-compacta">${financeiro.atrasados.map(({ intervencao, projeto, valor }) => `
                    <article><div><button class="link-projeto abrir-projeto-dashboard" type="button" data-id="${projeto.id}" data-intervencao-id="${intervencao.id}">${escapeHtml(intervencao.titulo)}</button><span>${escapeHtml(projeto.nome)} · ${escapeHtml(formatPeriodo(intervencao))} · ${escapeHtml(formatStatus(intervencao.status))}</span></div><em>${formatMoeda(valor)}</em></article>
                `).join("")}</div>` : `<p class="vazio compacto">Nenhum recebimento em atraso.</p>`}
            </div>
            <div class="painel">
                <div class="painel-topo"><h2>Licitações em foco</h2><a href="#licitacoes">Ver radar</a></div>
                ${licitacoesRecentes.length ? `<div class="lista-compacta">${licitacoesRecentes.map((o) => `
                    <article><div><strong>${escapeHtml(o.titulo)}</strong><span>${escapeHtml(o.fonte_nome)} · ${escapeHtml(o.motivos_prad || "Sem motivo registrado")}</span></div><em>${escapeHtml(o.prioridade_prad)} · ${o.pontuacao_prad || 0}</em></article>
                `).join("")}</div>` : `<p class="vazio compacto">Nenhuma licitação relevante ativa no momento.</p>`}
            </div>
            <div class="painel painel-alertas">
                <div class="painel-topo"><h2>Contatar clientes</h2><a href="#configuracoes">Configurar</a></div>
                ${alertasConfirmacao.length ? `<div class="lista-compacta">${alertasConfirmacao.map((item) => `
                    <article><div><strong>${escapeHtml(item.titulo)}</strong><span>${escapeHtml(item.projetos?.nome || "Projeto")} · contatar ${item.contato.situacao === "atrasado" ? "desde" : "hoje,"} ${escapeHtml(formatData(item.contato.data))} · manutenção ${escapeHtml(formatPeriodo(item))}</span></div><a href="#calendario?mes=${escapeHtml(String(item.data_prevista || item.contato.data).slice(0, 7))}">Abrir agenda</a></article>
                `).join("")}</div>` : `<p class="vazio compacto">Nenhum contato com cliente pendente para hoje.</p>`}
            </div>
        </section>
        <dialog id="projetoModal" class="modal-projeto">
            <div id="projetoModalConteudo"></div>
        </dialog>
    `;
    document.querySelectorAll(".abrir-projeto-dashboard").forEach((botao) => {
        botao.addEventListener("click", () => abrirProjetoModal(Number(botao.dataset.id), botao.dataset.intervencaoId ? Number(botao.dataset.intervencaoId) : null));
    });
    if (projetoModalAbertoId) setTimeout(() => abrirProjetoModal(projetoModalAbertoId, intervencaoModalDestaqueId), 0);
}

function renderProjetos() {
    setPage("Projetos", "ERP simples", `<button id="novoProjetoBtn" type="button">Novo projeto</button>`);
    const params = new URLSearchParams(location.hash.split("?")[1] || "");
    const statusFiltro = params.get("status") || "ativos";
    const busca = params.get("busca") || "";
    const visualizacao = params.get("visualizacao") === "kanban" && statusFiltro !== "arquivados" ? "kanban" : "lista";
    let projetos = statusFiltro === "arquivados" ? [...cache.projetosArquivados] : [...cache.projetos];

    if (statusFiltro === "arquivados") projetos.sort((a, b) => String(b.arquivado_em).localeCompare(String(a.arquivado_em)));
    else if (statusFiltro === "ativos") projetos = projetos.filter((p) => p.status !== "concluido");
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
            ? PROJETO_STATUS.filter(([valor]) => valor !== "concluido")
            : PROJETO_STATUS.filter(([valor]) => valor === statusFiltro);

    conteudo.innerHTML = `
        <form id="filtroProjetos" class="filtros">
            <input type="hidden" name="visualizacao" value="${visualizacao}">
            <label>Status:<select name="status"><option value="ativos" ${statusFiltro === "ativos" ? "selected" : ""}>Ativos</option><option value="todos" ${statusFiltro === "todos" ? "selected" : ""}>Todos</option>${opcoesSelect(PROJETO_STATUS, statusFiltro)}<option value="arquivados" ${statusFiltro === "arquivados" ? "selected" : ""}>Arquivados</option></select></label>
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
                <div><dt>Próxima</dt><dd>${proxima ? formatPeriodo(proxima) : "Sem agenda"}</dd></div>
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
                <span><strong>${proxima ? formatPeriodo(proxima) : "Sem agenda"}</strong> próxima</span>
            </div>
            <div class="card-acoes">
                <small>${projeto.arquivado_em
                    ? `Arquivado em ${escapeHtml(formatDataHora(projeto.arquivado_em))} por ${escapeHtml(projeto.arquivado_por || "sistema")}`
                    : `Atualizado em ${escapeHtml(formatData((projeto.atualizado_em || "").slice(0, 10)))}`}</small>
                <button class="abrir-projeto-modal" type="button" data-id="${projeto.id}">Abrir detalhes</button>
            </div>
        </article>
    `;
}

function abrirProjetoModal(id, intervencaoId = null) {
    const projeto = buscarProjeto(id);
    const modal = $("#projetoModal");
    const modalConteudo = $("#projetoModalConteudo");
    if (!projeto || !modal || !modalConteudo) return;
    projetoModalAbertoId = id;
    intervencaoModalDestaqueId = intervencaoId;
    modalConteudo.innerHTML = renderProjetoDetalhe(projeto);
    bindProjetoDetalhe(modalConteudo);
    // Esc tambem fecha o dialog; sem isso o modal reabriria no proximo render.
    modal.onclose = () => {
        projetoModalAbertoId = null;
        intervencaoModalDestaqueId = null;
    };
    if (!modal.open) modal.showModal();
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
    container.querySelectorAll(".fin-distribuicao").forEach((select) => select.addEventListener("change", distribuirLancamento));
    container.querySelectorAll(".nova-proposta-form").forEach((form) => form.addEventListener("submit", criarProposta));
    container.querySelectorAll(".proposta-form").forEach((form) => form.addEventListener("submit", salvarProposta));
    container.querySelectorAll(".novo-proposta-item-form").forEach((form) => form.addEventListener("submit", criarPropostaItem));
    container.querySelectorAll(".novo-projeto-link-form").forEach((form) => form.addEventListener("submit", criarProjetoLink));
    const formArquivar = container.querySelector(".arquivar-projeto-form");
    if (formArquivar) {
        const projeto = cache.projetos.find((item) => item.id === Number(formArquivar.dataset.id));
        formArquivar.confirmacao.addEventListener("input", () => {
            formArquivar.querySelector("button").disabled = formArquivar.confirmacao.value.trim() !== projeto?.nome?.trim();
        });
        formArquivar.addEventListener("submit", arquivarProjeto);
    }
    container.querySelector(".restaurar-projeto-form")?.addEventListener("submit", restaurarProjeto);
    container.querySelectorAll("[data-excluir]").forEach((botao) => botao.addEventListener("click", excluirRegistro));
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
                    <label>Nome do projeto<input name="nome" value="${escapeHtml(projeto.nome)}" required></label>
                    <label>Status<select name="status">${opcoesSelect(PROJETO_STATUS, projeto.status)}</select></label>
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
            ${renderAnaliseFinanceiraProjeto(projeto)}
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
                    <label>Início<input name="data_prevista" type="date"></label>
                    <label>Fim (opcional)<input name="data_fim" type="date"></label>
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
            ${projeto.arquivado_em ? `
            <section class="arquivar-projeto">
                <h3>Projeto arquivado</h3>
                <p class="subtexto">Arquivado em ${escapeHtml(formatDataHora(projeto.arquivado_em))} por ${escapeHtml(projeto.arquivado_por || "sistema")}. Os dados continuam guardados e o projeto pode voltar para as listas.</p>
                <form class="restaurar-projeto-form" data-id="${projeto.id}">
                    <button type="submit">Restaurar projeto</button>
                </form>
            </section>` : `
            <section class="arquivar-projeto">
                <h3>Arquivar projeto</h3>
                <p class="subtexto">O projeto sai das listas, da agenda e dos alertas, mas plantio, manutenções, propostas, links e histórico continuam guardados. Ele pode ser restaurado pelo filtro "Arquivados".</p>
                <form class="arquivar-projeto-form" data-id="${projeto.id}">
                    <label>Para confirmar, digite o nome do projeto: <strong>${escapeHtml(projeto.nome)}</strong>
                        <input name="confirmacao" autocomplete="off" spellcheck="false">
                    </label>
                    <button class="perigo" type="submit" disabled>Arquivar projeto</button>
                </form>
            </section>`}
        </article>
    `;
}

const SITUACOES_PARCELA = {
    recebida: "Recebida",
    a_receber: "A receber",
    atrasada: "Em atraso",
    sem_valor: "Sem valor a receber",
};

function resumoParcela(parcela) {
    if (parcela.situacao === "recebida") {
        const quando = parcela.intervencao.recebido_em && parcela.recebido <= parcela.valor ? ` em ${formatData(parcela.intervencao.recebido_em)}` : "";
        return `Recebido ${formatMoeda(parcela.recebido)}${quando}`;
    }
    if (parcela.situacao === "sem_valor") return parcela.recebido ? `Recebido ${formatMoeda(parcela.recebido)}` : "Sem valor a receber";
    const parcial = parcela.recebido ? ` (recebido ${formatMoeda(parcela.recebido)} de ${formatMoeda(parcela.valor)})` : "";
    return `${parcela.situacao === "atrasada" ? "Em atraso" : "A receber"} ${formatMoeda(parcela.pendente)}${parcial}`;
}

function opcoesDistribuicaoLancamento(lancamento, intervencoes) {
    const automatica = lancamento.automatico ? lancamento.intervencaoAlvo : null;
    const rotuloAutomatico = automatica ? `Automático: ${automatica.titulo || "serviço"}` : "Automático";
    return `
        <option value="" ${lancamento.automatico ? "selected" : ""}>${escapeHtml(rotuloAutomatico)}</option>
        ${intervencoes.map((i) => `<option value="${i.id}" ${!lancamento.automatico && lancamento.intervencaoAlvo?.id === i.id ? "selected" : ""}>${escapeHtml(`${i.titulo || "Serviço"} · ${formatPeriodo(i)}`)}</option>`).join("")}
    `;
}

function renderLancamentosDistribuidos(lancamentos, intervencoes) {
    return `
        <table class="tabela-extrato tabela-distribuicao">
            <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Serviço</th></tr></thead>
            <tbody>${lancamentos.map((l) => `
                <tr>
                    <td>${escapeHtml(formatData(l.data))}</td>
                    <td class="fin-descricao">${escapeHtml(l.descricao || "—")}</td>
                    <td>${escapeHtml(categoriaFinanceira(l.categoria_id)?.nome || "Sem categoria")}</td>
                    <td class="fin-valor ${l.valor < 0 ? "saida" : "entrada"}">${l.valor < 0 ? "−" : "+"} ${formatMoeda(Math.abs(l.valor))}</td>
                    <td><select class="fin-distribuicao" data-id="${l.id}" aria-label="Serviço deste lançamento">${opcoesDistribuicaoLancamento(l, intervencoes)}</select></td>
                </tr>
            `).join("")}</tbody>
        </table>
    `;
}

function renderAnaliseFinanceiraProjeto(projeto) {
    const { total, parcelas, semServico, porCategoria, temExtrato } = financeiroProjeto(projeto.id);
    const intervencoesAtivas = parcelas.map((p) => p.intervencao).filter((i) => i.status !== "cancelada");
    const percentualRecebido = total.contratado ? Math.min(total.recebido / total.contratado, 1) : 0;
    const categorias = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);
    const maiorCategoria = categorias[0]?.[1] || 0;
    return `
        <section class="analise-projeto">
            <div class="painel-topo compacto">
                <div>
                    <h3>Análise financeira</h3>
                    <p class="subtexto">Entradas e gastos do extrato vinculados a este projeto, distribuídos pela data entre plantio e manutenções.</p>
                </div>
            </div>
            <div class="financeiro-kpis">
                <div class="kpi"><span>Contratado</span><strong>${formatMoeda(total.contratado)}</strong><small>valores a receber do cronograma</small></div>
                <div class="kpi"><span>Recebido</span><strong>${formatMoeda(total.recebido)}</strong>
                    <div class="medidor" role="img" aria-label="${escapeHtml(`${formatPercentual(percentualRecebido)} do contratado`)}"><span style="width:${percentualRecebido * 100}%"></span></div>
                    <small>${total.contratado ? `${formatPercentual(percentualRecebido)} do contratado` : "sem valor contratado"}</small></div>
                <div class="kpi ${total.atrasado ? "kpi-alerta" : ""}"><span>A receber</span><strong>${formatMoeda(total.aReceber + total.atrasado)}</strong><small>${total.atrasado ? `${formatMoeda(total.atrasado)} em atraso` : "nada em atraso"}</small></div>
                <div class="kpi"><span>Gastos</span><strong>${formatMoeda(total.gastos)}</strong><small>saídas do extrato</small></div>
                <div class="kpi"><span>Resultado até agora</span><strong class="${total.resultadoRealizado < 0 ? "valor-alerta" : ""}">${formatMoeda(total.resultadoRealizado)}</strong><small>recebido − gastos</small></div>
                <div class="kpi"><span>Resultado previsto</span><strong class="${total.resultado < 0 ? "valor-alerta" : ""}">${formatMoeda(total.resultado)}</strong><small>${total.margem === null ? "sem receita prevista" : `margem de ${formatPercentual(total.margem)}`}</small></div>
            </div>
            ${!temExtrato ? `<p class="vazio compacto">Nenhum lançamento do extrato vinculado a este projeto ainda. Vincule as entradas e saídas na aba <a href="#financeiro">Financeiro</a>.</p>` : `
            ${categorias.length ? `
            <div class="gastos-categoria">
                <h4>Gastos por categoria</h4>
                ${categorias.map(([nome, valor]) => `
                    <div class="barra-categoria">
                        <span>${escapeHtml(nome)}</span>
                        <div class="barra-trilho"><span style="width:${(valor / maiorCategoria) * 100}%"></span></div>
                        <b>${formatMoeda(valor)}</b>
                    </div>
                `).join("")}
            </div>` : ""}`}
            <div class="parcelas-financeiras">
                <h4>Por plantio e manutenção</h4>
                ${parcelas.length ? parcelas.map((parcela) => `
                    <details class="parcela-financeira situacao-${parcela.situacao}">
                        <summary>
                            <span class="parcela-servico"><strong>${escapeHtml(parcela.intervencao.titulo || "Serviço")}</strong><small>${escapeHtml(formatPeriodo(parcela.intervencao))} · ${escapeHtml(formatStatus(parcela.intervencao.status))}</small></span>
                            <span><small>Valor</small>${formatMoeda(parcela.valor)}</span>
                            <span><small>Recebido</small>${formatMoeda(parcela.recebido)}</span>
                            <span><small>Gastos</small>${formatMoeda(parcela.saidas)}</span>
                            <span><small>Resultado</small><b class="${parcela.resultado < 0 ? "valor-alerta" : ""}">${formatMoeda(parcela.resultado)}</b></span>
                            <span class="selo-situacao">${escapeHtml(SITUACOES_PARCELA[parcela.situacao])}</span>
                        </summary>
                        ${parcela.lancamentos.length
                            ? renderLancamentosDistribuidos(parcela.lancamentos, intervencoesAtivas)
                            : `<p class="vazio compacto">Nenhum lançamento do extrato distribuído para este serviço.</p>`}
                    </details>
                `).join("") : `<p class="vazio compacto">Cadastre o plantio e as manutenções para distribuir os lançamentos.</p>`}
                ${semServico.lancamentos.length ? `
                    <details class="parcela-financeira" open>
                        <summary><span class="parcela-servico"><strong>Sem plantio ou manutenção com data</strong><small>cadastre as datas dos serviços para distribuir</small></span><span><small>Entradas</small>${formatMoeda(semServico.entradas)}</span><span><small>Gastos</small>${formatMoeda(semServico.saidas)}</span></summary>
                        ${renderLancamentosDistribuidos(semServico.lancamentos, intervencoesAtivas)}
                    </details>` : ""}
            </div>
        </section>
    `;
}

async function distribuirLancamento(event) {
    const select = event.target;
    const { error } = await supabase
        .from("financeiro_lancamentos")
        .update({ intervencao_id: select.value ? Number(select.value) : null })
        .eq("id", Number(select.dataset.id));
    if (error) return setMensagem(error.message, "erro");
    await render();
    setMensagem(select.value ? "Lançamento distribuído para o serviço escolhido." : "Lançamento voltou para a distribuição automática.");
}

function renderIntervencaoCard(intervencao) {
    const atividades = cache.atividades.filter((item) => item.intervencao_id === intervencao.id);
    const opcoesAtividade = opcoesConfig("atividade", ATIVIDADES_MANUTENCAO);
    const parcela = financeiroProjeto(intervencao.projeto_id).parcelas.find((item) => item.intervencao.id === intervencao.id);
    const saldoPrevisto = parcela.resultado;

    return `
        <article class="intervencao-card tipo-${escapeHtml(intervencao.tipo)} ${intervencao.id === intervencaoModalDestaqueId ? "intervencao-destaque" : ""}" data-intervencao-card="${intervencao.id}">
            <details class="intervencao-acordeao" ${intervencao.id === intervencaoModalDestaqueId ? "open" : ""}>
                <summary class="intervencao-topo">
                    <div class="intervencao-resumo">
                        <strong>${escapeHtml(intervencao.tipo === "plantio" ? "Plantio" : "Manutenção")}</strong>
                        <span>${escapeHtml(intervencao.titulo || "Sem título")}</span>
                        <small>${escapeHtml(formatPeriodo(intervencao))} · ${escapeHtml(formatStatus(intervencao.status))}</small>
                    </div>
                    <span class="saldo ${saldoPrevisto >= 0 ? "positivo" : "negativo"}">${formatMoeda(saldoPrevisto)}</span>
                </summary>
                <div class="intervencao-conteudo">
            <form class="intervencao-form" data-id="${intervencao.id}">
                <div class="form-grid compacto-grid">
                    <label>Título<input name="titulo" value="${escapeHtml(intervencao.titulo)}" required></label>
                    <label>Status<select name="status">${opcoesSelect(INTERVENCAO_STATUS, intervencao.status)}</select></label>
                    <label>Início<input name="data_prevista" type="date" value="${escapeHtml(intervencao.data_prevista || "")}"></label>
                    <label>Fim (opcional)<input name="data_fim" type="date" value="${escapeHtml(intervencao.data_fim || "")}"></label>
                    <label class="checkbox linha-checkbox"><input type="checkbox" name="data_exata" value="1" ${intervencao.data_exata ? "checked" : ""}> Data exata</label>
                    <label>Valor a receber<input name="valor_receber" type="number" step="0.01" min="0" value="${escapeHtml(intervencao.valor_receber || 0)}"></label>
                    <label>Recebido em<input name="recebido_em" type="date" value="${escapeHtml(intervencao.recebido_em || "")}"></label>
                    <label>Data para contatar<input name="contato_cliente_em" type="date" value="${escapeHtml(intervencao.contato_cliente_em || "")}"></label>
                    <label class="checkbox linha-checkbox"><input type="checkbox" name="contato_feito" value="1" ${intervencao.contato_feito ? "checked" : ""}> Contato feito</label>
                    <label class="campo-largo">Observações<textarea name="observacoes">${escapeHtml(intervencao.observacoes || "")}</textarea></label>
                </div>
                <div class="card-acoes"><span>${escapeHtml(resumoParcela(parcela))} | Gastos ${formatMoeda(parcela.saidas)}</span><div class="acoes-intervencao"><button class="secundario botao-excluir-texto" type="button" data-excluir="intervencoes" data-id="${intervencao.id}" data-descricao="${escapeHtml(intervencao.titulo || (intervencao.tipo === "plantio" ? "Plantio" : "Manutenção"))}">Excluir</button><button type="submit">Salvar intervenção</button></div></div>
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
                    <h4>Lançamentos do extrato</h4>
                    ${parcela.lancamentos.length ? `
                        <div class="extrato-servico">
                            ${parcela.lancamentos.map((l) => `
                                <div class="extrato-servico-linha">
                                    <time>${escapeHtml(formatData(l.data))}</time>
                                    <span>${escapeHtml(l.descricao || "—")}<small>${escapeHtml(categoriaFinanceira(l.categoria_id)?.nome || "Sem categoria")}</small></span>
                                    <b class="fin-valor ${l.valor < 0 ? "saida" : "entrada"}">${l.valor < 0 ? "−" : "+"} ${formatMoeda(Math.abs(l.valor))}</b>
                                </div>
                            `).join("")}
                            <div class="extrato-servico-total"><span>Entradas ${formatMoeda(parcela.entradas)}</span><span>Gastos ${formatMoeda(parcela.saidas)}</span></div>
                        </div>`
                        : `<p class="vazio compacto">Nenhum lançamento do extrato distribuído para este serviço.</p>`}
                    <p class="subtexto">Os lançamentos vêm da aba Financeiro (destino = este projeto), distribuídos pela data. Para mover um lançamento de serviço, use "Análise financeira", no topo do projeto.</p>
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
        <div class="linha-excluivel">
            <label class="chip-check">
                <input class="atividade-check" type="checkbox" data-id="${atividade.id}" ${atividade.concluida ? "checked" : ""}>
                <span>${escapeHtml(formatStatus(atividade.atividade))}${Number(atividade.valor_previsto || 0) ? ` - ${formatMoeda(atividade.valor_previsto)}` : ""}</span>
            </label>
            ${botaoExcluirMini("intervencao_atividades", atividade.id, formatStatus(atividade.atividade))}
        </div>
    `;
}

function botaoExcluirMini(tabela, id, descricao) {
    return `<button class="botao-excluir-mini" type="button" data-excluir="${tabela}" data-id="${id}" data-descricao="${escapeHtml(descricao)}" title="Excluir" aria-label="Excluir ${escapeHtml(descricao)}">×</button>`;
}

const CONFIRMACOES_EXCLUSAO = {
    intervencoes: (descricao) => `Excluir "${descricao}"?\n\nAs atividades desta intervenção também serão apagadas. Os lançamentos do extrato distribuídos para ela voltam para a distribuição automática.`,
    intervencao_atividades: (descricao) => `Excluir a atividade "${descricao}"?`,
};

const PALAVRA_EXCLUSAO = "EXCLUIR";

// Dialogos de confirmacao: a resposta sai do clique no botao; o evento "close"
// (Esc) so cancela. Nao depender apenas de "close" evita respostas perdidas
// quando o navegador adia esse evento (aba em segundo plano).
function abrirDialogo(modal) {
    modal.showModal();
    return new Promise((resolve) => {
        modal.resolverDialogo = resolve;
    });
}

function responderDialogo(modal, resposta) {
    const resolver = modal.resolverDialogo;
    modal.resolverDialogo = null;
    if (modal.open) modal.close();
    resolver?.(resposta);
}

// Modal de confirmacao reutilizavel: so libera a exclusao ao digitar EXCLUIR.
function confirmarExclusao(mensagem) {
    let modal = $("#confirmarExclusaoModal");
    if (!modal) {
        modal = document.createElement("dialog");
        modal.id = "confirmarExclusaoModal";
        modal.className = "modal-confirmar-exclusao";
        modal.innerHTML = `
            <form>
                <h2>Confirmar exclusão</h2>
                <p class="confirmar-exclusao-mensagem"></p>
                <label>Para confirmar, digite <strong>${PALAVRA_EXCLUSAO}</strong>
                    <input name="confirmacao" autocomplete="off" spellcheck="false" placeholder="${PALAVRA_EXCLUSAO}">
                </label>
                <div class="card-acoes">
                    <button class="secundario" type="button" value="cancelar">Cancelar</button>
                    <button class="perigo" type="submit" value="excluir" disabled>Excluir</button>
                </div>
            </form>
        `;
        document.body.append(modal);
        const form = modal.querySelector("form");
        const confirmado = () => form.confirmacao.value.trim() === PALAVRA_EXCLUSAO;
        form.confirmacao.addEventListener("input", () => {
            form.querySelector('[value="excluir"]').disabled = !confirmado();
        });
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            if (confirmado()) responderDialogo(modal, true);
        });
        form.querySelector('[value="cancelar"]').addEventListener("click", () => responderDialogo(modal, false));
        modal.addEventListener("close", () => responderDialogo(modal, false));
    }
    const form = modal.querySelector("form");
    modal.querySelector(".confirmar-exclusao-mensagem").textContent = `${mensagem}\n\nEsta ação não pode ser desfeita.`;
    form.reset();
    form.querySelector('[value="excluir"]').disabled = true;
    const resposta = abrirDialogo(modal);
    form.confirmacao.focus();
    return resposta;
}

async function excluirRegistro(event) {
    const botao = event.currentTarget;
    const tabela = botao.dataset.excluir;
    const id = Number(botao.dataset.id);
    const confirmacao = CONFIRMACOES_EXCLUSAO[tabela];
    if (!confirmacao || !(await confirmarExclusao(confirmacao(botao.dataset.descricao)))) return;
    const { data, error } = await supabase.from(tabela).delete().eq("id", id).select("id");
    if (error) return setMensagem(error.message, "erro");
    if (!data?.length) return setMensagem("Nada foi excluído. Verifique sua permissão.", "erro");
    if (tabela === "intervencoes" && intervencaoModalDestaqueId === id) intervencaoModalDestaqueId = null;
    await render();
    setMensagem("Excluído.");
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

async function arquivarProjeto(event) {
    event.preventDefault();
    const id = Number(event.target.dataset.id);
    const projeto = cache.projetos.find((item) => item.id === id);
    if (!projeto || event.target.confirmacao.value.trim() !== projeto.nome.trim()) {
        return setMensagem("Digite o nome do projeto exatamente como aparece para confirmar.", "erro");
    }
    // arquivado_em e arquivado_por sao definidos pelo banco (trigger set_projeto_arquivamento).
    const { data, error } = await supabase.from("projetos").update({ arquivado_em: new Date().toISOString() }).eq("id", id).select("id");
    if (error) return setMensagem(error.message, "erro");
    if (!data?.length) return setMensagem("O projeto não foi arquivado. Verifique sua permissão.", "erro");
    fecharProjetoModal();
    await render();
    setMensagem(`Projeto "${projeto.nome}" arquivado. Ele pode ser restaurado pelo filtro "Arquivados".`);
}

async function restaurarProjeto(event) {
    event.preventDefault();
    const id = Number(event.target.dataset.id);
    const projeto = buscarProjeto(id);
    const { data, error } = await supabase.from("projetos").update({ arquivado_em: null }).eq("id", id).select("id");
    if (error) return setMensagem(error.message, "erro");
    if (!data?.length) return setMensagem("O projeto não foi restaurado. Verifique sua permissão.", "erro");
    fecharProjetoModal();
    await render();
    setMensagem(`Projeto "${projeto?.nome || ""}" restaurado.`);
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

function validarPeriodo(payload) {
    if (payload.data_fim && !payload.data_prevista) return "Informe a data de início antes da data de fim.";
    if (payload.data_fim && payload.data_fim < payload.data_prevista) return "A data de fim não pode ser anterior à data de início.";
    return "";
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
        data_fim: dados.data_fim || null,
        data_exata: Boolean(dados.data_exata),
        valor_receber: Number(dados.valor_receber || 0),
    };
    const erroPeriodo = validarPeriodo(payload);
    if (erroPeriodo) return setMensagem(erroPeriodo, "erro");
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
        data_fim: dados.data_fim || null,
        data_exata: Boolean(dados.data_exata),
        valor_receber: Number(dados.valor_receber || 0),
        recebido_em: dados.recebido_em || null,
        contato_cliente_em: dados.contato_cliente_em || null,
        contato_feito: Boolean(dados.contato_feito),
        observacoes: dados.observacoes || null,
    };
    const erroPeriodo = validarPeriodo(payload);
    if (erroPeriodo) return setMensagem(erroPeriodo, "erro");
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
    const eventos = eventosCalendario()
        .filter((evento) => evento.data >= inicio && evento.data < fimIso)
        .sort((a, b) => a.data.localeCompare(b.data) || ordemEventoNoDia(a).localeCompare(ordemEventoNoDia(b)));
    // Na lista do mes, cada intervencao de varios dias aparece uma vez so.
    const vistos = new Set();
    const eventosLista = eventos.filter((evento) => {
        const chave = `${evento.tipo}-${evento.item?.id ?? evento.contatoProspeccao.id}`;
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
    });
    const totalExecucoes = eventosLista.filter((evento) => evento.tipo === "execucao").length;
    const totalContatos = eventosLista.filter((evento) => evento.tipo === "contato").length;
    const totalProspeccao = eventosLista.filter(eventoDeProspeccao).length;
    const dias = montarDiasCalendario(mes, eventos);

    setPage("Calendário", "Serviços, contatos e reuniões", `<a class="botao secundario" href="#projetos">Projetos</a><a class="botao secundario" href="#prospeccao">Prospecção</a>`);
    conteudo.innerHTML = `
        <form id="filtroCalendario" class="filtros">
            <label>Mês<input name="mes" type="month" value="${escapeHtml(mes)}"></label>
            <button type="submit">Ver agenda</button>
        </form>
        <section class="painel">
            <div class="painel-topo"><h2>Agenda de ${escapeHtml(mes)}</h2><span>${totalExecucoes} intervenção(ões) · ${totalContatos} contato(s) com cliente · ${totalProspeccao} da prospecção</span></div>
            <div class="calendario-legenda">
                <span class="legenda-execucao">Plantio / manutenção</span>
                <span class="legenda-contato">Contatar cliente</span>
                <span class="legenda-contato-atrasado">Contato atrasado</span>
                <span class="legenda-contato-feito">Contato feito</span>
                <span class="legenda-prospeccao">Prospecção: próximo contato</span>
                <span class="legenda-reuniao">Reunião agendada</span>
            </div>
            <div class="calendario-grade">
                ${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dia) => `<strong class="calendario-semana">${dia}</strong>`).join("")}
                ${dias.map(renderDiaCalendario).join("")}
            </div>
            <div class="agenda-lista">
                ${eventosLista.length ? eventosLista.map(renderAgendaItem).join("") : `<p class="vazio">Nenhum serviço, contato ou reunião previsto para este mês.</p>`}
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
    const contatoAberto = Number(new URLSearchParams(location.hash.split("?")[1] || "").get("contato")) || null;
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
                <label>Próximo contato<input name="proxima_acao_em" type="date"></label>
                <label>Reunião (data e hora)<input name="reuniao_em" type="datetime-local"></label>
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
                ${contatos.length ? contatos.map((contato) => renderContatoProspeccao(contato, contato.id === contatoAberto)).join("") : `<p class="vazio">Nenhum contato cadastrado.</p>`}
            </div>
        </section>
    `;
    $("#novoContatoProspeccao").addEventListener("submit", criarContatoProspeccao);
    document.querySelectorAll(".prospeccao-contato-form").forEach((form) => form.addEventListener("submit", salvarContatoProspeccao));
    if (contatoAberto) document.querySelector(`#contato-prospeccao-${contatoAberto}`)?.scrollIntoView({ block: "center" });
}

function renderContatoProspeccao(contato, aberto = false) {
    const reuniao = contato.reuniao_em ? ` · ${formatData(contato.reuniao_em.slice(0, 10))} ${contato.reuniao_em.slice(11, 16)}` : "";
    return `
        <details class="contato-prospeccao" id="contato-prospeccao-${contato.id}" ${aberto ? "open" : ""}>
            <summary>
                <span><strong>${escapeHtml(contato.nome_fantasia)}</strong><small>${escapeHtml(contato.razao_social || contato.email || "Sem razão social")}</small></span>
                <em>${escapeHtml(formatStatus(contato.status_reuniao) + reuniao)}</em>
                <time>${escapeHtml(formatData(contato.proxima_acao_em))}</time>
            </summary>
            <form class="prospeccao-contato-form prospeccao-form-grid" data-id="${contato.id}">
                <label>Nome fantasia<input name="nome_fantasia" value="${escapeHtml(contato.nome_fantasia)}" required></label>
                <label>Razão social<input name="razao_social" value="${escapeHtml(contato.razao_social || "")}"></label>
                <label>CNPJ<input name="cnpj" value="${escapeHtml(contato.cnpj || "")}"></label>
                <label>E-mail<input name="email" type="email" value="${escapeHtml(contato.email || "")}"></label>
                <label>Telefones<input name="telefones" value="${escapeHtml(contato.telefones || "")}"></label>
                <label>Próximo contato<input name="proxima_acao_em" type="date" value="${escapeHtml(contato.proxima_acao_em || "")}"></label>
                <label>Reunião (data e hora)<input name="reuniao_em" type="datetime-local" value="${escapeHtml((contato.reuniao_em || "").slice(0, 16))}"></label>
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
        // Informar a data da reuniao ja marca a reuniao como agendada.
        status_reuniao: dados.reuniao_em && (dados.status_reuniao || "nao_agendada") === "nao_agendada" ? "agendada" : (dados.status_reuniao || "nao_agendada"),
        proxima_acao_em: dados.proxima_acao_em || null,
        reuniao_em: dados.reuniao_em || null,
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

function dataIsoLocal(data) {
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function subtrairDias(dataIso, dias) {
    const data = new Date(`${dataIso}T12:00:00`);
    data.setDate(data.getDate() - dias);
    return dataIsoLocal(data);
}

// Cada intervencao gera o evento de execucao; manutencoes abertas geram tambem o
// evento de contato com o cliente (ver contatoManutencao).
function eventosCalendario() {
    const hoje = dataIsoLocal(new Date());
    const eventos = [];
    for (const item of intervencoesProjetosAtivos()) {
        if (item.data_prevista) {
            // Servicos de varios dias aparecem em cada dia do periodo (limite de 90 dias).
            const ultimo = item.data_exata && item.data_fim > item.data_prevista ? item.data_fim : item.data_prevista;
            const dias = [];
            for (let data = item.data_prevista; data <= ultimo && dias.length < 90; data = subtrairDias(data, -1)) dias.push(data);
            dias.forEach((data, indice) => eventos.push({ tipo: "execucao", data, item, dia: indice + 1, totalDias: dias.length }));
        }
        const contato = contatoManutencao(item, hoje);
        if (contato) eventos.push({ tipo: "contato", ...contato, item });
    }
    eventos.push(...eventosProspeccao(hoje));
    return eventos;
}

// Prospeccao no calendario: proximo contato (proxima_acao_em) e reuniao
// (reuniao_em). Contatos "nao interessado" ficam de fora.
function eventosProspeccao(hoje) {
    const eventos = [];
    for (const contatoProspeccao of cache.prospeccaoContatos) {
        if (contatoProspeccao.status_reuniao === "nao_interessado") continue;
        if (contatoProspeccao.proxima_acao_em) {
            const data = contatoProspeccao.proxima_acao_em;
            eventos.push({ tipo: "prospeccao", data, contatoProspeccao, situacao: data < hoje ? "atrasado" : "pendente" });
        }
        if (contatoProspeccao.reuniao_em && ["agendada", "realizada"].includes(contatoProspeccao.status_reuniao)) {
            const data = contatoProspeccao.reuniao_em.slice(0, 10);
            const situacao = contatoProspeccao.status_reuniao === "realizada" ? "feito" : data < hoje ? "atrasado" : "pendente";
            eventos.push({ tipo: "reuniao", data, hora: contatoProspeccao.reuniao_em.slice(11, 16), contatoProspeccao, situacao });
        }
    }
    return eventos;
}

function ordemEventoNoDia(evento) {
    if (evento.tipo === "reuniao") return `0-${evento.hora}`;
    if (evento.tipo === "contato" || evento.tipo === "prospeccao") return "1";
    return "2";
}

function eventoDeProspeccao(evento) {
    return evento.tipo === "prospeccao" || evento.tipo === "reuniao";
}

function rotuloEvento(evento) {
    if (eventoDeProspeccao(evento)) {
        const nome = evento.contatoProspeccao.nome_fantasia;
        if (evento.tipo === "reuniao") return evento.situacao === "feito" ? `Reunião realizada: ${nome}` : `Reunião ${evento.hora}: ${nome}`;
        return evento.situacao === "atrasado" ? `Contato atrasado: ${nome}` : `Prospecção: contatar ${nome}`;
    }
    if (evento.tipo === "execucao") {
        return evento.totalDias > 1 ? `${evento.item.titulo} (dia ${evento.dia}/${evento.totalDias})` : evento.item.titulo;
    }
    if (evento.situacao === "feito") return `Contato feito: ${evento.item.titulo}`;
    if (evento.situacao === "atrasado") return `Contato atrasado: ${evento.item.titulo}`;
    return `Contatar cliente: ${evento.item.titulo}`;
}

function classeEvento(evento) {
    if (evento.tipo === "execucao") return "evento-execucao";
    if (evento.tipo === "reuniao") return `evento-reuniao reuniao-${evento.situacao}`;
    if (evento.tipo === "prospeccao") return `evento-prospeccao prospeccao-${evento.situacao}`;
    return `evento-contato contato-${evento.situacao}`;
}

function linkContatoProspeccao(contatoProspeccao) {
    return `#prospeccao?contato=${contatoProspeccao.id}`;
}

function renderAgendaItemProspeccao(evento) {
    const contatoProspeccao = evento.contatoProspeccao;
    const quando = evento.tipo === "reuniao" ? `${formatData(evento.data)} ${evento.hora}` : formatData(evento.data);
    const situacao = evento.tipo === "reuniao"
        ? (evento.situacao === "atrasado" ? "Reunião passou: marque como realizada" : formatStatus(contatoProspeccao.status_reuniao))
        : "Próximo contato da prospecção";
    return `
        <article class="agenda-item ${classeEvento(evento)}">
            <time>${escapeHtml(quando)}</time>
            <div>
                <strong>${escapeHtml(rotuloEvento(evento))}</strong>
                <span>${escapeHtml([contatoProspeccao.razao_social, contatoProspeccao.telefones].filter(Boolean).join(" · ") || "Prospecção")}</span>
            </div>
            <em>${escapeHtml(situacao)}</em>
            <a class="botao secundario" href="${linkContatoProspeccao(contatoProspeccao)}">Abrir</a>
        </article>
    `;
}

function renderAgendaItem(evento) {
    if (eventoDeProspeccao(evento)) return renderAgendaItemProspeccao(evento);
    const item = evento.item;
    const projeto = item.projetos || {};
    const data = evento.tipo === "execucao" ? formatPeriodo(item) : formatData(evento.data);
    const situacao = evento.tipo === "execucao"
        ? formatStatus(item.status)
        : `Manutenção em ${formatPeriodo(item)}`;
    return `
        <article class="agenda-item ${classeEvento(evento)}">
            <time>${escapeHtml(data)}</time>
            <div>
                <strong>${escapeHtml(evento.tipo === "execucao" ? item.titulo : rotuloEvento(evento))}</strong>
                <span>${escapeHtml(projeto.nome || "Projeto")} - ${escapeHtml(projeto.cliente || "Cliente não informado")}</span>
            </div>
            <em>${escapeHtml(situacao)}</em>
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
        dias.push({ data, dia, itens: itens.filter((evento) => evento.data === data) });
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

function renderEventoCalendario(evento) {
    if (eventoDeProspeccao(evento)) {
        return `
            <a class="evento-calendario ${classeEvento(evento)}" href="${linkContatoProspeccao(evento.contatoProspeccao)}">
                <strong>${escapeHtml(rotuloEvento(evento))}</strong>
                <span>Prospecção</span>
            </a>
        `;
    }
    const item = evento.item;
    const projeto = item.projetos || {};
    return `
        <button class="evento-calendario abrir-intervencao ${classeEvento(evento)}" type="button" data-projeto-id="${item.projeto_id}" data-intervencao-id="${item.id}">
            <strong>${escapeHtml(rotuloEvento(evento))}</strong>
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
        data_prevista: "Data de início",
        data_fim: "Data de fim",
        data_exata: "Data exata",
        valor_receber: "Valor a receber",
        recebido_em: "Recebido em",
        contato_cliente_em: "Data para contatar",
        contato_feito: "Contato feito",
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
        // Categorias financeiras ficam na aba Financeiro (financeiro_categorias).
        ["atividade", "Atividades de manutenção", "Ex.: irrigação, poda, tutoramento"],
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
            <div class="painel-topo"><div><h2>Alertas operacionais</h2><p class="subtexto">Aviso no painel inicial quando chega a data de contatar o cliente antes de uma manutenção. A antecedência abaixo é usada só nas manutenções sem "Data para contatar".</p></div></div>
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

// ---------------------------------------------------------------------------
// Financeiro: extrato bancario (OFX) classificado por categoria e destino
// (projeto, corporativo ou transferencia entre contas proprias).

let financeiroLancamentos = [];
let financeiroSelecionados = new Set();
let financeiroMensagemPendente = null;

const DESTINOS_FINANCEIRO = {
    projeto: "Projeto",
    corporativo: "Corporativo",
    transferencia: "Transferência entre contas",
};

function filtrosFinanceiro() {
    const params = new URLSearchParams(location.hash.split("?")[1] || "");
    const hoje = new Date();
    return {
        de: params.get("de") || dataIsoLocal(new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1)),
        ate: params.get("ate") || dataIsoLocal(hoje),
        tipo: params.get("tipo") || "todos",
        categoria: params.get("categoria") || "",
        destino: params.get("destino") || "",
        busca: params.get("busca") || "",
    };
}

// O Supabase devolve no maximo 1000 linhas por consulta.
async function buscarLancamentosFinanceiro(de, ate) {
    const linhas = [];
    for (let inicio = 0; ; inicio += 1000) {
        const { data, error } = await supabase
            .from("financeiro_lancamentos")
            .select("*")
            .gte("data", de)
            .lte("data", ate)
            .order("data", { ascending: false })
            .order("id", { ascending: false })
            .range(inicio, inicio + 999);
        if (error) throw error;
        linhas.push(...data);
        if (data.length < 1000) return linhas;
    }
}

function lancamentoPendente(lancamento) {
    return !lancamento.categoria_id || !lancamento.destino || (lancamento.destino === "projeto" && !lancamento.projeto_id);
}

function categoriaFinanceira(id) {
    return cache.financeiroCategorias.find((categoria) => categoria.id === id);
}

function categoriaCompativel(categoria, valor) {
    return categoria.tipo === "ambos" || categoria.tipo === (Number(valor) >= 0 ? "receita" : "despesa");
}

function valorDestinoLancamento(lancamento) {
    if (lancamento.destino === "projeto") return lancamento.projeto_id ? `projeto:${lancamento.projeto_id}` : "";
    return lancamento.destino || "";
}

// Mudar o destino desfaz o ajuste manual de distribuicao entre os servicos.
function payloadDestino(valor) {
    if (valor.startsWith("projeto:")) return { destino: "projeto", projeto_id: Number(valor.split(":")[1]), intervencao_id: null };
    if (valor === "corporativo" || valor === "transferencia") return { destino: valor, projeto_id: null, intervencao_id: null };
    return { destino: null, projeto_id: null, intervencao_id: null };
}

function nomeDestinoLancamento(lancamento) {
    if (lancamento.destino === "projeto" && lancamento.projeto_id) return buscarProjeto(lancamento.projeto_id)?.nome || "Projeto removido";
    return DESTINOS_FINANCEIRO[lancamento.destino] || "A classificar";
}

function opcoesCategoriaFinanceiro(valor, atual) {
    const categorias = cache.financeiroCategorias.filter((categoria) => categoriaCompativel(categoria, valor) && (categoria.ativo || categoria.id === atual));
    return `<option value="">A classificar</option>${categorias.map((categoria) => `<option value="${categoria.id}" ${categoria.id === atual ? "selected" : ""}>${escapeHtml(categoria.nome)}</option>`).join("")}`;
}

function opcoesProjetosFinanceiro(atual) {
    const projetos = [...cache.projetos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const atualId = atual.startsWith("projeto:") ? Number(atual.split(":")[1]) : null;
    const arquivado = atualId && !projetos.some((p) => p.id === atualId) ? buscarProjeto(atualId) : null;
    if (arquivado) projetos.push({ ...arquivado, nome: `${arquivado.nome} (arquivado)` });
    return `<optgroup label="Projetos">${projetos.map((p) => `<option value="projeto:${p.id}" ${`projeto:${p.id}` === atual ? "selected" : ""}>${escapeHtml(p.nome)}</option>`).join("")}</optgroup>`;
}

function opcoesDestinoFinanceiro(atual) {
    return `
        <option value="">A classificar</option>
        <option value="corporativo" ${atual === "corporativo" ? "selected" : ""}>Corporativo</option>
        <option value="transferencia" ${atual === "transferencia" ? "selected" : ""}>Transferência entre contas</option>
        ${opcoesProjetosFinanceiro(atual)}
    `;
}

function filtrarLancamentosFinanceiro(lista, filtros) {
    const termo = filtros.busca.toLowerCase();
    return lista.filter((lancamento) => {
        if (filtros.tipo === "entradas" && lancamento.valor < 0) return false;
        if (filtros.tipo === "saidas" && lancamento.valor >= 0) return false;
        if (filtros.categoria === "sem" && lancamento.categoria_id) return false;
        if (filtros.categoria && filtros.categoria !== "sem" && lancamento.categoria_id !== Number(filtros.categoria)) return false;
        if (filtros.destino === "pendente" && !lancamentoPendente(lancamento)) return false;
        if (filtros.destino === "projetos" && lancamento.destino !== "projeto") return false;
        if (["corporativo", "transferencia"].includes(filtros.destino) && lancamento.destino !== filtros.destino) return false;
        if (filtros.destino.startsWith("projeto:") && valorDestinoLancamento(lancamento) !== filtros.destino) return false;
        if (termo && !`${lancamento.descricao} ${lancamento.observacao || ""}`.toLowerCase().includes(termo)) return false;
        return true;
    });
}

// Transferencias entre contas proprias nao sao receita nem despesa.
function resumoFinanceiro(lista) {
    const resumo = { entradas: 0, saidas: 0, transferencias: 0, pendentes: 0, porCategoria: new Map(), porDestino: new Map() };
    for (const lancamento of lista) {
        const valor = Number(lancamento.valor);
        if (lancamentoPendente(lancamento)) resumo.pendentes += 1;
        if (lancamento.destino === "transferencia") {
            resumo.transferencias += valor;
            continue;
        }
        if (valor >= 0) resumo.entradas += valor;
        else resumo.saidas += -valor;
        for (const [mapa, chave] of [[resumo.porCategoria, categoriaFinanceira(lancamento.categoria_id)?.nome || "Sem categoria"], [resumo.porDestino, nomeDestinoLancamento(lancamento)]]) {
            const linha = mapa.get(chave) || { nome: chave, entradas: 0, saidas: 0 };
            if (valor >= 0) linha.entradas += valor;
            else linha.saidas += -valor;
            mapa.set(chave, linha);
        }
    }
    resumo.resultado = resumo.entradas - resumo.saidas;
    return resumo;
}

function saldoContasFinanceiro() {
    return cache.financeiroContas.map((conta) => {
        const importacao = cache.financeiroImportacoes
            .filter((item) => item.conta_id === conta.id && item.saldo_final !== null && item.saldo_data)
            .sort((a, b) => b.saldo_data.localeCompare(a.saldo_data))[0];
        return { conta, importacao };
    });
}

function renderTabelaResumoFinanceiro(titulo, coluna, mapa) {
    const linhas = [...mapa.values()].sort((a, b) => (b.entradas + b.saidas) - (a.entradas + a.saidas));
    return `
        <div>
            <h3>${escapeHtml(titulo)}</h3>
            ${linhas.length ? `<table class="tabela-financeiro-resumo">
                <thead><tr><th>${escapeHtml(coluna)}</th><th>Entradas</th><th>Saídas</th><th>Resultado</th></tr></thead>
                <tbody>${linhas.map((linha) => `<tr><td>${escapeHtml(linha.nome)}</td><td>${formatMoeda(linha.entradas)}</td><td>${formatMoeda(linha.saidas)}</td><td class="${linha.entradas - linha.saidas < 0 ? "valor-alerta" : ""}">${formatMoeda(linha.entradas - linha.saidas)}</td></tr>`).join("")}</tbody>
            </table>` : `<p class="vazio compacto">Sem lançamentos no filtro.</p>`}
        </div>
    `;
}

async function renderFinanceiro() {
    const filtros = filtrosFinanceiro();
    financeiroLancamentos = await buscarLancamentosFinanceiro(filtros.de, filtros.ate);
    financeiroSelecionados = new Set();
    desenharFinanceiro();
}

function desenharFinanceiro() {
    const rolagem = window.scrollY;
    const filtros = filtrosFinanceiro();
    const lista = filtrarLancamentosFinanceiro(financeiroLancamentos, filtros);
    const resumo = resumoFinanceiro(lista);
    const saldos = saldoContasFinanceiro();
    financeiroSelecionados = new Set([...financeiroSelecionados].filter((id) => lista.some((l) => l.id === id)));
    const todosSelecionados = lista.length > 0 && lista.every((l) => financeiroSelecionados.has(l.id));
    const categoriasAtivas = cache.financeiroCategorias.filter((categoria) => categoria.ativo);
    const rotuloTipoCategoria = { receita: "Receitas", despesa: "Despesas", ambos: "Receitas e despesas" };

    setPage("Financeiro", "Extrato bancário", `<label class="botao" for="arquivoExtrato">Importar extrato (CSV ou OFX)</label>`);
    conteudo.innerHTML = `
        <input id="arquivoExtrato" type="file" accept=".csv,.ofx" hidden>
        <section class="financeiro-kpis financeiro-topo">
            ${saldos.length ? saldos.map(({ conta, importacao }) => `<div class="kpi"><span>Saldo · ${escapeHtml(conta.nome)}</span><strong>${importacao ? formatMoeda(importacao.saldo_final) : "—"}</strong><small>${importacao ? `em ${escapeHtml(formatData(importacao.saldo_data))}, pelo último extrato` : "sem saldo no extrato"}</small></div>`).join("")
                : `<div class="kpi"><span>Saldo</span><strong>—</strong><small>importe o primeiro extrato</small></div>`}
            <div class="kpi"><span>Entradas no filtro</span><strong>${formatMoeda(resumo.entradas)}</strong><small>sem transferências entre contas</small></div>
            <div class="kpi"><span>Saídas no filtro</span><strong>${formatMoeda(resumo.saidas)}</strong><small>sem transferências entre contas</small></div>
            <div class="kpi"><span>Resultado</span><strong class="${resumo.resultado < 0 ? "valor-alerta" : ""}">${formatMoeda(resumo.resultado)}</strong><small>entradas − saídas</small></div>
            <div class="kpi ${resumo.pendentes ? "kpi-alerta" : ""}"><span>A classificar</span><strong>${resumo.pendentes}</strong><small>${resumo.pendentes ? `<a href="#financeiro?${new URLSearchParams({ ...filtros, destino: "pendente" }).toString()}">ver só os pendentes</a>` : "tudo classificado"}</small></div>
        </section>
        <form id="filtroFinanceiro" class="filtros filtros-financeiro">
            <label>De<input name="de" type="date" value="${escapeHtml(filtros.de)}"></label>
            <label>Até<input name="ate" type="date" value="${escapeHtml(filtros.ate)}"></label>
            <label>Tipo<select name="tipo">
                <option value="todos">Entradas e saídas</option>
                <option value="entradas" ${filtros.tipo === "entradas" ? "selected" : ""}>Só entradas</option>
                <option value="saidas" ${filtros.tipo === "saidas" ? "selected" : ""}>Só saídas</option>
            </select></label>
            <label>Categoria<select name="categoria">
                <option value="">Todas</option>
                <option value="sem" ${filtros.categoria === "sem" ? "selected" : ""}>Sem categoria</option>
                ${cache.financeiroCategorias.map((categoria) => `<option value="${categoria.id}" ${String(categoria.id) === filtros.categoria ? "selected" : ""}>${escapeHtml(categoria.nome)}</option>`).join("")}
            </select></label>
            <label>Destino<select name="destino">
                <option value="">Todos</option>
                <option value="pendente" ${filtros.destino === "pendente" ? "selected" : ""}>A classificar</option>
                <option value="projetos" ${filtros.destino === "projetos" ? "selected" : ""}>Qualquer projeto</option>
                <option value="corporativo" ${filtros.destino === "corporativo" ? "selected" : ""}>Corporativo</option>
                <option value="transferencia" ${filtros.destino === "transferencia" ? "selected" : ""}>Transferência entre contas</option>
                ${opcoesProjetosFinanceiro(filtros.destino)}
            </select></label>
            <label class="busca">Buscar<input name="busca" value="${escapeHtml(filtros.busca)}" placeholder="descrição ou observação"></label>
            <button type="submit">Filtrar</button>
        </form>
        <section class="painel">
            <div class="painel-topo"><h2>Lançamentos</h2><span>${lista.length} lançamento(s) · ${formatData(filtros.de)} a ${formatData(filtros.ate)}</span></div>
            <form id="loteFinanceiro" class="lote-financeiro" ${financeiroSelecionados.size ? "" : "hidden"}>
                <strong>${financeiroSelecionados.size} selecionado(s)</strong>
                <label>Categoria<select name="categoria">
                    <option value="">Manter</option>
                    ${["receita", "despesa", "ambos"].map((tipo) => `<optgroup label="${rotuloTipoCategoria[tipo]}">${categoriasAtivas.filter((c) => c.tipo === tipo).map((c) => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join("")}</optgroup>`).join("")}
                </select></label>
                <label>Destino<select name="destino">
                    <option value="manter">Manter</option>
                    <option value="corporativo">Corporativo</option>
                    <option value="transferencia">Transferência entre contas</option>
                    ${opcoesProjetosFinanceiro("")}
                </select></label>
                <button type="submit">Aplicar</button>
                <button class="secundario" type="button" id="limparSelecaoFinanceiro">Limpar seleção</button>
            </form>
            ${lista.length ? `
            <div class="tabela-rolagem">
                <table class="tabela-extrato">
                    <thead><tr>
                        <th><input type="checkbox" id="selecionarTodosFinanceiro" aria-label="Selecionar todos" ${todosSelecionados ? "checked" : ""}></th>
                        <th>Data</th><th>Descrição</th><th>Valor</th><th>Categoria</th><th>Destino</th><th>Observação</th>
                    </tr></thead>
                    <tbody>
                        ${lista.map((l) => `
                            <tr class="${lancamentoPendente(l) ? "lancamento-pendente" : ""}">
                                <td><input type="checkbox" class="fin-selecionar" data-id="${l.id}" aria-label="Selecionar lançamento" ${financeiroSelecionados.has(l.id) ? "checked" : ""}></td>
                                <td>${escapeHtml(formatData(l.data))}</td>
                                <td class="fin-descricao">${escapeHtml(l.descricao || "—")}</td>
                                <td class="fin-valor ${l.valor < 0 ? "saida" : "entrada"}">${l.valor < 0 ? "−" : "+"} ${formatMoeda(Math.abs(l.valor))}</td>
                                <td><select class="fin-categoria" data-id="${l.id}" aria-label="Categoria">${opcoesCategoriaFinanceiro(l.valor, l.categoria_id)}</select></td>
                                <td><select class="fin-destino" data-id="${l.id}" aria-label="Destino">${opcoesDestinoFinanceiro(valorDestinoLancamento(l))}</select></td>
                                <td><input class="fin-observacao" data-id="${l.id}" value="${escapeHtml(l.observacao || "")}" placeholder="—" aria-label="Observação"></td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>` : `<p class="vazio">${financeiroLancamentos.length ? "Nenhum lançamento com esse filtro." : `Nenhum lançamento neste período. Use "Importar extrato" para trazer o extrato do Mercado Pago.`}</p>`}
        </section>
        <section class="painel financeiro-resumos">
            <div class="painel-topo"><div><h2>Resumo do filtro</h2><p class="subtexto">Transferências entre contas ficam fora${resumo.transferencias ? ` (saldo de ${formatMoeda(resumo.transferencias)} no período)` : ""}.</p></div></div>
            <div class="grid-duas-colunas">
                ${renderTabelaResumoFinanceiro("Por categoria", "Categoria", resumo.porCategoria)}
                ${renderTabelaResumoFinanceiro("Por destino", "Destino", resumo.porDestino)}
            </div>
        </section>
        <details class="painel financeiro-secao">
            <summary><h2>Importações</h2><span>${cache.financeiroImportacoes.length} arquivo(s)</span></summary>
            ${cache.financeiroImportacoes.length ? `<div class="lista-compacta">${cache.financeiroImportacoes.map((item) => `
                <article><div><strong>${escapeHtml(item.arquivo_nome)}</strong><span>${escapeHtml(formatData(item.periodo_inicio))} a ${escapeHtml(formatData(item.periodo_fim))} · ${item.novos} novo(s) de ${item.total_lancamentos} · ${escapeHtml(item.importado_por || "")} · ${escapeHtml(formatDataHora(item.criado_em))}</span></div>
                <button class="secundario botao-excluir-texto desfazer-importacao" type="button" data-id="${item.id}" data-arquivo="${escapeHtml(item.arquivo_nome)}" data-novos="${item.novos}">Desfazer</button></article>
            `).join("")}</div>` : `<p class="vazio compacto">Nenhum extrato importado ainda.</p>`}
        </details>
        <details class="painel financeiro-secao">
            <summary><h2>Categorias</h2><span>${cache.financeiroCategorias.length} categoria(s)</span></summary>
            <p class="subtexto">O destino padrão é aplicado ao escolher a categoria em um lançamento ainda sem destino.</p>
            <div class="lista-categorias-financeiro">
                ${cache.financeiroCategorias.map((categoria) => `
                    <form class="categoria-financeiro-form mini-form" data-id="${categoria.id}">
                        <input name="nome" value="${escapeHtml(categoria.nome)}" required aria-label="Nome">
                        <select name="tipo" aria-label="Tipo">${["receita", "despesa", "ambos"].map((tipo) => `<option value="${tipo}" ${categoria.tipo === tipo ? "selected" : ""}>${rotuloTipoCategoria[tipo]}</option>`).join("")}</select>
                        <select name="destino_padrao" aria-label="Destino padrão"><option value="">Sem destino padrão</option>${Object.entries(DESTINOS_FINANCEIRO).map(([valor, rotulo]) => `<option value="${valor}" ${categoria.destino_padrao === valor ? "selected" : ""}>${rotulo}</option>`).join("")}</select>
                        <label class="checkbox linha-checkbox"><input type="checkbox" name="ativo" ${categoria.ativo ? "checked" : ""}> Ativa</label>
                        <button type="submit">Salvar</button>
                    </form>
                `).join("")}
            </div>
            <form id="novaCategoriaFinanceiro" class="mini-form categoria-financeiro-form">
                <input name="nome" placeholder="Nova categoria" required aria-label="Nome da nova categoria">
                <select name="tipo" aria-label="Tipo"><option value="despesa">Despesas</option><option value="receita">Receitas</option><option value="ambos">Receitas e despesas</option></select>
                <select name="destino_padrao" aria-label="Destino padrão"><option value="">Sem destino padrão</option>${Object.entries(DESTINOS_FINANCEIRO).map(([valor, rotulo]) => `<option value="${valor}">${rotulo}</option>`).join("")}</select>
                <button type="submit">Adicionar categoria</button>
            </form>
        </details>
    `;
    bindFinanceiro();
    window.scrollTo(0, rolagem);
    if (financeiroMensagemPendente) {
        setMensagem(...financeiroMensagemPendente);
        financeiroMensagemPendente = null;
    }
}

function bindFinanceiro() {
    $("#arquivoExtrato").addEventListener("change", (event) => {
        const arquivo = event.target.files?.[0];
        event.target.value = "";
        if (arquivo) importarExtrato(arquivo);
    });
    $("#filtroFinanceiro").addEventListener("submit", (event) => {
        event.preventDefault();
        location.hash = `financeiro?${new URLSearchParams(new FormData(event.target)).toString()}`;
    });
    document.querySelectorAll(".fin-selecionar").forEach((caixa) => caixa.addEventListener("change", () => {
        const id = Number(caixa.dataset.id);
        if (caixa.checked) financeiroSelecionados.add(id);
        else financeiroSelecionados.delete(id);
        desenharFinanceiro();
    }));
    $("#selecionarTodosFinanceiro")?.addEventListener("change", (event) => {
        const visiveis = filtrarLancamentosFinanceiro(financeiroLancamentos, filtrosFinanceiro());
        financeiroSelecionados = event.target.checked ? new Set(visiveis.map((l) => l.id)) : new Set();
        desenharFinanceiro();
    });
    $("#limparSelecaoFinanceiro")?.addEventListener("click", () => {
        financeiroSelecionados = new Set();
        desenharFinanceiro();
    });
    $("#loteFinanceiro")?.addEventListener("submit", aplicarLoteFinanceiro);
    document.querySelectorAll(".fin-categoria").forEach((select) => select.addEventListener("change", () => {
        const lancamento = financeiroLancamentos.find((l) => l.id === Number(select.dataset.id));
        const categoria = categoriaFinanceira(Number(select.value));
        const payload = { categoria_id: categoria ? categoria.id : null };
        if (categoria?.destino_padrao && categoria.destino_padrao !== "projeto" && !lancamento.destino) {
            Object.assign(payload, payloadDestino(categoria.destino_padrao));
        }
        atualizarLancamentosFinanceiro([lancamento.id], payload);
    }));
    document.querySelectorAll(".fin-destino").forEach((select) => select.addEventListener("change", () => {
        atualizarLancamentosFinanceiro([Number(select.dataset.id)], payloadDestino(select.value));
    }));
    document.querySelectorAll(".fin-observacao").forEach((campo) => campo.addEventListener("change", () => {
        atualizarLancamentosFinanceiro([Number(campo.dataset.id)], { observacao: campo.value.trim() || null });
    }));
    document.querySelectorAll(".desfazer-importacao").forEach((botao) => botao.addEventListener("click", () => desfazerImportacaoFinanceiro(botao)));
    document.querySelectorAll(".categoria-financeiro-form[data-id]").forEach((form) => form.addEventListener("submit", salvarCategoriaFinanceiro));
    $("#novaCategoriaFinanceiro").addEventListener("submit", criarCategoriaFinanceiro);
}

async function atualizarLancamentosFinanceiro(ids, payload) {
    if (!ids.length) return;
    const { data, error } = await supabase.from("financeiro_lancamentos").update(payload).in("id", ids).select("*");
    if (error) return setMensagem(error.message, "erro");
    const atualizados = new Map(data.map((linha) => [linha.id, linha]));
    financeiroLancamentos = financeiroLancamentos.map((linha) => atualizados.get(linha.id) || linha);
    desenharFinanceiro();
}

async function aplicarLoteFinanceiro(event) {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(event.target).entries());
    const selecionados = financeiroLancamentos.filter((l) => financeiroSelecionados.has(l.id));
    const categoria = categoriaFinanceira(Number(dados.categoria));
    if (!categoria && dados.destino === "manter") return setMensagem("Escolha uma categoria ou um destino para aplicar.", "erro");
    let ignorados = 0;
    if (categoria) {
        const compativeis = selecionados.filter((l) => categoriaCompativel(categoria, l.valor));
        ignorados = selecionados.length - compativeis.length;
        if (!compativeis.length) return setMensagem(`A categoria "${categoria.nome}" não serve para nenhum dos lançamentos selecionados.`, "erro");
        const { error } = await supabase.from("financeiro_lancamentos").update({ categoria_id: categoria.id }).in("id", compativeis.map((l) => l.id));
        if (error) return setMensagem(error.message, "erro");
        if (dados.destino === "manter" && categoria.destino_padrao && categoria.destino_padrao !== "projeto") {
            const semDestino = compativeis.filter((l) => !l.destino).map((l) => l.id);
            if (semDestino.length) {
                const { error: erroDestino } = await supabase.from("financeiro_lancamentos").update(payloadDestino(categoria.destino_padrao)).in("id", semDestino);
                if (erroDestino) return setMensagem(erroDestino.message, "erro");
            }
        }
    }
    if (dados.destino !== "manter") {
        const { error } = await supabase.from("financeiro_lancamentos").update(payloadDestino(dados.destino)).in("id", selecionados.map((l) => l.id));
        if (error) return setMensagem(error.message, "erro");
    }
    financeiroSelecionados = new Set();
    const partes = [];
    if (categoria) partes.push(`Categoria "${categoria.nome}" aplicada em ${selecionados.length - ignorados} lançamento(s)`);
    if (dados.destino !== "manter") partes.push(`destino aplicado em ${selecionados.length}`);
    if (ignorados) partes.push(`categoria não aplicada em ${ignorados} ${categoria.tipo === "receita" ? "saída(s)" : "entrada(s)"}, por não servir para ${categoria.tipo === "receita" ? "saídas" : "entradas"}`);
    const mensagemLote = partes.join("; ");
    financeiroMensagemPendente = [`${mensagemLote.charAt(0).toUpperCase()}${mensagemLote.slice(1)}.`];
    await renderFinanceiro();
}

function nomeContaExtrato(extrato) {
    if (extrato.nomeConta) return extrato.nomeConta;
    const banco = ["323", "0323"].includes(String(extrato.bancoId)) ? "Mercado Pago" : `Banco ${extrato.bancoId || "?"}`;
    return extrato.contaId ? `${banco} · conta ${extrato.contaId}` : banco;
}

function confirmarImportacaoExtrato(texto, podeImportar) {
    let modal = $("#importarExtratoModal");
    if (!modal) {
        modal = document.createElement("dialog");
        modal.id = "importarExtratoModal";
        modal.className = "modal-confirmar-exclusao modal-importar-extrato";
        modal.innerHTML = `
            <h2>Importar extrato</h2>
            <p class="confirmar-exclusao-mensagem"></p>
            <div class="card-acoes">
                <button class="secundario" type="button" value="cancelar">Cancelar</button>
                <button type="button" value="importar">Importar</button>
            </div>
        `;
        document.body.append(modal);
        modal.querySelectorAll("button").forEach((botao) => botao.addEventListener("click", () => responderDialogo(modal, botao.value === "importar")));
        modal.addEventListener("close", () => responderDialogo(modal, false));
    }
    modal.querySelector(".confirmar-exclusao-mensagem").textContent = texto;
    modal.querySelector('[value="importar"]').hidden = !podeImportar;
    return abrirDialogo(modal);
}

// Aceita OFX de qualquer banco e o CSV de extrato do Mercado Pago; os dois
// leitores devolvem o mesmo formato.
function lerArquivoExtrato(texto) {
    if (/<OFX>/i.test(texto)) return lerOfx(texto);
    if (ehExtratoMercadoPagoCsv(texto)) return lerExtratoMercadoPagoCsv(texto);
    throw new Error("Formato não reconhecido. Envie o extrato OFX ou o CSV de extrato do Mercado Pago.");
}

async function importarExtrato(arquivo) {
    let extrato;
    try {
        extrato = lerArquivoExtrato(decodificarOfx(await arquivo.arrayBuffer()));
    } catch (error) {
        return setMensagem(error.message || "Não foi possível ler o arquivo do extrato.", "erro");
    }
    if (!extrato.lancamentos.length) return setMensagem("Nenhum lançamento encontrado no arquivo.", "erro");

    let conta = cache.financeiroContas.find((c) => c.banco_id === extrato.bancoId && c.conta_id === extrato.contaId);
    const existentes = new Set();
    if (conta) {
        const fitids = extrato.lancamentos.map((l) => l.fitid);
        for (let inicio = 0; inicio < fitids.length; inicio += 150) {
            const { data, error } = await supabase.from("financeiro_lancamentos").select("fitid").eq("conta_id", conta.id).in("fitid", fitids.slice(inicio, inicio + 150));
            if (error) return setMensagem(error.message, "erro");
            data.forEach((linha) => existentes.add(linha.fitid));
        }
    }
    const novos = extrato.lancamentos.filter((l) => !existentes.has(l.fitid));
    const entradas = novos.filter((l) => l.valor >= 0).reduce((soma, l) => soma + l.valor, 0);
    const saidas = novos.filter((l) => l.valor < 0).reduce((soma, l) => soma - l.valor, 0);
    const texto = [
        `Arquivo: ${arquivo.name}`,
        `Conta: ${conta?.nome || nomeContaExtrato(extrato)}${conta ? "" : " (nova)"}`,
        `Período: ${formatData(extrato.periodoInicio)} a ${formatData(extrato.periodoFim)}`,
        extrato.saldoFinal !== null ? `Saldo no extrato: ${formatMoeda(extrato.saldoFinal)} em ${formatData(extrato.saldoData)}` : "",
        extrato.conferencia ? (extrato.conferencia.esperado === extrato.conferencia.calculado
            ? "Conferência: saldo inicial + lançamentos = saldo final ✓"
            : `ATENÇÃO: os lançamentos somam ${formatMoeda(extrato.conferencia.calculado)}, mas o saldo final do arquivo é ${formatMoeda(extrato.conferencia.esperado)}. Confira se o arquivo está completo.`) : "",
        "",
        `${extrato.lancamentos.length} lançamento(s) no arquivo`,
        existentes.size ? `${existentes.size} já importado(s) antes, serão ignorados` : "",
        novos.length ? `${novos.length} novo(s): ${formatMoeda(entradas)} em entradas e ${formatMoeda(saidas)} em saídas` : "Nenhum lançamento novo para importar.",
    ].filter((linha, indice) => linha || indice === 5).join("\n");
    if (!(await confirmarImportacaoExtrato(texto, novos.length > 0))) return;

    if (!conta) {
        const { data, error } = await supabase.from("financeiro_contas").insert({ nome: nomeContaExtrato(extrato), banco_id: extrato.bancoId, conta_id: extrato.contaId }).select().single();
        if (error) return setMensagem(error.message, "erro");
        conta = data;
    }
    const { data: importacao, error: erroImportacao } = await supabase.from("financeiro_importacoes").insert({
        conta_id: conta.id,
        arquivo_nome: arquivo.name,
        periodo_inicio: extrato.periodoInicio,
        periodo_fim: extrato.periodoFim,
        saldo_final: extrato.saldoFinal,
        saldo_data: extrato.saldoData,
        total_lancamentos: extrato.lancamentos.length,
    }).select().single();
    if (erroImportacao) return setMensagem(erroImportacao.message, "erro");

    let inseridos = 0;
    for (let inicio = 0; inicio < novos.length; inicio += 500) {
        const linhas = novos.slice(inicio, inicio + 500).map((l) => ({ ...l, conta_id: conta.id, importacao_id: importacao.id }));
        const { data, error } = await supabase.from("financeiro_lancamentos").upsert(linhas, { onConflict: "conta_id,fitid", ignoreDuplicates: true }).select("id");
        if (error) return setMensagem(`Importação interrompida: ${error.message}. ${inseridos} lançamento(s) já gravado(s); use "Desfazer" em Importações e tente de novo.`, "erro");
        inseridos += data.length;
    }
    await supabase.from("financeiro_importacoes").update({ novos: inseridos }).eq("id", importacao.id);

    financeiroMensagemPendente = [`${inseridos} lançamento(s) importado(s). Agora é só classificar.`];
    const destino = `#financeiro?${new URLSearchParams({ de: extrato.periodoInicio, ate: extrato.periodoFim }).toString()}`;
    if (location.hash === destino) await render();
    else location.hash = destino;
}

async function desfazerImportacaoFinanceiro(botao) {
    const confirmado = await confirmarExclusao(`Desfazer a importação "${botao.dataset.arquivo}"?\n\n${botao.dataset.novos} lançamento(s) trazido(s) por ela e as classificações feitas neles serão apagados.`);
    if (!confirmado) return;
    const { data, error } = await supabase.from("financeiro_importacoes").delete().eq("id", Number(botao.dataset.id)).select("id");
    if (error) return setMensagem(error.message, "erro");
    if (!data?.length) return setMensagem("Nada foi desfeito. Verifique sua permissão.", "erro");
    financeiroMensagemPendente = ["Importação desfeita."];
    await render();
}

function dadosCategoriaFinanceiro(form) {
    const dados = Object.fromEntries(new FormData(form).entries());
    return {
        nome: dados.nome.trim(),
        tipo: dados.tipo,
        destino_padrao: dados.destino_padrao || null,
        ...(form.dataset.id ? { ativo: Boolean(dados.ativo) } : {}),
    };
}

async function salvarCategoriaFinanceiro(event) {
    event.preventDefault();
    const { error } = await supabase.from("financeiro_categorias").update(dadosCategoriaFinanceiro(event.target)).eq("id", Number(event.target.dataset.id));
    if (error) return setMensagem(error.message, "erro");
    financeiroMensagemPendente = ["Categoria salva."];
    await render();
}

async function criarCategoriaFinanceiro(event) {
    event.preventDefault();
    const ordem = Math.max(0, ...cache.financeiroCategorias.map((categoria) => categoria.ordem || 0)) + 10;
    const { error } = await supabase.from("financeiro_categorias").insert({ ...dadosCategoriaFinanceiro(event.target), ordem });
    if (error) return setMensagem(error.message, "erro");
    financeiroMensagemPendente = ["Categoria adicionada."];
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
        // Ao voltar para a aba ou renovar o token, o Supabase reemite eventos
        // para o mesmo usuario; re-renderizar nesses casos fecha modais abertos.
        const mesmoUsuario = session?.user?.id === newSession?.user?.id;
        session = newSession;
        if (mesmoUsuario) {
            atualizarAvatarTopo();
            return;
        }
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
