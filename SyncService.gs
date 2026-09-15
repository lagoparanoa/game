/**
 * @file SyncService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Serviço de sincronização e reconciliação de estado entre frontend e planilha backend.
 * @context Garante consistência de dados, prevenção de concorrência e reconciliação determinística.
 */

function SyncService() {
  Logger.log('Iniciando componente: SyncService.gs');
}

SyncService.MAX_INCREMENTAL_AGE_MS = 30 * 60 * 1000;
SyncService.NUMERIC_FIELDS = ['waterCredits', 'foodUnits', 'sustainabilityScore'];

SyncService.normalizeTimestamp_ = function(value) {
  if (!value) return null;
  var timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime()) ? timestamp : null;
};

SyncService.incrementalStatus_ = function(lastSyncTimestamp, now) {
  var supplied = String(lastSyncTimestamp || '').trim() !== '';
  var previous = SyncService.normalizeTimestamp_(lastSyncTimestamp);
  if (supplied && !previous) {
    return { requiresFullReload: true, reason: 'invalid-client-timestamp', ageMs: null };
  }
  if (!previous) {
    return { requiresFullReload: false, reason: 'first-sync', ageMs: null };
  }
  var ageMs = Math.max(0, now.getTime() - previous.getTime());
  return {
    requiresFullReload: ageMs > SyncService.MAX_INCREMENTAL_AGE_MS,
    reason: ageMs > SyncService.MAX_INCREMENTAL_AGE_MS ? 'stale-client-state' : 'incremental-sync',
    ageMs: ageMs
  };
};

/**
 * Obtém o estado atualizado do jogo para um jogador
 * @param {string} playerId - Identificador do jogador
 * @param {string} [lastSyncTimestamp] - Timestamp da última sincronização do cliente
 * @returns {Object} Pacote de dados para sincronização
 */
SyncService.getGameState = function(playerId, lastSyncTimestamp) {
  try {
    var normalizedPlayerId = String(playerId || '').trim();
    if (!normalizedPlayerId) {
      return { success: false, error: 'playerId é obrigatório.' };
    }

    var warnings = [];
    let player = null;
    if (typeof PlayerDAO !== 'undefined' && PlayerDAO.getPlayerById) {
      player = PlayerDAO.getPlayerById(normalizedPlayerId);
      if (!player) warnings.push('Jogador não localizado no estado autoritativo.');
    } else {
      warnings.push('Dados do jogador indisponíveis nesta sincronização.');
    }

    let climate = null;
    if (typeof ClimateService !== 'undefined' && ClimateService.getCurrentClimate) {
      climate = ClimateService.getCurrentClimate();
    } else {
      warnings.push('Dados climáticos indisponíveis nesta sincronização.');
    }

    let aquifer = null;
    if (typeof AquiferService !== 'undefined' && AquiferService.getCurrentStatus) {
      aquifer = AquiferService.getCurrentStatus();
    } else {
      warnings.push('Dados do aquífero indisponíveis nesta sincronização.');
    }

    var now = new Date();
    var incremental = SyncService.incrementalStatus_(lastSyncTimestamp, now);

    return {
      success: true,
      syncTimestamp: now.toISOString(),
      requiresFullReload: incremental.requiresFullReload,
      syncReason: incremental.reason,
      ageMs: incremental.ageMs,
      warnings: warnings,
      state: {
        player: player,
        climate: climate,
        aquifer: aquifer
      }
    };
  } catch (error) {
    ErrorHandler.logError('SyncService.getGameState', error, { playerId: playerId });
    return { success: false, error: 'Falha ao sincronizar estado do jogo.' };
  }
};

/**
 * Valida a integridade do estado do cliente contra o backend
 * @param {string} playerId - Identificador do jogador
 * @param {number} clientCredits - Saldo de água alegado pelo cliente
 * @returns {boolean} True se estiver em conformidade
 */
SyncService.validateWaterBalance = function(playerId, clientCredits) {
  try {
    var normalizedPlayerId = String(playerId || '').trim();
    var claimedCredits = Number(clientCredits);
    if (!normalizedPlayerId || !Number.isFinite(claimedCredits) || claimedCredits < 0) return false;
    if (typeof PlayerDAO !== 'undefined' && PlayerDAO.getPlayerById) {
      const player = PlayerDAO.getPlayerById(normalizedPlayerId);
      if (!player) return false;
      return Math.abs(Number(player.waterCredits || 0) - claimedCredits) < 0.01;
    }
    return false;
  } catch (error) {
    ErrorHandler.logError('SyncService.validateWaterBalance', error);
    return false;
  }
};

/**
 * Compara os campos que alteram decisões sem aceitar o estado do navegador
 * como fonte de verdade. O cliente recebe conflitos legíveis e o snapshot
 * autoritativo para decidir entre atualizar a tela ou refazer a ação.
 */
SyncService.reconcileClientState = function(playerId, clientState, lastSyncTimestamp) {
  var snapshot = SyncService.getGameState(playerId, lastSyncTimestamp);
  if (!snapshot.success) return snapshot;

  var client = clientState && typeof clientState === 'object' ? clientState : {};
  var authoritative = snapshot.state.player || {};
  var conflicts = [];
  for (var index = 0; index < SyncService.NUMERIC_FIELDS.length; index += 1) {
    var field = SyncService.NUMERIC_FIELDS[index];
    var serverValue = Number(authoritative[field]);
    var clientValue = Number(client[field]);
    if (!Number.isFinite(serverValue) || !Number.isFinite(clientValue)) continue;
    if (Math.abs(serverValue - clientValue) >= 0.01) {
      conflicts.push({ field: field, clientValue: clientValue, serverValue: serverValue });
    }
  }

  return {
    success: true,
    inSync: conflicts.length === 0 && !snapshot.requiresFullReload,
    conflicts: conflicts,
    snapshot: snapshot,
    recommendation: conflicts.length
      ? 'Atualize a tela com o estado do servidor antes da próxima decisão.'
      : snapshot.requiresFullReload
        ? 'Recarregue o estado completo antes de continuar.'
        : 'O estado local está atualizado.'
  };
};
