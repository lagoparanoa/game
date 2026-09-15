/**
 * @file ErrorHandler.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Captura e trata exceções, garantindo que o sistema não falhe silenciosamente.
 * @context Integração da lógica técnica robusta (V1) com a narrativa do DF (V2).
 *          Todo o CRUD é processado na planilha via SPREADSHEETS_ID.
 * 
 * @principais_funcionalidades
 * - Tratamento centralizado de erros
 * - Logging estruturado para debugging
 * - Mensagens amigáveis para usuários
 * - Integração com AuditLog para rastreamento
 */

function redactErrorData_(value, stack) {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  stack = stack || [];
  if (stack.indexOf(value) !== -1) return '[Circular]';
  stack.push(value);

  var result;
  if (Array.isArray(value)) {
    result = value.map(function(item) { return redactErrorData_(item, stack); });
  } else {
    result = {};
    Object.keys(value).forEach(function(key) {
      if (/password|senha|token|secret|authorization|cookie/i.test(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactErrorData_(value[key], stack);
      }
    });
  }
  stack.pop();
  return result;
}

const ErrorHandler = {
  
  /**
   * Categorias de erro
   */
  ErrorTypes: {
    VALIDATION: 'VALIDATION_ERROR',
    AUTHENTICATION: 'AUTH_ERROR',
    AUTHORIZATION: 'AUTHORIZATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    DATABASE: 'DATABASE_ERROR',
    EXTERNAL_API: 'EXTERNAL_API_ERROR',
    SYSTEM: 'SYSTEM_ERROR',
    UNKNOWN: 'UNKNOWN_ERROR'
  },
  
  /**
   * Registra um erro no sistema
   * @param {string} context - Contexto onde o erro ocorreu (ex: 'UserDAO.createUser')
   * @param {Error|string} error - Objeto de erro ou mensagem
   * @param {Object} additionalData - Dados adicionais para debugging
   */
  logError: function(context, error, additionalData = {}) {
    try {
      const errorMessage = error instanceof Error ? error.message : error;
      const errorStack = error instanceof Error ? error.stack : '';
      
      const safeAdditionalData = redactErrorData_(additionalData || {});
      const errorData = {
        context: context,
        message: errorMessage,
        stack: errorStack,
        timestamp: new Date().toISOString(),
        ...safeAdditionalData
      };
      
      // Log no console
      Logger.log('❌ ERRO: ' + context);
      Logger.log('Mensagem: ' + errorMessage);
      if (errorStack && Config.isDevelopment()) {
        Logger.log('Stack: ' + errorStack);
      }
      if (Object.keys(safeAdditionalData).length > 0) {
        Logger.log('Dados adicionais: ' + JSON.stringify(safeAdditionalData));
      }
      
      // Registrar no audit log se em produção
      if (Config.isProduction()) {
        try {
          AuditLog.logEvent('ERROR_LOGGED', errorData);
        } catch (auditError) {
          Logger.log('⚠️ Não foi possível registrar erro no AuditLog: ' + auditError.message);
        }
      }
      
    } catch (loggingError) {
      // Último recurso: garantir que pelo menos algo seja logado
      Logger.log('❌❌ ERRO CRÍTICO NO ErrorHandler: ' + loggingError.message);
      Logger.log('Erro original: ' + (error instanceof Error ? error.message : error));
    }
  },
  
  /**
   * Trata um erro e retorna uma resposta apropriada para o usuário
   * @param {Error|string} error - Erro a ser tratado
   * @param {string} userContext - Contexto amigável para o usuário
   * @returns {Object} Objeto com informações do erro formatadas
   */
  handleError: function(error, userContext = 'operação') {
    const errorMessage = error instanceof Error ? error.message : error;
    
    // Determinar tipo de erro
    const errorType = this.categorizeError(errorMessage);
    
    // Mensagem amigável para o usuário
    const userMessage = this.getUserFriendlyMessage(errorType, userContext);
    
    // Determinar se deve mostrar detalhes técnicos
    const showDetails = Config.isDevelopment();
    
    return {
      success: false,
      error: true,
      errorType: errorType,
      message: userMessage,
      technicalDetails: showDetails ? errorMessage : undefined,
      timestamp: new Date().toISOString()
    };
  },
  
  /**
   * Categoriza um erro baseado na mensagem
   * @param {string} errorMessage - Mensagem de erro
   * @returns {string} Tipo do erro
   */
  categorizeError: function(errorMessage) {
    const msg = errorMessage.toLowerCase();
    
    if (msg.includes('validação') || msg.includes('inválido') || msg.includes('obrigatório')) {
      return this.ErrorTypes.VALIDATION;
    }
    if (msg.includes('autenticação') || msg.includes('login') || msg.includes('senha')) {
      return this.ErrorTypes.AUTHENTICATION;
    }
    if (msg.includes('autorização') || msg.includes('permissão') || msg.includes('acesso negado')) {
      return this.ErrorTypes.AUTHORIZATION;
    }
    if (msg.includes('não encontrado') || msg.includes('não existe')) {
      return this.ErrorTypes.NOT_FOUND;
    }
    if (msg.includes('planilha') || msg.includes('sheet') || msg.includes('database')) {
      return this.ErrorTypes.DATABASE;
    }
    if (msg.includes('api') || msg.includes('requisição') || msg.includes('timeout')) {
      return this.ErrorTypes.EXTERNAL_API;
    }
    
    return this.ErrorTypes.UNKNOWN;
  },
  
  /**
   * Retorna uma mensagem amigável baseada no tipo de erro
   * @param {string} errorType - Tipo do erro
   * @param {string} context - Contexto da operação
   * @returns {string} Mensagem amigável
   */
  getUserFriendlyMessage: function(errorType, context) {
    const messages = {
      [this.ErrorTypes.VALIDATION]: `Os dados fornecidos para ${context} são inválidos. Por favor, verifique e tente novamente.`,
      [this.ErrorTypes.AUTHENTICATION]: `Falha na autenticação. Verifique suas credenciais e tente novamente.`,
      [this.ErrorTypes.AUTHORIZATION]: `Você não tem permissão para realizar esta ${context}.`,
      [this.ErrorTypes.NOT_FOUND]: `O recurso solicitado não foi encontrado.`,
      [this.ErrorTypes.DATABASE]: `Erro ao acessar os dados. Por favor, tente novamente em alguns instantes.`,
      [this.ErrorTypes.EXTERNAL_API]: `Erro ao conectar com serviço externo. Por favor, tente novamente.`,
      [this.ErrorTypes.SYSTEM]: `Erro no sistema durante ${context}. Nossa equipe foi notificada.`,
      [this.ErrorTypes.UNKNOWN]: `Erro inesperado durante ${context}. Por favor, tente novamente.`
    };
    
    return messages[errorType] || messages[this.ErrorTypes.UNKNOWN];
  },
  
  /**
   * Cria uma resposta de erro HTTP formatada
   * @param {Error|string} error - Erro a ser formatado
   * @param {number} statusCode - Código HTTP (padrão: 500)
   * @returns {ContentService.TextOutput} Resposta JSON
   */
  createErrorResponse: function(error, statusCode = 500) {
    const errorData = this.handleError(error);
    
    return ContentService
      .createTextOutput(JSON.stringify(errorData))
      .setMimeType(ContentService.MimeType.JSON);
  },
  
  /**
   * Wrapper para execução segura de funções
   * @param {Function} fn - Função a ser executada
   * @param {string} context - Contexto para logging
   * @param {*} defaultValue - Valor padrão em caso de erro
   * @returns {*} Resultado da função ou valor padrão
   */
  safeExecute: function(fn, context, defaultValue = null) {
    try {
      return fn();
    } catch (error) {
      this.logError(context, error);
      return defaultValue;
    }
  },
  
  /**
   * Valida que um valor não é nulo/undefined
   * @param {*} value - Valor a ser validado
   * @param {string} fieldName - Nome do campo
   * @throws {Error} Se o valor for nulo/undefined
   */
  assertNotNull: function(value, fieldName) {
    if (value === null || value === undefined || value === '') {
      throw new Error(`Campo obrigatório: ${fieldName}`);
    }
  },
  
  /**
   * Valida que uma condição é verdadeira
   * @param {boolean} condition - Condição a ser validada
   * @param {string} message - Mensagem de erro
   * @throws {Error} Se a condição for falsa
   */
  assert: function(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }
};

/**
 * Função de teste do ErrorHandler
 */
function testErrorHandler() {
  Logger.log('=== Testando ErrorHandler ===');
  
  // Teste 1: Log de erro simples
  ErrorHandler.logError('TestFunction', 'Erro de teste');
  
  // Teste 2: Categorização de erros
  const validationError = ErrorHandler.categorizeError('Validação falhou: campo obrigatório');
  Logger.log('Tipo (deve ser VALIDATION_ERROR): ' + validationError);
  
  // Teste 3: Mensagem amigável
  const message = ErrorHandler.getUserFriendlyMessage(validationError, 'cadastro');
  Logger.log('Mensagem amigável: ' + message);
  
  // Teste 4: Execução segura
  const result = ErrorHandler.safeExecute(
    () => { throw new Error('Teste de erro'); },
    'SafeExecuteTest',
    'Valor padrão'
  );
  Logger.log('Resultado de execução segura: ' + result);
  
  Logger.log('=== Teste concluído ===');
}
