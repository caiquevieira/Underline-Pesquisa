/**
 * Pesquisa de Satisfação + Roleta da Sorte — Underline
 * Backend (Google Apps Script vinculado à planilha).
 *
 * Ao atualizar este arquivo: Implantar > Gerenciar implantações > (lápis) >
 * Versão: "Nova versão" > Implantar. Isso mantém a mesma URL do webhook.
 */

// ---- Configuração por cliente -------------------------------------------
var CASHIER_PASSWORD = '1234';        // Trocar por cliente
var SHEET_NAME = '';                  // Vazio = primeira aba da planilha
var TIMEZONE = 'America/Sao_Paulo';
// Validade do cupom em dias, contada a partir da data de emissão (Data/Hora da linha).
// Vale até o fim do último dia. Manter igual a CONFIG.COUPON_VALIDITY_DAYS do index.html.
var COUPON_VALIDITY_DAYS = 30;
var STATUS_PENDING = 'Pendente';
var STATUS_DONE = 'Concluído';
var STATUS_EXPIRED = 'Vencido';       // Definido por marcarCuponsVencidos (gatilho diário)
var IDEMPOTENCY_TTL_SECONDS = 600;    // Quanto tempo um validate bem-sucedido fica repetível pelo mesmo requestId

// Ordem exata das colunas — não alterar.
var HEADERS = [
  'ID / Cupom', 'Data/Hora', 'Nome', 'WhatsApp',
  'Nota Comida', 'Nota Atendimento', 'Nota Ambiente',
  'Comentário', 'Premio Roleta', 'Status Uso'
];
var COL = { CUPOM: 1, DATA: 2, NOME: 3, WHATSAPP: 4, PREMIO: 9, STATUS: 10 };

// ---- Entradas -------------------------------------------------------------

function doGet() {
  return json_({ ok: true, service: 'Underline Pesquisa' });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Requisição inválida' });
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return json_({ ok: false, error: 'Servidor ocupado. Tente novamente.' });
  }

  try {
    switch (body && body.action) {
      case 'register': return json_(register_(body));
      case 'validate': return json_(validate_(body));
      default: return json_({ ok: false, error: 'Ação inválida' });
    }
  } catch (err) {
    return json_({ ok: false, error: 'Erro interno. Tente novamente.' });
  } finally {
    lock.releaseLock();
  }
}

// ---- Ações -----------------------------------------------------------------

function register_(b) {
  var cupom = str_(b.cupom, 20).toUpperCase();
  var nome = str_(b.nome, 120);
  var whatsapp = str_(b.whatsapp, 20);
  var notas = [b.notaComida, b.notaAtendimento, b.notaAmbiente].map(Number);
  var premio = str_(b.premio, 120);

  var notasOk = notas.every(function (n) { return n >= 1 && n <= 5 && n % 1 === 0; });
  if (!/^[A-Z0-9]+-[A-Z0-9]{4}$/.test(cupom) || !nome || !premio ||
      !/^\(\d{2}\) \d{5}-\d{4}$/.test(whatsapp) || !notasOk) {
    return { ok: false, error: 'Dados inválidos' };
  }

  var sheet = getSheet_();
  var existing = findRow_(sheet, cupom);
  if (existing) {
    // Reenvio do mesmo participante (ex.: falha de rede na resposta) é idempotente.
    var row = sheet.getRange(existing, 1, 1, HEADERS.length).getValues()[0];
    if (String(row[COL.NOME - 1]) === nome && String(row[COL.WHATSAPP - 1]) === whatsapp) {
      return { ok: true };
    }
    return { ok: false, code: 'DUPLICATE', error: 'Cupom duplicado' };
  }

  var target = sheet.getLastRow() + 1;
  // Colunas de texto ficam em formato texto: evita conversão automática e
  // impede que um comentário iniciado por "=" seja interpretado como fórmula.
  [1, 3, 4, 8, 9, 10].forEach(function (c) {
    sheet.getRange(target, c).setNumberFormat('@');
  });
  sheet.getRange(target, COL.DATA).setNumberFormat('dd/MM/yyyy HH:mm');

  sheet.getRange(target, 1, 1, HEADERS.length).setValues([[
    cupom, new Date(), nome, whatsapp,
    notas[0], notas[1], notas[2],
    str_(b.comentario, 500), premio, STATUS_PENDING
  ]]);
  SpreadsheetApp.flush();
  return { ok: true };
}

function validate_(b) {
  // Senha primeiro: quem não tem a senha não descobre quais cupons existem.
  if (String(b.senha == null ? '' : b.senha) !== String(CASHIER_PASSWORD)) {
    return { ok: false, error: 'Senha incorreta' };
  }

  var cupom = str_(b.cupom, 20).toUpperCase();

  // Idempotência: o front-end reenvia o MESMO requestId ao repetir uma chamada cuja resposta
  // se perdeu. Se aquela chamada já validou o cupom, devolvemos o sucesso guardado em vez de
  // "Cupom já utilizado". Um cupom realmente já usado (outro requestId) continua dando erro.
  var requestId = str_(b.requestId, 64);
  var cacheKey = requestId ? 'validate:' + requestId : '';
  var cache = CacheService.getScriptCache();
  if (cacheKey) {
    var hit = cache.get(cacheKey);
    if (hit) {
      var saved = JSON.parse(hit);
      if (saved.cupom === cupom) return saved.result;
    }
  }

  var sheet = getSheet_();
  var rowIndex = findRow_(sheet, cupom);
  if (!rowIndex) return { ok: false, error: 'Cupom não encontrado' };

  var row = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];
  var status = String(row[COL.STATUS - 1]).trim();

  if (status === STATUS_DONE) return { ok: false, error: 'Cupom já utilizado' };
  if (status === STATUS_EXPIRED || isExpired_(row[COL.DATA - 1])) {
    return { ok: false, error: 'Cupom expirado' };
  }
  if (status !== STATUS_PENDING) return { ok: false, error: 'Status do cupom inválido' };

  sheet.getRange(rowIndex, COL.STATUS).setValue(STATUS_DONE);
  SpreadsheetApp.flush();

  var result = { ok: true, premio: row[COL.PREMIO - 1], nome: row[COL.NOME - 1] };
  if (cacheKey) {
    cache.put(cacheKey, JSON.stringify({ cupom: cupom, result: result }), IDEMPOTENCY_TTL_SECONDS);
  }
  return result;
}

/**
 * Rotina para gatilho diário: muda de "Pendente" para "Vencido" os cupons que passaram
 * de COUPON_VALIDITY_DAYS. Não mexe em "Concluído" (foi usado a tempo) nem em linhas
 * cuja Data/Hora não possa ser lida. Devolve quantas linhas mudou.
 */
function marcarCuponsVencidos() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('marcarCuponsVencidos: servidor ocupado, nada foi alterado.');
    return 0;
  }
  try {
    var sheet = getSheet_();
    var last = sheet.getLastRow();
    if (last < 2) return 0;

    var rows = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
    var changed = 0;
    for (var i = 0; i < rows.length; i++) {
      var status = String(rows[i][COL.STATUS - 1]).trim();
      if (status === STATUS_PENDING && isExpired_(rows[i][COL.DATA - 1])) {
        sheet.getRange(i + 2, COL.STATUS).setValue(STATUS_EXPIRED);
        changed++;
      }
    }
    if (changed) SpreadsheetApp.flush();
    Logger.log('marcarCuponsVencidos: ' + changed + ' cupom(ns) marcado(s) como Vencido.');
    return changed;
  } finally {
    lock.releaseLock();
  }
}

// ---- Dados de demonstração (só manual) -------------------------------------

/**
 * SOMENTE MANUAL — não passa por doPost. Rode escolhendo "gerarDadosDemo" no seletor de
 * função do editor do Apps Script e clicando em Executar.
 *
 * Gera 150 linhas sintéticas ("Cliente Demo 001" a "150") para popular dashboards de
 * demonstração, com datas espalhadas nos últimos 90 dias e uma tendência de melhora nas
 * notas ao longo do tempo (interpolação linear entre médias-alvo calibradas para a média
 * final das 450 notas ficar perto de 4,5 — ver NOTE_SIGMA/NOTE_JITTER/MEAN_AT_*D). Escreve
 * tudo em UM único lote (setValues), não em 150 chamadas de appendRow. Loga e devolve um
 * resumo: média das 450 notas, contagem de linhas por status, e confirmação de que não há
 * cupom duplicado no lote gerado.
 */
function gerarDadosDemo() {
  var N = 150;
  var HORIZON_DAYS = 90;
  // Calibrados via simulação (ver histórico do projeto) para a média das 450 notas
  // convergir perto de 4,5 mesmo variando de execução para execução.
  var NOTE_SIGMA = 0.66;    // largura da distribuição de cada nota em torno da média-alvo
  var NOTE_JITTER = 0.3;    // variação independente entre as 3 perguntas da mesma linha
  var MEAN_AT_90D = 4.23;   // média-alvo no dia mais antigo (90 dias atrás)
  var MEAN_AT_0D = 5.2;     // média-alvo no dia mais recente (hoje)

  // Mesmos pesos (agregados) de CONFIG.PRIZES no index.html.
  var DEMO_PRIZES = [
    { nome: 'Refrigerante lata', peso: 60 },
    { nome: 'Drink do dia', peso: 20 },
    { nome: '5% de desconto', peso: 10 },
    { nome: '10% de desconto', peso: 10 }
  ];
  var PRAISE = [
    'Comida excelente, com certeza vou voltar!',
    'Atendimento impecável, equipe muito atenciosa.',
    'Ambiente super agradável, adorei a experiência.',
    'Tudo perfeito, recomendo de olhos fechados.',
    'Melhor experiência que tive em muito tempo por aqui.'
  ];
  var NEUTRAL = [
    'Achei tudo dentro do esperado.',
    'Foi uma experiência ok, sem grandes destaques.',
    'Nada a reclamar, mas também nada surpreendente.',
    'Cumpriu o que prometeu.'
  ];
  var CRITIC = [
    'Demorou mais do que eu esperava.',
    'O ambiente estava um pouco barulhento.',
    'Achei o prato um pouco abaixo do esperado hoje.',
    'Poderia ser mais rápido no atendimento.',
    'Senti falta de mais atenção da equipe.'
  ];

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('gerarDadosDemo: servidor ocupado, nada foi gerado.');
    return null;
  }
  try {
    var sheet = getSheet_();

    // Cupons já existentes (produção + testes anteriores) para o novo lote nunca colidir.
    var existing = {};
    var last = sheet.getLastRow();
    if (last >= 2) {
      var ids = sheet.getRange(2, COL.CUPOM, last - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) existing[String(ids[i][0]).trim().toUpperCase()] = true;
    }
    function newCoupon_() {
      var c;
      do { c = 'UND-' + randCode_(4); } while (existing[c]);
      existing[c] = true;
      return c;
    }

    var now = new Date();
    var rows = [];
    var sumNotes = 0, countNotes = 0;
    var statusCount = {};
    statusCount[STATUS_PENDING] = 0;
    statusCount[STATUS_DONE] = 0;
    statusCount[STATUS_EXPIRED] = 0;

    for (var n = 1; n <= N; n++) {
      var daysAgo = Math.random() * HORIZON_DAYS;
      var date = new Date(now.getTime() - daysAgo * 86400000);
      // Horário variado dentro do dia, em janela plausível de restaurante (11h–22h59).
      date.setHours(11 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0);

      var targetMean = MEAN_AT_90D + (MEAN_AT_0D - MEAN_AT_90D) * (HORIZON_DAYS - daysAgo) / HORIZON_DAYS;
      var notaComida = sampleNote_(targetMean, NOTE_SIGMA, NOTE_JITTER);
      var notaAtendimento = sampleNote_(targetMean, NOTE_SIGMA, NOTE_JITTER);
      var notaAmbiente = sampleNote_(targetMean, NOTE_SIGMA, NOTE_JITTER);
      var media3 = (notaComida + notaAtendimento + notaAmbiente) / 3;
      sumNotes += notaComida + notaAtendimento + notaAmbiente;
      countNotes += 3;

      // Decide pela mesma regra de isExpired_ sobre a data JÁ com o horário ajustado acima —
      // não pelo daysAgo contínuo, que o setHours() pode empurrar para o outro lado dos 30
      // dias e deixar o status inconsistente com o que validate_/isExpired_ diriam depois.
      var status;
      if (dayNumber_(now) - dayNumber_(date) > COUPON_VALIDITY_DAYS) {
        status = Math.random() < 0.7 ? STATUS_DONE : STATUS_EXPIRED;
      } else {
        status = Math.random() < 0.5 ? STATUS_PENDING : STATUS_DONE;
      }
      statusCount[status]++;

      rows.push([
        newCoupon_(), date, 'Cliente Demo ' + ('00' + n).slice(-3), fakePhone_(),
        notaComida, notaAtendimento, notaAmbiente,
        pickComment_(media3, PRAISE, NEUTRAL, CRITIC), pickPrize_(DEMO_PRIZES), status
      ]);
    }

    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, N, HEADERS.length).setValues(rows); // um único lote
    [1, 3, 4, 8, 9, 10].forEach(function (c) { sheet.getRange(startRow, c, N, 1).setNumberFormat('@'); });
    sheet.getRange(startRow, COL.DATA, N, 1).setNumberFormat('dd/MM/yyyy HH:mm');
    SpreadsheetApp.flush();

    // Confirmação independente de que o lote gerado não tem cupom repetido.
    var seen = {}, dupCount = 0;
    rows.forEach(function (r) { if (seen[r[0]]) dupCount++; seen[r[0]] = true; });

    var resumo = {
      linhasGeradas: N,
      mediaNotas: Math.round((sumNotes / countNotes) * 10000) / 10000,
      porStatus: statusCount,
      cuponsDuplicados: dupCount
    };
    Logger.log('gerarDadosDemo: ' + JSON.stringify(resumo));
    return resumo;
  } finally {
    lock.releaseLock();
  }
}

/** Sorteia uma nota 1–5 com peso maior perto de targetMean (mais um ruído gaussiano por pergunta). */
function sampleNote_(targetMean, sigma, jitterSigma) {
  var g = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random()); // Box-Muller
  var qMean = Math.min(5, Math.max(1, targetMean + g * jitterSigma));
  var weights = [1, 2, 3, 4, 5].map(function (v) {
    return Math.exp(-((v - qMean) * (v - qMean)) / (2 * sigma * sigma));
  });
  return weightedPick_(weights);
}

function weightedPick_(weights) {
  var total = weights.reduce(function (a, b) { return a + b; }, 0);
  var r = Math.random() * total;
  for (var v = 0; v < weights.length; v++) { r -= weights[v]; if (r < 0) return v + 1; }
  return weights.length;
}

function pickPrize_(prizes) {
  var total = prizes.reduce(function (s, p) { return s + p.peso; }, 0);
  var r = Math.random() * total;
  for (var i = 0; i < prizes.length; i++) { r -= prizes[i].peso; if (r < 0) return prizes[i].nome; }
  return prizes[prizes.length - 1].nome;
}

/** ~40% das linhas sem comentário; nas demais, elogio para nota alta, neutro/crítico para nota baixa. */
function pickComment_(media3, praise, neutral, critic) {
  if (Math.random() < 0.4) return '';
  var pool = media3 >= 4.3 ? praise : (media3 >= 3.3 ? neutral : critic);
  return pool[Math.floor(Math.random() * pool.length)];
}

function fakePhone_() {
  var DDDS = [11, 21, 31, 41, 51, 61, 71, 81, 85, 91]; // DDDs plausíveis, espalhados pelo país
  var ddd = DDDS[Math.floor(Math.random() * DDDS.length)];
  var linha = 90000 + Math.floor(Math.random() * 10000); // celular: começa com 9
  var suf = Math.floor(Math.random() * 10000);
  return '(' + ddd + ') ' + linha + '-' + ('000' + suf).slice(-4);
}

/** Mesmo alfabeto do gerador de cupom do front-end (sem O/0/I/1, para não confundir na leitura). */
function randCode_(len) {
  var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var s = '';
  for (var i = 0; i < len; i++) s += A.charAt(Math.floor(Math.random() * A.length));
  return s;
}

// ---- Utilitários -------------------------------------------------------------

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
  if (!sheet) throw new Error('Aba não encontrada');
  // Salvaguarda: só cria cabeçalhos se a aba estiver vazia.
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

/** Retorna o número da linha (1-based) do cupom, ou 0 se não existir. */
function findRow_(sheet, cupom) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var ids = sheet.getRange(2, COL.CUPOM, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim().toUpperCase() === cupom) return i + 2;
  }
  return 0;
}

/** true se hoje (fuso TIMEZONE) passou do último dia de validade. Sem data legível, não expira. */
function isExpired_(issued) {
  var d = toDate_(issued);
  if (!d) return false;
  return dayNumber_(new Date()) - dayNumber_(d) > COUPON_VALIDITY_DAYS;
}

function dayNumber_(d) {
  var p = Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd').split('-');
  return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000;
}

function toDate_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  var s = String(v == null ? '' : v).trim();
  var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);            // dd/MM/yyyy [HH:mm]
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], 12);
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function str_(v, max) {
  var s = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  return max ? s.slice(0, max) : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
