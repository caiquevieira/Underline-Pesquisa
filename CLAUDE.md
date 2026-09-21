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

| Prêmio | Peso (%) |
|---|---|
| 10% de desconto na conta | 30 |
| Sobremesa cortesia | 25 |
| Entrada cortesia | 20 |
| Drink autoral cortesia | 15 |
| 5% de desconto na conta | 7 |
| 20% de desconto na conta | 3 |

Nunca incluir uma fatia "sem prêmio" — a promessa da tela de boas-vindas é prêmio garantido.

## Geração do cupom

- Formato: `UND-XXXX`, 4 caracteres alfanuméricos maiúsculos, gerados no client-side.
- Excluir caracteres ambíguos do gerador (`O`/`0`, `I`/`1`) para reduzir erro de leitura na hora do resgate.
- Gerado no momento em que a roleta sorteia o prêmio (antes da animação terminar).

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
| 10 | Status Uso | `"Pendente"` (default) → `"Concluído"` |

## Contrato do backend (`Code.gs`)

`doPost(e)` recebe JSON com campo `action`:

- **`action: "register"`** — insere uma nova linha com `Status Uso = "Pendente"`. Retorna `{ ok: true }`.
- **`action: "validate"`** — recebe `cupom` e `senha`. Compara senha contra `CASHIER_PASSWORD` (constante no topo do `Code.gs`). Busca o cupom na planilha:
  - não encontrado → `{ ok: false, error: "Cupom não encontrado" }`
  - já `"Concluído"` → `{ ok: false, error: "Cupom já utilizado" }`
  - senha errada → `{ ok: false, error: "Senha incorreta" }`
  - válido e pendente → atualiza status, retorna `{ ok: true, premio, nome }`

Enviar o `fetch` do front-end com `Content-Type: text/plain;charset=utf-8` (não `application/json`) — evita o preflight CORS que o Apps Script não trata bem. O `e.postData.contents` continua sendo o JSON string normalmente.

Criar cabeçalhos automaticamente (`HEADERS` array) se a aba estiver vazia na primeira execução — mas como a planilha e o deployment **já existem**, isso é só uma salvaguarda, não o caminho principal.

## Definition of Done

- [ ] Roda 100% offline após o carregamento inicial (só depende de rede para o `fetch` final, não para renderizar a UI).
- [ ] Testado em viewport de ~375px de largura sem overflow horizontal.
- [ ] Bloqueio por geolocalização funcional e testável trocando `RESTAURANT_LAT/LNG` para um valor distante.
- [ ] Reuso do mesmo cupom gerado duas vezes retorna "Cupom já utilizado" e não derruba o script.
- [ ] Trocar `CONFIG.RESTAURANT_NAME`, `CONFIG.LOGO_*`, `CONFIG.WEBHOOK_URL`, `CONFIG.PRIZES` e `CONFIG.CASHIER_PASSWORD` é suficiente para reaplicar o template em outro cliente, sem tocar no resto do código.
