# Pesquisa de Satisfação + Roleta da Sorte — Underline

Template multi-cliente de pesquisa de satisfação com prêmio garantido via roleta, para restaurantes de ticket médio-alto (> R$50). Acesso por QR Code / NFC na mesa.

## Stack e restrições não-negociáveis

- **Zero build step:** HTML + CSS + JS puro, sem bundler/transpilação/framework. `index.html` e `caixa.html` sem nenhuma dependência externa (font-stack de sistema). Só `admin.html` carrega libs via cdnjs, versões fixas (conferir que existem antes de trocar): **Chart.js 4.4.1** e **SheetJS (xlsx) 0.18.5**.
- **Backend:** Google Apps Script (`Code.gs`) vinculado a uma planilha. Webhook já deployado:
  `https://script.google.com/macros/s/AKfycbyIAAEirtDqZNlXj1l_MQBVrFzd7qK-WpoKiipm5VXhiHXGFb6pMQRCZ83KivYrpKCo/exec`
  Ao mudar o `Code.gs`: **Implantar → Gerenciar implantações → lápis → Nova versão** do mesmo deployment (nunca criar outro — a URL precisa continuar a mesma).
- **Hospedagem:** GitHub Pages da branch `main` (`https://caiquevieira.github.io/Underline-Pesquisa/`). Publicar = commit + push na `main`. HTTPS é obrigatório (Geolocation API).
- **Mobile-first**, uma tela por vez, cards trocados via JS (sem reload, sem rotas). Testar em ~375px sem overflow horizontal.
- **Identidade visual fixa:** fundo `#F7F7F7`; texto/elementos `#000000`; cards `#FFFFFF` com borda `1px solid #E0E0E0` e sombra `0 2px 8px rgba(0,0,0,.06)`; acento `#FFD100`. Tipografia bold, geométrica, sem serifa. Botões pílula pretos com texto amarelo/branco e `scale` no `:active`. Sem emojis. Tom direto, sem gírias.
- **Logo do cliente:** `CONFIG.LOGO_DATA_URI` ou `CONFIG.LOGO_URL` no topo; vazio → placeholder "Seu logo aqui" em caixa pontilhada preta (nunca o nome do restaurante em texto).
- **Rodapé fixo em todas as telas/páginas:** "Desenvolvido por Underline" + `Assets/underline-logo.jpeg` (~24px), num único link para `https://underlinelab.com.br` (`target="_blank" rel="noopener"`). Não configurável.
- **`config.js`:** todo dado de cliente (nome, logo, webhook, prêmios, coordenadas, textos) num único `const CONFIG`, carregado pelas três páginas. Reaplicar em outro cliente = trocar este arquivo (+ senhas/validade no `Code.gs`). Por não ser módulo ES, `CONFIG` só é visível ao script inline porque ambos compartilham o escopo de topo: **`<script src="config.js">` tem de vir antes do `<script>` inline** em cada página.
- **Senhas só no `Code.gs`**, nunca no `config.js`/HTML: `CASHIER_PASSWORD` (garçom/caixa) e `ADMIN_PASSWORD` (painel) — papéis separados.

## Arquivos

```
index.html   → fluxo do cliente (pesquisa + roleta + cupom)
caixa.html   → validação de cupom pelo garçom/caixa, no aparelho do estabelecimento
admin.html   → painel administrativo (dashboards)
config.js    → CONFIG compartilhado pelas três páginas
Code.gs      → backend Apps Script
```

`admin-prototipo-referencia.html` (não versionado) é só rascunho visual com dados mockados — não é produto.

## Fluxo do cliente (`index.html`)

1. **Boas-vindas** — logo, título, "Começar agora". No clique: primeiro o limite diário, depois a geolocalização.
2. **Identificação** — Nome e WhatsApp obrigatórios (máscara `(XX) XXXXX-XXXX`, 11 dígitos); "Continuar" só habilita com os dois válidos.
3. **CSAT** — 3 perguntas (`CONFIG.QUESTIONS`: comida, atendimento, ambiente), uma por tela, estrelas SVG 1–5; avança sozinho ~400ms após o toque.
4. **Feedback aberto (opcional)** — "Continuar" ou "Pular" (grava vazio).
4b. **Avaliação no Google** — só quando as 3 notas são 5: convite com link `target="_blank"` para `CONFIG.GOOGLE_REVIEW_URL` (a tela avança sozinha para o agradecimento, sem `preventDefault`) → "Já avaliei". Qualquer nota < 5 vai direto à roleta. Textos em `CONFIG.REVIEW_*`.
5. **Roleta** — SVG gerado de `CONFIG.PRIZES` (qualquer número de fatias). Sorteia o prêmio por peso **primeiro**, depois anima (~4,8s ease-out, várias voltas) até a fatia. Não gira duas vezes. `register` roda em paralelo com a animação; falha → "Tentar novamente" sem perder o prêmio; `code:"DUPLICATE"` → novo código (até 5×).
6. **Cupom** — prêmio, código em destaque e, dentro do cupom, "Gerado em dd/mm/aaaa às hh:mm" (hora do aparelho, `emitidoEm` no `localStorage`; cupons antigos sem ele mostram só a data) e "Válido até" (ou "Expirou em"). Aviso amarelo `CONFIG.COUPON_SAVE_TEXT` (tirar print e guardar; oculto se vazio ou expirado), "Copiar código" (Clipboard API + fallback), instrução para mostrar ao garçom/caixa e `CONFIG.COUPON_POLICY_TEXT` (placeholder `{dias}`). **Nenhuma validação nesta tela.**

## Prêmios

Cada item de `CONFIG.PRIZES` é uma fatia (`nome`, `rotulo`, `peso`); prêmios repetidos somam pesos; o peso define a chance, não o tamanho da fatia. Atual: 8 fatias, soma 100, sem vizinhas iguais — Refrigerante lata 30 · 5% 5 · Drink do dia 10 · 10% 5 (×2). Chances: Refrigerante 60%, Drink 20%, 5% 10%, 10% 10%. **Nunca** uma fatia "sem prêmio".

## Cupom: geração, limite diário e validade

- Código `UND-XXXX` (`CONFIG.COUPON_PREFIX`), 4 caracteres gerados no cliente no momento do sorteio, alfabeto sem `O/0/I/1`.
- **Limite diário** (`CONFIG.DAILY_LIMIT_ENABLED` / `DAILY_LIMIT_MESSAGE`): após registro bem-sucedido, o `localStorage` guarda a data local e o último cupom; se já participou hoje, bloqueia e oferece "Ver meu cupom". Contornável limpando dados/aba anônima — barreira contra uso casual, não antifraude.
- **Validade:** `COUPON_VALIDITY_DAYS` (30) no `config.js` **e** no `Code.gs` — manter iguais; vale a do backend. Vale até o fim do último dia, em dias-calendário no fuso `TIMEZONE` (`America/Sao_Paulo`).
- **Status Uso:** `Pendente` → `Concluído` (usado a tempo) ou `Vencido`. `Concluído` nunca vira `Vencido`.
- **Gatilho diário `marcarCuponsVencidos()`** (Pendente → Vencido; ignora data ilegível), instalado manualmente uma vez por planilha: Apps Script → salvar → executar a função uma vez para autorizar → Acionadores → "+ Adicionar acionador": função `marcarCuponsVencidos`, implantação `Head`, baseado no tempo, timer diário, 2h–3h (fuso do projeto `America/Sao_Paulo`). O gatilho usa o código salvo (Head), independe do deployment.

## Geolocalização

`CONFIG.RESTAURANT_LAT/LNG` + `MAX_DISTANCE_METERS` (150). `getCurrentPosition` + Haversine: dentro → segue; fora → "Essa pesquisa só pode ser respondida dentro do estabelecimento." (sem pular); permissão negada/sem suporte/sem HTTPS → mensagem + "Tentar novamente", sem prosseguir. Burlável com GPS falso — barreira contra link compartilhado, não antifraude.

## Validação do cupom (`caixa.html`)

O cliente só mostra ou informa o código; o garçom/caixa valida em `caixa.html` no próprio aparelho. Mesma identidade e rodapé; sem geolocalização; `noindex`; não linkada pelas telas do cliente.

- **Login** via `cashierLogin`. A senha fica no `localStorage` (`CONFIG.STORAGE_KEY + "-caixa"`) até "Sair", mas nunca vale sozinha: toda chamada a reenvia e o backend confere. Resposta "Senha incorreta" → limpa a senha salva e volta ao login.
- **Dois passos, para não dar baixa em código digitado errado:** (1) digita os 4 caracteres (prefixo fixo na tela; colar o código inteiro também funciona) → `lookup`, que não altera nada e mostra prêmio, nome, emissão, validade e status; (2) só se `Pendente` aparece "Confirmar resgate" → `validate`. Já utilizado/expirado aparecem com mensagem clara, sem botão. Se o `validate` falhar porque o status mudou nesse meio-tempo, a tela passa a mostrar o status real.

## Painel administrativo (`admin.html`)

KPIs, Promotores/Neutros/Detratores (rosca + evolução), tendências com drilldown mês→dia (nota geral, por categoria, NPS), prêmios, status, analítico paginado com exportação `.xlsx`, filtro De/Até e cross-filtering — tudo recalculado no cliente sobre os dados devolvidos.

- **Login real:** o campo "Usuário" é decorativo; só libera quando o backend aceita a senha e devolve dados. A senha fica em `sessionStorage` e é revalidada no backend a cada carregamento.
- **`apiCall()`** (e `api()` nas outras páginas): até 3 tentativas, espera crescente (`CONFIG.API_RETRY_DELAY_MS` × tentativa), quando a resposta vem sem `ok` (rede; o redirect do Apps Script via `script.googleusercontent.com` falha de forma transitória, confirmado em produção) **ou** com `transient: true` — que o `doPost` põe em "Servidor ocupado" (lock) e "Erro interno" (exceção, registrada com `console.error` em Execuções do Apps Script). Erros de negócio (`ok:false` sem `transient`) voltam na hora. No `caixa.html`, falha transitória mantém o mesmo `requestId` do `validate`.
- **Filtro De/Até:** dois `<input type="date">`, pré-preenchidos com o min/max de `ALL`; `null` = sem limite; o fim vai até `23:59:59.999` (`endOfDay()`).
- **Cross-filtering** (`crossFilters = { month, day, premio, status, npsBucket }`, combinados em E por `applyCrossFilters()`): clicar em qualquer gráfico filtra todos os painéis, inclusive o clicado. Decisões:
  - O clique num mês faz drilldown **e** filtra, pelo mesmo estado compartilhado (`crossFilters.month/day`) lido pelos 3 gráficos temporais — sem botões "Voltar"; sai-se pelo × do chip ou por "Limpar filtros" (que também zera o dia).
  - Na visão diária, o clique escolhe um dia (o Chart.js recria o `onClick` a cada `renderAll()`).
  - Clicar de novo no mesmo valor desfaz. Um segmento da evolução do NPS define mês + faixa de uma vez (`elements[0].datasetIndex`).
  - `renderNPSTrend` ignora De/Até de propósito (usa todo o histórico, `computeNPSTrendRows()`), mas respeita os cross-filters.
  - Categoria (Comida/Atendimento/Ambiente) **não** é dimensão: toda resposta tem as 3 notas; clicar numa série só define mês/dia.
  - Barra `#active-filters-bar`: chips com × (`clearCrossFilter`) + "Limpar filtros" (`clearAllCrossFilters`); nenhum dos dois mexe em De/Até. "Status dos cupons" usa `<button>` (acessibilidade). `tablePage` volta a 1 em qualquer mudança.
- **"NPS" é análogo, não NPS real:** média das 3 notas por resposta — Promotor ≥ 4,5; Neutro 3,5–4,5; Detrator < 3,5 (`NPS_PROMOTER_MIN`/`NPS_NEUTRAL_MIN`). Cores só em `NPS_COLORS` (Promotor `#81C784`, Neutro `#FFD54F`, Detrator `#E57373`); `NPS_BUCKET_KEYS` fixa a ordem dos datasets e traduz `datasetIndex`. Os dois cards usam `.panel-grid.panel-grid-even` (`1fr 1fr`) + `.nps-panel` (flex column, `.chart-wrap` esticando) para ficarem idênticos; o resto usa `.panel-grid` `1.4fr 1fr`.
- `renderCatTrend` = `renderTrend` com 3 séries e legenda visível. `PRIZE_COLORS` pastel: `#90CAF9`, `#B39DDB`, `#80CBC4`, `#FFD54F`.
- **Analítico:** todas as linhas filtradas, 20 por página (`TABLE_PAGE_SIZE`). "Exportar (.xlsx)" fica no cabeçalho da seção e manda os cupons filtrados para `export`; o `.xlsx` é montado no navegador (SheetJS `aoa_to_sheet` + `writeFile`). **Não** usar `DriveApp`/exportação nativa do Google: pediria escopo OAuth novo e poderia derrubar a autorização de todo o webhook (inclusive `register`/`validate` em produção).

### Armadilhas já resolvidas — não reintroduzir

1. `tryAutoLogin()` (a primeira renderização) precisa vir **depois de toda** declaração `let`/`const` do script; antes disso, o erro de acesso-antes-da-inicialização trava todo o resto (listeners não são registrados).
2. Cada seção roda em `safeRender(fn, rows)` (try/catch + console): um gráfico que falhar (CDN bloqueado) não derruba o painel.
3. `[hidden] { display: none !important; }` é obrigatório em todas as páginas — senão uma classe com `display` própria vence o `hidden`. Testar por `getComputedStyle().display`.
4. `groupByPeriod(rows, keyFn)` chama `keyFn(r)` com a **linha inteira**, não `r.data`.
5. Toda variante de `.panel-grid` (ex.: `.panel-grid-even`) precisa estar listada junto com `.panel-grid` no `@media (max-width: 760px)`, senão nunca colapsa no mobile.
6. O espaçamento entre blocos vem só de `#dashboard > .panel-grid, #dashboard > .panel { margin-bottom: 16px; }` — o `>` evita margem interna nos `.panel` dentro do grid; um painel novo de largura cheia já nasce certo.
7. `.panel-grid > .panel { min-width: 0; }` é obrigatório: o `<canvas>` do Chart.js empurrava o card para fora da célula (342px em célula de 335px). Validar comparando `getBoundingClientRect()` de todos os cards, não a olho.

Capturas de "página inteira" desenham elementos `position: fixed` (o rodapé) na altura da viewport original — confirme rolando de verdade antes de tratar isso como bug. Chrome headless tem largura mínima de ~500px: para medir 375px, renderize dentro de um `<iframe>` de 375px.

## Planilha — colunas (ordem exata, não alterar)

1 ID / Cupom · 2 Data/Hora · 3 Nome · 4 WhatsApp (com máscara) · 5 Nota Comida · 6 Nota Atendimento · 7 Nota Ambiente · 8 Comentário (pode ser vazio) · 9 Premio Roleta · 10 Status Uso (`Pendente` | `Concluído` | `Vencido`).
Colunas de texto (1, 3, 4, 8, 9, 10) são gravadas como `@`, para um comentário iniciado por `=` não virar fórmula. Os cabeçalhos (`HEADERS`) são criados só se a aba estiver vazia (salvaguarda).

## Contrato do backend (`doPost`, campo `action`)

`fetch` sempre com `Content-Type: text/plain;charset=utf-8` (evita o preflight CORS que o Apps Script não trata). `LockService` em todo `doPost`.

- **`register`** — grava a linha com `Pendente` → `{ok:true}`. Idempotente: mesmo cupom + nome + WhatsApp → `ok:true` sem duplicar; mesmo cupom com dados diferentes → `{ok:false, code:"DUPLICATE"}`.
- **`cashierLogin`** `{senha}` → `{ok:true}` ou "Senha incorreta". Não lê a planilha.
- **`lookup`** `{cupom, senha}` — só leitura. "Senha incorreta" → "Cupom não encontrado" → `{ok:true, cupom, premio, nome, emitido (ISO), validoAte ("yyyy-MM-dd", TIMEZONE), status}`, com `Pendente` fora do prazo devolvido como `Vencido` (mesma regra de `isExpired_`; `validoAte` vem de `lastValidDay_`, o complemento exato dela). Sem WhatsApp.
- **`validate`** `{cupom, senha, requestId}` — nesta ordem: "Senha incorreta" → "Cupom não encontrado" → "Cupom já utilizado" (`Concluído`) → "Cupom expirado" (`Vencido` ou `Pendente` fora do prazo) → marca `Concluído` e devolve `{ok:true, premio, nome}`. **Idempotência:** um sucesso fica 10 min no `CacheService` sob o `requestId` (um por toque em "Confirmar resgate", reenviado igual nas repetições); a mesma chamada repetida devolve o mesmo sucesso. Outro `requestId` continua recebendo "Cupom já utilizado".
- **`admin`** `{senha}` (`ADMIN_PASSWORD`) → `{ok:true, rows:[{cupom, data (ISO), nome, notaComida, notaAtendimento, notaAmbiente, comentario, premio, status}]}` — **nunca** WhatsApp.
- **`export`** `{senha, cupons?}` (`ADMIN_PASSWORD`) → `{ok:true, headers, rows}` com as 10 colunas na ordem de `HEADERS`, **incluindo WhatsApp** (exceção deliberada, só para a exportação). Sem `cupons`, exporta tudo. Só lê a planilha.

## Dados de demonstração — `gerarDadosDemo()`

Função só manual (fora do `doPost`), executada pelo editor do Apps Script. Grava 150 linhas `Cliente Demo 001`–`150` **na planilha em uso** (apagar depois se for produção): datas nos últimos 90 dias (11h–23h), notas melhorando com o tempo (média ~4,5), status pela mesma regra de dias-calendário de `isExpired_` (> validade: 70% Concluído / 30% Vencido; ≤ validade: 50% Pendente / 50% Concluído), cupons sem colidir com os existentes, um único `setValues`, resumo no `Logger.log`. **Se `CONFIG.PRIZES` mudar, atualizar `DEMO_PRIZES`** (não são lidos da mesma fonte).

## Definition of Done

- [ ] UI funciona offline após o carregamento (rede só para os `fetch`).
- [ ] ~375px sem overflow horizontal.
- [ ] Geolocalização bloqueia quando `RESTAURANT_LAT/LNG` aponta para longe.
- [ ] Resgatar o mesmo cupom duas vezes → "Cupom já utilizado", sem derrubar o script.
- [ ] Reaplicar em outro cliente = trocar `config.js` + `CASHIER_PASSWORD`/`ADMIN_PASSWORD` no `Code.gs` (e instalar o gatilho diário), sem tocar no resto.
- [ ] Antes de entregar: `MAX_DISTANCE_METERS` volta a 150 e `DAILY_LIMIT_ENABLED` a `true` (hoje em modo de teste).
