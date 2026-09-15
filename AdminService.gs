/**
 * @file AdminService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Ferramentas de super-usuário para manutenção do sistema, ajuste de parâmetros globais,
 *              auditoria de integridade e exportação de snapshots analíticos.
 * @context Integração da lógica técnica robusta (V1) com a narrativa do DF (V2).
 *          Todo o CRUD é processado na planilha via SPREADSHEETS_ID.
 * 
 * @principais_funcionalidades
 * - Estimativas de métricas administrativas (usuários, vilas, jogadores)
 * - Verificação de integridade do sistema e status das camadas de negócio
 * - Agregação de dados para dashboards administrativos e relatórios LGPD
 * - Exportação de snapshots para auditoria e backup incremental
 * 
 * @version 1.1.0
 * @since 2026-09-02
 */

function AdminService() {
  Logger.log("Iniciando componente: AdminService.gs");
}

/**
 * Retorna total de usuários cadastrados (planilha USERS).
 * 
 * @returns {number} Quantidade de linhas não-vazias excluindo cabeçalho
 */
AdminService.getTotalUsers = function() {
  return AdminService.countRows(Config.SHEETS.USERS);
};

/**
 * Retorna total de jogadores cadastrados (planilha PLAYERS).
 * 
 * @returns {number} Quantidade de linhas não-vazias excluindo cabeçalho
 */
AdminService.getTotalPlayers = function() {
  return AdminService.countRows(Config.SHEETS.PLAYERS);
};

/**
 * Retorna total de vilas cadastradas (planilha VILLAGES).
 * 
 * @returns {number} Quantidade de linhas não-vazias excluindo cabeçalho
 */
AdminService.getTotalVillages = function() {
  return AdminService.countRows(Config.SHEETS.VILLAGES);
};

/**
 * Retorna snapshot consolidado do sistema: totais, clima, aquífero e disponibilidade de camadas.
 * 
 * @returns {Object} { environment, timestamp, totals, climate, aquifer, integrity }
 */
AdminService.getSystemStatus = function() {
  try {
    var integrity = AdminService.checkIntegrity();
    return {
      environment: Config.ENV,
      timestamp: new Date().toISOString(),
      totals: {
        users: AdminService.getTotalUsers(),
        players: AdminService.getTotalPlayers(),
        villages: AdminService.getTotalVillages()
      },
      climate: ErrorHandler.safeExecute(
        function() { return ClimateService.getCurrentClimate(); },
        'AdminService.getSystemStatus.climate',
        null
      ),
      aquifer: ErrorHandler.safeExecute(
        function() { return AquiferService.getCurrentStatus(); },
        'AdminService.getSystemStatus.aquifer',
        null
      ),
      integrity: integrity
    };
  } catch (error) {
    ErrorHandler.logError('AdminService.getSystemStatus', error);
    return {
      environment: Config.ENV,
      timestamp: new Date().toISOString(),
      totals: { users: 0, players: 0, villages: 0 },
      climate: null,
      aquifer: null,
      integrity: { valid: false, errors: [error.message] }
    };
  }
};

/**
 * Verifica integridade estrutural do sistema: presença de planilhas, Script Properties e serviços.
 * 
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
AdminService.checkIntegrity = function() {
  var errors = [];
  var warnings = [];
  
  try {
    // Valida presença das planilhas obrigatórias
    [Config.SHEETS.USERS, Config.SHEETS.PLAYERS, Config.SHEETS.VILLAGES, Config.SHEETS.CLIMATE].forEach(function(sheetName) {
      try {
        Config.getSheet(sheetName);
      } catch (err) {
        errors.push('Planilha ausente ou inacessível: ' + sheetName);
      }
    });
    
    // Valida propriedade FOLDER_ID para assets
    var folderId = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
    if (!folderId || !String(folderId).trim()) {
      warnings.push('Script Property FOLDER_ID não configurada (assets indisponíveis).');
    }
    
    // Valida manifesto de assets
    try {
      var manifest = getGameAssetManifest();
      if (!manifest.ok) {
        warnings.push('Asset manifest incompleto: ' + (manifest.error || 'verifique FOLDER_ID'));
      }
    } catch (err) {
      warnings.push('Não foi possível validar manifesto de assets.');
    }
    
    // Valida catálogo de localização
    var locValidation = Localization.validate();
    if (!locValidation.valid) {
      warnings.push('Catálogo de Localization com inconsistências: ' + locValidation.issues.slice(0, 2).join(', '));
    }
    
  } catch (error) {
    errors.push('Erro crítico durante verificação de integridade: ' + error.message);
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
};

/**
 * Conta linhas de dados em uma planilha (exclui cabeçalho).
 * 
 * @param {string} sheetName - Nome da planilha
 * @returns {number} Quantidade de linhas de dados
 */
AdminService.countRows = function(sheetName) {
  try {
    var sheet = Config.getSheet(sheetName);
    var data = sheet.getDataRange().getValues();
    return Math.max(0, data.length - 1);
  } catch (error) {
    ErrorHandler.logError('AdminService.countRows', error, { sheetName: sheetName });
    return 0;
  }
};

/**
 * Exporta snapshot analítico completo para auditoria ou backup incremental.
 * 
 * @returns {Object} { users, players, villages, climate, aquifer, timestamp }
 */
AdminService.exportSnapshot = function() {
  try {
    return {
      timestamp: new Date().toISOString(),
      users: ErrorHandler.safeExecute(function() { return UserService.getAllUsers(); }, 'AdminService.exportSnapshot.users', []),
      players: ErrorHandler.safeExecute(function() { return PlayerService.getAllPlayers(); }, 'AdminService.exportSnapshot.players', []),
      villages: ErrorHandler.safeExecute(function() { return VillageService.getAllVillages(false); }, 'AdminService.exportSnapshot.villages', []),
      climate: ErrorHandler.safeExecute(function() { return ClimateService.getCurrentClimate(); }, 'AdminService.exportSnapshot.climate', null),
      aquifer: ErrorHandler.safeExecute(function() { return AquiferService.getCurrentStatus(); }, 'AdminService.exportSnapshot.aquifer', null)
    };
  } catch (error) {
    ErrorHandler.logError('AdminService.exportSnapshot', error);
    return { timestamp: new Date().toISOString(), error: error.message };
  }
};
