/**
 * @file DashboardService.gs
 * @description View-model único do dashboard: estado atual, evidência recente,
 *              alertas e uma síntese que ajuda a criança a decidir o próximo teste.
 */

function DashboardService() {
  Logger.log('Iniciando componente: DashboardService.gs');
}

DashboardService.buildSummary = function(player, village, aquifer, climate, events, notifications) {
  const level = aquifer && aquifer.depth !== undefined ? Number(aquifer.depth) : null;
  const status = aquifer && aquifer.status ? aquifer.status : 'SEM DADOS';
  return {
    water: player ? Number(player.waterCredits) || 0 : 0,
    food: player ? Number(player.foodUnits) || 0 : 0,
    sustainability: player ? Number(player.sustainabilityScore) || 0 : 0,
    aquiferDepth: level,
    aquiferStatus: status,
    climateStatus: climate && climate.status ? climate.status : 'SEM DADOS',
    eventCount: (events || []).length,
    unreadCount: (notifications || []).filter(function(item) { return !item.read; }).length,
    nextPrompt: status === 'CRÍTICO'
      ? 'Compare uma decisão que reduza a extração.'
      : 'Registre uma previsão antes de agir.'
  };
};

DashboardService.getPlayerDashboard = function(playerId) {
  try {
    if (!playerId || typeof PlayerService === 'undefined') {
      return { success: false, error: 'Jogador não encontrado.' };
    }
    const player = PlayerService.getPlayerById(playerId);
    if (!player) return { success: false, error: 'Jogador não encontrado.' };
    const village = player.villageId && typeof VillageService !== 'undefined'
      ? VillageService.getVillageById(player.villageId) : null;
    const aquifer = typeof AquiferService !== 'undefined' ? AquiferService.getCurrentStatus() : null;
    const climate = typeof ClimateService !== 'undefined' ? ClimateService.getCurrentClimate() : null;
    const events = typeof HistoryService !== 'undefined' ? HistoryService.getRecentEvents(5) : [];
    const notifications = typeof NotificationService !== 'undefined'
      ? NotificationService.getAllNotifications(playerId, 10) : [];
    return {
      success: true,
      data: {
        player: player,
        village: village,
        aquifer: aquifer,
        climate: climate,
        events: events,
        notifications: notifications,
        summary: DashboardService.buildSummary(player, village, aquifer, climate, events, notifications)
      }
    };
  } catch (error) {
    ErrorHandler.logError('DashboardService.getPlayerDashboard', error, { playerId: playerId });
    return { success: false, error: 'Não foi possível carregar o painel.' };
  }
};

DashboardService.getData = DashboardService.getPlayerDashboard;

DashboardService.getVillageDashboard = function(villageId) {
  try {
    if (!villageId || typeof PlayerService === 'undefined') {
      return { success: false, error: 'Vila não encontrada.' };
    }
    const players = PlayerService.getPlayersByVillage(villageId) || [];
    const sustainability = players.length
      ? players.reduce(function(total, player) { return total + (Number(player.sustainabilityScore) || 0); }, 0) / players.length
      : 0;
    const events = typeof HistoryService !== 'undefined' ? HistoryService.getVillageHistory(villageId, 10) : [];
    return {
      success: true,
      data: {
        villageId: villageId,
        players: players,
        playerCount: players.length,
        averageSustainability: Math.round(sustainability * 10) / 10,
        history: events
      }
    };
  } catch (error) {
    ErrorHandler.logError('DashboardService.getVillageDashboard', error, { villageId: villageId });
    return { success: false, error: 'Não foi possível carregar a vila.' };
  }
};

/**
 * Gera lista priorizada de alertas pedagógicos para o jogador
 * Cruza estado do aquífero, clima e sustentabilidade pessoal.
 * @param {string} playerId
 * @returns {{ success: boolean, alerts: Array<{level:string, message:string, action:string}> }}
 */
DashboardService.getAlerts = function(playerId) {
  try {
    var alerts = [];
    var aquifer = (typeof AquiferService !== 'undefined' && AquiferService.getCurrentStatus)
      ? AquiferService.getCurrentStatus() : null;
    var climate = (typeof ClimateService !== 'undefined' && ClimateService.getCurrentClimate)
      ? ClimateService.getCurrentClimate() : null;
    var player = (playerId && typeof PlayerService !== 'undefined' && PlayerService.getPlayerById)
      ? PlayerService.getPlayerById(playerId) : null;

    // Alerta de aquífero crítico
    if (aquifer && aquifer.status === 'CRÍTICO') {
      alerts.push({
        level: 'CRITICO',
        message: 'O lençol freático está em nível crítico. Reduza a extração imediatamente.',
        action: 'Planejar irrigação por gotejamento'
      });
    } else if (aquifer && aquifer.status === 'ALERTA') {
      alerts.push({
        level: 'ALERTA',
        message: 'O aquífero está sob pressão. Considere alternativas de uso da água.',
        action: 'Revisar culturas com alto consumo hídrico'
      });
    }

    // Alerta climático
    if (climate && climate.rainValue !== undefined && Number(climate.rainValue) === 0) {
      alerts.push({
        level: 'ALERTA',
        message: 'Período de estiagem registrado. Proteja suas culturas.',
        action: 'Prever o impacto da seca na próxima rodada'
      });
    }

    // Alerta de sustentabilidade pessoal
    var score = player ? Number(player.sustainabilityScore) || 0 : 0;
    if (player && score < 30) {
      alerts.push({
        level: 'CRITICO',
        message: 'Sua pontuação de sustentabilidade está muito baixa (' + score + '). Risco de penalidade coletiva.',
        action: 'Diversificar práticas e reduzir desperdício'
      });
    } else if (player && score < 50) {
      alerts.push({
        level: 'ALERTA',
        message: 'Sustentabilidade em ' + score + '/100. Há espaço para melhora.',
        action: 'Investir em culturas de baixo impacto hídrico'
      });
    }

    if (alerts.length === 0) {
      alerts.push({ level: 'OK', message: 'Situação estável. Continue monitorando o aquífero.', action: '' });
    }

    return { success: true, alerts: alerts };
  } catch (error) {
    ErrorHandler.logError('DashboardService.getAlerts', error, { playerId: playerId });
    return { success: false, alerts: [] };
  }
};

/**
 * Retorna síntese do progresso do jogador: XP, nível, metas pendentes
 * @param {string} playerId
 * @returns {{ success: boolean, data: Object }}
 */
DashboardService.getProgressReport = function(playerId) {
  try {
    if (!playerId || typeof PlayerService === 'undefined') {
      return { success: false, error: 'Jogador não encontrado.' };
    }
    var player = PlayerService.getPlayerById(playerId);
    if (!player) return { success: false, error: 'Jogador não encontrado.' };

    var xp = Number(player.experience) || 0;
    var level = Math.floor(xp / 100) + 1;
    var nextLevelXp = level * 100;
    var progressPct = Math.round(((xp % 100) / 100) * 100);

    var pendingGoals = [];
    if ((Number(player.sustainabilityScore) || 0) < 60) {
      pendingGoals.push('Elevar sustentabilidade acima de 60');
    }
    if ((Number(player.waterCredits) || 0) < 50) {
      pendingGoals.push('Acumular ao menos 50 créditos hídricos');
    }
    if (!player.villageId) {
      pendingGoals.push('Ingressar em uma vila');
    }

    return {
      success: true,
      data: {
        playerId: playerId,
        level: level,
        xp: xp,
        nextLevelXp: nextLevelXp,
        progressPercent: progressPct,
        sustainabilityScore: Number(player.sustainabilityScore) || 0,
        pendingGoals: pendingGoals,
        goalsCompleted: pendingGoals.length === 0
      }
    };
  } catch (error) {
    ErrorHandler.logError('DashboardService.getProgressReport', error, { playerId: playerId });
    return { success: false, error: 'Não foi possível gerar o relatório de progresso.' };
  }
};

/**
 * Compara a posição relativa do jogador com a média da sua vila
 * @param {string} playerId
 * @returns {{ success: boolean, data: Object }}
 */
DashboardService.compareWithVillage = function(playerId) {
  try {
    if (!playerId || typeof PlayerService === 'undefined') {
      return { success: false, error: 'Jogador não encontrado.' };
    }
    var player = PlayerService.getPlayerById(playerId);
    if (!player) return { success: false, error: 'Jogador não encontrado.' };

    var players = (player.villageId && PlayerService.getPlayersByVillage)
      ? (PlayerService.getPlayersByVillage(player.villageId) || []) : [];

    var avgSustainability = players.length
      ? players.reduce(function(acc, p) { return acc + (Number(p.sustainabilityScore) || 0); }, 0) / players.length
      : 0;
    var avgWater = players.length
      ? players.reduce(function(acc, p) { return acc + (Number(p.waterCredits) || 0); }, 0) / players.length
      : 0;

    var playerScore = Number(player.sustainabilityScore) || 0;
    var playerWater = Number(player.waterCredits) || 0;

    return {
      success: true,
      data: {
        playerId: playerId,
        villageId: player.villageId || null,
        villageMemberCount: players.length,
        player: { sustainabilityScore: playerScore, waterCredits: playerWater },
        villageAverage: {
          sustainabilityScore: Math.round(avgSustainability * 10) / 10,
          waterCredits: Math.round(avgWater * 10) / 10
        },
        deltaScore: Math.round((playerScore - avgSustainability) * 10) / 10,
        deltaWater: Math.round((playerWater - avgWater) * 10) / 10,
        ranking: players.filter(function(p) {
          return (Number(p.sustainabilityScore) || 0) > playerScore;
        }).length + 1
      }
    };
  } catch (error) {
    ErrorHandler.logError('DashboardService.compareWithVillage', error, { playerId: playerId });
    return { success: false, error: 'Não foi possível comparar com a vila.' };
  }
};

/**
 * Registra o acesso ao painel no sistema de auditoria se disponível.
 * @param {string} playerId
 */
DashboardService.recordAccess = function(playerId) {
  try {
    if (typeof AuditLog !== 'undefined' && AuditLog.logEvent) {
      AuditLog.logEvent('DASHBOARD_ACCESS', { playerId: playerId, timestamp: new Date().toISOString() });
    }
  } catch (e) {
    // Não-bloqueante
  }
};

/**
 * Valida o identificador do jogador utilizando o ValidationService se disponível.
 * @param {string} playerId
 * @returns {boolean}
 */
DashboardService.validatePlayerId_ = function(playerId) {
  try {
    if (typeof ValidationService !== 'undefined' && ValidationService.validateId) {
      return ValidationService.validateId(playerId, 'JOGADOR');
    }
    return Boolean(playerId && typeof playerId === 'string' && playerId.trim().length > 0);
  } catch (e) {
    return Boolean(playerId);
  }
};

/**
 * Recupera configurações do dashboard a partir das Script Properties.
 * @returns {Object} Configurações
 */
DashboardService.getDashboardConfig = function() {
  try {
    if (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties) {
      var props = PropertiesService.getScriptProperties();
      return {
        refreshInterval: Number(props.getProperty('LAGO_DASHBOARD_REFRESH')) || 30,
        showClimateForecast: props.getProperty('LAGO_SHOW_FORECAST') !== 'false',
        maxRecentEvents: Number(props.getProperty('LAGO_MAX_RECENT_EVENTS')) || 5
      };
    }
    return { refreshInterval: 30, showClimateForecast: true, maxRecentEvents: 5 };
  } catch (error) {
    return { refreshInterval: 30, showClimateForecast: true, maxRecentEvents: 5 };
  }
};

/**
 * Retorna o painel do jogador em formato TextOutput (JSON) para consumo de APIs.
 * @param {string} playerId
 * @returns {Object} ContentService TextOutput
 */
function getPlayerDashboardJson(playerId) {
  var result = DashboardService.getPlayerDashboard(playerId);
  if (typeof ContentService !== 'undefined' && ContentService.createTextOutput) {
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
  return result;
}
