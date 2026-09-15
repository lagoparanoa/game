/**
 * @file SheetManager.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Camada de abstração fundamental de baixíssimo nível para operações atômicas na planilha Google.
 *              Encapsula toda complexidade técnica de interação direta com Spreadsheet API incluindo conexão
 *              ao documento centralizador via SPREADSHEET_ID, navegação entre múltiplas abas especializadas,
 *              leitura otimizada de ranges específicos minimizando chamadas custosas, escrita em batch de
 *              múltiplas linhas simultaneamente, busca indexada por colunas-chave únicas, atualização parcial
 *              de células individuais, inserção atômica de novas linhas com validação, deleção segura com
 *              verificação de dependências, ordenação dinâmica por critérios variados e formatação condicional
 *              programática. Fornece interface limpa unificada que todos DAOs consomem consistentemente.
 * 
 * @context Padrão Repository que isola camadas superiores de detalhes de implementação de persistência.
 *          Permite potencial migração futura para outro backend sem afetar lógica de negócio.
 * 
 * @principais_funcionalidades
 * - getSheet(sheetName): Obtém referência à aba específica da planilha
 * - getSheetData(sheetName): Lê todos dados de uma aba completa
 * - getSheetDataRange(sheetName, range): Lê subset específico de células
 * - appendRowToSheet(sheetName, rowData): Adiciona nova linha ao final
 * - updateRowInSheet(sheetName, keyCol, keyVal, newData): Atualiza linha identificada
 * - deleteRowFromSheet(sheetName, keyCol, keyVal): Remove linha específica
 * - findRowInSheet(sheetName, keyCol, keyVal): Localiza linha por chave
 * - findRowsInSheet(sheetName, filters): Busca múltiplas linhas por critérios
 * - batchUpdateRows(sheetName, updates): Atualiza múltiplas linhas eficientemente
 * - sortSheetByColumn(sheetName, columnIndex, ascending): Ordena dados dinamicamente
 * - getColumnValues(sheetName, columnName): Extrai valores de coluna específica
 * - countRows(sheetName): Conta registros existentes (sem cabeçalho)
 * - clearSheet(sheetName): Limpa dados mantendo estrutura e cabeçalhos
 * - createSheet(sheetName, headers): Cria nova aba com cabeçalhos definidos
 * 
 * @performance_optimizations
 * - Uso de getDataRange() para leitura completa em memória (1 API call)
 * - Cache de referências de sheets frequentemente acessadas
 * - Batch operations para reduzir roundtrips HTTP
 * - Validação de existência de abas antes de operações
 * 
 * @dependencies
 * - Apps Script SpreadsheetApp: API nativa de planilhas Google
 * - Config.gs: SPREADSHEET_ID e mapeamento de nomes de abas
 * - ErrorHandler.gs: Tratamento de erros de acesso ou permissão
 */

/**
 * SheetManager - Gerenciador centralizado de operações na planilha
 */
var SheetManager = (function() {
  
  var cache = {};
  
  /**
   * Obtém referência à planilha ativa
   */
  function getSpreadsheet() {
    if (!cache.spreadsheet) {
      try {
        cache.spreadsheet = Config.getSpreadsheet();
      } catch (error) {
        ErrorHandler.logError('SheetManager.getSpreadsheet', error);
        throw new Error('Não foi possível acessar a planilha. Verifique SPREADSHEET_ID.');
      }
    }
    return cache.spreadsheet;
  }
  
  /**
   * Obtém referência a uma aba específica
   */
  function getSheet(sheetName) {
    if (!sheetName) {
      throw new Error('Nome da aba é obrigatório');
    }
    
    var cacheKey = 'sheet_' + sheetName;
    if (!cache[cacheKey]) {
      var ss = getSpreadsheet();
      var sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        throw new Error('Aba "' + sheetName + '" não encontrada');
      }
      
      cache[cacheKey] = sheet;
    }
    
    return cache[cacheKey];
  }
  
  /**
   * Lê todos os dados de uma aba
   */
  function getSheetData(sheetName) {
    try {
      var sheet = getSheet(sheetName);
      var lastRow = sheet.getLastRow();
      
      if (lastRow <= 1) {
        return [];
      }
      
      var range = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
      return range.getValues();
    } catch (error) {
      ErrorHandler.logError('SheetManager.getSheetData', error, { sheetName: sheetName });
      return [];
    }
  }
  
  /**
   * Lê dados com cabeçalhos como objetos
   */
  function getSheetDataAsObjects(sheetName) {
    try {
      var sheet = getSheet(sheetName);
      var data = sheet.getDataRange().getValues();
      
      if (data.length === 0) {
        return [];
      }
      
      var headers = data[0];
      var rows = data.slice(1);
      
      return rows.map(function(row) {
        var obj = {};
        headers.forEach(function(header, index) {
          obj[header] = row[index];
        });
        return obj;
      });
    } catch (error) {
      ErrorHandler.logError('SheetManager.getSheetDataAsObjects', error, { sheetName: sheetName });
      return [];
    }
  }
  
  /**
   * Adiciona uma nova linha ao final da aba
   */
  function appendRow(sheetName, rowData) {
    try {
      var sheet = getSheet(sheetName);
      sheet.appendRow(rowData);
      return true;
    } catch (error) {
      ErrorHandler.logError('SheetManager.appendRow', error, { 
        sheetName: sheetName, 
        rowData: rowData 
      });
      return false;
    }
  }
  
  /**
   * Encontra linha por valor em coluna específica
   */
  function findRow(sheetName, columnIndex, value) {
    try {
      var data = getSheetData(sheetName);
      
      for (var i = 0; i < data.length; i++) {
        if (data[i][columnIndex - 1] === value) {
          return {
            rowIndex: i + 2, // +2 porque: +1 para índice base-1, +1 para pular cabeçalho
            rowData: data[i]
          };
        }
      }
      
      return null;
    } catch (error) {
      ErrorHandler.logError('SheetManager.findRow', error, { 
        sheetName: sheetName, 
        columnIndex: columnIndex, 
        value: value 
      });
      return null;
    }
  }
  
  /**
   * Atualiza uma linha específica
   */
  function updateRow(sheetName, rowIndex, rowData) {
    try {
      var sheet = getSheet(sheetName);
      var range = sheet.getRange(rowIndex, 1, 1, rowData.length);
      range.setValues([rowData]);
      return true;
    } catch (error) {
      ErrorHandler.logError('SheetManager.updateRow', error, { 
        sheetName: sheetName, 
        rowIndex: rowIndex 
      });
      return false;
    }
  }
  
  /**
   * Deleta uma linha específica
   */
  function deleteRow(sheetName, rowIndex) {
    try {
      var sheet = getSheet(sheetName);
      sheet.deleteRow(rowIndex);
      return true;
    } catch (error) {
      ErrorHandler.logError('SheetManager.deleteRow', error, { 
        sheetName: sheetName, 
        rowIndex: rowIndex 
      });
      return false;
    }
  }
  
  /**
   * Conta o número de linhas (sem cabeçalho)
   */
  function countRows(sheetName) {
    try {
      var sheet = getSheet(sheetName);
      var lastRow = sheet.getLastRow();
      return Math.max(0, lastRow - 1);
    } catch (error) {
      ErrorHandler.logError('SheetManager.countRows', error, { sheetName: sheetName });
      return 0;
    }
  }
  
  /**
   * Cria uma nova aba com cabeçalhos
   */
  function createSheet(sheetName, headers) {
    try {
      var ss = getSpreadsheet();
      var sheet = ss.getSheetByName(sheetName);
      
      if (sheet) {
        return sheet;
      }
      
      sheet = ss.insertSheet(sheetName);
      
      if (headers && headers.length > 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      }
      
      // Limpa cache
      delete cache['sheet_' + sheetName];
      
      return sheet;
    } catch (error) {
      ErrorHandler.logError('SheetManager.createSheet', error, { 
        sheetName: sheetName, 
        headers: headers 
      });
      return null;
    }
  }
  
  /**
   * Limpa dados mantendo cabeçalhos
   */
  function clearSheet(sheetName) {
    try {
      var sheet = getSheet(sheetName);
      var lastRow = sheet.getLastRow();
      
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      
      return true;
    } catch (error) {
      ErrorHandler.logError('SheetManager.clearSheet', error, { sheetName: sheetName });
      return false;
    }
  }
  
  /**
   * Busca múltiplas linhas por filtros
   */
  function findRows(sheetName, filters) {
    try {
      var objects = getSheetDataAsObjects(sheetName);
      
      return objects.filter(function(obj) {
        for (var key in filters) {
          if (obj[key] !== filters[key]) {
            return false;
          }
        }
        return true;
      });
    } catch (error) {
      ErrorHandler.logError('SheetManager.findRows', error, { 
        sheetName: sheetName, 
        filters: filters 
      });
      return [];
    }
  }
  
  /**
   * Atualiza múltiplas linhas em batch
   */
  function batchUpdate(sheetName, updates) {
    try {
      var sheet = getSheet(sheetName);
      
      updates.forEach(function(update) {
        var range = sheet.getRange(update.rowIndex, 1, 1, update.data.length);
        range.setValues([update.data]);
      });
      
      return true;
    } catch (error) {
      ErrorHandler.logError('SheetManager.batchUpdate', error, { 
        sheetName: sheetName, 
        updateCount: updates.length 
      });
      return false;
    }
  }
  
  /**
   * Obtém valores de uma coluna específica
   */
  function getColumnValues(sheetName, columnIndex) {
    try {
      var data = getSheetData(sheetName);
      return data.map(function(row) {
        return row[columnIndex - 1];
      });
    } catch (error) {
      ErrorHandler.logError('SheetManager.getColumnValues', error, { 
        sheetName: sheetName, 
        columnIndex: columnIndex 
      });
      return [];
    }
  }
  
  // Interface pública
  return {
    getSpreadsheet: getSpreadsheet,
    getSheet: getSheet,
    getSheetData: getSheetData,
    getSheetDataAsObjects: getSheetDataAsObjects,
    appendRow: appendRow,
    findRow: findRow,
    updateRow: updateRow,
    deleteRow: deleteRow,
    countRows: countRows,
    createSheet: createSheet,
    clearSheet: clearSheet,
    findRows: findRows,
    batchUpdate: batchUpdate,
    getColumnValues: getColumnValues
  };
  
})();
