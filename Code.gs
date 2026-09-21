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

  var sheet = getSheet_();
  var rowIndex = findRow_(sheet, str_(b.cupom, 20).toUpperCase());
  if (!rowIndex) return { ok: false, error: 'Cupom não encontrado' };

  var row = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];
  var status = String(row[COL.STATUS - 1]).trim();

  if (status === STATUS_DONE) return { ok: false, error: 'Cupom já utilizado' };
  if (isExpired_(row[COL.DATA - 1])) return { ok: false, error: 'Cupom expirado' };
  if (status !== STATUS_PENDING) return { ok: false, error: 'Status do cupom inválido' };

  sheet.getRange(rowIndex, COL.STATUS).setValue(STATUS_DONE);
  SpreadsheetApp.flush();
  return { ok: true, premio: row[COL.PREMIO - 1], nome: row[COL.NOME - 1] };
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
