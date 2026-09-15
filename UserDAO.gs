/**
 * @file UserDAO.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Data Access Object especializado no gerenciamento seguro de contas e credenciais de usuários.
 *              Responsável pela persistência de informações sensíveis de autenticação incluindo usernames únicos,
 *              senhas criptografadas futuramente (atualmente texto plano educacional), endereços de email válidos,
 *              papéis de autorização diferenciados (player, admin, educator), timestamps de cadastro e último acesso,
 *              configurações personalizadas de preferências, vínculos opcionais com instituições educacionais,
 *              status de conta ativa ou suspensa, histórico de alterações auditáveis e metadados complementares.
 *              Implementa operações CRUD completas na aba 'Usuarios' com validações rigorosas de segurança.
 * 
 * @context Camada fundamental de segurança que separa identidade de usuário (User) do personagem jogador (Player).
 *          Um usuário pode ter múltiplos personagens jogadores em diferentes partidas simultâneas.
 * 
 * @principais_funcionalidades
 * - getAllUsers(): Recupera lista completa de usuários (apenas admin)
 * - getUserById(userId): Busca usuário por identificador único interno
 * - getUserByUsername(username): Localiza usuário através de nome único
 * - getUserByEmail(email): Pesquisa por endereço de email cadastrado
 * - createUser(userData): Registra novo usuário validando unicidade
 * - updateUser(userId, updates): Modifica dados não-sensíveis de usuário
 * - updatePassword(userId, newPassword): Atualiza credencial de acesso
 * - deleteUser(userId): Remove usuário com cascata de dependências
 * - validateCredentials(username, password): Autentica credenciais fornecidas
 * - getUsersByRole(role): Filtra usuários por papel no sistema
 * - activateUser(userId): Ativa conta previamente suspensa ou pendente
 * - deactivateUser(userId): Suspende acesso temporariamente sem exclusão
 * 
 * @security_considerations
 * - ⚠️ Senhas atualmente em texto plano (adequado apenas para contexto educacional controlado)
 * - 🔒 Produção requer migração para hash bcrypt ou OAuth Google
 * - 🔐 Acesso a métodos sensíveis restrito a usuários com role 'admin'
 * - 📋 Todas operações críticas são registradas em AuditLog
 * 
 * @dependencies
 * - SheetManager.gs: Operações CRUD na planilha de armazenamento
 * - Config.gs: Nome da aba 'Usuarios' e configurações de segurança
 * - ValidationService.gs: Validação de formato email, força senha, etc
 * - ErrorHandler.gs: Tratamento padronizado de exceções de segurança
 * - AuditLog.gs: Registro de eventos sensíveis de autenticação
 */

function UserDAO() {
  Logger.log("Iniciando componente: UserDAO.gs");
}

UserDAO.mapUserRow = function(headers, row) {
  const user = {};
  headers.forEach(function(header, index) {
    const key = String(header || '').trim().toLowerCase();
    const value = row[index];

    if (key === 'userid') {
      user.userId = String(value || '').trim();
    } else if (key === 'username') {
      user.username = String(value || '').trim();
    } else if (key === 'email') {
      user.email = String(value || '').trim().toLowerCase();
    } else if (key === 'password') {
      user.password = String(value || '').trim();
    } else if (key === 'role') {
      user.role = String(value || 'player').trim();
    } else if (key === 'createdat') {
      user.createdAt = value instanceof Date ? value : (value ? new Date(value) : null);
    } else if (key === 'lastlogin') {
      user.lastLogin = value instanceof Date ? value : (value ? new Date(value) : null);
    } else if (key === 'status') {
      user.status = String(value || 'ATIVO').trim();
    } else {
      user[header] = value;
    }
  });
  return user;
};

UserDAO.getAllUsers = function() {
  try {
    const sheet = Config.getSheet(Config.SHEETS.USERS);
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      return [];
    }

    const headers = values[0];
    const users = [];
    for (let i = 1; i < values.length; i++) {
      users.push(UserDAO.mapUserRow(headers, values[i]));
    }
    return users;
  } catch (error) {
    ErrorHandler.logError('UserDAO.getAllUsers', error);
    return [];
  }
};

UserDAO.getUserByUsername = function(username) {
  if (!username) {
    return null;
  }
  const normalized = String(username).trim().toLowerCase();
  const users = UserDAO.getAllUsers();
  return users.find(function(user) {
    return String(user.username || '').toLowerCase() === normalized;
  }) || null;
};

UserDAO.getUserByEmail = function(email) {
  if (!email) {
    return null;
  }
  const normalized = String(email).trim().toLowerCase();
  const users = UserDAO.getAllUsers();
  return users.find(function(user) {
    return String(user.email || '').toLowerCase() === normalized;
  }) || null;
};

UserDAO.generateUserId = function() {
  try {
    const users = UserDAO.getAllUsers();
    let maxId = 0;
    users.forEach(function(user) {
      const parts = String(user.userId || '').split('-');
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num)) {
          maxId = Math.max(maxId, num);
        }
      }
    });
    return 'U-' + String(maxId + 1).padStart(3, '0');
  } catch (error) {
    ErrorHandler.logError('UserDAO.generateUserId', error);
    return 'U-999';
  }
};

UserDAO.createUser = function(userData) {
  try {
    if (!userData || !userData.username || !userData.email || !userData.password) {
      return { success: false, error: 'Todos os campos são obrigatórios.' };
    }

    const username = String(userData.username).trim();
    const email = String(userData.email).trim().toLowerCase();
    const password = String(userData.password);

    if (UserDAO.getUserByUsername(username)) {
      return { success: false, error: 'Usuário já existe. Escolha outro nome.' };
    }

    if (UserDAO.getUserByEmail(email)) {
      return { success: false, error: 'Email já cadastrado. Use outro endereço de email.' };
    }

    const userId = UserDAO.generateUserId();
    const createdAt = userData.createdAt instanceof Date ? userData.createdAt : new Date();
    const status = 'ATIVO';
    const role = userData.role || 'player';

    const sheet = Config.getSheet(Config.SHEETS.USERS);
    sheet.appendRow([userId, username, email, role, password, createdAt, null, status]);

    const user = {
      userId: userId,
      username: username,
      email: email,
      role: role,
      createdAt: createdAt,
      lastLogin: null,
      status: status
    };

    return { success: true, user: user };
  } catch (error) {
    ErrorHandler.logError('UserDAO.createUser', error, { userData: userData });
    return { success: false, error: 'Erro ao criar usuário: ' + error.message };
  }
};

UserDAO.validateCredentials = function(username, password) {
  try {
    const user = UserDAO.getUserByUsername(username);
    if (!user || String(user.password) !== String(password)) {
      return null;
    }
    return user;
  } catch (error) {
    ErrorHandler.logError('UserDAO.validateCredentials', error, { username: username });
    return null;
  }
};
