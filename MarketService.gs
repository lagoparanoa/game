/**
 * @file MarketService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Serviço completo de CRUD para gerenciamento de transações comerciais.
 *              Gerencia compra e venda de culturas entre jogadores, controle de preços,
 *              histórico de transações e estatísticas de mercado.
 * 
 * @context Integração da lógica técnica robusta (V1) com a narrativa do DF (V2).
 *          Todo o CRUD é processado na planilha via SPREADSHEETS_ID.
 *          Alinhado ao schema definido em SchemaService.gs.
 * 
 * @schema Mercado
 * - transactionId: String (PK, formato T-XXX)
 * - playerId: String (FK -> Jogadores.playerId)
 * - cropId: String (FK -> Culturas.cropId)
 * - quantity: Number (>0)
 * - priceUnit: Number (>0)
 * - totalPrice: Number (>0)
 * - transactionDate: Date
 * - type: Enum ('COMPRA' | 'VENDA')
 * 
 * @principais_funcionalidades
 * - createTransaction(data): Registra transação
 * - getTransactionById(transactionId): Busca transação por ID
 * - getTransactionsByPlayer(playerId): Lista transações de jogador
 * - getTransactionsByCrop(cropId): Lista transações de cultura
 * - buyC rop(playerId, cropId, quantity): Compra cultura
 * - sellCrop(playerId, cropId, quantity): Vende cultura
 * - getMarketPrice(cropId): Obtém preço atual de cultura
 * - getTransactionHistory(limit): Histórico geral
 * - getPlayerBalance(playerId): Balanço de compras/vendas
 * - getMarketStats(): Estatísticas do mercado
 * - getCropMarketStats(cropId): Stats de cultura específica
 */

function MarketService() {
  Logger.log("Iniciando componente: MarketService.gs");
}

// Constantes de preço base
MarketService.BASE_PRICES = {
  'C-01': 12.5,  // Milho
  'C-02': 9.0    // Feijão
};

MarketService.PRICE_VARIATION = 0.15; // 15% de variação

/**
 * Cria uma nova transação
 */
MarketService.createTransaction = function(data) {
  try {
    // Validações básicas
    if (!data || !data.playerId || !data.cropId || !data.quantity || !data.type) {
      return { 
        success: false, 
        error: 'playerId, cropId, quantity e type são obrigatórios' 
      };
    }

    const quantity = Number(data.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { success: false, error: 'Quantidade deve ser um número finito maior que zero' };
    }

    // Valida tipo de transação
    if (!ValidationService.validateEnum(data.type, ValidationService.VALID_ENUMS.TRANSACTION_TYPE)) {
      return { 
        success: false, 
        error: 'Tipo inválido. Use: COMPRA ou VENDA' 
      };
    }

    // Valida FKs
    if (!ValidationService.validateForeignKey(Config.SHEETS.PLAYERS, 'playerId', data.playerId)) {
      return { success: false, error: 'Jogador não encontrado' };
    }

    if (!ValidationService.validateForeignKey(Config.SHEETS.CROPS, 'cropId', data.cropId)) {
      return { success: false, error: 'Cultura não encontrada' };
    }

    // Calcula preços
    let priceUnit = data.priceUnit;
    if (priceUnit === undefined || priceUnit === null) {
      const priceInfo = MarketService.getMarketPrice(data.cropId);
      if (!priceInfo.success) return priceInfo;
      priceUnit = priceInfo.price;
    }
    priceUnit = Number(priceUnit);
    const totalPrice = priceUnit * quantity;
    if (!Number.isFinite(priceUnit) || priceUnit <= 0 ||
        !Number.isFinite(totalPrice) || totalPrice <= 0) {
      return { success: false, error: 'Preço ou total da transação inválido' };
    }

    // Gera ID único
    const transactionId = MarketService.generateTransactionId();

    // Prepara dados da transação
    const transactionData = {
      transactionId: transactionId,
      playerId: data.playerId,
      cropId: data.cropId,
      quantity: Number(data.quantity),
      priceUnit: priceUnit,
      totalPrice: totalPrice,
      transactionDate: new Date(),
      type: data.type
    };

    // Insere na planilha
    const sheet = Config.getSheet(Config.SHEETS.MARKET);
    const row = [
      transactionData.transactionId,
      transactionData.playerId,
      transactionData.cropId,
      transactionData.quantity,
      transactionData.priceUnit,
      transactionData.totalPrice,
      transactionData.transactionDate,
      transactionData.type
    ];

    sheet.appendRow(row);

    // Log de auditoria
    AuditLog.logEvent('TRANSACTION_CREATED', {
      transactionId: transactionId,
      playerId: data.playerId,
      type: data.type,
      totalPrice: totalPrice
    });

    return { success: true, transaction: transactionData };
  } catch (error) {
    ErrorHandler.logError('MarketService.createTransaction', error, data);
    return { success: false, error: error.message };
  }
};

/**
 * Busca transação por ID
 */
MarketService.getTransactionById = function(transactionId) {
  try {
    if (!transactionId) {
      return null;
    }

    const sheet = Config.getSheet(Config.SHEETS.MARKET);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return null;
    }

    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const transaction = MarketService.mapRow(headers, row);
      
      if (transaction.transactionId === transactionId) {
        return transaction;
      }
    }

    return null;
  } catch (error) {
    ErrorHandler.logError('MarketService.getTransactionById', error, { transactionId });
    return null;
  }
};

/**
 * Lista transações de um jogador
 */
MarketService.getTransactionsByPlayer = function(playerId, type) {
  try {
    if (!playerId) {
      return [];
    }

    const sheet = Config.getSheet(Config.SHEETS.MARKET);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return [];
    }

    const headers = values[0];
    const transactions = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const transaction = MarketService.mapRow(headers, row);
      
      if (transaction.playerId === playerId) {
        if (!type || transaction.type === type) {
          transactions.push(transaction);
        }
      }
    }

    // Ordena por data (mais recente primeiro)
    transactions.sort(function(a, b) {
      return b.transactionDate - a.transactionDate;
    });

    return transactions;
  } catch (error) {
    ErrorHandler.logError('MarketService.getTransactionsByPlayer', error, { playerId, type });
    return [];
  }
};

/**
 * Lista transações de uma cultura
 */
MarketService.getTransactionsByCrop = function(cropId) {
  try {
    if (!cropId) {
      return [];
    }

    const sheet = Config.getSheet(Config.SHEETS.MARKET);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return [];
    }

    const headers = values[0];
    const transactions = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const transaction = MarketService.mapRow(headers, row);
      
      if (transaction.cropId === cropId) {
        transactions.push(transaction);
      }
    }

    return transactions;
  } catch (error) {
    ErrorHandler.logError('MarketService.getTransactionsByCrop', error, { cropId });
    return [];
  }
};

/**
 * Compra cultura
 */
MarketService.buyCrop = function(playerId, cropId, quantity) {
  try {
    quantity = Number(quantity);

    // Validações
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { success: false, error: 'Quantidade deve ser maior que zero' };
    }

    // Obtém preço atual
    const priceInfo = MarketService.getMarketPrice(cropId);
    if (!priceInfo.success) {
      return priceInfo;
    }

    const totalCost = priceInfo.price * quantity;

    // Verifica se jogador tem recursos suficientes
    const resourceValidation = ValidationService.validateBusinessRule('SUFFICIENT_RESOURCES', {
      playerId: playerId,
      waterNeeded: totalCost,
      foodNeeded: 0
    });

    if (!resourceValidation.valid) {
      return { 
        success: false, 
        error: 'Créditos de água insuficientes (necessário: ' + totalCost + ')' 
      };
    }

    // Cria transação
    const transactionResult = MarketService.createTransaction({
      playerId: playerId,
      cropId: cropId,
      quantity: quantity,
      priceUnit: priceInfo.price,
      type: 'COMPRA'
    });

    if (!transactionResult.success) {
      return transactionResult;
    }

    // Atualiza recursos do jogador (deduz água, adiciona comida)
    const resourceUpdate = PlayerService.updateResources(playerId, -totalCost, quantity);

    if (!resourceUpdate.success) {
      return { 
        success: false, 
        error: 'Erro ao atualizar recursos do jogador' 
      };
    }

    return {
      success: true,
      transaction: transactionResult.transaction,
      newBalance: {
        waterCredits: resourceUpdate.player.waterCredits,
        foodUnits: resourceUpdate.player.foodUnits
      }
    };
  } catch (error) {
    ErrorHandler.logError('MarketService.buyCrop', error, { playerId, cropId, quantity });
    return { success: false, error: error.message };
  }
};

/**
 * Vende cultura
 */
MarketService.sellCrop = function(playerId, cropId, quantity) {
  try {
    quantity = Number(quantity);

    // Validações
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { success: false, error: 'Quantidade deve ser maior que zero' };
    }

    // Verifica se jogador tem comida suficiente
    const resourceValidation = ValidationService.validateBusinessRule('SUFFICIENT_RESOURCES', {
      playerId: playerId,
      waterNeeded: 0,
      foodNeeded: quantity
    });

    if (!resourceValidation.valid) {
      return { 
        success: false, 
        error: 'Comida insuficiente para venda (necessário: ' + quantity + ')' 
      };
    }

    // Obtém preço atual
    const priceInfo = MarketService.getMarketPrice(cropId);
    if (!priceInfo.success) {
      return priceInfo;
    }

    const totalRevenue = priceInfo.price * quantity;

    // Cria transação
    const transactionResult = MarketService.createTransaction({
      playerId: playerId,
      cropId: cropId,
      quantity: quantity,
      priceUnit: priceInfo.price,
      type: 'VENDA'
    });

    if (!transactionResult.success) {
      return transactionResult;
    }

    // Atualiza recursos do jogador (adiciona água, deduz comida)
    const resourceUpdate = PlayerService.updateResources(playerId, totalRevenue, -quantity);

    if (!resourceUpdate.success) {
      return { 
        success: false, 
        error: 'Erro ao atualizar recursos do jogador' 
      };
    }

    return {
      success: true,
      transaction: transactionResult.transaction,
      newBalance: {
        waterCredits: resourceUpdate.player.waterCredits,
        foodUnits: resourceUpdate.player.foodUnits
      }
    };
  } catch (error) {
    ErrorHandler.logError('MarketService.sellCrop', error, { playerId, cropId, quantity });
    return { success: false, error: error.message };
  }
};

/**
 * Obtém preço atual de mercado de uma cultura
 * Agora com persistência de histórico de preços
 */
MarketService.getMarketPrice = function(cropId, round) {
  try {
    const crop = CropService.getCropById(cropId);
    
    if (!crop) {
      return { success: false, error: 'Cultura não encontrada' };
    }

    // Busca preço registrado para esta rodada (se existir)
    const historicalPrice = MarketService.getHistoricalPrice(cropId, round);
    if (historicalPrice) {
      return {
        success: true,
        cropId: cropId,
        cropName: crop.name,
        basePrice: historicalPrice.basePrice,
        currentPrice: historicalPrice.price,
        price: historicalPrice.price,
        variation: historicalPrice.variation,
        round: round,
        fromHistory: true
      };
    }

    // Preço base (se configurado) ou calculado pela eficiência
    let basePrice = MarketService.BASE_PRICES[cropId];
    
    if (!basePrice) {
      const efficiency = CropService.getCropEfficiency(cropId);
      basePrice = efficiency.success ? Math.round(efficiency.efficiency * 100) : 10;
    }

    // Adiciona variação baseada em fatores de mercado
    const variation = MarketService.calculatePriceVariation(cropId, round);
    const currentPrice = Math.round(basePrice * (1 + variation) * 100) / 100;

    // Persiste preço para esta rodada
    MarketService.recordPrice(cropId, round, basePrice, currentPrice, variation);

    return {
      success: true,
      cropId: cropId,
      cropName: crop.name,
      basePrice: basePrice,
      currentPrice: currentPrice,
      price: currentPrice,
      variation: Math.round(variation * 100),
      round: round,
      fromHistory: false
    };
  } catch (error) {
    ErrorHandler.logError('MarketService.getMarketPrice', error, { cropId });
    return { success: false, error: error.message };
  }
};

/**
 * Calcula variação de preço baseada em fatores de mercado
 * Usa histórico de transações e condições climáticas
 */
MarketService.calculatePriceVariation = function(cropId, round) {
  try {
    // Variação base aleatória
    let variation = (Math.random() * 2 - 1) * MarketService.PRICE_VARIATION;

    // Ajusta baseado em demanda recente
    const recentTransactions = MarketService.getTransactionsByCrop(cropId).slice(0, 10);
    if (recentTransactions.length > 0) {
      const recentBuys = recentTransactions.filter(function(t) { return t.type === 'COMPRA'; }).length;
      const recentSells = recentTransactions.filter(function(t) { return t.type === 'VENDA'; }).length;
      
      // Mais compras = preço sobe, mais vendas = preço cai
      const demandFactor = (recentBuys - recentSells) / (recentTransactions.length || 1);
      variation += demandFactor * 0.05; // até 5% de ajuste por demanda
    }

    // Ajusta baseado em clima
    if (typeof ClimateService !== 'undefined') {
      const climate = ClimateService.getCurrentClimate();
      if (climate) {
        if (climate.status === 'SECA') {
          variation += 0.10; // Seca aumenta preços em 10%
        } else if (climate.rainValue > 200) {
          variation -= 0.05; // Chuva abundante reduz preços em 5%
        }
      }
    }

    // Limita variação total
    return Math.max(-MarketService.PRICE_VARIATION * 1.5, Math.min(MarketService.PRICE_VARIATION * 1.5, variation));

  } catch (error) {
    ErrorHandler.logError('MarketService.calculatePriceVariation', error, { cropId, round });
    return (Math.random() * 2 - 1) * MarketService.PRICE_VARIATION;
  }
};

/**
 * Registra preço histórico de uma cultura para uma rodada
 * Implementa persistência que estava ausente
 */
MarketService.recordPrice = function(cropId, round, basePrice, currentPrice, variation) {
  try {
    // Usa aba Config.SHEETS.MARKET ou cria estrutura na memória
    // Por enquanto, registra como evento no histórico
    if (typeof HistoryService !== 'undefined' && HistoryService.recordEvent) {
      HistoryService.recordEvent({
        round: round || 0,
        eventType: 'PRICE_UPDATE',
        title: 'Atualização de Preço',
        description: `Preço da cultura ${cropId} atualizado`,
        impact: JSON.stringify({
          cropId: cropId,
          basePrice: basePrice,
          currentPrice: currentPrice,
          variation: variation
        }),
        affectedPlayers: ''
      });
    }

    return true;

  } catch (error) {
    ErrorHandler.logError('MarketService.recordPrice', error, { cropId, round, currentPrice });
    return false;
  }
};

/**
 * Busca preço histórico de uma cultura para uma rodada específica
 */
MarketService.getHistoricalPrice = function(cropId, round) {
  try {
    if (!round || typeof HistoryService === 'undefined') {
      return null;
    }

    // Busca eventos de atualização de preço para esta rodada
    const events = HistoryService.getEventHistory({
      round: round,
      eventType: 'PRICE_UPDATE'
    });

    // Encontra preço da cultura específica
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      try {
        const impact = JSON.parse(event.impact);
        if (impact.cropId === cropId) {
          return {
            cropId: cropId,
            basePrice: impact.basePrice,
            price: impact.currentPrice,
            variation: impact.variation,
            round: round
          };
        }
      } catch (parseError) {
        // Ignora eventos com formato inválido
        continue;
      }
    }

    return null;

  } catch (error) {
    ErrorHandler.logError('MarketService.getHistoricalPrice', error, { cropId, round });
    return null;
  }
};

/**
 * Retorna série temporal de preços de uma cultura
 * @param {string} cropId - ID da cultura
 * @param {number} limit - Número de rodadas no histórico
 * @returns {Array} Série de preços por rodada
 */
MarketService.getPriceHistory = function(cropId, limit) {
  try {
    limit = Number(limit) || 10;

    if (typeof HistoryService === 'undefined') {
      return [];
    }

    // Busca todos eventos de preço
    const events = HistoryService.getEventHistory({ eventType: 'PRICE_UPDATE' });
    
    const priceHistory = [];
    
    events.forEach(function(event) {
      try {
        const impact = JSON.parse(event.impact);
        if (impact.cropId === cropId) {
          priceHistory.push({
            round: event.round,
            basePrice: impact.basePrice,
            price: impact.currentPrice,
            variation: impact.variation,
            date: event.createdAt
          });
        }
      } catch (parseError) {
        // Ignora eventos com formato inválido
      }
    });

    // Ordena por rodada (mais recente primeiro)
    priceHistory.sort(function(a, b) {
      return b.round - a.round;
    });

    return priceHistory.slice(0, limit);

  } catch (error) {
    ErrorHandler.logError('MarketService.getPriceHistory', error, { cropId, limit });
    return [];
  }
};

/**
 * Estatísticas de preço de uma cultura (mín, máx, média)
 */
MarketService.getPriceStatistics = function(cropId) {
  try {
    const history = MarketService.getPriceHistory(cropId, 50);

    if (history.length === 0) {
      return { success: false, error: 'Sem dados de histórico de preços' };
    }

    const prices = history.map(function(h) { return h.price; });
    const minPrice = Math.min.apply(null, prices);
    const maxPrice = Math.max.apply(null, prices);
    const avgPrice = prices.reduce(function(sum, p) { return sum + p; }, 0) / prices.length;

    return {
      success: true,
      cropId: cropId,
      statistics: {
        min: Math.round(minPrice * 100) / 100,
        max: Math.round(maxPrice * 100) / 100,
        average: Math.round(avgPrice * 100) / 100,
        current: history[0].price,
        volatility: Math.round(((maxPrice - minPrice) / avgPrice) * 100)
      },
      dataPoints: history.length
    };

  } catch (error) {
    ErrorHandler.logError('MarketService.getPriceStatistics', error, { cropId });
    return { success: false, error: error.message };
  }
};

/**
 * Histórico de transações
 */
MarketService.getTransactionHistory = function(limit) {
  try {
    limit = Number(limit) || 20;

    const sheet = Config.SHEETS.MARKET;
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return [];
    }

    const headers = values[0];
    const transactions = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      transactions.push(MarketService.mapRow(headers, row));
    }

    // Ordena por data (mais recente primeiro)
    transactions.sort(function(a, b) {
      return b.transactionDate - a.transactionDate;
    });

    return transactions.slice(0, limit);
  } catch (error) {
    ErrorHandler.logError('MarketService.getTransactionHistory', error, { limit });
    return [];
  }
};

/**
 * Balanço de compras e vendas de um jogador
 */
MarketService.getPlayerBalance = function(playerId) {
  try {
    const transactions = MarketService.getTransactionsByPlayer(playerId);

    let totalSpent = 0;
    let totalEarned = 0;
    let totalBought = 0;
    let totalSold = 0;

    transactions.forEach(function(t) {
      if (t.type === 'COMPRA') {
        totalSpent += t.totalPrice;
        totalBought += t.quantity;
      } else if (t.type === 'VENDA') {
        totalEarned += t.totalPrice;
        totalSold += t.quantity;
      }
    });

    const netBalance = totalEarned - totalSpent;

    return {
      playerId: playerId,
      transactions: transactions.length,
      purchases: {
        count: transactions.filter(function(t) { return t.type === 'COMPRA'; }).length,
        totalSpent: totalSpent,
        totalQuantity: totalBought
      },
      sales: {
        count: transactions.filter(function(t) { return t.type === 'VENDA'; }).length,
        totalEarned: totalEarned,
        totalQuantity: totalSold
      },
      balance: {
        net: netBalance,
        status: netBalance >= 0 ? 'POSITIVO' : 'NEGATIVO'
      }
    };
  } catch (error) {
    ErrorHandler.logError('MarketService.getPlayerBalance', error, { playerId });
    return null;
  }
};

/**
 * Estatísticas gerais do mercado
 */
MarketService.getMarketStats = function() {
  try {
    const sheet = Config.getSheet(Config.SHEETS.MARKET);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return {
        totalTransactions: 0,
        totalVolume: 0,
        averagePrice: 0,
        mostTraded: null
      };
    }

    const headers = values[0];
    const transactions = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      transactions.push(MarketService.mapRow(headers, row));
    }

    // Estatísticas gerais
    const totalVolume = transactions.reduce(function(sum, t) {
      return sum + t.totalPrice;
    }, 0);

    const averagePrice = transactions.length > 0 ? totalVolume / transactions.length : 0;

    // Cultura mais negociada
    const cropCounts = {};
    transactions.forEach(function(t) {
      cropCounts[t.cropId] = (cropCounts[t.cropId] || 0) + t.quantity;
    });

    let mostTradedCropId = null;
    let maxQuantity = 0;
    Object.keys(cropCounts).forEach(function(cropId) {
      if (cropCounts[cropId] > maxQuantity) {
        maxQuantity = cropCounts[cropId];
        mostTradedCropId = cropId;
      }
    });

    return {
      totalTransactions: transactions.length,
      totalVolume: Math.round(totalVolume * 100) / 100,
      averagePrice: Math.round(averagePrice * 100) / 100,
      mostTraded: mostTradedCropId ? {
        cropId: mostTradedCropId,
        quantity: maxQuantity,
        crop: CropService.getCropById(mostTradedCropId)
      } : null
    };
  } catch (error) {
    ErrorHandler.logError('MarketService.getMarketStats', error);
    return null;
  }
};

/**
 * Estatísticas de uma cultura específica
 */
MarketService.getCropMarketStats = function(cropId) {
  try {
    const transactions = MarketService.getTransactionsByCrop(cropId);
    const crop = CropService.getCropById(cropId);

    if (!crop) {
      return null;
    }

    if (transactions.length === 0) {
      return {
        crop: crop,
        transactions: 0,
        totalVolume: 0,
        averagePrice: 0,
        totalQuantity: 0
      };
    }

    const totalVolume = transactions.reduce(function(sum, t) {
      return sum + t.totalPrice;
    }, 0);

    const totalQuantity = transactions.reduce(function(sum, t) {
      return sum + t.quantity;
    }, 0);

    const averagePrice = totalVolume / totalQuantity;

    return {
      crop: crop,
      transactions: transactions.length,
      totalVolume: Math.round(totalVolume * 100) / 100,
      totalQuantity: totalQuantity,
      averagePrice: Math.round(averagePrice * 100) / 100,
      currentPrice: MarketService.getMarketPrice(cropId).currentPrice
    };
  } catch (error) {
    ErrorHandler.logError('MarketService.getCropMarketStats', error, { cropId });
    return null;
  }
};

/**
 * Mapeia linha da planilha para objeto transação
 */
MarketService.mapRow = function(headers, row) {
  const transaction = {};
  
  headers.forEach(function(header, index) {
    const key = String(header || '').trim().toLowerCase();
    const value = row[index];
    
    if (key === 'transactionid') {
      transaction.transactionId = String(value || '').trim();
    } else if (key === 'playerid') {
      transaction.playerId = String(value || '').trim();
    } else if (key === 'cropid') {
      transaction.cropId = String(value || '').trim();
    } else if (key === 'quantity') {
      transaction.quantity = Number(value) || 0;
    } else if (key === 'priceunit') {
      transaction.priceUnit = Number(value) || 0;
    } else if (key === 'totalprice') {
      transaction.totalPrice = Number(value) || 0;
    } else if (key === 'transactiondate') {
      transaction.transactionDate = value instanceof Date ? value : new Date(value);
    } else if (key === 'type') {
      transaction.type = String(value || '').trim();
    } else {
      transaction[header] = value;
    }
  });
  
  return transaction;
};

/**
 * Gera ID único para transação
 */
MarketService.generateTransactionId = function() {
  try {
    const sheet = Config.getSheet(Config.SHEETS.MARKET);
    const lastRow = sheet.getLastRow();
    const nextNumber = Math.max(1, lastRow);
    
    return 'T-' + String(nextNumber).padStart(3, '0');
  } catch (error) {
    ErrorHandler.logError('MarketService.generateTransactionId', error);
    return 'T-' + Date.now();
  }
};

/**
 * Função de teste
 */
function testMarketService() {
  Logger.log('=== Testando MarketService ===');
  
  // Teste de preço de mercado
  Logger.log('1. Obtendo preço de mercado...');
  const priceInfo = MarketService.getMarketPrice('C-01');
  Logger.log('Preço: ' + JSON.stringify(priceInfo));
  
  // Teste de compra
  Logger.log('2. Comprando cultura...');
  const buyResult = MarketService.buyCrop('P-100', 'C-01', 10);
  Logger.log('Resultado: ' + JSON.stringify(buyResult));
  
  if (buyResult.success) {
    // Teste de histórico
    Logger.log('3. Consultando histórico do jogador...');
    const history = MarketService.getTransactionsByPlayer('P-100');
    Logger.log('Transações: ' + history.length);
    
    // Teste de balanço
    Logger.log('4. Calculando balanço...');
    const balance = MarketService.getPlayerBalance('P-100');
    Logger.log('Balanço: ' + JSON.stringify(balance));
    
    // Teste de venda
    Logger.log('5. Vendendo cultura...');
    const sellResult = MarketService.sellCrop('P-100', 'C-01', 5);
    Logger.log('Resultado: ' + JSON.stringify(sellResult));
  }
  
  // Teste de estatísticas
  Logger.log('6. Estatísticas do mercado...');
  const stats = MarketService.getMarketStats();
  Logger.log('Stats: ' + JSON.stringify(stats));
  
  Logger.log('=== Teste concluído ===');
}
