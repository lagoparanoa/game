/**
 * @file ImportExport.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Exportação, backup e restauração com alinhamento de schema.
 *              Linhas importadas são sempre projetadas pela ordem dos cabeçalhos,
 *              evitando corrupção quando objetos JSON chegam com chaves reordenadas.
 */

function ImportExport() {
  Logger.log('Iniciando componente: ImportExport.gs');
}

ImportExport.MAX_ROWS_PER_IMPORT = 10000;
ImportExport.MAX_COLUMNS = 100;
ImportExport.BACKUP_VERSION = 2;

ImportExport.normalizeHeader_ = function(value) {
  return String(value === null || value === undefined ? '' : value).trim();
};

ImportExport.validateHeaders_ = function(headers) {
  if (!Array.isArray(headers) || !headers.length) throw new Error('O schema não possui cabeçalhos.');
  if (headers.length > ImportExport.MAX_COLUMNS) throw new Error('O schema excede o limite de colunas.');
  const normalized = headers.map(ImportExport.normalizeHeader_);
  const seen = {};
  normalized.forEach(function(header) {
    if (!header) throw new Error('Cabeçalho vazio não é permitido.');
    const key = header.toLowerCase();
    if (seen[key]) throw new Error('Cabeçalho duplicado: ' + header);
    seen[key] = true;
  });
  return normalized;
};

ImportExport.normalizeCell_ = function(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return JSON.stringify(value);
};

ImportExport.headersFromObjects_ = function(rows) {
  const headers = [];
  const seen = {};
  rows.forEach(function(item, index) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Registro inválido na posição ' + (index + 1) + '.');
    }
    Object.keys(item).forEach(function(header) {
      const normalized = ImportExport.normalizeHeader_(header);
      const key = normalized.toLowerCase();
      if (!seen[key]) {
        seen[key] = true;
        headers.push(normalized);
      }
    });
  });
  return ImportExport.validateHeaders_(headers);
};

ImportExport.projectRows_ = function(items, headers) {
  return items.map(function(item) {
    const valuesByHeader = {};
    Object.keys(item).forEach(function(key) {
      valuesByHeader[ImportExport.normalizeHeader_(key).toLowerCase()] = item[key];
    });
    return headers.map(function(header) {
      return ImportExport.normalizeCell_(valuesByHeader[header.toLowerCase()]);
    });
  });
};

ImportExport.exportSheetToJson = function(sheetName) {
  try {
    const sheet = Config.getSheet(sheetName);
    const values = sheet.getDataRange().getValues();
    if (!values.length) return [];
    const headers = ImportExport.validateHeaders_(values[0]);
    if (values.length === 1) return [];
    return values.slice(1).map(function(row) {
      const rowObject = {};
      headers.forEach(function(header, index) {
        rowObject[header] = row[index] === undefined ? '' : row[index];
      });
      return rowObject;
    });
  } catch (error) {
    ErrorHandler.logError('ImportExport.exportSheetToJson', error, { sheetName: sheetName });
    throw error;
  }
};

ImportExport.readExistingHeaders_ = function(sheet) {
  const lastRow = Number(sheet.getLastRow()) || 0;
  const lastColumn = Number(sheet.getLastColumn && sheet.getLastColumn()) || 0;
  if (!lastRow || !lastColumn) return [];
  return ImportExport.validateHeaders_(sheet.getRange(1, 1, 1, lastColumn).getValues()[0]);
};

ImportExport.sameSchema_ = function(left, right) {
  if (left.length !== right.length) return false;
  return left.every(function(header, index) {
    return header.toLowerCase() === right[index].toLowerCase();
  });
};

ImportExport.importJsonToSheet = function(sheetName, jsonData, overwrite) {
  let lock = null;
  try {
    if (!Array.isArray(jsonData)) throw new Error('Dados de importação devem ser um array JSON.');
    if (jsonData.length > ImportExport.MAX_ROWS_PER_IMPORT) throw new Error('A importação excede o limite de registros.');
    const sheet = Config.getSheet(sheetName);
    if (typeof LockService !== 'undefined' && LockService.getScriptLock) {
      lock = LockService.getScriptLock();
      lock.waitLock(30000);
    }
    if (!jsonData.length) {
      if (overwrite) sheet.clearContents();
      return { imported: 0, columns: 0, sheetName: sheetName, overwritten: Boolean(overwrite) };
    }

    const headers = ImportExport.headersFromObjects_(jsonData);
    const rows = ImportExport.projectRows_(jsonData, headers);

    const existingHeaders = ImportExport.readExistingHeaders_(sheet);
    if (!overwrite && existingHeaders.length && !ImportExport.sameSchema_(existingHeaders, headers)) {
      throw new Error('O schema importado não corresponde aos cabeçalhos existentes. Use sobrescrita somente após revisar o backup.');
    }

    if (overwrite) sheet.clearContents();
    if (overwrite || !existingHeaders.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    const startRow = overwrite || !existingHeaders.length ? 2 : sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);

    return {
      imported: rows.length,
      columns: headers.length,
      sheetName: sheetName,
      overwritten: Boolean(overwrite)
    };
  } catch (error) {
    ErrorHandler.logError('ImportExport.importJsonToSheet', error, { sheetName: sheetName });
    throw error;
  } finally {
    if (lock && lock.releaseLock) lock.releaseLock();
  }
};

ImportExport.backupSheet = function(sheetName) {
  const data = ImportExport.exportSheetToJson(sheetName);
  const headers = data.length ? Object.keys(data[0]) : [];
  return {
    version: ImportExport.BACKUP_VERSION,
    sheetName: sheetName,
    createdAt: new Date().toISOString(),
    schema: headers,
    rowCount: data.length,
    data: data
  };
};

ImportExport.validateBackup_ = function(backup) {
  if (!backup || !backup.sheetName || !Array.isArray(backup.data)) {
    throw new Error('Backup inválido para restauração.');
  }
  if (backup.version && Number(backup.version) > ImportExport.BACKUP_VERSION) {
    throw new Error('Versão de backup ainda não suportada.');
  }
  if (backup.rowCount !== undefined && Number(backup.rowCount) !== backup.data.length) {
    throw new Error('Contagem de registros do backup não confere.');
  }
  if (backup.schema && backup.data.length) {
    const declared = ImportExport.validateHeaders_(backup.schema);
    const actual = ImportExport.headersFromObjects_(backup.data);
    if (!ImportExport.sameSchema_(declared, actual)) throw new Error('Schema declarado no backup não confere com os dados.');
  }
  return true;
};

ImportExport.restoreBackup = function(backup, overwrite) {
  ImportExport.validateBackup_(backup);
  return ImportExport.importJsonToSheet(backup.sheetName, backup.data, overwrite !== false);
};
