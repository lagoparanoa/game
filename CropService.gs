/**
 * @file CropService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Serviço completo de CRUD para gerenciamento de culturas agrícolas.
 *              Gerencia catálogo de culturas adaptadas ao Cerrado, ciclos de crescimento,
 *              necessidades hídricas e rendimento por ciclo.
 * 
 * @context Integração da lógica técnica robusta (V1) com a narrativa do DF (V2).
 *          Todo o CRUD é processado na planilha via SPREADSHEETS_ID.
 *          Alinhado ao schema definido em SchemaService.gs.
 * 
 * @schema Culturas
 * - cropId: String (PK, formato C-XX)
 * - name: String (único)
 * - growthDays: Number (>0, dias até colheita)
 * - waterNeed: Number (>0, litros/dia)
 * - yieldPerCycle: Number (>0, unidades produzidas)
 * - status: Enum ('ATIVO' | 'DESCONTINUADO')
 * 
 * @principais_funcionalidades
 * - createCrop(data): Cria nova cultura
 * - getCropById(cropId): Busca cultura por ID
 * - getCropByName(name): Busca cultura por nome
 * - getAllCrops(activeOnly): Lista todas culturas
 * - updateCrop(cropId, data): Atualiza cultura
 * - deactivateCrop(cropId): Desativa cultura
 * - reactivateCrop(cropId): Reativa cultura
 * - calculateTotalWaterNeed(cropId): Calcula água total para ciclo
 * - getCropEfficiency(cropId): Calcula eficiência água/produção
 * - getSustainableCrops(): Lista culturas mais sustentáveis
 * - getCropStats(cropId): Retorna estatísticas da cultura
 */

function CropService() {
  Logger.log("Iniciando componente: CropService.gs");
}

/**
 * Cria uma nova cultura
 */
CropService.createCrop = function(data) {
  try {
    // Validações básicas
    if (!data.name || !data.growthDays || !data.waterNeed || !data.yieldPerCycle) {
      return { 
        success: false, 
        error: 'name, growthDays, waterNeed e yieldPerCycle são obrigatórios' 
      };
    }

    // Valida nome único
    if (!ValidationService.validateUniqueness(Config.SHEETS.CROPS, 'name', data.name)) {
      return { success: false, error: 'Já existe uma cultura com este nome' };
    }

    // Valida valores numéricos
    if (Number(data.growthDays) <= 0 || Number(data.waterNeed) <= 0 || Number(data.yieldPerCycle) <= 0) {
      return { 
        success: false, 
        error: 'growthDays, waterNeed e yieldPerCycle devem ser maiores que zero' 
      };
    }

    // Gera ID único
    const cropId = CropService.generateCropId();

    // Prepara dados da cultura
    const cropData = {
      cropId: cropId,
      name: String(data.name).trim(),
      growthDays: Number(data.growthDays),
      waterNeed: Number(data.waterNeed),
      yieldPerCycle: Number(data.yieldPerCycle),
      status: 'ATIVO'
    };

    // Insere na planilha
    const sheet = Config.getSheet(Config.SHEETS.CROPS);
    const row = [
      cropData.cropId,
      cropData.name,
      cropData.growthDays,
      cropData.waterNeed,
      cropData.yieldPerCycle,
      cropData.status
    ];

    sheet.appendRow(row);

    // Log de auditoria
    AuditLog.logEvent('CROP_CREATED', {
      cropId: cropId,
      name: cropData.name
    });

    return { success: true, crop: cropData };
  } catch (error) {
    ErrorHandler.logError('CropService.createCrop', error, data);
    return { success: false, error: error.message };
  }
};

/**
 * Busca cultura por ID
 */
CropService.getCropById = function(cropId) {
  try {
    if (!cropId) {
      return null;
    }

    const sheet = Config.getSheet(Config.SHEETS.CROPS);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return null;
    }

    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const crop = CropService.mapRow(headers, row);
      
      if (crop.cropId === cropId) {
        return crop;
      }
    }

    return null;
  } catch (error) {
    ErrorHandler.logError('CropService.getCropById', error, { cropId });
    return null;
  }
};

/**
 * Busca cultura por nome
 */
CropService.getCropByName = function(name) {
  try {
    if (!name) {
      return null;
    }

    const sheet = Config.getSheet(Config.SHEETS.CROPS);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return null;
    }

    const headers = values[0];
    const searchName = String(name).trim().toLowerCase();
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const crop = CropService.mapRow(headers, row);
      
      if (crop.name.toLowerCase() === searchName) {
        return crop;
      }
    }

    return null;
  } catch (error) {
    ErrorHandler.logError('CropService.getCropByName', error, { name });
    return null;
  }
};

/**
 * Lista todas as culturas
 */
CropService.getAllCrops = function(activeOnly) {
  try {
    activeOnly = activeOnly !== false; // Default: true

    const sheet = Config.getSheet(Config.SHEETS.CROPS);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return [];
    }

    const headers = values[0];
    const crops = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const crop = CropService.mapRow(headers, row);
      
      if (!activeOnly || crop.status === 'ATIVO') {
        crops.push(crop);
      }
    }

    return crops;
  } catch (error) {
    ErrorHandler.logError('CropService.getAllCrops', error);
    return [];
  }
};

CropService.getAvailableCrops = function() {
  return CropService.getAllCrops(true);
};

CropService.getPlayerCrops = function(playerId) {
  try {
    if (!playerId) {
      return [];
    }
    const plantings = CropService.getAllPlantings();
    return plantings.filter(function(planting) {
      return planting.playerId === playerId;
    });
  } catch (error) {
    ErrorHandler.logError('CropService.getPlayerCrops', error, { playerId });
    return [];
  }
};

CropService.plantCrop = function(playerId, cropId, quantity) {
  try {
    quantity = Number(quantity) || 1;
    if (!playerId || !cropId || quantity <= 0) {
      return { success: false, error: 'playerId, cropId e quantity são obrigatórios' };
    }

    const crop = CropService.getCropById(cropId);
    if (!crop || crop.status !== 'ATIVO') {
      return { success: false, error: 'Cultura não encontrada ou inativa' };
    }

    const player = PlayerService.getPlayerById(playerId);
    if (!player) {
      return { success: false, error: 'Jogador não encontrado' };
    }

    const waterUsed = crop.waterNeed * quantity;
    const plantingId = CropService.generatePlantingId();
    const plantedAt = new Date();
    const harvestDate = new Date(plantedAt.getTime() + crop.growthDays * 24 * 60 * 60 * 1000);

    const sheet = CropService.getPlantingsSheet();
    sheet.appendRow([
      plantingId,
      playerId,
      cropId,
      quantity,
      waterUsed,
      plantedAt,
      harvestDate,
      null,
      'ATIVO',
      'Plantio realizado'
    ]);

    AuditLog.logEvent('CROP_PLANTED', {
      plantingId: plantingId,
      playerId: playerId,
      cropId: cropId,
      quantity: quantity,
      waterUsed: waterUsed
    });

    return {
      success: true,
      plantingId: plantingId,
      harvestRound: crop.growthDays,
      crop: crop,
      waterUsed: waterUsed
    };
  } catch (error) {
    ErrorHandler.logError('CropService.plantCrop', error, { playerId, cropId, quantity });
    return { success: false, error: error.message };
  }
};

CropService.harvestCrop = function(plantingId, userId) {
  try {
    if (!plantingId || !userId) {
      return { success: false, error: 'plantingId e userId são obrigatórios' };
    }

    const sheet = CropService.getPlantingsSheet();
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      return { success: false, error: 'Plantio não encontrado' };
    }

    const headers = values[0];
    let rowIndex = -1;
    let planting = null;

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const current = CropService.mapPlantingRow(headers, row);
      if (current.plantingId === plantingId) {
        rowIndex = i + 1;
        planting = current;
        break;
      }
    }

    if (!planting) {
      return { success: false, error: 'Plantio não encontrado' };
    }

    const player = PlayerService.getPlayerById(planting.playerId);
    if (!player || player.userId !== userId) {
      return { success: false, error: 'Acesso negado ao plantio' };
    }

    if (planting.status === 'COLHIDO') {
      return { success: false, error: 'Plantio já foi colhido' };
    }

    const crop = CropService.getCropById(planting.cropId);
    if (!crop) {
      return { success: false, error: 'Cultura do plantio não encontrada' };
    }

    const yieldAmount = crop.yieldPerCycle * planting.quantity;
    const harvestedAt = new Date();

    sheet.getRange(rowIndex, 1, 1, 10).setValues([[
      planting.plantingId,
      planting.playerId,
      planting.cropId,
      planting.quantity,
      planting.waterUsed,
      planting.plantedAt,
      planting.harvestDate,
      harvestedAt,
      'COLHIDO',
      'Colhido com sucesso'
    ]]);

    PlayerService.updateResources(planting.playerId, 0, yieldAmount);

    AuditLog.logEvent('CROP_HARVESTED', {
      plantingId: plantingId,
      playerId: planting.playerId,
      cropId: planting.cropId,
      quantity: planting.quantity,
      yield: yieldAmount
    });

    return {
      success: true,
      message: 'Cultura colhida com sucesso',
      data: {
        yield: yieldAmount,
        crop: crop
      }
    };
  } catch (error) {
    ErrorHandler.logError('CropService.harvestCrop', error, { plantingId, userId });
    return { success: false, error: error.message };
  }
};

CropService.getPlantingsSheet = function() {
  try {
    const ss = Config.getSpreadsheet();
    let sheet = ss.getSheetByName(Config.SHEETS.PLANTINGS);
    if (!sheet) {
      sheet = ss.insertSheet(Config.SHEETS.PLANTINGS);
      const headers = ['plantingId', 'playerId', 'cropId', 'quantity', 'waterUsed', 'plantedAt', 'harvestDate', 'harvestedAt', 'status', 'notes'];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    return sheet;
  } catch (error) {
    ErrorHandler.logError('CropService.getPlantingsSheet', error);
    throw error;
  }
};

CropService.getAllPlantings = function() {
  try {
    const sheet = CropService.getPlantingsSheet();
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      return [];
    }
    const headers = values[0];
    return values.slice(1).map(function(row) {
      return CropService.mapPlantingRow(headers, row);
    });
  } catch (error) {
    ErrorHandler.logError('CropService.getAllPlantings', error);
    return [];
  }
};

CropService.mapPlantingRow = function(headers, row) {
  const planting = {};
  headers.forEach(function(header, index) {
    const key = String(header || '').trim().toLowerCase();
    const value = row[index];

    if (key === 'plantingid') {
      planting.plantingId = String(value || '').trim();
    } else if (key === 'playerid') {
      planting.playerId = String(value || '').trim();
    } else if (key === 'cropid') {
      planting.cropId = String(value || '').trim();
    } else if (key === 'quantity') {
      planting.quantity = Number(value) || 0;
    } else if (key === 'waterused') {
      planting.waterUsed = Number(value) || 0;
    } else if (key === 'plantedat') {
      planting.plantedAt = value instanceof Date ? value : value ? new Date(value) : null;
    } else if (key === 'harvestdate') {
      planting.harvestDate = value instanceof Date ? value : value ? new Date(value) : null;
    } else if (key === 'harvestedat') {
      planting.harvestedAt = value instanceof Date ? value : value ? new Date(value) : null;
    } else if (key === 'status') {
      planting.status = String(value || '').trim();
    } else if (key === 'notes') {
      planting.notes = value ? String(value).trim() : '';
    } else {
      planting[header] = value;
    }
  });
  return planting;
};

CropService.generatePlantingId = function() {
  try {
    const plantings = CropService.getAllPlantings();
    let maxId = 0;
    plantings.forEach(function(planting) {
      const parts = String(planting.plantingId || '').split('-');
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num)) {
          maxId = Math.max(maxId, num);
        }
      }
    });
    return 'P-' + String(maxId + 1).padStart(3, '0');
  } catch (error) {
    ErrorHandler.logError('CropService.generatePlantingId', error);
    return 'P-' + Date.now();
  }
};

/**
 * Atualiza cultura
 */
CropService.updateCrop = function(cropId, data) {
  try {
    if (!cropId) {
      return { success: false, error: 'cropId é obrigatório' };
    }

    const sheet = Config.getSheet(Config.SHEETS.CROPS);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return { success: false, error: 'Cultura não encontrada' };
    }

    const headers = values[0];
    let rowIndex = -1;
    let currentCrop = null;

    // Busca cultura
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const crop = CropService.mapRow(headers, row);
      
      if (crop.cropId === cropId) {
        rowIndex = i + 1;
        currentCrop = crop;
        break;
      }
    }

    if (rowIndex === -1) {
      return { success: false, error: 'Cultura não encontrada' };
    }

    // Verifica nome único se mudando nome
    if (data.name && data.name !== currentCrop.name) {
      if (!ValidationService.validateUniqueness(Config.SHEETS.CROPS, 'name', data.name, cropId)) {
        return { success: false, error: 'Já existe uma cultura com este nome' };
      }
    }

    // Atualiza apenas campos fornecidos
    const updatedCrop = {
      cropId: currentCrop.cropId,
      name: data.name !== undefined ? String(data.name).trim() : currentCrop.name,
      growthDays: data.growthDays !== undefined ? Number(data.growthDays) : currentCrop.growthDays,
      waterNeed: data.waterNeed !== undefined ? Number(data.waterNeed) : currentCrop.waterNeed,
      yieldPerCycle: data.yieldPerCycle !== undefined ? Number(data.yieldPerCycle) : currentCrop.yieldPerCycle,
      status: data.status !== undefined ? data.status : currentCrop.status
    };

    // Atualiza na planilha
    const row = [
      updatedCrop.cropId,
      updatedCrop.name,
      updatedCrop.growthDays,
      updatedCrop.waterNeed,
      updatedCrop.yieldPerCycle,
      updatedCrop.status
    ];

    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);

    // Log de auditoria
    AuditLog.logEvent('CROP_UPDATED', {
      cropId: cropId,
      changes: data
    });

    return { success: true, crop: updatedCrop };
  } catch (error) {
    ErrorHandler.logError('CropService.updateCrop', error, { cropId, data });
    return { success: false, error: error.message };
  }
};

/**
 * Desativa cultura
 */
CropService.deactivateCrop = function(cropId) {
  try {
    const result = CropService.updateCrop(cropId, {
      status: 'DESCONTINUADO'
    });

    if (result.success) {
      AuditLog.logEvent('CROP_DEACTIVATED', { cropId });
    }

    return result;
  } catch (error) {
    ErrorHandler.logError('CropService.deactivateCrop', error, { cropId });
    return { success: false, error: error.message };
  }
};

/**
 * Reativa cultura
 */
CropService.reactivateCrop = function(cropId) {
  try {
    const result = CropService.updateCrop(cropId, {
      status: 'ATIVO'
    });

    if (result.success) {
      AuditLog.logEvent('CROP_REACTIVATED', { cropId });
    }

    return result;
  } catch (error) {
    ErrorHandler.logError('CropService.reactivateCrop', error, { cropId });
    return { success: false, error: error.message };
  }
};

/**
 * Calcula necessidade total de água para ciclo completo
 */
CropService.calculateTotalWaterNeed = function(cropId) {
  try {
    const crop = CropService.getCropById(cropId);
    
    if (!crop) {
      return { success: false, error: 'Cultura não encontrada' };
    }

    const totalWater = crop.waterNeed * crop.growthDays;

    return {
      success: true,
      cropId: cropId,
      cropName: crop.name,
      waterPerDay: crop.waterNeed,
      growthDays: crop.growthDays,
      totalWaterNeed: totalWater
    };
  } catch (error) {
    ErrorHandler.logError('CropService.calculateTotalWaterNeed', error, { cropId });
    return { success: false, error: error.message };
  }
};

/**
 * Calcula eficiência da cultura (produção por litro de água)
 */
CropService.getCropEfficiency = function(cropId) {
  try {
    const crop = CropService.getCropById(cropId);
    
    if (!crop) {
      return { success: false, error: 'Cultura não encontrada' };
    }

    const totalWater = crop.waterNeed * crop.growthDays;
    const efficiency = crop.yieldPerCycle / totalWater;

    return {
      success: true,
      cropId: cropId,
      cropName: crop.name,
      yieldPerCycle: crop.yieldPerCycle,
      totalWaterNeed: totalWater,
      efficiency: Math.round(efficiency * 1000) / 1000, // 3 decimais
      rating: CropService.getEfficiencyRating(efficiency)
    };
  } catch (error) {
    ErrorHandler.logError('CropService.getCropEfficiency', error, { cropId });
    return { success: false, error: error.message };
  }
};

/**
 * Lista culturas mais sustentáveis (maior eficiência)
 */
CropService.getSustainableCrops = function(limit) {
  try {
    limit = Number(limit) || 5;
    
    const crops = CropService.getAllCrops(true);
    
    if (crops.length === 0) {
      return [];
    }

    // Calcula eficiência de cada cultura
    const cropsWithEfficiency = crops.map(function(crop) {
      const totalWater = crop.waterNeed * crop.growthDays;
      const efficiency = crop.yieldPerCycle / totalWater;
      
      return {
        crop: crop,
        efficiency: efficiency,
        totalWaterNeed: totalWater,
        rating: CropService.getEfficiencyRating(efficiency)
      };
    });

    // Ordena por eficiência (maior primeiro)
    cropsWithEfficiency.sort(function(a, b) {
      return b.efficiency - a.efficiency;
    });

    // Retorna top N
    return cropsWithEfficiency.slice(0, limit);
  } catch (error) {
    ErrorHandler.logError('CropService.getSustainableCrops', error, { limit });
    return [];
  }
};

/**
 * Retorna estatísticas completas da cultura
 */
CropService.getCropStats = function(cropId) {
  try {
    const crop = CropService.getCropById(cropId);
    
    if (!crop) {
      return null;
    }

    const totalWater = crop.waterNeed * crop.growthDays;
    const efficiency = crop.yieldPerCycle / totalWater;

    return {
      crop: crop,
      water: {
        perDay: crop.waterNeed,
        total: totalWater
      },
      growth: {
        days: crop.growthDays,
        weeks: Math.round(crop.growthDays / 7 * 10) / 10
      },
      production: {
        yieldPerCycle: crop.yieldPerCycle,
        yieldPerDay: Math.round(crop.yieldPerCycle / crop.growthDays * 100) / 100
      },
      efficiency: {
        value: Math.round(efficiency * 1000) / 1000,
        rating: CropService.getEfficiencyRating(efficiency),
        unitsPerLiter: efficiency
      },
      isActive: crop.status === 'ATIVO'
    };
  } catch (error) {
    ErrorHandler.logError('CropService.getCropStats', error, { cropId });
    return null;
  }
};

/**
 * Mapeia linha da planilha para objeto cultura
 */
CropService.mapRow = function(headers, row) {
  const crop = {};
  
  headers.forEach(function(header, index) {
    const key = String(header || '').trim().toLowerCase();
    const value = row[index];
    
    if (key === 'cropid') {
      crop.cropId = String(value || '').trim();
    } else if (key === 'name') {
      crop.name = String(value || '').trim();
    } else if (key === 'growthdays') {
      crop.growthDays = Number(value) || 0;
    } else if (key === 'waterneed') {
      crop.waterNeed = Number(value) || 0;
    } else if (key === 'yieldpercycle') {
      crop.yieldPerCycle = Number(value) || 0;
    } else if (key === 'status') {
      crop.status = String(value || 'ATIVO').trim();
    } else {
      crop[header] = value;
    }
  });
  
  return crop;
};

/**
 * Gera ID único para cultura
 */
CropService.generateCropId = function() {
  try {
    const sheet = Config.getSheet(Config.SHEETS.CROPS);
    const lastRow = sheet.getLastRow();
    const nextNumber = Math.max(1, lastRow);
    
    return 'C-' + String(nextNumber).padStart(2, '0');
  } catch (error) {
    ErrorHandler.logError('CropService.generateCropId', error);
    return 'C-' + Date.now();
  }
};

/**
 * Avalia rating de eficiência
 */
CropService.getEfficiencyRating = function(efficiency) {
  if (efficiency >= 1.0) return 'EXCELENTE';
  if (efficiency >= 0.5) return 'BOA';
  if (efficiency >= 0.2) return 'REGULAR';
  return 'BAIXA';
};

/**
 * Função de teste
 */
function testCropService() {
  Logger.log('=== Testando CropService ===');
  
  // Teste de criação
  Logger.log('1. Criando cultura...');
  const result = CropService.createCrop({
    name: 'Milho Cerrado',
    growthDays: 45,
    waterNeed: 12,
    yieldPerCycle: 220
  });
  Logger.log('Resultado: ' + JSON.stringify(result));
  
  if (result.success) {
    const cropId = result.crop.cropId;
    
    // Teste de busca
    Logger.log('2. Buscando cultura...');
    const crop = CropService.getCropById(cropId);
    Logger.log('Cultura encontrada: ' + JSON.stringify(crop));
    
    // Teste de cálculo de água total
    Logger.log('3. Calculando necessidade de água...');
    const waterCalc = CropService.calculateTotalWaterNeed(cropId);
    Logger.log('Resultado: ' + JSON.stringify(waterCalc));
    
    // Teste de eficiência
    Logger.log('4. Calculando eficiência...');
    const efficiency = CropService.getCropEfficiency(cropId);
    Logger.log('Resultado: ' + JSON.stringify(efficiency));
    
    // Teste de estatísticas
    Logger.log('5. Buscando estatísticas...');
    const stats = CropService.getCropStats(cropId);
    Logger.log('Stats: ' + JSON.stringify(stats));
  }
  
  // Teste de culturas sustentáveis
  Logger.log('6. Listando culturas mais sustentáveis...');
  const sustainable = CropService.getSustainableCrops(3);
  Logger.log('Encontradas: ' + sustainable.length + ' culturas');
  
  Logger.log('=== Teste concluído ===');
}
