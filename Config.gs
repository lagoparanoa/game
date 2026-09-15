/**
 * @file Config.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Configurações globais, incluindo SPREADSHEETS_ID e constantes climáticas de Brasília (Seca/Chuva).
 * @context Integração da lógica técnica robusta (V1) com a narrativa do DF (V2).
 *          Todo o CRUD é processado na planilha via SPREADSHEETS_ID.
 * 
 * @principais_funcionalidades
 * - Integração com SheetManager para persistência de dados.
 * - Lógica de negócio focada na realidade da Bacia do Paranoá.
 * - Cabeçalhos detalhados para manutenção e escalabilidade.
 */

const Config = {
  // ID da planilha principal (OBRIGATÓRIO - Substituir pelo ID correto)
  // Configure SPREADSHEET_ID (ou SPREADSHEETS_ID legado) nas propriedades do script.
  // Não usar aqui o ID do projeto Apps Script como se fosse uma planilha.
  SPREADSHEET_ID: '',
  
  // Configurações do Ambiente
  ENV: 'production', // 'development' ou 'production'
  DEBUG_MODE: false,
  LOG_LEVEL: 'error', // 'debug', 'info', 'warn', 'error'
  
  // Configurações de Sessão
  SESSION_TIMEOUT: 60 * 60 * 1000, // 1 hora em milissegundos
  MAX_LOGIN_ATTEMPTS: 5,
  
  // Configurações do Jogo
  GAME_VERSION: '1.0.0',
  MAX_PLAYERS_PER_VILLAGE: 10,
  INITIAL_WATER_CREDITS: 1000,
  INITIAL_FOOD_UNITS: 500,
  
  // Clima de Brasília (Ciclo Seca/Chuva)
  CLIMATE: {
    DRY_SEASON_START: 4, // Maio
    DRY_SEASON_END: 9,   // Setembro
    WET_SEASON_START: 10, // Outubro
    WET_SEASON_END: 3,    // Março
    MIN_RAINFALL: 0,      // mm/mês (época seca)
    MAX_RAINFALL: 250,    // mm/mês (época chuvosa)
    EVAPORATION_RATE: 0.15 // 15% ao mês
  },
  
  // Aquífero (Paranoá)
  AQUIFER: {
    MAX_CAPACITY: 100000,
    MIN_SAFE_LEVEL: 20000,
    RECHARGE_RATE: 0.10, // 10% da chuva
    CRITICAL_THRESHOLD: 15000
  },
  
  // Limites e Validações
  VALIDATION: {
    MIN_USERNAME_LENGTH: 3,
    MAX_USERNAME_LENGTH: 20,
    MIN_PASSWORD_LENGTH: 6,
    MIN_VILLAGE_NAME_LENGTH: 3,
    MAX_VILLAGE_NAME_LENGTH: 30
  },
  
  // Nomes das Abas da Planilha
  SHEETS: {
    USERS: 'Usuarios',
    PLAYERS: 'Jogadores',
    VILLAGES: 'Vilas',
    CLIMATE: 'Clima',
    AQUIFER: 'Aquifero',
    CROPS: 'Culturas',
    PLANTINGS: 'Plantios',
    MARKET: 'Mercado',
    LEADERBOARD: 'Ranking',
    AUDIT_LOG: 'LogAuditoria',
    GAME_EVENTS: 'Eventos',
    HISTORY: 'HistoricoRodadas',
    NOTIFICATIONS: 'Notificacoes'
  },
  
  // Métodos Auxiliares
  getSpreadsheetId: function() {
    var overrideId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!overrideId || !overrideId.trim()) {
      overrideId = PropertiesService.getScriptProperties().getProperty('SPREADSHEETS_ID');
    }

    var configuredId = overrideId && overrideId.trim() ? overrideId.trim() : this.SPREADSHEET_ID;
    var validation = SpreadsheetIdValidator.validate(configuredId);

    if (!validation.valid) {
      var source = configuredId === this.SPREADSHEET_ID ? 'Config.gs' : 'Script Properties';
      throw new Error('SPREADSHEET_ID inválido (' + source + '): ' + validation.message);
    }

    return validation.cleanId;
  },
  
  getSpreadsheet: function() {
    try {
      const spreadsheetId = this.getSpreadsheetId();
      return SpreadsheetApp.openById(spreadsheetId);
    } catch (error) {
      ErrorHandler.logError('Config.getSpreadsheet', error, { rawSpreadsheetId: this.SPREADSHEET_ID });
      throw new Error('Não foi possível abrir a planilha. Verifique o SPREADSHEET_ID em Config.gs ou a propriedade de ambiente de script.');
    }
  },
  
  getSheet: function(sheetName) {
    const ss = this.getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('Aba não encontrada: ' + sheetName);
    }
    return sheet;
  },
  
  isProduction: function() {
    return this.ENV === 'production';
  },
  
  isDevelopment: function() {
    return this.ENV === 'development';
  },
  
  log: function(level, message, data) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.LOG_LEVEL] || 1;
    const messageLevel = levels[level] || 1;
    
    if (messageLevel >= currentLevel) {
      const timestamp = new Date().toISOString();
      let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
      
      if (data) {
        logMessage += '\n' + JSON.stringify(data, null, 2);
      }
      
      Logger.log(logMessage);
      
      // Em produção, erros vão para audit log
      if (this.isProduction() && level === 'error') {
        try {
          AuditLog.logEvent('SYSTEM_ERROR', { message: message, data: data });
        } catch (e) {
          // Evitar loop infinito se AuditLog falhar
          Logger.log('Erro ao registrar em AuditLog: ' + e.message);
        }
      }
    }
  }
};

/**
 * Função de teste de configuração
 */
function testConfig() {
  try {
    Logger.log('Testando configurações...');
    Logger.log('SPREADSHEET_ID: ' + Config.SPREADSHEET_ID);
    Logger.log('Ambiente: ' + Config.ENV);
    
    const ss = Config.getSpreadsheet();
    Logger.log('✓ Planilha acessível: ' + ss.getName());
    
    // Testar acesso às abas
    Object.keys(Config.SHEETS).forEach(key => {
      const sheetName = Config.SHEETS[key];
      try {
        Config.getSheet(sheetName);
        Logger.log('✓ Aba encontrada: ' + sheetName);
      } catch (e) {
        Logger.log('✗ Aba não encontrada: ' + sheetName);
      }
    });
    
    Logger.log('✓ Teste de configuração concluído!');
    return true;
  } catch (error) {
    Logger.log('✗ Erro no teste de configuração: ' + error.message);
    return false;
  }
}
