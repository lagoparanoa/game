/**
 * @file SessionManager.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Gerenciador centralizado do estado persistente de sessões de usuários autenticados.
 *              Mantém dados temporários voláteis durante navegação entre páginas usando
 *              PropertiesService do Apps Script para persistência entre requisições.
 * 
 * @principais_funcionalidades
 * - Armazenar e recuperar usuário autenticado
 * - Gerenciar timeout de sessão
 * - Mensagens flash entre páginas
 * - Cache de dados temporários
 */

const SessionManager = {
  
  /**
   * Chaves usadas no PropertiesService
   */
  KEYS: {
    USER: 'session_user',
    TIMESTAMP: 'session_timestamp',
    FLASH: 'session_flash',
    DATA: 'session_data_'
  },
  
  /**
   * Timeout da sessão em milissegundos (padrão: 1 hora)
   */
  TIMEOUT: Config.SESSION_TIMEOUT || 60 * 60 * 1000,

  /**
   * Projeção mínima persistida na sessão. A planilha continua guardando a
   * senha em texto plano conforme a decisão operacional, mas a credencial não
   * precisa acompanhar o usuário em UserProperties nem em respostas do app.
   */
  sanitizeSessionUser_: function(userData) {
    var safe = {};
    Object.keys(userData || {}).forEach(function(key) {
      if (/password|senha|token|secret|authorization/i.test(key)) return;
      safe[key] = userData[key];
    });
    return safe;
  },
  
  /**
   * Define o usuário da sessão atual
   * @param {Object} userData - Dados do usuário
   */
  setSessionUser: function(userData) {
    try {
      const props = PropertiesService.getUserProperties();
      const safeUser = this.sanitizeSessionUser_(userData);
      props.setProperty(this.KEYS.USER, JSON.stringify(safeUser));
      props.setProperty(this.KEYS.TIMESTAMP, Date.now().toString());
      
      Config.log('info', 'Sessão iniciada', { username: safeUser.username });
    } catch (error) {
      ErrorHandler.logError('SessionManager.setSessionUser', error);
      throw error;
    }
  },
  
  /**
   * Recupera o usuário da sessão atual
   * @returns {Object|null} Dados do usuário ou null se não autenticado/expirado
   */
  getSessionUser: function() {
    try {
      const props = PropertiesService.getUserProperties();
      const userJson = props.getProperty(this.KEYS.USER);
      const timestamp = props.getProperty(this.KEYS.TIMESTAMP);
      
      if (!userJson || !timestamp) {
        return null;
      }
      
      // Verificar timeout
      const now = Date.now();
      const sessionTime = parseInt(timestamp, 10);
      if (!isFinite(sessionTime)) {
        this.clearSession();
        return null;
      }
      
      if (now - sessionTime > this.TIMEOUT) {
        Config.log('info', 'Sessão expirada por timeout');
        this.clearSession();
        return null;
      }
      
      // Renovar timestamp
      props.setProperty(this.KEYS.TIMESTAMP, now.toString());
      
      const parsedUser = JSON.parse(userJson);
      const safeUser = this.sanitizeSessionUser_(parsedUser);
      // Limpa sessões antigas criadas antes da projeção segura.
      if (JSON.stringify(safeUser) !== JSON.stringify(parsedUser)) {
        props.setProperty(this.KEYS.USER, JSON.stringify(safeUser));
      }
      return safeUser;
      
    } catch (error) {
      ErrorHandler.logError('SessionManager.getSessionUser', error);
      return null;
    }
  },
  
  /**
   * Limpa completamente a sessão
   */
  clearSession: function() {
    try {
      const props = PropertiesService.getUserProperties();
      
      // Remover dados principais
      props.deleteProperty(this.KEYS.USER);
      props.deleteProperty(this.KEYS.TIMESTAMP);
      props.deleteProperty(this.KEYS.FLASH);
      
      // Remover dados customizados (começam com session_data_)
      const allProps = props.getProperties();
      Object.keys(allProps).forEach(key => {
        if (key.startsWith(this.KEYS.DATA)) {
          props.deleteProperty(key);
        }
      });
      
      Config.log('info', 'Sessão limpa');
    } catch (error) {
      ErrorHandler.logError('SessionManager.clearSession', error);
    }
  },
  
  /**
   * Verifica se há uma sessão válida
   * @returns {boolean}
   */
  isSessionValid: function() {
    return this.getSessionUser() !== null;
  },
  
  /**
   * Renova a sessão (atualiza timestamp)
   */
  refreshSession: function() {
    try {
      if (this.isSessionValid()) {
        const props = PropertiesService.getUserProperties();
        props.setProperty(this.KEYS.TIMESTAMP, Date.now().toString());
      }
    } catch (error) {
      ErrorHandler.logError('SessionManager.refreshSession', error);
    }
  },
  
  /**
   * Armazena dado customizado na sessão
   * @param {string} key - Chave do dado
   * @param {*} value - Valor (será convertido para JSON)
   */
  setSessionData: function(key, value) {
    try {
      const props = PropertiesService.getUserProperties();
      const fullKey = this.KEYS.DATA + key;
      props.setProperty(fullKey, JSON.stringify(value));
    } catch (error) {
      ErrorHandler.logError('SessionManager.setSessionData', error, { key });
    }
  },
  
  /**
   * Recupera dado customizado da sessão
   * @param {string} key - Chave do dado
   * @returns {*} Valor ou null se não existir
   */
  getSessionData: function(key) {
    try {
      const props = PropertiesService.getUserProperties();
      const fullKey = this.KEYS.DATA + key;
      const value = props.getProperty(fullKey);
      
      return value ? JSON.parse(value) : null;
    } catch (error) {
      ErrorHandler.logError('SessionManager.getSessionData', error, { key });
      return null;
    }
  },
  
  /**
   * Remove dado customizado da sessão
   * @param {string} key - Chave do dado
   */
  removeSessionData: function(key) {
    try {
      const props = PropertiesService.getUserProperties();
      const fullKey = this.KEYS.DATA + key;
      props.deleteProperty(fullKey);
    } catch (error) {
      ErrorHandler.logError('SessionManager.removeSessionData', error, { key });
    }
  },
  
  /**
   * Obtém ID do jogador atual
   * @returns {string|null}
   */
  getCurrentPlayerId: function() {
    const user = this.getSessionUser();
    return user ? user.playerId : null;
  },
  
  /**
   * Obtém ID da vila atual
   * @returns {string|null}
   */
  getCurrentVillageId: function() {
    const user = this.getSessionUser();
    return user ? user.villageId : null;
  },
  
  /**
   * Define mensagem flash (exibida uma vez na próxima página)
   * @param {string} message - Texto da mensagem
   * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
   */
  setFlashMessage: function(message, type = 'info') {
    try {
      const props = PropertiesService.getUserProperties();
      const flash = {
        message: message,
        type: type,
        timestamp: Date.now()
      };
      props.setProperty(this.KEYS.FLASH, JSON.stringify(flash));
    } catch (error) {
      ErrorHandler.logError('SessionManager.setFlashMessage', error);
    }
  },
  
  /**
   * Recupera e REMOVE mensagem flash (lida apenas uma vez)
   * @returns {Object|null} {message, type} ou null
   */
  getFlashMessage: function() {
    try {
      const props = PropertiesService.getUserProperties();
      const flashJson = props.getProperty(this.KEYS.FLASH);
      
      if (!flashJson) {
        return null;
      }
      
      // Remover após leitura
      props.deleteProperty(this.KEYS.FLASH);
      
      const flash = JSON.parse(flashJson);
      
      // Ignorar mensagens muito antigas (>5 minutos)
      if (Date.now() - flash.timestamp > 5 * 60 * 1000) {
        return null;
      }
      
      return {
        message: flash.message,
        type: flash.type
      };
      
    } catch (error) {
      ErrorHandler.logError('SessionManager.getFlashMessage', error);
      return null;
    }
  },
  
  /**
   * Estende o tempo de validade da sessão
   * @param {number} minutes - Minutos adicionais
   */
  extendSession: function(minutes) {
    try {
      const user = this.getSessionUser();
      if (user) {
        const props = PropertiesService.getUserProperties();
        const newTimestamp = Date.now() + (minutes * 60 * 1000);
        props.setProperty(this.KEYS.TIMESTAMP, newTimestamp.toString());
        
        Config.log('info', 'Sessão estendida', { minutes });
      }
    } catch (error) {
      ErrorHandler.logError('SessionManager.extendSession', error);
    }
  },
  
  /**
   * Obtém informações sobre a sessão atual
   * @returns {Object} Informações da sessão
   */
  getSessionInfo: function() {
    try {
      const props = PropertiesService.getUserProperties();
      const user = this.getSessionUser();
      const timestamp = props.getProperty(this.KEYS.TIMESTAMP);
      
      if (!user || !timestamp) {
        return {
          active: false,
          user: null,
          startedAt: null,
          expiresAt: null,
          timeRemaining: 0
        };
      }
      
      const startedAt = parseInt(timestamp, 10);
      const expiresAt = startedAt + this.TIMEOUT;
      const timeRemaining = Math.max(0, expiresAt - Date.now());
      
      return {
        active: true,
        user: user,
        startedAt: new Date(startedAt),
        expiresAt: new Date(expiresAt),
        timeRemaining: timeRemaining,
        timeRemainingMinutes: Math.floor(timeRemaining / (60 * 1000))
      };
      
    } catch (error) {
      ErrorHandler.logError('SessionManager.getSessionInfo', error);
      return { active: false };
    }
  }
};

/**
 * Função de teste do SessionManager
 */
function testSessionManager() {
  Logger.log('=== Testando SessionManager ===');
  
  // Teste 1: Limpar sessão
  Logger.log('Teste 1: Limpar sessão');
  SessionManager.clearSession();
  Logger.log('✓ Sessão limpa');
  
  // Teste 2: Verificar sessão vazia
  Logger.log('Teste 2: Verificar sessão vazia');
  const noUser = SessionManager.getSessionUser();
  Logger.log('Usuário (deve ser null): ' + noUser);
  
  // Teste 3: Criar sessão
  Logger.log('Teste 3: Criar sessão');
  const testUser = {
    userId: 'user123',
    username: 'testuser',
    email: 'test@example.com',
    role: 'player',
    playerId: 'player123',
    villageId: 'village456'
  };
  SessionManager.setSessionUser(testUser);
  Logger.log('✓ Sessão criada');
  
  // Teste 4: Recuperar sessão
  Logger.log('Teste 4: Recuperar sessão');
  const retrievedUser = SessionManager.getSessionUser();
  Logger.log('Usuário recuperado: ' + retrievedUser.username);
  
  // Teste 5: Dados customizados
  Logger.log('Teste 5: Dados customizados');
  SessionManager.setSessionData('lastPage', 'dashboard');
  const lastPage = SessionManager.getSessionData('lastPage');
  Logger.log('Last page: ' + lastPage);
  
  // Teste 6: Flash message
  Logger.log('Teste 6: Flash message');
  SessionManager.setFlashMessage('Bem-vindo!', 'success');
  const flash = SessionManager.getFlashMessage();
  Logger.log('Flash: ' + flash.message + ' (' + flash.type + ')');
  
  // Teste 7: Flash já foi lida (deve ser null)
  const flash2 = SessionManager.getFlashMessage();
  Logger.log('Flash 2 (deve ser null): ' + flash2);
  
  // Teste 8: Info da sessão
  Logger.log('Teste 8: Info da sessão');
  const info = SessionManager.getSessionInfo();
  Logger.log('Sessão ativa: ' + info.active);
  Logger.log('Tempo restante: ' + info.timeRemainingMinutes + ' minutos');
  
  // Teste 9: Limpar novamente
  Logger.log('Teste 9: Limpar sessão final');
  SessionManager.clearSession();
  
  Logger.log('=== Testes concluídos ===');
}
