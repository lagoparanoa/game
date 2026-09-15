/**
 * @file NotificationService.gs
 * @description Feedback contextual do jogo. Notificações são persistidas para
 *              que o estudante possa retomar a investigação sem perder o que
 *              mudou entre uma rodada e outra.
 */

function NotificationService() {
  Logger.log('Iniciando componente: NotificationService.gs');
}

NotificationService.TYPES = {
  CRITICAL: { priority: 4, icon: '🔴' },
  WARNING: { priority: 3, icon: '🟠' },
  INFO: { priority: 2, icon: '🟡' },
  SUCCESS: { priority: 1, icon: '🟢' },
  NARRATIVE: { priority: 1, icon: '🔵' }
};

NotificationService.id_ = function() {
  if (typeof Utilities !== 'undefined' && Utilities.getUuid) return 'NTF-' + Utilities.getUuid();
  return 'NTF-' + new Date().getTime() + '-' + Math.floor(Math.random() * 10000);
};

NotificationService.mapRow_ = function(headers, row) {
  const record = {};
  headers.forEach(function(header, index) {
    record[String(header || '').trim().toLowerCase()] = row[index];
  });
  return {
    notificationId: record.notificationid || '',
    playerId: record.playerid || '',
    villageId: record.villageid || '',
    type: String(record.type || 'INFO').toUpperCase(),
    priority: Number(record.priority) || 1,
    title: record.title || 'Atualização do jogo',
    message: record.message || '',
    read: record.read === true || String(record.read).toLowerCase() === 'true',
    createdAt: record.createdat || null
  };
};

NotificationService.sendNotification = function(playerId, message, type, priority) {
  try {
    const options = message && typeof message === 'object' ? message : {
      message: message,
      type: type,
      priority: priority
    };
    const normalizedType = String(options.type || 'INFO').toUpperCase();
    const meta = NotificationService.TYPES[normalizedType] || NotificationService.TYPES.INFO;
    if (!playerId || !options.message) throw new Error('playerId e message são obrigatórios');
    const notification = {
      notificationId: options.notificationId || NotificationService.id_(),
      playerId: String(playerId),
      villageId: String(options.villageId || ''),
      type: normalizedType,
      priority: Number(options.priority) || meta.priority,
      title: String(options.title || 'Atualização do jogo'),
      message: String(options.message),
      read: false,
      createdAt: options.createdAt || new Date()
    };
    const sheet = Config.getSheet(Config.SHEETS.NOTIFICATIONS);
    sheet.appendRow([
      notification.notificationId, notification.playerId, notification.villageId,
      notification.type, notification.priority, notification.title,
      notification.message, notification.read, notification.createdAt
    ]);
    return { success: true, notification: notification };
  } catch (error) {
    ErrorHandler.logError('NotificationService.sendNotification', error, { playerId: playerId });
    return { success: false, error: error.message };
  }
};

NotificationService.getAllNotifications = function(playerId, limit) {
  try {
    const sheet = Config.getSheet(Config.SHEETS.NOTIFICATIONS);
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];
    const size = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return values.slice(1).reverse().map(function(row) {
      return NotificationService.mapRow_(values[0], row);
    }).filter(function(notification) {
      return notification.playerId === String(playerId || '');
    }).slice(0, size);
  } catch (error) {
    ErrorHandler.logError('NotificationService.getAllNotifications', error, { playerId: playerId });
    return [];
  }
};

NotificationService.getUnreadNotifications = function(playerId) {
  return NotificationService.getAllNotifications(playerId, 100).filter(function(notification) {
    return !notification.read;
  });
};

NotificationService.markAsRead = function(notificationId) {
  try {
    const sheet = Config.getSheet(Config.SHEETS.NOTIFICATIONS);
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return { success: false, error: 'Notificação não encontrada' };
    const headers = values[0].map(function(header) { return String(header).toLowerCase(); });
    const idColumn = headers.indexOf('notificationid');
    const readColumn = headers.indexOf('read');
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idColumn]) === String(notificationId)) {
        sheet.getRange(i + 1, readColumn + 1).setValue(true);
        return { success: true, notificationId: notificationId };
      }
    }
    return { success: false, error: 'Notificação não encontrada' };
  } catch (error) {
    ErrorHandler.logError('NotificationService.markAsRead', error, { notificationId: notificationId });
    return { success: false, error: error.message };
  }
};

NotificationService.markAllAsRead = function(playerId) {
  const notifications = NotificationService.getAllNotifications(playerId, 100);
  let updated = 0;
  notifications.forEach(function(notification) {
    if (!notification.read && NotificationService.markAsRead(notification.notificationId).success) updated++;
  });
  return { success: true, updated: updated };
};

NotificationService.sendVillageNotification = function(villageId, message, type, options) {
  try {
    const players = typeof PlayerService !== 'undefined' && PlayerService.getPlayersByVillage
      ? PlayerService.getPlayersByVillage(villageId) : [];
    const sent = players.map(function(player) {
      return NotificationService.sendNotification(player.playerId, Object.assign({}, options || {}, {
        message: message,
        type: type || 'INFO',
        villageId: villageId
      }));
    }).filter(function(result) { return result.success; });
    return { success: true, sent: sent.length };
  } catch (error) {
    ErrorHandler.logError('NotificationService.sendVillageNotification', error, { villageId: villageId });
    return { success: false, error: error.message, sent: 0 };
  }
};

NotificationService.generateAquiferAlert = function(villageId, depth) {
  const critical = Number(depth) <= Number(Config.AQUIFER.CRITICAL_THRESHOLD);
  const type = critical ? 'CRITICAL' : 'WARNING';
  const title = critical ? 'Aquífero em nível crítico' : 'Atenção ao nível do aquífero';
  const message = critical
    ? 'A água compartilhada chegou a um nível crítico. Reduza a extração e compare uma alternativa sustentável.'
    : 'O nível do aquífero exige observação. Registre uma hipótese antes da próxima decisão.';
  return NotificationService.sendVillageNotification(villageId, message, type, { title: title });
};
