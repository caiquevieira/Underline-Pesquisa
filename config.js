/**
 * Pesquisa de Satisfação + Roleta da Sorte — Underline
 * Configuração compartilhada — carregada por index.html, caixa.html e admin.html
 * (<script src="config.js">, antes do <script> de cada página). Todo dado específico de
 * cliente (nome do restaurante, logo, webhook, prêmios, coordenadas...) vive só aqui, para
 * as páginas nunca ficarem dessincronizadas ao reaplicar o template em outro cliente.
 *
 * Não é um build step: é um segundo arquivo estático, sem bundler, sem transpilação.
 *
 * A senha do caixa e a senha do admin NÃO ficam aqui: são validadas no Code.gs
 * (constantes CASHIER_PASSWORD e ADMIN_PASSWORD).
 */
const CONFIG = {
  RESTAURANT_NAME: 'Restaurante Exemplo',
  LOGO_DATA_URI: '',        // data:image/...;base64,... (preferencial)
  LOGO_URL: '',             // alternativa; se ambos vazios, mostra um placeholder "Seu logo aqui"
  WEBHOOK_URL: 'https://script.google.com/macros/s/AKfycbyIAAEirtDqZNlXj1l_MQBVrFzd7qK-WpoKiipm5VXhiHXGFb6pMQRCZ83KivYrpKCo/exec',

  // Geolocalização (só index.html) — SUBSTITUIR pelas coordenadas do restaurante.
  RESTAURANT_LAT: -23.5505,
  RESTAURANT_LNG: -46.6333,
  MAX_DISTANCE_METERS: 2000000000, // TEMPORÁRIO (testes): voltar para 150

  COUPON_PREFIX: 'UND',
  STORAGE_KEY: 'underline-pesquisa',
  API_RETRY_DELAY_MS: 1000,   // espera antes da 2ª tentativa quando a resposta do webhook vem inválida

  // Limite de 1 participação por aparelho por dia (data local do aparelho, via localStorage).
  // false: desliga o bloqueio (útil em testes).
  DAILY_LIMIT_ENABLED: false, // TEMPORÁRIO (testes): voltar para true
  DAILY_LIMIT_MESSAGE: 'Você já participou hoje. Volte amanhã!',

  // Validade do cupom. Manter igual à constante COUPON_VALIDITY_DAYS do Code.gs
  // (a regra que vale é a do backend). Placeholders: {dias} e {data} (dd/mm/aaaa).
  COUPON_VALIDITY_DAYS: 30,
  COUPON_POLICY_TEXT: 'Válido para sua próxima visita. Não cumulativo com outras promoções ou descontos. Válido por {dias} dias a partir da data de emissão.',

  CONSENT_TEXT: 'Ao continuar, você concorda com o uso do seu nome e WhatsApp pelo estabelecimento para fins desta pesquisa e do resgate do prêmio.',

  // Etapa opcional de avaliação no Google (só index.html) — só aparece quando as 3 notas do
  // CSAT são 5. Trocar pelo link de avaliação do Place ID de cada cliente.
  GOOGLE_REVIEW_URL: 'https://search.google.com/local/writereview?placeid=ChIJ8c9z_0j_zpQR2PkScmZf2KI',
  REVIEW_TITLE: 'Ficamos felizes que você gostou!',
  REVIEW_TEXT: 'Sua avaliação no Google ajuda outras pessoas a conhecerem o nosso trabalho.',
  REVIEW_BTN_RATE: 'Avaliar no Google',
  REVIEW_BTN_SKIP: 'Pular',
  // 2ª tela: aparece assim que o cliente clica em "Avaliar no Google" (a aba nova abre e,
  // ao mesmo tempo, a tela avança sozinha para esta — sem precisar de mais nenhuma ação).
  REVIEW_THANKS_TITLE: 'Obrigado por avaliar!',
  REVIEW_THANKS_TEXT: 'Quando terminar de escrever sua avaliação, toque no botão abaixo para continuar.',
  REVIEW_BTN_DONE: 'Já avaliei',

  QUESTIONS: [
    'Como foi a qualidade da comida e o sabor?',
    'Como foi a velocidade e a qualidade do atendimento?',
    'Como foi o ambiente, o conforto e a limpeza?'
  ],

  // Cada item é uma fatia da roleta (só index.html). peso: chance relativa da fatia (não
  // precisa somar 100); prêmios repetidos somam os pesos. rotulo: texto curto na fatia.
  // Se estes prêmios mudarem, atualizar também DEMO_PRIZES em gerarDadosDemo() no Code.gs
  // (os pesos agregados não são lidos de um lugar só).
  PRIZES: [
    { nome: 'Refrigerante lata', rotulo: 'Refrigerante', peso: 30 },
    { nome: '5% de desconto',    rotulo: '5% OFF',       peso: 5 },
    { nome: 'Drink do dia',      rotulo: 'Drink do dia', peso: 10 },
    { nome: '10% de desconto',   rotulo: '10% OFF',      peso: 5 },
    { nome: 'Refrigerante lata', rotulo: 'Refrigerante', peso: 30 },
    { nome: '5% de desconto',    rotulo: '5% OFF',       peso: 5 },
    { nome: 'Drink do dia',      rotulo: 'Drink do dia', peso: 10 },
    { nome: '10% de desconto',   rotulo: '10% OFF',      peso: 5 }
  ],

  // Admin (só admin.html)
  ADMIN_TITLE: 'Painel administrativo'
};
