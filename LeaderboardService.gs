/**
 * @file LeaderboardService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Serviço de leaderboard para exposição de rankings de jogadores, vilas e conquistas coletivas.
 * @context Orquestra consultas a RankingService, VillageService e PlayerService para fornecer visões consolidadas
 *          de performance individual e coletiva, com suporte a cache e paginação.
 * @version 1.1.0
 * @since 2026-09-02
 */

/**
 * Obtém snapshot consolidado de todos os leaderboards disponíveis.
 * 
 * @param {Object} options - { topN: number, includeHistory: boolean, villageId: string }
 * @returns {Object} { players, villages, sustainable, villageDetail, timestamp }
 */
function getLeaderboardSnapshot(options) {
  options = options || {};
  var topN = Number(options.topN) || 10;
  var includeHistory = Boolean(options.includeHistory);
  
  try {
    var snapshot = {
      players: LeaderboardService.getTopPlayers(topN),
      villages: LeaderboardService.getTopVillages(topN),
      sustainable: LeaderboardService.getTopSustainablePlayers(topN),
      timestamp: new Date().toISOString()
    };
    
    if (options.villageId) {
      snapshot.villageDetail = LeaderboardService.getVillageDetail(options.villageId, includeHistory);
    }
    
    return { success: true, data: snapshot };
  } catch (error) {
    ErrorHandler.logError('getLeaderboardSnapshot', error);
    return { success: false, error: error.message };
  }
}

/** Classe de serviço: padrão singleton. */
function LeaderboardService() {
  Logger.log("Iniciando componente: LeaderboardService.gs");
}

/**
 * Obtém os N jogadores de maior pontuação consolidada.
 * 
 * @param {number} limit - Quantidade de jogadores a retornar (padrão: 10)
 * @returns {Array} Array de objetos com playerId, name, totalScore, rank e badges
 */
LeaderboardService.getTopPlayers = function(limit) {
  try {
    return RankingService.getTopPlayers(limit);
  } catch (error) {
    ErrorHandler.logError('LeaderboardService.getTopPlayers', error, { limit: limit });
    return [];
  }
};

/**
 * Obtém as N vilas de maior pontuação composta (média de jogadores + indicadores de sustentabilidade).
 * 
 * @param {number} limit - Quantidade de vilas a retornar (padrão: 5)
 * @returns {Array} Array ordenado com villageId, name, compositeScore, averagePlayerScore, sustainabilityIndex, rank
 */
LeaderboardService.getTopVillages = function(limit) {
  try {
    limit = Number(limit) || 5;
    var villages = VillageService.getAllVillages(false);

    if (!villages || villages.length === 0) {
      return [];
    }

    var scoredVillages = villages.map(function(village) {
      var players = PlayerService.getPlayersByVillage(village.villageId);
      var totalScore = 0;

      players.forEach(function(player) {
        var scoreResult = RankingService.calculatePlayerScore(player.playerId);
        if (scoreResult.success) {
          totalScore += Number(scoreResult.totalScore) || 0;
        }
      });

      var averageScore = players.length ? Math.round(totalScore / players.length) : 0;
      var compositeScore = averageScore + (village.sustainabilityIndex || 0) * 5 + (village.population || 0) * 2;

      return {
        villageId: village.villageId,
        name: village.name,
        region: village.region,
        population: village.population,
        sustainabilityIndex: village.sustainabilityIndex,
        averagePlayerScore: averageScore,
        compositeScore: compositeScore,
        players: players.length
      };
    });

    scoredVillages.sort(function(a, b) {
      if (b.compositeScore !== a.compositeScore) {
        return b.compositeScore - a.compositeScore;
      }
      return b.sustainabilityIndex - a.sustainabilityIndex;
    });

    return scoredVillages.slice(0, limit).map(function(village, index) {
      village.rank = index + 1;
      return village;
    });
  } catch (error) {
    ErrorHandler.logError('LeaderboardService.getTopVillages', error, { limit: limit });
    return [];
  }
};

/**
 * Obtém posição e estatísticas de ranking de um jogador específico.
 * 
 * @param {string} playerId - Identificador único do jogador
 * @returns {Object|null} { rank, totalScore, percentile, ... } ou null se não encontrado
 */
LeaderboardService.getPlayerRank = function(playerId) {
  try {
    return RankingService.getPlayerRank(playerId);
  } catch (error) {
    ErrorHandler.logError('LeaderboardService.getPlayerRank', error, { playerId: playerId });
    return null;
  }
};

/**
 * Obtém os N jogadores de maior índice de sustentabilidade.
 * 
 * @param {number} limit - Quantidade de jogadores a retornar (padrão: 10)
 * @returns {Array} Array ordenado com playerId, name, sustainabilityScore, rank
 */
LeaderboardService.getTopSustainablePlayers = function(limit) {
  try {
    return RankingService.getTopSustainable(limit);
  } catch (error) {
    ErrorHandler.logError('LeaderboardService.getTopSustainablePlayers', error, { limit: limit });
    return [];
  }
};

/**
 * Obtém detalhamento completo de uma vila: ranking interno, evolução coletiva e histórico.
 * 
 * @param {string} villageId - Identificador único da vila
 * @param {boolean} includeHistory - Se deve incluir série temporal de pontuações
 * @returns {Object} { villageData, topPlayers, averageScoreHistory, ... }
 */
LeaderboardService.getVillageDetail = function(villageId, includeHistory) {
  try {
    if (!villageId || typeof villageId !== 'string') return null;
    
    var village = VillageService.getVillage(villageId);
    if (!village) return null;
    
    var players = PlayerService.getPlayersByVillage(villageId);
    var scoredPlayers = players.map(function(player) {
      var scoreResult = RankingService.calculatePlayerScore(player.playerId);
      return {
        playerId: player.playerId,
        name: player.name || 'Jogador',
        totalScore: scoreResult.success ? scoreResult.totalScore : 0,
        sustainabilityScore: scoreResult.success ? scoreResult.sustainabilityScore : 0
      };
    }).sort(function(a, b) { return b.totalScore - a.totalScore; });
    
    var detail = {
      villageId: villageId,
      name: village.name,
      region: village.region,
      sustainabilityIndex: village.sustainabilityIndex,
      population: players.length,
      topPlayers: scoredPlayers.slice(0, 5),
      averageScore: scoredPlayers.length > 0 
        ? Math.round(scoredPlayers.reduce(function(sum, p) { return sum + p.totalScore; }, 0) / scoredPlayers.length)
        : 0
    };
    
    if (includeHistory) {
      detail.history = players.map(function(player) {
        return RankingService.getRankHistory(player.playerId, 7);
      }).filter(function(h) { return h && h.history && h.history.length > 0; });
    }
    
    return detail;
  } catch (error) {
    ErrorHandler.logError('LeaderboardService.getVillageDetail', error, { villageId: villageId });
    return null;
  }
};
