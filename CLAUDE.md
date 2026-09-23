# Pesquisa de Satisfação + Roleta da Sorte — Underline

Template reutilizável (multi-cliente) de pesquisa de satisfação com prêmio garantido via roleta, para restaurantes de ticket médio-alto (acima de R$50). Uso: QR Code / NFC na mesa.

## Stack e restrições não-negociáveis

- **Zero build step.** HTML + CSS + JS puro, sem bundler, sem transpilação, sem React. `index.html` continua sem dependências externas de CDN/fonte (font-stack de sistema); `admin.html` é a única página que carrega algo externo — duas libs via cdnjs, versões fixas, conferir que existem antes de trocar: **Chart.js 4.4.1** (gráficos) e **SheetJS (xlsx) 0.18.5** (exportação `.xlsx`, ver "Painel administrativo").
- **Backend:** Google Apps Script (`Code.gs`) vinculado a uma planilha Google Sheets. Web app já existe e está deployado:
  - Webhook: `https://script.google.com/macros/s/AKfycbyIAAEirtDqZNlXj1l_MQBVrFzd7qK-WpoKiipm5VXhiHXGFb6pMQRCZ83KivYrpKCo/exec`
  - Ao atualizar o `Code.gs`, publicar como **nova versão do mesmo deployment** (não criar deployment novo) para manter essa URL viva.
- **Mobile-first**, uma tela por vez, sem rolagem excessiva. Fluxo em cards que trocam via JS (sem reload de página, sem rotas).
- **Identidade visual (fixa, não é livre):** fundo da página cinza bem claro `#F7F7F7`, elementos e texto em preto absoluto `#000000`, cards de conteúdo em branco `#FFFFFF` com borda `1px solid #E0E0E0` e sombra leve (`0 2px 8px rgba(0,0,0,.06)`) para dar profundidade sutil. O amarelo/ouro `#FFD100` permanece como cor de acento (texto dos botões pretos, detalhes da roleta). Tipografia bold, geométrica, sem serifa. Botões grandes tipo pílula (border-radius total), pretos com texto amarelo/branco, feedback tátil no `:active` (scale down leve). Sem emojis na interface. Tom de voz direto, sem gírias — público de ticket médio-alto.
- **Logo do cliente:** slot de imagem configurável (`CONFIG.LOGO_DATA_URI` ou `CONFIG.LOGO_URL`) no topo da página. Enquanto vazio, mostra um placeholder "Seu logo aqui" em caixa de borda pontilhada preta, no estilo visual do cupom — nunca o nome do restaurante em texto.
- **Rodapé fixo (sempre visível, sem toggle):** em todas as telas, "Desenvolvido por Underline" + o logo da Underline (`Assets/underline-logo.jpeg`, ~24px de altura), os dois dentro de um único link para `https://underlinelab.com.br` (`target="_blank" rel="noopener"`). Não é configurável por cliente.
- **Configuração compartilhada em `config.js`:** todo dado específico de cliente (nome do restaurante, logo, webhook, prêmios, coordenadas, textos...) vive em um único objeto `CONFIG`, em `config.js` — uma fonte só, carregada por `index.html`, `caixa.html` e `admin.html` (`<script src="config.js"></script>`, sempre antes do `<script>` de cada página). Reaplicar o template em outro cliente é trocar esse arquivo, sem tocar no resto. Não é um build step: é só um segundo arquivo estático.
  - **Cuidado ao editar:** como `config.js` roda num `<script>` separado (não um módulo ES), seu `const CONFIG` só fica visível para o `<script>` inline de cada página porque os dois compartilham o mesmo escopo léxico de topo do documento — a tag `<script src="config.js">` precisa continuar vindo *antes* da tag `<script>` inline em ambas as páginas.

## Estrutura de arquivos

```
index.html   → fluxo completo do cliente (participação na pesquisa + roleta + cupom)
caixa.html   → validação de cupom pelo garçom/caixa, no aparelho do estabelecimento — ver "Validação do cupom"
admin.html   → painel administrativo (dashboards) — ver seção própria abaixo
config.js    → CONFIG compartilhado pelas três páginas acima
Code.gs      → backend Apps Script (registro, consulta/validação de cupom, dados do admin)
```

A validação do cupom **não** fica mais na tela do cupom do cliente: o cliente só mostra ou informa o código, e o garçom/caixa valida em `caixa.html`, no aparelho dele (decisão que substituiu a antiga "senha embutida na tela do cupom"). `caixa.html` usa a senha do caixa (`CASHIER_PASSWORD`), `admin.html` usa a sua própria (`ADMIN_PASSWORD`) — as duas validadas só no backend.

## Painel administrativo (`admin.html`)

Dashboard de leitura para o dono/gestor do restaurante: KPIs, Promotores/Neutros/Detratores (rosca + evolução), três gráficos de tendência com drilldown mensal→diário (nota geral, nota por categoria, evolução do NPS), distribuição de prêmios e status, analítico de respostas paginado com exportação `.xlsx`, filtro por intervalo de datas (De/Até) e cross-filtering estilo Power BI ao clicar em qualquer gráfico — tudo recalculado no cliente a partir de tudo que o backend devolveu.

- **Login real, não cosmético:** o campo "Usuário" é só decorativo. O acesso só é liberado quando o backend confirma a senha e devolve os dados — nunca por comparação de string no `admin.html`. A senha (não um simples "logado: true") fica em `sessionStorage`, e a cada carregamento da página ela é reenviada ao backend para validar de novo; um valor adulterado no `sessionStorage` não dá acesso, porque cai na mesma checagem real do backend.
- **Contrato do backend (leitura, `action: "admin"`):** `doPost` com `{ senha }`. Retorna `{ ok: true, rows: [...] }` (cada linha com `cupom, data (ISO), nome, notaComida, notaAtendimento, notaAmbiente, comentario, premio, status` — **nunca** a coluna WhatsApp, mesmo com a senha certa) ou `{ ok: false, error }` sem vazar nenhum dado.
- **`apiCall(payload)` com retry:** assim como o `api()` do `index.html`, todo `fetch` ao webhook (login, exportação) passa por essa função, que repete uma vez após `CONFIG.API_RETRY_DELAY_MS` (1s) se a resposta vier sem o campo `ok` ou em falha de rede — **confirmado contra produção que o redirecionamento do Apps Script (via `script.googleusercontent.com`) falha de forma transitória de vez em quando**, daí o retry ser necessário de verdade, não só teórico. Erros de negócio (`ok:false` com uma mensagem real, ex. "Senha incorreta") não são repetidos.
- **Sete armadilhas já resolvidas, não reintroduzir:**
  1. **Ordem de inicialização:** a chamada que de fato aciona a primeira renderização (`tryAutoLogin()`, no fim do script) precisa vir depois de **toda** declaração `let`/`const` do arquivo (ex.: `let trendChart, catTrendChart, npsDonutChart, npsTrendChart, tablePage`). Chamar antes é "acesso antes da inicialização" — o erro não fica contido, ele trava todo o código que viria depois no mesmo escopo (nada de listener de filtro, por exemplo, chega a ser registrado).
  2. **`safeRender(fn, rows)`:** cada seção do dashboard (KPIs, NPS rosca/evolução, tendência geral/categoria, prêmios, status, tabela) é chamada dentro desse wrapper com try/catch, logando no console em vez de propagar. Se um gráfico falhar (CDN bloqueado, lento etc.), o resto do painel continua funcionando.
  3. **Elementos com o atributo `hidden` precisam do CSS `[hidden] { display: none !important; }`** — sem essa regra, qualquer outra classe que a página já aplique ao mesmo elemento com sua própria `display` (ex.: `.link { display: block; }`) tem a mesma especificidade e pode vencer o `hidden` padrão do navegador, deixando o elemento visível mesmo com `.hidden === true`. Testar sempre pelo `getComputedStyle(...).display`, não só pela propriedade `.hidden`.
  4. **`groupByPeriod(rows, keyFn)` chama `keyFn(r)` — a LINHA inteira, não `r.data`.** Todo chamador já passa `r => monthKeyOf(r.data)` (uma função que espera a linha); se `groupByPeriod` chamasse `keyFn(r.data)` por engano, `monthKeyOf` receberia uma `Date` sem `.data`, e `d.getFullYear()` quebraria (`Cannot read properties of undefined`) — exatamente o bug encontrado ao generalizar essa função para os três gráficos temporais.
  5. **Uma variante de `.panel-grid` (ex.: `.panel-grid-even`) precisa aparecer no `@media (max-width: 760px)` junto com `.panel-grid`, não só a classe base.** As duas têm a mesma especificidade; se só `.panel-grid` estiver listada na media query, um elemento com as duas classes nunca colapsa pra 1 coluna no mobile — a variante sempre vence, em qualquer largura de tela, porque sua regra desktop vem depois no arquivo. Bug real encontrado assim (o painel de NPS não colapsava no mobile como o resto do dashboard); o fix é listar todas as variantes de `.panel-grid` juntas na mesma regra de media query.
  6. **O espaçamento vertical entre os blocos de 1ª linha do painel (linhas `.panel-grid` e painéis avulsos de largura cheia) vem de uma regra só, `#dashboard > .panel-grid, #dashboard > .panel { margin-bottom: 16px; }`.** Usar o seletor `>` (filho direto) é o que importa: um `margin-bottom` direto na classe `.panel` sozinha pegaria TAMBÉM os `.panel` que vivem dentro de um `.panel-grid` (esticados pelo grid), criando um respiro interno indevido dentro do card em vez de espaço entre cards. Bug real encontrado assim: o painel avulso "Nota média por categoria" não tinha nenhuma margem própria e ficava colado (0px) no bloco seguinte — ao adicionar um novo painel avulso de largura cheia, ele já nasce com a margem certa por ser filho direto de `#dashboard`, não precisa de CSS extra.
  7. **`.panel-grid > .panel { min-width: 0; }` é obrigatório.** Um item de grid (ou flex) tem `min-width: auto` por padrão, que significa "pelo menos o tamanho mínimo do meu conteúdo" — o `<canvas>` de um gráfico Chart.js tem largura intrínseca própria mesmo redimensionado por CSS/`responsive:true`, e isso empurrava o card pra fora da própria célula do grid. Bug real medido assim: cards de `.panel-grid` renderizando 342px dentro de uma célula de 335px (~2% mais largos que o resto do dashboard), em TODAS as linhas de `.panel-grid`, não só a de NPS — confirmado com `getBoundingClientRect()`, invisível a olho nu numa captura de tela comum, mas mensurável e uma causa raiz plausível para distorções maiores em dispositivos reais. Testar sempre comparando a largura de TODOS os cards do painel entre si, não só olhando uma captura.
  - **Nota sobre capturas de tela de página inteira:** ferramentas de "captura de página inteira" (extensões, `Page.captureScreenshot` com página redimensionada) têm um artefato conhecido do Chrome: elementos `position: fixed` (ex.: o rodapé `.site-footer`) aparecem na altura da viewport ORIGINAL da ferramenta, não no fim real da página composta — parecendo "flutuar" no meio do conteúdo numa imagem alta, mesmo funcionando perfeitamente para quem rola a página de verdade no aparelho. Antes de tratar algo assim como bug, teste rolando de verdade (ou renderizando num viewport comum, sem redimensionar a altura), não só a partir da imagem estática.

### Filtro por intervalo de datas (De/Até) + cross-filtering estilo Power BI

Substituiu os antigos botões "Tudo/30/7 dias". Dois `<input type="date">` no topo (`#date-start`/`#date-end`); ao carregar o painel, os dois já vêm preenchidos com o intervalo completo dos dados carregados (`showDashboard()` calcula min/max de `ALL`), pra já mostrar tudo sem campo em branco. `null` em qualquer lado = sem limite naquele lado; o dia final é levado até `23:59:59.999` (`endOfDay()`) pra incluir o dia inteiro, não só até meia-noite.

**Cross-filtering:** clicar num elemento de **qualquer** gráfico (mês/dia num dos 3 gráficos de tendência, uma barra de "Prêmios sorteados", uma linha de "Status dos cupons", uma fatia da rosca do NPS, ou um segmento colorido da evolução do NPS) define um filtro nessa dimensão, e **todos os painéis são recalculados** — inclusive o próprio gráfico clicado. Três decisões de design, tomadas explicitamente (não são o único jeito possível de implementar isso, mas foram a escolha feita aqui):

1. **O clique faz duas coisas ao mesmo tempo:** dispara o drilldown daquele gráfico (mês → dias) **e** filtra os outros painéis pelo mesmo mês. As duas coisas usam o **mesmo estado compartilhado** (`crossFilters.month`/`crossFilters.day`, não uma variável de drilldown por gráfico) — os 3 gráficos temporais (`renderTrend`, `renderCatTrend`, `renderNPSTrend`) leem essa mesma dimensão pra decidir visão mensal vs. diária. Por isso não existem mais botões individuais de "← Voltar" — sair de um mês é usar o × do chip (ver abaixo) ou "Limpar filtros", que zeram `crossFilters.month`/`.day` e automaticamente devolvem os 3 gráficos pra visão mensal juntos.
2. **Várias dimensões podem ficar ativas ao mesmo tempo, em E lógico** (`crossFilters = { month, day, premio, status, npsBucket }`, todas combinadas por `applyCrossFilters()`) — ex.: mês de setembro **e** prêmio "Drink do dia" ao mesmo tempo, cada um vindo de um clique num gráfico diferente.
3. **A evolução do NPS (`renderNPSTrend`) é a única exceção ao intervalo de datas** — ela sempre parte de `computeNPSTrendRows()` (todo o histórico de `ALL`, ignorando De/Até de propósito, pra dar uma visão de longo prazo sem cortes), **mas os cross-filters de clique afetam ela normalmente**, inclusive os que ela mesma gera. "Ignorar filtro" e "cross-filter" são tratados como conceitos diferentes.
- **Clicar de novo no mesmo valor desfaz** (toggle) — em todo lugar clicável. Clicar num **segmento colorido** específico da evolução do NPS (não só na barra) define mês **e** faixa ao mesmo tempo, num único clique (`elements[0].datasetIndex` identifica qual série/cor foi clicada); clicar de nada no mesmo segmento desfaz os dois juntos.
- **Depois que um gráfico já entrou em drilldown (visão diária), um clique nele passa a significar "escolher um dia"**, não mais "desfazer o mês" — o Chart.js reconstrói o gráfico (novo `onClick`) a cada `renderAll()`, então o mesmo clique já não aciona o handler antigo. Sair da visão diária é sempre pelo × do chip de mês ou por "Limpar filtros" (isso também zera o dia, já que um dia só existe dentro de um mês).
- **Barra "Filtros ativos"** (`#active-filters-bar`, escondida quando não há nenhum cross-filter): um chip por dimensão ativa, cada um com um × que limpa só aquela dimensão (`clearCrossFilter(key)`), mais um botão "Limpar filtros" que zera tudo de uma vez (`clearAllCrossFilters()`) — **nenhum dos dois mexe no intervalo de datas De/Até**, que é um controle independente e persistente.
- **"Status dos cupons" não é mais `<div>`, é `<button>`:** pra ficar clicável e ganhar foco/teclado de graça, igual a todo o resto dos elementos interativos do site (em vez de reinventar acessibilidade num `<div onclick>`).
- **Categoria (Comida/Atendimento/Ambiente) não é uma dimensão de cross-filter.** Cada resposta tem as 3 notas ao mesmo tempo — não existe "respostas sobre Comida" como um subconjunto de linhas — então clicar numa das 3 linhas do gráfico "Evolução da nota média por categoria" só define o cross-filter de mês/dia (igual ao gráfico de nota geral), sem tentar filtrar por categoria.
- **`tablePage` reseta pra 1** em qualquer mudança (data ou cross-filter) — o conjunto de linhas embaixo da paginação sempre muda.

### Promotores, Neutros e Detratores

Não é NPS de verdade — a pesquisa não tem a pergunta de 0–10, só as 3 notas do CSAT (1–5). É uma régua análoga sobre a média das 3 notas por resposta (`media`), com os cortes documentados na tela pra nunca ficar ambígua: **Promotor** `media ≥ 4,5`, **Neutro** `3,5 ≤ media < 4,5`, **Detrator** `media < 3,5` (constantes `NPS_PROMOTER_MIN`/`NPS_NEUTRAL_MIN` no topo do script). Dois painéis lado a lado:

- **Rosca (`renderNPSDoughnut`):** distribuição absoluta/percentual do conjunto filtrado atual (data + cross-filters) — clicar numa fatia define `crossFilters.npsBucket`.
- **Evolução (`renderNPSTrend`, barras 100% empilhadas):** composição de Promotor/Neutro/Detrator mês a mês — ver a seção de filtro acima pra como ela se relaciona com data/cross-filters.
- **Paleta (fixa, "Moderna & Suave"):** Promotor `#81C784` (verde sálvia), Neutro `#FFD54F` (amarelo trigo), Detrator `#E57373` (vermelho coral) — constante `NPS_COLORS`, única fonte pros dois gráficos e suas legendas (trocar as cores é editar só ali). `NPS_BUCKET_KEYS = ['promoter','neutral','detractor']` fixa a ORDEM dos datasets/segmentos — usada tanto pra montar os gráficos quanto pra traduzir `datasetIndex` de um clique de volta pra faixa certa.
- **Os dois cards ficam com largura, altura e padding idênticos**, diferente do resto do dashboard (que usa `.panel-grid` com colunas `1.4fr 1fr`, assimétrico de propósito): esta seção usa `.panel-grid.panel-grid-even` (`1fr 1fr`) e a classe `.nps-panel` (flex column, com `.chart-wrap` esticando pra preencher o espaço restante) — sem isso, os dois gráficos ficam com tamanhos ligeiramente diferentes mesmo com os cards do mesmo tamanho, porque um tem legenda/caption abaixo do gráfico e o outro tem um subtítulo mais longo acima.

### Gráficos de tendência com drilldown (nota geral e por categoria)

`renderTrend(rows)` e `renderCatTrend(rows)` são dispatchers: mostram a visão mensal por padrão (lendo `crossFilters.month`, compartilhado — ver seção de filtro acima), agrupando por mês com `groupByPeriod`. `renderCatTrend` é a mesma lógica, com 3 séries (Comida/Atendimento/Ambiente) em vez de 1 — por ter legenda, o `plugins.legend` fica `display:true` (diferente do gráfico de nota geral, que esconde a legenda por ter só uma série).

### Analítico de respostas (paginado + exportação `.xlsx`)

Mostra **todas** as respostas do conjunto filtrado atual (não só as 20 mais recentes), 20 por página, com botões Anterior/Próxima (`tablePage`, `TABLE_PAGE_SIZE = 20`). O botão "Exportar (.xlsx)" fica no cabeçalho desta seção (canto superior direito, ao lado do título/subtítulo — não no topbar do painel). **Contrato do backend (`action: "export"`):** `doPost` com `{ senha, cupons }` (`cupons`: lista opcional de códigos — o `admin.html` manda exatamente os cupons do conjunto filtrado atual que já estão na tela, todas as páginas; sem `cupons`, exporta a planilha inteira). Retorna `{ ok: true, headers: [...], rows: [[...], ...] }` com **as 10 colunas na ordem exata de `HEADERS`, incluindo WhatsApp** — exceção deliberada, pedida especificamente para este botão (decisão registrada: o `action:"admin"` do dashboard continua sem WhatsApp; só a exportação inclui).

`exportData_` só lê a planilha (`SpreadsheetApp.getRange().getValues()`), do mesmo jeito que `adminData_` já fazia — **não** usa a exportação nativa do Google (`docs.google.com/.../export`) nem `DriveApp`. Essa rota exigiria um escopo OAuth novo (Drive), e como o deployment roda com a autorização que o desenvolvedor já concedeu, um escopo novo poderia quebrar a autorização de **todo** o webhook (inclusive `register`/`validate`, usados por clientes reais) até alguém reautorizar manualmente no editor — risco desproporcional para uma funcionalidade só do admin. O `.xlsx` de verdade é montado no navegador a partir desse JSON, com SheetJS (`XLSX.utils.aoa_to_sheet` + `XLSX.writeFile`).

### Gráfico "Prêmios sorteados"

Paleta pastel fixa (`PRIZE_COLORS`): azul `#90CAF9`, roxo `#B39DDB`, verde menta `#80CBC4`, amarelo trigo `#FFD54F` (mesmo tom do Neutro do NPS) — troca do preto/vermelho escuro/amarelo forte de antes, pra combinar com o resto do painel.

## Fluxo de telas (uma por vez, transição por fade/slide)

1. **Boas-vindas** — logo do cliente (variável `CONFIG.LOGO_DATA_URI` ou `CONFIG.LOGO_URL`), título convidativo, botão "Começar agora".
   - **Gate de geolocalização acontece aqui, antes de avançar** (ver seção própria abaixo).
2. **Identificação** — campos Nome (obrigatório) e WhatsApp (obrigatório, com máscara `(XX) XXXXX-XXXX`, validado por regex de 11 dígitos). Botão "Continuar" só habilita com os dois campos válidos.
3. **Avaliação CSAT** — 3 sub-telas em sequência, uma pergunta por vez, escala de 1 a 5 (ícones de estrela em SVG inline, não emoji):
   - Qualidade da comida e sabor
   - Velocidade e qualidade do atendimento
   - Ambiente, conforto e limpeza
   - Ao tocar uma estrela, avança automaticamente para a próxima pergunta (~400ms de delay) sem precisar de botão "Próxima".
4. **Feedback aberto (opcional)** — textarea curta: "O que achou que podíamos ter feito diferente hoje?". Botões "Continuar" e "Pular" ambos avançam (pular grava comentário vazio).
5. **Roleta da sorte** — roda desenhada via SVG gerada dinamicamente a partir de `CONFIG.PRIZES` (não hardcoded — precisa funcionar com qualquer número de fatias). Botão "Girar a roleta". Animação de giro suave (~4-5s, easing ease-out, múltiplas voltas + parada no prêmio sorteado). Depois de girar, o botão fica desabilitado (não pode girar duas vezes na mesma sessão).
6. **Resultado / Cupom** — mostra nome do prêmio, código do cupom em destaque, e dentro do cupom a **data e hora de emissão** ("Gerado em dd/mm/aaaa às hh:mm", hora do aparelho no momento do sorteio, guardada como `emitidoEm` no `localStorage`) e a **data de validade** ("Válido até dd/mm/aaaa", ou "Expirou em" se já passou). Logo abaixo do cupom, um aviso em destaque (fundo amarelo, `CONFIG.COUPON_SAVE_TEXT`, escondido se vazio ou se o cupom já expirou) pedindo para tirar um print e guardar o cupom para a próxima visita. Botão "Copiar código" (Clipboard API) e a instrução para mostrar/informar o código ao garçom ou no caixa. **Sem nenhum campo de senha/validação nesta tela** — ver "Validação do cupom". Cupons salvos antes do `emitidoEm` existir mostram só a data.

## Prêmios da roleta (calibrados para ticket médio-alto)

Pesos definem a chance real de cada prêmio — **não precisam corresponder ao tamanho visual da fatia** (fatias podem ser todas do mesmo tamanho visualmente; o sorteio é por peso, e a animação apenas gira até a fatia sorteada). Sortear primeiro o prêmio (random ponderado), só depois calcular o ângulo de parada.

Cada item de `CONFIG.PRIZES` é uma fatia (`nome`, `rotulo` curto, `peso`); prêmios repetidos somam os pesos. **Configuração atual (8 fatias, soma 100), nesta ordem** — sem fatias iguais adjacentes:

| Fatia | Prêmio | Peso |
|---|---|---|
| 1 | Refrigerante lata | 30 |
| 2 | 5% de desconto | 5 |
| 3 | Drink do dia | 10 |
| 4 | 10% de desconto | 5 |
| 5 | Refrigerante lata | 30 |
| 6 | 5% de desconto | 5 |
| 7 | Drink do dia | 10 |
| 8 | 10% de desconto | 5 |

Chance total por prêmio: Refrigerante 60%, Drink do dia 20%, 5% 10%, 10% 10%.

Nunca incluir uma fatia "sem prêmio" — a promessa da tela de boas-vindas é prêmio garantido.

## Geração do cupom

- Formato: `UND-XXXX`, 4 caracteres alfanuméricos maiúsculos, gerados no client-side.
- Excluir caracteres ambíguos do gerador (`O`/`0`, `I`/`1`) para reduzir erro de leitura na hora do resgate.
- Gerado no momento em que a roleta sorteia o prêmio (antes da animação terminar).

## Limite diário por aparelho

- `CONFIG.DAILY_LIMIT_ENABLED` (desliga em testes) e `CONFIG.DAILY_LIMIT_MESSAGE` ("Você já participou hoje. Volte amanhã!").
- Após um spin bem-sucedido (prêmio registrado no webhook), o `localStorage` guarda a data local do aparelho (`YYYY-MM-DD`) e o último cupom.
- No clique em "Começar agora", **antes** da geolocalização: se a data guardada for hoje, mostra a mensagem e bloqueia a pesquisa. A tela de bloqueio oferece "Ver meu cupom" (último cupom, com emissão e validade).
- Limitação: limpar dados do navegador ou usar aba anônima contorna o limite; é barreira contra uso casual, não antifraude. Só o último cupom fica guardado no aparelho.

## Validade e políticas do cupom

- `CONFIG.COUPON_VALIDITY_DAYS` (30) e, no `Code.gs`, a constante `COUPON_VALIDITY_DAYS` — **manter as duas iguais**; a regra que vale é a do backend.
- O cupom vale até o fim do último dia, contado a partir da data de emissão (Data/Hora da linha), no fuso `TIMEZONE` do `Code.gs` (`America/Sao_Paulo`).
- `validate` verifica, nesta ordem: senha, cupom existe, já utilizado (`"Concluído"`), **expirado** (`"Cupom expirado"`: status `"Vencido"` **ou** `Pendente` com a Data/Hora além do prazo), status válido.
- Status Uso tem três valores: `"Pendente"` → `"Concluído"` (usado a tempo) ou `"Vencido"`. `"Concluído"` nunca vira `"Vencido"`.

### Gatilho diário — `marcarCuponsVencidos`

A função `marcarCuponsVencidos()` do `Code.gs` varre a planilha e muda `Pendente` → `Vencido` quando passou de `COUPON_VALIDITY_DAYS` (linhas com Data/Hora ilegível são ignoradas). Para instalar como gatilho diário (uma vez por planilha/cliente):

1. Abra a planilha do cliente → menu **Extensões → Apps Script**.
2. Confirme que o `Code.gs` colado é o atual e clique em **Salvar** (ícone de disquete ou Ctrl+S).
3. Rode uma vez manualmente para conceder a autorização: no seletor de função da barra superior escolha **`marcarCuponsVencidos`** e clique em **Executar**. Na janela "Autorização necessária": **Revisar permissões** → escolha a conta → **Avançar** (ou "Avançado" → "Acessar ... (não seguro)") → **Permitir**. Confira o resultado em **Execuções** / registro de execução (`N cupom(ns) marcado(s) como Vencido`).
4. No menu lateral esquerdo clique no ícone de **relógio (Acionadores / Triggers)**.
5. Clique em **+ Adicionar acionador** (canto inferior direito) e configure:
   - Função a ser executada: `marcarCuponsVencidos`
   - Implantação a ser executada: `Head`
   - Origem do evento: **Baseado no tempo**
   - Tipo de acionador baseado em tempo: **Timer diário**
   - Horário: **2h às 3h** (madrugada)
6. Clique em **Salvar**. O horário segue o fuso do projeto (**Configurações do projeto** → Fuso horário; use `America/Sao_Paulo`).
7. Para o webhook usar o `Code.gs` novo: **Implantar → Gerenciar implantações → lápis (Editar) → Versão: Nova versão → Implantar** (mesma implantação, a URL não muda). O gatilho roda o código salvo (Head) e não depende disso.

Os nomes dos menus podem variar levemente conforme o idioma e a versão do editor do Apps Script.
- A tela do cupom mostra "Gerado em dd/mm/aaaa às hh:mm", "Válido até dd/mm/aaaa" e um texto de políticas discreto (`CONFIG.COUPON_POLICY_TEXT`, com `{dias}`): "Válido para sua próxima visita. Não cumulativo com outras promoções ou descontos. Válido por 30 dias a partir da data de emissão."

## Geolocalização — restringir participação à proximidade do restaurante

Requisito novo: só permitir gerar cupom se o dispositivo estiver fisicamente perto do estabelecimento.

- Adicionar ao `CONFIG`: `RESTAURANT_LAT`, `RESTAURANT_LNG`, `MAX_DISTANCE_METERS` (default sugerido: 150).
- No clique em "Começar agora" (tela de Boas-vindas, antes de ir para Identificação):
  1. Chamar `navigator.geolocation.getCurrentPosition()`.
  2. Calcular distância via fórmula de Haversine entre a posição do usuário e `RESTAURANT_LAT/LNG`.
  3. Se `distância <= MAX_DISTANCE_METERS` → segue o fluxo normalmente.
  4. Se `distância > MAX_DISTANCE_METERS` → bloquear com tela/mensagem clara: "Essa pesquisa só pode ser respondida dentro do estabelecimento." Sem opção de pular.
  5. Se o usuário negar a permissão de localização ou o navegador não suportar → mostrar mensagem pedindo para habilitar localização, com botão "Tentar novamente". Não deixar prosseguir sem uma leitura válida.
- **Pré-requisito técnico:** Geolocation API só funciona em contexto seguro (HTTPS). Garantir que o link do QR Code/NFC aponte para uma URL HTTPS.
- **Ressalva honesta para registrar:** essa checagem roda no navegador do cliente e pode ser burlada por quem usa apps de GPS falso — é uma barreira razoável contra uso casual fora do local (alguém compartilhando o link pela internet), não uma trava de segurança forte. Não vender isso como antifraude definitivo.

## Validação do cupom (`caixa.html`, no aparelho do garçom/caixa)

O cliente só mostra ou informa o código; quem valida é o estabelecimento, numa página própria (`caixa.html`), no celular/tablet do garçom ou no computador do caixa. Mesma identidade visual, logo do cliente e rodapé Underline do `index.html`; sem geolocalização; `noindex`.

- **Senha:** `CASHIER_PASSWORD`, constante **só no `Code.gs`** (nunca no `config.js`/HTML) — o front-end só sabe se acertou pela resposta do backend. Login via `action: "cashierLogin"`. A senha fica salva no `localStorage` do aparelho (chave `CONFIG.STORAGE_KEY + "-caixa"`) até tocar em "Sair", para o garçom não redigitar a cada cupom — mas nunca vale sozinha: toda consulta e todo resgate a reenviam e o backend confere de novo. Se o backend responder "Senha incorreta" (senha trocada no `Code.gs`), a página limpa a senha salva e volta ao login.
- **Fluxo em dois passos, para não dar baixa num código digitado errado:**
  1. O garçom digita os 4 caracteres (o prefixo `CONFIG.COUPON_PREFIX` já aparece fixo; colar o código inteiro, com ou sem hífen/minúsculas, também funciona) e toca "Consultar cupom" → `action: "lookup"`, que **não altera nada** e devolve prêmio, nome, data/hora de emissão, validade e status.
  2. Se o status for `Pendente` (dentro do prazo), aparece "Confirmar resgate" → `action: "validate"` (com `requestId`, ver idempotência), que marca `"Concluído"`. `Concluído` ("Cupom já utilizado") e `Vencido` ("Cupom expirado") são mostrados com mensagem clara e sem botão de resgate.
- Se o status mudar entre a consulta e a confirmação (ex.: resgatado em outro aparelho), o erro do `validate` atualiza a tela para o status real.

**Link da página:** é só abrir `caixa.html` no mesmo host do `index.html` (ex. `https://.../caixa.html`). Não é linkado a partir das telas do cliente.

## Planilha Google Sheets — colunas (ordem exata, não alterar)

| # | Coluna | Observação |
|---|---|---|
| 1 | ID / Cupom | ex: `UND-4K7Q` |
| 2 | Data/Hora | ISO ou `dd/mm/aaaa hh:mm` |
| 3 | Nome | |
| 4 | WhatsApp | já formatado com máscara |
| 5 | Nota Comida | 1–5 |
| 6 | Nota Atendimento | 1–5 |
| 7 | Nota Ambiente | 1–5 |
| 8 | Comentário | pode ser vazio |
| 9 | Premio Roleta | texto do prêmio sorteado |
| 10 | Status Uso | `"Pendente"` (default) → `"Concluído"` ou `"Vencido"` |

## Contrato do backend (`Code.gs`)

`doPost(e)` recebe JSON com campo `action`:

- **`action: "register"`** — insere uma nova linha com `Status Uso = "Pendente"`. Retorna `{ ok: true }`.
- **`action: "cashierLogin"`** — recebe `senha`; `{ ok: true }` se bater com `CASHIER_PASSWORD`, senão `{ ok: false, error: "Senha incorreta" }`. Não lê a planilha.
- **`action: "lookup"`** — recebe `cupom` e `senha`. Consulta **sem alterar nada**. Senha conferida primeiro ("Senha incorreta"), depois "Cupom não encontrado", senão `{ ok: true, cupom, premio, nome, emitido (ISO), validoAte ("yyyy-MM-dd" no fuso TIMEZONE), status }` — `status` já resolvido: `Pendente` além do prazo volta como `"Vencido"`, pela mesma regra do `isExpired_` (`validoAte` vem de `lastValidDay_`, o complemento exato dela). Nunca devolve WhatsApp.
- **`action: "validate"`** — recebe `cupom`, `senha` e `requestId` (opcional, ver abaixo). Compara senha contra `CASHIER_PASSWORD` (constante no topo do `Code.gs`). Busca o cupom na planilha:
  - senha errada → `{ ok: false, error: "Senha incorreta" }` (checada primeiro)
  - não encontrado → `{ ok: false, error: "Cupom não encontrado" }`
  - já `"Concluído"` → `{ ok: false, error: "Cupom já utilizado" }`
  - `"Vencido"` ou `Pendente` além do prazo → `{ ok: false, error: "Cupom expirado" }`
  - válido e pendente → atualiza status, retorna `{ ok: true, premio, nome }`
  - **Idempotência:** `caixa.html` gera um `requestId` por toque em "Confirmar resgate" e o reenvia igual nas repetições (retry de `api()`, ou novo clique após falha de rede). Um `validate` bem-sucedido fica guardado 10 min no `CacheService` sob esse `requestId`; se chegar de novo (mesmo `requestId` e mesmo cupom), devolve o mesmo sucesso em vez de "Cupom já utilizado". Só sucessos são guardados, e a senha continua sendo conferida antes. Um cupom realmente já usado (outro `requestId`) segue dando "Cupom já utilizado".

O front-end (`api()`) repete uma vez, após `CONFIG.API_RETRY_DELAY_MS` (1 s), qualquer resposta sem o campo `ok` ou falha de rede/timeout; erros de negócio (`ok:false`) não são repetidos. O `register` é idempotente no backend (mesmo cupom + nome + WhatsApp devolve `ok:true`).

Enviar o `fetch` do front-end com `Content-Type: text/plain;charset=utf-8` (não `application/json`) — evita o preflight CORS que o Apps Script não trata bem. O `e.postData.contents` continua sendo o JSON string normalmente.

Criar cabeçalhos automaticamente (`HEADERS` array) se a aba estiver vazia na primeira execução — mas como a planilha e o deployment **já existem**, isso é só uma salvaguarda, não o caminho principal.

## Dados de demonstração — `gerarDadosDemo()`

Função só-manual no `Code.gs` (não passa por `doPost`, não é acionável pelo webhook). Roda escolhendo `gerarDadosDemo` no seletor de função do editor do Apps Script e clicando em Executar — igual ao passo 3 do gatilho diário acima.

- **Grava 150 linhas sintéticas na planilha em uso** (produção, se for a planilha do cliente), nomeadas `Cliente Demo 001` a `Cliente Demo 150` para serem filtradas e apagadas depois.
- Datas espalhadas aleatoriamente nos últimos 90 dias, com horário variado dentro do dia (janela 11h–23h). Notas com tendência de melhora ao longo do tempo (interpolação linear entre médias-alvo calibradas para a média das 450 notas geradas ficar perto de 4,5).
- Status decidido pela idade da linha **usando a mesma regra de dias-calendário do `isExpired_`** (não uma diferença crua de milissegundos, que pode discordar do que `validate_` calcularia depois para a mesma linha): mais de `COUPON_VALIDITY_DAYS` → 70% Concluído / 30% Vencido; até `COUPON_VALIDITY_DAYS` → 50% Pendente / 50% Concluído.
- Prêmio sorteado com os mesmos pesos agregados de `CONFIG.PRIZES` do `index.html` (Refrigerante lata 60%, Drink do dia 20%, 5% e 10% de desconto 10% cada) — **se os prêmios do `CONFIG.PRIZES` mudarem, atualizar `DEMO_PRIZES` dentro de `gerarDadosDemo()` junto**, os dois não são lidos de um lugar só.
- Escreve tudo em um único lote (`setValues`), não 150 chamadas de `appendRow`. Cupom gerado sem colidir com nenhum código já existente na planilha (inclusive linhas de teste anteriores).
- Ao terminar, loga e devolve um resumo (`Logger.log`, visível em Execuções): média das 450 notas, contagem de linhas por status, confirmação de que não há cupom duplicado no lote.

## Definition of Done

- [ ] Roda 100% offline após o carregamento inicial (só depende de rede para o `fetch` final, não para renderizar a UI).
- [ ] Testado em viewport de ~375px de largura sem overflow horizontal.
- [ ] Bloqueio por geolocalização funcional e testável trocando `RESTAURANT_LAT/LNG` para um valor distante.
- [ ] Reuso do mesmo cupom gerado duas vezes retorna "Cupom já utilizado" e não derruba o script.
- [ ] Trocar `CONFIG.RESTAURANT_NAME`, `CONFIG.LOGO_*`, `CONFIG.WEBHOOK_URL`, `CONFIG.PRIZES` e `CONFIG.CASHIER_PASSWORD` é suficiente para reaplicar o template em outro cliente, sem tocar no resto do código.
