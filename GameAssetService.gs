/**
 * GameAssetService: Contrato canônico entre a pasta do Drive, o backend e o cenário.
 * 
 * Responsabilidades:
 * - Validar integridade de assets obrigatórios e opcionais
 * - Resolver URLs públicas de acesso via Drive
 * - Detectar duplicatas, tipos MIME inválidos e ausências críticas
 * - Fornecer manifesto consolidado para consumo por AssetManager e frontend
 * 
 * @version 1.2.0
 * @since 2026-09-02
 */

var GAME_ASSET_PROJECT = 'lago_paranoa';
var GAME_ASSET_FILES = ['lago_paranoa_map.svg', 'lago_avatar.png'];
var GAME_ASSET_OPTIONAL_FILES = [];
var GAME_ASSET_CACHE_TTL_SECONDS = 300;

/**
 * Retorna manifesto completo de assets do projeto Lago Paranoá.
 * 
 * @returns {Object} Manifesto com assets, erros de validação e status consolidado
 * @example
 * var manifest = getGameAssetManifest();
 * if (!manifest.ok) Logger.log(manifest.error);
 */
function getGameAssetManifest() {
  var folder = GameAssetService_resolveFolder_();
  var cacheKey = GameAssetService_cacheKey_(folder.id, GAME_ASSET_FILES, GAME_ASSET_OPTIONAL_FILES);
  if (cacheKey && typeof CacheService !== 'undefined') {
    try {
      var cached = CacheService.getScriptCache().get(cacheKey);
      if (cached) {
        var parsed = JSON.parse(cached);
        parsed.cacheHit = true;
        return parsed;
      }
    } catch (ignore) {
      // Cache é otimização; o Drive continua sendo a fonte autoritativa.
    }
  }
  var manifest = GameAssetService_getManifest_(GAME_ASSET_FILES, GAME_ASSET_OPTIONAL_FILES, GAME_ASSET_PROJECT, folder);
  if (cacheKey && typeof CacheService !== 'undefined') {
    try {
      CacheService.getScriptCache().put(cacheKey, JSON.stringify(manifest), manifest.ok ? GAME_ASSET_CACHE_TTL_SECONDS : 30);
    } catch (ignore) {}
  }
  return manifest;
}

/**
 * Obtém URL pública de um asset específico do manifesto.
 * 
 * @param {string} fileName - Nome exato do arquivo (ex: 'lago_paranoa_map.svg')
 * @returns {string|null} URL pública do asset ou null se indisponível
 */
function getAssetUrl(fileName) {
  if (!fileName || typeof fileName !== 'string') return null;
  try {
    var manifest = getGameAssetManifest();
    return manifest.assets[fileName] || null;
  } catch (error) {
    ErrorHandler.logError('GameAssetService.getAssetUrl', error, { fileName: fileName });
    return null;
  }
}

/**
 * Valida disponibilidade de todos os assets obrigatórios.
 * 
 * @returns {Object} { valid: boolean, missing: string[], duplicates: string[], invalid: Object[] }
 */
function validateAssets() {
  try {
    var manifest = getGameAssetManifest();
    return {
      valid: manifest.ok,
      missing: manifest.missingRequiredFiles || [],
      duplicates: manifest.duplicateFiles || [],
      invalid: manifest.invalidFiles || [],
      configuredBy: manifest.configuredBy || '',
      error: manifest.error || null
    };
  } catch (error) {
    ErrorHandler.logError('GameAssetService.validateAssets', error);
    return { valid: false, error: error.message, missing: [], duplicates: [], invalid: [] };
  }
}

/** Espelho de webapp/assets no Drive: somente a Script Property FOLDER_ID. */
function GameAssetService_resolveFolder_() {
  var value = String(PropertiesService.getScriptProperties().getProperty('FOLDER_ID') || '').trim();
  return { id: value, configuredBy: value ? 'FOLDER_ID' : '' };
}

function GameAssetService_cacheKey_(folderId, requiredFiles, optionalFiles) {
  if (!folderId) return '';
  var signature = String(folderId) + '|' + (requiredFiles || []).join('|') + '|' + (optionalFiles || []).join('|');
  var hash = 0;
  for (var index = 0; index < signature.length; index++) {
    hash = ((hash << 5) - hash + signature.charCodeAt(index)) | 0;
  }
  return 'lago_asset_manifest_v2_' + Math.abs(hash);
}

function GameAssetService_expectedMime_(name) {
  if (/\.png$/i.test(name)) return 'image/png';
  if (/\.svg$/i.test(name)) return 'image/svg+xml';
  if (/\.jpe?g$/i.test(name)) return 'image/jpeg';
  return '';
}

function GameAssetService_getManifest_(requiredFiles, optionalFiles, project, resolvedFolder) {
  requiredFiles = requiredFiles || [];
  optionalFiles = optionalFiles || [];
  var expectedFiles = requiredFiles.concat(optionalFiles).filter(function(name, index, all) {
    return all.indexOf(name) === index;
  });
  var base = {
    project: project || '', folderProperty: 'FOLDER_ID', configuredBy: '',
    requiredFiles: requiredFiles, optionalFiles: optionalFiles, expectedFiles: expectedFiles,
    assets: {}, assetItems: [], missingRequiredFiles: requiredFiles.slice(),
    missingOptionalFiles: optionalFiles.slice(), ignoredFileCount: 0,
    invalidFiles: [], duplicateFiles: [], ok: false,
    fetchedAt: new Date().toISOString(), cacheHit: false
  };
  try {
    var folder = resolvedFolder || GameAssetService_resolveFolder_();
    base.configuredBy = folder.configuredBy;
    if (!folder.id) {
      base.error = 'Configure a Script Property FOLDER_ID com a pasta de imagens deste jogo.';
      return base;
    }
    var seen = {};
    var files = DriveApp.getFolderById(folder.id).getFiles();
    while (files.hasNext()) {
      var file = files.next();
      var name = file.getName();
      if (expectedFiles.indexOf(name) < 0) { base.ignoredFileCount += 1; continue; }
      if (seen[name]) {
        if (base.duplicateFiles.indexOf(name) < 0) base.duplicateFiles.push(name);
        delete base.assets[name];
        continue;
      }
      seen[name] = true;
      var mime = file.getMimeType();
      var expectedMime = GameAssetService_expectedMime_(name);
      var emptyFile = typeof file.getSize === 'function' && Number(file.getSize()) <= 0;
      if (!expectedMime || mime !== expectedMime || emptyFile) {
        base.invalidFiles.push({ name: name, mimeType: mime, reason: emptyFile ? 'EMPTY_FILE' : 'INVALID_MIME' });
        continue;
      }
      var url = 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(file.getId());
      base.assets[name] = url;
      base.assetItems.push({ name: name, url: url, mimeType: mime, required: requiredFiles.indexOf(name) >= 0 });
    }
    base.assetItems = expectedFiles.filter(function(name) { return Boolean(base.assets[name]); }).map(function(name) {
      return base.assetItems.filter(function(item) { return item.name === name; })[0];
    });
    base.missingRequiredFiles = requiredFiles.filter(function(name) { return !base.assets[name]; });
    base.missingOptionalFiles = optionalFiles.filter(function(name) { return !base.assets[name]; });
    base.ok = base.missingRequiredFiles.length === 0 && base.duplicateFiles.length === 0;
    if (!base.ok) base.error = 'Arquivos obrigatórios ausentes ou inválidos em FOLDER_ID: ' + base.missingRequiredFiles.join(', ');
    return base;
  } catch (error) {
    Logger.log('[GameAssetService] ' + error.message);
    // Uma leitura interrompida não deve apresentar um catálogo parcial como completo.
    base.assets = {};
    base.assetItems = [];
    base.error = 'Não foi possível ler a pasta configurada em FOLDER_ID.';
    return base;
  }
}
