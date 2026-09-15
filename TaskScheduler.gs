/**
 * @file TaskScheduler.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Agendador de tarefas periódicas, manutenção de ciclos climáticos e limpeza de sessões.
 * @context Permite execução determinística de rotinas automatizadas no ecossistema Apps Script.
 */

function TaskScheduler() {
  Logger.log('Iniciando componente: TaskScheduler.gs');
}

/**
 * Executa manutenção periódica do ambiente de simulação
 * @returns {Object} Relatório de execução das rotinas
 */
TaskScheduler.runDailyMaintenance = function() {
  const summary = {
    startedAt: new Date().toISOString(),
    tasksExecuted: [],
    errors: []
  };

  try {
    // 1. Limpeza de sessões expiradas
    const cleanedSessions = TaskScheduler.cleanupExpiredSessions();
    summary.tasksExecuted.push({ name: 'cleanupExpiredSessions', result: cleanedSessions });

    // 2. Atualização de status do aquífero
    if (typeof AquiferService !== 'undefined' && AquiferService.getCurrentStatus) {
      const aquiferStatus = AquiferService.getCurrentStatus();
      summary.tasksExecuted.push({ name: 'aquiferStatusCheck', result: aquiferStatus.status || 'OK' });
    }

    summary.status = 'CONCLUIDO';
    return summary;
  } catch (error) {
    ErrorHandler.logError('TaskScheduler.runDailyMaintenance', error);
    summary.status = 'FALHA';
    summary.errors.push(error.message);
    return summary;
  }
};

/**
 * Remove sessões inativas ou expiradas
 * @returns {number} Quantidade de registros purgados
 */
TaskScheduler.cleanupExpiredSessions = function() {
  try {
    if (typeof SessionManager !== 'undefined' && SessionManager.purgeExpiredSessions) {
      return SessionManager.purgeExpiredSessions();
    }
    return 0;
  } catch (error) {
    ErrorHandler.logError('TaskScheduler.cleanupExpiredSessions', error);
    return 0;
  }
};

/**
 * Registra log de execução agendada
 * @param {string} taskName - Nome da rotina
 * @param {string} status - Status da execução
 * @param {Object} details - Detalhes adicionais
 */
TaskScheduler.logTaskExecution = function(taskName, status, details) {
  try {
    if (typeof AuditLog !== 'undefined' && AuditLog.logEvent) {
      AuditLog.logEvent('TASK_SCHEDULED', {
        source: 'System',
        task: taskName,
        status: status,
        details: details
      });
    }
  } catch (error) {
    Logger.log('TaskScheduler.logTaskExecution falhou: ' + error.message);
  }
};

// Histórico em memória (últimas 3 execuções)
TaskScheduler._executionHistory = [];

/**
 * Executa o relatório semanal consolidado: hidrológico + econômico
 * @returns {Object} Resumo com os dois relatórios e status da execução
 */
TaskScheduler.runWeeklyReport = function() {
  const started = new Date().toISOString();
  const result = { startedAt: started, reports: {}, errors: [], status: 'CONCLUIDO' };

  try {
    // Relatório hidrológico
    if (typeof ReportGenerator !== 'undefined' && ReportGenerator.generateHydrologicalReport) {
      const aquiferData = (typeof AquiferService !== 'undefined' && AquiferService.getCurrentStatus)
        ? AquiferService.getCurrentStatus() : {};
      const climateData = (typeof ClimateService !== 'undefined' && ClimateService.getCurrentClimate)
        ? ClimateService.getCurrentClimate() : {};
      result.reports.hydrological = ReportGenerator.generateHydrologicalReport(aquiferData, climateData);
    }

    // Relatório econômico
    if (typeof ReportGenerator !== 'undefined' && ReportGenerator.generateEconomicReport) {
      const transactions = (typeof MarketService !== 'undefined' && MarketService.getAllTransactions)
        ? MarketService.getAllTransactions() : [];
      result.reports.economic = ReportGenerator.generateEconomicReport(transactions, []);
    }
  } catch (error) {
    result.errors.push(error.message);
    result.status = 'PARCIAL';
    ErrorHandler.logError('TaskScheduler.runWeeklyReport', error);
  }

  result.finishedAt = new Date().toISOString();
  TaskScheduler._storeExecution_('runWeeklyReport', result.status, result);
  TaskScheduler.logTaskExecution('runWeeklyReport', result.status, { reportKeys: Object.keys(result.reports) });
  return result;
};

/**
 * Solicita atualização do estado climático ao ClimateService
 * @returns {Object} Status da atualização
 */
TaskScheduler.scheduleClimateUpdate = function() {
  try {
    if (typeof ClimateService === 'undefined' || !ClimateService.getCurrentClimate) {
      return { status: 'IGNORADO', reason: 'ClimateService indisponível' };
    }
    const climate = ClimateService.getCurrentClimate();
    TaskScheduler.logTaskExecution('scheduleClimateUpdate', 'CONCLUIDO', { climateStatus: climate && climate.status });
    return { status: 'CONCLUIDO', climateStatus: climate && climate.status };
  } catch (error) {
    ErrorHandler.logError('TaskScheduler.scheduleClimateUpdate', error);
    return { status: 'FALHA', error: error.message };
  }
};

/**
 * Verifica a disponibilidade das dependências críticas do sistema
 * @returns {Object} Diagnóstico de saúde com status por componente
 */
TaskScheduler.healthCheck = function() {
  var deps = [
    'SessionManager', 'AquiferService', 'ClimateService',
    'PlayerService', 'VillageService', 'ErrorHandler',
    'ReportGenerator', 'MarketService'
  ];
  var report = { checkedAt: new Date().toISOString(), components: {}, healthy: true };

  deps.forEach(function(dep) {
    var available = TaskScheduler._isDependencyAvailable_(dep);
    report.components[dep] = available ? 'OK' : 'AUSENTE';
    if (!available) report.healthy = false;
  });

  report.status = report.healthy ? 'SAUDAVEL' : 'DEGRADADO';
  TaskScheduler.logTaskExecution('healthCheck', report.status, report.components);
  return report;
};

/** @private Resolve somente as dependências declaradas pelo diagnóstico. */
TaskScheduler._isDependencyAvailable_ = function(dep) {
  switch (dep) {
    case 'SessionManager': return typeof SessionManager !== 'undefined';
    case 'AquiferService': return typeof AquiferService !== 'undefined';
    case 'ClimateService': return typeof ClimateService !== 'undefined';
    case 'PlayerService': return typeof PlayerService !== 'undefined';
    case 'VillageService': return typeof VillageService !== 'undefined';
    case 'ErrorHandler': return typeof ErrorHandler !== 'undefined';
    case 'ReportGenerator': return typeof ReportGenerator !== 'undefined';
    case 'MarketService': return typeof MarketService !== 'undefined';
    default: return false;
  }
};

/**
 * Retorna histórico das últimas execuções registradas em memória
 * @returns {Array<Object>} Até 3 registros de execução
 */
TaskScheduler.getLastExecutionSummary = function() {
  return TaskScheduler._executionHistory.slice(-3);
};

/** @private Armazena registro de execução (máx 10) */
TaskScheduler._storeExecution_ = function(taskName, status, data) {
  TaskScheduler._executionHistory.push({
    task: taskName,
    status: status,
    recordedAt: new Date().toISOString(),
    summary: data
  });
  if (TaskScheduler._executionHistory.length > 10) {
    TaskScheduler._executionHistory.shift();
  }
};
