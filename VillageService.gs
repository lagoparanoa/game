/**
 * @file VillageService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Serviço completo de CRUD para gerenciamento de vilas (villages).
 *              Gerencia comunidades, recursos compartilhados, população,
 *              índices de sustentabilidade e alocação hídrica.
 * 
 * @context Integração da lógica técnica robusta (V1) com a narrativa do DF (V2).
 *          Todo o CRUD é processado na planilha via SPREADSHEETS_ID.
 *          Alinhado ao schema definido em SchemaService.gs.
 * 
 * @schema Vilas
 * - villageId: String (PK, formato V-XX)
 * - name: String (único, 3-30 chars)
 * - region: Enum ('Norte' | 'Sul' | 'Leste' | 'Oeste')
 * - population: Number (>0, número de jogadores)
 * - waterAllocation: Number (>=0, em litros)
 * - foodStock: Number (>=0, em unidades)
 * - sustainabilityIndex: Number (0-100)
 * - createdAt: Date
 * - status: Enum ('ATIVA' | 'INATIVA')
 * 
 * @principais_funcionalidades
 * - createVillage(data): Cria nova vila
 * - getVillageById(villageId): Busca vila por ID
 * - getVillageByName(name): Busca vila por nome
 * - getVillagesByRegion(region): Lista vilas de uma região
 * - getAllVillages(activeOnly): Lista todas vilas
 * - updateVillage(villageId, data): Atualiza dados da vila
 * - updateResources(villageId, waterDelta, foodDelta): Atualiza recursos
 * - updatePopulation(villageId): Recalcula população baseada em jogadores
 * - calculateSustainabilityIndex(villageId): Calcula índice de sustentabilidade
 * - deactivateVillage(villageId): Desativa vila
 * - reactivateVillage(villageId): Reativa vila
 * - getVillageStats(villageId): Retorna estatísticas completas
 * - getVillagePlayers(villageId): Lista jogadores da vila
 * - addPlayerToVillage(villageId, playerId): Vincula jogador à vila
 * - removePlayerFromVillage(playerId): Remove jogador da vila
 */

function VillageService() {
  Logger.log("Iniciando componente: VillageService.gs");
}

// Constantes
VillageService.VALID_REGIONS = ['Norte', 'Sul', 'Leste', 'Oeste'];

/**
 * Cria uma nova vila
 */
VillageService.createVillage = function(data) {
  try {
    // Validações básicas
    if (!data.name || !data.region) {
      return { success: false, error: 'name e region são obrigatórios' };
    }

    // Valida região usando ValidationService
    if (!ValidationService.validateEnum(data.region, ValidationService.VALID_ENUMS.VILLAGE_REGION)) {
      return { 
        success: false, 
        error: 'Região inválida. Use: ' + ValidationService.VALID_ENUMS.VILLAGE_REGION.join(', ')
      };
    }

    // Valida nome único
    if (!ValidationService.validateUniqueness(Config.SHEETS.VILLAGES, 'name', data.name)) {
      return { success: false, error: 'Já existe uma vila com este nome' };
    }

    // Gera ID único
    const villageId = VillageService.generateVillageId();

    // Prepara dados da vila
    const villageData = {
      villageId: villageId,
      name: String(data.name).trim(),
      region: data.region,
      population: Number(data.population) || 0,
      waterAllocation: Number(data.waterAllocation) || 0,
      foodStock: Number(data.foodStock) || 0,
      sustainabilityIndex: Number(data.sustainabilityIndex) || 50,
      createdAt: new Date(),
      status: 'ATIVA'
    };

    // Insere na planilha
    const sheet = Config.getSheet(Config.SHEETS.VILLAGES);
    const row = [
      villageData.villageId,
      villageData.name,
      villageData.region,
      villageData.population,
      villageData.waterAllocation,
      villageData.foodStock,
      villageData.sustainabilityIndex,
      villageData.createdAt,
      villageData.status
    ];

    sheet.appendRow(row);

    // Log de auditoria
    AuditLog.logEvent('VILLAGE_CREATED', {
      villageId: villageId,
      name: villageData.name,
      region: villageData.region
    });

    return { success: true, village: villageData };
  } catch (error) {
    ErrorHandler.logError('VillageService.createVillage', error, data);
    return { success: false, error: error.message };
  }
};

/**
 * Busca vila por ID
 */
VillageService.getVillageById = function(villageId) {
  try {
    if (!villageId) {
      return null;
    }

    const sheet = Config.getSheet(Config.SHEETS.VILLAGES);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return null;
    }

    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const village = VillageService.mapRow(headers, row);
      
      if (village.villageId === villageId) {
        return village;
      }
    }

    return null;
  } catch (error) {
    ErrorHandler.logError('VillageService.getVillageById', error, { villageId });
    return null;
  }
};

/**
 * Busca vila por nome
 */
VillageService.getVillageByName = function(name) {
  try {
    if (!name) {
      return null;
    }

    const sheet = Config.getSheet(Config.SHEETS.VILLAGES);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return null;
    }

    const headers = values[0];
    const searchName = String(name).trim().toLowerCase();
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const village = VillageService.mapRow(headers, row);
      
      if (village.name.toLowerCase() === searchName) {
        return village;
      }
    }

    return null;
  } catch (error) {
    ErrorHandler.logError('VillageService.getVillageByName', error, { name });
    return null;
  }
};

/**
 * Lista vilas de uma região específica
 */
VillageService.getVillagesByRegion = function(region) {
  try {
    if (!region) {
      return [];
    }

    const sheet = Config.getSheet(Config.SHEETS.VILLAGES);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return [];
    }

    const headers = values[0];
    const villages = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const village = VillageService.mapRow(headers, row);
      
      if (village.region === region) {
        villages.push(village);
      }
    }

    return villages;
  } catch (error) {
    ErrorHandler.logError('VillageService.getVillagesByRegion', error, { region });
    return [];
  }
};

/**
 * Lista todas as vilas
 */
VillageService.getAllVillages = function(activeOnly) {
  try {
    activeOnly = activeOnly !== false; // Default: true

    const sheet = Config.getSheet(Config.SHEETS.VILLAGES);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return [];
    }

    const headers = values[0];
    const villages = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const village = VillageService.mapRow(headers, row);
      
      if (!activeOnly || village.status === 'ATIVA') {
        villages.push(village);
      }
    }

    return villages;
  } catch (error) {
    ErrorHandler.logError('VillageService.getAllVillages', error);
    return [];
  }
};

/**
 * Atualiza dados da vila
 */
VillageService.updateVillage = function(villageId, data) {
  try {
    if (!villageId) {
      return { success: false, error: 'villageId é obrigatório' };
    }

    // Valida região se fornecida usando ValidationService
    if (data.region && !ValidationService.validateEnum(data.region, ValidationService.VALID_ENUMS.VILLAGE_REGION)) {
      return { 
        success: false, 
        error: 'Região inválida. Use: ' + ValidationService.VALID_ENUMS.VILLAGE_REGION.join(', ')
      };
    }

    const sheet = Config.getSheet(Config.SHEETS.VILLAGES);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return { success: false, error: 'Vila não encontrada' };
    }

    const headers = values[0];
    let rowIndex = -1;
    let currentVillage = null;

    // Busca vila
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const village = VillageService.mapRow(headers, row);
      
      if (village.villageId === villageId) {
        rowIndex = i + 1; // +1 para índice base-1 do Sheets
        currentVillage = village;
        break;
      }
    }

    if (rowIndex === -1) {
      return { success: false, error: 'Vila não encontrada' };
    }

    // Verifica nome único se mudando nome usando ValidationService
    if (data.name && data.name !== currentVillage.name) {
      if (!ValidationService.validateUniqueness(Config.SHEETS.VILLAGES, 'name', data.name, villageId)) {
        return { success: false, error: 'Já existe uma vila com este nome' };
      }
    }

    // Atualiza apenas campos fornecidos
    const updatedVillage = {
      villageId: currentVillage.villageId,
      name: data.name !== undefined ? String(data.name).trim() : currentVillage.name,
      region: data.region !== undefined ? data.region : currentVillage.region,
      population: data.population !== undefined ? Number(data.population) : currentVillage.population,
      waterAllocation: data.waterAllocation !== undefined ? Number(data.waterAllocation) : currentVillage.waterAllocation,
      foodStock: data.foodStock !== undefined ? Number(data.foodStock) : currentVillage.foodStock,
      sustainabilityIndex: data.sustainabilityIndex !== undefined ? Number(data.sustainabilityIndex) : currentVillage.sustainabilityIndex,
      createdAt: currentVillage.createdAt,
      status: data.status !== undefined ? data.status : currentVillage.status
    };

    // Atualiza na planilha
    const row = [
      updatedVillage.villageId,
      updatedVillage.name,
      updatedVillage.region,
      updatedVillage.population,
      updatedVillage.waterAllocation,
      updatedVillage.foodStock,
      updatedVillage.sustainabilityIndex,
      updatedVillage.createdAt,
      updatedVillage.status
    ];

    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);

    // Log de auditoria
    AuditLog.logEvent('VILLAGE_UPDATED', {
      villageId: villageId,
      changes: data
    });

    return { success: true, village: updatedVillage };
  } catch (error) {
    ErrorHandler.logError('VillageService.updateVillage', error, { villageId, data });
    return { success: false, error: error.message };
  }
};

/**
 * Atualiza recursos da vila (água e comida)
 */
VillageService.updateResources = function(villageId, waterDelta, foodDelta) {
  try {
    const village = VillageService.getVillageById(villageId);
    
    if (!village) {
      return { success: false, error: 'Vila não encontrada' };
    }

    const newWater = Math.max(0, village.waterAllocation + (Number(waterDelta) || 0));
    const newFood = Math.max(0, village.foodStock + (Number(foodDelta) || 0));

    return VillageService.updateVillage(villageId, {
      waterAllocation: newWater,
      foodStock: newFood
    });
  } catch (error) {
    ErrorHandler.logError('VillageService.updateResources', error, { villageId, waterDelta, foodDelta });
    return { success: false, error: error.message };
  }
};

/**
 * Recalcula população baseada em jogadores ativos
 */
VillageService.updatePopulation = function(villageId) {
  try {
    const players = PlayerService.getPlayersByVillage(villageId);
    const activeCount = players.filter(function(p) { return p.status === 'ATIVO'; }).length;

    return VillageService.updateVillage(villageId, {
      population: activeCount
    });
  } catch (error) {
    ErrorHandler.logError('VillageService.updatePopulation', error, { villageId });
    return { success: false, error: error.message };
  }
};

/**
 * Calcula índice de sustentabilidade baseado em métricas dos jogadores
 */
VillageService.calculateSustainabilityIndex = function(villageId) {
  try {
    const players = PlayerService.getPlayersByVillage(villageId);
    
    if (players.length === 0) {
      return VillageService.updateVillage(villageId, {
        sustainabilityIndex: 50
      });
    }

    // Média ponderada de sustentabilidade dos jogadores ativos
    const activePlayers = players.filter(function(p) { return p.status === 'ATIVO'; });
    
    if (activePlayers.length === 0) {
      return VillageService.updateVillage(villageId, {
        sustainabilityIndex: 50
      });
    }

    const totalScore = activePlayers.reduce(function(sum, p) {
      return sum + p.sustainabilityScore;
    }, 0);

    const averageScore = Math.round(totalScore / activePlayers.length);

    return VillageService.updateVillage(villageId, {
      sustainabilityIndex: averageScore
    });
  } catch (error) {
    ErrorHandler.logError('VillageService.calculateSustainabilityIndex', error, { villageId });
    return { success: false, error: error.message };
  }
};

/**
 * Desativa vila
 */
VillageService.deactivateVillage = function(villageId) {
  try {
    const result = VillageService.updateVillage(villageId, {
      status: 'INATIVA'
    });

    if (result.success) {
      AuditLog.logEvent('VILLAGE_DEACTIVATED', { villageId });
    }

    return result;
  } catch (error) {
    ErrorHandler.logError('VillageService.deactivateVillage', error, { villageId });
    return { success: false, error: error.message };
  }
};

/**
 * Reativa vila
 */
VillageService.reactivateVillage = function(villageId) {
  try {
    const result = VillageService.updateVillage(villageId, {
      status: 'ATIVA'
    });

    if (result.success) {
      AuditLog.logEvent('VILLAGE_REACTIVATED', { villageId });
    }

    return result;
  } catch (error) {
    ErrorHandler.logError('VillageService.reactivateVillage', error, { villageId });
    return { success: false, error: error.message };
  }
};

/**
 * Retorna estatísticas completas da vila
 */
VillageService.getVillageStats = function(villageId) {
  try {
    const village = VillageService.getVillageById(villageId);
    
    if (!village) {
      return null;
    }

    const players = PlayerService.getPlayersByVillage(villageId);
    const activePlayers = players.filter(function(p) { return p.status === 'ATIVO'; });

    // Calcula estatísticas agregadas
    const totalWaterCredits = activePlayers.reduce(function(sum, p) {
      return sum + p.waterCredits;
    }, 0);

    const totalFoodUnits = activePlayers.reduce(function(sum, p) {
      return sum + p.foodUnits;
    }, 0);

    const averageLevel = activePlayers.length > 0
      ? activePlayers.reduce(function(sum, p) { return sum + p.level; }, 0) / activePlayers.length
      : 0;

    return {
      village: village,
      population: {
        total: players.length,
        active: activePlayers.length,
        inactive: players.length - activePlayers.length
      },
      resources: {
        villageWater: village.waterAllocation,
        villageFood: village.foodStock,
        playersWater: totalWaterCredits,
        playersFood: totalFoodUnits,
        totalWater: village.waterAllocation + totalWaterCredits,
        totalFood: village.foodStock + totalFoodUnits
      },
      performance: {
        sustainabilityIndex: village.sustainabilityIndex,
        sustainabilityRating: VillageService.getSustainabilityRating(village.sustainabilityIndex),
        averageLevel: Math.round(averageLevel * 10) / 10
      },
      players: players
    };
  } catch (error) {
    ErrorHandler.logError('VillageService.getVillageStats', error, { villageId });
    return null;
  }
};

/**
 * Lista jogadores da vila
 */
VillageService.getVillagePlayers = function(villageId) {
  try {
    return PlayerService.getPlayersByVillage(villageId);
  } catch (error) {
    ErrorHandler.logError('VillageService.getVillagePlayers', error, { villageId });
    return [];
  }
};

/**
 * Vincula jogador à vila
 */
VillageService.addPlayerToVillage = function(villageId, playerId) {
  try {
    // Validação de FK: vila deve existir
    if (!ValidationService.validateForeignKey(Config.SHEETS.VILLAGES, 'villageId', villageId)) {
      return { success: false, error: 'Vila não encontrada' };
    }

    // Validação de regra: vila deve estar ativa
    const villageActive = ValidationService.validateBusinessRule('VILLAGE_IS_ACTIVE', {
      villageId: villageId
    });
    if (!villageActive.valid) {
      return { success: false, error: villageActive.error };
    }

    // Validação de regra: limite de jogadores
    const maxPlayers = ValidationService.validateBusinessRule('MAX_PLAYERS_PER_VILLAGE', {
      villageId: villageId
    });
    if (!maxPlayers.valid) {
      return { success: false, error: maxPlayers.error };
    }

    // Validação de FK: jogador deve existir
    if (!ValidationService.validateForeignKey(Config.SHEETS.PLAYERS, 'playerId', playerId)) {
      return { success: false, error: 'Jogador não encontrado' };
    }

    // Atualiza jogador
    const result = PlayerService.updatePlayer(playerId, {
      villageId: villageId
    });

    if (result.success) {
      // Atualiza população da vila
      VillageService.updatePopulation(villageId);
      
      AuditLog.logEvent('PLAYER_JOINED_VILLAGE', {
        playerId: playerId,
        villageId: villageId
      });
    }

    return result;
  } catch (error) {
    ErrorHandler.logError('VillageService.addPlayerToVillage', error, { villageId, playerId });
    return { success: false, error: error.message };
  }
};

/**
 * Remove jogador da vila
 */
VillageService.removePlayerFromVillage = function(playerId) {
  try {
    const player = PlayerService.getPlayerById(playerId);
    
    if (!player) {
      return { success: false, error: 'Jogador não encontrado' };
    }

    const oldVillageId = player.villageId;

    // Remove vinculação
    const result = PlayerService.updatePlayer(playerId, {
      villageId: null
    });

    if (result.success && oldVillageId) {
      // Atualiza população da vila antiga
      VillageService.updatePopulation(oldVillageId);
      
      AuditLog.logEvent('PLAYER_LEFT_VILLAGE', {
        playerId: playerId,
        villageId: oldVillageId
      });
    }

    return result;
  } catch (error) {
    ErrorHandler.logError('VillageService.removePlayerFromVillage', error, { playerId });
    return { success: false, error: error.message };
  }
};

/**
 * Mapeia linha da planilha para objeto vila
 */
VillageService.mapRow = function(headers, row) {
  const village = {};
  
  headers.forEach(function(header, index) {
    const key = String(header || '').trim().toLowerCase();
    const value = row[index];
    
    if (key === 'villageid') {
      village.villageId = String(value || '').trim();
    } else if (key === 'name') {
      village.name = String(value || '').trim();
    } else if (key === 'region') {
      village.region = String(value || '').trim();
    } else if (key === 'population') {
      village.population = Number(value) || 0;
    } else if (key === 'waterallocation') {
      village.waterAllocation = Number(value) || 0;
    } else if (key === 'foodstock') {
      village.foodStock = Number(value) || 0;
    } else if (key === 'sustainabilityindex') {
      village.sustainabilityIndex = Number(value) || 0;
    } else if (key === 'createdat') {
      village.createdAt = value instanceof Date ? value : new Date(value);
    } else if (key === 'status') {
      village.status = String(value || 'ATIVA').trim();
    } else {
      village[header] = value;
    }
  });
  
  return village;
};

/**
 * Gera ID único para vila
 */
VillageService.generateVillageId = function() {
  try {
    const sheet = Config.getSheet(Config.SHEETS.VILLAGES);
    const lastRow = sheet.getLastRow();
    const nextNumber = Math.max(1, lastRow);
    
    return 'V-' + String(nextNumber).padStart(2, '0');
  } catch (error) {
    ErrorHandler.logError('VillageService.generateVillageId', error);
    return 'V-' + Date.now();
  }
};

/**
 * Avalia rating de sustentabilidade
 */
VillageService.getSustainabilityRating = function(index) {
  if (index >= 90) return 'EXEMPLAR';
  if (index >= 75) return 'MUITO_BOM';
  if (index >= 60) return 'BOM';
  if (index >= 40) return 'REGULAR';
  return 'INSUFICIENTE';
};

/**
 * Função de teste
 */
function testVillageService() {
  Logger.log('=== Testando VillageService ===');
  
  // Teste de criação
  Logger.log('1. Criando vila...');
  const result = VillageService.createVillage({
    name: 'Vila Teste',
    region: 'Norte',
    waterAllocation: 5000,
    foodStock: 2500
  });
  Logger.log('Resultado: ' + JSON.stringify(result));
  
  if (result.success) {
    const villageId = result.village.villageId;
    
    // Teste de busca
    Logger.log('2. Buscando vila...');
    const village = VillageService.getVillageById(villageId);
    Logger.log('Vila encontrada: ' + JSON.stringify(village));
    
    // Teste de atualização de recursos
    Logger.log('3. Atualizando recursos...');
    const updateResult = VillageService.updateResources(villageId, -500, 300);
    Logger.log('Resultado: ' + JSON.stringify(updateResult));
    
    // Teste de estatísticas
    Logger.log('4. Buscando estatísticas...');
    const stats = VillageService.getVillageStats(villageId);
    Logger.log('Stats: ' + JSON.stringify(stats));
    
    // Teste de listagem por região
    Logger.log('5. Listando vilas da região Norte...');
    const northVillages = VillageService.getVillagesByRegion('Norte');
    Logger.log('Encontradas: ' + northVillages.length + ' vilas');
  }
  
  Logger.log('=== Teste concluído ===');
}
