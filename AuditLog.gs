/**
 * @file AuditLog.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Auditoria estruturada, redigida e compatível com a ordem real
 *              dos cabeçalhos da planilha.
 */

function AuditLog() {
  Logger.log('Iniciando componente: AuditLog.gs');
}

AuditLog.MAX_EVENTS = 200;
AuditLog.MAX_TEXT_LENGTH = 2000;
AuditLog.SENSITIVE_KEY = /password|senha|token|secret|authorization|cookie|credential/i;

AuditLog.normalizeHeader_ = function(header) {
  return String(header || '').trim().toLowerCase();
};

AuditLog.normalizeEventType_ = function(eventType) {
  const normalized = String(eventType || '').trim().toUpperCase();
  if (!/^[A-Z0-9_:-]{2,80}$/.test(normalized)) throw new Error('Tipo de evento de auditoria inválido.');
  return normalized;
};

AuditLog.sanitizeData_ = function(value, stack, depth) {
  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.length > AuditLog.MAX_TEXT_LENGTH
      ? value.slice(0, AuditLog.MAX_TEXT_LENGTH) + '…'
      : value;
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: AuditLog.sanitizeData_(value.message, [], 0) };
  if (typeof value !== 'object') return String(value);
  stack = stack || [];
  depth = Number(depth) || 0;
  if (depth >= 8) return '[MAX_DEPTH]';
  if (stack.indexOf(value) !== -1) return '[CIRCULAR]';
  stack.push(value);
  let sanitized;
  if (Array.isArray(value)) {
    sanitized = value.slice(0, 100).map(function(item) {
      return AuditLog.sanitizeData_(item, stack, depth + 1);
    });
  } else {
    sanitized = {};
    Object.keys(value).slice(0, 100).forEach(function(key) {
      sanitized[key] = AuditLog.SENSITIVE_KEY.test(key)
        ? '[REDACTED]'
        : AuditLog.sanitizeData_(value[key], stack, depth + 1);
    });
  }
  stack.pop();
  return sanitized;
};

AuditLog.getActor_ = function() {
  try {
    if (typeof SessionManager === 'undefined' || !SessionManager.getSessionUser) return null;
    return SessionManager.getSessionUser();
  } catch (ignore) {
    return null;
  }
};

AuditLog.appendByHeaders_ = function(sheet, record) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  if (!headers.length) throw new Error('Aba de auditoria sem cabeçalhos. Execute a migração de schema.');
  const normalizedHeaders = headers.map(AuditLog.normalizeHeader_);
  const required = ['timestamp', 'eventtype', 'payload'];
  const missing = required.filter(function(header) { return normalizedHeaders.indexOf(header) === -1; });
  if (missing.length) throw new Error('Schema de auditoria incompatível; faltam: ' + missing.join(', '));
  const row = normalizedHeaders.map(function(header) {
    return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
  });
  sheet.appendRow(row);
};

AuditLog.logEvent = function(eventType, data) {
  let lock = null;
  try {
    const normalizedType = AuditLog.normalizeEventType_(eventType);
    const safeData = AuditLog.sanitizeData_(data || {});
    const requestedSource = safeData && safeData.source;
    if (safeData && typeof safeData === 'object' && !Array.isArray(safeData)) delete safeData.source;
    const actor = AuditLog.getActor_();
    const source = ['Web', 'Admin', 'API', 'System'].indexOf(requestedSource) >= 0
      ? requestedSource
      : (actor ? 'Web' : 'System');
    const timestamp = new Date();
    const sheet = Config.getSheet(Config.SHEETS.AUDIT_LOG);
    if (typeof LockService !== 'undefined' && LockService.getScriptLock) {
      lock = LockService.getScriptLock();
      lock.waitLock(10000);
    }
    AuditLog.appendByHeaders_(sheet, {
      timestamp: timestamp,
      eventtype: normalizedType,
      payload: JSON.stringify(safeData),
      userid: actor && (actor.userId || actor.id) || '',
      username: actor && (actor.username || actor.name) || '',
      source: source
    });
    return { success: true, eventType: normalizedType, timestamp: timestamp.toISOString() };
  } catch (error) {
    Logger.log('AuditLog.logEvent falhou: ' + error.message);
    if (typeof Config !== 'undefined' && Config.isDevelopment && Config.isDevelopment()) Logger.log(error.stack || '');
    return { success: false, error: error.message };
  } finally {
    if (lock && lock.releaseLock) lock.releaseLock();
  }
};

AuditLog.mapRow_ = function(headers, row) {
  const record = {};
  headers.forEach(function(header, index) {
    record[AuditLog.normalizeHeader_(header)] = row[index];
  });
  let data = {};
  try { data = record.payload ? JSON.parse(String(record.payload)) : {}; } catch (ignore) { data = { unreadable: true }; }
  return {
    timestamp: record.timestamp || null,
    eventType: record.eventtype || 'UNKNOWN',
    data: data,
    userId: record.userid || '',
    username: record.username || '',
    source: record.source || ''
  };
};

AuditLog.toLimit_ = function(limit, fallback) {
  const parsed = Number(limit);
  return Math.min(Math.max(Number.isFinite(parsed) ? Math.floor(parsed) : fallback, 1), AuditLog.MAX_EVENTS);
};

AuditLog.getRecentEvents = function(limit) {
  try {
    const size = AuditLog.toLimit_(limit, 50);
    const sheet = Config.getSheet(Config.SHEETS.AUDIT_LOG);
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];
    return values.slice(1).slice(-size).map(function(row) {
      return AuditLog.mapRow_(values[0], row);
    });
  } catch (error) {
    ErrorHandler.logError('AuditLog.getRecentEvents', error, { limit: limit });
    throw error;
  }
};

AuditLog.findEvents = function(eventType, limit) {
  try {
    const target = AuditLog.normalizeEventType_(eventType);
    const size = AuditLog.toLimit_(limit, 100);
    const sheet = Config.getSheet(Config.SHEETS.AUDIT_LOG);
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];
    return values.slice(1).map(function(row) {
      return AuditLog.mapRow_(values[0], row);
    }).filter(function(event) {
      return event.eventType === target;
    }).slice(-size);
  } catch (error) {
    ErrorHandler.logError('AuditLog.findEvents', error, { eventType: eventType, limit: limit });
    throw error;
  }
};
