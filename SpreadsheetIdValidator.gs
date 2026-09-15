/**
 * @file SpreadsheetIdValidator.gs
 * @description Utilitário para validar e corrigir SPREADSHEET_ID
 */

const SpreadsheetIdValidator = {
  
  /**
   * Valida se um SPREADSHEET_ID está no formato correto
   * @param {string} id - ID para validar
   * @returns {Object} {valid: boolean, message: string, cleanId: string}
   */
  validate: function(id) {
    if (typeof id !== 'string' || !id.trim()) {
      return {
        valid: false,
        message: 'ID deve ser um texto não vazio',
        cleanId: null
      };
    }
    
    // Remover espaços
    id = id.trim();
    
    // Extrair ID se for uma URL completa
    const urlId = this.extractFromUrl(id);
    if (urlId) {
      id = urlId;
    }
    
    // Remover /edit ou outros sufixos
    id = id.split('/')[0];
    id = id.split('#')[0];
    id = id.split('?')[0];
    
    // Validar formato
    const validFormat = /^[a-zA-Z0-9-_]{30,50}$/;
    
    if (!validFormat.test(id)) {
      return {
        valid: false,
        message: 'ID não está no formato correto. Deve ter 30-50 caracteres alfanuméricos, hífens e underscores.',
        cleanId: id
      };
    }
    
    return {
      valid: true,
      message: 'ID válido',
      cleanId: id
    };
  },
  
  /**
   * Limpa e corrige um SPREADSHEET_ID
   * @param {string} id - ID para limpar
   * @returns {string} ID limpo
   */
  clean: function(id) {
    const result = this.validate(id);
    return result.cleanId || null;
  },
  
  /**
   * Testa se um ID consegue acessar a planilha
   * @param {string} id - ID para testar
   * @returns {Object} {success: boolean, message: string, spreadsheetName: string}
   */
  test: function(id) {
    const validation = this.validate(id);
    
    if (!validation.valid) {
      return {
        success: false,
        message: validation.message,
        spreadsheetName: null
      };
    }
    
    try {
      const ss = SpreadsheetApp.openById(validation.cleanId);
      return {
        success: true,
        message: 'Planilha acessada com sucesso',
        spreadsheetName: ss.getName(),
        url: ss.getUrl()
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao acessar planilha: ' + error.message,
        spreadsheetName: null
      };
    }
  },
  
  /**
   * Extrai ID de uma URL
   * @param {string} url - URL completa do Google Sheets
   * @returns {string} ID extraído ou null
   */
  extractFromUrl: function(url) {
    if (typeof url !== 'string') {
      return null;
    }

    const match = url.trim().match(
      /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]{30,50})(?:[\/?#]|$)/i
    );
    return match ? match[1] : null;
  },
  
  /**
   * Diagnóstico completo do SPREADSHEET_ID atual
   * @returns {Object} Relatório de diagnóstico
   */
  diagnose: function() {
    const currentId = Config.SPREADSHEET_ID;
    const currentIdLength = typeof currentId === 'string' ? currentId.length : 0;
    
    Logger.log('=== DIAGNÓSTICO DO SPREADSHEET_ID ===\n');
    Logger.log('ID atual: ' + currentId);
    Logger.log('Comprimento: ' + currentIdLength + ' caracteres\n');
    
    // Validação
    const validation = this.validate(currentId);
    Logger.log('Validação: ' + (validation.valid ? '✓ VÁLIDO' : '✗ INVÁLIDO'));
    Logger.log('Mensagem: ' + validation.message);
    
    if (validation.cleanId !== currentId) {
      Logger.log('ID limpo: ' + validation.cleanId);
    }
    Logger.log('');
    
    // Teste de acesso
    Logger.log('Testando acesso à planilha...');
    const test = this.test(currentId);
    Logger.log('Acesso: ' + (test.success ? '✓ SUCESSO' : '✗ FALHA'));
    Logger.log('Mensagem: ' + test.message);
    
    if (test.spreadsheetName) {
      Logger.log('Nome da planilha: ' + test.spreadsheetName);
      Logger.log('URL: ' + test.url);
    }
    Logger.log('');
    
    // Recomendações
    Logger.log('=== RECOMENDAÇÕES ===');
    
    if (!validation.valid) {
      Logger.log('1. O ID atual está malformado');
      Logger.log('2. Use o ID limpo: ' + validation.cleanId);
      Logger.log('3. Ou obtenha o ID correto da URL da planilha');
    } else if (!test.success) {
      Logger.log('1. O ID está no formato correto, mas não acessa a planilha');
      Logger.log('2. Verifique se a planilha existe');
      Logger.log('3. Verifique se você tem permissão de acesso');
      Logger.log('4. Considere criar uma nova planilha');
    } else {
      Logger.log('✓ Tudo OK! O SPREADSHEET_ID está configurado corretamente.');
    }
    
    return {
      currentId: currentId,
      validation: validation,
      test: test
    };
  }
};

/**
 * Função para diagnosticar o SPREADSHEET_ID atual
 */
function diagnosticarSpreadsheetId() {
  return SpreadsheetIdValidator.diagnose();
}

/**
 * Função para validar e limpar um ID
 * @param {string} id - ID para validar
 */
function validarSpreadsheetId(id) {
  const result = SpreadsheetIdValidator.validate(id || Config.SPREADSHEET_ID);
  
  Logger.log('ID original: ' + (id || Config.SPREADSHEET_ID));
  Logger.log('Válido: ' + result.valid);
  Logger.log('Mensagem: ' + result.message);
  
  if (result.cleanId !== (id || Config.SPREADSHEET_ID)) {
    Logger.log('ID limpo: ' + result.cleanId);
  }
  
  return result;
}

/**
 * Função para extrair ID de uma URL
 * @param {string} url - URL do Google Sheets
 */
function extrairIdDeUrl(url) {
  const id = SpreadsheetIdValidator.extractFromUrl(url);
  
  if (id) {
    Logger.log('✓ ID extraído: ' + id);
    Logger.log('');
    Logger.log('Para usar, atualize Config.gs:');
    Logger.log("SPREADSHEET_ID: '" + id + "',");
  } else {
    Logger.log('✗ Não foi possível extrair ID da URL');
    Logger.log('URL fornecida: ' + url);
  }
  
  return id;
}

/**
 * Função para testar acesso à planilha
 * @param {string} id - ID para testar (opcional, usa Config.SPREADSHEET_ID se não fornecido)
 */
function testarAcessoPlanilha(id) {
  const result = SpreadsheetIdValidator.test(id || Config.SPREADSHEET_ID);
  
  Logger.log('=== TESTE DE ACESSO ===');
  Logger.log('ID testado: ' + (id || Config.SPREADSHEET_ID));
  Logger.log('Resultado: ' + (result.success ? '✓ SUCESSO' : '✗ FALHA'));
  Logger.log('Mensagem: ' + result.message);
  
  if (result.spreadsheetName) {
    Logger.log('Nome: ' + result.spreadsheetName);
    Logger.log('URL: ' + result.url);
  }
  
  return result;
}
