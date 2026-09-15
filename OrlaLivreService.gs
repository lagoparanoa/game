/**
 * @file OrlaLivreService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Fiscalização pedagógica e governança da faixa de proteção da orla.
 *              As leituras de campo são validadas, avaliadas e persistidas no
 *              histórico da vila; ausência de medição nunca vira dado sintético.
 */

function OrlaLivreService() {
  Logger.log('Iniciando componente: OrlaLivreService.gs');
}

OrlaLivreService.APP_BUFFER_METERS = 30;
OrlaLivreService.MAX_SHORE_METERS = 100000;

OrlaLivreService.ZONE_RULES = {
  PUBLIC_PARK: { allowed: true, impact: 'POSITIVO', label: 'Parque Público Ecológico' },
  REFORESTATION: { allowed: true, impact: 'POSITIVO', label: 'Reflorestamento de Mata Ciliar' },
  PIER_PUBLIC: { allowed: true, impact: 'NEUTRO', label: 'Trapiche Público com Acesso Livre' },
  FENCE_PRIVATE: { allowed: false, impact: 'NEGATIVO', label: 'Cerca Privativa Irregular' },
  DEFORESTATION: { allowed: false, impact: 'CRITICO', label: 'Supressão de Vegetação Nativa' },
  ILLEGAL_CONSTRUCTION: { allowed: false, impact: 'CRITICO', label: 'Edificação Irregular em APP' }
};

OrlaLivreService.toFiniteNumber_ = function(value, field, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(field + ' deve estar entre ' + min + ' e ' + max + '.');
  }
  return parsed;
};

OrlaLivreService.normalizeObservation_ = function(observation) {
  const input = observation || {};
  const total = OrlaLivreService.toFiniteNumber_(
    input.totalShoreMeters,
    'Extensão total da orla',
    1,
    OrlaLivreService.MAX_SHORE_METERS
  );
  const occupied = OrlaLivreService.toFiniteNumber_(
    input.occupiedMeters,
    'Trecho ocupado irregularmente',
    0,
    total
  );
  const forestPercent = OrlaLivreService.toFiniteNumber_(
    input.riparianForestPercent,
    'Cobertura de mata ciliar',
    0,
    100
  );
  const distance = OrlaLivreService.toFiniteNumber_(
    input.distanceToShore,
    'Distância até o espelho d’água',
    0,
    OrlaLivreService.MAX_SHORE_METERS
  );
  const interventionType = String(input.interventionType || '').trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(OrlaLivreService.ZONE_RULES, interventionType)) {
    throw new Error('Tipo de intervenção não reconhecido.');
  }

  return {
    totalShoreMeters: total,
    occupiedMeters: occupied,
    riparianForestPercent: forestPercent,
    distanceToShore: distance,
    interventionType: interventionType,
    note: String(input.note || '').trim().slice(0, 420)
  };
};

/** Avalia a conformidade de uma intervenção na faixa de proteção de 30 m. */
OrlaLivreService.checkAppCompliance = function(distanceToShore, interventionType) {
  try {
    const dist = OrlaLivreService.toFiniteNumber_(
      distanceToShore,
      'Distância até o espelho d’água',
      0,
      OrlaLivreService.MAX_SHORE_METERS
    );
    const type = String(interventionType || '').trim().toUpperCase();
    const rule = OrlaLivreService.ZONE_RULES[type];
    if (!rule) throw new Error('Tipo de intervenção não reconhecido.');

    const isInsideApp = dist < OrlaLivreService.APP_BUFFER_METERS;
    const isCompliant = !isInsideApp || (rule.allowed && rule.impact === 'POSITIVO');
    const sustainabilityDelta = !isCompliant ? -15 : (rule.impact === 'POSITIVO' ? 10 : 0);

    return {
      success: true,
      compliant: isCompliant,
      distance: dist,
      requiredDistance: OrlaLivreService.APP_BUFFER_METERS,
      isInsideApp: isInsideApp,
      interventionType: type,
      interventionLabel: rule.label,
      impact: rule.impact,
      sustainabilityDelta: sustainabilityDelta,
      observation: isCompliant
        ? 'Intervenção compatível com as regras pedagógicas da faixa de proteção.'
        : 'Irregularidade detectada na faixa de 30 m da orla.'
    };
  } catch (error) {
    ErrorHandler.logError('OrlaLivreService.checkAppCompliance', error);
    return { success: false, compliant: false, error: error.message };
  }
};

/** Calcula integridade ecológica sem substituir entradas ausentes por estimativas. */
OrlaLivreService.calculateEcologicalImpact = function(occupiedMeters, totalShoreMeters, riparianForestRatio) {
  try {
    const total = OrlaLivreService.toFiniteNumber_(totalShoreMeters, 'Extensão total da orla', 1, OrlaLivreService.MAX_SHORE_METERS);
    const occupied = OrlaLivreService.toFiniteNumber_(occupiedMeters, 'Trecho ocupado irregularmente', 0, total);
    const forest = OrlaLivreService.toFiniteNumber_(riparianForestRatio, 'Proporção de mata ciliar', 0, 1);
    const freeShoreRatio = (total - occupied) / total;
    const ecologicalScore = Math.round((freeShoreRatio * 50) + (forest * 50));

    return {
      success: true,
      ecologicalScore: ecologicalScore,
      freeShorePercentage: Math.round(freeShoreRatio * 100),
      riparianPreservationPercentage: Math.round(forest * 100),
      status: ecologicalScore >= 70 ? 'PRESERVADA' : (ecologicalScore >= 40 ? 'PARCIAL' : 'DEGRADADA')
    };
  } catch (error) {
    ErrorHandler.logError('OrlaLivreService.calculateEcologicalImpact', error);
    return { success: false, ecologicalScore: null, status: 'SEM_MEDICAO', error: error.message };
  }
};

/** Produz uma leitura completa e um plano priorizado a partir da observação de campo. */
OrlaLivreService.assessObservation = function(observation) {
  try {
    const normalized = OrlaLivreService.normalizeObservation_(observation);
    const compliance = OrlaLivreService.checkAppCompliance(normalized.distanceToShore, normalized.interventionType);
    const ecology = OrlaLivreService.calculateEcologicalImpact(
      normalized.occupiedMeters,
      normalized.totalShoreMeters,
      normalized.riparianForestPercent / 100
    );
    if (!compliance.success || !ecology.success) {
      throw new Error(compliance.error || ecology.error || 'Não foi possível avaliar a observação.');
    }

    const criticalViolation = !compliance.compliant && compliance.impact === 'CRITICO';
    const erosionRisk = criticalViolation || ecology.ecologicalScore < 40
      ? 'ALTO'
      : (ecology.ecologicalScore < 70 || !compliance.compliant ? 'MEDIO' : 'BAIXO');
    const actions = [];
    if (!compliance.compliant) actions.push('Interromper e revisar a intervenção dentro da faixa de proteção.');
    if (ecology.riparianPreservationPercentage < 70) actions.push('Planejar recomposição da mata ciliar com espécies adequadas ao território.');
    if (ecology.freeShorePercentage < 80) actions.push('Mapear barreiras e recuperar o acesso público aos trechos ocupados.');
    if (!actions.length) actions.push('Manter monitoramento periódico e registrar novas evidências de campo.');

    return {
      success: true,
      measured: true,
      observation: normalized,
      compliance: compliance,
      ecology: ecology,
      erosionRisk: erosionRisk,
      inspectionPriority: erosionRisk === 'ALTO' ? 'IMEDIATA' : (erosionRisk === 'MEDIO' ? 'PROXIMA_RODADA' : 'ROTINA'),
      recommendedActions: actions
    };
  } catch (error) {
    ErrorHandler.logError('OrlaLivreService.assessObservation', error);
    return { success: false, measured: false, error: error.message };
  }
};

OrlaLivreService.getInspectionChecklist = function() {
  return [
    { id: 'distance', label: 'Medir a distância da intervenção até a água', required: true },
    { id: 'occupation', label: 'Medir a extensão total e o trecho irregularmente ocupado', required: true },
    { id: 'vegetation', label: 'Estimar a cobertura de mata ciliar preservada', required: true },
    { id: 'access', label: 'Verificar continuidade do acesso público à orla', required: true },
    { id: 'evidence', label: 'Registrar observação curta e responsável pela leitura', required: false }
  ];
};

/** Persiste uma inspeção no histórico existente, preservando schema e rastreabilidade. */
OrlaLivreService.recordInspection = function(playerId, villageId, observation, round) {
  try {
    if (!playerId || !villageId) throw new Error('Jogador e vila são obrigatórios.');
    const assessment = OrlaLivreService.assessObservation(observation);
    if (!assessment.success) return assessment;
    const village = VillageService.getVillageById(villageId);
    if (!village) throw new Error('Vila não encontrada.');

    const historyResult = HistoryService.recordRound({
      round: Number(round) || 0,
      playerId: String(playerId),
      villageId: String(villageId),
      action: 'inspecao-orla',
      outcome: 'Orla ' + assessment.ecology.status + ' · risco ' + assessment.erosionRisk,
      metrics: {
        shoreline: assessment,
        villageName: village.name || village.villageName || String(villageId)
      },
      event: {
        eventType: 'SHORELINE_INSPECTION',
        title: 'Leitura de campo da orla',
        description: assessment.observation.note || 'Medição territorial registrada pela equipe.',
        impact: assessment.ecology.ecologicalScore + '/100 · risco ' + assessment.erosionRisk,
        affectedPlayers: String(playerId)
      }
    });
    if (!historyResult || historyResult.success !== true) {
      throw new Error(historyResult && historyResult.error || 'Não foi possível persistir a inspeção.');
    }
    AuditLog.logEvent('SHORELINE_INSPECTION_RECORDED', {
      playerId: String(playerId),
      villageId: String(villageId),
      historyId: historyResult.record.historyId,
      ecologicalScore: assessment.ecology.ecologicalScore,
      erosionRisk: assessment.erosionRisk
    });
    return { success: true, assessment: assessment, historyId: historyResult.record.historyId };
  } catch (error) {
    ErrorHandler.logError('OrlaLivreService.recordInspection', error, { playerId: playerId, villageId: villageId });
    return { success: false, error: error.message };
  }
};

/** Retorna a última medição persistida; sem ela, explicita o estado SEM_MEDICAO. */
OrlaLivreService.getShorelineStatus = function(villageId) {
  try {
    const targetVillageId = String(villageId || '').trim();
    if (!targetVillageId) {
      return {
        success: true,
        villageId: '',
        measured: false,
        status: 'SEM_VILA',
        erosionRisk: null,
        lastInspectionDate: null,
        appBufferMeters: OrlaLivreService.APP_BUFFER_METERS,
        checklist: OrlaLivreService.getInspectionChecklist()
      };
    }
    const village = VillageService.getVillageById(targetVillageId);
    if (!village) throw new Error('Vila não encontrada.');
    const history = HistoryService.getVillageHistory(targetVillageId, 100);
    const inspection = history.find(function(record) {
      return record.action === 'inspecao-orla' && record.metrics && record.metrics.shoreline;
    });
    if (!inspection) {
      return {
        success: true,
        villageId: targetVillageId,
        villageName: village.name || village.villageName || targetVillageId,
        measured: false,
        status: 'SEM_MEDICAO',
        erosionRisk: null,
        lastInspectionDate: null,
        appBufferMeters: OrlaLivreService.APP_BUFFER_METERS,
        message: 'Nenhuma leitura de campo foi registrada para esta vila.',
        checklist: OrlaLivreService.getInspectionChecklist()
      };
    }

    const assessment = inspection.metrics.shoreline;
    return {
      success: true,
      villageId: targetVillageId,
      villageName: village.name || village.villageName || targetVillageId,
      measured: true,
      status: assessment.ecology && assessment.ecology.status || 'SEM_MEDICAO',
      ecologicalScore: assessment.ecology && assessment.ecology.ecologicalScore,
      erosionRisk: assessment.erosionRisk || null,
      inspectionPriority: assessment.inspectionPriority || null,
      lastInspectionDate: inspection.createdAt || null,
      historyId: inspection.historyId,
      observation: assessment.observation || null,
      recommendedActions: assessment.recommendedActions || [],
      appBufferMeters: OrlaLivreService.APP_BUFFER_METERS
    };
  } catch (error) {
    ErrorHandler.logError('OrlaLivreService.getShorelineStatus', error, { villageId: villageId });
    return { success: false, measured: false, erosionRisk: null, error: 'Erro ao consultar o histórico da orla.' };
  }
};
