/**
 * @file AquiferService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Simula a recarga e extração dos aquíferos Poroso e Fraturado, vitais para o fluxo de base do Lago.
 * @context Integração da lógica técnica robusta (V1) com a narrativa do DF (V2).
 *          Todo o CRUD é processado na planilha via SPREADSHEETS_ID.
 * 
 * @principais_funcionalidades
 * - Recuperar status atual do aquífero
 * - Consultar histórico de profundidade e recarga
 * - Classificar nível de segurança hídrica do aquífero
 */

function AquiferService() {
  Logger.log("Iniciando componente: AquiferService.gs");
}

AquiferService.getCurrentStatus = function() {
  try {
    const sheet = Config.getSheet(Config.SHEETS.AQUIFER);
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      return {
        date: null,
        level: null,
        recharge: null,
        extraction: null,
        status: 'SEM DADOS'
      };
    }

    const headers = values[0];
    const lastRow = values[values.length - 1];
    const record = AquiferService.mapRow(headers, lastRow);
    record.status = AquiferService.calculateStatus(record.level);
    return record;
  } catch (error) {
    ErrorHandler.logError('AquiferService.getCurrentStatus', error);
    return {
      date: null,
      level: null,
      recharge: null,
      extraction: null,
      status: 'ERRO'
    };
  }
};

AquiferService.getHistory = function(limit) {
  limit = Number(limit) || 12;
  try {
    const sheet = Config.getSheet(Config.SHEETS.AQUIFER);
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      return [];
    }

    const headers = values[0];
    const rows = values.slice(1).reverse().slice(0, limit);
    return rows.map(function(row) {
      const record = AquiferService.mapRow(headers, row);
      record.status = AquiferService.calculateStatus(record.level);
      return record;
    });
  } catch (error) {
    ErrorHandler.logError('AquiferService.getHistory', error, { limit: limit });
    return [];
  }
};

AquiferService.recordState = function(data) {
  try {
    const sheet = Config.getSheet(Config.SHEETS.AQUIFER);
    const width = sheet.getLastColumn();
    const headers = width ? sheet.getRange(1, 1, 1, width).getValues()[0] : [];
    const normalized = headers.map(function(header) { return String(header || '').trim().toLowerCase(); });
    const required = ['round', 'depth', 'extraction', 'recharge', 'evaporation', 'status', 'createdat'];
    const missing = required.filter(function(header) { return normalized.indexOf(header) === -1; });
    if (missing.length) throw new Error('Schema hídrico incompatível; faltam: ' + missing.join(', '));
    const valuesByHeader = {
      round: data.round !== undefined ? data.round : 0,
      depth: Number(data.depth) || 0,
      extraction: Number(data.extraction) || 0,
      recharge: Number(data.recharge) || 0,
      evaporation: Number(data.evaporation) || 0,
      status: data.status || AquiferService.calculateStatus(Number(data.depth) || 0),
      createdat: data.createdAt || new Date()
    };
    sheet.appendRow(normalized.map(function(header) {
      return Object.prototype.hasOwnProperty.call(valuesByHeader, header) ? valuesByHeader[header] : '';
    }));
    return true;
  } catch (error) {
    ErrorHandler.logError('AquiferService.recordState', error, data);
    return false;
  }
};

AquiferService.recordExtraction = function(villageId, extractionLiters) {
  try {
    const current = AquiferService.getCurrentStatus(villageId);
    if (!current || current.depth === null || current.depth === undefined) {
      return false;
    }

    extractionLiters = Number(extractionLiters) || 0;
    const extractionCubicMeters = extractionLiters / 1000;
    const newDepth = Math.max(0, current.depth - extractionCubicMeters);
    const nextRound = current.round !== null && current.round !== undefined ? Number(current.round) + 1 : 1;

    return AquiferService.recordState({
      round: nextRound,
      depth: newDepth,
      extraction: extractionLiters,
      recharge: 0,
      evaporation: 0,
      status: AquiferService.calculateStatus(newDepth),
      createdAt: new Date()
    });
  } catch (error) {
    ErrorHandler.logError('AquiferService.recordExtraction', error, { villageId: villageId, extractionLiters: extractionLiters });
    return false;
  }
};

/**
 * Processa recarga do aquífero baseada em precipitação
 * Conecta o ClimateService ao ciclo hidrológico do aquífero
 * @param {number} rainfallMm - Precipitação em milímetros
 * @param {number} round - Rodada atual
 * @returns {Object} { success, rechargeAmount, newLevel, status }
 */
AquiferService.processRecharge = function(rainfallMm, round) {
  try {
    if (rainfallMm === null || rainfallMm === undefined || isNaN(rainfallMm)) {
      return { success: false, error: 'rainfallMm inválido' };
    }

    const current = AquiferService.getCurrentStatus();
    
    // Se não há dados iniciais, inicializa com capacidade média
    let currentDepth = 0;
    let currentRound = 0;
    
    if (current && current.depth !== null && current.depth !== undefined) {
      currentDepth = Number(current.depth) || 0;
      currentRound = Number(current.round) || 0;
    } else {
      // Inicializa aquífero com 60% da capacidade máxima
      currentDepth = Config.AQUIFER.MAX_CAPACITY * 0.6;
    }

    // Calcula recarga baseada na precipitação
    // Taxa de recarga: porcentagem da chuva que infiltra no aquífero
    const rechargeRate = Config.AQUIFER.RECHARGE_RATE || 0.10; // 10% por padrão
    
    // Converte mm de chuva para volume de recarga
    // Assumindo área de captação proporcional (simplificado)
    const CATCHMENT_AREA_M2 = 1000000; // 1 km² de área de captação (ajustável)
    const rainfallM3 = (rainfallMm / 1000) * CATCHMENT_AREA_M2; // mm → m → m³
    const rechargeM3 = rainfallM3 * rechargeRate;

    // Calcula evaporação
    const evaporationRate = Config.CLIMATE.EVAPORATION_RATE || 0.15;
    const evaporationM3 = currentDepth * evaporationRate;

    // Calcula novo nível do aquífero
    const netChange = rechargeM3 - evaporationM3;
    const newDepth = Math.min(
      Config.AQUIFER.MAX_CAPACITY,
      Math.max(0, currentDepth + netChange)
    );

    const nextRound = Number(round) || (currentRound + 1);

    // Registra novo estado
    const recordSuccess = AquiferService.recordState({
      round: nextRound,
      depth: newDepth,
      extraction: 0,
      recharge: rechargeM3,
      evaporation: evaporationM3,
      status: AquiferService.calculateStatus(newDepth),
      createdAt: new Date()
    });

    if (!recordSuccess) {
      return { success: false, error: 'Falha ao registrar recarga do aquífero' };
    }

    // Registra evento no histórico
    if (typeof HistoryService !== 'undefined' && HistoryService.recordEvent) {
      HistoryService.recordEvent({
        round: nextRound,
        eventType: 'AQUIFER_RECHARGE',
        title: 'Recarga do Aquífero',
        description: `Precipitação de ${Math.round(rainfallMm)}mm resultou em recarga de ${Math.round(rechargeM3)}m³`,
        impact: `Nível: ${Math.round(currentDepth)}m³ → ${Math.round(newDepth)}m³ (${netChange > 0 ? '+' : ''}${Math.round(netChange)}m³)`,
        affectedPlayers: ''
      });
    }

    // Log de auditoria
    AuditLog.logEvent('AQUIFER_RECHARGE_PROCESSED', {
      round: nextRound,
      rainfallMm: rainfallMm,
      rechargeM3: Math.round(rechargeM3),
      evaporationM3: Math.round(evaporationM3),
      oldDepth: Math.round(currentDepth),
      newDepth: Math.round(newDepth)
    });

    return {
      success: true,
      rechargeAmount: Math.round(rechargeM3),
      evaporationAmount: Math.round(evaporationM3),
      netChange: Math.round(netChange),
      oldLevel: Math.round(currentDepth),
      newLevel: Math.round(newDepth),
      status: AquiferService.calculateStatus(newDepth),
      message: netChange > 0 
        ? `Aquífero recarregado: +${Math.round(netChange)}m³`
        : `Aquífero em declínio: ${Math.round(netChange)}m³`
    };

  } catch (error) {
    ErrorHandler.logError('AquiferService.processRecharge', error, { rainfallMm, round });
    return { success: false, error: error.message };
  }
};

/**
 * Processa ciclo completo de recarga mensal
 * Integra clima atual e processa recarga + evaporação automaticamente
 * @param {number} round - Rodada atual
 * @returns {Object} Resultado da recarga mensal
 */
AquiferService.processMonthlyRecharge = function(round) {
  try {
    // Busca clima atual
    const climate = ClimateService.getCurrentClimate();
    
    if (!climate || climate.rainValue === null || climate.rainValue === undefined) {
      return { success: false, error: 'Dados climáticos não disponíveis' };
    }

    const rainfall = Number(climate.rainValue) || 0;

    // Processa recarga
    const rechargeResult = AquiferService.processRecharge(rainfall, round);

    if (rechargeResult.success) {
      rechargeResult.climate = {
        rainfall: rainfall,
        season: climate.season,
        status: climate.status
      };
    }

    return rechargeResult;

  } catch (error) {
    ErrorHandler.logError('AquiferService.processMonthlyRecharge', error, { round });
    return { success: false, error: error.message };
  }
};

/**
 * Inicializa aquífero com nível inicial seguro
 * @returns {Object} { success, initialLevel }
 */
AquiferService.initialize = function() {
  try {
    const current = AquiferService.getCurrentStatus();
    
    // Verifica se já foi inicializado
    if (current && current.depth !== null && current.depth !== undefined) {
      return { 
        success: true, 
        message: 'Aquífero já inicializado',
        currentLevel: current.depth
      };
    }

    // Define nível inicial (60% da capacidade máxima)
    const initialDepth = Config.AQUIFER.MAX_CAPACITY * 0.6;

    const recordSuccess = AquiferService.recordState({
      round: 0,
      depth: initialDepth,
      extraction: 0,
      recharge: 0,
      evaporation: 0,
      status: AquiferService.calculateStatus(initialDepth),
      createdAt: new Date()
    });

    if (!recordSuccess) {
      return { success: false, error: 'Falha ao inicializar aquífero' };
    }

    AuditLog.logEvent('AQUIFER_INITIALIZED', {
      initialDepth: initialDepth,
      maxCapacity: Config.AQUIFER.MAX_CAPACITY
    });

    return {
      success: true,
      message: 'Aquífero inicializado com sucesso',
      initialLevel: initialDepth,
      status: AquiferService.calculateStatus(initialDepth)
    };

  } catch (error) {
    ErrorHandler.logError('AquiferService.initialize', error);
    return { success: false, error: error.message };
  }
};

AquiferService.calculateStatus = function(level) {
  if (level === null || level === undefined || isNaN(level)) {
    return 'DESCONHECIDO';
  }

  const minSafe = Config.AQUIFER.MIN_SAFE_LEVEL;
  const critical = Config.AQUIFER.CRITICAL_THRESHOLD;

  if (level <= critical) {
    return 'CRÍTICO';
  }
  if (level <= minSafe) {
    return 'ALERTA';
  }
  return 'ESTÁVEL';
};

AquiferService.mapRow = function(headers, row) {
  const normalized = {};
  headers.forEach(function(header, index) {
    const key = String(header || '').trim().toLowerCase();
    const value = row[index];
    
    if (key === 'round') {
      normalized.round = Number(value) || 0;
    } else if (key === 'date') {
      normalized.date = value instanceof Date ? value : new Date(value);
    } else if (key === 'depth') {
      if (value !== '' && value !== null && value !== undefined) normalized.depth = Number(value) || 0;
    } else if (key === 'level') {
      normalized.depth = Number(value) || 0;
    } else if (key === 'recharge') {
      normalized.recharge = Number(value) || 0;
    } else if (key === 'extraction') {
      normalized.extraction = Number(value) || 0;
    } else if (key === 'evaporation') {
      normalized.evaporation = Number(value) || 0;
    } else if (key === 'status') {
      normalized.status = String(value || '').trim();
    } else if (key === 'createdat') {
      if (value !== '' && value !== null && value !== undefined) {
        normalized.createdAt = value instanceof Date ? value : new Date(value);
      }
    } else {
      normalized[key] = value;
    }
  });

  if (normalized.status === undefined || normalized.status === '') {
    normalized.status = AquiferService.calculateStatus(normalized.depth);
  }

  return normalized;
};
