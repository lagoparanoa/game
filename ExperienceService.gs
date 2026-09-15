/**
 * @file ExperienceService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Sistema completo de experiência (XP) e progressão de níveis.
 *              Substitui o levelUp manual por um sistema automático baseado
 *              em rodadas completadas, sustentabilidade e conquistas.
 * 
 * @context Anteriormente PlayerService.levelUp() era manual. Este serviço
 *          implementa progressão automática com critérios pedagógicos.
 * 
 * @principais_funcionalidades
 * - awardXP(playerId, amount, reason): Concede XP a um jogador
 * - checkLevelUp(playerId): Verifica e aplica level-up automático
 * - calculateXPForRound(roundData): Calcula XP de uma rodada
 * - getPlayerXPStatus(playerId): Retorna status de XP e progressão
 * - getXPLeaderboard(limit): Ranking por XP total
 */

function ExperienceService() {
  Logger.log("Iniciando componente: ExperienceService.gs");
}

/**
 * Tabela de progressão: XP necessário para cada nível
 */
ExperienceService.LEVEL_THRESHOLDS = {
  1: 0,       // Iniciante
  2: 200,     // Aprendiz
  3: 500,     // Cultivador
  4: 1000,    // Gestor
  5: 1800,    // Estrategista
  6: 2800,    // Especialista
  7: 4200,    // Mestre
  8: 6000,    // Sábio
  9: 8500,    // Guardião
  10: 12000   // Lendário
};

/**
 * Títulos associados a cada nível
 */
ExperienceService.LEVEL_TITLES = {
  1: 'Iniciante',
  2: 'Aprendiz',
  3: 'Cultivador',
  4: 'Gestor',
  5: 'Estrategista',
  6: 'Especialista',
  7: 'Mestre',
  8: 'Sábio',
  9: 'Guardião das Águas',
  10: 'Lendário do Paranoá'
};

/**
 * Valores de XP por tipo de ação
 */
ExperienceService.XP_REWARDS = {
  ROUND_COMPLETED: 50,              // Completar uma rodada investigativa
  ROUND_REVIEWED: 30,               // Revisar rodada com reflexão
  SUSTAINABILITY_HIGH: 20,          // Score de sustentabilidade > 70
  SUSTAINABILITY_PERFECT: 50,       // Score de sustentabilidade = 100
  POSITIVE_PROFIT: 15,              // Lucro positivo na rodada
  WATER_EFFICIENT: 25,              // Uso eficiente de água (< 80% do disponível)
  FIRST_HARVEST: 40,                // Primeira colheita bem-sucedida
  VILLAGE_CONTRIBUTION: 35,         // Contribuir recursos para a vila
  MARKET_TRADE: 10,                 // Realizar transação no mercado
  TERRITORIAL_DECISION: 45,         // Participar de decisão territorial
  HELP_OTHER_PLAYER: 30,            // Ajudar outro jogador
  CONSECUTIVE_ROUNDS: 25            // Completar rodadas consecutivas (bônus)
};

/**
 * Resolve XP explícito. Registros anteriores à versão 1.2 recebem como base o
 * limiar do nível já conquistado, sem reinterpretar o saldo hídrico como XP.
 */
ExperienceService.getEffectiveXP = function(player) {
  if (!player) return 0;
  if (player.experiencePoints !== null &&
      player.experiencePoints !== undefined &&
      player.experiencePoints !== '') {
    return Math.max(0, Number(player.experiencePoints) || 0);
  }
  const level = Math.max(1, Math.min(10, Number(player.level) || 1));
  return ExperienceService.LEVEL_THRESHOLDS[level] || 0;
};

/**
 * Concede XP a um jogador
 * @param {string} playerId - ID do jogador
 * @param {number} amount - Quantidade de XP a conceder
 * @param {string} reason - Motivo da concessão
 * @returns {Object} { success, xpAwarded, newTotal, leveledUp, newLevel }
 */
ExperienceService.awardXP = function(playerId, amount, reason) {
  let lock = null;
  let lockAcquired = false;
  try {
    if (!playerId || !amount) {
      return { success: false, error: 'playerId e amount são obrigatórios' };
    }

    const xpAmount = Math.max(0, Number(amount) || 0);
    if (xpAmount === 0) {
      return { success: false, error: 'Quantidade de XP deve ser maior que zero' };
    }

    // Serializa leitura e escrita para não perder XP em chamadas concorrentes.
    if (typeof LockService !== 'undefined') {
      // O gateway já usa ScriptLock para a transação da rodada. UserLock evita
      // lock reentrante e ainda serializa premiações concorrentes do jogador.
      lock = typeof LockService.getUserLock === 'function'
        ? LockService.getUserLock()
        : LockService.getScriptLock();
      lockAcquired = lock.tryLock(10000);
      if (!lockAcquired) {
        return { success: false, error: 'Progressão ocupada; tente novamente em instantes' };
      }
    }

    // Busca jogador
    const player = PlayerService.getPlayerById(playerId);
    if (!player) {
      return { success: false, error: 'Jogador não encontrado' };
    }

    // XP e recursos hídricos são domínios independentes.
    const currentXP = ExperienceService.getEffectiveXP(player);
    const newXP = currentXP + xpAmount;

    // Atualiza XP do jogador
    const updateResult = PlayerService.updatePlayer(playerId, {
      experiencePoints: newXP
    });

    if (!updateResult.success) {
      return updateResult;
    }

    // Verifica level-up
    const levelUpCheck = ExperienceService.checkLevelUp(playerId);

    // Registra no histórico
    if (typeof HistoryService !== 'undefined' && HistoryService.recordEvent) {
      HistoryService.recordEvent({
        round: 0,  // XP não está vinculado a rodada específica
        eventType: 'XP_AWARDED',
        title: 'Experiência Ganha',
        description: reason || 'XP concedido',
        impact: `+${xpAmount} XP (Total: ${newXP})`,
        affectedPlayers: playerId
      });
    }

    // Log de auditoria
    AuditLog.logEvent('XP_AWARDED', {
      playerId: playerId,
      amount: xpAmount,
      reason: reason,
      newTotal: newXP
    });

    // Envia notificação
    if (typeof NotificationService !== 'undefined' && NotificationService.sendNotification) {
      NotificationService.sendNotification(playerId, {
        type: 'SUCCESS',
        title: 'Experiência Ganha!',
        message: `Você ganhou ${xpAmount} XP: ${reason}`,
        villageId: player.villageId || ''
      });
    }

    return {
      success: true,
      xpAwarded: xpAmount,
      newTotal: newXP,
      reason: reason,
      leveledUp: levelUpCheck.leveledUp || false,
      newLevel: levelUpCheck.newLevel || player.level
    };

  } catch (error) {
    ErrorHandler.logError('ExperienceService.awardXP', error, { playerId, amount, reason });
    return { success: false, error: error.message };
  } finally {
    if (lockAcquired && lock) lock.releaseLock();
  }
};

/**
 * Verifica se jogador deve subir de nível e aplica automaticamente
 * @param {string} playerId - ID do jogador
 * @returns {Object} { success, leveledUp, oldLevel, newLevel, nextLevelXP }
 */
ExperienceService.checkLevelUp = function(playerId) {
  try {
    if (!playerId) {
      return { success: false, error: 'playerId é obrigatório' };
    }

    // Busca jogador
    const player = PlayerService.getPlayerById(playerId);
    if (!player) {
      return { success: false, error: 'Jogador não encontrado' };
    }

    const currentLevel = Number(player.level) || 1;
    const currentXP = ExperienceService.getEffectiveXP(player);

    // Determina novo nível baseado em XP
    let newLevel = currentLevel;
    for (let level = 10; level >= 1; level--) {
      if (currentXP >= ExperienceService.LEVEL_THRESHOLDS[level]) {
        newLevel = Math.max(currentLevel, level);
        break;
      }
    }

    // Verifica se houve level-up
    const leveledUp = newLevel > currentLevel;

    if (leveledUp) {
      // Atualiza nível do jogador
      const updateResult = PlayerService.updatePlayer(playerId, {
        level: newLevel
      });

      if (!updateResult.success) {
        return updateResult;
      }

      // Registra evento de level-up
      if (typeof HistoryService !== 'undefined' && HistoryService.recordEvent) {
        HistoryService.recordEvent({
          round: 0,
          eventType: 'LEVEL_UP',
          title: 'Subiu de Nível!',
          description: `${player.playerName} alcançou o nível ${newLevel}: ${ExperienceService.LEVEL_TITLES[newLevel]}`,
          impact: `Nível ${currentLevel} → ${newLevel}`,
          affectedPlayers: playerId
        });
      }

      // Log de auditoria
      AuditLog.logEvent('PLAYER_LEVEL_UP', {
        playerId: playerId,
        oldLevel: currentLevel,
        newLevel: newLevel,
        totalXP: currentXP
      });

      // Envia notificação especial
      if (typeof NotificationService !== 'undefined' && NotificationService.sendNotification) {
        NotificationService.sendNotification(playerId, {
          type: 'SUCCESS',
          title: '🎉 Parabéns! Você Subiu de Nível!',
          message: `Você alcançou o nível ${newLevel}: ${ExperienceService.LEVEL_TITLES[newLevel]}! Continue protegendo as águas do Paranoá.`,
          villageId: player.villageId || ''
        });
      }
    }

    // Calcula XP para próximo nível
    const nextLevel = Math.min(10, newLevel + 1);
    const nextLevelXP = ExperienceService.LEVEL_THRESHOLDS[nextLevel];
    const xpNeeded = Math.max(0, nextLevelXP - currentXP);

    return {
      success: true,
      leveledUp: leveledUp,
      oldLevel: currentLevel,
      newLevel: newLevel,
      currentXP: currentXP,
      nextLevelXP: nextLevelXP,
      xpNeeded: xpNeeded,
      progress: nextLevelXP > 0 ? Math.round((currentXP / nextLevelXP) * 100) : 100
    };

  } catch (error) {
    ErrorHandler.logError('ExperienceService.checkLevelUp', error, { playerId });
    return { success: false, error: error.message };
  }
};

/**
 * Calcula XP total de uma rodada baseado no resultado
 * @param {Object} roundData - Dados da rodada (resultado do GameEngine)
 * @returns {Object} { totalXP, breakdown }
 */
ExperienceService.calculateXPForRound = function(roundData) {
  try {
    if (!roundData) {
      return { totalXP: 0, breakdown: [] };
    }

    const breakdown = [];
    let totalXP = 0;

    // XP base por completar rodada
    totalXP += ExperienceService.XP_REWARDS.ROUND_COMPLETED;
    breakdown.push({ reason: 'Rodada completada', xp: ExperienceService.XP_REWARDS.ROUND_COMPLETED });

    // Verifica resultado da rodada
    const outcome = roundData.outcome || {};
    const nextState = roundData.nextState || {};

    // Bônus por lucro positivo
    if (outcome.profit && Number(outcome.profit) > 0) {
      totalXP += ExperienceService.XP_REWARDS.POSITIVE_PROFIT;
      breakdown.push({ reason: 'Lucro positivo', xp: ExperienceService.XP_REWARDS.POSITIVE_PROFIT });
    }

    // Bônus por uso eficiente de água
    if (outcome.waterFactor && Number(outcome.waterFactor) >= 1) {
      totalXP += ExperienceService.XP_REWARDS.WATER_EFFICIENT;
      breakdown.push({ reason: 'Uso eficiente de água', xp: ExperienceService.XP_REWARDS.WATER_EFFICIENT });
    }

    // Bônus por sustentabilidade alta
    const sustainability = Number(nextState.sustainabilityScore) || 0;
    if (sustainability === 100) {
      totalXP += ExperienceService.XP_REWARDS.SUSTAINABILITY_PERFECT;
      breakdown.push({ reason: 'Sustentabilidade perfeita', xp: ExperienceService.XP_REWARDS.SUSTAINABILITY_PERFECT });
    } else if (sustainability > 70) {
      totalXP += ExperienceService.XP_REWARDS.SUSTAINABILITY_HIGH;
      breakdown.push({ reason: 'Alta sustentabilidade', xp: ExperienceService.XP_REWARDS.SUSTAINABILITY_HIGH });
    }

    return { totalXP: totalXP, breakdown: breakdown };

  } catch (error) {
    ErrorHandler.logError('ExperienceService.calculateXPForRound', error, roundData);
    return { totalXP: 0, breakdown: [] };
  }
};

/**
 * Retorna status completo de XP e progressão de um jogador
 * @param {string} playerId - ID do jogador
 * @returns {Object} Status completo
 */
ExperienceService.getPlayerXPStatus = function(playerId) {
  try {
    if (!playerId) {
      return { success: false, error: 'playerId é obrigatório' };
    }

    const player = PlayerService.getPlayerById(playerId);
    if (!player) {
      return { success: false, error: 'Jogador não encontrado' };
    }

    const currentLevel = Number(player.level) || 1;
    const currentXP = ExperienceService.getEffectiveXP(player);

    const nextLevel = Math.min(10, currentLevel + 1);
    const currentLevelXP = ExperienceService.LEVEL_THRESHOLDS[currentLevel];
    const nextLevelXP = ExperienceService.LEVEL_THRESHOLDS[nextLevel];
    const xpInCurrentLevel = Math.max(0, currentXP - currentLevelXP);
    const xpNeededForNextLevel = Math.max(0, nextLevelXP - currentXP);
    const xpRangeInLevel = nextLevelXP - currentLevelXP;
    const progressPercent = xpRangeInLevel > 0
      ? Math.max(0, Math.min(100, Math.round((xpInCurrentLevel / xpRangeInLevel) * 100)))
      : 100;

    return {
      success: true,
      player: {
        playerId: player.playerId,
        playerName: player.playerName,
        level: currentLevel,
        levelTitle: ExperienceService.LEVEL_TITLES[currentLevel]
      },
      xp: {
        total: currentXP,
        currentLevelBase: currentLevelXP,
        nextLevelThreshold: nextLevelXP,
        inCurrentLevel: xpInCurrentLevel,
        neededForNext: xpNeededForNextLevel,
        progress: progressPercent
      },
      nextLevel: {
        level: nextLevel,
        title: ExperienceService.LEVEL_TITLES[nextLevel],
        xpRequired: nextLevelXP
      }
    };

  } catch (error) {
    ErrorHandler.logError('ExperienceService.getPlayerXPStatus', error, { playerId });
    return { success: false, error: error.message };
  }
};

/**
 * Retorna ranking de jogadores por XP total
 * @param {number} limit - Número máximo de jogadores no ranking
 * @returns {Array} Lista de jogadores ordenada por XP
 */
ExperienceService.getXPLeaderboard = function(limit) {
  try {
    const maxLimit = Math.min(Number(limit) || 10, 100);

    // Busca todos jogadores ativos
    const players = PlayerService.getAllPlayers(true);
    
    // Ordena pela progressão, sem contaminar o ranking com saldo hídrico.
    players.sort(function(a, b) {
      const xpA = ExperienceService.getEffectiveXP(a);
      const xpB = ExperienceService.getEffectiveXP(b);
      return xpB - xpA;  // Ordem decrescente
    });

    // Mapeia para formato de ranking
    const leaderboard = players.slice(0, maxLimit).map(function(player, index) {
      const xp = ExperienceService.getEffectiveXP(player);
      return {
        rank: index + 1,
        playerId: player.playerId,
        playerName: player.playerName,
        level: player.level,
        levelTitle: ExperienceService.LEVEL_TITLES[player.level] || 'Iniciante',
        totalXP: xp,
        villageId: player.villageId,
        sustainabilityScore: player.sustainabilityScore
      };
    });

    return leaderboard;

  } catch (error) {
    ErrorHandler.logError('ExperienceService.getXPLeaderboard', error, { limit });
    return [];
  }
};

/**
 * Concede XP automático após uma rodada investigativa
 * @param {string} playerId - ID do jogador
 * @param {Object} roundResult - Resultado da rodada do GameEngine
 * @returns {Object} Resultado da concessão de XP
 */
ExperienceService.awardXPForRound = function(playerId, roundResult) {
  try {
    if (!playerId || !roundResult) {
      return { success: false, error: 'playerId e roundResult são obrigatórios' };
    }

    // Calcula XP da rodada
    const xpCalculation = ExperienceService.calculateXPForRound(roundResult);

    if (xpCalculation.totalXP === 0) {
      return { success: true, xpAwarded: 0, message: 'Nenhum XP concedido' };
    }

    // Concede XP
    const awardResult = ExperienceService.awardXP(
      playerId,
      xpCalculation.totalXP,
      'Rodada investigativa concluída'
    );

    if (awardResult.success) {
      awardResult.breakdown = xpCalculation.breakdown;
    }

    return awardResult;

  } catch (error) {
    ErrorHandler.logError('ExperienceService.awardXPForRound', error, { playerId, roundResult });
    return { success: false, error: error.message };
  }
};
