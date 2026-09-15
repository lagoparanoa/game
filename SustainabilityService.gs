/**
 * @file SustainabilityService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Calcula o índice de sustentabilidade ambiental e socioeconômica
 *              da Bacia Hidrográfica do Lago Paranoá baseado nas decisões dos jogadores.
 * @context Integração da lógica técnica robusta (V1) com a narrativa do DF (V2).
 *          Persistência e auditoria integradas via SheetManager e Config.
 */

function SustainabilityService() {
  Logger.log('Iniciando componente: SustainabilityService.gs');
}

/**
 * Níveis de sustentabilidade e faixas de pontuação
 */
SustainabilityService.LEVELS = {
  SUSTAINABLE: { min: 70, label: 'Sustentável', status: '🟢', color: '#27ae60' },
  MODERATE: { min: 40, label: 'Atenção', status: '🟡', color: '#f39c12' },
  CRITICAL: { min: 0, label: 'Crítico', status: '🔴', color: '#e74c3c' }
};

/**
 * Calcula o índice geral de sustentabilidade da Bacia do Paranoá (0-100)
 * ponderando nível do aquífero, balanço hídrico e cooperação das vilas.
 *
 * @param {number} aquiferDepth - Profundidade atual do lençol freático (m)
 * @param {number} totalExtraction - Extração total de água no ciclo (L)
 * @param {number} rechargeRate - Taxa de recarga estimada por chuva (L)
 * @param {Array<number>} [villageScores] - Índices individuais das vilas
 * @returns {Object} Diagnóstico detalhado de sustentabilidade
 */
SustainabilityService.calculateBasinIndex = function(aquiferDepth, totalExtraction, rechargeRate, villageScores) {
  try {
    const depth = Number(aquiferDepth) || 20;
    const extraction = Math.max(0, Number(totalExtraction) || 0);
    const recharge = Math.max(0, Number(rechargeRate) || 0);

    // 1. Componente Aquífero (40% do peso): profundidade ideal <= 15m, crítica >= 30m
    const depthScore = Math.max(0, Math.min(100, 100 - ((depth - 10) / 20) * 100));

    // 2. Componente Balanço Hídrico (35% do peso): recarga >= extração => 100
    let balanceRatio = extraction > 0 ? recharge / extraction : 1.5;
    const balanceScore = Math.max(0, Math.min(100, balanceRatio * 70));

    // 3. Componente Coletivo das Vilas (25% do peso)
    let communityScore = 50;
    if (Array.isArray(villageScores) && villageScores.length > 0) {
      const sum = villageScores.reduce(function(acc, val) { return acc + (Number(val) || 0); }, 0);
      communityScore = Math.max(0, Math.min(100, sum / villageScores.length));
    }

    const overallScore = Math.round(depthScore * 0.40 + balanceScore * 0.35 + communityScore * 0.25);
    const levelInfo = SustainabilityService.classifyScore(overallScore);

    return {
      success: true,
      score: overallScore,
      level: levelInfo.label,
      badge: levelInfo.status,
      components: {
        depthScore: Math.round(depthScore),
        balanceScore: Math.round(balanceScore),
        communityScore: Math.round(communityScore)
      },
      metrics: {
        aquiferDepth: depth,
        totalExtraction: extraction,
        rechargeRate: recharge,
        balanceRatio: Math.round(balanceRatio * 100) / 100
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    ErrorHandler.logError('SustainabilityService.calculateBasinIndex', error);
    return {
      success: false,
      score: 50,
      level: 'Atenção',
      badge: '🟡',
      error: 'Erro ao calcular índice da bacia.'
    };
  }
};

/**
 * Classifica um score numérico em faixa de sustentabilidade
 * @param {number} score - Pontuação de 0 a 100
 * @returns {Object} Nível classificado
 */
SustainabilityService.classifyScore = function(score) {
  const num = Math.max(0, Math.min(100, Number(score) || 0));
  if (num >= SustainabilityService.LEVELS.SUSTAINABLE.min) {
    return SustainabilityService.LEVELS.SUSTAINABLE;
  }
  if (num >= SustainabilityService.LEVELS.MODERATE.min) {
    return SustainabilityService.LEVELS.MODERATE;
  }
  return SustainabilityService.LEVELS.CRITICAL;
};

/**
 * Gera alertas e recomendações pedagógicas de sustentabilidade
 * @param {number} sustainabilityScore - Score de 0 a 100
 * @param {number} aquiferDepth - Profundidade do aquífero (m)
 * @returns {Array<Object>} Lista de recomendações e alertas
 */
SustainabilityService.getSustainabilityAlerts = function(sustainabilityScore, aquiferDepth) {
  const alerts = [];
  const score = Number(sustainabilityScore) || 50;
  const depth = Number(aquiferDepth) || 20;

  if (score < 40) {
    alerts.push({
      type: 'DANGER',
      title: 'Bacia em Estado Crítico',
      message: 'O ritmo de extração ultrapassa a capacidade de recarga natural. Incentive o plantio de culturas com baixo consumo hídrico.',
      priority: 'ALTA'
    });
  } else if (score < 70) {
    alerts.push({
      type: 'WARNING',
      title: 'Atenção ao Balanço Hídrico',
      message: 'Equilíbrio hídrico instável. Acompanhe a previsão de chuvas antes de definir irrigação pesada.',
      priority: 'MEDIA'
    });
  } else {
    alerts.push({
      type: 'SUCCESS',
      title: 'Bacia Preservada',
      message: 'Manejo exemplar dos recursos do Lago Paranoá. A comunidade mantém a recarga em patamar sustentável.',
      priority: 'BAIXA'
    });
  }

  if (depth > 25) {
    alerts.push({
      type: 'AQUIFER_WARNING',
      title: 'Rebaixamento do Lençol Freático',
      message: 'O lençol atingiu ' + depth.toFixed(1) + 'm de profundidade. Reduza extrações nos poços profundos.',
      priority: 'ALTA'
    });
  }

  return alerts;
};

/**
 * Avalia o impacto ecológico de uma decisão agrícola individual
 * @param {Object} crop - Cultura escolhida
 * @param {number} waterUsed - Volume de água utilizado
 * @param {number} quantity - Área/quantidade plantada
 * @param {Object} climate - Condições climáticas atuais
 * @returns {Object} Impacto estimado na sustentabilidade (-15 a +15 pontos)
 */
SustainabilityService.evaluateDecisionImpact = function(crop, waterUsed, quantity, climate) {
  try {
    const qty = Math.max(1, Number(quantity) || 1);
    const need = Math.max(1, (Number(crop && crop.waterNeed) || 10) * qty);
    const used = Math.max(0, Number(waterUsed) || 0);
    const rain = Number(climate && climate.rainValue) || 0;

    const efficiency = used / need;
    let delta = 0;

    // Uso excessivo penaliza
    if (efficiency > 1.3) {
      delta -= Math.min(15, Math.round((efficiency - 1.0) * 10));
    } else if (efficiency >= 0.8 && efficiency <= 1.1) {
      // Uso calibrado bonifica
      delta += (rain > 50) ? 5 : 2;
    } else if (efficiency < 0.5) {
      // Subirrigação moderada não destrói o aquífero, mas reduz rendimento
      delta -= 2;
    }

    return {
      efficiency: Math.round(efficiency * 100) / 100,
      sustainabilityDelta: delta,
      recommendation: delta < 0
        ? 'Ajuste a irrigação para evitar desperdício de água do Lago.'
        : 'Irrigação compatível com a necessidade agronômica.'
    };
  } catch (error) {
    ErrorHandler.logError('SustainabilityService.evaluateDecisionImpact', error);
    return { efficiency: 1, sustainabilityDelta: 0, recommendation: 'Sem avaliação.' };
  }
};
