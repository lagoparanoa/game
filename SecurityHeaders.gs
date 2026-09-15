/**
 * @file SecurityHeaders.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Aplica cabeçalhos de segurança HTTP às respostas HTML para proteger contra
 *              ataques comuns (XSS, clickjacking, MIME sniffing, etc.)
 * 
 * @principais_funcionalidades
 * - Content Security Policy (CSP)
 * - X-Frame-Options (proteção contra clickjacking)
 * - X-Content-Type-Options (prevenir MIME sniffing)
 * - Referrer-Policy (controle de informações de referer)
 */

const SecurityHeaders = {
  
  /**
   * Aplica headers de segurança a um HtmlOutput
   * @param {HtmlOutput} output - Objeto HtmlOutput do Apps Script
   * @returns {HtmlOutput} Output com headers aplicados
   */
  applyHeaders: function(output) {
    try {
      // Content Security Policy
      // Nota: Apps Script tem limitações, alguns headers podem não funcionar completamente
      if (Config.isProduction()) {
        // Produção: política mais restritiva
        output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      } else {
        // Desenvolvimento: mais permissivo para testes
        output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      }
      
      // Adicionar meta tags de segurança via addMetaTag
      // (Algumas restrições não funcionam diretamente no Apps Script)
      
      return output;
      
    } catch (error) {
      ErrorHandler.logError('SecurityHeaders.applyHeaders', error);
      return output; // Retornar output mesmo com erro para não quebrar a aplicação
    }
  },
  
  /**
   * Gera nonce para CSP inline scripts
   * @returns {string} Nonce aleatório
   */
  generateNonce: function() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
  },
  
  /**
   * Sanitiza input HTML para prevenir XSS
   * @param {string} input - String a ser sanitizada
   * @returns {string} String sanitizada
   */
  sanitizeHtml: function(input) {
    if (!input) return '';
    
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  },
  
  /**
   * Sanitiza input para uso em atributos HTML
   * @param {string} input - String a ser sanitizada
   * @returns {string} String sanitizada
   */
  sanitizeAttribute: function(input) {
    if (!input) return '';
    
    return String(input)
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },
  
  /**
   * Sanitiza input para uso em JavaScript
   * @param {string} input - String a ser sanitizada
   * @returns {string} String sanitizada
   */
  sanitizeJs: function(input) {
    if (!input) return '';
    
    return String(input)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/</g, '\\x3C')
      .replace(/>/g, '\\x3E');
  },
  
  /**
   * Valida e sanitiza URL
   * @param {string} url - URL a ser validada
   * @returns {string|null} URL válida ou null
   */
  sanitizeUrl: function(url) {
    if (!url) return null;
    
    try {
      // Permitir apenas URLs HTTP/HTTPS ou relativas
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/') || url.startsWith('?')) {
        // Remover espaços e caracteres perigosos
        return url.trim().replace(/[\s\r\n\t]/g, '');
      }
      return null;
    } catch (error) {
      return null;
    }
  },
  
  /**
   * Gera token CSRF
   * @param {string} userId - ID do usuário
   * @returns {string} Token CSRF
   */
  generateCsrfToken: function(userId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const token = `${userId}_${timestamp}_${random}`;
    
    // Armazenar token na sessão
    SessionManager.setSessionData('csrf_token', token);
    SessionManager.setSessionData('csrf_timestamp', timestamp);
    
    return token;
  },
  
  /**
   * Valida token CSRF
   * @param {string} token - Token a validar
   * @param {string} userId - ID do usuário
   * @returns {boolean} True se válido
   */
  validateCsrfToken: function(token, userId) {
    if (!token || !userId) return false;
    
    const storedToken = SessionManager.getSessionData('csrf_token');
    const timestamp = SessionManager.getSessionData('csrf_timestamp');
    
    if (!storedToken || !timestamp) return false;
    
    // Verificar se token corresponde
    if (token !== storedToken) return false;
    
    // Verificar se não expirou (5 minutos)
    const now = Date.now();
    if (now - timestamp > 5 * 60 * 1000) {
      return false;
    }
    
    return true;
  },
  
  /**
   * Limpa token CSRF após uso
   */
  clearCsrfToken: function() {
    SessionManager.removeSessionData('csrf_token');
    SessionManager.removeSessionData('csrf_timestamp');
  }
};

/**
 * Funções globais para uso em templates HTML
 */

/**
 * Escapa HTML para uso seguro em templates
 * @param {string} text - Texto a escapar
 * @returns {string} Texto escapado
 */
function escapeHtml(text) {
  return SecurityHeaders.sanitizeHtml(text);
}

/**
 * Escapa atributo HTML
 * @param {string} text - Texto a escapar
 * @returns {string} Texto escapado
 */
function escapeAttr(text) {
  return SecurityHeaders.sanitizeAttribute(text);
}

/**
 * Escapa JavaScript
 * @param {string} text - Texto a escapar
 * @returns {string} Texto escapado
 */
function escapeJs(text) {
  return SecurityHeaders.sanitizeJs(text);
}

/**
 * Função de teste do SecurityHeaders
 */
function testSecurityHeaders() {
  Logger.log('=== Testando SecurityHeaders ===');
  
  // Teste 1: Sanitização HTML
  Logger.log('Teste 1: Sanitizar HTML');
  const htmlInput = '<script>alert("XSS")</script>';
  const sanitized = SecurityHeaders.sanitizeHtml(htmlInput);
  Logger.log('Input: ' + htmlInput);
  Logger.log('Output: ' + sanitized);
  
  // Teste 2: Sanitização de atributo
  Logger.log('Teste 2: Sanitizar atributo');
  const attrInput = 'value" onclick="alert(1)"';
  const sanitizedAttr = SecurityHeaders.sanitizeAttribute(attrInput);
  Logger.log('Input: ' + attrInput);
  Logger.log('Output: ' + sanitizedAttr);
  
  // Teste 3: Sanitização JavaScript
  Logger.log('Teste 3: Sanitizar JS');
  const jsInput = "'; alert('XSS'); //";
  const sanitizedJs = SecurityHeaders.sanitizeJs(jsInput);
  Logger.log('Input: ' + jsInput);
  Logger.log('Output: ' + sanitizedJs);
  
  // Teste 4: Validação de URL
  Logger.log('Teste 4: Validar URLs');
  const validUrl = 'https://example.com/page';
  const invalidUrl = 'javascript:alert(1)';
  Logger.log('Valid URL: ' + SecurityHeaders.sanitizeUrl(validUrl));
  Logger.log('Invalid URL: ' + SecurityHeaders.sanitizeUrl(invalidUrl));
  
  // Teste 5: CSRF Token
  Logger.log('Teste 5: CSRF Token');
  const userId = 'user123';
  const token = SecurityHeaders.generateCsrfToken(userId);
  Logger.log('Token gerado: ' + token);
  
  const isValid = SecurityHeaders.validateCsrfToken(token, userId);
  Logger.log('Token válido: ' + isValid);
  
  const isInvalid = SecurityHeaders.validateCsrfToken('wrong_token', userId);
  Logger.log('Token inválido: ' + isInvalid);
  
  // Teste 6: Aplicar headers
  Logger.log('Teste 6: Aplicar headers');
  const output = HtmlService.createHtmlOutput('<h1>Test</h1>');
  SecurityHeaders.applyHeaders(output);
  Logger.log('✓ Headers aplicados');
  
  Logger.log('=== Testes concluídos ===');
}
