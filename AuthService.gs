/**
 * @file AuthService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Gerencia autenticação em texto plano integrada à planilha de usuários.
 * @context Integração da lógica técnica robusta (V1) com a narrativa do DF (V2).
 *          Suporta login, logout e verificação de sessão para aplicação web.
 * 
 * @principais_funcionalidades
 * - login(username, password)
 * - logout()
 * - getCurrentUser()
 * - isAdmin()
 */

function AuthService() {
  Logger.log("Iniciando componente: AuthService.gs");
}

function plaintextPasswordValue(password) {
  return String(password === undefined || password === null ? '' : password);
}

function lagoAuthHeaderKey_(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

AuthService.login = function(username, password, missionChoice) {
  try {
    if (!username || !password) {
      return false;
    }

    const user = AuthService.findUserByUsername(username);
    const candidatePassword = plaintextPasswordValue(password);
    const storedPassword = String(user && user.password || '').trim();
    const defaultAdminPassword = typeof InitializationService !== 'undefined'
      ? InitializationService.DEFAULT_ADMIN_PASSWORD
      : 'admin123';
    const legacyAdminPassword = typeof InitializationService !== 'undefined'
      ? InitializationService.LEGACY_ADMIN_PASSWORD
      : 'Senha123!';
    const isLegacyAdminCredential = user &&
      String(user.username || '').trim().toLowerCase() === 'admin' &&
      storedPassword === legacyAdminPassword &&
      candidatePassword === defaultAdminPassword;

    if (!user || (storedPassword !== candidatePassword && !isLegacyAdminCredential)) {
      return false;
    }

    // Migração silenciosa e restrita ao usuário seed conhecido.
    if (isLegacyAdminCredential && typeof InitializationService !== 'undefined') {
      try {
        InitializationService.migrateLegacyAdminPassword_(Config.getSheet(Config.SHEETS.USERS));
      } catch (migrationError) {
        // A autenticação não deve falhar apenas porque a migração não pôde ser persistida.
        ErrorHandler.logError('AuthService.migrateLegacyAdminPassword', migrationError);
      }
      user.password = candidatePassword;
    }

    const status = String(user.status || 'ATIVO').trim().toLowerCase();
    if (['ativo', 'active', 'true', '1', 'sim', 'yes'].indexOf(status) === -1) {
      return false;
    }

    if (missionChoice && typeof missionChoice === 'string') {
      user.initialMission = String(missionChoice).trim();
      try {
        SessionManager.setSessionData('initialMission', user.initialMission);
      } catch (sessionError) {
        ErrorHandler.logError('AuthService.setInitialMissionSession', sessionError, { missionChoice: missionChoice });
      }
    }

    SessionManager.setSessionUser(user);
    return true;
  } catch (error) {
    ErrorHandler.logError('AuthService.login', error, { username: username });
    return false;
  }
};

AuthService.logout = function() {
  try {
    SessionManager.clearSession();
    return true;
  } catch (error) {
    ErrorHandler.logError('AuthService.logout', error);
    return false;
  }
};

AuthService.getCurrentUser = function() {
  try {
    return SessionManager.getSessionUser();
  } catch (error) {
    ErrorHandler.logError('AuthService.getCurrentUser', error);
    return null;
  }
};

AuthService.isAdmin = function() {
  const user = AuthService.getCurrentUser();
  return user && user.role === 'admin';
};

AuthService.findUserByUsername = function(username) {
  try {
    const identifier = String(username || '').trim().toLowerCase();
    if (!identifier) {
      return null;
    }

    const sheet = Config.getSheet(Config.SHEETS.USERS);
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      return null;
    }

    const headers = values[0].map(function(cell) {
      return String(cell || '').trim().toLowerCase();
    });

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const user = AuthService.mapUserRow(headers, row);
      const normalizedUsername = String(user.username || '').trim().toLowerCase();
      const normalizedEmail = String(user.email || '').trim().toLowerCase();
      if (normalizedUsername === identifier || normalizedEmail === identifier) {
        return user;
      }
    }
    return null;
  } catch (error) {
    ErrorHandler.logError('AuthService.findUserByUsername', error, { username: username });
    return null;
  }
};

AuthService.mapUserRow = function(headers, row) {
  const user = {};
  headers.forEach(function(header, index) {
    const value = row[index];
    const key = lagoAuthHeaderKey_(header);
    
    // Mapeamento estrito seguindo schema de Usuarios
    if (['userid', 'idusuario', 'iddousuario', 'id'].indexOf(key) >= 0) {
      user.userId = String(value || '').trim();
    } else if (['username', 'user', 'usuario', 'nomedeusuario'].indexOf(key) >= 0) {
      user.username = String(value || '').trim();
    } else if (['email', 'correioeletronico'].indexOf(key) >= 0) {
      user.email = String(value || '').trim();
    } else if (['password', 'passwordhash', 'senha'].indexOf(key) >= 0) {
      user.password = String(value === undefined || value === null ? '' : value);
    } else if (['role', 'perfil', 'papel'].indexOf(key) >= 0) {
      user.role = String(value || 'player').trim();
    } else if (['createdat', 'criadoem', 'datadecriacao'].indexOf(key) >= 0) {
      user.createdAt = value instanceof Date ? value : new Date(value);
    } else if (['lastlogin', 'ultimologin'].indexOf(key) >= 0) {
      user.lastLogin = value instanceof Date ? value : (value ? new Date(value) : null);
    } else if (['status', 'active', 'ativo'].indexOf(key) >= 0) {
      user.status = String(value || 'ATIVO').trim();
    } else {
      user[header] = value;
    }
  });
  return user;
};
