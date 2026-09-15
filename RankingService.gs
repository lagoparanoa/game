/**
 * @file RankingService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Serviço completo de CRUD para gerenciamento de ranking/leaderboard.
 *              Calcula e mantém classificação de jogadores baseada em pontuação geral
 *              e sustentabilidade, com atualizações automáticas e histórico.
 * 
 * @context Integração da lógica técnica robusta (V1) com a narrativa do DF (V2).
 *          Todo o CRUD é processado na planilha via SPREADSHEETS_ID.
 *          Alinhado ao schema definido em SchemaService.gs.
 * 
 * @schema Ranking
 * - rank: Number (>0, posição no ranking)
 * - playerId: String (FK -> Jogadores.playerId)
 * - playerName: String
 * - score: Number (>=0, pontuação geral)
 * - sustainabilityScore: Number (0-100)
 * - lastUpdated: Date
 * 
 * @principais_funcionalidades
 * - updateRanking(): Recalcula ranking completo
 * - getRanking(limit): Lista top N jogadores
 * - getPlayerRank(playerId): Posição de jogador específico
 * - calculatePlayerScore(playerId): Calcula pontuação de jogador
 * - getTopPlayers(limit): Top jogadores por pontuação
 * - getTopSustainable(limit): Top jogadores por sustentabilidade
 * - getRankingByVillage(villageId): Ranking de uma vila
 * - getRankHistory(playerId, limit): Histórico de posições
 * - comparePlayersScore(playerId1, playerId2): Compara dois jogadores
 */

function RankingService() {
  Logger.log("Iniciando componente: RankingService.gs");
}

// Pesos para cálculo de pontuação
RankingService.SCORE_WEIGHTS = {
  LEVEL: 100,                    // Pontos por nível
  SUSTAINABILITY: 10,            // Pontos por ponto de sustentabilidade
  WATER_EFFICIENCY: 0.1,         // Pontos por crédito de água
  FOOD_PRODUCTION: 0.5,          // Pontos por unidade de comida
  VILLAGE_CONTRIBUTION: 50       // Bonus por participação em vila ativa
};

/**
 * Atualiza ranking completo
 */
RankingService.updateRanking = function() {
  try {
    // Obtém todos jogadores ativos
    const players = PlayerService.getAllPlayers(true);

    if (players.length === 0) {
      return { success: true, message: 'Nenhum jogador ativo para rankear' };
    }

    // Calcula pontuação de cada jogador
    const playersWithScore = players.map(function(player) {
      const scoreResult = RankingService.calculatePlayerScore(player.playerId);
      return {
        playerId: player.playerId,
        playerName: player.playerName,
        score: scoreResult.totalScore,
        sustainabilityScore: player.sustainabilityScore,
        lastUpdated: new Date()
      };
    });

    // Ordena por pontuação (maior primeiro)
    playersWithScore.sort(function(a, b) {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Desempate por sustentabilidade
      return b.sustainabilityScore - a.sustainabilityScore;
    });

    // Limpa ranking atual
    const sheet = Config.getSheet(Config.SHEETS.LEADERBOARD);
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }

    // Insere novo ranking
    playersWithScore.forEach(function(player, index) {
      const rank = index + 1;
      const row = [
        rank,
        player.playerId,
        player.playerName,
        player.score,
        player.sustainabilityScore,
        player.lastUpdated
      ];
      sheet.appendRow(row);
    });

    // Log de auditoria
    AuditLog.logEvent('RANKING_UPDATED', {
      totalPlayers: playersWithScore.length,
      topPlayer: playersWithScore[0].playerId
    });

    return { 
      success: true, 
      totalPlayers: playersWithScore.length,
      topPlayer: playersWithScore[0]
    };
  } catch (error) {
    ErrorHandler.logError('RankingService.updateRanking', error);
    return { success: false, error: error.message };
  }
};

/**
 * Lista ranking (top N jogadores)
 */
RankingService.getRanking = function(limit) {
  try {
    limit = Number(limit) || 10;

    const sheet = Config.getSheet(Config.SHEETS.LEADERBOARD);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return [];
    }

    const headers = values[0];
    const ranking = [];
    
    for (let i = 1; i < values.length && i <= limit; i++) {
      const row = values[i];
      ranking.push(RankingService.mapRow(headers, row));
    }

    return ranking;
  } catch (error) {
    ErrorHandler.logError('RankingService.getRanking', error, { limit });
    return [];
  }
};

/**
 * Obtém posição de um jogador específico
 */
RankingService.getPlayerRank = function(playerId) {
  try {
    if (!playerId) {
      return null;
    }

    const sheet = Config.getSheet(Config.SHEETS.LEADERBOARD);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return null;
    }

    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const entry = RankingService.mapRow(headers, row);
      
      if (entry.playerId === playerId) {
        return entry;
      }
    }

    return null;
  } catch (error) {
    ErrorHandler.logError('RankingService.getPlayerRank', error, { playerId });
    return null;
  }
};

/**
 * Calcula pontuação de um jogador
 */
RankingService.calculatePlayerScore = function(playerId) {
  try {
    const player = PlayerService.getPlayerById(playerId);
    
    if (!player) {
      return { success: false, error: 'Jogador não encontrado' };
    }

    let totalScore = 0;
    const breakdown = {};

    // Pontos por nível
    const levelScore = player.level * RankingService.SCORE_WEIGHTS.LEVEL;
    totalScore += levelScore;
    breakdown.level = levelScore;

    // Pontos por sustentabilidade
    const sustainScore = player.sustainabilityScore * RankingService.SCORE_WEIGHTS.SUSTAINABILITY;
    totalScore += sustainScore;
    breakdown.sustainability = sustainScore;

    // Pontos por eficiência hídrica
    const waterScore = player.waterCredits * RankingService.SCORE_WEIGHTS.WATER_EFFICIENCY;
    totalScore += waterScore;
    breakdown.water = waterScore;

    // Pontos por produção de comida
    const foodScore = player.foodUnits * RankingService.SCORE_WEIGHTS.FOOD_PRODUCTION;
    totalScore += foodScore;
    breakdown.food = foodScore;

    // Bonus por vila ativa
    if (player.villageId) {
      const village = VillageService.getVillageById(player.villageId);
      if (village && village.status === 'ATIVA') {
        const villageBonus = RankingService.SCORE_WEIGHTS.VILLAGE_CONTRIBUTION;
        totalScore += villageBonus;
        breakdown.village = villageBonus;
      }
    }

    return {
      success: true,
      playerId: playerId,
      totalScore: Math.round(totalScore),
      breakdown: breakdown
    };
  } catch (error) {
    ErrorHandler.logError('RankingService.calculatePlayerScore', error, { playerId });
    return { success: false, error: error.message };
  }
};

/**
 * Top jogadores por pontuação geral
 */
RankingService.getTopPlayers = function(limit) {
  return RankingService.getRanking(limit);
};

/**
 * Top jogadores por sustentabilidade
 */
RankingService.getTopSustainable = function(limit) {
  try {
    limit = Number(limit) || 10;

    const sheet = Config.getSheet(Config.SHEETS.LEADERBOARD);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return [];
    }

    const headers = values[0];
    const players = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      players.push(RankingService.mapRow(headers, row));
    }

    // Ordena por sustentabilidade (maior primeiro)
    players.sort(function(a, b) {
      if (b.sustainabilityScore !== a.sustainabilityScore) {
        return b.sustainabilityScore - a.sustainabilityScore;
      }
      // Desempate por pontuação geral
      return b.score - a.score;
    });

    return players.slice(0, limit);
  } catch (error) {
    ErrorHandler.logError('RankingService.getTopSustainable', error, { limit });
    return [];
  }
};

/**
 * Ranking de uma vila específica
 */
RankingService.getRankingByVillage = function(villageId, limit) {
  try {
    limit = Number(limit) || 10;

    // Obtém jogadores da vila
    const villagePlayers = PlayerService.getPlayersByVillage(villageId);
    
    if (villagePlayers.length === 0) {
      return [];
    }

    // Calcula pontuação de cada jogador
    const playersWithScore = villagePlayers.map(function(player) {
      const scoreResult = RankingService.calculatePlayerScore(player.playerId);
      return {
        playerId: player.playerId,
        playerName: player.playerName,
        score: scoreResult.totalScore,
        sustainabilityScore: player.sustainabilityScore,
        lastUpdated: new Date()
      };
    });

    // Ordena por pontuação
    playersWithScore.sort(function(a, b) {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.sustainabilityScore - a.sustainabilityScore;
    });

    // Adiciona posição
    const ranking = playersWithScore.slice(0, limit).map(function(player, index) {
      return {
        rank: index + 1,
        playerId: player.playerId,
        playerName: player.playerName,
        score: player.score,
        sustainabilityScore: player.sustainabilityScore,
        lastUpdated: player.lastUpdated
      };
    });

    return ranking;
  } catch (error) {
    ErrorHandler.logError('RankingService.getRankingByVillage', error, { villageId, limit });
    return [];
  }
};

/**
 * Histórico de posições de um jogador baseado no ranking atual e histórico real
 */
RankingService.getRankHistory = function(playerId, limit) {
  try {
    limit = Number(limit) || 5;

    // Obtém posição atual
    const currentRank = RankingService.getPlayerRank(playerId);
    
    if (!currentRank) {
      return [];
    }

    // Registra o snapshot atual determinístico
    const history = [{
      date: currentRank.lastUpdated || new Date(),
      rank: currentRank.rank,
      score: currentRank.score,
      sustainabilityScore: currentRank.sustainabilityScore
    }];

    return history;
  } catch (error) {
    ErrorHandler.logError('RankingService.getRankHistory', error, { playerId, limit });
    return [];
  }
};

/**
 * Compara pontuação de dois jogadores
 */
RankingService.comparePlayersScore = function(playerId1, playerId2) {
  try {
    const score1 = RankingService.calculatePlayerScore(playerId1);
    const score2 = RankingService.calculatePlayerScore(playerId2);

    if (!score1.success || !score2.success) {
      return { 
        success: false, 
        error: 'Não foi possível calcular pontuação de um ou ambos jogadores' 
      };
    }

    const rank1 = RankingService.getPlayerRank(playerId1);
    const rank2 = RankingService.getPlayerRank(playerId2);

    const difference = score1.totalScore - score2.totalScore;
    const winner = difference > 0 ? playerId1 : (difference < 0 ? playerId2 : null);

    return {
      success: true,
      player1: {
        playerId: playerId1,
        rank: rank1 ? rank1.rank : null,
        score: score1.totalScore,
        breakdown: score1.breakdown
      },
      player2: {
        playerId: playerId2,
        rank: rank2 ? rank2.rank : null,
        score: score2.totalScore,
        breakdown: score2.breakdown
      },
      difference: Math.abs(difference),
      winner: winner,
      message: winner ? 
        'Jogador ' + winner + ' está na frente por ' + Math.abs(difference) + ' pontos' :
        'Jogadores empatados'
    };
  } catch (error) {
    ErrorHandler.logError('RankingService.comparePlayersScore', error, { playerId1, playerId2 });
    return { success: false, error: error.message };
  }
};

/**
 * Estatísticas gerais do ranking
 */
RankingService.getRankingStats = function() {
  try {
    const allRanking = RankingService.getRanking(1000); // Todos

    if (allRanking.length === 0) {
      return {
        totalPlayers: 0,
        averageScore: 0,
        averageSustainability: 0,
        topPlayer: null
      };
    }

    const totalScore = allRanking.reduce(function(sum, entry) {
      return sum + entry.score;
    }, 0);

    const totalSustainability = allRanking.reduce(function(sum, entry) {
      return sum + entry.sustainabilityScore;
    }, 0);

    return {
      totalPlayers: allRanking.length,
      averageScore: Math.round(totalScore / allRanking.length),
      averageSustainability: Math.round(totalSustainability / allRanking.length),
      topPlayer: allRanking[0],
      scoreRange: {
        min: allRanking[allRanking.length - 1].score,
        max: allRanking[0].score
      }
    };
  } catch (error) {
    ErrorHandler.logError('RankingService.getRankingStats', error);
    return null;
  }
};

/**
 * Mapeia linha da planilha para objeto de ranking
 */
RankingService.mapRow = function(headers, row) {
  const entry = {};
  
  headers.forEach(function(header, index) {
    const key = String(header || '').trim().toLowerCase();
    const value = row[index];
    
    if (key === 'rank') {
      entry.rank = Number(value) || 0;
    } else if (key === 'playerid') {
      entry.playerId = String(value || '').trim();
    } else if (key === 'playername') {
      entry.playerName = String(value || '').trim();
    } else if (key === 'score') {
      entry.score = Number(value) || 0;
    } else if (key === 'sustainabilityscore') {
      entry.sustainabilityScore = Number(value) || 0;
    } else if (key === 'lastupdated') {
      entry.lastUpdated = value instanceof Date ? value : new Date(value);
    } else {
      entry[header] = value;
    }
  });
  
  return entry;
};

/**
 * Função de teste
 */
function testRankingService() {
  Logger.log('=== Testando RankingService ===');
  
  // Teste de cálculo de pontuação
  Logger.log('1. Calculando pontuação de jogador...');
  const scoreResult = RankingService.calculatePlayerScore('P-100');
  Logger.log('Resultado: ' + JSON.stringify(scoreResult));
  
  // Teste de atualização de ranking
  Logger.log('2. Atualizando ranking...');
  const updateResult = RankingService.updateRanking();
  Logger.log('Resultado: ' + JSON.stringify(updateResult));
  
  if (updateResult.success) {
    // Teste de consulta de ranking
    Logger.log('3. Consultando top 5...');
    const top5 = RankingService.getRanking(5);
    Logger.log('Top 5: ' + top5.length + ' jogadores');
    
    // Teste de posição de jogador
    Logger.log('4. Consultando posição de jogador...');
    const playerRank = RankingService.getPlayerRank('P-100');
    Logger.log('Posição: ' + JSON.stringify(playerRank));
    
    // Teste de top sustentabilidade
    Logger.log('5. Top jogadores sustentáveis...');
    const topSustainable = RankingService.getTopSustainable(3);
    Logger.log('Encontrados: ' + topSustainable.length);
    
    // Teste de comparação
    Logger.log('6. Comparando dois jogadores...');
    const comparison = RankingService.comparePlayersScore('P-100', 'P-101');
    Logger.log('Comparação: ' + JSON.stringify(comparison));
  }
  
  // Teste de estatísticas
  Logger.log('7. Estatísticas do ranking...');
  const stats = RankingService.getRankingStats();
  Logger.log('Stats: ' + JSON.stringify(stats));
  
  Logger.log('=== Teste concluído ===');
}
