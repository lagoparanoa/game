/**
 * @file ReportGenerator.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Gerador de relatórios executivos, diagnósticos hidrológicos e sínteses pedagógicas.
 * @context Permite exportação estruturada de métricas para educadores e gestores de bacia.
 */

function ReportGenerator() {
  Logger.log('Iniciando componente: ReportGenerator.gs');
}

/**
 * Gera relatório hidrológico consolidado do Lago Paranoá e seus aquíferos
 * @param {Object} aquiferData - Dados do aquífero
 * @param {Object} climateData - Condições meteorológicas
 * @returns {Object} Relatório formatado com diagnóstico
 */
ReportGenerator.generateHydrologicalReport = function(aquiferData, climateData) {
  try {
    const level = Number(aquiferData && aquiferData.level) || 20;
    const rain = Number(climateData && climateData.rainValue) || 0;
    const recharge = Number(aquiferData && aquiferData.recharge) || (rain * 0.4);
    const extraction = Number(aquiferData && aquiferData.extraction) || 50;

    const balance = recharge - extraction;
    let status = 'ESTÁVEL';
    if (balance < -20 || level > 25) {
      status = 'CRÍTICO';
    } else if (balance > 10 && level <= 18) {
      status = 'ÓTIMO';
    }

    return {
      title: 'Relatório Hidrológico da Bacia do Paranoá',
      generatedAt: new Date().toISOString(),
      indicators: {
        aquiferDepthMeters: level,
        monthlyPrecipitationMm: rain,
        estimatedRechargeL: Math.round(recharge),
        totalExtractionL: Math.round(extraction),
        netWaterBalanceL: Math.round(balance)
      },
      diagnostic: {
        status: status,
        securityIndex: Math.max(0, Math.min(100, Math.round(50 + balance * 2))),
        summaryText: 'Balanço hídrico ' + (balance >= 0 ? 'positivo' : 'deficitário') + ' com lençol a ' + level + 'm.'
      }
    };
  } catch (error) {
    ErrorHandler.logError('ReportGenerator.generateHydrologicalReport', error);
    return { title: 'Erro no Relatório Hidrológico', error: error.message };
  }
};

/**
 * Gera relatório de desempenho econômico e agronômico das rodadas
 * @param {Array<Object>} transactions - Histórico de transações
 * @param {Array<Object>} cropOutcomes - Resultados de colheita
 * @returns {Object} Síntese econômico-ambiental
 */
ReportGenerator.generateEconomicReport = function(transactions, cropOutcomes) {
  try {
    const txList = Array.isArray(transactions) ? transactions : [];
    const outcomeList = Array.isArray(cropOutcomes) ? cropOutcomes : [];

    let totalRevenue = 0;
    let totalWaterUsed = 0;
    let totalYield = 0;

    outcomeList.forEach(function(o) {
      totalRevenue += Number(o.revenue) || 0;
      totalWaterUsed += Number(o.waterUsed) || 0;
      totalYield += Number(o.yieldUnits) || 0;
    });

    const waterEfficiency = totalWaterUsed > 0
      ? Math.round((totalRevenue / totalWaterUsed) * 100) / 100
      : 0;

    return {
      title: 'Relatório Agroeconômico e Eficiência Hídrica',
      generatedAt: new Date().toISOString(),
      metrics: {
        totalRoundsAnalyzed: outcomeList.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalProductionUnits: Math.round(totalYield * 100) / 100,
        totalWaterConsumedL: Math.round(totalWaterUsed),
        revenuePerLiterWater: waterEfficiency,
        transactionCount: txList.length
      },
      evaluation: waterEfficiency >= 0.15
        ? 'Alta eficiência econômica por litro de água utilizado.'
        : 'Eficiência hídrica passível de otimização através de culturas mais rentáveis.'
    };
  } catch (error) {
    ErrorHandler.logError('ReportGenerator.generateEconomicReport', error);
    return { title: 'Erro no Relatório Econômico', error: error.message };
  }
};

/**
 * Converte matriz de dados em formato CSV para exportação
 * @param {Array<string>} headers - Cabeçalhos das colunas
 * @param {Array<Array<*>>} rows - Linhas de dados
 * @returns {string} Texto formatado em CSV com escape adequado
 */
ReportGenerator.generateCsv = function(headers, rows) {
  const cleanHeader = (headers || []).map(function(h) {
    return '"' + String(h || '').replace(/"/g, '""') + '"';
  }).join(';');

  const cleanRows = (rows || []).map(function(row) {
    return (row || []).map(function(cell) {
      return '"' + String(cell !== undefined && cell !== null ? cell : '').replace(/"/g, '""') + '"';
    }).join(';');
  });

  return [cleanHeader].concat(cleanRows).join('\r\n');
};

/**
 * Gera síntese pedagógica do progresso de um jogador ao longo das rodadas
 * @param {Object} player - Dados do jogador (experience, sustainabilityScore, waterCredits, name)
 * @param {Array<Object>} history - Histórico de rodadas [{round, event, score}]
 * @returns {Object} Relatório com nível, marcos, tendência e recomendação
 */
ReportGenerator.generatePlayerProgressReport = function(player, history) {
  try {
    var name = (player && player.name) ? String(player.name) : 'Jogador';
    var xp = Number(player && player.experience) || 0;
    var level = Math.floor(xp / 100) + 1;
    var score = Number(player && player.sustainabilityScore) || 0;
    var water = Number(player && player.waterCredits) || 0;

    var hist = Array.isArray(history) ? history : [];
    var lastRounds = hist.slice(-5);
    var avgScore = lastRounds.length
      ? lastRounds.reduce(function(acc, r) { return acc + (Number(r.score) || 0); }, 0) / lastRounds.length
      : score;

    var trend = avgScore >= score ? 'MELHORIA' : 'QUEDA';

    var milestones = [];
    if (level >= 2) milestones.push('Nível 2 atingido');
    if (score >= 60) milestones.push('Sustentabilidade exemplar (≥ 60)');
    if (water >= 100) milestones.push('Reserva hídrica robusta (≥ 100 créditos)');
    if (hist.length >= 10) milestones.push('10 rodadas concluídas');

    var recommendation = score < 40
      ? 'Reduza a extração e diversifique culturas para recuperar pontuação.'
      : score < 70
        ? 'Mantenha o equilíbrio hídrico e monitore o aquífero a cada rodada.'
        : 'Excelente gestão! Compartilhe suas estratégias com a vila.';

    return {
      title: 'Relatório de Progresso — ' + name,
      generatedAt: new Date().toISOString(),
      player: { name: name, level: level, xp: xp, sustainabilityScore: score, waterCredits: water },
      progression: { roundsRecorded: hist.length, recentAvgScore: Math.round(avgScore * 10) / 10, trend: trend },
      milestones: milestones,
      recommendation: recommendation
    };
  } catch (error) {
    ErrorHandler.logError('ReportGenerator.generatePlayerProgressReport', error);
    return { title: 'Erro no Relatório de Progresso', error: error.message };
  }
};

/**
 * Gera relatório de sustentabilidade comparativo por vila
 * @param {Array<Object>} villages - Cada item: {villageId, name, players: [{sustainabilityScore}]}
 * @returns {Object} Ranking de vilas por sustentabilidade média e alertas coletivos
 */
ReportGenerator.generateSustainabilityReport = function(villages) {
  try {
    var list = Array.isArray(villages) ? villages : [];

    var ranked = list.map(function(v) {
      var players = Array.isArray(v.players) ? v.players : [];
      var avg = players.length
        ? players.reduce(function(acc, p) { return acc + (Number(p.sustainabilityScore) || 0); }, 0) / players.length
        : 0;
      return {
        villageId: v.villageId || v.id || '?',
        name: v.name || 'Vila',
        playerCount: players.length,
        avgSustainability: Math.round(avg * 10) / 10,
        status: avg >= 60 ? 'SAUDAVEL' : avg >= 40 ? 'ALERTA' : 'CRITICO'
      };
    });

    ranked.sort(function(a, b) { return b.avgSustainability - a.avgSustainability; });

    var critical = ranked.filter(function(v) { return v.status === 'CRITICO'; });

    return {
      title: 'Relatório de Sustentabilidade por Vila',
      generatedAt: new Date().toISOString(),
      villageCount: ranked.length,
      ranking: ranked,
      criticalVillages: critical.map(function(v) { return v.name; }),
      basinAvgSustainability: ranked.length
        ? Math.round(ranked.reduce(function(acc, v) { return acc + v.avgSustainability; }, 0) / ranked.length * 10) / 10
        : 0
    };
  } catch (error) {
    ErrorHandler.logError('ReportGenerator.generateSustainabilityReport', error);
    return { title: 'Erro no Relatório de Sustentabilidade', error: error.message };
  }
};

/**
 * Serializa dados como JSON estruturado para exportação segura
 * @param {*} data - Qualquer objeto serializável
 * @param {string} label - Rótulo identificador do conjunto
 * @returns {string} JSON com metadados de exportação
 */
ReportGenerator.generateJsonSummary = function(data, label) {
  var safeLabel = String(label || 'export').replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'export';
  var wrapper = {
    label: safeLabel,
    exportedAt: new Date().toISOString(),
    recordCount: Array.isArray(data) ? data.length : (data && typeof data === 'object' ? Object.keys(data).length : 1),
    data: data
  };
  try {
    return JSON.stringify(wrapper, null, 2);
  } catch (e) {
    return JSON.stringify({ label: safeLabel, exportedAt: new Date().toISOString(), error: 'Dados não serializáveis' });
  }
};
