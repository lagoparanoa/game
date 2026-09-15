/**
 * @file Main.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Ponto de entrada principal do sistema Web App. Gerencia inicialização, roteamento
 *              de requisições HTTP GET/POST e serve interface HTML apropriada via HtmlService.
 *              Funciona como Controller no padrão MVC coordenando Router para navegação,
 *              ApiGateway para chamadas assíncronas e SessionManager para autenticação.
 * 
 * @principais_funcionalidades
 * - doGet(e): Ponto de entrada para requisições HTTP GET (carregamento de páginas)
 * - doPost(e): Ponto de entrada para requisições HTTP POST (submissão de formulários)
 * - serveApp(): Retorna aplicação web completa com SPA (Single Page Application)
 * - initialize(): Inicializa configurações e verifica integridade da planilha
 * - onOpen(): Trigger que executa ao abrir planilha (cria menu customizado)
 */

/**
 * Função de entrada para requisições GET.
 * Serve a aplicação web principal ou páginas específicas via parâmetros.
 * 
 * @param {Object} e - Objeto de evento com parâmetros da URL
 * @returns {HtmlOutput} Página HTML renderizada
 */
function doGet(e) {
  try {
    e = e || { parameter: {} };
    e.parameter = e.parameter || {};
    // Métricas são opcionais e nunca devem impedir o carregamento do jogo.
    try {
      if (typeof Analytics !== 'undefined' && typeof Analytics.trackEvent === 'function') {
        Analytics.trackEvent('App', 'PageLoad', e.parameter.page || 'index');
      }
    } catch (analyticsError) {
      Logger.log('⚠️ Analytics indisponível durante o carregamento: ' + analyticsError.message);
    }

    if (e.parameter.action === 'logout') {
      return handleLogout();
    }
    
    // Verificar se há sessão ativa
    const session = SessionManager.getSessionUser();
    const page = e.parameter.page || 'index';
    
    // Roteamento baseado em autenticação
    if (!session && page !== 'login' && page !== 'register' && page !== 'about') {
      return Router.servePage('login');
    }
    
    // Servir página solicitada
    return Router.servePage(page, e.parameter);
    
  } catch (error) {
    ErrorHandler.logError('Main.doGet', error);
    return HtmlService.createHtmlOutput(
      '<h1>Erro ao carregar aplicação</h1>' +
      '<p>Não foi possível carregar a aplicação. Tente novamente.</p>' +
      '<a href="?">Tentar novamente</a>'
    ).setTitle('Erro - Lago Paranoá');
  }
}

/**
 * Função de entrada para requisições POST.
 * Processa submissões de formulários (login, registro, etc.)
 * 
 * @param {Object} e - Objeto de evento com parâmetros POST
 * @returns {HtmlOutput} Resposta HTML ou redirecionamento
 */
function doPost(e) {
  try {
    e = e || { parameter: {} };
    e.parameter = e.parameter || {};
    const action = e.parameter.action;
    
    switch(action) {
      case 'login':
        return handleLogin(e.parameter);
      case 'register':
        return handleRegister(e.parameter);
      case 'logout':
        return handleLogout();
      default:
        throw new Error('Ação não reconhecida: ' + action);
    }
    
  } catch (error) {
    ErrorHandler.logError('Main.doPost', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Não foi possível processar a requisição.'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Processa login de usuário.
 */
function handleLogin(params) {
  try {
    try {
      Config.getSpreadsheet();
    } catch (configurationError) {
      return {
        success: false,
        message: 'A base de usuários não está configurada. Revise SPREADSHEET_ID nas propriedades do script.'
      };
    }
    const username = params.username;
    const password = params.password;
    const missionChoice = params.missionChoice;
    
    if (!AuthService.login(username, password, missionChoice)) {
      AuditLog.logEvent('LOGIN_FAILED', { username: username, missionChoice: missionChoice });
      return {
        success: false,
        message: 'Usuário/e-mail ou senha incorretos. Verifique seus dados e tente novamente.'
      };
    }

    AuditLog.logEvent('LOGIN_SUCCESS', { username: username, missionChoice: missionChoice });
    return {
      success: true,
      message: 'Login realizado com sucesso.',
      missionChoice: missionChoice || null
    };
  } catch (error) {
    ErrorHandler.logError('Main.handleLogin', error, { params: params });
    return {
      success: false,
      message: ErrorHandler.handleError(error, 'o login').message
    };
  }
}

/**
 * Processa registro de novo usuário.
 */
function handleRegister(params) {
  try {
    ValidationService.validateEmail(params.email);
    ValidationService.validateUsername(params.username);
    ValidationService.validatePassword(params.password);

    const userData = {
      username: String(params.username).trim(),
      password: String(params.password),
      email: String(params.email).trim().toLowerCase(),
      role: 'player',
      createdAt: new Date()
    };

    const result = UserDAO.createUser(userData);
    if (!result.success) {
      return {
        success: false,
        message: result.error || 'Não foi possível registrar usuário.'
      };
    }

    AuditLog.logEvent('USER_REGISTERED', { username: userData.username, userId: result.user.userId });
    AuthService.login(userData.username, userData.password);

    return {
      success: true,
      message: 'Cadastro concluído com sucesso! Redirecionando...'
    };
  } catch (error) {
    ErrorHandler.logError('Main.handleRegister', error, { params: params });
    return {
      success: false,
      message: ErrorHandler.handleError(error, 'o cadastro').message
    };
  }
}

/**
 * Processa logout de usuário.
 */
function handleLogout() {
  logoutSession();
  const loginUrl = (ScriptApp.getService().getUrl() || '') + '?page=login';
  return HtmlService.createHtmlOutput(
    '<script>window.top.location.href = ' + JSON.stringify(loginUrl) + ';</script>'
  );
}

/**
 * Encerra a sessão quando chamado por google.script.run.
 * Retorna JSON serializável para o frontend; o redirecionamento fica a cargo da tela.
 */
function logoutSession() {
  const user = SessionManager.getSessionUser();
  if (user) {
    AuditLog.logEvent('LOGOUT', { username: user.username });
  }

  AuthService.logout();
  return { success: true, message: 'Sessão encerrada.' };
}

/**
 * Retorna o usuário autenticado sem expor credenciais ou tokens de sessão.
 */
function getCurrentUser() {
  const user = SessionManager.getSessionUser();
  if (!user) {
    return { success: false, error: 'Sessão expirada.' };
  }

  return { success: true, data: { user: user } };
}

/**
 * Alias explícito para verificações de sessão feitas pelo frontend.
 */
function checkSession() {
  return getCurrentUser();
}

/**
 * Verifica a disponibilidade do bridge google.script.run.
 */
function ping() {
  return { success: true, data: { message: 'pong' } };
}

/**
 * Inicializa o sistema verificando configurações.
 */
function initialize() {
  try {
    Logger.log('Inicializando sistema Lago Paranoá...');
    
    // Verificar se planilha existe e está acessível
    const spreadsheet = SpreadsheetApp.openById(Config.getSpreadsheetId());
    Logger.log('✓ Planilha acessível: ' + spreadsheet.getName());
    
    // Verificar abas necessárias
    const requiredSheets = ['Usuarios', 'Vilas', 'Jogadores', 'Clima', 'Aquifero'];
    requiredSheets.forEach(sheetName => {
      if (!spreadsheet.getSheetByName(sheetName)) {
        throw new Error('Aba obrigatória não encontrada: ' + sheetName);
      }
    });
    Logger.log('✓ Todas as abas obrigatórias presentes');
    
    // Inicializar clima se necessário
    ClimateService.setInitialRainfall(2); // Começar úmido
    Logger.log('✓ Sistema climático inicializado');
    
    Logger.log('✓ Sistema inicializado com sucesso!');
    return true;
    
  } catch (error) {
    ErrorHandler.logError('Main.initialize', error);
    throw error;
  }
}

/**
 * Trigger executado ao abrir a planilha.
 * Cria menu customizado com opções administrativas.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🌊 Lago Paranoá')
    .addItem('🎮 Abrir Jogo', 'openGameApp')
    .addSeparator()
    .addItem('🔧 Inicializar Sistema', 'initializeSystem')
    .addItem('✅ Validar Setup', 'validateSystemSetup')
    .addItem('🔄 Resetar Sistema', 'resetSystemAdmin')
    .addSeparator()
    .addItem('👥 Gerenciar Usuários', 'openUserManagement')
    .addItem('🏘️ Gerenciar Vilas', 'openVillageManagement')
    .addSeparator()
    .addItem('📊 Dashboard Admin', 'openAdminDashboard')
    .addItem('📈 Relatórios', 'openReports')
    .addSeparator()
    .addItem('ℹ️ Sobre', 'showAbout')
    .addToUi();
}

/**
 * Abre a aplicação web do jogo em nova janela.
 */
function openGameApp() {
  const url = ScriptApp.getService().getUrl();
  const html = HtmlService.createHtmlOutput(
    '<script>window.open("' + url + '", "_blank"); google.script.host.close();</script>'
  );
  SpreadsheetApp.getUi().showModalDialog(html, 'Abrindo Jogo...');
}

/**
 * Abre interface de gerenciamento de usuários.
 */
function openUserManagement() {
  const html = Router.servePage('admin-users');
  SpreadsheetApp.getUi().showModalDialog(html, 'Gerenciar Usuários');
}

/**
 * Abre interface de gerenciamento de vilas.
 */
function openVillageManagement() {
  const html = Router.servePage('admin-villages');
  SpreadsheetApp.getUi().showModalDialog(html, 'Gerenciar Vilas');
}

/**
 * Abre dashboard administrativo.
 */
function openAdminDashboard() {
  const html = Router.servePage('admin-dashboard');
  SpreadsheetApp.getUi().showModalDialog(html, 'Dashboard Administrativo');
}

/**
 * Abre página de relatórios.
 */
function openReports() {
  const html = Router.servePage('reports');
  SpreadsheetApp.getUi().showModalDialog(html, 'Relatórios');
}

/**
 * Mostra informações sobre o projeto.
 */
function showAbout() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'Lago Paranoá - O Desafio das Águas',
    '🌊 Jogo Educacional de Gestão de Recursos Hídricos\n\n' +
    'Versão: 1.0\n' +
    'Desenvolvido por: Manus AI\n' +
    'Para: Escola Classe 115 Norte\n\n' +
    '© 2026 - Licença CC BY-NC-SA 4.0',
    ui.ButtonSet.OK
  );
}
