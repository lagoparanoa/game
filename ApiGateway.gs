/**
 * @file ApiGateway.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Interface para possíveis integrações externas (Webhooks/API REST).
 * @context Integração da lógica técnica robusta (V1) com a narrativa do DF (V2).
 *          Todo o CRUD é processado na planilha via SPREADSHEETS_ID.
 *
 * @principais_funcionalidades
 * - Interpretação de requisições HTTP externas
 * - Serialização JSON de respostas
 * - Tratamento de cargas úteis e parâmetros
 * - Normalização de erros para APIs de integração
 */

function ApiGateway() {
  Logger.log("Iniciando componente: ApiGateway.gs");
}

function lagoApiFailure_(context, error) {
  ErrorHandler.logError(context, error);
  return {
    success: false,
    error: ErrorHandler.handleError(error, 'a operação').message
  };
}

/**
 * Converte objetos do Apps Script em valores aceitos por google.script.run.
 * Datas vindas das planilhas são convertidas para strings ISO pelo JSON.
 */
function lagoClientSafe_(value) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

function requireLagoAdmin_() {
  const user = SessionManager.getSessionUser();
  if (!user || String(user.role || '').toLowerCase() !== 'admin') {
    throw new Error('Acesso negado.');
  }
  return user;
}

function positiveInteger_(value, label, max, defaultValue) {
  const candidate = value === undefined || value === null || value === ''
    ? defaultValue
    : Number(value);
  if (!isFinite(candidate) || candidate <= 0 || Math.floor(candidate) !== candidate || candidate > max) {
    throw new Error(label + ' deve ser um inteiro entre 1 e ' + max + '.');
  }
  return candidate;
}

ApiGateway.handleRequest = function(request) {
  try {
    if (!request) {
      throw new Error('Requisição inválida.');
    }

    const action = request.parameter && request.parameter.action ? request.parameter.action : null;

    switch (action) {
      case 'ping':
        return ApiGateway.createJsonResponse({ message: 'pong' });
      case 'export':
        requireLagoAdmin_();
        const sheetName = request.parameter.sheetName;
        if (!sheetName) throw new Error('Nome da aba é obrigatório.');
        return ApiGateway.createJsonResponse(ImportExport.exportSheetToJson(sheetName));
      default:
        throw new Error('Ação não reconhecida.');
    }
  } catch (error) {
    ErrorHandler.logError('ApiGateway.handleRequest', error, {
      action: request && request.parameter ? request.parameter.action : null
    });
    return ApiGateway.createErrorResponse(error);
  }
};

ApiGateway.parsePayload = function(request) {
  try {
    if (!request || !request.postData || !request.postData.contents) {
      return {};
    }

    return JSON.parse(request.postData.contents);
  } catch (error) {
    ErrorHandler.logError('ApiGateway.parsePayload', error, {
      hasPostData: Boolean(request && request.postData && request.postData.contents),
      payloadLength: request && request.postData && request.postData.contents
        ? String(request.postData.contents).length
        : 0
    });
    return {};
  }
};

ApiGateway.createJsonResponse = function(payload) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: payload }))
    .setMimeType(ContentService.MimeType.JSON);
};

ApiGateway.createErrorResponse = function(error) {
  const safe = ErrorHandler.handleError(error, 'a requisição');
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: safe.errorType, message: safe.message }))
    .setMimeType(ContentService.MimeType.JSON);
};

/**
 * ============================================================================
 * FUNÇÕES CHAMÁVEIS DO FRONTEND VIA google.script.run
 * ============================================================================
 * Estas funções são expostas globalmente para serem chamadas pelos arquivos HTML
 */

/**
 * Planta uma cultura para o jogador
 * @param {string} playerId - ID do jogador
 * @param {string} cropId - ID da cultura
 * @param {number} quantity - Quantidade a plantar (padrão: 1)
 * @returns {Object} { success, message, data }
 */
function plantCrop(playerId, cropId, quantity) {
  try {
    // Validar sessão
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada. Faça login novamente.' };
    }
    
    // Validar propriedade do jogador
    const player = PlayerService.getPlayerById(playerId);
    if (!player || player.userId !== user.userId) {
      AuditLog.logEvent('UNAUTHORIZED_ACCESS_ATTEMPT', {
        userId: user.userId,
        attemptedPlayerId: playerId,
        action: 'plantCrop'
      });
      return { success: false, error: 'Acesso negado.' };
    }
    
    // Buscar informações da cultura
    const crop = CropService.getCropById(cropId);
    if (!crop) {
      return { success: false, error: 'Cultura não encontrada.' };
    }
    
    const qty = positiveInteger_(quantity, 'A quantidade de plantio', 1000, 1);
    const waterNeeded = crop.waterNeed * qty;
    
    // Validar recursos
    if (player.waterCredits < waterNeeded) {
      return {
        success: false,
        error: `Água insuficiente. Necessário: ${waterNeeded}, Disponível: ${player.waterCredits}`
      };
    }
    
    // Executar plantio
    const result = CropService.plantCrop(playerId, cropId, qty);
    
    if (result.success) {
      // Atualizar recursos do jogador
      PlayerService.updateResources(playerId, -waterNeeded, 0);
      
      // Registrar extração no aquífero
      if (player.villageId) {
        AquiferService.recordExtraction(player.villageId, waterNeeded);
      }
      
      // Log de auditoria
      AuditLog.logEvent('CROP_PLANTED', {
        playerId: playerId,
        cropId: cropId,
        quantity: qty,
        waterUsed: waterNeeded
      });
      
      return {
        success: true,
        message: `${crop.name} plantado com sucesso!`,
        data: {
          waterRemaining: player.waterCredits - waterNeeded,
          harvestRound: result.harvestRound
        }
      };
    }
    
    return result;
    
  } catch (error) {
    return lagoApiFailure_('ApiGateway.plantCrop', error);
  }
}

function requireOwnedPlayer_(playerId) {
  const user = SessionManager.getSessionUser();
  if (!user) throw new Error('Sessão expirada. Faça login novamente.');
  const player = PlayerService.getPlayerById(playerId);
  if (!player || player.userId !== user.userId) throw new Error('Acesso negado.');
  return player;
}

/** Retoma a rodada investigativa ainda não revisada, se houver. */
function getInvestigationStatus(playerId) {
  try {
    const player = requireOwnedPlayer_(playerId);
    const history = HistoryService.getPlayerHistory(playerId, 100);
    return lagoClientSafe_({
      success: true,
      data: {
        currentRound: history.reduce(function(max, record) { return Math.max(max, Number(record.round) || 0); }, 0),
        pendingReview: HistoryService.getPendingReview(playerId),
        player: player
      }
    });
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getInvestigationStatus', error);
  }
}

/** Executa previsão → decisão → resultado e deixa a revisão como próxima etapa obrigatória. */
function runInvestigationRound(playerId, decision) {
  let lock;
  try {
    const player = requireOwnedPlayer_(playerId);
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    if (HistoryService.getPendingReview(playerId)) {
      return { success: false, error: 'Revise a rodada anterior antes de iniciar um novo teste.' };
    }
    decision = decision && typeof decision === 'object' && !Array.isArray(decision) ? decision : {};
    const crop = CropService.getCropById(String(decision.cropId || ''));
    if (!crop || crop.status !== 'ATIVO') return { success: false, error: 'Cultura não encontrada ou inativa.' };
    const quantity = positiveInteger_(decision.quantity, 'A quantidade', 100, 1);
    const waterUsed = Number(decision.waterUsed);
    if (!isFinite(waterUsed) || waterUsed <= 0) return { success: false, error: 'Informe uma quantidade válida de água.' };
    const history = HistoryService.getPlayerHistory(playerId, 100);
    const currentRound = history.reduce(function(max, record) { return Math.max(max, Number(record.round) || 0); }, 0);
    
    // Usa preço com histórico (nova integração)
    const price = MarketService.getMarketPrice(crop.cropId, currentRound + 1);
    if (!price || price.success === false) return { success: false, error: 'Preço da cultura indisponível.' };
    
    const climate = ClimateService.getCurrentClimate() || {};
    const input = {
      state: {
        playerId: player.playerId,
        villageId: player.villageId || '',
        round: currentRound,
        waterCredits: Number(player.waterCredits) || 0,
        foodUnits: Number(player.foodUnits) || 0,
        sustainabilityScore: Number(player.sustainabilityScore) || 0,
        climate: climate
      },
      action: {
        playerId: player.playerId,
        villageId: player.villageId || '',
        crop: crop,
        quantity: quantity,
        waterUsed: waterUsed,
        climate: climate,
        economic: { price: price.currentPrice },
        prediction: String(decision.prediction || '').trim()
      }
    };
    
    // Fase 1: calcula sem produzir histórico, XP ou efeitos coletivos.
    const result = GameEngine.prepareRound(input);
    if (!result.success) return result;

    const update = PlayerService.updatePlayer(playerId, {
      waterCredits: result.nextState.waterCredits,
      foodUnits: result.nextState.foodUnits,
      sustainabilityScore: result.nextState.sustainabilityScore
    });
    if (!update.success) return update;
    
    // Fase 2: somente após persistir o jogador confirma os demais efeitos.
    const committed = GameEngine.commitRoundEffects(result);
    if (!committed.success) {
      const rollback = PlayerService.updatePlayer(playerId, {
        waterCredits: player.waterCredits,
        foodUnits: player.foodUnits,
        sustainabilityScore: player.sustainabilityScore
      });
      return {
        success: false,
        error: committed.error || 'Erro ao confirmar os efeitos da rodada.',
        rollbackApplied: Boolean(rollback && rollback.success)
      };
    }
    const committedResult = committed;
    
    // Extração do aquífero já registrada pelo GameEngine
    
    AuditLog.logEvent('INVESTIGATION_ROUND_COMPLETED', { 
      playerId: playerId, 
      historyId: committedResult.history.record.historyId,
      round: committedResult.round,
      xpAwarded: committedResult.xp ? committedResult.xp.awarded : 0,
      leveledUp: committedResult.xp ? committedResult.xp.leveledUp : false
    });
    
    return lagoClientSafe_({
      success: true,
      message: 'Resultado calculado. Compare com sua previsão e registre a revisão.',
      data: { 
        result: committedResult,
        historyId: committedResult.history.record.historyId,
        player: update.player,
        xp: committedResult.xp || null,
        aquiferRecharge: committedResult.aquiferRecharge || null,
        eventsTriggered: committedResult.eventsTriggered || 0
      }
    });
  } catch (error) {
    return lagoApiFailure_('ApiGateway.runInvestigationRound', error);
  } finally {
    if (lock) lock.releaseLock();
  }
}

/** Fecha explicação → próximo teste e libera outra rodada. */
function completeInvestigationRound(playerId, historyId, reflection, nextTest) {
  try {
    requireOwnedPlayer_(playerId);
    const result = HistoryService.completeRoundReflection(historyId, playerId, reflection, nextTest);
    if (!result.success) return result;
    AuditLog.logEvent('INVESTIGATION_ROUND_REVIEWED', { playerId: playerId, historyId: historyId });
    return lagoClientSafe_({ success: true, message: 'Revisão registrada. Uma nova rodada foi liberada.', data: result.record });
  } catch (error) {
    return lagoApiFailure_('ApiGateway.completeInvestigationRound', error);
  }
}

/**
 * Colhe uma cultura plantada
 * @param {string} plantingId - ID do plantio
 * @returns {Object} { success, message, data }
 */
function harvestCrop(plantingId) {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada.' };
    }
    
    const result = CropService.harvestCrop(plantingId, user.userId);
    
    if (result.success) {
      AuditLog.logEvent('CROP_HARVESTED', {
        userId: user.userId,
        plantingId: plantingId,
        yield: result.data.yield
      });
    }
    
    return result;
    
  } catch (error) {
    return lagoApiFailure_('ApiGateway.harvestCrop', error);
  }
}

/**
 * Compra créditos de água
 * @param {string} playerId - ID do jogador
 * @param {number} amount - Quantidade de créditos
 * @returns {Object} { success, message }
 */
function buyWater(playerId, amount) {
  try {
    amount = positiveInteger_(amount, 'A quantidade de água', 100000);
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada.' };
    }
    
    const player = PlayerService.getPlayerById(playerId);
    if (!player || player.userId !== user.userId) {
      return { success: false, error: 'Acesso negado.' };
    }
    
    const waterPrice = 0.5; // $0.50 por crédito
    const cost = amount * waterPrice;
    
    if (player.foodUnits < cost) {
      return {
        success: false,
        error: `Alimento insuficiente. Custo: ${cost}, Disponível: ${player.foodUnits}`
      };
    }
    
    // Atualizar recursos
    PlayerService.updateResources(playerId, amount, -cost);
    
    AuditLog.logEvent('WATER_PURCHASED', {
      playerId: playerId,
      amount: amount,
      cost: cost
    });
    
    return {
      success: true,
      message: `${amount} créditos de água comprados por ${cost} unidades de alimento.`
    };
    
  } catch (error) {
    return lagoApiFailure_('ApiGateway.buyWater', error);
  }
}

/**
 * Consolida os dados necessários para a decisão hídrica do jogador autenticado.
 * A credencial continua sendo validada exclusivamente pelo SessionManager; esta
 * função apenas reduz a quantidade de viagens entre a tela e o Apps Script.
 *
 * @returns {Object} Jogador, estado do aquífero, série recente e limites de compra
 */
function getWaterManagementData() {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada.' };
    }

    const currentPlayer = getCurrentUserPlayer();
    if (!currentPlayer || currentPlayer.success !== true || !currentPlayer.data || !currentPlayer.data.player) {
      return {
        success: false,
        error: currentPlayer && currentPlayer.error ? currentPlayer.error : 'Jogador não encontrado.'
      };
    }

    const player = currentPlayer.data.player;
    const unitPrice = 0.5;
    const foodUnits = Math.max(0, Number(player.foodUnits) || 0);

    return lagoClientSafe_({
      success: true,
      data: {
        player: player,
        aquifer: AquiferService.getCurrentStatus(),
        history: AquiferService.getHistory(12),
        market: {
          unitPrice: unitPrice,
          maxPurchasable: Math.floor(foodUnits / unitPrice)
        }
      }
    });
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getWaterManagementData', error);
  }
}

/**
 * Reúne observações e projeções climáticas para a leitura investigativa.
 * A previsão é uma estimativa do modelo local e permanece identificada como
 * tal; o endpoint não mistura projeção com medições persistidas.
 *
 * @returns {Object} Clima atual, histórico, previsão e estado do aquífero
 */
function getClimateReportData() {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada.' };
    }

    return lagoClientSafe_({
      success: true,
      data: {
        current: ClimateService.getCurrentClimate(),
        history: ClimateService.getHistory(12),
        forecast: ClimateService.getForecast(6),
        aquifer: AquiferService.getCurrentStatus(),
        modelNotice: 'Estimativa sazonal do jogo; não é uma previsão meteorológica oficial.'
      }
    });
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getClimateReportData', error);
  }
}

/**
 * Executa uma leitura auxiliar sem derrubar o centro operacional inteiro.
 * Falhas continuam registradas no servidor e o cliente recebe o fallback.
 */
function lagoOptionalRead_(context, work, fallback) {
  try {
    return work();
  } catch (error) {
    ErrorHandler.logError(context, error);
    return fallback;
  }
}

/**
 * Entrega dados reais para os módulos secundários por uma única superfície.
 * Cada módulo consulta somente os serviços necessários para sua finalidade.
 *
 * @param {string} moduleName - Módulo solicitado pela rota
 * @returns {Object} Snapshot autenticado do módulo
 */
function getOperationsHubData(moduleName) {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) return { success: false, error: 'Sessão expirada.' };

    const allowed = [
      'market', 'research', 'build', 'inventory', 'resources', 'profile', 'actions', 'map',
      'reports', 'sustainability', 'economic', 'settings', 'village-details'
    ];
    moduleName = String(moduleName || '').trim().toLowerCase();
    if (allowed.indexOf(moduleName) === -1) {
      return { success: false, error: 'Módulo operacional desconhecido.' };
    }

    const playerResult = getCurrentUserPlayer();
    if (!playerResult || playerResult.success !== true || !playerResult.data) {
      return playerResult || { success: false, error: 'Jogador não encontrado.' };
    }

    const player = playerResult.data.player;
    const village = player.villageId
      ? lagoOptionalRead_('OperationsHub.village', function() {
          return VillageService.getVillageById(player.villageId);
        }, null)
      : null;
    const data = {
      module: moduleName,
      generatedAt: new Date().toISOString(),
      player: player,
      village: village,
      aquifer: lagoOptionalRead_('OperationsHub.aquifer', function() {
        return AquiferService.getCurrentStatus();
      }, null),
      climate: lagoOptionalRead_('OperationsHub.climate', function() {
        return ClimateService.getCurrentClimate();
      }, null)
    };

    if (moduleName === 'market' || moduleName === 'economic') {
      data.crops = lagoOptionalRead_('OperationsHub.crops', function() {
        return CropService.getAllCrops(true).map(function(crop) {
          const price = MarketService.getMarketPrice(crop.cropId);
          return Object.assign({}, crop, {
            marketPrice: price && price.success ? price.currentPrice : null,
            basePrice: price && price.success ? price.basePrice : null
          });
        });
      }, []);
      data.transactions = lagoOptionalRead_('OperationsHub.transactions', function() {
        return MarketService.getTransactionsByPlayer(player.playerId);
      }, []);
      data.economy = lagoOptionalRead_('OperationsHub.economy', function() {
        const result = EconomicService.getPlayerBalance(player.playerId);
        return result && result.success ? result.data : null;
      }, null);
    }

    if (moduleName === 'inventory') {
      data.plantings = lagoOptionalRead_('OperationsHub.plantings', function() {
        return CropService.getPlayerCrops(player.playerId);
      }, []);
      data.crops = lagoOptionalRead_('OperationsHub.inventoryCrops', function() {
        return CropService.getAllCrops(true);
      }, []);
    }

    if (moduleName === 'profile') {
      data.playerStats = lagoOptionalRead_('OperationsHub.playerStats', function() {
        return PlayerService.getPlayerStats(player.playerId);
      }, null);
      data.xp = lagoOptionalRead_('OperationsHub.xp', function() {
        const result = ExperienceService.getPlayerXPStatus(player.playerId);
        return result && result.success === false ? null : result;
      }, null);
      data.history = lagoOptionalRead_('OperationsHub.profileHistory', function() {
        return HistoryService.getPlayerHistory(player.playerId, 12);
      }, []);
    }

    if (['map', 'build', 'village-details'].indexOf(moduleName) >= 0) {
      data.villages = lagoOptionalRead_('OperationsHub.villages', function() {
        return VillageService.getAllVillages(true);
      }, []);
      data.decisions = lagoOptionalRead_('OperationsHub.decisions', function() {
        return TerritorialImpactService.getAvailableDecisions();
      }, []);
      data.villageStats = player.villageId
        ? lagoOptionalRead_('OperationsHub.villageStats', function() {
            return VillageService.getVillageStats(player.villageId);
          }, null)
        : null;
      data.shoreline = lagoOptionalRead_('OperationsHub.shoreline', function() {
        return OrlaLivreService.getShorelineStatus(player.villageId);
      }, null);
    }

    if (moduleName === 'research') {
      data.tutorial = lagoOptionalRead_('OperationsHub.tutorial', function() {
        return TutorialService.getTutorialSteps();
      }, []);
      data.decisions = lagoOptionalRead_('OperationsHub.researchDecisions', function() {
        return TerritorialImpactService.getAvailableDecisions();
      }, []);
      data.sustainableCrops = lagoOptionalRead_('OperationsHub.sustainableCrops', function() {
        return CropService.getSustainableCrops(6);
      }, []);
    }

    if (moduleName === 'reports') {
      data.history = lagoOptionalRead_('OperationsHub.reportHistory', function() {
        return HistoryService.getPlayerHistory(player.playerId, 20);
      }, []);
      data.events = lagoOptionalRead_('OperationsHub.reportEvents', function() {
        return HistoryService.getRecentEvents(12);
      }, []);
      data.hydrologicalReport = lagoOptionalRead_('OperationsHub.hydrologicalReport', function() {
        return ReportGenerator.generateHydrologicalReport(data.aquifer, data.climate);
      }, null);
    }

    if (moduleName === 'sustainability') {
      data.villages = lagoOptionalRead_('OperationsHub.sustainabilityVillages', function() {
        return VillageService.getAllVillages(true);
      }, []);
      const scores = (data.villages || []).map(function(item) {
        return Number(item.sustainabilityIndex) || 0;
      });
      data.basin = lagoOptionalRead_('OperationsHub.basin', function() {
        return SustainabilityService.calculateBasinIndex(
          data.aquifer && data.aquifer.depth,
          data.aquifer && data.aquifer.extraction,
          data.aquifer && data.aquifer.recharge,
          scores
        );
      }, null);
      data.alerts = lagoOptionalRead_('OperationsHub.alerts', function() {
        const score = data.basin && data.basin.score !== undefined
          ? data.basin.score
          : Number(player.sustainabilityScore) || 0;
        return SustainabilityService.getSustainabilityAlerts(score, data.aquifer && data.aquifer.depth);
      }, []);
    }

    if (moduleName === 'settings') {
      data.preferences = lagoOptionalRead_('OperationsHub.preferences', function() {
        return SettingsService.getAllUserSettings();
      }, {});
    }

    return lagoClientSafe_({ success: true, data: data });
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getOperationsHubData', error);
  }
}

/** Salva apenas preferências de interface explicitamente permitidas. */
function saveOperationalPreference(key, value) {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) return { success: false, error: 'Sessão expirada.' };
    const allowed = ['reducedMotion', 'highContrast', 'notifications'];
    key = String(key || '').trim();
    if (allowed.indexOf(key) === -1) {
      return { success: false, error: 'Preferência não permitida.' };
    }
    const normalized = String(value).toLowerCase() === 'true' ? 'true' : 'false';
    SettingsService.setUserSetting(key, normalized);
    return lagoClientSafe_({ success: true, data: { key: key, value: normalized } });
  } catch (error) {
    return lagoApiFailure_('ApiGateway.saveOperationalPreference', error);
  }
}

/** Salva o conjunto permitido de preferências em uma única operação. */
function saveOperationalPreferences(preferences) {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) return { success: false, error: 'Sessão expirada.' };
    if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
      return { success: false, error: 'Preferências inválidas.' };
    }
    const allowed = ['reducedMotion', 'highContrast', 'notifications'];
    const normalized = {};
    Object.keys(preferences).forEach(function(key) {
      if (allowed.indexOf(key) === -1) throw new Error('Preferência não permitida: ' + key);
      normalized[key] = String(preferences[key]).toLowerCase() === 'true' ? 'true' : 'false';
    });
    const saved = SettingsService.setUserSettings(normalized);
    return lagoClientSafe_({ success: true, data: { values: normalized, updated: saved.updated } });
  } catch (error) {
    return lagoApiFailure_('ApiGateway.saveOperationalPreferences', error);
  }
}

/** Lista notificações pertencentes ao jogador associado à sessão atual. */
function getCurrentPlayerNotifications(limit) {
  try {
    if (!SessionManager.getSessionUser()) return { success: false, error: 'Sessão expirada.' };
    const playerResult = getCurrentUserPlayer();
    if (!playerResult || playerResult.success === false || !playerResult.data) {
      return { success: false, error: 'Jogador não encontrado para a sessão.' };
    }
    const notifications = NotificationService.getAllNotifications(
      playerResult.data.playerId,
      positiveInteger_(limit, 'Limite', 100, 30)
    );
    return lagoClientSafe_({
      success: true,
      data: {
        notifications: notifications,
        unreadCount: notifications.filter(function(notification) { return !notification.read; }).length
      }
    });
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getCurrentPlayerNotifications', error);
  }
}

/** Marca uma notificação como lida somente após confirmar sua propriedade. */
function markCurrentPlayerNotificationRead(notificationId) {
  try {
    if (!SessionManager.getSessionUser()) return { success: false, error: 'Sessão expirada.' };
    const playerResult = getCurrentUserPlayer();
    if (!playerResult || playerResult.success === false || !playerResult.data) {
      return { success: false, error: 'Jogador não encontrado para a sessão.' };
    }
    notificationId = String(notificationId || '').trim();
    const owned = NotificationService.getAllNotifications(playerResult.data.playerId, 100)
      .some(function(notification) { return String(notification.notificationId) === notificationId; });
    if (!owned) return { success: false, error: 'Notificação não encontrada para este jogador.' };
    return lagoClientSafe_(NotificationService.markAsRead(notificationId));
  } catch (error) {
    return lagoApiFailure_('ApiGateway.markCurrentPlayerNotificationRead', error);
  }
}

/** Marca todas as notificações do jogador da sessão como lidas. */
function markAllCurrentPlayerNotificationsRead() {
  try {
    if (!SessionManager.getSessionUser()) return { success: false, error: 'Sessão expirada.' };
    const playerResult = getCurrentUserPlayer();
    if (!playerResult || playerResult.success === false || !playerResult.data) {
      return { success: false, error: 'Jogador não encontrado para a sessão.' };
    }
    return lagoClientSafe_(NotificationService.markAllAsRead(playerResult.data.playerId));
  } catch (error) {
    return lagoApiFailure_('ApiGateway.markAllCurrentPlayerNotificationsRead', error);
  }
}

/** Snapshot administrativo somente leitura, restrito ao papel de administrador. */
function getAdminDashboardData() {
  try {
    requireLagoAdmin_();
    return lagoClientSafe_({
      success: true,
      data: {
        status: AdminService.getSystemStatus(),
        readiness: typeof LagoProductionReadiness !== 'undefined'
          ? LagoProductionReadiness.inspect()
          : null,
        audit: lagoOptionalRead_('AdminDashboard.audit', function() {
          return AuditLog.getRecentEvents(20);
        }, []),
        users: lagoOptionalRead_('AdminDashboard.users', function() {
          return UserDAO.getAllUsers().map(function(account) {
            return {
              userId: account.userId,
              username: account.username,
              email: account.email,
              role: account.role,
              status: account.status,
              createdAt: account.createdAt,
              lastLogin: account.lastLogin
            };
          });
        }, []),
        villages: lagoOptionalRead_('AdminDashboard.villages', function() {
          return VillageService.getAllVillages(false);
        }, [])
      }
    });
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getAdminDashboardData', error);
  }
}

/**
 * Compra créditos para o jogador da sessão, sem aceitar um playerId do cliente.
 * O processamento financeiro continua centralizado em buyWater().
 *
 * @param {number} amount - Quantidade inteira de créditos
 * @returns {Object} Resultado da compra
 */
function buyWaterForCurrentPlayer(amount) {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada.' };
    }

    const player = PlayerService.getPlayerByUserId(user.userId);
    if (!player) {
      return { success: false, error: 'Jogador não encontrado.' };
    }

    return buyWater(player.playerId, amount);
  } catch (error) {
    return lagoApiFailure_('ApiGateway.buyWaterForCurrentPlayer', error);
  }
}

/**
 * Vende cultura no mercado
 * @param {string} playerId - ID do jogador
 * @param {string} cropId - ID da cultura
 * @param {number} quantity - Quantidade a vender
 * @returns {Object} { success, message, data }
 */
function sellCrop(playerId, cropId, quantity) {
  try {
    quantity = positiveInteger_(quantity, 'A quantidade de venda', 1000);
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada.' };
    }
    
    const player = PlayerService.getPlayerById(playerId);
    if (!player || player.userId !== user.userId) {
      return { success: false, error: 'Acesso negado.' };
    }
    
    // Buscar preço atual pelo serviço de mercado (a planilha de culturas não guarda preço).
    const crop = CropService.getCropById(cropId);
    if (!crop) {
      return { success: false, error: 'Cultura não encontrada.' };
    }

    const price = MarketService.getMarketPrice(cropId);
    if (!price.success) {
      return { success: false, error: price.error || 'Preço da cultura indisponível.' };
    }

    const revenue = price.currentPrice * quantity;
    
    // Atualizar alimento do jogador
    PlayerService.updateResources(playerId, 0, revenue);
    
    AuditLog.logEvent('CROP_SOLD', {
      playerId: playerId,
      cropId: cropId,
      quantity: quantity,
      revenue: revenue
    });
    
    return {
      success: true,
      message: `${quantity} unidades de ${crop.name} vendidas por ${revenue} alimentos.`,
      data: { revenue: revenue, unitPrice: price.currentPrice }
    };
    
  } catch (error) {
    return lagoApiFailure_('ApiGateway.sellCrop', error);
  }
}

/**
 * Jogador se junta a uma vila
 * @param {string} playerId - ID do jogador
 * @param {string} villageId - ID da vila
 * @returns {Object} { success, message }
 */
function joinVillage(playerId, villageId) {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada.' };
    }
    
    const player = PlayerService.getPlayerById(playerId);
    if (!player || player.userId !== user.userId) {
      return { success: false, error: 'Acesso negado.' };
    }
    
    // Adicionar jogador à vila
    const result = VillageService.addPlayerToVillage(villageId, playerId);
    
    if (result.success) {
      AuditLog.logEvent('PLAYER_JOINED_VILLAGE', {
        playerId: playerId,
        villageId: villageId
      });
      
      return {
        success: true,
        message: 'Você entrou na vila com sucesso!'
      };
    }
    
    return result;
    
  } catch (error) {
    return lagoApiFailure_('ApiGateway.joinVillage', error);
  }
}

/**
 * Retorna os dados necessários para a tela de gestão territorial.
 * A resposta é limitada à sessão atual e não expõe dados administrativos.
 * @returns {Object} { success, data: { player, villages } }
 */
function getVillageManagementData() {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada.' };
    }

    let player = PlayerService.getPlayerByUserId(user.userId);
    if (!player) {
      const createResult = PlayerService.createPlayer({
        userId: user.userId,
        playerName: user.username,
        villageId: null
      });
      if (!createResult.success) {
        return { success: false, error: 'Erro ao criar jogador: ' + createResult.error };
      }
      player = createResult.player;
    }

    const villages = VillageService.getAllVillages(true).map(function(village) {
      const stats = VillageService.getVillageStats(village.villageId);
      return Object.assign({}, village, {
        membersCount: stats && stats.population ? stats.population.active : village.population,
        totalWater: stats && stats.resources ? stats.resources.totalWater : village.waterAllocation,
        totalFood: stats && stats.resources ? stats.resources.totalFood : village.foodStock,
        shoreline: lagoOptionalRead_('VillageManagement.shoreline', function() {
          return OrlaLivreService.getShorelineStatus(village.villageId);
        }, { success: false, measured: false, status: 'INDISPONIVEL', erosionRisk: null })
      });
    });

    const decisions = HistoryService.getPlayerHistory(player.playerId, 30)
      .filter(function(record) { return record.action === 'decisao-territorial'; })
      .map(function(record) {
        return {
          id: record.historyId,
          villageId: record.villageId,
          title: record.outcome,
          optionId: record.metrics && record.metrics.optionId,
          note: record.metrics && record.metrics.note,
          createdAt: record.createdAt || record.timestamp || null,
          synced: true
        };
      });

    return lagoClientSafe_({
      success: true,
      data: {
        player: player,
        villages: villages,
        decisions: decisions,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getVillageManagementData', error);
  }
}

/**
 * Registra uma decisão territorial no histórico pedagógico da rodada.
 * A decisão não altera recursos automaticamente: primeiro deixa evidência
 * da escolha para que a turma possa observar seus efeitos depois.
 * @param {string} playerId - Jogador que registrou a decisão
 * @param {string} villageId - Vila observada
 * @param {Object} decision - { optionId, title, note }
 * @returns {Object} { success, data }
 */
function recordVillageDecision(playerId, villageId, decision) {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada.' };
    }

    const player = PlayerService.getPlayerById(playerId);
    if (!player || player.userId !== user.userId) {
      return { success: false, error: 'Acesso negado.' };
    }

    const village = VillageService.getVillageById(villageId);
    if (!village) {
      return { success: false, error: 'Vila não encontrada.' };
    }

    const options = {
      'protect-spring': 'Proteger áreas de nascente',
      'compact-growth': 'Compactar o crescimento urbano',
      'green-mobility': 'Investir em mobilidade verde',
      'expand-orla-livre': 'Expandir Orla Livre'
    };
    const optionId = String(decision && decision.optionId || '');
    if (!options[optionId]) {
      return { success: false, error: 'Decisão territorial inválida.' };
    }

    const round = typeof GameEngine !== 'undefined' && typeof GameEngine.getCurrentRound === 'function'
      ? Number(GameEngine.getCurrentRound()) || 0
      : 0;
    const note = String(decision && decision.note || '').trim().slice(0, 240);
    const historyResult = HistoryService.recordRound({
      round: round,
      playerId: playerId,
      villageId: villageId,
      action: 'decisao-territorial',
      outcome: options[optionId],
      metrics: {
        decisionType: 'territorial',
        optionId: optionId,
        note: note,
        villageName: village.name,
        sustainabilityIndex: village.sustainabilityIndex
      },
      event: {
        eventType: 'VILLAGE_DECISION',
        title: options[optionId],
        description: note || 'Decisão registrada no painel territorial.',
        impact: 'Aguardando observação dos efeitos na próxima rodada.'
      }
    });

    if (!historyResult.success) {
      return historyResult;
    }

    AuditLog.logEvent('VILLAGE_DECISION_RECORDED', {
      playerId: playerId,
      villageId: villageId,
      optionId: optionId
    });

    return lagoClientSafe_({
      success: true,
      message: 'Decisão registrada no histórico da vila.',
      data: {
        historyId: historyResult.record.historyId,
        optionId: optionId,
        villageId: villageId
      }
    });
  } catch (error) {
    return lagoApiFailure_('ApiGateway.recordVillageDecision', error);
  }
}

/**
 * Registra uma leitura de campo da orla para a vila do jogador.
 * A avaliação e a persistência ficam no OrlaLivreService para que o cliente
 * nunca envie score, risco ou bônus calculados por conta própria.
 */
function recordShorelineInspection(playerId, villageId, observation) {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) return { success: false, error: 'Sessão expirada.' };

    const player = PlayerService.getPlayerById(playerId);
    if (!player || player.userId !== user.userId) return { success: false, error: 'Acesso negado.' };
    if (String(player.villageId || '') !== String(villageId || '')) {
      return { success: false, error: 'A leitura só pode ser registrada na vila do jogador.' };
    }

    const round = typeof GameEngine !== 'undefined' && typeof GameEngine.getCurrentRound === 'function'
      ? Number(GameEngine.getCurrentRound()) || 0
      : 0;
    const result = OrlaLivreService.recordInspection(player.playerId, villageId, observation, round);
    if (!result || result.success !== true) return result || { success: false, error: 'Leitura não registrada.' };
    return lagoClientSafe_({
      success: true,
      message: 'Leitura da orla registrada no histórico da vila.',
      data: result
    });
  } catch (error) {
    return lagoApiFailure_('ApiGateway.recordShorelineInspection', error);
  }
}

/**
 * Busca dados do dashboard do jogador
 * @param {string} playerId - ID do jogador
 * @returns {Object} Dados do dashboard
 */
function getDashboardData(playerId) {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada.' };
    }
    
    const player = PlayerService.getPlayerById(playerId);
    if (!player || player.userId !== user.userId) {
      return { success: false, error: 'Acesso negado.' };
    }
    
    const village = player.villageId ? VillageService.getVillageById(player.villageId) : null;
    const aquifer = player.villageId ? AquiferService.getCurrentStatus(player.villageId) : null;
    const climate = ClimateService.getCurrentClimate();
    const recentEvents = HistoryService.getRecentEvents(5);
    const playerHistory = HistoryService.getPlayerHistory(playerId, 100);
    const pendingReview = HistoryService.getPendingReview(playerId);
    
    const initialMission = user.initialMission || SessionManager.getSessionData('initialMission') || null;
    return lagoClientSafe_({
      success: true,
      data: {
        player: player,
        village: village,
        aquifer: aquifer,
        climate: climate,
        events: recentEvents,
        investigation: {
          currentRound: playerHistory.reduce(function(max, record) { return Math.max(max, Number(record.round) || 0); }, 0),
          pendingReview: pendingReview,
          completedReviews: playerHistory.filter(function(record) {
            return record.metrics && record.metrics.learning && record.metrics.learning.status === 'reviewed';
          }).length
        },
        initialMission: initialMission
      }
    });
    
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getDashboardData', error);
  }
}

/**
 * Busca culturas disponíveis para plantio
 * @returns {Object} Lista de culturas
 */
function getAvailableCrops() {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada.' };
    }
    
    const crops = CropService.getAllCrops().map(function(crop) {
      const price = MarketService.getMarketPrice(crop.cropId);
      return Object.assign({}, crop, {
        marketPrice: price.success ? price.currentPrice : null,
        basePrice: price.success ? price.basePrice : null
      });
    });
    const climate = ClimateService.getCurrentClimate();
    
    return lagoClientSafe_({
      success: true,
      data: {
        crops: crops,
        climate: climate
      }
    });
    
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getAvailableCrops', error);
  }
}

/**
 * Busca rankings (jogadores e vilas)
 * @returns {Object} Rankings
 */
function getLeaderboards() {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada.' };
    }
    
    const topPlayers = LeaderboardService.getTopPlayers(10);
    const topVillages = LeaderboardService.getTopVillages(5);
    
    // Buscar rank do usuário
    const player = PlayerService.getPlayerByUserId(user.userId);
    const userRank = player ? LeaderboardService.getPlayerRank(player.playerId) : null;
    
    return lagoClientSafe_({
      success: true,
      data: {
        topPlayers: topPlayers,
        topVillages: topVillages,
        userRank: userRank
      }
    });
    
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getLeaderboards', error);
  }
}

/**
 * Eventos reais visíveis ao usuário autenticado.
 *
 * Aceita os dois contratos históricos do cliente:
 * - número ou { limit }: eventos recentes;
 * - { round, eventType, limit }: eventos filtrados.
 *
 * A identidade vem da sessão; nenhum playerId fornecido pelo navegador é
 * aceito.
 */
function getGameEvents(options) {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) return { success: false, error: 'Sessão expirada.' };

    var filters = options && typeof options === 'object' && !Array.isArray(options)
      ? options
      : null;
    var hasFilters = filters && (filters.round !== undefined || filters.eventType);
    var events;

    if (hasFilters) {
      events = HistoryService.getEventHistory({
        round: filters.round,
        eventType: filters.eventType
      });
      if (filters.limit !== undefined) {
        var filteredLimit = Number(filters.limit);
        if (Number.isFinite(filteredLimit) && filteredLimit > 0) {
          events = events.slice(0, Math.min(Math.floor(filteredLimit), 100));
        }
      }
    } else {
      var limit = filters && filters.limit !== undefined ? filters.limit : options;
      events = HistoryService.getRecentEvents(limit || 50);
    }

    return lagoClientSafe_({
      success: true,
      data: { events: events }
    });
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getGameEvents', error);
  }
}

/**
 * Histórico do jogador autenticado e estatísticas calculadas no servidor.
 */
function getGameHistory(limit) {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) return { success: false, error: 'Sessão expirada.' };
    const player = PlayerService.getPlayerByUserId(user.userId);
    if (!player) return { success: false, error: 'Jogador não encontrado para esta conta.' };

    const records = HistoryService.getPlayerHistory(player.playerId, limit || 100);
    const decisions = records.filter(function(record) {
      return String(record.action || '').trim() !== '';
    }).length;
    const crises = records.filter(function(record) {
      const metrics = record.metrics || {};
      return metrics.crisis === true || /crise|colapso|alerta/i.test(String(record.outcome || ''));
    }).length;

    return lagoClientSafe_({
      success: true,
      data: {
        records: records,
        stats: {
          totalRounds: records.reduce(function(max, record) {
            return Math.max(max, Number(record.round) || 0);
          }, 0),
          totalCrises: crises,
          totalDecisions: decisions,
          sustainabilityScore: Number(player.sustainabilityScore) || 0
        }
      }
    });
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getGameHistory', error);
  }
}

/**
 * Obtém dados do jogador do usuário atual
 * @returns {Object} { success, data: { playerId, player } }
 */
function getCurrentUserPlayer() {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada.' };
    }
    
    let player = PlayerService.getPlayerByUserId(user.userId);
    
    // Se usuário não tem jogador, criar automaticamente
    if (!player) {
      const createResult = PlayerService.createPlayer({
        userId: user.userId,
        playerName: user.username,
        villageId: null
      });
      
      if (createResult.success) {
        player = createResult.player;
      } else {
        return { success: false, error: 'Erro ao criar jogador: ' + createResult.error };
      }
    }
    
    const initialMission = user.initialMission || SessionManager.getSessionData('initialMission') || null;
    return lagoClientSafe_({
      success: true,
      data: {
        playerId: player.playerId,
        player: player,
        initialMission: initialMission
      }
    });
    
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getCurrentUserPlayer', error);
  }
}

/**
 * ============================================================================
 * NOVAS FUNÇÕES DE INTEGRAÇÃO - SISTEMAS AVANÇADOS
 * ============================================================================
 */

/**
 * Busca status de XP e progressão do jogador
 * @param {string} playerId - ID do jogador
 * @returns {Object} Status de XP
 */
function getPlayerXPStatus(playerId) {
  try {
    const player = requireOwnedPlayer_(playerId);
    
    if (typeof ExperienceService === 'undefined') {
      return { success: false, error: 'Sistema de XP não disponível' };
    }
    
    const xpStatus = ExperienceService.getPlayerXPStatus(playerId);
    
    return lagoClientSafe_(xpStatus);
    
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getPlayerXPStatus', error);
  }
}

/**
 * Busca ranking de jogadores por XP
 * @param {number} limit - Limite de jogadores
 * @returns {Object} Ranking
 */
function getXPLeaderboard(limit) {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada.' };
    }
    
    if (typeof ExperienceService === 'undefined') {
      return { success: false, error: 'Sistema de XP não disponível' };
    }
    
    const leaderboard = ExperienceService.getXPLeaderboard(limit || 10);
    
    return lagoClientSafe_({
      success: true,
      data: { leaderboard: leaderboard }
    });
    
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getXPLeaderboard', error);
  }
}

/**
 * Aplica decisão territorial a uma vila
 * @param {string} villageId - ID da vila
 * @param {string} decisionId - ID da decisão
 * @param {number} round - Rodada atual
 * @returns {Object} Resultado da aplicação
 */
function applyTerritorialDecision(villageId, decisionId, round) {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada.' };
    }
    
    // Verifica se usuário tem permissão (jogador da vila ou admin)
    const player = PlayerService.getPlayerByUserId(user.userId);
    if (!player) {
      return { success: false, error: 'Jogador não encontrado.' };
    }
    
    if (player.villageId !== villageId && user.role !== 'admin') {
      return { success: false, error: 'Acesso negado. Você não pertence a esta vila.' };
    }
    
    if (typeof TerritorialImpactService === 'undefined') {
      return { success: false, error: 'Sistema de decisões territoriais não disponível' };
    }
    
    const result = TerritorialImpactService.applyDecision(villageId, decisionId, round);
    
    return lagoClientSafe_(result);
    
  } catch (error) {
    return lagoApiFailure_('ApiGateway.applyTerritorialDecision', error);
  }
}

/**
 * Busca preview dos efeitos de uma decisão territorial
 * @param {string} decisionId - ID da decisão
 * @param {string} villageId - ID da vila (opcional)
 * @returns {Object} Preview dos efeitos
 */
function getTerritorialDecisionPreview(decisionId, villageId) {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada.' };
    }
    
    if (typeof TerritorialImpactService === 'undefined') {
      return { success: false, error: 'Sistema de decisões territoriais não disponível' };
    }
    
    const preview = TerritorialImpactService.getDecisionEffects(decisionId, villageId);
    
    return lagoClientSafe_(preview);
    
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getTerritorialDecisionPreview', error);
  }
}

/**
 * Lista todas decisões territoriais disponíveis
 * @returns {Object} Lista de decisões
 */
function getAvailableTerritorialDecisions() {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada.' };
    }
    
    if (typeof TerritorialImpactService === 'undefined') {
      return { success: false, error: 'Sistema de decisões territoriais não disponível' };
    }
    
    const decisions = TerritorialImpactService.getAvailableDecisions();
    
    return lagoClientSafe_({
      success: true,
      data: { decisions: decisions }
    });
    
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getAvailableTerritorialDecisions', error);
  }
}

/**
 * Busca histórico de preços de uma cultura
 * @param {string} cropId - ID da cultura
 * @param {number} limit - Limite de registros
 * @returns {Object} Histórico de preços
 */
function getCropPriceHistory(cropId, limit) {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada.' };
    }
    
    const history = MarketService.getPriceHistory(cropId, limit || 10);
    const statistics = MarketService.getPriceStatistics(cropId);
    
    return lagoClientSafe_({
      success: true,
      data: {
        history: history,
        statistics: statistics.success ? statistics.statistics : null
      }
    });
    
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getCropPriceHistory', error);
  }
}

/**
 * Busca status do aquífero com histórico
 * @param {number} limit - Limite de registros históricos
 * @returns {Object} Status e histórico do aquífero
 */
function getAquiferStatus(limit) {
  try {
    const user = SessionManager.getSessionUser();
    if (!user) {
      return { success: false, error: 'Sessão expirada.' };
    }
    
    const current = AquiferService.getCurrentStatus();
    const history = AquiferService.getHistory(limit || 12);
    
    return lagoClientSafe_({
      success: true,
      data: {
        current: current,
        history: history
      }
    });
    
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getAquiferStatus', error);
  }
}

/**
 * Processa fim de rodada (função administrativa)
 * Executa todos processamentos automáticos
 * @param {number} round - Número da rodada
 * @returns {Object} Resultado do processamento
 */
function processEndOfRound(round) {
  try {
    requireLagoAdmin_();
    
    if (typeof GameEngine === 'undefined' || !GameEngine.processEndOfRound) {
      return { success: false, error: 'GameEngine.processEndOfRound não disponível' };
    }
    
    const result = GameEngine.processEndOfRound(round);
    
    return lagoClientSafe_(result);
    
  } catch (error) {
    return lagoApiFailure_('ApiGateway.processEndOfRound', error);
  }
}

/**
 * Inicializa o jogo (função administrativa)
 * @returns {Object} Resultado da inicialização
 */
function initializeGame() {
  try {
    requireLagoAdmin_();
    
    if (typeof GameEngine === 'undefined' || !GameEngine.initializeGame) {
      return { success: false, error: 'GameEngine.initializeGame não disponível' };
    }
    
    const result = GameEngine.initializeGame();
    
    return lagoClientSafe_(result);
    
  } catch (error) {
    return lagoApiFailure_('ApiGateway.initializeGame', error);
  }
}

/**
 * Busca dados completos para dashboard expandido
 * Inclui todos os novos sistemas (XP, eventos, aquífero, preços)
 * @param {string} playerId - ID do jogador
 * @returns {Object} Dados completos
 */
function getEnhancedDashboardData(playerId) {
  try {
    const player = requireOwnedPlayer_(playerId);
    
    // Dados básicos
    const village = player.villageId ? VillageService.getVillageById(player.villageId) : null;
    const climate = ClimateService.getCurrentClimate();
    
    // Novos sistemas
    const xpStatus = typeof ExperienceService !== 'undefined' 
      ? ExperienceService.getPlayerXPStatus(playerId) 
      : null;
    
    const aquifer = AquiferService.getCurrentStatus();
    const aquiferHistory = AquiferService.getHistory(6);
    
    const recentEvents = HistoryService.getRecentEvents(10);
    
    const crops = CropService.getAllCrops().map(function(crop) {
      const price = MarketService.getMarketPrice(crop.cropId);
      const priceHistory = MarketService.getPriceHistory(crop.cropId, 5);
      return Object.assign({}, crop, {
        marketPrice: price.success ? price.currentPrice : null,
        basePrice: price.success ? price.basePrice : null,
        priceHistory: priceHistory.length > 0 ? priceHistory : null
      });
    });
    
    const territorialDecisions = typeof TerritorialImpactService !== 'undefined'
      ? TerritorialImpactService.getAvailableDecisions()
      : [];
    
    return lagoClientSafe_({
      success: true,
      data: {
        player: player,
        village: village,
        climate: climate,
        xp: xpStatus && xpStatus.success ? xpStatus : null,
        aquifer: {
          current: aquifer,
          history: aquiferHistory
        },
        events: recentEvents,
        crops: crops,
        territorialOptions: territorialDecisions
      }
    });
    
  } catch (error) {
    return lagoApiFailure_('ApiGateway.getEnhancedDashboardData', error);
  }
}
