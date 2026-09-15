/**
 * @file ValidationService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Serviço centralizado de validação automática baseado em schemas.
 *              Valida tipos de dados, ranges, enums, formatos, unicidade,
 *              chaves estrangeiras e regras de negócio.
 * 
 * @context Este serviço elimina duplicação de código de validação, garantindo
 *          consistência em todas as operações de CRUD. Utiliza os schemas
 *          definidos em SchemaService.gs como fonte única da verdade.
 * 
 * @principais_funcionalidades
 * - validateField(fieldName, value, rules): Valida campo individual
 * - validateObject(schemaName, data, mode): Valida objeto completo
 * - validateForeignKey(tableName, keyField, keyValue): Valida FK
 * - validateUniqueness(tableName, field, value, excludeId): Valida unicidade
 * - validateEnum(value, allowedValues): Valida enum
 * - validateRange(value, min, max): Valida range numérico
 * - validateFormat(value, format): Valida formato (email, date, ID)
 * - validateBusinessRule(ruleName, data): Valida regras de negócio
 * - getValidationErrors(schemaName, data): Retorna lista de erros
 * 
 * @modos_de_validacao
 * - 'create': Valida criação (todos campos obrigatórios)
 * - 'update': Valida atualização (apenas campos fornecidos)
 * - 'partial': Valida parcial (sem obrigatoriedade)
 */

function ValidationService() {
  Logger.log("Iniciando componente: ValidationService.gs");
}

// Constantes de validação
ValidationService.FORMATS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  USER_ID: /^U-\d{3,}$/,
  PLAYER_ID: /^P-\d{3,}$/,
  VILLAGE_ID: /^V-\d{2,}$/,
  CROP_ID: /^C-\d{2,}$/,
  TRANSACTION_ID: /^T-\d{3,}$/,
  EVENT_ID: /^E-\d{3,}$/
};

ValidationService.VALID_ENUMS = {
  USER_ROLE: ['admin', 'educator', 'player'],
  USER_STATUS: ['ATIVO', 'INATIVO', 'SUSPENSO'],
  PLAYER_STATUS: ['ATIVO', 'INATIVO'],
  VILLAGE_STATUS: ['ATIVA', 'INATIVA'],
  VILLAGE_REGION: ['Norte', 'Sul', 'Leste', 'Oeste'],
  CLIMATE_STATUS: ['NORMAL', 'SECA', 'CHUVA_INTENSA'],
  AQUIFER_STATUS: ['ESTÁVEL', 'ALERTA', 'CRÍTICO'],
  CROP_STATUS: ['ATIVO', 'DESCONTINUADO'],
  TRANSACTION_TYPE: ['COMPRA', 'VENDA'],
  EVENT_IMPACT: ['BAIXO', 'MÉDIO', 'ALTO'],
  EVENT_STATUS: ['PLANEJADO', 'CONFIRMADO', 'REALIZADO', 'CANCELADO']
};

/**
 * Valida um objeto completo baseado no schema
 */
ValidationService.validateObject = function(schemaName, data, mode) {
  mode = mode || 'create';
  
  try {
    const schema = SchemaService.SCHEMA[schemaName];
    
    if (!schema) {
      return {
        valid: false,
        errors: ['Schema não encontrado: ' + schemaName]
      };
    }

    const errors = [];
    const rules = ValidationService.getSchemaRules(schemaName);

    // Validar cada campo
    schema.headers.forEach(function(fieldName) {
      const value = data[fieldName];
      const fieldRules = rules[fieldName] || {};

      // Em modo 'create', campos obrigatórios devem estar presentes
      if (mode === 'create' && fieldRules.required && (value === undefined || value === null || value === '')) {
        errors.push('Campo obrigatório ausente: ' + fieldName);
        return;
      }

      // Em modo 'update', só valida campos fornecidos
      if (mode === 'update' && (value === undefined || value === null)) {
        return;
      }

      // Validar campo
      const fieldValidation = ValidationService.validateField(fieldName, value, fieldRules);
      if (!fieldValidation.valid) {
        errors.push.apply(errors, fieldValidation.errors);
      }
    });

    return {
      valid: errors.length === 0,
      errors: errors
    };
  } catch (error) {
    ErrorHandler.logError('ValidationService.validateObject', error, { schemaName, data, mode });
    return {
      valid: false,
      errors: ['Erro na validação: ' + error.message]
    };
  }
};

/**
 * Valida um campo individual
 */
ValidationService.validateField = function(fieldName, value, rules) {
  const errors = [];

  try {
    // Tipo
    if (rules.type && !ValidationService.validateType(value, rules.type)) {
      errors.push(fieldName + ': tipo inválido (esperado: ' + rules.type + ')');
    }

    // Enum
    if (rules.enum && !ValidationService.validateEnum(value, rules.enum)) {
      errors.push(fieldName + ': valor inválido (permitidos: ' + rules.enum.join(', ') + ')');
    }

    // Range
    if (rules.min !== undefined && Number(value) < rules.min) {
      errors.push(fieldName + ': valor mínimo é ' + rules.min);
    }
    if (rules.max !== undefined && Number(value) > rules.max) {
      errors.push(fieldName + ': valor máximo é ' + rules.max);
    }

    // Comprimento de string
    if (rules.minLength && String(value).length < rules.minLength) {
      errors.push(fieldName + ': comprimento mínimo é ' + rules.minLength);
    }
    if (rules.maxLength && String(value).length > rules.maxLength) {
      errors.push(fieldName + ': comprimento máximo é ' + rules.maxLength);
    }

    // Formato
    if (rules.format && !ValidationService.validateFormat(value, rules.format)) {
      errors.push(fieldName + ': formato inválido');
    }

    // Unicidade
    if (rules.unique && rules.tableName) {
      const isUnique = ValidationService.validateUniqueness(
        rules.tableName,
        fieldName,
        value,
        rules.excludeId
      );
      if (!isUnique) {
        errors.push(fieldName + ': valor já existe no sistema');
      }
    }

    // Chave estrangeira
    if (rules.foreignKey) {
      const fkValid = ValidationService.validateForeignKey(
        rules.foreignKey.table,
        rules.foreignKey.field,
        value
      );
      if (!fkValid) {
        errors.push(fieldName + ': referência inválida');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  } catch (error) {
    ErrorHandler.logError('ValidationService.validateField', error, { fieldName, value, rules });
    return {
      valid: false,
      errors: [fieldName + ': erro na validação']
    };
  }
};

/**
 * Valida tipo de dado
 */
ValidationService.validateType = function(value, type) {
  if (value === null || value === undefined) {
    return true; // Null/undefined são tratados em 'required'
  }

  switch (type.toLowerCase()) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'date':
      return value instanceof Date && !isNaN(value.getTime());
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return true;
  }
};

/**
 * Valida enum
 */
ValidationService.validateEnum = function(value, allowedValues) {
  if (value === null || value === undefined || value === '') {
    return true;
  }
  return allowedValues.indexOf(String(value)) !== -1;
};

/**
 * Valida range numérico
 */
ValidationService.validateRange = function(value, min, max) {
  const num = Number(value);
  if (isNaN(num)) {
    return false;
  }
  if (min !== undefined && num < min) {
    return false;
  }
  if (max !== undefined && num > max) {
    return false;
  }
  return true;
};

/**
 * Valida formato
 */
ValidationService.validateFormat = function(value, format) {
  if (value === null || value === undefined || value === '') {
    return true;
  }

  const str = String(value);

  // Formato de email
  if (format === 'email') {
    return ValidationService.FORMATS.EMAIL.test(str);
  }

  // Formato de ID
  if (ValidationService.FORMATS[format]) {
    return ValidationService.FORMATS[format].test(str);
  }

  return true;
};

ValidationService.validateEmail = function(email) {
  if (!email || !ValidationService.validateFormat(email, 'email')) {
    throw new Error('Email inválido. Use um formato correto como usuario@dominio.com');
  }
  return true;
};

ValidationService.validateUsername = function(username) {
  if (!username) {
    throw new Error('Usuário obrigatório. Informe um nome de usuário.');
  }
  const trimmed = String(username).trim();
  if (trimmed.length < Config.VALIDATION.MIN_USERNAME_LENGTH || trimmed.length > Config.VALIDATION.MAX_USERNAME_LENGTH) {
    throw new Error('Usuário deve ter entre ' + Config.VALIDATION.MIN_USERNAME_LENGTH + ' e ' + Config.VALIDATION.MAX_USERNAME_LENGTH + ' caracteres.');
  }
  if (/[^a-zA-Z0-9_\.\-]/.test(trimmed)) {
    throw new Error('Usuário só pode conter letras, números, sublinhado, ponto ou hífen.');
  }
  return true;
};

ValidationService.validatePassword = function(password) {
  if (!password) {
    throw new Error('Senha obrigatória. Informe uma senha segura.');
  }
  const value = String(password);
  if (value.length < Config.VALIDATION.MIN_PASSWORD_LENGTH) {
    throw new Error('Senha deve ter pelo menos ' + Config.VALIDATION.MIN_PASSWORD_LENGTH + ' caracteres.');
  }
  if (/\s/.test(value)) {
    throw new Error('Senha não pode conter espaços em branco.');
  }
  return true;
};

/**
 * Valida unicidade de valor em uma tabela
 */
ValidationService.validateUniqueness = function(tableName, fieldName, value, excludeId) {
  try {
    if (value === null || value === undefined || value === '') {
      return true;
    }

    const sheet = Config.getSheet(tableName);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return true; // Tabela vazia, valor é único
    }

    const headers = values[0];
    const fieldIndex = headers.findIndex(function(h) {
      return String(h).trim().toLowerCase() === String(fieldName).trim().toLowerCase();
    });

    if (fieldIndex === -1) {
      return true; // Campo não existe, consideramos válido
    }

    const searchValue = String(value).trim().toLowerCase();

    // Se tem excludeId, encontrar índice da coluna de ID
    let idIndex = -1;
    if (excludeId) {
      idIndex = headers.findIndex(function(h) {
        const key = String(h).trim().toLowerCase();
        return key.includes('id') && key !== 'userid' && key !== 'villageid' && key !== 'playerid' && key !== 'cropid';
      });
    }

    // Verificar duplicatas
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowValue = String(row[fieldIndex] || '').trim().toLowerCase();
      
      // Se for o registro a excluir, pular
      if (excludeId && idIndex !== -1 && String(row[idIndex]) === String(excludeId)) {
        continue;
      }

      if (rowValue === searchValue) {
        return false; // Valor duplicado
      }
    }

    return true;
  } catch (error) {
    ErrorHandler.logError('ValidationService.validateUniqueness', error, {
      tableName,
      fieldName,
      value
    });
    return true; // Em caso de erro, não bloquear operação
  }
};

/**
 * Valida chave estrangeira
 */
ValidationService.validateForeignKey = function(tableName, keyField, keyValue) {
  try {
    // Null é válido para FKs opcionais
    if (keyValue === null || keyValue === undefined || keyValue === '') {
      return true;
    }

    const sheet = Config.getSheet(tableName);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return false; // Tabela vazia, FK inválida
    }

    const headers = values[0];
    const keyIndex = headers.findIndex(function(h) {
      return String(h).trim().toLowerCase() === String(keyField).trim().toLowerCase();
    });

    if (keyIndex === -1) {
      return false; // Campo não existe
    }

    const searchValue = String(keyValue).trim();

    // Verificar se existe
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowValue = String(row[keyIndex] || '').trim();
      
      if (rowValue === searchValue) {
        return true; // Encontrado
      }
    }

    return false; // Não encontrado
  } catch (error) {
    ErrorHandler.logError('ValidationService.validateForeignKey', error, {
      tableName,
      keyField,
      keyValue
    });
    return true; // Em caso de erro, não bloquear operação
  }
};

/**
 * Valida regra de negócio
 */
ValidationService.validateBusinessRule = function(ruleName, data) {
  try {
    switch (ruleName) {
      case 'MAX_PLAYERS_PER_VILLAGE':
        return ValidationService.validateMaxPlayersPerVillage(data.villageId);
      
      case 'SUFFICIENT_RESOURCES':
        return ValidationService.validateSufficientResources(
          data.playerId,
          data.waterNeeded,
          data.foodNeeded
        );
      
      case 'VILLAGE_IS_ACTIVE':
        return ValidationService.validateVillageIsActive(data.villageId);
      
      case 'PLAYER_IS_ACTIVE':
        return ValidationService.validatePlayerIsActive(data.playerId);
      
      case 'USER_HAS_NO_PLAYER':
        return ValidationService.validateUserHasNoPlayer(data.userId);
      
      default:
        return { valid: true };
    }
  } catch (error) {
    ErrorHandler.logError('ValidationService.validateBusinessRule', error, { ruleName, data });
    return {
      valid: false,
      error: 'Erro na validação de regra: ' + error.message
    };
  }
};

/**
 * Valida limite de jogadores por vila
 */
ValidationService.validateMaxPlayersPerVillage = function(villageId) {
  try {
    if (!villageId) {
      return { valid: true };
    }

    const players = PlayerService.getPlayersByVillage(villageId);
    const activeCount = players.filter(function(p) { return p.status === 'ATIVO'; }).length;

    if (activeCount >= Config.MAX_PLAYERS_PER_VILLAGE) {
      return {
        valid: false,
        error: 'Vila atingiu o limite máximo de ' + Config.MAX_PLAYERS_PER_VILLAGE + ' jogadores'
      };
    }

    return { valid: true };
  } catch (error) {
    ErrorHandler.logError('ValidationService.validateMaxPlayersPerVillage', error, { villageId });
    return { valid: true };
  }
};

/**
 * Valida se jogador tem recursos suficientes
 */
ValidationService.validateSufficientResources = function(playerId, waterNeeded, foodNeeded) {
  try {
    const player = PlayerService.getPlayerById(playerId);
    
    if (!player) {
      return {
        valid: false,
        error: 'Jogador não encontrado'
      };
    }

    waterNeeded = Number(waterNeeded) || 0;
    foodNeeded = Number(foodNeeded) || 0;

    if (waterNeeded > 0 && player.waterCredits < waterNeeded) {
      return {
        valid: false,
        error: 'Água insuficiente (necessário: ' + waterNeeded + ', disponível: ' + player.waterCredits + ')'
      };
    }

    if (foodNeeded > 0 && player.foodUnits < foodNeeded) {
      return {
        valid: false,
        error: 'Comida insuficiente (necessário: ' + foodNeeded + ', disponível: ' + player.foodUnits + ')'
      };
    }

    return { valid: true };
  } catch (error) {
    ErrorHandler.logError('ValidationService.validateSufficientResources', error, {
      playerId,
      waterNeeded,
      foodNeeded
    });
    return { valid: true };
  }
};

/**
 * Valida se vila está ativa
 */
ValidationService.validateVillageIsActive = function(villageId) {
  try {
    if (!villageId) {
      return { valid: true };
    }

    const village = VillageService.getVillageById(villageId);
    
    if (!village) {
      return {
        valid: false,
        error: 'Vila não encontrada'
      };
    }

    if (village.status !== 'ATIVA') {
      return {
        valid: false,
        error: 'Vila está inativa'
      };
    }

    return { valid: true };
  } catch (error) {
    ErrorHandler.logError('ValidationService.validateVillageIsActive', error, { villageId });
    return { valid: true };
  }
};

/**
 * Valida se jogador está ativo
 */
ValidationService.validatePlayerIsActive = function(playerId) {
  try {
    const player = PlayerService.getPlayerById(playerId);
    
    if (!player) {
      return {
        valid: false,
        error: 'Jogador não encontrado'
      };
    }

    if (player.status !== 'ATIVO') {
      return {
        valid: false,
        error: 'Jogador está inativo'
      };
    }

    return { valid: true };
  } catch (error) {
    ErrorHandler.logError('ValidationService.validatePlayerIsActive', error, { playerId });
    return { valid: true };
  }
};

/**
 * Valida se usuário ainda não tem jogador
 */
ValidationService.validateUserHasNoPlayer = function(userId) {
  try {
    const existingPlayer = PlayerService.getPlayerByUserId(userId);
    
    if (existingPlayer) {
      return {
        valid: false,
        error: 'Usuário já possui um jogador'
      };
    }

    return { valid: true };
  } catch (error) {
    ErrorHandler.logError('ValidationService.validateUserHasNoPlayer', error, { userId });
    return { valid: true };
  }
};

/**
 * Retorna regras de validação para um schema
 */
ValidationService.getSchemaRules = function(schemaName) {
  const rules = {};

  switch (schemaName) {
    case 'Usuarios':
      rules.userId = {
        required: true,
        type: 'string',
        format: 'USER_ID',
        unique: true,
        tableName: Config.SHEETS.USERS
      };
      rules.username = {
        required: true,
        type: 'string',
        minLength: Config.VALIDATION.MIN_USERNAME_LENGTH,
        maxLength: Config.VALIDATION.MAX_USERNAME_LENGTH,
        unique: true,
        tableName: Config.SHEETS.USERS
      };
      rules.email = {
        required: true,
        type: 'string',
        format: 'email',
        unique: true,
        tableName: Config.SHEETS.USERS
      };
      rules.role = {
        required: true,
        type: 'string',
        enum: ValidationService.VALID_ENUMS.USER_ROLE
      };
      rules.password = {
        required: true,
        type: 'string',
        minLength: Config.VALIDATION.MIN_PASSWORD_LENGTH
      };
      rules.status = {
        required: false,
        type: 'string',
        enum: ValidationService.VALID_ENUMS.USER_STATUS
      };
      break;

    case 'Jogadores':
      rules.playerId = {
        required: true,
        type: 'string',
        format: 'PLAYER_ID',
        unique: true,
        tableName: Config.SHEETS.PLAYERS
      };
      rules.userId = {
        required: true,
        type: 'string',
        foreignKey: {
          table: Config.SHEETS.USERS,
          field: 'userId'
        }
      };
      rules.villageId = {
        required: false,
        type: 'string',
        foreignKey: {
          table: Config.SHEETS.VILLAGES,
          field: 'villageId'
        }
      };
      rules.playerName = {
        required: true,
        type: 'string',
        minLength: 3,
        maxLength: 50
      };
      rules.level = {
        required: false,
        type: 'number',
        min: 1
      };
      rules.waterCredits = {
        required: false,
        type: 'number',
        min: 0
      };
      rules.foodUnits = {
        required: false,
        type: 'number',
        min: 0
      };
      rules.sustainabilityScore = {
        required: false,
        type: 'number',
        min: 0,
        max: 100
      };
      rules.status = {
        required: false,
        type: 'string',
        enum: ValidationService.VALID_ENUMS.PLAYER_STATUS
      };
      break;

    case 'Vilas':
      rules.villageId = {
        required: true,
        type: 'string',
        format: 'VILLAGE_ID',
        unique: true,
        tableName: Config.SHEETS.VILLAGES
      };
      rules.name = {
        required: true,
        type: 'string',
        minLength: Config.VALIDATION.MIN_VILLAGE_NAME_LENGTH,
        maxLength: Config.VALIDATION.MAX_VILLAGE_NAME_LENGTH,
        unique: true,
        tableName: Config.SHEETS.VILLAGES
      };
      rules.region = {
        required: true,
        type: 'string',
        enum: ValidationService.VALID_ENUMS.VILLAGE_REGION
      };
      rules.population = {
        required: false,
        type: 'number',
        min: 0
      };
      rules.waterAllocation = {
        required: false,
        type: 'number',
        min: 0
      };
      rules.foodStock = {
        required: false,
        type: 'number',
        min: 0
      };
      rules.sustainabilityIndex = {
        required: false,
        type: 'number',
        min: 0,
        max: 100
      };
      rules.status = {
        required: false,
        type: 'string',
        enum: ValidationService.VALID_ENUMS.VILLAGE_STATUS
      };
      break;

    // Adicionar mais schemas conforme necessário
  }

  return rules;
};

/**
 * Retorna lista completa de erros de validação
 */
ValidationService.getValidationErrors = function(schemaName, data, mode) {
  const validation = ValidationService.validateObject(schemaName, data, mode);
  return validation.errors || [];
};

/**
 * Valida e retorna resultado formatado
 */
ValidationService.validate = function(schemaName, data, mode) {
  const validation = ValidationService.validateObject(schemaName, data, mode);
  
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      message: 'Validação falhou: ' + validation.errors.join('; ')
    };
  }

  return {
    success: true,
    message: 'Validação bem-sucedida'
  };
};

/**
 * Função de teste
 */
function testValidationService() {
  Logger.log('=== Testando ValidationService ===');

  // Teste 1: Validação de usuário válido
  Logger.log('\n1. Validando usuário válido...');
  const validUser = {
    userId: 'U-100',
    username: 'joao',
    email: 'joao@example.com',
    role: 'player',
    password: 'senha123',
    status: 'ATIVO'
  };
  const userValidation = ValidationService.validate('Usuarios', validUser, 'create');
  Logger.log('Resultado: ' + JSON.stringify(userValidation));

  // Teste 2: Validação de usuário inválido (email mal formatado)
  Logger.log('\n2. Validando usuário com email inválido...');
  const invalidUser = {
    userId: 'U-101',
    username: 'maria',
    email: 'email-invalido',
    role: 'player',
    password: '123',
    status: 'ATIVO'
  };
  const invalidValidation = ValidationService.validate('Usuarios', invalidUser, 'create');
  Logger.log('Resultado: ' + JSON.stringify(invalidValidation));

  // Teste 3: Validação de FK
  Logger.log('\n3. Validando FK (userId existe?)...');
  const fkValid = ValidationService.validateForeignKey(Config.SHEETS.USERS, 'userId', 'U-001');
  Logger.log('FK válida: ' + fkValid);

  // Teste 4: Validação de enum
  Logger.log('\n4. Validando enum de região...');
  const enumValid = ValidationService.validateEnum('Norte', ValidationService.VALID_ENUMS.VILLAGE_REGION);
  const enumInvalid = ValidationService.validateEnum('Centro', ValidationService.VALID_ENUMS.VILLAGE_REGION);
  Logger.log('Norte: ' + enumValid + ', Centro: ' + enumInvalid);

  // Teste 5: Validação de jogador
  Logger.log('\n5. Validando jogador...');
  const validPlayer = {
    playerId: 'P-200',
    userId: 'U-001',
    villageId: 'V-01',
    playerName: 'João Jogador',
    level: 1,
    waterCredits: 1000,
    foodUnits: 500,
    sustainabilityScore: 50,
    status: 'ATIVO'
  };
  const playerValidation = ValidationService.validate('Jogadores', validPlayer, 'create');
  Logger.log('Resultado: ' + JSON.stringify(playerValidation));

  // Teste 6: Validação de vila
  Logger.log('\n6. Validando vila...');
  const validVillage = {
    villageId: 'V-10',
    name: 'Vila Nova Teste',
    region: 'Sul',
    population: 0,
    waterAllocation: 5000,
    foodStock: 3000,
    sustainabilityIndex: 50,
    status: 'ATIVA'
  };
  const villageValidation = ValidationService.validate('Vilas', validVillage, 'create');
  Logger.log('Resultado: ' + JSON.stringify(villageValidation));

  // Teste 7: Validação de regra de negócio
  Logger.log('\n7. Validando regra de negócio (usuário sem jogador)...');
  const businessRule = ValidationService.validateBusinessRule('USER_HAS_NO_PLAYER', {
    userId: 'U-999'
  });
  Logger.log('Resultado: ' + JSON.stringify(businessRule));

  Logger.log('\n=== Teste concluído ===');
}
