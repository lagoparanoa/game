/**
 * @file GameEngine.gs
 * @description Núcleo determinístico de uma rodada. A mesma entrada produz o
 *              mesmo resultado, facilitando teste, explicação e retomada.
 */

function GameEngine() {
  Logger.log('Iniciando componente: GameEngine.gs');
}

GameEngine.validateAction = function(action) {
  if (!action || !action.playerId) return { valid: false, error: 'playerId é obrigatório' };
  if (!action.crop) return { valid: false, error: 'Escolha uma cultura antes de agir' };
  if (String(action.prediction || '').trim().length < 12) return { valid: false, error: 'Registre uma previsão antes de agir' };
  if (!Number.isFinite(Number(action.quantity)) || Number(action.quantity) <= 0) return { valid: false, error: 'A quantidade deve ser maior que zero' };
  if (!Number.isFinite(Number(action.waterUsed)) || Number(action.waterUsed) < 0) return { valid: false, error: 'A água usada não pode ser negativa' };
  return { valid: true };
};

GameEngine.buildLearningRecord = function(result) {
  const action = result.action || {};
  return {
    round: result.round,
    playerId: action.playerId,
    villageId: action.villageId || (result.nextState && result.nextState.villageId) || '',
    action: 'rodada-investigativa',
    outcome: result.reflection,
    metrics: Object.assign({}, result.outcome, {
      learning: {
        prediction: String(action.prediction || '').trim().slice(0, 420),
        observation: String(result.narrative && result.narrative.message || result.reflection || '').slice(0, 600),
        reflection: '',
        nextTest: '',
        status: 'awaiting_review'
      },
      crop: { cropId: action.crop.cropId || '', name: action.crop.name || '' }
    }),
    event: {
      eventType: result.outcome.profit >= 0 ? 'ROUND_SUCCESS' : 'ROUND_WARNING',
      title: result.outcome.profit >= 0 ? 'Rodada concluída' : 'Rodada para revisar',
      description: result.reflection,
      impact: 'Produção: ' + result.outcome.yieldUnits + '; água usada: ' + result.outcome.waterUsed
    }
  };
};

GameEngine.resolveRound = function(state, action) {
  const validation = GameEngine.validateAction(action);
  if (!validation.valid) return { success: false, error: validation.error };
  const current = state || {};
  const availableWater = Number(current.waterCredits);
  if (!Number.isFinite(availableWater) || availableWater < 0) {
    return { success: false, error: 'O saldo de água atual é inválido' };
  }
  if (Number(action.waterUsed) > availableWater) {
    return { success: false, error: 'Água insuficiente para esta decisão' };
  }
  const outcome = EconomicService.calculateCropOutcome(
    action.crop,
    action.quantity,
    action.waterUsed,
    action.climate || current.climate || {},
    action.economic || {}
  );
  if (outcome.waterUsed > availableWater) {
    return { success: false, error: 'A cultura exige mais água do que o saldo disponível' };
  }
  const water = availableWater - outcome.waterUsed;
  const food = Math.max(0, Number(current.foodUnits || 0) + outcome.profit);
  const score = Math.min(100, Math.max(0, Number(current.sustainabilityScore || 50) + outcome.sustainabilityDelta));
  const reflection = outcome.waterFactor < 1
    ? 'A produção ficou limitada pela água. O que mudaria na próxima tentativa?'
    : 'Compare o ganho com o impacto no recurso compartilhado.';
  return {
    success: true,
    round: Number(current.round || 0) + 1,
    action: action,
    outcome: outcome,
    nextState: {
      playerId: action.playerId,
      villageId: action.villageId || current.villageId || '',
      round: Number(current.round || 0) + 1,
      waterCredits: Math.round(water * 100) / 100,
      foodUnits: Math.round(food * 100) / 100,
      sustainabilityScore: Math.round(score * 10) / 10,
      climate: action.climate || current.climate || null
    },
    reflection: reflection,
    narrative: typeof NarrativeService !== 'undefined'
      ? NarrativeService.buildRoundNarrative(outcome)
      : { title: 'Rodada concluída', message: reflection, prompt: reflection }
  };
};

/** Calcula uma rodada sem produzir efeitos persistentes. */
GameEngine.prepareRound = function(input) {
  try {
    const payload = input || {};
    const result = GameEngine.resolveRound(payload.state || payload, payload.action || payload);
    return result;
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined') ErrorHandler.logError('GameEngine.prepareRound', error, input || {});
    return { success: false, error: 'Não foi possível calcular a rodada.' };
  }
};

/**
 * Publica os efeitos de uma rodada já persistida no jogador. O histórico é o
 * primeiro efeito e funciona como gate: sem ele, nenhum prêmio ou efeito
 * coletivo é disparado.
 */
GameEngine.commitRoundEffects = function(result) {
  try {
    if (!result || !result.success || !result.action) {
      return { success: false, error: 'Resultado de rodada inválido para confirmação.' };
    }
    const action = result.action;
    const record = GameEngine.buildLearningRecord(result);
    if (typeof HistoryService !== 'undefined' && HistoryService.recordRound) {
      result.history = HistoryService.recordRound(record);
      if (!result.history || !result.history.success) {
        return { success: false, error: 'Erro ao registrar histórico da rodada.', result: result };
      }
    } else {
      return { success: false, error: 'Serviço de histórico indisponível.', result: result };
    }

    // Depois do histórico a rodada está confirmada. Integrações auxiliares
    // falham de modo independente e geram avisos, sem desfazer o estado-base.
    result.warnings = result.warnings || [];
    function runAuxiliaryEffect(name, callback) {
      try {
        return callback();
      } catch (effectError) {
        result.warnings.push({ effect: name, error: 'Integração auxiliar indisponível.' });
        if (typeof ErrorHandler !== 'undefined') {
          ErrorHandler.logError('GameEngine.commitRoundEffects.' + name, effectError, {
            playerId: action.playerId,
            round: result.round
          });
        }
        return null;
      }
    }

    if (typeof NotificationService !== 'undefined' && NotificationService.sendNotification) {
      result.notification = runAuxiliaryEffect('notification', function() {
        return NotificationService.sendNotification(action.playerId, {
          type: result.outcome.profit >= 0 ? 'SUCCESS' : 'WARNING',
          title: record.event.title,
          message: result.reflection,
          villageId: record.villageId
        });
      });
    }
    
    // ========== NOVAS INTEGRAÇÕES ==========
    
    // 1. Concede XP automático pela rodada
    if (typeof ExperienceService !== 'undefined' && ExperienceService.awardXPForRound) {
      const xpResult = runAuxiliaryEffect('experience', function() {
        return ExperienceService.awardXPForRound(action.playerId, result);
      });
      if (xpResult && xpResult.success) {
        result.xp = {
          awarded: xpResult.xpAwarded,
          breakdown: xpResult.breakdown,
          leveledUp: xpResult.leveledUp,
          newLevel: xpResult.newLevel
        };
      }
    }
    
    // 2. Processa recarga do aquífero baseada em clima
    if (typeof AquiferService !== 'undefined' && AquiferService.processMonthlyRecharge) {
      const rechargeResult = runAuxiliaryEffect('aquifer', function() {
        return AquiferService.processMonthlyRecharge(result.round);
      });
      if (rechargeResult && rechargeResult.success) {
        result.aquiferRecharge = {
          amount: rechargeResult.rechargeAmount,
          newLevel: rechargeResult.newLevel,
          status: rechargeResult.status
        };
      }
    }
    
    // 3. Verifica e dispara eventos automáticos
    if (typeof EventEngine !== 'undefined' && EventEngine.processRoundEvents) {
      const eventsResult = runAuxiliaryEffect('events', function() {
        return EventEngine.processRoundEvents(result.round);
      });
      if (eventsResult && eventsResult.success && eventsResult.eventsTriggered > 0) {
        result.eventsTriggered = eventsResult.eventsTriggered;
        result.events = eventsResult.events;
      }
    }
    
    return result;
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined') ErrorHandler.logError('GameEngine.commitRoundEffects', error, result || {});
    return { success: false, error: 'Não foi possível confirmar os efeitos da rodada.', result: result };
  }
};

/** Compatibilidade para consumidores internos que já controlam a persistência. */
GameEngine.processRound = function(input) {
  const prepared = GameEngine.prepareRound(input);
  if (!prepared.success) return prepared;
  return GameEngine.commitRoundEffects(prepared);
};

/**
 * Processa fim de rodada com todas integrações
 * Versão completa que inclui processamento de decisões territoriais
 * @param {number} round - Número da rodada
 * @returns {Object} Resultado do processamento completo
 */
GameEngine.processEndOfRound = function(round) {
  try {
    const roundNumber = Number(round) || 0;
    const results = {
      round: roundNumber,
      aquifer: null,
      events: [],
      territorially: [],
      timestamp: new Date()
    };
    
    // 1. Processa recarga do aquífero
    if (typeof AquiferService !== 'undefined' && AquiferService.processMonthlyRecharge) {
      results.aquifer = AquiferService.processMonthlyRecharge(roundNumber);
    }
    
    // 2. Processa decisões territoriais de todas as vilas
    if (typeof VillageService !== 'undefined' && typeof TerritorialImpactService !== 'undefined') {
      const villages = VillageService.getAllVillages(true);
      villages.forEach(function(village) {
        const territorialResult = TerritorialImpactService.processVillageDecisions(village.villageId, roundNumber);
        if (territorialResult.success && territorialResult.decisionsProcessed > 0) {
          results.territorially.push({
            villageId: village.villageId,
            villageName: village.name,
            decisionsProcessed: territorialResult.decisionsProcessed,
            effects: territorialResult.effects
          });
        }
      });
    }
    
    // 3. Verifica condições e dispara eventos automáticos
    if (typeof EventEngine !== 'undefined' && EventEngine.processRoundEvents) {
      const eventsResult = EventEngine.processRoundEvents(roundNumber);
      if (eventsResult.success) {
        results.events = eventsResult.events || [];
        results.eventsTriggered = eventsResult.eventsTriggered || 0;
      }
    }
    
    // 4. Atualiza índices de sustentabilidade das vilas
    if (typeof VillageService !== 'undefined') {
      const villages = VillageService.getAllVillages(true);
      villages.forEach(function(village) {
        VillageService.calculateSustainabilityIndex(village.villageId);
      });
    }
    
    // Log de auditoria
    if (typeof AuditLog !== 'undefined') {
      AuditLog.logEvent('END_OF_ROUND_PROCESSED', {
        round: roundNumber,
        aquiferRecharged: results.aquifer && results.aquifer.success,
        territoriesProcessed: results.territorially.length,
        eventsTriggered: results.eventsTriggered || 0
      });
    }
    
    return {
      success: true,
      message: 'Fim de rodada processado com sucesso',
      data: results
    };
    
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined') {
      ErrorHandler.logError('GameEngine.processEndOfRound', error, { round: round });
    }
    return { success: false, error: 'Erro ao processar fim de rodada: ' + error.message };
  }
};

/**
 * Inicializa ou reinicia o jogo
 * Configura estado inicial de todos os sistemas
 */
GameEngine.initializeGame = function() {
  try {
    const results = {
      aquifer: null,
      climate: null,
      timestamp: new Date()
    };
    
    // 1. Inicializa aquífero
    if (typeof AquiferService !== 'undefined' && AquiferService.initialize) {
      results.aquifer = AquiferService.initialize();
    }
    
    // 2. Define clima inicial
    if (typeof ClimateService !== 'undefined' && ClimateService.setInitialRainfall) {
      const today = new Date();
      const month = today.getMonth() + 1;
      const isWetSeason = month >= Config.CLIMATE.WET_SEASON_START || month <= Config.CLIMATE.WET_SEASON_END;
      const initialRainfall = isWetSeason ? 180 : 50;
      results.climate = ClimateService.setInitialRainfall(initialRainfall);
    }
    
    // Log de auditoria
    if (typeof AuditLog !== 'undefined') {
      AuditLog.logEvent('GAME_INITIALIZED', {
        aquifer: results.aquifer && results.aquifer.success,
        climate: results.climate
      });
    }
    
    return {
      success: true,
      message: 'Jogo inicializado com sucesso',
      data: results
    };
    
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined') {
      ErrorHandler.logError('GameEngine.initializeGame', error);
    }
    return { success: false, error: 'Erro ao inicializar jogo: ' + error.message };
  }
};
