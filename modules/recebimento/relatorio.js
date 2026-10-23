(function () {
  const CFG = window.TITAN_CONFIG;
  const FMT = window.TITAN_FORMAT;
  const LOGIC = window.TITAN_LOGIC;

  const dados = TITAN_STATE.carregar();
  const elNoData = document.getElementById("no-data");
  const elConteudo = document.getElementById("conteudo");

  if (!dados || !dados.itens || dados.itens.length === 0) {
    elNoData.style.display = "block";
    elConteudo.style.display = "none";
    return;
  }

  document.getElementById("gerado-em").textContent =
    "Gerado em " + FMT.dataHora(new Date(dados.geradoEm));

  let secaoAtiva = "todas";

  // ---------------------------------------------------------------------
  // Cabeçalho / subtítulo
  // ---------------------------------------------------------------------
  function renderSubtitulo() {
    let txt = `Cruzamento entre estoque disponível no picking (<b>${dados.origemEstoque}</b>), o agendamento ` +
      `de entregas de hoje (<b>${dados.origemAgendamento}</b>) e o giro real de venda (<b>${dados.origemPdv}</b>).`;
    if (dados.metaGiro) {
      txt += `<br>Giro calculado com base nas vendas de ${FMT.data(dados.metaGiro.dataMin)} a ` +
        `${FMT.data(dados.metaGiro.dataMax)} (${dados.metaGiro.diasConsiderados} dias corridos)`;
      txt += dados.metaGiro.lojas.length ? ` — loja(s) ${dados.metaGiro.lojas.join(", ")}.` : ".";
    } else {
      txt += `<br><b>Atenção:</b> não foi possível calcular giro a partir do arquivo de PDV — todos os itens foram classificados como SEM GIRO.`;
    }
    document.getElementById("rel-subtitulo").innerHTML = txt;
  }
  renderSubtitulo();

  // ---------------------------------------------------------------------
  // Abas de seção (departamento)
  // ---------------------------------------------------------------------
  function contagemPorSecao() {
    const contagem = {};
    dados.itens.forEach((it) => { contagem[it.secao] = (contagem[it.secao] || 0) + 1; });
    return contagem;
  }

  function renderTabs() {
    const contagem = contagemPorSecao();
    const wrap = document.getElementById("section-tabs");
    const todasSecoes = [{ chave: "todas", nome: "Todas as seções", icone: "🗂️" }]
      .concat(CFG.SECOES)
      .concat([CFG.SECAO_GERAL]);

    wrap.innerHTML = "";
    todasSecoes.forEach((s) => {
      const total = s.chave === "todas" ? dados.itens.length : (contagem[s.chave] || 0);
      if (s.chave !== "todas" && total === 0) return; // esconde seções vazias
      const tab = document.createElement("div");
      tab.className = "section-tab" + (secaoAtiva === s.chave ? " is-active" : "");
      tab.innerHTML = `<span>${s.icone} ${s.nome}</span><span class="section-tab__count">${total}</span>`;
      tab.addEventListener("click", () => { secaoAtiva = s.chave; renderTudo(); });
      wrap.appendChild(tab);
    });
  }

  // ---------------------------------------------------------------------
  // Itens filtrados pela seção ativa
  // ---------------------------------------------------------------------
  function itensFiltrados() {
    if (secaoAtiva === "todas") return dados.itens;
    return dados.itens.filter((it) => it.secao === secaoAtiva);
  }

  // ---------------------------------------------------------------------
  // Resumo (stat cards por categoria)
  // ---------------------------------------------------------------------
  function renderResumo(itens) {
    const wrap = document.getElementById("stat-row");
    const totalAgendado = itens.reduce((s, i) => s + (i.qtde_agendada || 0), 0);
    wrap.innerHTML = "";

    CFG.CATEGORIAS.forEach((cat) => {
      const subset = itens.filter((i) => i.categoria === cat.chave);
      const qtdTotal = subset.reduce((s, i) => s + (i.qtde_agendada || 0), 0);
      const pct = totalAgendado ? Math.round((qtdTotal / totalAgendado) * 100) : 0;
      const div = document.createElement("div");
      div.className = "stat";
      div.style.borderLeftColor = `var(--cat-${cat.css})`;
      div.innerHTML = `
        <div class="stat__value" style="color:var(--cat-${cat.css});">${subset.length}</div>
        <div class="stat__label">${cat.titulo} · ${FMT.numero(qtdTotal)} un (${pct}%)</div>`;
      wrap.appendChild(div);
    });

    const total = document.createElement("div");
    total.className = "stat";
    total.style.borderLeftColor = "var(--ink-1)";
    total.innerHTML = `<div class="stat__value">${itens.length}</div><div class="stat__label">Total · ${FMT.numero(totalAgendado)} un</div>`;
    wrap.appendChild(total);
  }

  // ---------------------------------------------------------------------
  // Endereçamento AEL — visão rápida
  // ---------------------------------------------------------------------
  function renderAelQuick(itens) {
    const armazenar = itens.filter((i) => i.categoria === "ARMAZENAR");
    const jaAel = armazenar.filter((i) => i.ja_no_ael).length;
    const semAel = armazenar.length - jaAel;
    const dispersos = itens.filter((i) => i.posicoes_ael.size >= 2).length;

    const linhas = [
      ["Itens confortáveis que podem ir para o AEL hoje", armazenar.length],
      ["— já têm posição no AEL (endereçar na mesma posição)", jaAel],
      ["— ainda sem posição no AEL (endereçar posição nova)", semAel],
      ["Itens com estoque disperso em 2+ posições no AEL", dispersos],
    ];
    const wrap = document.getElementById("ael-quick");
    wrap.innerHTML = "";
    linhas.forEach(([label, valor]) => {
      const div = document.createElement("div");
      div.className = "stat";
      div.innerHTML = `<div class="stat__value" style="font-size:24px;">${valor}</div><div class="stat__label">${label}</div>`;
      wrap.appendChild(div);
    });
  }

  // ---------------------------------------------------------------------
  // Tabelas por categoria (com estoque editável)
  // ---------------------------------------------------------------------
  function onEstoqueEditado(codigo, inputEl) {
    const novoValor = Number(inputEl.value);
    if (isNaN(novoValor) || novoValor < 0) { inputEl.value = ""; return; }
    const item = dados.itens.find((i) => i.codigo_produto === codigo);
    if (!item) return;
    LOGIC.recategorizarItem(item, novoValor);
    TITAN_STATE.salvar(dados);
    renderTudo();
  }

  function badgeHtml(chave) {
    const cat = CFG.CATEGORIAS.find((c) => c.chave === chave);
    return `<span class="badge badge--${cat.css}"><span class="dot" style="background:var(--cat-${cat.css});"></span>${cat.titulo}</span>`;
  }

  function renderTabelaCategoria(itensCategoria) {
    if (itensCategoria.length === 0) {
      return `<p class="empty-note">Nenhum item nesta categoria hoje.</p>`;
    }
    const linhas = itensCategoria.map((it) => `
      <tr>
        <td class="u-mono">${it.codigo_produto}</td>
        <td>${it.produto || ""}</td>
        <td class="cell-num">${FMT.numero(it.qtde_agendada)}</td>
        <td class="cell-num">
          <input type="number" min="0" class="qtd-input ${it.ajustado ? "ajustado" : ""}"
                 value="${it.estoque_picking}" data-codigo="${it.codigo_produto}">
        </td>
        <td class="cell-num">${FMT.decimal(it.giro_diario, 2)}</td>
        <td class="cell-num">${FMT.diasCobertura(it.dias_cobertura)}</td>
        <td>${it.ja_no_ael ? "SIM" : "não"}</td>
        <td class="cell-muted">${FMT.posicoesAel(it.posicoes_ael)}</td>
        <td>${it.fornecedor || ""}</td>
        <td class="cell-muted">${FMT.docaHorario(it)}</td>
      </tr>`).join("");

    return `
      <div class="table-wrap">
        <table class="data">
          <thead><tr>
            <th>Código</th><th>Descrição</th><th>Qtde. Agend.</th><th>Estoque Picking</th>
            <th>Giro méd./dia</th><th>Dias Cobert.</th><th>Já no AEL?</th>
            <th>Posições no AEL (qtd)</th><th>Fornecedor</th><th>Doca / Horário</th>
          </tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>`;
  }

  function renderCategorias(itens) {
    const container = document.getElementById("categorias-container");
    container.innerHTML = "";
    CFG.CATEGORIAS.forEach((cat) => {
      const subset = itens.filter((i) => i.categoria === cat.chave);
      const sec = document.createElement("section");
      sec.className = "cat-section";
      sec.innerHTML = `
        <div class="cat-section__head">
          <h2 class="cat-section__titulo" style="color:var(--cat-${cat.css});">${cat.titulo}</h2>
          <span class="u-faint">${subset.length} ${subset.length === 1 ? "item" : "itens"}</span>
        </div>
        <p class="cat-section__sub">${cat.subtitulo}</p>
        ${renderTabelaCategoria(subset)}
      `;
      container.appendChild(sec);
    });

    container.querySelectorAll(".qtd-input").forEach((inp) => {
      inp.addEventListener("change", () => onEstoqueEditado(inp.dataset.codigo, inp));
    });
  }

  // ---------------------------------------------------------------------
  // Consolidação AEL
  // ---------------------------------------------------------------------
  function renderConsolidacao(itens) {
    const candidatos = itens.filter((i) => i.posicoes_ael.size >= 2)
      .sort((a, b) => somaMapa(b.posicoes_ael) - somaMapa(a.posicoes_ael));
    const wrap = document.getElementById("consolidacao-container");
    if (candidatos.length === 0) {
      wrap.innerHTML = `<p class="empty-note">Nenhum produto disperso em 2+ posições no AEL hoje.</p>`;
      return;
    }
    const linhas = candidatos.map((it) => `
      <tr>
        <td class="u-mono">${it.codigo_produto}</td>
        <td>${it.produto || ""}</td>
        <td class="cell-num">${FMT.numero(somaMapa(it.posicoes_ael))}</td>
        <td class="cell-num">${it.posicoes_ael.size}</td>
        <td class="cell-muted">${FMT.posicoesAel(it.posicoes_ael)}</td>
      </tr>`).join("");
    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Código</th><th>Descrição</th><th>Qtde. total no AEL</th><th>Nº posições</th><th>Posições atuais (qtd)</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>`;
  }
  function somaMapa(mapa) {
    let s = 0; mapa.forEach((v) => (s += v)); return s;
  }

  // ---------------------------------------------------------------------
  // Render geral
  // ---------------------------------------------------------------------
  function renderTudo() {
    const itens = itensFiltrados();
    renderTabs();
    renderResumo(itens);
    renderAelQuick(itens);
    renderCategorias(itens);
    renderConsolidacao(itens);
  }

  renderTudo();

  document.getElementById("btn-imprimir").addEventListener("click", () => window.print());
  document.getElementById("btn-novo").addEventListener("click", () => {
    if (confirm("Isso vai descartar o relatório atual e voltar para a tela de upload. Continuar?")) {
      TITAN_STATE.limpar();
      window.location.href = "upload.html";
    }
  });
})();
