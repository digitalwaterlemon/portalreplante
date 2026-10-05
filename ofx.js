// Leitura de extratos OFX (bancos exportam tanto OFX 1.x/SGML, com tags de
// valor sem fechamento, quanto OFX 2.x/XML).

export function decodificarOfx(buffer) {
    const bytes = new Uint8Array(buffer);
    const cabecalho = new TextDecoder("latin1").decode(bytes.slice(0, 1024));
    if (/CHARSET\s*:\s*1252|encoding\s*=\s*["']?(windows-1252|iso-8859-1)/i.test(cabecalho)) {
        return new TextDecoder("windows-1252").decode(bytes);
    }
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
        return new TextDecoder("windows-1252").decode(bytes);
    }
}

function valorTag(bloco, tag) {
    const encontrado = bloco.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
    return encontrado ? decodificarEntidades(encontrado[1].trim()) : "";
}

function decodificarEntidades(texto) {
    return texto
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&quot;", '"')
        .replaceAll("&apos;", "'")
        .replaceAll("&amp;", "&");
}

// "20261005120000[-3:BRT]" -> "2026-10-05"
export function dataOfx(texto) {
    const digitos = String(texto || "").match(/^(\d{4})(\d{2})(\d{2})/);
    return digitos ? `${digitos[1]}-${digitos[2]}-${digitos[3]}` : null;
}

// "-1234.56", "-1234,56" ou "-1.234,56" -> -1234.56
export function valorOfx(texto) {
    let limpo = String(texto || "").replace(/\s/g, "");
    if (limpo.includes(",")) limpo = limpo.replaceAll(".", "").replace(",", ".");
    const numero = Number(limpo);
    return Number.isFinite(numero) ? Math.round(numero * 100) / 100 : null;
}

export function lerOfx(texto) {
    const inicio = texto.search(/<OFX>/i);
    if (inicio < 0) throw new Error("O arquivo não parece ser um extrato OFX.");
    const corpo = texto.slice(inicio);
    const contaBloco = corpo.match(/<(BANKACCTFROM|CCACCTFROM)>([\s\S]*?)<\/\1>/i)?.[2] || corpo;
    const saldoBloco = corpo.match(/<LEDGERBAL>([\s\S]*?)<\/LEDGERBAL>/i)?.[1] || "";
    const listaBloco = corpo.match(/<BANKTRANLIST>([\s\S]*?)<\/BANKTRANLIST>/i)?.[1] || corpo;

    const ocorrencias = new Map();
    const lancamentos = [...listaBloco.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)].map(([, bloco]) => {
        const data = dataOfx(valorTag(bloco, "DTPOSTED"));
        const valor = valorOfx(valorTag(bloco, "TRNAMT"));
        const nome = valorTag(bloco, "NAME");
        const memo = valorTag(bloco, "MEMO");
        const descricao = [nome, memo].filter((parte, indice, partes) => parte && partes.indexOf(parte) === indice).join(" · ");
        let fitid = valorTag(bloco, "FITID");
        if (!fitid) {
            // Sem identificador do banco: gera um estavel a partir do conteudo,
            // diferenciando lancamentos identicos no mesmo arquivo.
            const base = `${data}|${valor}|${descricao}`;
            const vezes = (ocorrencias.get(base) || 0) + 1;
            ocorrencias.set(base, vezes);
            fitid = `sem-fitid|${base}|${vezes}`;
        }
        return { fitid, data, valor, descricao, tipo_transacao: valorTag(bloco, "TRNTYPE") || null };
    }).filter((lancamento) => lancamento.data && lancamento.valor !== null);

    const datas = lancamentos.map((lancamento) => lancamento.data).sort();
    return {
        bancoId: valorTag(contaBloco, "BANKID") || null,
        contaId: valorTag(contaBloco, "ACCTID") || null,
        periodoInicio: dataOfx(valorTag(listaBloco, "DTSTART")) || datas[0] || null,
        periodoFim: dataOfx(valorTag(listaBloco, "DTEND")) || datas.at(-1) || null,
        saldoFinal: saldoBloco ? valorOfx(valorTag(saldoBloco, "BALAMT")) : null,
        saldoData: saldoBloco ? dataOfx(valorTag(saldoBloco, "DTASOF")) : null,
        lancamentos,
    };
}
