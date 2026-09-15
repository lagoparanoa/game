/**
 * @file EconomicService.gs
 * @description Regras econômicas transparentes e puras para que cada decisão
 *              possa ser explicada: custo, rendimento, receita, lucro e impacto.
 */

function EconomicService() {
  Logger.log('Iniciando componente: EconomicService.gs');
}

EconomicService.number_ = function(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : (fallback || 0);
};

EconomicService.clamp_ = function(value, min, max) {
  return Math.min(Math.max(EconomicService.number_(value, min), min), max);
};

EconomicService.calculateProfit = function(revenue, cost, penalty) {
  return EconomicService.number_(revenue) - EconomicService.number_(cost) - EconomicService.number_(penalty);
};

EconomicService.calculateCropOutcome = function(crop, quantity, waterUsed, climate, options) {
  if (!crop || !crop.cropId && !crop.name) throw new Error('Cultura inválida');
  const qty = Math.max(0, EconomicService.number_(quantity));
  const needed = Math.max(1, EconomicService.number_(crop.waterNeed, 1) * qty);
  const used = Math.max(0, EconomicService.number_(waterUsed));
  const waterFactor = EconomicService.clamp_(used / needed, 0, 1);
  const rain = EconomicService.number_(climate && climate.rainValue, 0);
  const climateFactor = rain > 100 ? 1.1 : (rain > 0 ? 1 : 0.75);
  const yieldUnits = EconomicService.number_(crop.yieldPerCycle, 0) * qty * waterFactor * climateFactor;
  const price = EconomicService.number_(options && options.price, EconomicService.number_(crop.marketPrice, 1));
  const revenue = yieldUnits * price;
  const cost = EconomicService.number_(options && options.cost, 0);
  const penalty = EconomicService.number_(options && options.penalty, (1 - waterFactor) * price);
  const sustainabilityDelta = EconomicService.clamp_(50 + (waterFactor * 35) + (climateFactor * 10) - (used / Math.max(qty, 1) / 20), 0, 100) - 50;
  return {
    quantity: qty,
    waterNeeded: needed,
    waterUsed: used,
    waterFactor: Math.round(waterFactor * 100) / 100,
    climateFactor: climateFactor,
    yieldUnits: Math.round(yieldUnits * 100) / 100,
    revenue: Math.round(revenue * 100) / 100,
    cost: Math.round(cost * 100) / 100,
    penalty: Math.round(penalty * 100) / 100,
    profit: Math.round(EconomicService.calculateProfit(revenue, cost, penalty) * 100) / 100,
    sustainabilityDelta: Math.round(sustainabilityDelta * 10) / 10
  };
};

EconomicService.summarizeTransactions = function(transactions) {
  const summary = { purchases: 0, sales: 0, totalSpent: 0, totalEarned: 0, balance: 0, transactionCount: 0 };
  (transactions || []).forEach(function(transaction) {
    const amount = EconomicService.number_(transaction.totalPrice);
    const type = String(transaction.type || '').toUpperCase();
    summary.transactionCount++;
    if (type === 'COMPRA') {
      summary.purchases++;
      summary.totalSpent += amount;
    } else if (type === 'VENDA') {
      summary.sales++;
      summary.totalEarned += amount;
    }
  });
  summary.balance = summary.totalEarned - summary.totalSpent;
  summary.totalSpent = Math.round(summary.totalSpent * 100) / 100;
  summary.totalEarned = Math.round(summary.totalEarned * 100) / 100;
  summary.balance = Math.round(summary.balance * 100) / 100;
  return summary;
};

EconomicService.getPlayerBalance = function(playerId) {
  try {
    const transactions = typeof MarketService !== 'undefined' && MarketService.getTransactionsByPlayer
      ? MarketService.getTransactionsByPlayer(playerId) : [];
    return { success: true, data: EconomicService.summarizeTransactions(transactions) };
  } catch (error) {
    ErrorHandler.logError('EconomicService.getPlayerBalance', error, { playerId: playerId });
    return { success: false, error: 'Não foi possível calcular o balanço.' };
  }
};

/**
 * Calcula o retorno sobre investimento em eficiência hídrica
 * @param {number} investment - Custo do investimento (créditos)
 * @param {number} waterSaved - Litros economizados por ciclo
 * @param {number} pricePerLiter - Valor do crédito hídrico por litro
 * @returns {Object} ROI percentual, payback em ciclos e ganho líquido estimado
 */
EconomicService.calculateWaterROI = function(investment, waterSaved, pricePerLiter) {
  const inv = EconomicService.number_(investment, 0);
  const saved = Math.max(0, EconomicService.number_(waterSaved, 0));
  const price = Math.max(0, EconomicService.number_(pricePerLiter, 1));

  if (inv <= 0) {
    return { roi: 0, paybackCycles: 0, netGainPerCycle: 0, viable: false };
  }

  const gainPerCycle = saved * price;
  const paybackCycles = gainPerCycle > 0 ? Math.ceil(inv / gainPerCycle) : Infinity;
  const roi = gainPerCycle > 0 ? Math.round(((gainPerCycle / inv) * 100) * 100) / 100 : 0;

  return {
    investment: Math.round(inv * 100) / 100,
    waterSavedPerCycle: saved,
    pricePerLiter: price,
    gainPerCycle: Math.round(gainPerCycle * 100) / 100,
    roi: roi,
    paybackCycles: isFinite(paybackCycles) ? paybackCycles : null,
    viable: paybackCycles <= 10
  };
};

/**
 * Prevê a receita de uma cultura em três cenários climáticos
 * @param {Object} crop - Objeto cultura (cropId, waterNeed, yieldPerCycle, marketPrice)
 * @param {number} quantity - Quantidade plantada
 * @returns {Object} Cenários seco, normal e chuvoso com receita e lucro estimados
 */
EconomicService.forecastRevenue = function(crop, quantity) {
  if (!crop) throw new Error('Cultura inválida para previsão');
  var qty = Math.max(0, EconomicService.number_(quantity, 1));
  var scenarios = [
    { name: 'seco',    rainValue: 0,   label: 'Seca severa' },
    { name: 'normal',  rainValue: 80,  label: 'Clima normal' },
    { name: 'chuvoso', rainValue: 200, label: 'Período chuvoso' }
  ];

  var results = {};
  scenarios.forEach(function(s) {
    // Na seca usamos 70% da necessidade hídrica; no normal, 100%; chuvoso, 100% + bônus
    var waterFactor = s.rainValue === 0 ? 0.7 : 1;
    var waterUsed = EconomicService.number_(crop.waterNeed, 1) * qty * waterFactor;
    var outcome = EconomicService.calculateCropOutcome(crop, qty, waterUsed, { rainValue: s.rainValue });
    results[s.name] = {
      label: s.label,
      revenue: outcome.revenue,
      cost: outcome.cost,
      profit: outcome.profit,
      yieldUnits: outcome.yieldUnits,
      sustainabilityDelta: outcome.sustainabilityDelta
    };
  });

  return { crop: crop.cropId || crop.name || 'desconhecida', quantity: qty, scenarios: results };
};

/**
 * Ordena culturas por eficiência hídrica (receita por litro de água) dentro do orçamento
 * @param {Array<Object>} crops - Lista de culturas com waterNeed e marketPrice e yieldPerCycle
 * @param {number} waterBudget - Total de litros disponíveis
 * @returns {Array<Object>} Culturas ordenadas por revenuePerLiter, com quantidade máxima viável
 */
EconomicService.rankCropsByEfficiency = function(crops, waterBudget) {
  var budget = Math.max(0, EconomicService.number_(waterBudget, 0));
  var ranked = (crops || []).map(function(crop) {
    var waterNeed = Math.max(1, EconomicService.number_(crop.waterNeed, 1));
    var maxQty = budget > 0 ? Math.floor(budget / waterNeed) : 0;
    var revenuePerLiter = (EconomicService.number_(crop.yieldPerCycle, 0) * EconomicService.number_(crop.marketPrice, 1)) / waterNeed;
    return {
      cropId: crop.cropId || crop.name || '?',
      waterNeedPerUnit: waterNeed,
      maxQuantityInBudget: maxQty,
      revenuePerLiter: Math.round(revenuePerLiter * 1000) / 1000,
      estimatedRevenue: Math.round(revenuePerLiter * budget * 100) / 100
    };
  });

  ranked.sort(function(a, b) { return b.revenuePerLiter - a.revenuePerLiter; });
  return ranked;
};
