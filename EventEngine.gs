/**
 * @file EventEngine.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Motor de eventos automáticos que monitora condições do jogo
 *              e dispara eventos narrativos contextualizados.
 * 
 * @context Anteriormente eventos eram apenas registrados manualmente.
 *          Este motor adiciona camada de inteligência que responde
 *          automaticamente a condições críticas ou conquistas.
 * 
 * @principais_funcionalidades
 * - checkConditions(gameState): Verifica todas condições e dispara eventos
 * - checkAquiferConditions(aquifer): Monitora níveis críticos
 * - checkVillageConditions(village): Monitora sustentabilidade e recursos
 * - checkPlayerAchievements(player): Detecta conquistas especiais
 * - triggerEvent(eventData): Dispara evento com notificações
 */

function EventEngine() {
  Logger.log("Iniciando componente: EventEngine.gs");
}

/**
 * Define condições que disparam eventos automáticos
 */
EventEngine.CONDITIONS = {
  AQUIFER_CRITICAL: {
    type: 'AQUIFER_CRITICAL',
    check: function(aquifer) {
      return aquifer && aquifer.status === 'CRÍTICO';
    },
    event: {
      title: '🚨 ALERTA: Aquífero em Nível Crítico',
      description: 'O aquífero atingiu nível crítico. Ações urgentes são necessárias para evitar colapso hídrico.',
      eventType: 'CRISIS',
      impact: 'Redução drástica na disponibilidade de água para todas as vilas'
    }
  },
  
  AQUIFER_WARNING: {
    type: 'AQUIFER_WARNING',
    check: function(aquifer) {
      return aquifer && aquifer.status === 'ALERTA' && aquifer.depth > Config.AQUIFER.CRITICAL_THRESHOLD;
    },
    event: {
      title: '⚠️ Aquífero em Alerta',
      description: 'O nível do aquífero está abaixo do recomendado. Monitore o uso de água.',
      eventType: 'WARNING',
      impact: 'Possível escassez se o consumo não for moderado'
    }
  },
  
  AQUIFER_RECOVERED: {
    type: 'AQUIFER_RECOVERED',
    check: function(aquifer, previousState) {
      return aquifer && aquifer.status === 'ESTÁVEL' && 
             previousState && (previousState.status === 'CRÍTICO' || previousState.status === 'ALERTA');
    },
    event: {
      title: '✅ Aquífero Recuperado',
      description: 'Boas notícias! O aquífero retornou a níveis seguros graças à recarga e gestão consciente.',
      eventType: 'SUCCESS',
      impact: 'Disponibilidade hídrica normalizada'
    }
  },
  
  VILLAGE_HIGH_SUSTAINABILITY: {
    type: 'VILLAGE_HIGH_SUSTAINABILITY',
    check: function(village) {
      return village && village.sustainabilityIndex >= 90 && village.status === 'ATIVA';
    },
    event: {
      title: '🌟 Vila Exemplo de Sustentabilidade',
      description: 'A vila alcançou excelência em sustentabilidade! Um modelo para toda a região.',
      eventType: 'ACHIEVEMENT',
      impact: 'Inspiração para outras comunidades'
    }
  },
  
  VILLAGE_LOW_SUSTAINABILITY: {
    type: 'VILLAGE_LOW_SUSTAINABILITY',
    check: function(village) {
      return village && village.sustainabilityIndex <= 30 && village.status === 'ATIVA';
    },
    event: {
      title: '📉 Vila em Risco Ambiental',
      description: 'A sustentabilidade da vila está muito baixa. Reavalie práticas e decisões territoriais.',
      eventType: 'WARNING',
      impact: 'Degradação ambiental crescente'
    }
  },
  
  VILLAGE_WATER_SHORTAGE: {
    type: 'VILLAGE_WATER_SHORTAGE',
    check: function(village) {
      return village && village.waterAllocation < 500 && village.status === 'ATIVA';
    },
    event: {
      title: '💧 Escassez de Água na Vila',
      description: 'A vila está com reservas de água muito baixas. Priorize conservação e busque fontes alternativas.',
      eventType: 'CRISIS',
      impact: 'Restrições severas de consumo necessárias'
    }
  },
  
  PLAYER_HIGH_LEVEL: {
    type: 'PLAYER_HIGH_LEVEL',
    check: function(player) {
      return player && player.level >= 8;
    },
    event: {
      title: '👑 Jogador Experiente Reconhecido',
      description: 'Parabéns por alcançar um nível elevado! Sua experiência é valiosa para a comunidade.',
      eventType: 'ACHIEVEMENT',
      impact: 'Reconhecimento e respeito da comunidade'
    }
  },
  
  CLIMATE_DROUGHT: {
    type: 'CLIMATE_DROUGHT',
    check: function(climate) {
      return climate && climate.status === 'SECA' && climate.drySpellLength >= 3;
    },
    event: {
      title: '☀️ Período de Estiagem Prolongada',
      description: 'A região enfrenta estiagem prolongada. Prepare-se para impactos na produção e disponibilidade hídrica.',
      eventType: 'WARNING',
      impact: 'Redução na recarga do aquífero e estresse hídrico'
    }
  },
  
  CLIMATE_RAIN_SEASON: {
    type: 'CLIMATE_RAIN_SEASON',
    check: function(climate) {
      return climate && climate.rainValue > 150 && climate.season === 'Úmido';
    },
    event: {
      title: '🌧️ Período Chuvoso Favorável',
      description: 'As chuvas estão intensas! Excelente momento para recarga do aquífero e planejamento agrícola.',
      eventType: 'INFO',
      impact: 'Recarga acelerada do aquífero'
    }
  }
};

/**
 * Verifica todas condições do jogo e dispara eventos necessários
 * @param {Object} gameState - Estado atual do jogo { aquifer, villages, players, climate, round }
 * @returns {Object} { success, eventsTriggered }
 */
EventEngine.checkConditions = function(gameState) {
  try {
    if (!gameState) {
      return { success: false, error: 'gameState é obrigatório' };
    }

    const triggeredEvents = [];
    const state = gameState || {};
    const round = Number(state.round) || 0;

    // Verifica condições do aquífero
    if (state.aquifer) {
      const aquiferEvents = EventEngine.checkAquiferConditions(state.aquifer, state.previousAquifer, round);
      triggeredEvents.push(...aquiferEvents);
    }

    // Verifica condições das vilas
    if (state.villages && Array.isArray(state.villages)) {
      state.villages.forEach(function(village) {
        const villageEvents = EventEngine.checkVillageConditions(village, round);
        triggeredEvents.push(...villageEvents);
      });
    }

    // Verifica conquistas de jogadores
    if (state.players && Array.isArray(state.players)) {
      state.players.forEach(function(player) {
        const playerEvents = EventEngine.checkPlayerAchievements(player, round);
        triggeredEvents.push(...playerEvents);
      });
    }

    // Verifica condições climáticas
    if (state.climate) {
      const climateEvents = EventEngine.checkClimateConditions(state.climate, round);
      triggeredEvents.push(...climateEvents);
    }

    return {
      success: true,
      eventsTriggered: triggeredEvents.length,
      events: triggeredEvents
    };

  } catch (error) {
    ErrorHandler.logError('EventEngine.checkConditions', error, gameState);
    return { success: false, error: error.message };
  }
};

/**
 * Verifica condições do aquífero
 */
EventEngine.checkAquiferConditions = function(aquifer, previousAquifer, round) {
  const events = [];

  // Aquífero crítico
  if (EventEngine.CONDITIONS.AQUIFER_CRITICAL.check(aquifer)) {
    const event = EventEngine.triggerEvent(
      Object.assign({}, EventEngine.CONDITIONS.AQUIFER_CRITICAL.event, { round: round })
    );
    if (event.success) events.push(event.event);
  }
  // Aquífero em alerta
  else if (EventEngine.CONDITIONS.AQUIFER_WARNING.check(aquifer)) {
    const event = EventEngine.triggerEvent(
      Object.assign({}, EventEngine.CONDITIONS.AQUIFER_WARNING.event, { round: round })
    );
    if (event.success) events.push(event.event);
  }
  // Aquífero recuperado
  else if (EventEngine.CONDITIONS.AQUIFER_RECOVERED.check(aquifer, previousAquifer)) {
    const event = EventEngine.triggerEvent(
      Object.assign({}, EventEngine.CONDITIONS.AQUIFER_RECOVERED.event, { round: round })
    );
    if (event.success) events.push(event.event);
  }

  return events;
};

/**
 * Verifica condições de uma vila
 */
EventEngine.checkVillageConditions = function(village, round) {
  const events = [];

  if (!village) return events;

  // Sustentabilidade alta
  if (EventEngine.CONDITIONS.VILLAGE_HIGH_SUSTAINABILITY.check(village)) {
    const event = EventEngine.triggerEvent(
      Object.assign({}, EventEngine.CONDITIONS.VILLAGE_HIGH_SUSTAINABILITY.event, {
        round: round,
        description: `A vila ${village.name} alcançou excelência em sustentabilidade!`,
        affectedPlayers: ''  // Vila inteira
      })
    );
    if (event.success) events.push(event.event);
  }
  
  // Sustentabilidade baixa
  if (EventEngine.CONDITIONS.VILLAGE_LOW_SUSTAINABILITY.check(village)) {
    const event = EventEngine.triggerEvent(
      Object.assign({}, EventEngine.CONDITIONS.VILLAGE_LOW_SUSTAINABILITY.event, {
        round: round,
        description: `A vila ${village.name} está em risco ambiental.`,
        affectedPlayers: ''
      })
    );
    if (event.success) events.push(event.event);
  }

  // Escassez de água
  if (EventEngine.CONDITIONS.VILLAGE_WATER_SHORTAGE.check(village)) {
    const event = EventEngine.triggerEvent(
      Object.assign({}, EventEngine.CONDITIONS.VILLAGE_WATER_SHORTAGE.event, {
        round: round,
        description: `A vila ${village.name} enfrenta escassez de água.`,
        affectedPlayers: ''
      })
    );
    if (event.success) events.push(event.event);
  }

  return events;
};

/**
 * Verifica conquistas de um jogador
 */
EventEngine.checkPlayerAchievements = function(player, round) {
  const events = [];

  if (!player) return events;

  // Jogador de alto nível
  if (EventEngine.CONDITIONS.PLAYER_HIGH_LEVEL.check(player)) {
    const event = EventEngine.triggerEvent(
      Object.assign({}, EventEngine.CONDITIONS.PLAYER_HIGH_LEVEL.event, {
        round: round,
        description: `${player.playerName} alcançou nível ${player.level}!`,
        affectedPlayers: player.playerId
      })
    );
    if (event.success) events.push(event.event);
  }

  return events;
};

/**
 * Verifica condições climáticas
 */
EventEngine.checkClimateConditions = function(climate, round) {
  const events = [];

  if (!climate) return events;

  // Período de seca
  if (EventEngine.CONDITIONS.CLIMATE_DROUGHT.check(climate)) {
    const event = EventEngine.triggerEvent(
      Object.assign({}, EventEngine.CONDITIONS.CLIMATE_DROUGHT.event, {
        round: round,
        affectedPlayers: ''
      })
    );
    if (event.success) events.push(event.event);
  }

  // Período chuvoso
  if (EventEngine.CONDITIONS.CLIMATE_RAIN_SEASON.check(climate)) {
    const event = EventEngine.triggerEvent(
      Object.assign({}, EventEngine.CONDITIONS.CLIMATE_RAIN_SEASON.event, {
        round: round,
        affectedPlayers: ''
      })
    );
    if (event.success) events.push(event.event);
  }

  return events;
};

/**
 * Dispara um evento e envia notificações
 */
EventEngine.triggerEvent = function(eventData) {
  try {
    if (!eventData || !eventData.title) {
      return { success: false, error: 'eventData.title é obrigatório' };
    }

    // Registra evento no histórico
    const historyResult = HistoryService.recordEvent({
      round: eventData.round || 0,
      eventType: eventData.eventType || 'INFO',
      title: eventData.title,
      description: eventData.description || '',
      impact: eventData.impact || '',
      affectedPlayers: eventData.affectedPlayers || ''
    });

    if (!historyResult.success) {
      return historyResult;
    }

    // Envia notificações para jogadores afetados
    if (eventData.affectedPlayers && typeof NotificationService !== 'undefined') {
      const playerIds = String(eventData.affectedPlayers).split(',').filter(function(id) {
        return id && id.trim();
      });

      playerIds.forEach(function(playerId) {
        NotificationService.sendNotification(playerId.trim(), {
          type: eventData.eventType === 'CRISIS' ? 'ERROR' : 
                eventData.eventType === 'WARNING' ? 'WARNING' : 
                eventData.eventType === 'ACHIEVEMENT' ? 'SUCCESS' : 'INFO',
          title: eventData.title,
          message: eventData.description,
          villageId: ''
        });
      });
    }

    // Se não há jogadores específicos, é um evento global - notifica todos
    if (!eventData.affectedPlayers || eventData.affectedPlayers === '') {
      // Eventos globais podem ser mostrados em dashboard ou broadcast
      // Por ora, apenas registra no log
      Logger.log('Evento global disparado: ' + eventData.title);
    }

    // Log de auditoria
    AuditLog.logEvent('EVENT_TRIGGERED', {
      eventType: eventData.eventType,
      title: eventData.title,
      round: eventData.round
    });

    return {
      success: true,
      event: historyResult.event,
      message: 'Evento disparado: ' + eventData.title
    };

  } catch (error) {
    ErrorHandler.logError('EventEngine.triggerEvent', error, eventData);
    return { success: false, error: error.message };
  }
};

/**
 * Processa verificação automática de eventos para rodada atual
 * Função auxiliar para ser chamada pelo GameEngine
 */
EventEngine.processRoundEvents = function(round) {
  try {
    const aquiferHistory = AquiferService.getHistory(2);
    const gameState = {
      round: round,
      aquifer: AquiferService.getCurrentStatus(),
      villages: VillageService.getAllVillages(true),
      climate: ClimateService.getCurrentClimate(),
      players: [], // Pode ser filtrado para jogadores ativos recentemente
      previousAquifer: EventEngine.getPreviousAquiferState(aquiferHistory)
    };

    return EventEngine.checkConditions(gameState);

  } catch (error) {
    ErrorHandler.logError('EventEngine.processRoundEvents', error, { round });
    return { success: false, error: error.message };
  }
};

/**
 * Seleciona a medição imediatamente anterior à atual.
 * AquiferService.getHistory devolve registros do mais novo para o mais antigo.
 */
EventEngine.getPreviousAquiferState = function(history) {
  if (!Array.isArray(history) || history.length < 2) return null;
  const previous = history[1];
  if (!previous || typeof previous !== 'object') return null;
  return previous;
};
