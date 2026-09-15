/**
 * @file SetupHelper.gs
 * @project Lago Paranoá - O Desafio das Águas
 * @description Helper para configuração inicial do ambiente (corrige bloqueio do projeto).
 * 
 * Este arquivo fornece funções para:
 * 1. Criar uma planilha operacional se não existir
 * 2. Configurar SPREADSHEET_ID nas propriedades do script
 * 3. Inicializar o sistema com dados seed
 * 
 * USO:
 * Execute `setupEnvironment()` uma vez para desbloquear o projeto.
 * A função cria a planilha, configura o ID e inicializa todas as abas.
 */

const SetupHelper = {
  
  /**
   * Configura o ambiente completo: cria planilha, define ID e inicializa sistema.
   * @returns {Object} { success, message, spreadsheetId, url }
   */
  setupEnvironment: function() {
    try {
      Logger.log('='.repeat(60));
      Logger.log('SETUP HELPER - Lago Paranoá');
      Logger.log('='.repeat(60));
      
      // Verifica se já tem um SPREADSHEET_ID configurado
      var existingId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
      
      if (existingId && existingId.trim()) {
        Logger.log('SPREADSHEET_ID já configurado: ' + existingId);
        Logger.log('Tentando acessar planilha existente...');
        
        try {
          var ss = SpreadsheetApp.openById(existingId);
          Logger.log('✓ Planilha encontrada: ' + ss.getName());
          Logger.log('URL: ' + ss.getUrl());
          
          // Verifica se precisa inicializar
          var needsInit = this.needsInitialization(ss);
          if (needsInit) {
            Logger.log('Planilha precisa de inicialização...');
            return this.initializeExistingSpreadsheet(ss);
          } else {
            return {
              success: true,
              message: 'Planilha já configurada e inicializada',
              spreadsheetId: existingId,
              url: ss.getUrl()
            };
          }
        } catch (e) {
          Logger.log('✗ Erro ao acessar planilha: ' + e.message);
          Logger.log('Criando nova planilha...');
        }
      }
      
      // Cria nova planilha
      Logger.log('Criando nova planilha...');
      var result = this.createGameSpreadsheet();
      
      if (!result.success) {
        return result;
      }
      
      // Configura SPREADSHEET_ID nas propriedades
      Logger.log('Configurando SPREADSHEET_ID nas propriedades do script...');
      PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', result.spreadsheetId);
      Logger.log('✓ SPREADSHEET_ID configurado!');
      
      // Inicializa o sistema
      Logger.log('Inicializando sistema...');
      var initResult = InitializationService.setupProject();
      
      if (!initResult.success) {
        return {
          success: false,
          message: 'Planilha criada mas inicialização falhou: ' + initResult.message,
          spreadsheetId: result.spreadsheetId,
          url: result.url,
          error: initResult.error
        };
      }
      
      Logger.log('='.repeat(60));
      Logger.log('✓ AMBIENTE CONFIGURADO COM SUCESSO!');
      Logger.log('SPREADSHEET_ID: ' + result.spreadsheetId);
      Logger.log('URL: ' + result.url);
      Logger.log('='.repeat(60));
      
      return {
        success: true,
        message: 'Ambiente configurado com sucesso',
        spreadsheetId: result.spreadsheetId,
        url: result.url,
        initialization: initResult
      };
      
    } catch (error) {
      Logger.log('✗ ERRO: ' + error.message);
      Logger.log(error.stack);
      return {
        success: false,
        message: 'Erro ao configurar ambiente',
        error: error.message
      };
    }
  },
  
  /**
   * Cria uma nova planilha para o jogo.
   * @returns {Object} { success, spreadsheetId, url, name }
   */
  createGameSpreadsheet: function() {
    try {
      var timestamp = Utilities.formatDate(new Date(), 'GMT-3', 'yyyy-MM-dd HH:mm');
      var name = 'Lago Paranoá - Game Data (' + timestamp + ')';
      
      Logger.log('Criando planilha: ' + name);
      var ss = SpreadsheetApp.create(name);
      
      var id = ss.getId();
      var url = ss.getUrl();
      
      Logger.log('✓ Planilha criada!');
      Logger.log('  ID: ' + id);
      Logger.log('  URL: ' + url);
      
      return {
        success: true,
        spreadsheetId: id,
        url: url,
        name: name
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao criar planilha',
        error: error.message
      };
    }
  },
  
  /**
   * Verifica se uma planilha precisa de inicialização.
   * @param {Spreadsheet} ss Instância da planilha
   * @returns {boolean} true se precisar inicializar
   */
  needsInitialization: function(ss) {
    try {
      // Verifica se as abas principais existem
      var requiredSheets = ['Usuarios', 'Jogadores', 'Culturas', 'HistoricoRodadas'];
      
      for (var i = 0; i < requiredSheets.length; i++) {
        var sheet = ss.getSheetByName(requiredSheets[i]);
        if (!sheet) {
          Logger.log('Aba ausente: ' + requiredSheets[i]);
          return true;
        }
        
        // Verifica se tem cabeçalhos
        var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        if (!headers || headers.length === 0 || !headers[0]) {
          Logger.log('Aba sem cabeçalhos: ' + requiredSheets[i]);
          return true;
        }
      }
      
      Logger.log('✓ Planilha já inicializada');
      return false;
      
    } catch (error) {
      Logger.log('Erro ao verificar inicialização: ' + error.message);
      return true;
    }
  },
  
  /**
   * Inicializa uma planilha existente.
   * @param {Spreadsheet} ss Instância da planilha
   * @returns {Object} Resultado da inicialização
   */
  initializeExistingSpreadsheet: function(ss) {
    try {
      var id = ss.getId();
      var url = ss.getUrl();
      
      Logger.log('Inicializando planilha existente: ' + ss.getName());
      
      // Configura SPREADSHEET_ID nas propriedades (se ainda não estiver)
      var currentId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
      if (currentId !== id) {
        PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', id);
        Logger.log('✓ SPREADSHEET_ID atualizado nas propriedades');
      }
      
      // Chama o setup existente
      var initResult = InitializationService.setupProject();
      
      if (!initResult.success) {
        return {
          success: false,
          message: 'Erro na inicialização: ' + initResult.message,
          spreadsheetId: id,
          url: url,
          error: initResult.error
        };
      }
      
      Logger.log('✓ Planilha inicializada com sucesso!');
      
      return {
        success: true,
        message: 'Planilha inicializada com sucesso',
        spreadsheetId: id,
        url: url,
        initialization: initResult
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao inicializar planilha existente',
        error: error.message
      };
    }
  },
  
  /**
   * Obtém o status atual da configuração.
   * @returns {Object} Status detalhado
   */
  getConfigurationStatus: function() {
    try {
      var status = {
        spreadsheetIdInProperties: null,
        spreadsheetIdInConfig: Config.SPREADSHEET_ID,
        spreadsheetAccessible: false,
        spreadsheetName: null,
        spreadsheetUrl: null,
        sheetsCount: 0,
        requiredSheets: [],
        missingSheets: [],
        isConfigured: false
      };
      
      // Verifica propriedades
      status.spreadsheetIdInProperties = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
      
      // Tenta acessar planilha
      try {
        var ss = Config.getSpreadsheet();
        status.spreadsheetAccessible = true;
        status.spreadsheetName = ss.getName();
        status.spreadsheetUrl = ss.getUrl();
        status.sheetsCount = ss.getSheets().length;
        
        // Verifica abas necessárias
        var required = ['Usuarios', 'Jogadores', 'Culturas', 'HistoricoRodadas', 'Clima', 'Aquifero'];
        status.requiredSheets = required;
        
        required.forEach(function(name) {
          var sheet = ss.getSheetByName(name);
          if (!sheet) {
            status.missingSheets.push(name);
          }
        });
        
        status.isConfigured = status.missingSheets.length === 0;
        
      } catch (error) {
        status.error = error.message;
      }
      
      return status;
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

/**
 * Função global para setup rápido do ambiente.
 * Execute esta função uma vez para desbloquear o projeto.
 */
function setupEnvironment() {
  return SetupHelper.setupEnvironment();
}

/**
 * Função global para verificar status da configuração.
 */
function checkConfiguration() {
  var status = SetupHelper.getConfigurationStatus();
  
  Logger.log('='.repeat(60));
  Logger.log('STATUS DA CONFIGURAÇÃO');
  Logger.log('='.repeat(60));
  Logger.log('SPREADSHEET_ID (Properties): ' + (status.spreadsheetIdInProperties || 'NÃO CONFIGURADO'));
  Logger.log('SPREADSHEET_ID (Config.gs): ' + (status.spreadsheetIdInConfig || 'VAZIO'));
  Logger.log('Planilha Acessível: ' + (status.spreadsheetAccessible ? 'SIM' : 'NÃO'));
  
  if (status.spreadsheetAccessible) {
    Logger.log('Nome: ' + status.spreadsheetName);
    Logger.log('URL: ' + status.spreadsheetUrl);
    Logger.log('Número de Abas: ' + status.sheetsCount);
    Logger.log('Abas Faltando: ' + (status.missingSheets.length > 0 ? status.missingSheets.join(', ') : 'NENHUMA'));
    Logger.log('Configurado: ' + (status.isConfigured ? 'SIM ✓' : 'NÃO ✗'));
  } else {
    Logger.log('Erro: ' + (status.error || 'Desconhecido'));
  }
  
  Logger.log('='.repeat(60));
  
  if (!status.isConfigured && !status.spreadsheetAccessible) {
    Logger.log('');
    Logger.log('Para configurar o ambiente, execute: setupEnvironment()');
  }
  
  return status;
}

/**
 * Configura SPREADSHEET_ID manualmente (se você já tem uma planilha).
 * @param {string} spreadsheetId ID da planilha existente
 */
function configureSpreadsheetId(spreadsheetId) {
  try {
    if (!spreadsheetId || typeof spreadsheetId !== 'string') {
      throw new Error('SPREADSHEET_ID inválido');
    }
    
    // Valida o ID
    var validation = SpreadsheetIdValidator.validate(spreadsheetId);
    if (!validation.valid) {
      throw new Error('SPREADSHEET_ID inválido: ' + validation.message);
    }
    
    // Tenta acessar a planilha
    var ss = SpreadsheetApp.openById(validation.cleanId);
    
    // Configura nas propriedades
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', validation.cleanId);
    
    Logger.log('='.repeat(60));
    Logger.log('✓ SPREADSHEET_ID CONFIGURADO!');
    Logger.log('ID: ' + validation.cleanId);
    Logger.log('Nome: ' + ss.getName());
    Logger.log('URL: ' + ss.getUrl());
    Logger.log('='.repeat(60));
    
    // Verifica se precisa inicializar
    var needsInit = SetupHelper.needsInitialization(ss);
    if (needsInit) {
      Logger.log('');
      Logger.log('A planilha precisa de inicialização.');
      Logger.log('Execute: setupEnvironment() para inicializar');
    }
    
    return {
      success: true,
      spreadsheetId: validation.cleanId,
      name: ss.getName(),
      url: ss.getUrl(),
      needsInitialization: needsInit
    };
    
  } catch (error) {
    Logger.log('✗ ERRO: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
