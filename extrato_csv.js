// Leitura do extrato CSV do Mercado Pago ("account_statement-*.csv"):
// bloco de resumo (INITIAL_BALANCE;CREDITS;DEBITS;FINAL_BALANCE) seguido dos
// lancamentos (RELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;
// TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE), separados por ";", datas
// DD-MM-AAAA e valores no formato 1.234,56.

import { valorOfx } from "./ofx.js";

// Separa uma linha por ";" respeitando campos entre aspas.
export function dividirLinhaCsv(linha, separador = ";") {
    const campos = [];
    let atual = "";
    let aspas = false;
    for (let i = 0; i < linha.length; i += 1) {
        const caractere = linha[i];
        if (aspas) {
            if (caractere === '"' && linha[i + 1] === '"') {
                atual += '"';
                i += 1;
            } else if (caractere === '"') {
                aspas = false;
            } else {
                atual += caractere;
            }
        } else if (caractere === '"') {
            aspas = true;
        } else if (caractere === separador) {
            campos.push(atual.trim());
            atual = "";
        } else {
            atual += caractere;
        }
    }
    campos.push(atual.trim());
    return campos;
}

// "22-04-2026" ou "22/04/2026" -> "2026-04-22"
export function dataCsv(texto) {
    const partes = String(texto || "").trim().match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
    return partes ? `${partes[3]}-${partes[2]}-${partes[1]}` : null;
}

export function ehExtratoMercadoPagoCsv(texto) {
    return /^\s*RELEASE_DATE\s*;/im.test(texto);
}

export function lerExtratoMercadoPagoCsv(texto) {
    const linhas = texto.split(/\r?\n/);
    const indiceCabecalho = linhas.findIndex((linha) => /^\s*RELEASE_DATE\s*;/i.test(linha));
    if (indiceCabecalho < 0) throw new Error("O CSV não parece ser um extrato do Mercado Pago (cabeçalho RELEASE_DATE não encontrado).");

    const cabecalho = dividirLinhaCsv(linhas[indiceCabecalho]).map((coluna) => coluna.toUpperCase());
    const coluna = (nome) => cabecalho.indexOf(nome);
    const [cData, cTipo, cReferencia, cValor] = ["RELEASE_DATE", "TRANSACTION_TYPE", "REFERENCE_ID", "TRANSACTION_NET_AMOUNT"].map(coluna);
    if (cData < 0 || cValor < 0) throw new Error("O CSV do Mercado Pago não tem as colunas de data e valor esperadas.");

    let resumo = null;
    const indiceResumo = linhas.findIndex((linha) => /^\s*INITIAL_BALANCE\s*;/i.test(linha));
    if (indiceResumo >= 0 && linhas[indiceResumo + 1]) {
        const nomes = dividirLinhaCsv(linhas[indiceResumo]).map((nome) => nome.toUpperCase());
        const valores = dividirLinhaCsv(linhas[indiceResumo + 1]);
        const campo = (nome) => valorOfx(valores[nomes.indexOf(nome)]);
        resumo = { saldoInicial: campo("INITIAL_BALANCE"), saldoFinal: campo("FINAL_BALANCE") };
    }

    const ocorrencias = new Map();
    const lancamentos = [];
    for (const linha of linhas.slice(indiceCabecalho + 1)) {
        if (!linha.trim()) continue;
        const campos = dividirLinhaCsv(linha);
        const data = dataCsv(campos[cData]);
        const valor = valorOfx(campos[cValor]);
        if (!data || valor === null) continue;
        const referencia = cReferencia >= 0 ? campos[cReferencia] : "";
        const descricao = (cTipo >= 0 ? campos[cTipo] : "").replace(/\s+/g, " ").trim();
        // A mesma referencia pode aparecer em mais de um movimento (ex.: pagamento
        // e estorno); valor e ocorrencia mantem o identificador unico e estavel.
        const base = referencia ? `mp:${referencia}|${valor}` : `mp-sem-ref:${data}|${valor}|${descricao}`;
        const vezes = (ocorrencias.get(base) || 0) + 1;
        ocorrencias.set(base, vezes);
        lancamentos.push({
            fitid: vezes > 1 ? `${base}|${vezes}` : base,
            data,
            valor,
            descricao,
            tipo_transacao: valor >= 0 ? "CREDIT" : "DEBIT",
        });
    }

    const datas = lancamentos.map((lancamento) => lancamento.data).sort();
    const soma = lancamentos.reduce((total, lancamento) => total + lancamento.valor, 0);
    const conferencia = resumo && resumo.saldoInicial !== null && resumo.saldoFinal !== null
        ? { esperado: resumo.saldoFinal, calculado: Math.round((resumo.saldoInicial + soma) * 100) / 100 }
        : null;
    return {
        // O CSV nao traz o numero da conta: todos os extratos CSV do Mercado Pago
        // vao para a mesma conta.
        bancoId: "323",
        contaId: "mercado-pago",
        nomeConta: "Mercado Pago",
        periodoInicio: datas[0] || null,
        periodoFim: datas.at(-1) || null,
        saldoFinal: resumo?.saldoFinal ?? null,
        saldoData: datas.at(-1) || null,
        conferencia,
        lancamentos,
    };
}
