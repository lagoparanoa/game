/**
 * @file ClimateService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Simulador meteorológico baseado na série histórica do DF (evapotranspiração e precipitação).
 * @context Integração da lógica técnica robusta (V1) com a narrativa do DF (V2).
 *          Todo o CRUD é processado na planilha via SPREADSHEETS_ID.
 * 
 * @principais_funcionalidades
 * - Recuperar condições climáticas atuais
 * - Gerar previsões de chuva e evapotranspiração
 * - Consultar histórico climático em série temporal
 */

function ClimateService() {
  Logger.log("Iniciando componente: ClimateService.gs");
}

ClimateService.getCurrentClimate = function() {
  try {
    const sheet = Config.getSheet(Config.SHEETS.CLIMATE);
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      return ClimateService.buildClimateRecord({
        round: 0,
        season: 'Nenhum',
        rainValue: Config.CLIMATE.MIN_RAINFALL,
        drySpellLength: 0,
        probability: 0,
        temperature: 0,
        createdAt: new Date()
      });
    }

    const headers = values[0];
    const lastRow = values[values.length - 1];
    const record = ClimateService.mapRow(headers, lastRow);
    record.status = ClimateService.getClimateStatus(record.rainValue);
    return record;
  } catch (error) {
    ErrorHandler.logError('ClimateService.getCurrentClimate', error);
    return {
      round: null,
      season: null,
      rainValue: null,
      drySpellLength: null,
      probability: null,
      temperature: null,
      status: 'ERRO',
      createdAt: new Date()
    };
  }
};

ClimateService.getForecast = function(months) {
  months = Number(months) || 3;
  try {
    const forecast = [];
    const today = new Date();
    for (let i = 1; i <= months; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const month = date.getMonth() + 1;
      const rainfall = ClimateService.estimateRainfallForMonth(month);
      const evaporation = ClimateService.estimateEvaporationForMonth(month);
      forecast.push({
        month: month,
        date: date,
        expectedRainfall: rainfall,
        expectedEvaporation: evaporation,
        status: ClimateService.getClimateStatus(rainfall)
      });
    }
    return forecast;
  } catch (error) {
    ErrorHandler.logError('ClimateService.getForecast', error, { months: months });
    return [];
  }
};

ClimateService.getHistory = function(limit) {
  limit = Number(limit) || 12;
  try {
    const sheet = Config.getSheet(Config.SHEETS.CLIMATE);
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      return [];
    }
    const headers = values[0];
    return values.slice(1).reverse().slice(0, limit).map(function(row) {
      return ClimateService.mapRow(headers, row);
    });
  } catch (error) {
    ErrorHandler.logError('ClimateService.getHistory', error, { limit: limit });
    return [];
  }
};

ClimateService.setInitialRainfall = function(rainfall) {
  try {
    const sheet = Config.getSheet(Config.SHEETS.CLIMATE);
    const values = sheet.getDataRange().getValues();
    if (values.length > 1) {
      return false;
    }
    const entry = {
      round: 0,
      season: 'Úmido',
      rainValue: Number(rainfall) || Config.CLIMATE.MIN_RAINFALL,
      drySpellLength: 0,
      probability: 0.7,
      temperature: 25,
      createdAt: new Date()
    };
    const width = sheet.getLastColumn();
    const headers = width ? sheet.getRange(1, 1, 1, width).getValues()[0] : [];
    const normalized = headers.map(function(header) { return String(header || '').trim().toLowerCase(); });
    const required = ['round', 'season', 'rainvalue', 'dryspelllength', 'probability', 'temperature', 'createdat'];
    const missing = required.filter(function(header) { return normalized.indexOf(header) === -1; });
    if (missing.length) throw new Error('Schema climático incompatível; faltam: ' + missing.join(', '));
    const valuesByHeader = {
      round: entry.round,
      season: entry.season,
      rainvalue: entry.rainValue,
      dryspelllength: entry.drySpellLength,
      probability: entry.probability,
      temperature: entry.temperature,
      createdat: entry.createdAt
    };
    sheet.appendRow(normalized.map(function(header) {
      return Object.prototype.hasOwnProperty.call(valuesByHeader, header) ? valuesByHeader[header] : '';
    }));
    return true;
  } catch (error) {
    ErrorHandler.logError('ClimateService.setInitialRainfall', error, { rainfall: rainfall });
    return false;
  }
};

ClimateService.estimateRainfallForMonth = function(month) {
  const { DRY_SEASON_START, DRY_SEASON_END, MIN_RAINFALL, MAX_RAINFALL } = Config.CLIMATE;
  const drySeason = month >= DRY_SEASON_START && month <= DRY_SEASON_END;
  if (drySeason) {
    return Math.round(MIN_RAINFALL + (MAX_RAINFALL - MIN_RAINFALL) * 0.2);
  }
  return Math.round(MIN_RAINFALL + (MAX_RAINFALL - MIN_RAINFALL) * 0.75);
};

ClimateService.estimateEvaporationForMonth = function(month) {
  return Math.round(Config.CLIMATE.EVAPORATION_RATE * 100);
};

ClimateService.getClimateStatus = function(rainfall) {
  if (rainfall === null || rainfall === undefined || isNaN(rainfall)) {
    return 'DESCONHECIDO';
  }
  if (rainfall <= Config.CLIMATE.MIN_RAINFALL) {
    return 'SECA';
  }
  return 'NORMAL';
};

ClimateService.mapRow = function(headers, row) {
  const record = {};
  headers.forEach(function(header, index) {
    const key = String(header || '').trim().toLowerCase();
    const value = row[index];
    
    if (key === 'round') {
      record.round = Number(value) || 0;
    } else if (key === 'date') {
      record.createdAt = value instanceof Date ? value : new Date(value);
    } else if (key === 'season') {
      if (value !== '' && value !== null && value !== undefined) record.season = String(value).trim();
    } else if (key === 'rainvalue') {
      if (value !== '' && value !== null && value !== undefined) record.rainValue = Number(value) || 0;
    } else if (key === 'rainfall') {
      record.rainValue = Number(value) || 0;
    } else if (key === 'dryspelllength') {
      record.drySpellLength = Number(value) || 0;
    } else if (key === 'probability') {
      record.probability = Number(value) || 0;
    } else if (key === 'temperature') {
      record.temperature = Number(value) || 0;
    } else if (key === 'createdat') {
      if (value !== '' && value !== null && value !== undefined) {
        record.createdAt = value instanceof Date ? value : new Date(value);
      }
    } else {
      record[key] = value;
    }
  });
  
  record.status = ClimateService.getClimateStatus(record.rainValue);
  return record;
};

ClimateService.buildClimateRecord = function(data) {
  return {
    round: data.round !== undefined ? Number(data.round) : 0,
    season: String(data.season || 'Nenhum'),
    rainValue: Number(data.rainValue) || 0,
    drySpellLength: Number(data.drySpellLength) || 0,
    probability: Number(data.probability) || 0,
    temperature: Number(data.temperature) || 0,
    status: data.status || ClimateService.getClimateStatus(data.rainValue),
    createdAt: data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt)
  };
};
