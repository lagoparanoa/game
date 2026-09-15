/**
 * @file Router.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Controlador de navegação que serve as páginas HTML corretas via HtmlService.
 *              Gerencia roteamento, inclusão de templates, injeção de dados e controle de acesso.
 * 
 * @principais_funcionalidades
 * - Roteamento baseado em parâmetros de URL
 * - Injeção de dados de usuário e sessão
 * - Controle de acesso por autenticação
 * - Sistema de templates (header, footer, sidebar)
 * - Mensagens flash entre páginas
 * - Tratamento de erros com páginas customizadas
 */

const Router = {
  
  /**
   * Mapeia nomes de página para arquivos HTML
   */
  routes: {
    // Páginas Públicas
    'index': 'Index',
    'login': 'Login',
    'register': 'Register',
    'about': 'About',
    'privacy': 'PrivacyPolicy',
    'help': 'Help',
    
    // Páginas de Jogo (requer autenticação)
    'dashboard': 'Dashboard',
    'village': 'VillageManagement',
    'village-details': 'OperationsHub',
    'aquifer': 'AquiferDetails',
    'climate': 'ClimateReport',
    'crops': 'CropSelection',
    'market': 'OperationsHub',
    'water': 'WaterManagement',
    'research': 'OperationsHub',
    'build': 'OperationsHub',
    'resources': 'OperationsHub',
    
    // Páginas de Jogador
    'inventory': 'OperationsHub',
    'profile': 'OperationsHub',
    'actions': 'OperationsHub',
    
    // Páginas de Informações
    'leaderboard': 'Leaderboard',
    'history': 'GameHistory',
    'events': 'GameEvents',
    'map': 'GameMap',
    'reports': 'OperationsHub',
    'sustainability': 'OperationsHub',
    'economic': 'OperationsHub',
    
    // Páginas de Configuração
    'settings': 'OperationsHub',
    'tutorial': 'Tutorial',
    'notifications': 'Notifications',
    
    // Páginas Administrativas (requer role admin)
    'admin-dashboard': 'AdminPanel',
    'admin-users': 'AdminPanel',
    'admin-villages': 'AdminPanel'
  },
  
  /**
   * Páginas que NÃO requerem autenticação
   */
  publicPages: ['index', 'login', 'register', 'about', 'privacy', 'help'],
  
  /**
   * Páginas que requerem role de admin
   */
  adminPages: ['admin-dashboard', 'admin-users', 'admin-villages'],

  // Telas experimentais devem permanecer inacessíveis até terem contrato real.
  // Histórico e eventos saíram desta lista após migrarem para HistoryService.
  experimentalPages: [],
  
  /**
   * Serve uma página HTML com todos os dados necessários
   * @param {string} pageName - Nome da página a servir
   * @param {Object} params - Parâmetros adicionais
   * @returns {HtmlOutput} Página HTML renderizada
   */
  servePage: function(pageName, params = {}) {
    try {
      // Normalizar nome da página
      const normalizedPage = (pageName || 'index').toLowerCase().trim();

      if (this.experimentalPages.includes(normalizedPage)) {
        Config.log('warn', `Página experimental bloqueada: ${normalizedPage}`);
        return this.serveErrorPage(new Error('Esta tela está em quarentena até a integração com o backend ser homologada.'));
      }
      
      // Verificar autenticação
      const user = SessionManager.getSessionUser();
      const isAuthenticated = user !== null;
      
      // Controle de acesso
      if (!this.publicPages.includes(normalizedPage) && !isAuthenticated) {
        Config.log('warn', `Acesso negado a página protegida: ${normalizedPage}`, { user });
        return this.redirectToLogin('Você precisa fazer login para acessar esta página');
      }
      
      // Verificar permissão de admin
      if (this.adminPages.includes(normalizedPage)) {
        if (!user || user.role !== 'admin') {
          Config.log('warn', `Acesso negado a página admin: ${normalizedPage}`, { user: user?.username });
          return this.serveErrorPage(new Error('Acesso negado. Esta página requer permissões de administrador.'));
        }
      }
      
      // Buscar arquivo HTML correspondente
      const htmlFile = this.routes[normalizedPage];
      
      if (!htmlFile) {
        Config.log('warn', `Rota não encontrada: ${normalizedPage}`);
        return this.serve404Page(normalizedPage);
      }
      
      // Criar template HTML
      let template;
      try {
        template = HtmlService.createTemplateFromFile(htmlFile);
      } catch (fileError) {
        Config.log('error', `Arquivo HTML não encontrado: ${htmlFile}.html`, { error: fileError.message });
        return this.serve404Page(normalizedPage);
      }
      
      // Injetar dados do usuário
      template.user = user;
      template.isAuthenticated = isAuthenticated;
      template.isAdmin = user && user.role === 'admin';
      
      // Injetar parâmetros da página
      template.params = params;
      template.pageName = normalizedPage;
      template.appUrl = ScriptApp.getService().getUrl() || '';
      
      // Injetar dados específicos da página
      template.pageData = this.getPageData(normalizedPage, user, params);
      
      // Injetar mensagem flash se existir
      const flashMessage = SessionManager.getFlashMessage();
      if (flashMessage) {
        template.flash = flashMessage;
      }
      
      // Injetar configurações globais
      template.config = {
        appName: 'Lago Paranoá - O Desafio das Águas',
        version: Config.GAME_VERSION,
        env: Config.ENV
      };
      
      // Injetar funções auxiliares
      template.include = function(filename) {
        return Router.include(filename);
      };
      
      // Avaliar template e aplicar o contrato de movimento a todas as rotas.
      let rendered = template.evaluate().getContent();
      const uxStandards = '<style id="fleet-ux-standards">' +
        '@media (prefers-reduced-motion: reduce){' +
        '*,*::before,*::after{animation-duration:.01ms!important;' +
        'animation-iteration-count:1!important;scroll-behavior:auto!important;' +
        'transition-duration:.01ms!important}}' +
        '</style>';
      if (rendered.indexOf('fleet-ux-standards') === -1) {
        rendered = /<\/head>/i.test(rendered)
          ? rendered.replace(/<\/head>/i, uxStandards + '\n</head>')
          : uxStandards + rendered;
      }
      const output = HtmlService.createHtmlOutput(rendered);
      
      // Configurar propriedades do output
      output.setTitle('Lago Paranoá - ' + this.getPageTitle(normalizedPage));
      output.addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
      
      // Adicionar headers de segurança
      if (typeof SecurityHeaders !== 'undefined' && SecurityHeaders.applyHeaders) {
        SecurityHeaders.applyHeaders(output);
      }
      
      // Log de acesso
      Config.log('info', `Página servida: ${normalizedPage}`, { 
        user: user?.username, 
        authenticated: isAuthenticated 
      });
      
      return output;
      
    } catch (error) {
      ErrorHandler.logError('Router.servePage', error, { pageName, params });
      return this.serveErrorPage(error);
    }
  },
  
  /**
   * Obtém dados específicos para cada página
   * @param {string} pageName - Nome da página
   * @param {Object} user - Dados do usuário
   * @param {Object} params - Parâmetros adicionais
   * @returns {Object} Dados da página
   */
  getPageData: function(pageName, user, params) {
    try {
      switch(pageName) {
        case 'dashboard':
          return {
            playerStats: user ? this.safeCall('PlayerDAO.getPlayerStats', user.playerId) : null,
            villageInfo: user ? this.safeCall('VillageDAO.getVillageInfo', user.villageId) : null,
            recentEvents: this.safeCall('HistoryService.getRecentEvents', 5)
          };
          
        case 'aquifer':
          return {
            aquiferStatus: this.safeCall('AquiferService.getCurrentStatus'),
            waterHistory: this.safeCall('AquiferService.getHistory', 10)
          };
          
        case 'climate':
          return {
            currentClimate: this.safeCall('ClimateService.getCurrentClimate'),
            forecast: this.safeCall('ClimateService.getForecast', 3),
            history: this.safeCall('ClimateService.getHistory', 12)
          };
          
        case 'crops':
          return {
            availableCrops: this.safeCall('CropService.getAvailableCrops'),
            playerCrops: user ? this.safeCall('CropService.getPlayerCrops', user.playerId) : []
          };
          
        case 'leaderboard':
          return {
            topPlayers: this.safeCall('LeaderboardService.getTopPlayers', 10),
            topVillages: this.safeCall('LeaderboardService.getTopVillages', 5),
            userRank: user ? this.safeCall('LeaderboardService.getPlayerRank', user.playerId) : null
          };
          
        // Estes módulos carregam snapshots autenticados pelo ApiGateway no
        // navegador e não duplicam consultas durante a avaliação do template.
        case 'market':
        case 'research':
        case 'build':
        case 'inventory':
        case 'resources':
        case 'profile':
        case 'actions':
        case 'reports':
        case 'sustainability':
        case 'economic':
        case 'settings':
        case 'village-details':
        case 'admin-dashboard':
        case 'admin-users':
        case 'admin-villages':
          return {};
          
        default:
          return {};
      }
    } catch (error) {
      ErrorHandler.logError('Router.getPageData', error, { pageName });
      return {};
    }
  },
  
  /**
   * Resolve apenas os serviços usados pelo roteador.
   * @param {string} objectName - Nome exato do serviço permitido
   * @returns {Object|null} Serviço ou null quando não permitido/indisponível
   */
  resolveService: function(objectName) {
    switch (objectName) {
      case 'PlayerDAO': return typeof PlayerDAO !== 'undefined' ? PlayerDAO : null;
      case 'VillageDAO': return typeof VillageDAO !== 'undefined' ? VillageDAO : null;
      case 'HistoryService': return typeof HistoryService !== 'undefined' ? HistoryService : null;
      case 'AquiferService': return typeof AquiferService !== 'undefined' ? AquiferService : null;
      case 'ClimateService': return typeof ClimateService !== 'undefined' ? ClimateService : null;
      case 'CropService': return typeof CropService !== 'undefined' ? CropService : null;
      case 'LeaderboardService': return typeof LeaderboardService !== 'undefined' ? LeaderboardService : null;
      default: return null;
    }
  },

  /**
   * Chama uma função com tratamento de erro seguro
   * @param {string} functionPath - Caminho da função (ex: 'Service.method')
   * @param {...*} args - Argumentos da função
   * @returns {*} Resultado da função ou null
   */
  safeCall: function(functionPath, ...args) {
    try {
      const parts = functionPath.split('.');
      if (parts.length !== 2) return null;
      
      const [objectName, methodName] = parts;
      const object = this.resolveService(objectName);
      
      if (!object || typeof object[methodName] !== 'function') {
        return null;
      }
      
      return object[methodName](...args);
    } catch (error) {
      Config.log('debug', `SafeCall falhou: ${functionPath}`, { error: error.message });
      return null;
    }
  },
  
  /**
   * Obtém título da página
   * @param {string} pageName - Nome da página
   * @returns {string} Título
   */
  getPageTitle: function(pageName) {
    const titles = {
      'index': 'Início',
      'login': 'Login',
      'register': 'Registro',
      'dashboard': 'Dashboard',
      'village': 'Minha Vila',
      'village-details': 'Detalhes da Vila',
      'aquifer': 'Aquífero',
      'climate': 'Clima',
      'crops': 'Culturas',
      'market': 'Mercado',
      'water': 'Gestão de Água',
      'research': 'Pesquisa',
      'build': 'Construções',
      'resources': 'Recursos',
      'inventory': 'Inventário',
      'profile': 'Perfil',
      'actions': 'Ações',
      'leaderboard': 'Ranking',
      'history': 'Histórico',
      'events': 'Eventos',
      'map': 'Mapa',
      'reports': 'Relatórios',
      'sustainability': 'Sustentabilidade',
      'economic': 'Economia',
      'settings': 'Configurações',
      'tutorial': 'Tutorial',
      'notifications': 'Notificações',
      'help': 'Ajuda',
      'about': 'Sobre',
      'privacy': 'Privacidade',
      'admin-dashboard': 'Admin Dashboard'
    };
    
    return titles[pageName] || 'Página';
  },
  
  /**
   * Redireciona para página de login
   * @param {string} message - Mensagem opcional
   * @returns {HtmlOutput}
   */
  redirectToLogin: function(message) {
    if (message) {
      SessionManager.setFlashMessage(message, 'warning');
    }
    
    const loginUrl = (ScriptApp.getService().getUrl() || '') + '?page=login';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Redirecionando...</title>
      </head>
      <body>
        <script>
          window.top.location.href = ${JSON.stringify(loginUrl)};
        </script>
      </body>
      </html>
    `;
    
    return HtmlService.createHtmlOutput(html);
  },
  
  /**
   * Redireciona para outra página
   * @param {string} page - Nome da página
   * @param {Object} params - Parâmetros da URL
   * @returns {HtmlOutput}
   */
  redirect: function(page, params = {}) {
    const queryString = Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
    
    const appUrl = ScriptApp.getService().getUrl() || '';
    const url = `${appUrl}?page=${encodeURIComponent(page)}${queryString ? '&' + queryString : ''}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Redirecionando...</title>
      </head>
      <body>
        <script>
          window.top.location.href = ${JSON.stringify(url)};
        </script>
      </body>
      </html>
    `;
    
    return HtmlService.createHtmlOutput(html);
  },
  
  /**
   * Serve página de erro 404
   * @param {string} pageName - Nome da página não encontrada
   * @returns {HtmlOutput}
   */
  serve404Page: function(pageName) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Página Não Encontrada - Lago Paranoá</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
          }
          .container {
            background: white;
            padding: 3rem;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 500px;
            text-align: center;
            animation: fadeIn 0.5s ease;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .icon { font-size: 5rem; margin-bottom: 1rem; }
          h1 { color: #667eea; margin-bottom: 0.5rem; font-size: 2.5rem; }
          .code { color: #999; font-size: 1.2rem; margin-bottom: 1rem; }
          p { color: #666; margin-bottom: 2rem; line-height: 1.6; }
          .page-name { 
            background: #f0f0f0; 
            padding: 0.5rem 1rem; 
            border-radius: 5px; 
            font-family: monospace;
            display: inline-block;
            margin: 1rem 0;
          }
          .btn {
            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 25px;
            font-weight: 600;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
          }
          .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
          }
          .links {
            margin-top: 2rem;
            padding-top: 2rem;
            border-top: 1px solid #eee;
          }
          .links a {
            color: #667eea;
            text-decoration: none;
            margin: 0 1rem;
            transition: color 0.3s ease;
          }
          .links a:hover { color: #764ba2; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">🌊</div>
          <h1>404</h1>
          <div class="code">Página Não Encontrada</div>
          <p>A página que você está procurando não existe ou foi movida.</p>
          <div class="page-name">${pageName}</div>
          <p style="font-size: 0.9rem; color: #999;">
            Verifique se a URL está correta ou retorne à página inicial.
          </p>
          <a href="?" class="btn">🏠 Voltar ao Início</a>
          <div class="links">
            <a href="?page=dashboard">Dashboard</a>
            <a href="?page=help">Ajuda</a>
            <a href="?page=about">Sobre</a>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return HtmlService.createHtmlOutput(html)
      .setTitle('404 - Página Não Encontrada');
  },
  
  /**
   * Serve página de erro genérica
   * @param {Error|string} error - Erro a exibir
   * @returns {HtmlOutput}
   */
  serveErrorPage: function(error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const showDetails = Config.isDevelopment();
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Erro - Lago Paranoá</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
            padding: 1rem;
          }
          .container {
            background: white;
            padding: 3rem;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 600px;
            text-align: center;
            animation: shake 0.5s ease;
          }
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
          }
          .icon { font-size: 5rem; margin-bottom: 1rem; }
          h1 { color: #e74c3c; margin-bottom: 1rem; font-size: 2rem; }
          .error-message { 
            background: #fee; 
            border: 1px solid #fcc;
            padding: 1rem; 
            border-radius: 5px; 
            margin: 1.5rem 0;
            color: #c00;
            font-family: monospace;
            text-align: left;
            word-break: break-word;
          }
          p { color: #666; margin-bottom: 2rem; line-height: 1.6; }
          .btn {
            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 25px;
            font-weight: 600;
            margin: 0.5rem;
            transition: all 0.3s ease;
          }
          .btn:hover { transform: translateY(-2px); }
          .btn-secondary {
            background: #95a5a6;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">⚠️</div>
          <h1>Ops! Algo deu errado</h1>
          <p>Desculpe, ocorreu um erro ao processar sua solicitação.</p>
          ${showDetails ? `<div class="error-message">${errorMessage}</div>` : ''}
          <p style="font-size: 0.9rem;">
            ${showDetails 
              ? 'Este erro foi registrado e será analisado.' 
              : 'Nossa equipe foi notificada e está trabalhando para resolver o problema.'}
          </p>
          <a href="?" class="btn">🏠 Voltar ao Início</a>
          <a href="?page=dashboard" class="btn btn-secondary">← Voltar ao painel</a>
        </div>
      </body>
      </html>
    `;
    
    return HtmlService.createHtmlOutput(html)
      .setTitle('Erro - Lago Paranoá');
  },
  
  /**
   * Inclui arquivo HTML (para templates como Header, Footer, Sidebar)
   * @param {string} filename - Nome do arquivo sem extensão
   * @returns {string} Conteúdo HTML do arquivo
   */
  include: function(filename) {
    try {
      return HtmlService.createHtmlOutputFromFile(filename).getContent();
    } catch (error) {
      Config.log('warn', `Falha ao incluir arquivo: ${filename}`, { error: error.message });
      return `<!-- Arquivo não encontrado: ${filename} -->`;
    }
  }
};

/**
 * Função global para incluir templates (usada nos arquivos HTML)
 * @param {string} filename - Nome do arquivo
 * @returns {string} Conteúdo do arquivo
 */
function include(filename) {
  return Router.include(filename);
}

/**
 * Função de teste do Router
 */
function testRouter() {
  Logger.log('=== Testando Router ===');
  
  // Teste 1: Página pública sem autenticação
  Logger.log('Teste 1: Servir página pública (about)');
  const aboutPage = Router.servePage('about');
  Logger.log('✓ Página about servida');
  
  // Teste 2: Tentativa de acessar página protegida sem auth
  Logger.log('Teste 2: Tentar acessar dashboard sem autenticação');
  const dashboardUnauth = Router.servePage('dashboard');
  Logger.log('✓ Redirecionamento para login funcionando');
  
  // Teste 3: Página não existente (404)
  Logger.log('Teste 3: Página não existente');
  const notFound = Router.servePage('pagina-inexistente');
  Logger.log('✓ Página 404 servida');
  
  // Teste 4: Obter título de página
  Logger.log('Teste 4: Obter títulos');
  Logger.log('Título dashboard: ' + Router.getPageTitle('dashboard'));
  Logger.log('Título market: ' + Router.getPageTitle('market'));
  
  // Teste 5: SafeCall
  Logger.log('Teste 5: SafeCall com função inexistente');
  const result = Router.safeCall('NonExistent.method', 'arg');
  Logger.log('Resultado (deve ser null): ' + result);
  
  Logger.log('=== Testes concluídos ===');
}


/** Compacta dados estáticos para uso em data URLs. */
function includeInlineData(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent().replace(/\s+/g, '');
}
