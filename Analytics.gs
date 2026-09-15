/**
 * @file Analytics.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Processamento estatístico de longo prazo sobre o uso da água na bacia.
 * @context Integração da lógica técnica robusta (V1) com a narrativa do DF (V2).
 *          Todo o CRUD é processado na planilha via SPREADSHEETS_ID.
 *
 * @principais_funcionalidades
 * - Cálculos estatísticos sobre consumo de água
 * - Resumos de dados em planilhas específicas
 * - Tendências de uso a partir de colunas numéricas
 * - Tratamento seguro de erros com ErrorHandler
 */

function Analytics() {
  Logger.log("Iniciando componente: Analytics.gs");
}

/**
 * Registra um evento de navegação sem tornar o carregamento dependente
 * de uma aba ou de outro serviço de persistência.
 *
 * O rastreamento é deliberadamente best-effort: métricas não podem impedir
 * que o Web App seja renderizado quando a planilha ainda está sendo criada
 * ou está temporariamente indisponível.
 */
Analytics.trackEvent = function(category, action, label, value) {
  const event = {
    category: String(category || 'unknown'),
    action: String(action || 'unknown'),
    label: label === undefined || label === null ? '' : String(label),
    value: value === undefined ? null : value,
    timestamp: new Date().toISOString()
  };

  try {
    Logger.log('📊 ANALYTICS: ' + JSON.stringify(event));
  } catch (error) {
    // O evento não deve interromper a inicialização da aplicação.
    Logger.log('⚠️ Falha ao registrar métrica: ' + error.message);
  }

  return { success: true, event: event };
};

Analytics.getSheetSummary = function(sheetName) {
  try {
    const sheet = Config.getSheet(sheetName);
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || [];
    const rows = Math.max(values.length - 1, 0);
    const numericColumns = headers.map((header, index) => {
      const columnValues = values.slice(1).map(row => Number(row[index]));
      const numeric = columnValues.filter(v => !isNaN(v));
      return {
        header: header,
        total: numeric.reduce((sum, v) => sum + v, 0),
        average: numeric.length ? numeric.reduce((sum, v) => sum + v, 0) / numeric.length : 0
      };
    });

    return {
      sheetName: sheetName,
      headers: headers,
      rows: rows,
      numericColumns: numericColumns
    };
  } catch (error) {
    ErrorHandler.logError('Analytics.getSheetSummary', error, { sheetName });
    throw error;
  }
};

Analytics.calculateColumnTotal = function(sheetName, columnName) {
  try {
    const sheet = Config.getSheet(sheetName);
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || [];
    const columnIndex = headers.indexOf(columnName);

    if (columnIndex < 0) {
      throw new Error('Coluna não encontrada: ' + columnName);
    }

    const total = values.slice(1).reduce((sum, row) => {
      const value = Number(row[columnIndex]);
      return sum + (isFinite(value) ? value : 0);
    }, 0);

    return {
      sheetName: sheetName,
      columnName: columnName,
      total: total
    };
  } catch (error) {
    ErrorHandler.logError('Analytics.calculateColumnTotal', error, { sheetName, columnName });
    throw error;
  }
};

Analytics.calculateTrend = function(sheetName, labelColumnName, valueColumnName) {
  try {
    const sheet = Config.getSheet(sheetName);
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || [];
    const labelIndex = headers.indexOf(labelColumnName);
    const valueIndex = headers.indexOf(valueColumnName);

    if (labelIndex < 0 || valueIndex < 0) {
      throw new Error('Coluna não encontrada: ' + labelColumnName + ' ou ' + valueColumnName);
    }

    const trend = values.slice(1).map(row => ({
      label: row[labelIndex],
      value: Number(row[valueIndex])
    })).filter(item => !isNaN(item.value));

    return {
      sheetName: sheetName,
      labelColumn: labelColumnName,
      valueColumn: valueColumnName,
      trend: trend
    };
  } catch (error) {
    ErrorHandler.logError('Analytics.calculateTrend', error, { sheetName, labelColumnName, valueColumnName });
    throw error;
  }
};
