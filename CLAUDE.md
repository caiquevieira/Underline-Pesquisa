# Pesquisa de Satisfação + Roleta da Sorte — Underline

Template reutilizável (multi-cliente) de pesquisa de satisfação com prêmio garantido via roleta, para restaurantes de ticket médio-alto (acima de R$50). Uso: QR Code / NFC na mesa.

## Stack e restrições não-negociáveis

- **Zero build step.** HTML + CSS + JS puro em um único arquivo `index.html` (self-contained, sem dependências externas de CDN/fonte — usar font-stack de sistema). Sem React, sem bundler.
- **Backend:** Google Apps Script (`Code.gs`) vinculado a uma planilha Google Sheets. Web app já existe e está deployado:
  - Webhook: `https://script.google.com/macros/s/AKfycbyIAAEirtDqZNlXj1l_MQBVrFzd7qK-WpoKiipm5VXhiHXGFb6pMQRCZ83KivYrpKCo/exec`
  - Ao atualizar o `Code.gs`, publicar como **nova versão do mesmo deployment** (não criar deployment novo) para manter essa URL viva.
- **Mobile-first**, uma tela por vez, sem rolagem excessiva. Fluxo em cards que trocam via JS (sem reload de página, sem rotas).
- **Identidade visual (fixa, não é livre):** fundo amarelo/ouro `#FFD100`, elementos e texto em preto absoluto `#000000`, cards de conteúdo em branco `#FFFFFF` para dar contraste. Tipografia bold, geométrica, sem serifa. Botões grandes tipo pílula (border-radius total), pretos com texto amarelo/branco, feedback tátil no `:active` (scale down leve). Sem emojis na interface. Tom de voz direto, sem gírias — público de ticket médio-alto.
- **Configuração no topo do arquivo:** todo dado específico de cliente (nome do restaurante, logo, webhook, prêmios, coordenadas, senha) deve viver em um objeto `CONFIG` único no topo do `<script>`, para reaproveitar o mesmo arquivo trocando só essas variáveis.

## Estrutura de arquivos

```
index.html   → fluxo completo do cliente (única página)
Code.gs      → backend Apps Script (registro + validação de cupom)
```

Não existe mais página separada de caixa — decisão explícita: usar senha simples embutida na própria tela do cupom (ver seção "Validação do cupom"), aceitando a limitação de segurança conhecida (senha visível no código-fonte do navegador) como trade-off aceitável nesta fase.

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
6. **Resultado / Cupom** — mostra nome do prêmio, código do cupom em destaque, botão "Copiar código" (Clipboard API). Um link discreto (texto pequeno, tipo "Já é cliente do estabelecimento?" ou similar, não um botão chamativo) revela um campo de senha inline nesta mesma tela — ver "Validação do cupom".

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
- No clique em "Começar agora", **antes** da geolocalização: se a data guardada for hoje, mostra a mensagem e bloqueia a pesquisa. A tela de bloqueio oferece "Ver meu cupom" (último cupom, com validade e campo do estabelecimento).
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
- A tela do cupom mostra "Válido até dd/mm/aaaa" e um texto de políticas discreto (`CONFIG.COUPON_POLICY_TEXT`, com `{dias}`): "Válido para sua próxima visita. Não cumulativo com outras promoções ou descontos. Válido por 30 dias a partir da data de emissão."

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

## Validação do cupom (senha simples, decisão atual)

- `CONFIG` do front-end recebe `CASHIER_PASSWORD` (senha fixa e simples, ex. `1234` — trocar por cliente).
- Na tela de Resultado, um link discreto revela um campo de senha. Ao digitar a senha correta:
  1. Front-end faz `fetch POST` para o webhook com `{ action: "validate", cupom: "<código>", senha: "<digitada>" }`.
  2. **Validação real da senha acontece no `Code.gs`** (comparar contra constante `CASHIER_PASSWORD` no backend), não no JS do front-end — mesmo sendo a "opção simples", não expor a senha certa em texto plano no HTML entregue ao navegador. O front-end só sabe se acertou ou errou pela resposta do backend.
  3. Se a senha bate **e** o cupom está com `Status Uso = "Pendente"` → backend atualiza para `"Concluído"` e retorna sucesso.
  4. Se o cupom já está `"Concluído"` → backend retorna erro específico: **"Cupom já utilizado"** (não genérico). O front-end deve exibir essa mensagem de forma clara para o garçom pedir ao cliente para refazer a pesquisa.
  5. Se o cupom não existe na planilha → erro "Cupom não encontrado".

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
- **`action: "validate"`** — recebe `cupom`, `senha` e `requestId` (opcional, ver abaixo). Compara senha contra `CASHIER_PASSWORD` (constante no topo do `Code.gs`). Busca o cupom na planilha:
  - senha errada → `{ ok: false, error: "Senha incorreta" }` (checada primeiro)
  - não encontrado → `{ ok: false, error: "Cupom não encontrado" }`
  - já `"Concluído"` → `{ ok: false, error: "Cupom já utilizado" }`
  - `"Vencido"` ou `Pendente` além do prazo → `{ ok: false, error: "Cupom expirado" }`
  - válido e pendente → atualiza status, retorna `{ ok: true, premio, nome }`
  - **Idempotência:** o front-end gera um `requestId` por clique em "Validar cupom" e o reenvia igual nas repetições (retry de `api()`, ou novo clique após falha de rede). Um `validate` bem-sucedido fica guardado 10 min no `CacheService` sob esse `requestId`; se chegar de novo (mesmo `requestId` e mesmo cupom), devolve o mesmo sucesso em vez de "Cupom já utilizado". Só sucessos são guardados, e a senha continua sendo conferida antes. Um cupom realmente já usado (outro `requestId`) segue dando "Cupom já utilizado".

O front-end (`api()`) repete uma vez, após `CONFIG.API_RETRY_DELAY_MS` (1 s), qualquer resposta sem o campo `ok` ou falha de rede/timeout; erros de negócio (`ok:false`) não são repetidos. O `register` é idempotente no backend (mesmo cupom + nome + WhatsApp devolve `ok:true`).

Enviar o `fetch` do front-end com `Content-Type: text/plain;charset=utf-8` (não `application/json`) — evita o preflight CORS que o Apps Script não trata bem. O `e.postData.contents` continua sendo o JSON string normalmente.

Criar cabeçalhos automaticamente (`HEADERS` array) se a aba estiver vazia na primeira execução — mas como a planilha e o deployment **já existem**, isso é só uma salvaguarda, não o caminho principal.

## Definition of Done

- [ ] Roda 100% offline após o carregamento inicial (só depende de rede para o `fetch` final, não para renderizar a UI).
- [ ] Testado em viewport de ~375px de largura sem overflow horizontal.
- [ ] Bloqueio por geolocalização funcional e testável trocando `RESTAURANT_LAT/LNG` para um valor distante.
- [ ] Reuso do mesmo cupom gerado duas vezes retorna "Cupom já utilizado" e não derruba o script.
- [ ] Trocar `CONFIG.RESTAURANT_NAME`, `CONFIG.LOGO_*`, `CONFIG.WEBHOOK_URL`, `CONFIG.PRIZES` e `CONFIG.CASHIER_PASSWORD` é suficiente para reaplicar o template em outro cliente, sem tocar no resto do código.
