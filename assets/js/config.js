/**
 * config.js
 * ---------------------------------------------------------------------------
 * Configuração central do TITAN. Este é o ÚNICO arquivo que precisa ser
 * editado para:
 *   1) adicionar/remover uma FERRAMENTA no hub (index.html)
 *   2) adicionar/remover uma SEÇÃO/departamento (aba de filtro no relatório)
 *   3) ajustar as palavras-chave que classificam um produto em uma seção
 *   4) ajustar limiares de dias de cobertura usados na priorização
 *
 * Nenhuma outra página precisa ser tocada para essas mudanças.
 * ---------------------------------------------------------------------------
 */
window.TITAN_CONFIG = (function () {

  // ===========================================================================
  // 1) FERRAMENTAS — cada card do hub (index.html)
  //    status: "disponivel" | "bloqueado"
  // ===========================================================================
  const FERRAMENTAS = [
    {
      id: "recebimento",
      nome: "Planejamento de Recebimento",
      descricao: "Cruza estoque de picking, agendamento de entregas e giro real (PDV) para priorizar reabastecimento.",
      icone: "📦",
      status: "disponivel",
      href: "modules/recebimento/upload.html",
    },
    {
      id: "scan-to-price",
      nome: "Scan to Price",
      descricao: "Leitura de código de barras com consulta instantânea de preço na etiqueta.",
      icone: "🔎",
      status: "bloqueado",
      href: "modules/scan-to-price/index.html",
    },
    {
      id: "whatsapp-obm",
      nome: "WhatsApp OBM Lookup",
      descricao: "Consulta de pedidos e status OBM diretamente pelo WhatsApp.",
      icone: "💬",
      status: "bloqueado",
      href: "modules/whatsapp-obm/index.html",
    },
  ];

  // ===========================================================================
  // 2) SEÇÕES / DEPARTAMENTOS — abas de filtro dentro do relatório
  //    "chave" é usada internamente; "termos" alimenta o classificador
  //    automático (ver classificarSecao, em logic.js). Ajuste livremente.
  // ===========================================================================
  const SECOES = [
    { chave: "hidraulica",  nome: "Hidráulica",         icone: "🚿",
      termos: ["hidraulic", "tubo", "conex", "joelho", "registro", "torneira", "cano", "adaptador", "valvula", "mangueira", "cotovelo"] },
    { chave: "eletrica",    nome: "Elétrica",           icone: "🔌",
      termos: ["eletric", "fio ", "cabo", "disjuntor", "lampad", "led", "tomada", "interruptor", "fita isolante", "luminaria", "reator"] },
    { chave: "banheiro_cozinha", nome: "Banheiros e Cozinha", icone: "🛁",
      termos: ["cuba", "bacia sanitaria", "vaso sanit", "chuveiro", "torneira", "sifao", "assento sanit", "pia", "bancada"] },
    { chave: "drive",       nome: "Drive",              icone: "🚚",
      termos: ["drive", "retirada rapida"] },
    { chave: "ferragens",   nome: "Ferragens",          icone: "🔩",
      termos: ["parafuso", "porca", "arruela", "prego", "dobradica", "cadeado", "fechadura", "corrente", "abracadeira"] },
    { chave: "marcenaria",  nome: "Marcenaria",         icone: "🪚",
      termos: ["mdf", "compensado", "madeira", "verniz", "cola madeira", "lixa", "friso", "rodape"] },
    { chave: "pisos_ceramica", nome: "Pisos e Cerâmica", icone: "🧱",
      termos: ["piso", "porcelanato", "ceramic", "rejunte", "argamassa", "azulejo", "rodape ceramico"] },
    { chave: "ferramentas", nome: "Ferramentas",        icone: "🛠️",
      termos: ["furadeira", "parafusadeira", "serra", "martelo", "chave de fenda", "alicate", "trena", "esmerilhadeira", "ferramenta"] },
    { chave: "pintura",     nome: "Pintura",            icone: "🎨",
      termos: ["tinta", "pincel", "rolo de pintura", "massa corrida", "verniz", "solvente", "selador", "fita crepe"] },
  ];
  // seção usada quando nenhum termo confere com a descrição do produto
  const SECAO_GERAL = { chave: "geral", nome: "Não classificado", icone: "📋", termos: [] };

  // ===========================================================================
  // 3) CATEGORIAS DE PRIORIDADE — idêntico à lógica do gerar_relatorio.py
  // ===========================================================================
  const LIMIAR_CRITICO_DIAS = 3;
  const LIMIAR_MODERADO_DIAS = 10;
  const DIAS_JANELA_GIRO = 30;

  const CATEGORIAS = [
    { chave: "RUPTURA", titulo: "Ruptura", css: "ruptura",
      subtitulo: "Saída comprovada nos últimos 30 dias e picking zerado agora. Prioridade máxima — repor antes de qualquer outra tarefa." },
    { chave: "CRITICO", titulo: "Crítico", css: "critico",
      subtitulo: "No ritmo de venda atual, o picking se esgota em menos de 3 dias. Repor logo após os itens em ruptura." },
    { chave: "MODERADO", titulo: "Moderado", css: "moderado",
      subtitulo: "Cobertura de curto prazo. Programe a reposição nos próximos dias." },
    { chave: "ARMAZENAR", titulo: "Confortável", css: "armazenar",
      subtitulo: "Estoque de picking cobre bem a demanda real de venda. Baixa prioridade — pode seguir para o AEL." },
    { chave: "SEM_GIRO", titulo: "Sem giro", css: "semgiro",
      subtitulo: "Nenhuma venda registrada no período. Pode ser item novo, sazonal ou parado. Revisar manualmente." },
  ];

  return {
    FERRAMENTAS, SECOES, SECAO_GERAL, CATEGORIAS,
    LIMIAR_CRITICO_DIAS, LIMIAR_MODERADO_DIAS, DIAS_JANELA_GIRO,
  };
})();
