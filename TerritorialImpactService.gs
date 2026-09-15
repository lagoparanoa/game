/**
 * @file TerritorialImpactService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Serviço que aplica efeitos reais das decisões territoriais nas vilas.
 *              Fecha o loop de gameplay: decisões registradas no histórico agora
 *              modificam recursos, sustentabilidade e capacidades da vila.
 * 
 * @context Anteriormente, ApiGateway.recordVillageDecision() apenas registrava
 *          decisões sem efeito prático. Este serviço implementa as consequências.
 * 
 * @principais_funcionalidades
 * - applyDecision(villageId, decisionId): Aplica efeito de uma decisão
 * - processVillageDecisions(villageId): Processa todas decisões pendentes
 * - getDecisionEffects(decisionId): Retorna preview dos efeitos
 * - calculateCumulativeImpact(villageId): Calcula impacto acumulado
 */

function TerritorialImpactService() {
  Logger.log("Iniciando componente: TerritorialImpactService.gs");
}

/**
 * Definição dos efeitos de cada decisão territorial
 */
TerritorialImpactService.DECISION_EFFECTS = {
  'protect-spring': {
    name: 'Proteger áreas de nascente',
    waterAllocationMultiplier: 1.15,  // +15% na alocação de água
    sustainabilityDelta: 8,            // +8 pontos de sustentabilidade
    foodStockDelta: -50,               // -50 unidades (custo de implementação)
    duration: 3,                       // Efeito dura 3 rodadas
    description: 'Proteção de nascentes aumenta recarga hídrica mas exige redução de área agricultável'
  },
  'compact-growth': {
    name: 'Compactar o crescimento urbano',
    waterAllocationMultiplier: 1.10,  // +10% na alocação de água
    sustainabilityDelta: 12,           // +12 pontos de sustentabilidade
    foodStockDelta: 0,                 // Sem impacto direto na comida
    duration: 5,                       // Efeito de longo prazo
    description: 'Crescimento compacto reduz impermeabilização e melhora eficiência hídrica'
  },
  'green-mobility': {
    name: 'Investir em mobilidade verde',
    waterAllocationMultiplier: 1.05,  // +5% na alocação de água
    sustainabilityDelta: 15,           // +15 pontos de sustentabilidade
    foodStockDelta: -100,              // -100 unidades (investimento alto)
    duration: 4,                       // Efeito de médio prazo
    description: 'Mobilidade verde reduz poluição e melhora qualidade ambiental geral'
  },
  'expand-orla-livre': {
    name: 'Expandir Orla Livre',
    waterAllocationMultiplier: 1.08,  // +8% na alocação de água
    sustainabilityDelta: 10,           // +10 pontos de sustentabilidade
    foodStockDelta: -30,               // -30 unidades (custo moderado)
    duration: 6,                       // Efeito duradouro
    description: 'Orla livre protege margens e facilita infiltração natural'
  }
};

/**
 * Aplica uma decisão territorial a uma vila
 * @param {string} villageId - ID da vila
 * @param {string} decisionId - ID da decisão (protect-spring, compact-growth, etc)
 * @param {number} round - Rodada em que a decisão foi tomada
 * @returns {Object} { success, effects, message }
 */
TerritorialImpactService.applyDecision = function(villageId, decisionId, round) {
  try {
    // Valida entrada
    if (!villageId || !decisionId) {
      return { success: false, error: 'villageId e decisionId são obrigatórios' };
    }

    // Verifica se a decisão existe
    const decisionConfig = TerritorialImpactService.DECISION_EFFECTS[decisionId];
    if (!decisionConfig) {
      return { success: false, error: 'Decisão territorial não reconhecida: ' + decisionId };
    }

    // Busca a vila
    const village = VillageService.getVillageById(villageId);
    if (!village) {
      return { success: false, error: 'Vila não encontrada: ' + villageId };
    }

    if (village.status !== 'ATIVA') {
      return { success: false, error: 'Vila inativa não pode receber decisões territoriais' };
    }

    // Calcula novos valores
    const currentWater = Number(village.waterAllocation) || 0;
    const currentFood = Number(village.foodStock) || 0;
    const currentSustainability = Number(village.sustainabilityIndex) || 50;

    const newWater = Math.round(currentWater * decisionConfig.waterAllocationMultiplier);
    const newFood = Math.max(0, currentFood + decisionConfig.foodStockDelta);
    const newSustainability = Math.min(100, Math.max(0, currentSustainability + decisionConfig.sustainabilityDelta));

    // Aplica mudanças na vila
    const updateResult = VillageService.updateVillage(villageId, {
      waterAllocation: newWater,
      foodStock: newFood,
      sustainabilityIndex: newSustainability
    });

    if (!updateResult.success) {
      return updateResult;
    }

    // Registra o efeito no histórico
    const effects = {
      decisionId: decisionId,
      decisionName: decisionConfig.name,
      appliedAt: new Date(),
      appliedRound: Number(round) || 0,
      expiresRound: (Number(round) || 0) + decisionConfig.duration,
      changes: {
        waterAllocation: { before: currentWater, after: newWater, delta: newWater - currentWater },
        foodStock: { before: currentFood, after: newFood, delta: decisionConfig.foodStockDelta },
        sustainabilityIndex: { before: currentSustainability, after: newSustainability, delta: decisionConfig.sustainabilityDelta }
      }
    };

    // Registra evento no histórico do jogo
    if (typeof HistoryService !== 'undefined' && HistoryService.recordEvent) {
      HistoryService.recordEvent({
        round: Number(round) || 0,
        eventType: 'TERRITORIAL_DECISION',
        title: 'Decisão Territorial Aplicada',
        description: decisionConfig.description,
        impact: `Água: ${effects.changes.waterAllocation.delta > 0 ? '+' : ''}${effects.changes.waterAllocation.delta}L, ` +
                `Comida: ${effects.changes.foodStock.delta > 0 ? '+' : ''}${effects.changes.foodStock.delta}, ` +
                `Sustentabilidade: ${effects.changes.sustainabilityIndex.delta > 0 ? '+' : ''}${effects.changes.sustainabilityIndex.delta}`,
        affectedPlayers: ''  // Afeta toda a vila
      });
    }

    // Log de auditoria
    AuditLog.logEvent('TERRITORIAL_IMPACT_APPLIED', {
      villageId: villageId,
      decisionId: decisionId,
      round: round,
      effects: effects
    });

    return {
      success: true,
      message: `Decisão "${decisionConfig.name}" aplicada com sucesso à vila ${village.name}`,
      effects: effects,
      village: updateResult.village
    };

  } catch (error) {
    ErrorHandler.logError('TerritorialImpactService.applyDecision', error, { villageId, decisionId, round });
    return { success: false, error: error.message };
  }
};

/**
 * Processa todas decisões territoriais pendentes de uma vila
 * Busca no histórico e aplica efeitos ainda não processados
 * @param {string} villageId - ID da vila
 * @param {number} currentRound - Rodada atual do jogo
 * @returns {Object} { success, decisionsProcessed, effects }
 */
TerritorialImpactService.processVillageDecisions = function(villageId, currentRound) {
  try {
    if (!villageId) {
      return { success: false, error: 'villageId é obrigatório' };
    }

    const round = Number(currentRound) || 0;
    const processedEffects = [];
    let decisionsCount = 0;

    // Busca decisões territoriais no histórico
    if (typeof HistoryService !== 'undefined' && HistoryService.getVillageHistory) {
      const villageHistory = HistoryService.getVillageHistory(villageId, 50);
      
      // Filtra apenas registros de decisões territoriais
      const territorialDecisions = villageHistory.filter(function(record) {
        const metrics = record.metrics || {};
        return metrics.decisionType === 'territorial' && !metrics.processed;
      });

      // Aplica cada decisão
      territorialDecisions.forEach(function(decision) {
        const metrics = decision.metrics || {};
        const decisionId = metrics.decisionId || metrics.optionId;
        
        if (decisionId && TerritorialImpactService.DECISION_EFFECTS[decisionId]) {
          const result = TerritorialImpactService.applyDecision(
            villageId, 
            decisionId, 
            decision.round
          );
          
          if (result.success) {
            processedEffects.push(result.effects);
            decisionsCount++;
          }
        }
      });
    }

    return {
      success: true,
      decisionsProcessed: decisionsCount,
      effects: processedEffects,
      message: decisionsCount > 0 
        ? `${decisionsCount} decisão(ões) territorial(is) processada(s)` 
        : 'Nenhuma decisão territorial pendente'
    };

  } catch (error) {
    ErrorHandler.logError('TerritorialImpactService.processVillageDecisions', error, { villageId, currentRound });
    return { success: false, error: error.message };
  }
};

/**
 * Retorna preview dos efeitos de uma decisão (sem aplicar)
 * @param {string} decisionId - ID da decisão
 * @param {string} villageId - ID da vila (opcional, para cálculo preciso)
 * @returns {Object} { success, preview }
 */
TerritorialImpactService.getDecisionEffects = function(decisionId, villageId) {
  try {
    const decisionConfig = TerritorialImpactService.DECISION_EFFECTS[decisionId];
    
    if (!decisionConfig) {
      return { success: false, error: 'Decisão não encontrada: ' + decisionId };
    }

    let preview = {
      decisionId: decisionId,
      name: decisionConfig.name,
      description: decisionConfig.description,
      duration: decisionConfig.duration + ' rodadas',
      effects: {
        waterAllocation: decisionConfig.waterAllocationMultiplier > 1 
          ? '+' + Math.round((decisionConfig.waterAllocationMultiplier - 1) * 100) + '%'
          : Math.round((decisionConfig.waterAllocationMultiplier - 1) * 100) + '%',
        sustainabilityIndex: (decisionConfig.sustainabilityDelta > 0 ? '+' : '') + decisionConfig.sustainabilityDelta + ' pontos',
        foodStock: (decisionConfig.foodStockDelta > 0 ? '+' : '') + decisionConfig.foodStockDelta + ' unidades'
      }
    };

    // Se villageId fornecido, calcula valores exatos
    if (villageId) {
      const village = VillageService.getVillageById(villageId);
      if (village) {
        const currentWater = Number(village.waterAllocation) || 0;
        const currentFood = Number(village.foodStock) || 0;
        const currentSustainability = Number(village.sustainabilityIndex) || 50;

        preview.exactValues = {
          waterAllocation: {
            current: currentWater,
            after: Math.round(currentWater * decisionConfig.waterAllocationMultiplier),
            delta: Math.round(currentWater * decisionConfig.waterAllocationMultiplier) - currentWater
          },
          foodStock: {
            current: currentFood,
            after: Math.max(0, currentFood + decisionConfig.foodStockDelta),
            delta: decisionConfig.foodStockDelta
          },
          sustainabilityIndex: {
            current: currentSustainability,
            after: Math.min(100, Math.max(0, currentSustainability + decisionConfig.sustainabilityDelta)),
            delta: decisionConfig.sustainabilityDelta
          }
        };
      }
    }

    return { success: true, preview: preview };

  } catch (error) {
    ErrorHandler.logError('TerritorialImpactService.getDecisionEffects', error, { decisionId, villageId });
    return { success: false, error: error.message };
  }
};

/**
 * Calcula o impacto acumulado de todas decisões ativas de uma vila
 * @param {string} villageId - ID da vila
 * @param {number} currentRound - Rodada atual
 * @returns {Object} { success, impact }
 */
TerritorialImpactService.calculateCumulativeImpact = function(villageId, currentRound) {
  try {
    if (!villageId) {
      return { success: false, error: 'villageId é obrigatório' };
    }

    const round = Number(currentRound) || 0;
    const activeDecisions = [];
    let totalWaterBonus = 0;
    let totalSustainabilityBonus = 0;

    // Busca decisões ativas no histórico
    if (typeof HistoryService !== 'undefined' && HistoryService.getEventHistory) {
      const events = HistoryService.getEventHistory({ eventType: 'TERRITORIAL_DECISION' });
      
      events.forEach(function(event) {
        // Verifica se a decisão ainda está ativa
        const decisionRound = Number(event.round) || 0;
        // Parse impact para extrair informações (simplificado)
        if (round - decisionRound <= 10) { // Considera decisões dos últimos 10 rounds
          activeDecisions.push({
            round: decisionRound,
            title: event.title,
            impact: event.impact
          });
        }
      });
    }

    return {
      success: true,
      impact: {
        activeDecisions: activeDecisions.length,
        decisions: activeDecisions,
        totalWaterBonus: totalWaterBonus,
        totalSustainabilityBonus: totalSustainabilityBonus
      }
    };

  } catch (error) {
    ErrorHandler.logError('TerritorialImpactService.calculateCumulativeImpact', error, { villageId, currentRound });
    return { success: false, error: error.message };
  }
};

/**
 * Lista todas decisões territoriais disponíveis
 * @returns {Array} Lista de decisões com seus efeitos
 */
TerritorialImpactService.getAvailableDecisions = function() {
  const decisions = [];
  
  Object.keys(TerritorialImpactService.DECISION_EFFECTS).forEach(function(decisionId) {
    const config = TerritorialImpactService.DECISION_EFFECTS[decisionId];
    decisions.push({
      id: decisionId,
      name: config.name,
      description: config.description,
      duration: config.duration,
      waterImpact: config.waterAllocationMultiplier,
      sustainabilityImpact: config.sustainabilityDelta,
      foodImpact: config.foodStockDelta
    });
  });
  
  return decisions;
};
