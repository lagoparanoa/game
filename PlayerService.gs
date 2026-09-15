/**
 * @file PlayerService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Serviço completo de CRUD para gerenciamento de jogadores (players).
 *              Gerencia perfis, recursos (água e comida), níveis, pontuações de sustentabilidade
 *              e relacionamentos com usuários e vilas.
 * 
 * @context Integração da lógica técnica robusta (V1) com a narrativa do DF (V2).
 *          Todo o CRUD é processado na planilha via SPREADSHEETS_ID.
 *          Alinhado ao schema definido em SchemaService.gs.
 * 
 * @schema Jogadores
 * - playerId: String (PK, formato P-XXX)
 * - userId: String (FK -> Usuarios.userId)
 * - villageId: String (FK -> Vilas.villageId)
 * - playerName: String
 * - level: Number (>=1)
 * - waterCredits: Number (>=0)
 * - foodUnits: Number (>=0)
 * - sustainabilityScore: Number (0-100)
 * - lastActivity: Date
 * - status: Enum ('ATIVO' | 'INATIVO')
 * - experiencePoints: Number (>=0; separado dos créditos de água)
 * 
 * @principais_funcionalidades
 * - createPlayer(userData): Cria novo jogador vinculado a usuário
 * - getPlayerById(playerId): Busca jogador por ID
 * - getPlayerByUserId(userId): Busca jogador por ID de usuário
 * - getPlayersByVillage(villageId): Lista jogadores de uma vila
 * - updatePlayer(playerId, data): Atualiza dados do jogador
 * - updateResources(playerId, waterDelta, foodDelta): Atualiza recursos
 * - levelUp(playerId): Aumenta nível do jogador
 * - updateSustainabilityScore(playerId, score): Atualiza pontuação
 * - deactivatePlayer(playerId): Desativa jogador
 * - reactivatePlayer(playerId): Reativa jogador
 * - getAllPlayers(activeOnly): Lista todos jogadores
 * - getPlayerStats(playerId): Retorna estatísticas completas
 */

function PlayerService() {
  Logger.log("Iniciando componente: PlayerService.gs");
}

/**
 * Cria um novo jogador
 */
PlayerService.createPlayer = function(data) {
  try {
    // Validações básicas
    if (!data.userId || !data.playerName) {
      return { success: false, error: 'userId e playerName são obrigatórios' };
    }

    // Validação de regra de negócio: usuário não pode ter jogador
    const userHasNoPlayer = ValidationService.validateBusinessRule('USER_HAS_NO_PLAYER', {
      userId: data.userId
    });
    if (!userHasNoPlayer.valid) {
      return { success: false, error: userHasNoPlayer.error };
    }

    // Validação de FK: userId deve existir
    if (!ValidationService.validateForeignKey(Config.SHEETS.USERS, 'userId', data.userId)) {
      return { success: false, error: 'Usuário não encontrado: ' + data.userId };
    }

    // Validação de FK: villageId deve existir (se fornecido)
    if (data.villageId && !ValidationService.validateForeignKey(Config.SHEETS.VILLAGES, 'villageId', data.villageId)) {
      return { success: false, error: 'Vila não encontrada: ' + data.villageId };
    }

    // Validação de vila ativa (se fornecido)
    if (data.villageId) {
      const villageActive = ValidationService.validateBusinessRule('VILLAGE_IS_ACTIVE', {
        villageId: data.villageId
      });
      if (!villageActive.valid) {
        return { success: false, error: villageActive.error };
      }

      // Validação de limite de jogadores
      const maxPlayers = ValidationService.validateBusinessRule('MAX_PLAYERS_PER_VILLAGE', {
        villageId: data.villageId
      });
      if (!maxPlayers.valid) {
        return { success: false, error: maxPlayers.error };
      }
    }

    // Gera ID único
    const playerId = PlayerService.generatePlayerId();

    // Prepara dados do jogador
    const playerData = {
      playerId: playerId,
      userId: data.userId,
      villageId: data.villageId || null,
      playerName: String(data.playerName).trim(),
      level: Number(data.level) || 1,
      waterCredits: Number(data.waterCredits) || Config.INITIAL_WATER_CREDITS,
      foodUnits: Number(data.foodUnits) || Config.INITIAL_FOOD_UNITS,
      sustainabilityScore: Number(data.sustainabilityScore) || 50,
      lastActivity: new Date(),
      status: 'ATIVO',
      experiencePoints: Math.max(0, Number(data.experiencePoints) || 0)
    };

    // Insere por nome de cabeçalho para respeitar colunas legadas e migrações
    const sheet = Config.getSheet(Config.SHEETS.PLAYERS);
    const headerValues = sheet.getDataRange().getValues();
    const headers = headerValues.length ? headerValues[0] : [];
    if (!headers.length || headers.indexOf('playerId') === -1) {
      return { success: false, error: 'Schema de Jogadores ausente ou inválido; execute a migração aditiva' };
    }
    const row = PlayerService.buildRowByHeaders(headers, playerData, []);

    sheet.appendRow(row);

    // Log de auditoria
    AuditLog.logEvent('PLAYER_CREATED', {
      playerId: playerId,
      userId: data.userId,
      villageId: data.villageId
    });

    return { success: true, player: playerData };
  } catch (error) {
    ErrorHandler.logError('PlayerService.createPlayer', error, data);
    return { success: false, error: error.message };
  }
};

/**
 * Busca jogador por ID
 */
PlayerService.getPlayerById = function(playerId) {
  try {
    if (!playerId) {
      return null;
    }

    const sheet = Config.getSheet(Config.SHEETS.PLAYERS);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return null;
    }

    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const player = PlayerService.mapRow(headers, row);
      
      if (player.playerId === playerId) {
        return player;
      }
    }

    return null;
  } catch (error) {
    ErrorHandler.logError('PlayerService.getPlayerById', error, { playerId });
    return null;
  }
};

/**
 * Busca jogador por ID de usuário
 */
PlayerService.getPlayerByUserId = function(userId) {
  try {
    if (!userId) {
      return null;
    }

    const sheet = Config.getSheet(Config.SHEETS.PLAYERS);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return null;
    }

    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const player = PlayerService.mapRow(headers, row);
      
      if (player.userId === userId) {
        return player;
      }
    }

    return null;
  } catch (error) {
    ErrorHandler.logError('PlayerService.getPlayerByUserId', error, { userId });
    return null;
  }
};

/**
 * Lista jogadores de uma vila específica
 */
PlayerService.getPlayersByVillage = function(villageId) {
  try {
    if (!villageId) {
      return [];
    }

    const sheet = Config.getSheet(Config.SHEETS.PLAYERS);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return [];
    }

    const headers = values[0];
    const players = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const player = PlayerService.mapRow(headers, row);
      
      if (player.villageId === villageId) {
        players.push(player);
      }
    }

    return players;
  } catch (error) {
    ErrorHandler.logError('PlayerService.getPlayersByVillage', error, { villageId });
    return [];
  }
};

/**
 * Lista todos os jogadores
 */
PlayerService.getAllPlayers = function(activeOnly) {
  try {
    activeOnly = activeOnly !== false; // Default: true

    const sheet = Config.getSheet(Config.SHEETS.PLAYERS);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return [];
    }

    const headers = values[0];
    const players = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const player = PlayerService.mapRow(headers, row);
      
      if (!activeOnly || player.status === 'ATIVO') {
        players.push(player);
      }
    }

    return players;
  } catch (error) {
    ErrorHandler.logError('PlayerService.getAllPlayers', error);
    return [];
  }
};

/**
 * Atualiza dados do jogador
 */
PlayerService.updatePlayer = function(playerId, data) {
  try {
    if (!playerId) {
      return { success: false, error: 'playerId é obrigatório' };
    }

    const sheet = Config.getSheet(Config.SHEETS.PLAYERS);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return { success: false, error: 'Jogador não encontrado' };
    }

    const headers = values[0];
    let rowIndex = -1;
    let currentPlayer = null;

    // Busca jogador
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const player = PlayerService.mapRow(headers, row);
      
      if (player.playerId === playerId) {
        rowIndex = i + 1; // +1 para índice base-1 do Sheets
        currentPlayer = player;
        break;
      }
    }

    if (rowIndex === -1) {
      return { success: false, error: 'Jogador não encontrado' };
    }

    // Atualiza apenas campos fornecidos
    const updatedPlayer = {
      playerId: currentPlayer.playerId,
      userId: currentPlayer.userId,
      villageId: data.villageId !== undefined ? data.villageId : currentPlayer.villageId,
      playerName: data.playerName !== undefined ? String(data.playerName).trim() : currentPlayer.playerName,
      level: data.level !== undefined ? Number(data.level) : currentPlayer.level,
      waterCredits: data.waterCredits !== undefined ? Number(data.waterCredits) : currentPlayer.waterCredits,
      foodUnits: data.foodUnits !== undefined ? Number(data.foodUnits) : currentPlayer.foodUnits,
      sustainabilityScore: data.sustainabilityScore !== undefined ? Number(data.sustainabilityScore) : currentPlayer.sustainabilityScore,
      lastActivity: new Date(),
      status: data.status !== undefined ? data.status : currentPlayer.status,
      experiencePoints: data.experiencePoints !== undefined
        ? Math.max(0, Number(data.experiencePoints) || 0)
        : currentPlayer.experiencePoints
    };

    // Preserva colunas desconhecidas e escreve os campos pela posição real do cabeçalho.
    const originalRow = values[rowIndex - 1] || [];
    const row = PlayerService.buildRowByHeaders(headers, updatedPlayer, originalRow);

    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);

    // Log de auditoria
    AuditLog.logEvent('PLAYER_UPDATED', {
      playerId: playerId,
      changes: data
    });

    return { success: true, player: updatedPlayer };
  } catch (error) {
    ErrorHandler.logError('PlayerService.updatePlayer', error, { playerId, data });
    return { success: false, error: error.message };
  }
};

/**
 * Atualiza recursos do jogador (água e comida)
 */
PlayerService.updateResources = function(playerId, waterDelta, foodDelta) {
  try {
    const player = PlayerService.getPlayerById(playerId);
    
    if (!player) {
      return { success: false, error: 'Jogador não encontrado' };
    }

    const newWater = Math.max(0, player.waterCredits + (Number(waterDelta) || 0));
    const newFood = Math.max(0, player.foodUnits + (Number(foodDelta) || 0));

    return PlayerService.updatePlayer(playerId, {
      waterCredits: newWater,
      foodUnits: newFood
    });
  } catch (error) {
    ErrorHandler.logError('PlayerService.updateResources', error, { playerId, waterDelta, foodDelta });
    return { success: false, error: error.message };
  }
};

/**
 * Aumenta nível do jogador
 */
PlayerService.levelUp = function(playerId) {
  try {
    const player = PlayerService.getPlayerById(playerId);
    
    if (!player) {
      return { success: false, error: 'Jogador não encontrado' };
    }

    const result = PlayerService.updatePlayer(playerId, {
      level: player.level + 1
    });

    if (result.success) {
      AuditLog.logEvent('PLAYER_LEVEL_UP', {
        playerId: playerId,
        newLevel: player.level + 1
      });
    }

    return result;
  } catch (error) {
    ErrorHandler.logError('PlayerService.levelUp', error, { playerId });
    return { success: false, error: error.message };
  }
};

/**
 * Atualiza pontuação de sustentabilidade
 */
PlayerService.updateSustainabilityScore = function(playerId, score) {
  try {
    score = Math.max(0, Math.min(100, Number(score) || 0)); // Clamp entre 0-100

    return PlayerService.updatePlayer(playerId, {
      sustainabilityScore: score
    });
  } catch (error) {
    ErrorHandler.logError('PlayerService.updateSustainabilityScore', error, { playerId, score });
    return { success: false, error: error.message };
  }
};

/**
 * Desativa jogador
 */
PlayerService.deactivatePlayer = function(playerId) {
  try {
    const result = PlayerService.updatePlayer(playerId, {
      status: 'INATIVO'
    });

    if (result.success) {
      AuditLog.logEvent('PLAYER_DEACTIVATED', { playerId });
    }

    return result;
  } catch (error) {
    ErrorHandler.logError('PlayerService.deactivatePlayer', error, { playerId });
    return { success: false, error: error.message };
  }
};

/**
 * Reativa jogador
 */
PlayerService.reactivatePlayer = function(playerId) {
  try {
    const result = PlayerService.updatePlayer(playerId, {
      status: 'ATIVO'
    });

    if (result.success) {
      AuditLog.logEvent('PLAYER_REACTIVATED', { playerId });
    }

    return result;
  } catch (error) {
    ErrorHandler.logError('PlayerService.reactivatePlayer', error, { playerId });
    return { success: false, error: error.message };
  }
};

/**
 * Retorna estatísticas completas do jogador
 */
PlayerService.getPlayerStats = function(playerId) {
  try {
    const player = PlayerService.getPlayerById(playerId);
    
    if (!player) {
      return null;
    }

    // Busca dados da vila se vinculado
    let village = null;
    if (player.villageId) {
      village = VillageService.getVillageById(player.villageId);
    }

    return {
      player: player,
      village: village,
      resources: {
        water: player.waterCredits,
        food: player.foodUnits,
        waterStatus: PlayerService.getResourceStatus(player.waterCredits, Config.INITIAL_WATER_CREDITS),
        foodStatus: PlayerService.getResourceStatus(player.foodUnits, Config.INITIAL_FOOD_UNITS)
      },
      performance: {
        level: player.level,
        sustainabilityScore: player.sustainabilityScore,
        sustainabilityRating: PlayerService.getSustainabilityRating(player.sustainabilityScore)
      },
      activity: {
        lastActivity: player.lastActivity,
        isActive: player.status === 'ATIVO'
      }
    };
  } catch (error) {
    ErrorHandler.logError('PlayerService.getPlayerStats', error, { playerId });
    return null;
  }
};

/**
 * Mapeia linha da planilha para objeto jogador
 */
PlayerService.mapRow = function(headers, row) {
  const player = {};
  
  headers.forEach(function(header, index) {
    const key = String(header || '').trim().toLowerCase();
    const value = row[index];
    
    if (key === 'playerid') {
      player.playerId = String(value || '').trim();
    } else if (key === 'userid') {
      player.userId = String(value || '').trim();
    } else if (key === 'villageid') {
      player.villageId = value ? String(value).trim() : null;
    } else if (key === 'playername') {
      player.playerName = String(value || '').trim();
    } else if (key === 'level') {
      player.level = Number(value) || 1;
    } else if (key === 'watercredits') {
      player.waterCredits = Number(value) || 0;
    } else if (key === 'foodunits') {
      player.foodUnits = Number(value) || 0;
    } else if (key === 'sustainabilityscore') {
      player.sustainabilityScore = Number(value) || 0;
    } else if (key === 'experiencepoints') {
      player.experiencePoints = value === '' || value === null || value === undefined
        ? null
        : Math.max(0, Number(value) || 0);
    } else if (key === 'lastactivity') {
      player.lastActivity = value instanceof Date ? value : new Date(value);
    } else if (key === 'status') {
      player.status = String(value || 'ATIVO').trim();
    } else {
      player[header] = value;
    }
  });
  
  return player;
};

/**
 * Monta uma linha segundo os cabeçalhos reais, preservando colunas legadas.
 * Campos desconhecidos nunca são deslocados ou apagados por uma atualização.
 */
PlayerService.buildRowByHeaders = function(headers, player, existingRow) {
  const source = player || {};
  const previous = Array.isArray(existingRow) ? existingRow : [];
  return headers.map(function(header, index) {
    const canonical = {
      playerid: 'playerId',
      userid: 'userId',
      villageid: 'villageId',
      playername: 'playerName',
      level: 'level',
      watercredits: 'waterCredits',
      foodunits: 'foodUnits',
      sustainabilityscore: 'sustainabilityScore',
      lastactivity: 'lastActivity',
      status: 'status',
      experiencepoints: 'experiencePoints'
    }[String(header || '').trim().toLowerCase()];

    if (canonical && Object.prototype.hasOwnProperty.call(source, canonical)) {
      const value = source[canonical];
      return value === null || value === undefined ? '' : value;
    }
    return index < previous.length ? previous[index] : '';
  });
};

/**
 * Gera ID único para jogador
 */
PlayerService.generatePlayerId = function() {
  try {
    const sheet = Config.getSheet(Config.SHEETS.PLAYERS);
    const lastRow = sheet.getLastRow();
    const nextNumber = Math.max(100, lastRow); // Mínimo P-100
    
    return 'P-' + String(nextNumber).padStart(3, '0');
  } catch (error) {
    ErrorHandler.logError('PlayerService.generatePlayerId', error);
    return 'P-' + Date.now();
  }
};

/**
 * Avalia status de recurso
 */
PlayerService.getResourceStatus = function(current, initial) {
  const ratio = current / initial;
  
  if (ratio >= 0.8) return 'ABUNDANTE';
  if (ratio >= 0.5) return 'ADEQUADO';
  if (ratio >= 0.3) return 'BAIXO';
  return 'CRÍTICO';
};

/**
 * Avalia rating de sustentabilidade
 */
PlayerService.getSustainabilityRating = function(score) {
  if (score >= 90) return 'EXEMPLAR';
  if (score >= 75) return 'MUITO_BOM';
  if (score >= 60) return 'BOM';
  if (score >= 40) return 'REGULAR';
  return 'INSUFICIENTE';
};

/**
 * Função de teste
 */
function testPlayerService() {
  Logger.log('=== Testando PlayerService ===');
  
  // Teste de criação
  Logger.log('1. Criando jogador...');
  const result = PlayerService.createPlayer({
    userId: 'U-TEST-001',
    playerName: 'Jogador Teste',
    villageId: 'V-01',
    waterCredits: 1500,
    foodUnits: 800
  });
  Logger.log('Resultado: ' + JSON.stringify(result));
  
  if (result.success) {
    const playerId = result.player.playerId;
    
    // Teste de busca
    Logger.log('2. Buscando jogador...');
    const player = PlayerService.getPlayerById(playerId);
    Logger.log('Jogador encontrado: ' + JSON.stringify(player));
    
    // Teste de atualização de recursos
    Logger.log('3. Atualizando recursos...');
    const updateResult = PlayerService.updateResources(playerId, -100, 50);
    Logger.log('Resultado: ' + JSON.stringify(updateResult));
    
    // Teste de level up
    Logger.log('4. Aumentando nível...');
    const levelResult = PlayerService.levelUp(playerId);
    Logger.log('Resultado: ' + JSON.stringify(levelResult));
    
    // Teste de estatísticas
    Logger.log('5. Buscando estatísticas...');
    const stats = PlayerService.getPlayerStats(playerId);
    Logger.log('Stats: ' + JSON.stringify(stats));
  }
  
  Logger.log('=== Teste concluído ===');
}
