/**
 * @file AssetManager.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Gerencia o carregamento de recursos externos e integração de scripts/estilos.
 * @context Integração da lógica técnica robusta (V1) com a narrativa do DF (V2).
 *          Simplifica o uso de templates e assets na camada de apresentação.
 * 
 * @principais_funcionalidades
 * - Carregar templates HTML do Apps Script
 * - Renderizar templates com dados dinâmicos
 * - Embutir estilos e scripts em páginas HTML
 */

function AssetManager() {
  Logger.log("Iniciando componente: AssetManager.gs");
}

AssetManager.CACHE_TTL_SECONDS = 600;
AssetManager.MAX_CACHEABLE_LENGTH = 100000;

AssetManager.validateTemplateName_ = function(filename) {
  const normalized = String(filename || '').trim();
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(normalized)) {
    throw new Error('Nome de template inválido.');
  }
  return normalized;
};

AssetManager.cacheKey_ = function(filename) {
  return 'lago_asset_include_v2_' + filename;
};

AssetManager.include = function(filename) {
  try {
    const safeFilename = AssetManager.validateTemplateName_(filename);
    const cacheKey = AssetManager.cacheKey_(safeFilename);
    if (typeof CacheService !== 'undefined') {
      try {
        const cached = CacheService.getScriptCache().get(cacheKey);
        if (cached) return cached;
      } catch (e) {
        // Cache opcional
      }
    }
    const content = HtmlService.createHtmlOutputFromFile(safeFilename).getContent();
    if (content && typeof CacheService !== 'undefined') {
      try {
        // Armazena no cache por 10 minutos se for menor que 100KB
        if (content.length < AssetManager.MAX_CACHEABLE_LENGTH) {
          CacheService.getScriptCache().put(cacheKey, content, AssetManager.CACHE_TTL_SECONDS);
        }
      } catch (e) {}
    }
    return content;
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('AssetManager.include', error, { filename: filename });
    }
    return '';
  }
};

AssetManager.renderTemplate = function(templateName, data) {
  try {
    const safeTemplateName = AssetManager.validateTemplateName_(templateName);
    const template = HtmlService.createTemplateFromFile(safeTemplateName);
    template.data = data || {};
    return template.evaluate().getContent();
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('AssetManager.renderTemplate', error, { templateName: String(templateName || '') });
    }
    return HtmlService.createHtmlOutput('Não foi possível renderizar este conteúdo.').getContent();
  }
};

AssetManager.getStyles = function(filename) {
  const css = AssetManager.include(filename);
  return '<style>' + css.replace(/<\/style/gi, '<\\/style') + '</style>';
};

AssetManager.getScript = function(filename) {
  const script = AssetManager.include(filename);
  return '<script>' + script.replace(/<\/script/gi, '<\\/script') + '</script>';
};

AssetManager.getAssetUrl = function(assetFilename) {
  try {
    const safeFilename = String(assetFilename || '').trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/.test(safeFilename)) return null;
    if (typeof getGameAssetManifest === 'function') {
      const manifest = getGameAssetManifest();
      if (manifest && manifest.assets && manifest.assets[safeFilename]) {
        return manifest.assets[safeFilename];
      }
    }
    return null;
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('AssetManager.getAssetUrl', error, { assetFilename });
    }
    return null;
  }
};

AssetManager.clearIncludeCache = function(filename) {
  try {
    const safeFilename = AssetManager.validateTemplateName_(filename);
    if (typeof CacheService !== 'undefined') {
      const cache = CacheService.getScriptCache();
      if (cache.remove) cache.remove(AssetManager.cacheKey_(safeFilename));
    }
    return true;
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('AssetManager.clearIncludeCache', error, { filename: String(filename || '') });
    }
    return false;
  }
};

/**
 * Pré-carrega uma lista de templates no cache da aplicação.
 * @param {Array<string>} filenames - Lista de nomes de arquivos HTML
 * @returns {Object} Resumo da operação de cache
 */
AssetManager.preloadTemplates = function(filenames) {
  var loaded = 0;
  var errors = 0;
  if (!Array.isArray(filenames)) return { loaded: 0, errors: 0 };

  for (var i = 0; i < filenames.length; i++) {
    var fn = filenames[i];
    try {
      var content = AssetManager.include(fn);
      if (content) {
        loaded++;
      } else {
        errors++;
      }
    } catch (e) {
      errors++;
    }
  }

  return { loaded: loaded, errors: errors, total: filenames.length };
};

/**
 * Obtém o identificador da pasta de assets configurado via Script Properties.
 * @returns {string|null} ID da pasta no Drive
 */
AssetManager.getFolderId = function() {
  try {
    if (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties) {
      var props = PropertiesService.getScriptProperties();
      return props.getProperty('FOLDER_ID') || null;
    }
    return null;
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('AssetManager.getFolderId', error);
    }
    return null;
  }
};

/**
 * Registra verificação de assets no serviço de auditoria.
 * @param {string} filename
 * @param {boolean} found
 */
AssetManager.auditAssetAccess = function(filename, found) {
  try {
    if (typeof AuditLog !== 'undefined' && AuditLog.logEvent) {
      AuditLog.logEvent('ASSET_ACCESS', { filename: filename, found: Boolean(found) });
    }
  } catch (e) {
    // Não-bloqueante
  }
};

/**
 * Retorna status dos assets gerenciados em JSON para verificação externa.
 * @returns {Object} ContentService TextOutput
 */
function getAssetManagerStatus() {
  var folderId = AssetManager.getFolderId();
  var manifest = typeof getGameAssetManifest === 'function' ? getGameAssetManifest() : null;
  var status = { folderConfigured: Boolean(folderId), manifestReady: Boolean(manifest && manifest.ok) };
  if (typeof ContentService !== 'undefined' && ContentService.createTextOutput) {
    return ContentService.createTextOutput(JSON.stringify(status)).setMimeType(ContentService.MimeType.JSON);
  }
  return status;
}
