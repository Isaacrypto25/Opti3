/**
 * parsers.js
 * ---------------------------------------------------------------------------
 * Leitura das 3 fontes de dados. Espelha, célula a célula, a lógica original
 * de gerar_relatorio.py (ler_agendamentos, ler_estoque, ler_pdv). Qualquer
 * mudança de layout das planilhas de origem deve ser refletida aqui.
 * ---------------------------------------------------------------------------
 */
window.TITAN_PARSERS = (function () {

  function lerArquivoComoArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  function lerArquivoComoTexto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file, "utf-8");
    });
  }

  // Algumas planilhas exportadas (ex.: SAP/MON) trazem a tag de dimensão
  // (<dimension ref="A1:L3"/>) desatualizada — cobrindo só o cabeçalho —
  // mesmo com dados reais até a linha 62+. O XLSX.js usa essa dimensão
  // para decidir até onde ler, então a leitura para cedo e o cruzamento
  // fica vazio. Corrige recalculando o range real a partir das células
  // que de fato existem na planilha.
  function corrigirDimensao(ws) {
    let range = null;
    Object.keys(ws).forEach((key) => {
      if (key[0] === "!") return;
      const addr = XLSX.utils.decode_cell(key);
      if (!range) {
        range = { s: { r: addr.r, c: addr.c }, e: { r: addr.r, c: addr.c } };
      } else {
        if (addr.r < range.s.r) range.s.r = addr.r;
        if (addr.c < range.s.c) range.s.c = addr.c;
        if (addr.r > range.e.r) range.e.r = addr.r;
        if (addr.c > range.e.c) range.e.c = addr.c;
      }
    });
    if (range) ws["!ref"] = XLSX.utils.encode_range(range);
  }

  async function abrirWorkbook(file) {
    const buf = await lerArquivoComoArrayBuffer(file);
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    Object.keys(wb.Sheets).forEach((nome) => corrigirDimensao(wb.Sheets[nome]));
    return wb;
  }

  function planilhaComoMatriz(ws) {
    // array de arrays, célula bruta (números/strings/Date), como openpyxl values_only=True
    return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
  }

  function planilhaComoObjetos(ws) {
    // array de objetos {cabecalho: valor}, como dict(zip(header,row)) do python
    return XLSX.utils.sheet_to_json(ws, { raw: true, defval: null });
  }

  // --------------------------------------------------------------------------
  // AGENDAMENTOS — aba "AGENDAMENTOS", cabeçalho fixo na linha 3, dados da 4
  // --------------------------------------------------------------------------
  async function lerAgendamentos(file) {
    const wb = await abrirWorkbook(file);
    const wsName = wb.SheetNames.includes("AGENDAMENTOS") ? "AGENDAMENTOS" : wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    const matriz = planilhaComoMatriz(ws);

    const linhas = [];
    // min_row=4 (1-based) => índice 3 em 0-based
    for (let i = 3; i < matriz.length; i++) {
      const row = matriz[i] || [];
      const col = (idx) => (row[idx] === undefined ? null : row[idx]);
      if (col(0) === null && col(2) === null) continue;
      linhas.push({
        numero_pedido: col(0),
        numero_nf: col(1),
        codigo_produto: col(2) !== null ? String(col(2)).trim() : null,
        produto: col(3),
        qtde_agendada: col(4) || 0,
        qtde_confirmada_nf: col(5) || 0,
        data_inicio: col(6),
        data_fim: col(7),
        id_agendamento: col(8),
        local_entrega: col(9),
        doca_entrega: col(10),
        fornecedor: col(11),
      });
    }
    return linhas;
  }

  // --------------------------------------------------------------------------
  // ESTOQUE DISPONÍVEL — aba "Data": agrupa por código, separa PKL / AEL
  // --------------------------------------------------------------------------
  async function lerEstoque(file) {
    const wb = await abrirWorkbook(file);
    const wsName = wb.SheetNames.includes("Data") ? "Data" : wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    const matriz = planilhaComoMatriz(ws);

    const dados = new Map(); // codigo -> {picking, ael:Map(posicao->qtd), descricao}
    const getReg = (codigo) => {
      if (!dados.has(codigo)) dados.set(codigo, { picking: 0, ael: new Map(), descricao: null });
      return dados.get(codigo);
    };

    // min_row=2 (1-based) => índice 1 em 0-based (pula cabeçalho na linha 1)
    for (let i = 1; i < matriz.length; i++) {
      const row = matriz[i] || [];
      const codigoRaw = row[2];
      if (codigoRaw === null || codigoRaw === undefined) continue;
      const codigo = String(codigoRaw).trim();
      const tipoDeposito = row[0];
      const posicao = row[1];
      const descricao = row[3];
      const qtdDisponivel = row[4] || 0;

      const reg = getReg(codigo);
      if (reg.descricao === null && descricao) reg.descricao = descricao;

      if (tipoDeposito === "PKL") {
        reg.picking += Number(qtdDisponivel) || 0;
      } else if (tipoDeposito === "AEL" && posicao) {
        const posStr = String(posicao);
        reg.ael.set(posStr, (reg.ael.get(posStr) || 0) + (Number(qtdDisponivel) || 0));
      }
    }
    return dados;
  }

  // --------------------------------------------------------------------------
  // PDV — aceita .json ou .xlsx (aba "PDV"), detecção de colunas por nome
  // --------------------------------------------------------------------------
  async function lerPDV(file) {
    const nome = file.name.toLowerCase();
    if (nome.endsWith(".json")) {
      const texto = await lerArquivoComoTexto(file);
      return JSON.parse(texto);
    }
    const wb = await abrirWorkbook(file);
    const wsName = wb.SheetNames.includes("PDV") ? "PDV" : wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    return planilhaComoObjetos(ws);
  }

  return { lerAgendamentos, lerEstoque, lerPDV };
})();
