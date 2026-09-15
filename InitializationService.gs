/**
 * @file InitializationService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Serviço de inicialização automática do sistema.
 *              Cria estrutura de abas, insere dados seed e configura estado inicial do jogo.
 * 
 * @principais_funcionalidades
 * - setupProject(): Inicialização completa do sistema
 * - createSheets(): Cria todas as abas necessárias com cabeçalhos
 * - insertSeedData(): Insere dados iniciais (admin, culturas, vila)
 * - initializeGameState(): Define estado inicial do jogo (rodada 0, clima, aquífero)
 * - validateSetup(): Verifica se sistema está corretamente configurado
 */

const InitializationService = {

  // Credencial inicial documentada para o primeiro acesso administrativo.
  DEFAULT_ADMIN_USERNAME: 'admin',
  DEFAULT_ADMIN_EMAIL: 'admin@lago-paranoa.edu.br',
  DEFAULT_ADMIN_PASSWORD: 'admin123',
  LEGACY_ADMIN_PASSWORD: 'Senha123!',
  
  /**
   * Retorna cabeçalhos oficiais do schema para a aba informada
   */
  getSchemaHeaders: function(sheetName) {
    var schema = SchemaService.SCHEMA[sheetName];
    return schema && Array.isArray(schema.headers) ? schema.headers : [];
  },
  
  /**
   * Inicialização completa do sistema
   * @returns {Object} { success, message, details }
   */
  setupProject: function() {
    try {
      const startTime = new Date();
      const results = {
        sheetsCreated: 0,
        seedDataInserted: 0,
        gameStateInitialized: false
      };
      
      Config.log('info', 'Iniciando setup do projeto...');
      
      // Validar SPREADSHEET_ID
      try {
        const ss = Config.getSpreadsheet();
        Config.log('info', 'Planilha acessada com sucesso: ' + ss.getName());
      } catch (error) {
        return {
          success: false,
          message: 'SPREADSHEET_ID inválido ou inacessível',
          error: error.message
        };
      }
      
      // 1. Criar estrutura de abas
      Config.log('info', 'Criando abas...');
      const sheetsResult = this.createSheets();
      results.sheetsCreated = sheetsResult.created;
      
      if (!sheetsResult.success) {
        return {
          success: false,
          message: 'Erro ao criar abas',
          error: sheetsResult.error,
          details: results
        };
      }
      
      // 2. Inserir dados seed
      Config.log('info', 'Inserindo dados seed...');
      const seedResult = this.insertSeedData();
      results.seedDataInserted = seedResult.inserted;
      
      if (!seedResult.success) {
        return {
          success: false,
          message: 'Erro ao inserir dados seed',
          error: seedResult.error,
          details: results
        };
      }
      
      // 3. Inicializar estado do jogo
      Config.log('info', 'Inicializando estado do jogo...');
      const gameStateResult = this.initializeGameState();
      results.gameStateInitialized = gameStateResult.success;
      
      if (!gameStateResult.success) {
        return {
          success: false,
          message: 'Erro ao inicializar estado do jogo',
          error: gameStateResult.error,
          details: results
        };
      }
      
      // 4. Validar setup
      const validationResult = this.validateSetup();
      if (!validationResult.valid) {
        return {
          success: false,
          message: 'Setup concluído com problemas de validação. Verifique as abas e dados seed.',
          error: validationResult.issues.join(' | '),
          details: results,
          validation: validationResult
        };
      }
      
      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;
      
      const message = `✅ Sistema inicializado com sucesso em ${duration}s!\n\n` +
                     `📊 Abas criadas: ${results.sheetsCreated}\n` +
                     `🌱 Dados seed: ${results.seedDataInserted} registros\n` +
                     `🎮 Estado do jogo: Inicializado\n\n` +
                     `🔐 Credenciais Admin:\n` +
                     `   Username: admin\n` +
                     `   Password: admin123\n\n` +
                     `🌐 Acesse o Web App para começar!`;
      
      Config.log('info', 'Setup concluído com sucesso', results);
      
      return {
        success: true,
        message: message,
        details: results,
        validation: validationResult
      };
      
    } catch (error) {
      ErrorHandler.logError('InitializationService.setupProject', error);
      return {
        success: false,
        message: 'Erro inesperado durante setup',
        error: error.message
      };
    }
  },
  
  /**
   * Cria todas as abas necessárias com cabeçalhos
   * @returns {Object} { success, created, skipped, error }
   */
  createSheets: function() {
    try {
      const ss = Config.getSpreadsheet();
      let created = 0;
      let skipped = 0;
      const schemaKeys = Object.keys(SchemaService.SCHEMA);
      
      schemaKeys.forEach(function(sheetName) {
        const headers = InitializationService.getSchemaHeaders(sheetName);
        if (!headers.length) {
          return;
        }

        var sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
          sheet = ss.insertSheet(sheetName);
          created++;
          Config.log('info', 'Aba criada: ' + sheetName);
        } else {
          skipped++;
          Config.log('info', 'Aba já existe: ' + sheetName);
        }

        var existingWidth = sheet.getLastColumn();
        var existingHeaders = existingWidth > 0
          ? sheet.getRange(1, 1, 1, existingWidth).getValues()[0].map(function(value) {
              return String(value || '').trim();
            })
          : [];
        var missingHeaders = headers.filter(function(header) {
          return existingHeaders.indexOf(header) === -1;
        });
        if (missingHeaders.length) {
          sheet.getRange(1, existingHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
        }
        var finalWidth = existingHeaders.length + missingHeaders.length;
        var headerRange = sheet.getRange(1, 1, 1, finalWidth);
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#004d40');
        headerRange.setFontColor('#ffffff');
        headerRange.setHorizontalAlignment('center');
        sheet.setFrozenRows(1);

        for (var i = 1; i <= finalWidth; i++) {
          sheet.autoResizeColumn(i);
        }
      });
      
      return {
        success: true,
        created: created,
        skipped: skipped
      };
      
    } catch (error) {
      ErrorHandler.logError('InitializationService.createSheets', error);
      return {
        success: false,
        created: 0,
        error: error.message
      };
    }
  },
  
  /**
   * Insere dados seed (admin, culturas, vila exemplo)
   * @returns {Object} { success, inserted, error }
   */
  insertSeedData: function() {
    try {
      const ss = Config.getSpreadsheet();
      let inserted = 0;
      
      // 1. Criar usuário admin ou corrigir apenas a credencial seed legada.
      const usersSheet = ss.getSheetByName('Usuarios');
      if (usersSheet && usersSheet.getLastRow() === 1) { // Só cabeçalhos
        const adminData = [
          'U-001',                    // userId
          this.DEFAULT_ADMIN_USERNAME,
          this.DEFAULT_ADMIN_EMAIL,
          'admin',                    // role
          this.DEFAULT_ADMIN_PASSWORD, // password (texto plano para ambiente educacional)
          new Date(),                 // createdAt
          null,                       // lastLogin
          'ATIVO'                     // status
        ];
        usersSheet.appendRow(adminData);
        inserted++;
        Config.log('info', 'Usuário admin criado');
      } else if (usersSheet) {
        this.migrateLegacyAdminPassword_(usersSheet);
      }
      
      // 2. Criar culturas base
      const cropsSheet = ss.getSheetByName('Culturas');
      if (cropsSheet && cropsSheet.getLastRow() === 1) {
        const crops = [
          ['C-001', 'Milho', 45, 12, 220, 'ATIVO'],
          ['C-002', 'Feijão', 35, 10, 160, 'ATIVO'],
          ['C-003', 'Hortaliça', 30, 8, 140, 'ATIVO']
        ];
        
        crops.forEach(crop => {
          cropsSheet.appendRow(crop);
          inserted++;
        });
        Config.log('info', 'Culturas base criadas: Milho, Feijão, Hortaliça');
      }
      
      // 3. Criar vila exemplo
      const villagesSheet = ss.getSheetByName('Vilas');
      if (villagesSheet && villagesSheet.getLastRow() === 1) {
        const villageData = [
          'V-001',                    // villageId
          'Asa Norte',                // name
          'Norte',                    // region
          0,                          // population (inicialmente vazia)
          10000,                      // waterAllocation
          5000,                       // foodStock
          50,                         // sustainabilityIndex
          new Date(),                 // createdAt
          'ATIVA'                     // status
        ];
        villagesSheet.appendRow(villageData);
        inserted++;
        Config.log('info', 'Vila exemplo criada: Asa Norte');
      }

      const seeded = SchemaService.seedSyntheticData();
      if (!seeded) {
        return {
          success: false,
          inserted: inserted,
          error: 'Falha ao semear dados de esquema.'
        };
      }
      
      return {
        success: true,
        inserted: inserted
      };
      
    } catch (error) {
      ErrorHandler.logError('InitializationService.insertSeedData', error);
      return {
        success: false,
        inserted: 0,
        error: error.message
      };
    }
  },

  /**
   * Atualiza somente a senha seed antiga, sem tocar em credenciais alteradas
   * manualmente ou de outros usuários.
   */
  migrateLegacyAdminPassword_: function(sheet) {
    try {
      const values = sheet.getDataRange().getValues();
      if (values.length <= 1) return false;

      const headers = values[0].map(function(header) {
        return String(header || '').trim().toLowerCase();
      });
      const usernameIndex = headers.indexOf('username');
      const passwordIndex = headers.indexOf('password');

      if (usernameIndex < 0 || passwordIndex < 0) return false;

      for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
        const username = String(values[rowIndex][usernameIndex] || '').trim().toLowerCase();
        const password = String(values[rowIndex][passwordIndex] || '').trim();
        if (username === this.DEFAULT_ADMIN_USERNAME && password === this.LEGACY_ADMIN_PASSWORD) {
          sheet.getRange(rowIndex + 1, passwordIndex + 1).setValue(this.DEFAULT_ADMIN_PASSWORD);
          Config.log('info', 'Credencial seed legada do admin atualizada');
          return true;
        }
      }
    } catch (error) {
      ErrorHandler.logError('InitializationService.migrateLegacyAdminPassword', error);
    }

    return false;
  },
  
  /**
   * Inicializa estado do jogo (rodada 0, clima inicial, aquífero)
   * @returns {Object} { success, error }
   */
  initializeGameState: function() {
    try {
      const ss = Config.getSpreadsheet();
      
      // 1. Estado climático inicial (Rodada 0)
      const climateSheet = ss.getSheetByName('Clima');
      if (climateSheet && climateSheet.getLastRow() === 1) {
        if (!ClimateService.setInitialRainfall(18)) {
          throw new Error('Não foi possível registrar o estado climático inicial.');
        }
        Config.log('info', 'Estado climático inicial: NORMAL, 18mm');
      }
      
      // 2. Estado do aquífero inicial
      const aquiferSheet = ss.getSheetByName('Aquifero');
      if (aquiferSheet && aquiferSheet.getLastRow() === 1) {
        const initialDepth = Config.AQUIFER.MAX_CAPACITY * 0.6;
        if (!AquiferService.recordState({
          round: 0,
          depth: initialDepth,
          extraction: 0,
          recharge: 0,
          evaporation: 0,
          status: AquiferService.calculateStatus(initialDepth),
          createdAt: new Date()
        })) {
          throw new Error('Não foi possível registrar o estado hídrico inicial.');
        }
        Config.log('info', 'Reservatório didático inicializado em 60% da capacidade configurada');
      }
      
      // O mercado inicia sem transações. Registros fictícios não são
      // misturados à evidência produzida por estudantes.
      
      // 4. Evento inicial de boas-vindas
      const eventsSheet = ss.getSheetByName('Eventos');
      if (eventsSheet && eventsSheet.getLastRow() === 1) {
        const welcome = HistoryService.recordEvent({
          eventId: 'E-001',
          round: 0,
          eventType: 'INFO',
          title: 'Bem-vindo ao Lago Paranoá!',
          description: 'O sistema foi inicializado e está pronto para o smoke test controlado.',
          impact: 'Nenhum',
          affectedPlayers: [],
          createdAt: new Date()
        });
        if (!welcome.success) throw new Error(welcome.error || 'Falha ao registrar evento inicial.');
        Config.log('info', 'Evento de boas-vindas criado');
      }
      
      return { success: true };
      
    } catch (error) {
      ErrorHandler.logError('InitializationService.initializeGameState', error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  /**
   * Valida se o setup foi realizado corretamente
   * @returns {Object} { valid, issues }
   */
  validateSetup: function() {
    const issues = [];
    
    try {
      const ss = Config.getSpreadsheet();
      
      // Verificar se todas as abas existem
      const schemas = InitializationService.SCHEMAS || this.SCHEMAS || {};
      Object.keys(schemas).forEach(sheetName => {
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
          issues.push(`Aba faltante: ${sheetName}`);
        } else {
          // Verificar se tem pelo menos cabeçalhos
          if (sheet.getLastRow() < 1) {
            issues.push(`Aba vazia (sem cabeçalhos): ${sheetName}`);
          }
        }
      });
      
      // Verificar dados seed críticos
      const usersSheet = ss.getSheetByName('Usuarios');
      if (usersSheet && usersSheet.getLastRow() < 2) {
        issues.push('Nenhum usuário criado (esperado: admin)');
      }
      
      const cropsSheet = ss.getSheetByName('Culturas');
      if (cropsSheet && cropsSheet.getLastRow() < 4) {
        issues.push('Culturas insuficientes (esperado: pelo menos 3)');
      }
      
      const villagesSheet = ss.getSheetByName('Vilas');
      if (villagesSheet && villagesSheet.getLastRow() < 2) {
        issues.push('Nenhuma vila criada (esperado: Asa Norte)');
      }
      
      const climateSheet = ss.getSheetByName('Clima');
      if (climateSheet && climateSheet.getLastRow() < 2) {
        issues.push('Estado climático não inicializado');
      }
      
      const aquiferSheet = ss.getSheetByName('Aquifero');
      if (aquiferSheet && aquiferSheet.getLastRow() < 2) {
        issues.push('Aquífero não inicializado');
      }
      
      const eventsSheet = ss.getSheetByName('Eventos');
      if (eventsSheet && eventsSheet.getLastRow() < 2) {
        issues.push('Evento inicial não criado');
      }
      
      const plantingsSheet = ss.getSheetByName('Plantios');
      if (plantingsSheet && plantingsSheet.getLastRow() < 1) {
        issues.push('Aba Plantios sem cabeçalhos ou falha ao criar');
      }
      
      const historySheet = ss.getSheetByName('HistoricoRodadas');
      if (historySheet && historySheet.getLastRow() < 1) {
        issues.push('Aba HistoricoRodadas sem cabeçalhos ou falha ao criar');
      }
      
      const notificationsSheet = ss.getSheetByName('Notificacoes');
      if (notificationsSheet && notificationsSheet.getLastRow() < 1) {
        issues.push('Aba Notificacoes sem cabeçalhos ou falha ao criar');
      }
      
      return {
        valid: issues.length === 0,
        issues: issues
      };
      
    } catch (error) {
      ErrorHandler.logError('InitializationService.validateSetup', error);
      return {
        valid: false,
        issues: ['Erro ao validar setup: ' + error.message]
      };
    }
  },
  
  /**
   * Reseta sistema (CUIDADO: apaga todos os dados!)
   * @returns {Object} { success, message }
   */
  resetSystem: function() {
    try {
      const ss = Config.getSpreadsheet();
      
      // Apagar todas as abas (exceto a primeira para manter planilha válida)
      const sheets = ss.getSheets();
      sheets.forEach(function(sheet, index) {
        if (index > 0) {
          ss.deleteSheet(sheet);
        }
      });
      
      // Renomear primeira aba para temp
      if (sheets.length > 0) {
        sheets[0].setName('_temp');
      }
      
      // Recriar sistema
      const setupResult = this.setupProject();
      
      // Remover aba temp
      const tempSheet = ss.getSheetByName('_temp');
      if (tempSheet) {
        ss.deleteSheet(tempSheet);
      }
      
      return setupResult;
      
    } catch (error) {
      ErrorHandler.logError('InitializationService.resetSystem', error);
      return {
        success: false,
        message: 'Erro ao resetar sistema: ' + error.message
      };
    }
  }
};

/**
 * Função global chamável do menu da planilha
 */
function getSpreadsheetUiSafe() {
  try {
    return SpreadsheetApp.getUi();
  } catch (error) {
    return null;
  }
}

function initializeSystem() {
  const result = InitializationService.setupProject();
  const ui = (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getUi) ? getSpreadsheetUiSafe() : null;
  if (ui) {
    if (result.success) {
      ui.alert('✅ Sucesso', result.message, ui.ButtonSet.OK);
    } else {
      ui.alert(
        '❌ Erro na Inicialização',
        result.message + '\n\n' +
        'Erro: ' + (result.error || 'Desconhecido') + '\n\n' +
        'Verifique os logs para mais detalhes.',
        ui.ButtonSet.OK
      );
    }
  }
  return result;
}

/**
 * Função global para resetar sistema (uso administrativo)
 */
function resetSystemAdmin() {
  const result = InitializationService.resetSystem();
  const ui = (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getUi) ? getSpreadsheetUiSafe() : null;
  if (ui) {
    if (result.success) {
      ui.alert('✅ Sistema Resetado', result.message, ui.ButtonSet.OK);
    } else {
      ui.alert('❌ Erro ao Resetar', result.message, ui.ButtonSet.OK);
    }
  }
  return result;
}

/**
 * Função global para validar setup
 */
function validateSystemSetup() {
  const result = InitializationService.validateSetup();
  const ui = (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getUi) ? getSpreadsheetUiSafe() : null;
  if (ui) {
    if (result.valid) {
      ui.alert(
        '✅ Sistema Válido',
        'Todas as verificações passaram!\n\nO sistema está pronto para uso.',
        ui.ButtonSet.OK
      );
    } else {
      ui.alert(
        '⚠️ Problemas Encontrados',
        'Foram encontrados os seguintes problemas:\n\n' +
        result.issues.join('\n') +
        '\n\nRecomenda-se executar "Inicializar Sistema" novamente.',
        ui.ButtonSet.OK
      );
    }
  }
  return result;
}
