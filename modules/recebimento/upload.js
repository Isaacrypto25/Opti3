(function () {
  const FONTES = [
    {
      id: "agendamento",
      titulo: "Agendamento de Entregas",
      icone: "📅",
      accept: ".xlsx",
      exemploNome: "Agendamentos*.xlsx",
      instrucao: "Onde encontrar: <b>SAP / MON</b> → <b>Agendamentos por Item</b> → exportar planilha → fazer upload aqui. Precisa ter a aba <b>AGENDAMENTOS</b> (cabeçalho na linha 3).",
    },
    {
      id: "estoque",
      titulo: "Estoque Disponível",
      icone: "🏷️",
      accept: ".xlsx",
      exemploNome: "estoque-disponivel*.xlsx",
      instrucao: "Onde encontrar: <b>SAP / MON / Estoque Físico</b> → extrair planilha → fazer upload aqui. Precisa ter a aba <b>Data</b>, com colunas Tipo de Depósito, Posição, Código Produto, Descrição, Qtd. Disponível.",
    },
    {
      id: "pdv",
      titulo: "PDV — Giro de Vendas",
      icone: "🧾",
      accept: ".xlsx,.json",
      exemploNome: "pdv*.xlsx ou pdv*.json",
      instrucao: "Onde encontrar: sistema de vendas / retaguarda → exportar cupons fiscais do período → aceita <b>Excel</b> (aba PDV) ou <b>JSON</b>. Precisa ter colunas de data, código do produto e quantidade vendida.",
    },
  ];

  const arquivos = {}; // id -> File
  const grid = document.getElementById("grid-uploads");
  const btnProcessar = document.getElementById("btn-processar");
  const statusEl = document.getElementById("status-processamento");
  const erroEl = document.getElementById("area-erro");

  function montarBox(fonte) {
    const box = document.createElement("div");
    box.className = "upload-box";
    box.id = `box-${fonte.id}`;
    box.innerHTML = `
      <div class="upload-box__head">
        <div class="upload-box__icon">${fonte.icone}</div>
        <div>
          <div class="upload-box__title">${fonte.titulo}</div>
          <div class="u-faint" style="font-size:11.5px;">${fonte.exemploNome}</div>
        </div>
      </div>
      <div class="upload-box__hint">${fonte.instrucao}</div>
      <label class="upload-box__drop" for="input-${fonte.id}">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 16V4M12 4l-4 4M12 4l4 4"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>
        </svg>
        <span id="texto-drop-${fonte.id}">Arraste o arquivo aqui ou clique para selecionar</span>
        <input type="file" id="input-${fonte.id}" accept="${fonte.accept}">
      </label>
    `;
    return box;
  }

  FONTES.forEach((f) => grid.appendChild(montarBox(f)));

  function marcarCarregado(fonte, file) {
    arquivos[fonte.id] = file;
    const box = document.getElementById(`box-${fonte.id}`);
    box.classList.add("is-filled");
    document.getElementById(`texto-drop-${fonte.id}`).innerHTML =
      `✓ carregado<br><span class="upload-box__filename">${file.name}</span>`;
    atualizarBotao();
  }

  function atualizarBotao() {
    const completos = FONTES.every((f) => arquivos[f.id]);
    btnProcessar.disabled = !completos;
  }

  FONTES.forEach((fonte) => {
    const box = document.getElementById(`box-${fonte.id}`);
    const input = document.getElementById(`input-${fonte.id}`);

    input.addEventListener("change", (e) => {
      if (e.target.files[0]) marcarCarregado(fonte, e.target.files[0]);
    });

    ["dragenter", "dragover"].forEach((evt) => {
      box.addEventListener(evt, (e) => { e.preventDefault(); box.classList.add("is-dragover"); });
    });
    ["dragleave", "drop"].forEach((evt) => {
      box.addEventListener(evt, (e) => { e.preventDefault(); box.classList.remove("is-dragover"); });
    });
    box.addEventListener("drop", (e) => {
      const file = e.dataTransfer.files[0];
      if (file) marcarCarregado(fonte, file);
    });
  });

  function mostrarErro(msg) {
    erroEl.style.display = "block";
    erroEl.innerHTML = `<div class="alert alert--error">
      <strong style="white-space:nowrap;">Não gerado —</strong> <span>${msg}</span>
    </div>`;
  }
  function limparErro() {
    erroEl.style.display = "none";
    erroEl.innerHTML = "";
  }

  btnProcessar.addEventListener("click", async () => {
    limparErro();
    btnProcessar.disabled = true;
    statusEl.textContent = "Lendo planilhas…";
    try {
      const agendamentos = await TITAN_PARSERS.lerAgendamentos(arquivos.agendamento);
      const estoquePorProduto = await TITAN_PARSERS.lerEstoque(arquivos.estoque);

      statusEl.textContent = "Calculando giro de venda…";
      const pdvRegistros = await TITAN_PARSERS.lerPDV(arquivos.pdv);
      const { giro, meta } = TITAN_LOGIC.calcularGiro(pdvRegistros);

      statusEl.textContent = "Cruzando fontes…";
      const itens = TITAN_LOGIC.montarItens(agendamentos, estoquePorProduto, giro);

      TITAN_STATE.salvar({
        geradoEm: new Date().toISOString(),
        origemAgendamento: arquivos.agendamento.name,
        origemEstoque: arquivos.estoque.name,
        origemPdv: arquivos.pdv.name,
        metaGiro: meta,
        itens,
      });

      statusEl.textContent = `Pronto — ${itens.length} itens. Abrindo relatório…`;
      window.location.href = "relatorio.html";
    } catch (err) {
      console.error(err);
      mostrarErro(err.message || "Erro ao processar os arquivos. Confira o formato das planilhas.");
      statusEl.textContent = "";
      atualizarBotao();
    }
  });
})();
