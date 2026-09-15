/**
 * @file VillageDAO.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Data Access Object responsável pela persistência e consulta das vilas comunitárias.
 * @context Integração da persistência tabular de comunidades com regras territoriais do DF.
 */

function VillageDAO() {
  Logger.log('Iniciando componente: VillageDAO.gs');
}

/**
 * Mapeia linha da planilha 'Vilas' para objeto Village
 */
VillageDAO.mapVillageRow = function(headers, row) {
  const village = {};
  headers.forEach(function(header, index) {
    const key = String(header || '').trim().toLowerCase();
    const value = row[index];

    if (key === 'villageid') {
      village.villageId = String(value || '').trim();
    } else if (key === 'name') {
      village.name = String(value || '').trim();
    } else if (key === 'region') {
      village.region = String(value || 'Norte').trim();
    } else if (key === 'population') {
      village.population = Number(value) || 0;
    } else if (key === 'waterallocation') {
      village.waterAllocation = Number(value) || 0;
    } else if (key === 'foodstock') {
      village.foodStock = Number(value) || 0;
    } else if (key === 'sustainabilityindex') {
      village.sustainabilityIndex = Number(value) || 50;
    } else if (key === 'status') {
      village.status = String(value || 'ATIVA').trim();
    } else {
      village[header] = value;
    }
  });
  return village;
};

/**
 * Retorna todas as vilas cadastradas
 */
VillageDAO.getAllVillages = function(activeOnly) {
  try {
    const sheet = Config.getSheet(Config.SHEETS.VILLAGES);
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];

    const headers = values[0];
    const villages = [];
    for (let i = 1; i < values.length; i++) {
      const v = VillageDAO.mapVillageRow(headers, values[i]);
      if (!activeOnly || v.status === 'ATIVA') {
        villages.push(v);
      }
    }
    return villages;
  } catch (error) {
    ErrorHandler.logError('VillageDAO.getAllVillages', error);
    return [];
  }
};

/**
 * Busca vila por ID
 */
VillageDAO.getVillageById = function(villageId) {
  if (!villageId) return null;
  const targetId = String(villageId).trim();
  const villages = VillageDAO.getAllVillages(false);
  return villages.find(function(v) { return v.villageId === targetId; }) || null;
};

/**
 * Alias para getVillageById compatível com Router
 */
VillageDAO.getById = function(villageId) {
  return VillageDAO.getVillageById(villageId);
};

/**
 * Retorna membros jogadores de uma vila
 */
VillageDAO.getMembers = function(villageId) {
  if (typeof PlayerDAO !== 'undefined' && PlayerDAO.getPlayersByVillage) {
    return PlayerDAO.getPlayersByVillage(villageId);
  }
  return [];
};

/**
 * Retorna estatísticas da comunidade
 */
VillageDAO.getStatistics = function(villageId) {
  const village = VillageDAO.getVillageById(villageId);
  if (!village) return null;

  const members = VillageDAO.getMembers(villageId);
  return {
    villageId: village.villageId,
    name: village.name,
    region: village.region,
    population: members.length || village.population,
    waterAllocation: village.waterAllocation,
    sustainabilityIndex: village.sustainabilityIndex,
    status: village.status
  };
};
