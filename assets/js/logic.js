/**
 * logic.js
 * ---------------------------------------------------------------------------
 * Cruzamento das 3 fontes e categorização de prioridade. Espelha
 * calcular_giro / categorizar / montar_itens de gerar_relatorio.py.
 * ---------------------------------------------------------------------------
 */
window.TITAN_LOGIC = (function () {
  const CFG = window.TITAN_CONFIG;

  // ---------- utilidades de data/texto -------------------------------------
  function normalizaChave(s) {
    return String(s)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }

  function paraData(valor) {
    if (valor === null || valor === undefined || valor === "") return null;
    if (valor instanceof Date && !isNaN(valor)) {
      return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
    }
    if (typeof valor === "number") {
      // serial de data do Excel (fallback, cellDates normalmente já resolve)
      const d = XLSX.SSF.parse_date_code(valor);
      if (d) return new Date(d.y, d.m - 1, d.d);
      return null;
    }
    if (typeof valor === "string") {
      const texto = valor.trim().slice(0, 10);
      let m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
      m = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    }
    return null;
  }

  function diffDias(a, b) {
    return Math.round((a.getTime() - b.getTime()) / 86400000);
  }

  // ---------- mapeamento de colunas do PDV (por nome, tolerante a acentos) --
  const CANDIDATOS_DATA = ["data de lancamento do cupom fiscal", "data lancamento cupom fiscal", "data"];
  const CANDIDATOS_PRODUTO = ["no do produto", "numero do produto", "codigo do produto", "codigo produto", "produto"];
  const CANDIDATOS_QTD = ["quantidade vendida", "qtd vendida", "qtd. vendida"];
  const CANDIDATOS_LOJA = ["loja"];

  function mapaColunas(registroExemplo) {
    const mapaNorm = new Map();
    Object.keys(registroExemplo).forEach((k) => mapaNorm.set(normalizaChave(k), k));
    const encontra = (candidatos) => {
      for (const c of candidatos) if (mapaNorm.has(c)) return mapaNorm.get(c);
      return null;
    };
    return {
      data: encontra(CANDIDATOS_DATA),
      produto: encontra(CANDIDATOS_PRODUTO),
      qtd: encontra(CANDIDATOS_QTD),
      loja: encontra(CANDIDATOS_LOJA),
    };
  }

  // ---------- giro (venda média diária, janela móvel de 30 dias) -----------
  function calcularGiro(pdvRegistros, diasJanela) {
    diasJanela = diasJanela || CFG.DIAS_JANELA_GIRO;
    if (!pdvRegistros || pdvRegistros.length === 0) return { giro: new Map(), meta: null };

    const colunas = mapaColunas(pdvRegistros[0]);
    if (!colunas.data || !colunas.produto || !colunas.qtd) {
      throw new Error(
        "Não foi possível identificar as colunas de data/produto/quantidade vendida no arquivo de PDV. " +
        "Colunas encontradas: " + Object.keys(pdvRegistros[0]).join(", ")
      );
    }

    const registrosValidos = [];
    for (const r of pdvRegistros) {
      const data = paraData(r[colunas.data]);
      const codigo = r[colunas.produto];
      const qtd = r[colunas.qtd] || 0;
      const loja = colunas.loja ? r[colunas.loja] : null;
      if (data === null || codigo === null || codigo === undefined) continue;
      registrosValidos.push({ data, codigo: String(codigo).trim(), qtd: Number(qtd) || 0, loja });
    }
    if (registrosValidos.length === 0) return { giro: new Map(), meta: null };

    const dataMax = new Date(Math.max(...registrosValidos.map((r) => r.data.getTime())));
    const dataCorte = new Date(dataMax);
    dataCorte.setDate(dataCorte.getDate() - (diasJanela - 1));

    const janela = registrosValidos.filter((r) => r.data.getTime() >= dataCorte.getTime());
    if (janela.length === 0) return { giro: new Map(), meta: null };

    const dataMinJanela = new Date(Math.min(...janela.map((r) => r.data.getTime())));
    const diasConsiderados = diffDias(dataMax, dataMinJanela) + 1;

    const somaPorProduto = new Map();
    for (const r of janela) somaPorProduto.set(r.codigo, (somaPorProduto.get(r.codigo) || 0) + r.qtd);

    const giro = new Map();
    somaPorProduto.forEach((total, codigo) => giro.set(codigo, total / diasConsiderados));

    const lojasSet = new Set();
    janela.forEach((r) => { if (r.loja !== null && r.loja !== undefined) lojasSet.add(String(r.loja)); });

    return {
      giro,
      meta: {
        dataMin: dataMinJanela,
        dataMax,
        diasConsiderados,
        lojas: Array.from(lojasSet).sort(),
      },
    };
  }

  // ---------- categorização ---------------------------------------------
  function categorizar(estoquePicking, giroDiario) {
    if (giroDiario === null || giroDiario === undefined || giroDiario <= 0) {
      return { categoria: "SEM_GIRO", diasCobertura: null };
    }
    const diasCobertura = estoquePicking / giroDiario;
    if (estoquePicking <= 0) return { categoria: "RUPTURA", diasCobertura };
    if (diasCobertura < CFG.LIMIAR_CRITICO_DIAS) return { categoria: "CRITICO", diasCobertura };
    if (diasCobertura < CFG.LIMIAR_MODERADO_DIAS) return { categoria: "MODERADO", diasCobertura };
    return { categoria: "ARMAZENAR", diasCobertura };
  }

  function extrairFornecedor(texto) {
    if (!texto) return "";
    const s = String(texto);
    const idx = s.indexOf(" - ");
    if (idx >= 0) return s.slice(idx + 3).trim();
    return s.trim();
  }

  // ---------- classificação de seção (departamento) --------------------
  function classificarSecao(descricaoProduto) {
    const desc = normalizaChave(descricaoProduto || "");
    for (const secao of CFG.SECOES) {
      for (const termo of secao.termos) {
        if (desc.includes(normalizaChave(termo))) return secao.chave;
      }
    }
    return CFG.SECAO_GERAL.chave;
  }

  // ---------- montagem dos itens (agrega agendamentos + estoque + giro) --
  function montarItens(agendamentos, estoquePorProduto, giroPorProduto) {
    const agg = new Map();

    for (const ag of agendamentos) {
      const codigo = ag.codigo_produto;
      if (!codigo) continue;
      if (!agg.has(codigo)) {
        agg.set(codigo, {
          codigo_produto: codigo,
          produto: ag.produto,
          qtde_agendada: 0,
          pedidos: new Set(),
          fornecedor: ag.fornecedor,
          doca_entrega: ag.doca_entrega,
          data_inicio: ag.data_inicio ? paraData(ag.data_inicio) : null,
        });
      }
      const item = agg.get(codigo);
      item.qtde_agendada += ag.qtde_agendada || 0;
      if (ag.numero_pedido) item.pedidos.add(ag.numero_pedido);

      const dataAg = ag.data_inicio ? paraData(ag.data_inicio) : null;
      if (dataAg && (item.data_inicio === null || dataAg.getTime() < item.data_inicio.getTime())) {
        item.data_inicio = dataAg;
        item.doca_entrega = ag.doca_entrega;
        item.fornecedor = ag.fornecedor;
      }
    }

    const itens = [];
    agg.forEach((item, codigo) => {
      const est = estoquePorProduto.get(codigo) || { picking: 0, ael: new Map(), descricao: null };
      const picking = est.picking;
      const ael = new Map(est.ael);
      const qtdeAgendada = item.qtde_agendada || 0;
      const giroDiario = giroPorProduto.has(codigo) ? giroPorProduto.get(codigo) : 0.0;

      const { categoria, diasCobertura } = categorizar(picking, giroDiario);
      const descricao = item.produto || est.descricao || "";

      itens.push({
        codigo_produto: codigo,
        produto: descricao,
        qtde_agendada: qtdeAgendada,
        estoque_picking: picking,
        estoque_picking_original: picking,
        giro_diario: giroDiario,
        dias_cobertura: diasCobertura,
        categoria,
        ja_no_ael: ael.size > 0,
        posicoes_ael: ael,
        fornecedor: extrairFornecedor(item.fornecedor),
        doca_entrega: item.doca_entrega,
        data_inicio: item.data_inicio,
        pedidos: item.pedidos,
        secao: classificarSecao(descricao),
        ajustado: false,
      });
    });

    itens.sort((a, b) => {
      const chaveA = a.dias_cobertura === null ? [1, -(a.qtde_agendada || 0)] : [0, a.dias_cobertura];
      const chaveB = b.dias_cobertura === null ? [1, -(b.qtde_agendada || 0)] : [0, b.dias_cobertura];
      if (chaveA[0] !== chaveB[0]) return chaveA[0] - chaveB[0];
      return chaveA[1] - chaveB[1];
    });
    return itens;
  }

  /** Recalcula categoria/dias de cobertura de um item após ajuste manual de estoque. */
  function recategorizarItem(item, novoEstoquePicking) {
    item.estoque_picking = novoEstoquePicking;
    item.ajustado = novoEstoquePicking !== item.estoque_picking_original;
    const { categoria, diasCobertura } = categorizar(novoEstoquePicking, item.giro_diario);
    item.categoria = categoria;
    item.dias_cobertura = diasCobertura;
    return item;
  }

  return {
    normalizaChave, paraData, mapaColunas, calcularGiro, categorizar,
    extrairFornecedor, classificarSecao, montarItens, recategorizarItem,
  };
})();
