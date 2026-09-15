/**
 * @file PlayerDAO.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Data Access Object responsável pela persistência completa dos dados individuais de jogadores.
 * @context Integração da lógica técnica robusta (V1) com a narrativa contextualizada do DF (V2).
 */

function PlayerDAO() {
  Logger.log('Iniciando componente: PlayerDAO.gs');
}

/**
 * Mapeia linha da planilha 'Jogadores' para objeto Player
 */
PlayerDAO.mapPlayerRow = function(headers, row) {
  const player = {};
  headers.forEach(function(header, index) {
    const key = String(header || '').trim().toLowerCase();
    const value = row[index];

    if (key === 'playerid') {
      player.playerId = String(value || '').trim();
    } else if (key === 'userid') {
      player.userId = String(value || '').trim();
    } else if (key === 'villageid') {
      player.villageId = String(value || '').trim();
    } else if (key === 'playername') {
      player.playerName = String(value || '').trim();
    } else if (key === 'level') {
      player.level = Number(value) || 1;
    } else if (key === 'watercredits') {
      player.waterCredits = Number(value) || 0;
    } else if (key === 'foodunits') {
      player.foodUnits = Number(value) || 0;
    } else if (key === 'sustainabilityscore') {
      player.sustainabilityScore = Number(value) || 50;
    } else if (key === 'experiencepoints') {
      player.experiencePoints = value === '' || value === null || value === undefined
        ? null
        : Math.max(0, Number(value) || 0);
    } else if (key === 'status') {
      player.status = String(value || 'ATIVO').trim();
    } else {
      player[header] = value;
    }
  });
  return player;
};

/**
 * Retorna todos os jogadores cadastrados
 */
PlayerDAO.getAllPlayers = function() {
  try {
    const sheet = Config.getSheet(Config.SHEETS.PLAYERS);
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];

    const headers = values[0];
    const players = [];
    for (let i = 1; i < values.length; i++) {
      players.push(PlayerDAO.mapPlayerRow(headers, values[i]));
    }
    return players;
  } catch (error) {
    ErrorHandler.logError('PlayerDAO.getAllPlayers', error);
    return [];
  }
};

/**
 * Busca jogador por ID
 */
PlayerDAO.getPlayerById = function(playerId) {
  if (!playerId) return null;
  const targetId = String(playerId).trim();
  const players = PlayerDAO.getAllPlayers();
  return players.find(function(p) { return p.playerId === targetId; }) || null;
};

/**
 * Alias para getPlayerById compatível com Router
 */
PlayerDAO.getById = function(playerId) {
  return PlayerDAO.getPlayerById(playerId);
};

/**
 * Busca jogadores pertencentes a uma vila
 */
PlayerDAO.getPlayersByVillage = function(villageId) {
  if (!villageId) return [];
  const targetVillage = String(villageId).trim();
  return PlayerDAO.getAllPlayers().filter(function(p) {
    return p.villageId === targetVillage;
  });
};

/**
 * Retorna conquistas do jogador
 */
PlayerDAO.getAchievements = function(playerId) {
  const player = PlayerDAO.getPlayerById(playerId);
  if (!player) return [];

  const achievements = [];
  if (player.sustainabilityScore >= 80) {
    achievements.push({ id: 'eco_master', title: 'Guardião do Paranoá', icon: '🏆' });
  }
  if (player.waterCredits >= 200) {
    achievements.push({ id: 'water_saver', title: 'Mestre da Economia Hídrica', icon: '💧' });
  }
  return achievements;
};

/**
 * Retorna estatísticas de desempenho do jogador
 */
PlayerDAO.getStatistics = function(playerId) {
  const player = PlayerDAO.getPlayerById(playerId);
  if (!player) return null;

  return {
    playerId: player.playerId,
    name: player.playerName,
    level: player.level,
    experiencePoints: player.experiencePoints,
    waterBalance: player.waterCredits,
    sustainabilityScore: player.sustainabilityScore,
    status: player.status
  };
};
