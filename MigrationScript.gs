/**
 * @file MigrationScript.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Migração não destrutiva do schema das planilhas do jogo.
 *
 * A migração cria abas ausentes e acrescenta cabeçalhos novos ao final das
 * abas existentes. Colunas e dados já presentes nunca são removidos ou
 * reordenados. O modo padrão é dry-run para que a equipe possa revisar o
 * plano antes de autorizar qualquer escrita.
 */

function MigrationScript() {}

MigrationScript.CURRENT_VERSION = '1.2.0';
MigrationScript.VERSION_PROPERTY = 'LAGO_PARANOA_SCHEMA_VERSION';
MigrationScript.LOCK_TIMEOUT_MS = 30000;

/**
 * Lê a versão aplicada sem exigir PropertiesService em testes locais.
 * @returns {string}
 */
MigrationScript.getAppliedVersion = function() {
  if (typeof PropertiesService === 'undefined') return '';
  return PropertiesService.getScriptProperties()
    .getProperty(MigrationScript.VERSION_PROPERTY) || '';
};

/**
 * Produz um plano serializável, sem alterar a planilha.
 * @param {Object=} spreadsheet planilha injetável para testes
 * @returns {Object} resultado padronizado com o plano por aba
 */
MigrationScript.inspect = function(spreadsheet) {
  try {
    var ss = spreadsheet || Config.getSpreadsheet();
    var schemas = SchemaService.SCHEMA || {};
    var plan = [];
    var changesRequired = 0;

    Object.keys(schemas).sort().forEach(function(sheetName) {
      var expected = (schemas[sheetName].headers || []).slice();
      var sheet = ss.getSheetByName(sheetName);
      var current = [];

      if (sheet && sheet.getLastColumn() > 0) {
        current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
          .map(function(header) { return String(header || '').trim(); });
      }

      var missing = expected.filter(function(header) {
        return current.indexOf(header) === -1;
      });
      var create = !sheet;
      if (create || missing.length) changesRequired++;

      plan.push({
        sheetName: sheetName,
        create: create,
        currentHeaders: current,
        missingHeaders: missing
      });
    });

    return {
      success: true,
      data: {
        targetVersion: MigrationScript.CURRENT_VERSION,
        appliedVersion: MigrationScript.getAppliedVersion(),
        changesRequired: changesRequired,
        plan: plan
      }
    };
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined') {
      ErrorHandler.logError('MigrationScript.inspect', error);
    }
    return { success: false, error: 'Não foi possível inspecionar o schema: ' + error.message };
  }
};

/**
 * Aplica o plano sob lock. Por segurança, somente dryRun:false permite escrita.
 * @param {Object=} options {dryRun?: boolean, spreadsheet?: Object}
 * @returns {Object} resumo de abas criadas e colunas acrescentadas
 */
MigrationScript.migrate = function(options) {
  options = options || {};
  var dryRun = options.dryRun !== false;
  var ss = options.spreadsheet || null;
  var initial = MigrationScript.inspect(ss);
  if (!initial.success || dryRun) {
    if (initial.success) initial.data.dryRun = true;
    return initial;
  }

  var lock = null;
  var lockAcquired = false;
  try {
    if (typeof LockService !== 'undefined') {
      lock = LockService.getScriptLock();
      lockAcquired = lock.tryLock(MigrationScript.LOCK_TIMEOUT_MS);
      if (!lockAcquired) {
        throw new Error('Outra migração está em andamento. Tente novamente em instantes.');
      }
    }

    ss = ss || Config.getSpreadsheet();
    var refreshed = MigrationScript.inspect(ss);
    if (!refreshed.success) return refreshed;

    var created = [];
    var columnsAdded = [];
    refreshed.data.plan.forEach(function(item) {
      var sheet = ss.getSheetByName(item.sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(item.sheetName);
        created.push(item.sheetName);
      }

      if (item.missingHeaders.length) {
        var startColumn = Math.max(1, sheet.getLastColumn() + 1);
        var range = sheet.getRange(1, startColumn, 1, item.missingHeaders.length);
        range.setValues([item.missingHeaders]);
        range.setFontWeight('bold');
        columnsAdded.push({ sheetName: item.sheetName, headers: item.missingHeaders.slice() });
      }
    });

    if (typeof PropertiesService !== 'undefined') {
      PropertiesService.getScriptProperties().setProperty(
        MigrationScript.VERSION_PROPERTY,
        MigrationScript.CURRENT_VERSION
      );
    }
    if (typeof AuditLog !== 'undefined' && AuditLog.logEvent) {
      AuditLog.logEvent('SCHEMA_MIGRATION', {
        version: MigrationScript.CURRENT_VERSION,
        sheetsCreated: created.length,
        columnsAdded: columnsAdded.reduce(function(total, item) {
          return total + item.headers.length;
        }, 0)
      });
    }

    return {
      success: true,
      data: {
        dryRun: false,
        version: MigrationScript.CURRENT_VERSION,
        sheetsCreated: created,
        columnsAdded: columnsAdded,
        changesApplied: created.length + columnsAdded.length
      }
    };
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined') {
      ErrorHandler.logError('MigrationScript.migrate', error);
    }
    return { success: false, error: 'Migração não concluída: ' + error.message };
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
};

/** Função global segura para revisar o plano no editor Apps Script. */
function planLagoParanoaMigration() {
  return MigrationScript.migrate({ dryRun: true });
}

/** Função global explícita para aplicar a migração revisada. */
function migrateLagoParanoaSchema() {
  return MigrationScript.migrate({ dryRun: false });
}
