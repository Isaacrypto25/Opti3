# OPTI3 — Painel Operacional

Identidade visual Obramax (navy institucional + laranja de marca), com logo no topbar de todas as telas.

Sistema estático (HTML + CSS + JS puro — **sem backend, sem instalação**). Roda em
qualquer navegador moderno, abrindo `index.html` direto ou publicando a pasta
inteira num servidor/rede interna. Todo o cruzamento de dados acontece no
próprio navegador do operador; nada é enviado para fora da máquina.

## Como rodar

- **Uso local rápido:** dê duplo clique em `index.html`.
- **Uso em rede (recomendado):** publique a pasta `opti3/` inteira
  num servidor HTTP simples (IIS, Nginx, ou até `python3 -m http.server` numa
  máquina da rede interna) e distribua o link para os operadores.
- Não precisa de internet, **exceto** para carregar as fontes do Google Fonts
  (`base.css`) — se o ambiente for 100% offline, baixe as fontes e troque o
  `@import` por arquivos locais em `assets/css/base.css`.

## Estrutura de pastas

```
opti3/
├── index.html                     → Hub: seleção de ferramentas
├── assets/
│   ├── css/
│   │   ├── tokens.css             → paleta, tipografia, espaçamento (edite aqui a "cara" do sistema)
│   │   ├── base.css                → reset, topbar, layout de página
│   │   └── components.css          → cards, tabelas, upload boxes, tabs, badges
│   └── js/
│       ├── vendor/xlsx.full.min.js → SheetJS (leitura de .xlsx no navegador, offline)
│       ├── config.js                → ⭐ ARQUIVO CENTRAL — ferramentas, seções, categorias
│       ├── parsers.js               → leitura das 3 fontes (equivalente a ler_agendamentos/ler_estoque/ler_pdv do .py)
│       ├── logic.js                 → cruzamento e categorização (equivalente a calcular_giro/categorizar/montar_itens do .py)
│       ├── format.js                → formatação de número/data/posições AEL
│       └── state.js                 → ponte de dados entre a tela de upload e a de relatório
└── modules/
    ├── recebimento/                 → ✅ disponível
    │   ├── upload.html + upload.js   → tela de carregamento das 3 fontes
    │   └── relatorio.html + relatorio.js → relatório final, com abas de seção e estoque editável
    ├── scan-to-price/index.html     → 🔒 bloqueado (placeholder "disponível em breve")
    └── whatsapp-obm/index.html      → 🔒 bloqueado (placeholder "disponível em breve")
```

## Como o cruzamento funciona (idêntico ao `gerar_relatorio.py`)

1. **Agendamentos** (`Agendamentos*.xlsx`, aba `AGENDAMENTOS`, cabeçalho na
   linha 3): o que chega hoje, agregado por Código Produto (soma pedidos do
   mesmo dia).
2. **Estoque Disponível** (`estoque-disponivel*.xlsx`, aba `Data`): separa
   estoque de picking (`Tipo de Depósito = PKL`) das posições já existentes
   no AEL.
3. **PDV** (`.xlsx` aba `PDV` ou `.json`): giro real de venda, em janela móvel
   de 30 dias corridos (usa o que houver se o histórico for menor).
4. **Categorização** — `estoque_picking` × `giro_diário` → `dias_cobertura`:
   - `RUPTURA` — vendendo e picking zerado
   - `CRÍTICO` — cobertura < 3 dias
   - `MODERADO` — cobertura entre 3 e 10 dias
   - `ARMAZENAR` — cobertura ≥ 10 dias (pode ir para o AEL)
   - `SEM_GIRO` — 0 vendas nos últimos 30 dias (revisar manualmente)

Essa lógica foi **validada linha a linha** contra o script Python original com
dados de teste — mesmos códigos, mesmas categorias, mesmos dias de cobertura.
Qualquer ajuste de regra de negócio deve ser feito em `assets/js/logic.js` e
`assets/js/config.js` (limiares `LIMIAR_CRITICO_DIAS` / `LIMIAR_MODERADO_DIAS`).

## O que é editável em cada arquivo

| Se você precisa...                                             | Edite...                                   |
|------------------------------------------------------------------|---------------------------------------------|
| Adicionar/remover uma ferramenta no hub                          | `assets/js/config.js` → `FERRAMENTAS`        |
| Liberar o cadeado de uma ferramenta bloqueada                    | `assets/js/config.js` → mude `status` para `"disponivel"` e aponte `href` para a página do módulo |
| Adicionar/remover uma seção (departamento) e suas palavras-chave | `assets/js/config.js` → `SECOES`             |
| Mudar limiares de dias de cobertura                              | `assets/js/config.js` → `LIMIAR_CRITICO_DIAS` / `LIMIAR_MODERADO_DIAS` |
| Mudar cores/tema visual                                          | `assets/css/tokens.css`                      |
| Mudar layout das planilhas de origem                             | `assets/js/parsers.js`                       |
| Mudar regra de cruzamento/categorização                          | `assets/js/logic.js`                         |

## Sobre a "seleção de seção" (Hidráulica, Elétrica, etc.)

Como as fontes originais (Agendamentos/Estoque/PDV) **não trazem** o
departamento do produto, a classificação por seção hoje é feita por
**palavras-chave na descrição do produto**, configuradas em
`assets/js/config.js → SECOES → termos`. Produtos que não batem com nenhuma
palavra-chave caem em "Não classificado".

Isso é um MVP funcional — quando você mandar o modelo visual e/ou uma tabela
de "Código Produto → Seção" (mapeamento oficial), é só trocar a função
`classificarSecao()` em `assets/js/logic.js` para consultar essa tabela em vez
das palavras-chave, sem tocar em mais nada do sistema.

## Estoque editável ("acertar a quantidade")

Na tela de relatório, o campo **Estoque Picking** de cada linha é editável.
Ao alterar o valor e sair do campo, a categoria e os dias de cobertura daquele
item são recalculados na hora (sem recarregar a página). O valor original lido
da planilha fica marcado internamente (`estoque_picking_original`) para
eventual auditoria futura.

## Gerar o relatório final

O botão **"Gerar / Imprimir relatório"** abre o diálogo de impressão do
navegador — o operador escolhe "Salvar como PDF" para gerar o arquivo final,
com um layout de impressão dedicado (a topbar, abas e botões somem
automaticamente na versão impressa/PDF).

## Persistência dos dados

O resultado do cruzamento fica em `sessionStorage` do navegador (aba atual),
não em um banco de dados. Ao fechar a aba ou clicar em "Novo cruzamento", os
dados somem — isso é proposital: cada dia é uma operação nova, com fontes
novas. Se no futuro for necessário histórico entre sessões, trocar
`assets/js/state.js` para usar `localStorage` ou um endpoint de backend é a
única mudança necessária (nenhuma outra página depende de como o estado é
guardado).

## Compatibilidade

Testado com o motor de leitura de planilhas SheetJS (vendorizado em
`assets/js/vendor/xlsx.full.min.js`, funciona 100% offline). Qualquer
navegador moderno (Chrome, Edge, Firefox) funciona; não é necessário instalar
nada no computador do operador.
