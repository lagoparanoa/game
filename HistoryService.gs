/**
 * @file HistoryService.gs
 * @description Registro mínimo, consultável e reversível das rodadas do jogo.
 *              A história é uma evidência pedagógica: guarda decisão, efeito e
 *              contexto para que a turma possa comparar estratégias depois.
 */

function HistoryService() {
  Logger.log('Iniciando componente: HistoryService.gs');
}

HistoryService.toLimit_ = function(limit, fallback) {
  const parsed = Number(limit);
  return Math.min(Math.max(Number.isFinite(parsed) ? Math.floor(parsed) : fallback, 1), 100);
};

HistoryService.id_ = function(prefix) {
  if (typeof Utilities !== 'undefined' && Utilities.getUuid) {
    return prefix + '-' + Utilities.getUuid();
  }
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 10000);
};

HistoryService.normalizeHeader_ = function(header) {
  return String(header || '').trim().toLowerCase();
};

HistoryService.mapEvent_ = function(headers, row) {
  const event = {};
  headers.forEach(function(header, index) {
    const key = HistoryService.normalizeHeader_(header);
    event[key] = row[index];
  });
  return {
    eventId: event.eventid || '',
    round: Number(event.round) || 0,
    eventType: event.eventtype || 'INFO',
    title: event.title || 'Evento da rodada',
    description: event.description || '',
    impact: event.impact || '',
    affectedPlayers: event.affectedplayers || '',
    createdAt: event.createdat || null
  };
};

HistoryService.mapRound_ = function(headers, row) {
  const record = {};
  headers.forEach(function(header, index) {
    record[HistoryService.normalizeHeader_(header)] = row[index];
  });
  return {
    historyId: record.historyid || '',
    round: Number(record.round) || 0,
    playerId: record.playerid || '',
    villageId: record.villageid || '',
    action: record.action || '',
    outcome: record.outcome || '',
    metrics: HistoryService.parseJson_(record.metricsjson),
    createdAt: record.createdat || null
  };
};

HistoryService.parseJson_ = function(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch (ignore) { return {}; }
};

HistoryService.appendByHeaders_ = function(sheet, record, requiredHeaders) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  if (!headers.length) throw new Error('Aba sem cabeçalhos. Execute a migração de schema antes do uso.');
  const normalizedRecord = {};
  Object.keys(record || {}).forEach(function(key) {
    normalizedRecord[HistoryService.normalizeHeader_(key)] = record[key];
  });
  const normalizedHeaders = headers.map(HistoryService.normalizeHeader_);
  const missing = (requiredHeaders || []).filter(function(header) {
    return normalizedHeaders.indexOf(HistoryService.normalizeHeader_(header)) === -1;
  });
  if (missing.length) {
    throw new Error('Schema incompatível; faltam cabeçalhos: ' + missing.join(', '));
  }
  const row = normalizedHeaders.map(function(header) {
    return Object.prototype.hasOwnProperty.call(normalizedRecord, header) ? normalizedRecord[header] : '';
  });
  sheet.appendRow(row);
};

HistoryService.getRecentEvents = function(limit) {
  const size = HistoryService.toLimit_(limit, 5);
  try {
    const sheet = Config.getSheet(Config.SHEETS.GAME_EVENTS);
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];
    return values.slice(1).reverse().slice(0, size).map(function(row) {
      return HistoryService.mapEvent_(values[0], row);
    });
  } catch (error) {
    ErrorHandler.logError('HistoryService.getRecentEvents', error, { limit: size });
    return [];
  }
};

HistoryService.getEventHistory = function(filters) {
  const criteria = filters || {};
  try {
    const events = HistoryService.getRecentEvents(100);
    return events.filter(function(event) {
      return (!criteria.round || event.round === Number(criteria.round)) &&
        (!criteria.eventType || event.eventType === criteria.eventType);
    });
  } catch (error) {
    ErrorHandler.logError('HistoryService.getEventHistory', error, criteria);
    return [];
  }
};

HistoryService.recordEvent = function(data) {
  try {
    if (!data || !data.title) throw new Error('title é obrigatório');
    const sheet = Config.getSheet(Config.SHEETS.GAME_EVENTS);
    const event = {
      eventId: data.eventId || HistoryService.id_('EVT'),
      round: Number(data.round) || 0,
      eventType: data.eventType || 'INFO',
      title: String(data.title),
      description: String(data.description || ''),
      impact: String(data.impact || ''),
      affectedPlayers: Array.isArray(data.affectedPlayers) ? data.affectedPlayers.join(',') : String(data.affectedPlayers || ''),
      createdAt: data.createdAt || new Date()
    };
    HistoryService.appendByHeaders_(sheet, event, [
      'eventId', 'round', 'eventType', 'title', 'description',
      'impact', 'affectedPlayers', 'createdAt'
    ]);
    return { success: true, event: event };
  } catch (error) {
    ErrorHandler.logError('HistoryService.recordEvent', error, data || {});
    return { success: false, error: error.message };
  }
};

HistoryService.recordRound = function(data) {
  try {
    if (!data || data.round === undefined) throw new Error('round é obrigatório');
    const sheet = Config.getSheet(Config.SHEETS.HISTORY);
    const record = {
      historyId: data.historyId || HistoryService.id_('HST'),
      round: Number(data.round) || 0,
      playerId: String(data.playerId || ''),
      villageId: String(data.villageId || ''),
      action: String(data.action || 'turno'),
      outcome: String(data.outcome || ''),
      metrics: data.metrics || {},
      createdAt: data.createdAt || new Date()
    };
    HistoryService.appendByHeaders_(sheet, {
      historyId: record.historyId,
      round: record.round,
      playerId: record.playerId,
      villageId: record.villageId,
      action: record.action,
      outcome: record.outcome,
      metricsJson: JSON.stringify(record.metrics),
      createdAt: record.createdAt
    }, ['historyId', 'round', 'playerId', 'villageId', 'action', 'outcome', 'metricsJson', 'createdAt']);
    if (data.event) {
      HistoryService.recordEvent(Object.assign({}, data.event, {
        round: record.round,
        affectedPlayers: data.event.affectedPlayers || record.playerId
      }));
    }
    return { success: true, record: record };
  } catch (error) {
    ErrorHandler.logError('HistoryService.recordRound', error, data || {});
    return { success: false, error: error.message };
  }
};

HistoryService.getRecentHistory = function(limit) {
  const size = HistoryService.toLimit_(limit, 10);
  try {
    const sheet = Config.getSheet(Config.SHEETS.HISTORY);
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];
    return values.slice(1).reverse().slice(0, size).map(function(row) {
      return HistoryService.mapRound_(values[0], row);
    });
  } catch (error) {
    ErrorHandler.logError('HistoryService.getRecentHistory', error, { limit: size });
    return [];
  }
};

HistoryService.getPlayerHistory = function(playerId, limit) {
  const size = HistoryService.toLimit_(limit, 20);
  const targetPlayerId = String(playerId || '');
  try {
    const sheet = Config.getSheet(Config.SHEETS.HISTORY);
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];
    return values.slice(1).reverse().map(function(row) {
      return HistoryService.mapRound_(values[0], row);
    }).filter(function(record) {
      return record.playerId === targetPlayerId;
    }).slice(0, size);
  } catch (error) {
    ErrorHandler.logError('HistoryService.getPlayerHistory', error, {
      playerId: targetPlayerId,
      limit: size
    });
    return [];
  }
};

HistoryService.getPendingReview = function(playerId) {
  const records = HistoryService.getPlayerHistory(playerId, 100);
  for (let index = 0; index < records.length; index++) {
    const learning = records[index].metrics && records[index].metrics.learning;
    if (learning && learning.status === 'awaiting_review') return records[index];
  }
  return null;
};

HistoryService.completeRoundReflection = function(historyId, playerId, reflection, nextTest) {
  try {
    const reflectionText = String(reflection || '').trim().slice(0, 800);
    const nextTestText = String(nextTest || '').trim().slice(0, 420);
    if (reflectionText.length < 12) throw new Error('Explique o resultado em pelo menos 12 caracteres.');
    if (nextTestText.length < 8) throw new Error('Registre qual será o próximo teste.');
    const sheet = Config.getSheet(Config.SHEETS.HISTORY);
    const values = sheet.getDataRange().getValues();
    for (let index = 1; index < values.length; index++) {
      const record = HistoryService.mapRound_(values[0], values[index]);
      if (record.historyId !== String(historyId || '')) continue;
      if (record.playerId !== String(playerId || '')) throw new Error('Acesso negado ao registro da rodada.');
      const learning = record.metrics && record.metrics.learning;
      if (!learning || learning.status !== 'awaiting_review') throw new Error('Esta rodada não possui revisão pendente.');
      learning.reflection = reflectionText;
      learning.nextTest = nextTestText;
      learning.status = 'reviewed';
      learning.reviewedAt = new Date().toISOString();
      const metricsColumn = values[0].map(HistoryService.normalizeHeader_).indexOf('metricsjson');
      if (metricsColumn < 0) throw new Error('Schema incompatível; cabeçalho metricsJson ausente.');
      sheet.getRange(index + 1, metricsColumn + 1).setValue(JSON.stringify(record.metrics));
      record.metrics.learning = learning;
      return { success: true, record: record };
    }
    throw new Error('Rodada não encontrada.');
  } catch (error) {
    ErrorHandler.logError('HistoryService.completeRoundReflection', error, { historyId: historyId, playerId: playerId });
    return { success: false, error: error.message };
  }
};

HistoryService.getVillageHistory = function(villageId, limit) {
  const size = HistoryService.toLimit_(limit, 20);
  const targetVillageId = String(villageId || '');
  try {
    const sheet = Config.getSheet(Config.SHEETS.HISTORY);
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];
    return values.slice(1).reverse().map(function(row) {
      return HistoryService.mapRound_(values[0], row);
    }).filter(function(record) {
      return record.villageId === targetVillageId;
    }).slice(0, size);
  } catch (error) {
    ErrorHandler.logError('HistoryService.getVillageHistory', error, {
      villageId: targetVillageId,
      limit: size
    });
    return [];
  }
};
