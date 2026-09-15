/**
 * @file SettingsService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Preferências isoladas pelo usuário autenticado, sem compartilhar
 *              namespace com tokens e registros internos de sessão.
 */

function SettingsService() {
  Logger.log('Iniciando componente: SettingsService.gs');
}

SettingsService.USER_PREFIX = 'lago.preference.';
SettingsService.MAX_VALUE_LENGTH = 2000;
SettingsService.MAX_BULK_KEYS = 40;

SettingsService.validateKey = function(key) {
  const normalized = String(key === null || key === undefined ? '' : key).trim();
  if (!/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(normalized)) {
    throw new Error('Chave de configuração inválida.');
  }
  return normalized;
};

SettingsService.normalizeValue_ = function(value) {
  const normalized = String(value === null || value === undefined ? '' : value);
  if (normalized.length > SettingsService.MAX_VALUE_LENGTH) {
    throw new Error('Valor de configuração excede o limite permitido.');
  }
  return normalized;
};

SettingsService.getPrincipalId_ = function() {
  if (typeof SessionManager === 'undefined' || !SessionManager.getSessionUser) {
    throw new Error('Sessão autenticada indisponível para preferências.');
  }
  const user = SessionManager.getSessionUser();
  if (!user) throw new Error('Sessão expirada.');
  const principal = String(user.userId || user.id || user.username || '').trim();
  if (!principal) throw new Error('Sessão sem identificador de usuário.');
  return principal.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
};

SettingsService.getUserPrefix_ = function() {
  return SettingsService.USER_PREFIX + SettingsService.getPrincipalId_() + '.';
};

SettingsService.getUserPropertyKey_ = function(key) {
  return SettingsService.getUserPrefix_() + SettingsService.validateKey(key);
};

SettingsService.getUserSetting = function(key, defaultValue) {
  try {
    const propertyKey = SettingsService.getUserPropertyKey_(key);
    const value = PropertiesService.getUserProperties().getProperty(propertyKey);
    return value === null ? defaultValue : value;
  } catch (error) {
    ErrorHandler.logError('SettingsService.getUserSetting', error, { key: key });
    throw error;
  }
};

SettingsService.setUserSetting = function(key, value) {
  try {
    const propertyKey = SettingsService.getUserPropertyKey_(key);
    PropertiesService.getUserProperties().setProperty(propertyKey, SettingsService.normalizeValue_(value));
    return true;
  } catch (error) {
    ErrorHandler.logError('SettingsService.setUserSetting', error, { key: key });
    throw error;
  }
};

SettingsService.setUserSettings = function(settings) {
  try {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      throw new Error('As preferências devem formar um objeto.');
    }
    const keys = Object.keys(settings);
    if (keys.length > SettingsService.MAX_BULK_KEYS) throw new Error('Quantidade de preferências excede o limite.');
    const prefix = SettingsService.getUserPrefix_();
    const properties = {};
    keys.forEach(function(key) {
      properties[prefix + SettingsService.validateKey(key)] = SettingsService.normalizeValue_(settings[key]);
    });
    if (keys.length) PropertiesService.getUserProperties().setProperties(properties, false);
    return { success: true, updated: keys.length };
  } catch (error) {
    ErrorHandler.logError('SettingsService.setUserSettings', error);
    throw error;
  }
};

SettingsService.deleteUserSetting = function(key) {
  try {
    PropertiesService.getUserProperties().deleteProperty(SettingsService.getUserPropertyKey_(key));
    return true;
  } catch (error) {
    ErrorHandler.logError('SettingsService.deleteUserSetting', error, { key: key });
    throw error;
  }
};

SettingsService.getAllUserSettings = function() {
  try {
    const prefix = SettingsService.getUserPrefix_();
    const stored = PropertiesService.getUserProperties().getProperties();
    const settings = {};
    Object.keys(stored).forEach(function(propertyKey) {
      if (propertyKey.indexOf(prefix) !== 0) return;
      settings[propertyKey.slice(prefix.length)] = stored[propertyKey];
    });
    return settings;
  } catch (error) {
    ErrorHandler.logError('SettingsService.getAllUserSettings', error);
    throw error;
  }
};

/** Remove apenas preferências do usuário atual; tokens de sessão são preservados. */
SettingsService.clearUserSettings = function() {
  try {
    const prefix = SettingsService.getUserPrefix_();
    const properties = PropertiesService.getUserProperties();
    const stored = properties.getProperties();
    let removed = 0;
    Object.keys(stored).forEach(function(propertyKey) {
      if (propertyKey.indexOf(prefix) !== 0) return;
      properties.deleteProperty(propertyKey);
      removed += 1;
    });
    return { success: true, removed: removed };
  } catch (error) {
    ErrorHandler.logError('SettingsService.clearUserSettings', error);
    throw error;
  }
};

SettingsService.getSystemSetting = function(key, defaultValue) {
  try {
    const value = PropertiesService.getDocumentProperties().getProperty(SettingsService.validateKey(key));
    return value === null ? defaultValue : value;
  } catch (error) {
    ErrorHandler.logError('SettingsService.getSystemSetting', error, { key: key });
    throw error;
  }
};

SettingsService.setSystemSetting = function(key, value) {
  try {
    PropertiesService.getDocumentProperties().setProperty(
      SettingsService.validateKey(key),
      SettingsService.normalizeValue_(value)
    );
    return true;
  } catch (error) {
    ErrorHandler.logError('SettingsService.setSystemSetting', error, { key: key });
    throw error;
  }
};
