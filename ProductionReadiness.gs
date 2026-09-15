/**
 * Diagnóstico somente leitura para separar três estados:
 * código local, smoke técnico e piloto com estudantes.
 *
 * Não cria abas, não executa seeds, não lê linhas de estudantes e não grava
 * propriedades. Execute runLagoProductionReadinessCheck() pelo proprietário no
 * editor do Apps Script e preserve o JSON do resultado como evidência do gate.
 */
var LagoProductionReadiness = (function() {
  var ATTESTATION_MAX_AGE_DAYS = 365;
  var PILOT_FLAGS = [
    {
      property: 'LAGO_ADMIN_CREDENTIAL_ROTATED',
      atProperty: 'LAGO_ADMIN_CREDENTIAL_ROTATED_AT',
      byProperty: 'LAGO_ADMIN_CREDENTIAL_ROTATED_BY',
      evidenceProperty: 'LAGO_ADMIN_CREDENTIAL_ROTATED_EVIDENCE',
      name: 'credencial administrativa rotacionada',
      detail: 'Defina como true somente depois de remover a credencial demonstrativa do ambiente de piloto.'
    },
    {
      property: 'LAGO_MODEL_REVIEWED',
      atProperty: 'LAGO_MODEL_REVIEWED_AT',
      byProperty: 'LAGO_MODEL_REVIEWED_BY',
      evidenceProperty: 'LAGO_MODEL_REVIEWED_EVIDENCE',
      name: 'modelo didático revisado',
      detail: 'Defina como true após revisão docente das fontes, unidades, hipóteses e limites do modelo.'
    },
    {
      property: 'LAGO_PILOT_PROTOCOL_APPROVED',
      atProperty: 'LAGO_PILOT_PROTOCOL_APPROVED_AT',
      byProperty: 'LAGO_PILOT_PROTOCOL_APPROVED_BY',
      evidenceProperty: 'LAGO_PILOT_PROTOCOL_APPROVED_EVIDENCE',
      name: 'protocolo do piloto aprovado',
      detail: 'Defina como true após aprovar consentimento, minimização de dados, mediação e critérios de interrupção.'
    }
  ];

  function addCheck(report, stage, name, ok, detail) {
    report.checks.push({ stage: stage, name: name, ok: Boolean(ok), detail: detail });
  }

  function normalizedHeaders(sheet) {
    var width = sheet.getLastColumn();
    if (!width) return [];
    return sheet.getRange(1, 1, 1, width).getValues()[0].map(function(value) {
      return String(value || '').trim();
    });
  }

  function checkSchema(report, spreadsheet) {
    Object.keys(SchemaService.SCHEMA).forEach(function(sheetName) {
      var expected = SchemaService.SCHEMA[sheetName].headers || [];
      var sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) {
        addCheck(report, 'technical_smoke', sheetName, false, 'Aba ausente; execute primeiro a migração aditiva em homologação.');
        return;
      }
      var headers = normalizedHeaders(sheet);
      var missing = expected.filter(function(header) { return headers.indexOf(header) === -1; });
      var normalized = headers.map(function(header) { return header.toLowerCase(); });
      var duplicate = normalized.some(function(header, index) {
        return header && normalized.indexOf(header) !== index;
      });
      addCheck(
        report,
        'technical_smoke',
        sheetName + ': schema',
        missing.length === 0 && !duplicate,
        missing.length ? 'Faltam: ' + missing.join(', ') : duplicate ? 'Há cabeçalhos duplicados.' : 'Cabeçalhos canônicos presentes.'
      );
    });
  }

  function checkMinimumState(report, spreadsheet) {
    var requiredRows = {
      Usuarios: 'ao menos uma conta de teste controlada',
      Culturas: 'ao menos uma cultura ativa',
      Vilas: 'ao menos uma vila de teste',
      Clima: 'estado climático inicial',
      Aquifero: 'estado hídrico inicial'
    };
    Object.keys(requiredRows).forEach(function(sheetName) {
      var sheet = spreadsheet.getSheetByName(sheetName);
      var ok = Boolean(sheet && sheet.getLastRow() > 1);
      addCheck(report, 'technical_smoke', sheetName + ': estado mínimo', ok, ok ? 'Há registros; o conteúdo não foi inspecionado.' : 'É necessário ' + requiredRows[sheetName] + '.');
    });
  }

  function checkPublishedRuntime(report) {
    var url = '';
    try {
      if (typeof ScriptApp !== 'undefined' && ScriptApp.getService) {
        url = String(ScriptApp.getService().getUrl() || '').trim();
      }
    } catch (ignore) {}
    var valid = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/(?:exec|dev)(?:[?#].*)?$/.test(url);
    addCheck(
      report,
      'technical_smoke',
      'URL do Web App disponível',
      valid,
      valid ? 'Há uma URL de execução para o smoke autenticado.' : 'Publique uma implantação de teste antes do smoke no navegador.'
    );
  }

  function checkAssets(report) {
    try {
      if (typeof getGameAssetManifest !== 'function') throw new Error('Serviço de assets indisponível.');
      var manifest = getGameAssetManifest();
      addCheck(
        report,
        'technical_smoke',
        'assets obrigatórios do cenário',
        Boolean(manifest && manifest.ok),
        manifest && manifest.ok
          ? String((manifest.assetItems || []).length) + ' assets obrigatórios resolvidos pelo Drive.'
          : 'Corrija FOLDER_ID, duplicatas, arquivos vazios ou MIME incompatível.'
      );
    } catch (error) {
      addCheck(report, 'technical_smoke', 'assets obrigatórios do cenário', false, 'Não foi possível validar os assets do Drive.');
    }
  }

  function checkPilotAttestation(report, properties, flag) {
    var approved = String(properties.getProperty(flag.property) || '').toLowerCase() === 'true';
    var responsible = String(properties.getProperty(flag.byProperty) || '').trim();
    var evidence = String(properties.getProperty(flag.evidenceProperty) || '').trim();
    var rawDate = String(properties.getProperty(flag.atProperty) || '').trim();
    var timestamp = rawDate ? new Date(rawDate) : null;
    var validDate = Boolean(timestamp && !isNaN(timestamp.getTime()));
    var ageDays = validDate ? (Date.now() - timestamp.getTime()) / 86400000 : Infinity;
    var current = validDate && ageDays >= -1 && ageDays <= ATTESTATION_MAX_AGE_DAYS;
    var responsibleValid = responsible.length >= 3 && responsible.length <= 120;
    var evidenceValid = evidence.length >= 8 && evidence.length <= 300 && !/placeholder|exemplo|pendente/i.test(evidence);
    var ok = approved && current && responsibleValid && evidenceValid;
    var detail = flag.detail;
    if (approved && !responsibleValid) detail = 'Informe responsável em ' + flag.byProperty + '.';
    else if (approved && !current) detail = 'Informe data ISO recente em ' + flag.atProperty + '.';
    else if (approved && !evidenceValid) detail = 'Informe referência de evidência verificável em ' + flag.evidenceProperty + '.';
    else if (ok) detail = 'Atestado com responsável, data recente e referência de evidência.';
    addCheck(report, 'pilot', flag.name, ok, detail);
  }

  function checkSystemServices(report) {
    try {
      if (typeof AuditLog !== 'undefined' || typeof SheetManager !== 'undefined' || typeof ValidationService !== 'undefined') {
        var servicesAvailable = (typeof AuditLog !== 'undefined') && (typeof SheetManager !== 'undefined') && (typeof ValidationService !== 'undefined');
        addCheck(
          report,
          'technical_smoke',
          'serviços centrais do sistema',
          servicesAvailable,
          servicesAvailable ? 'Serviços AuditLog, SheetManager e ValidationService disponíveis.' : 'Verifique se todos os scripts de serviço estão carregados no projeto.'
        );
      }
    } catch (e) {
      // Diagnóstico não-bloqueante
    }
  }

  function inspect() {
    var report = {
      generatedAt: new Date().toISOString(),
      project: 'Lago Paranoá',
      readyForTechnicalSmoke: false,
      readyForPilot: false,
      checks: [],
      limitations: [
        'O diagnóstico não homologa a URL publicada, identidade de execução, permissões ou isolamento entre contas.',
        'Contagens e cabeçalhos não comprovam correção científica, usabilidade, acessibilidade nem aprendizagem.',
        'O smoke no navegador deve usar contas fictícias e uma planilha exclusiva de homologação.',
        'Flags de piloto só são aceitas com responsável, data recente e referência de evidência; o gate não lê o conteúdo do artefato.'
      ]
    };

    try {
      var properties = PropertiesService.getScriptProperties();
      var spreadsheetId = String(properties.getProperty('SPREADSHEET_ID') || properties.getProperty('SPREADSHEETS_ID') || '').trim();
      addCheck(report, 'technical_smoke', 'planilha configurada por ambiente', Boolean(spreadsheetId), 'Use Script Properties; não versione o ID no código.');
      if (spreadsheetId) {
        var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        addCheck(report, 'technical_smoke', 'planilha acessível', true, 'Leitura autorizada para o executor do diagnóstico.');
        checkSchema(report, spreadsheet);
        checkMinimumState(report, spreadsheet);
      }

      checkPublishedRuntime(report);
      checkAssets(report);
      checkSystemServices(report);

      PILOT_FLAGS.forEach(function(flag) {
        checkPilotAttestation(report, properties, flag);
      });
    } catch (error) {
      addCheck(report, 'technical_smoke', 'leitura da configuração', false, 'Não foi possível ler; confira ID e permissões no editor. Detalhes privados foram omitidos.');
    }

    var technical = report.checks.filter(function(item) { return item.stage === 'technical_smoke'; });
    var pilot = report.checks.filter(function(item) { return item.stage === 'pilot'; });
    report.readyForTechnicalSmoke = technical.length > 0 && technical.every(function(item) { return item.ok; });
    report.readyForPilot = report.readyForTechnicalSmoke && pilot.length > 0 && pilot.every(function(item) { return item.ok; });
    report.blockers = report.checks.filter(function(item) { return !item.ok; }).map(function(item) {
      return { stage: item.stage, name: item.name, detail: item.detail };
    });
    return report;
  }

  return { inspect: inspect };
})();

function runLagoProductionReadinessCheck() {
  var report = LagoProductionReadiness.inspect();
  Logger.log(JSON.stringify(report));
  return report;
}

/**
 * Construtor/Namespace principal para diagnóstico de prontidão de produção.
 */
function ProductionReadiness() {
  Logger.log('Iniciando componente: ProductionReadiness.gs');
}

ProductionReadiness.inspect = function() {
  return LagoProductionReadiness.inspect();
};

ProductionReadiness.runCheck = function() {
  return runLagoProductionReadinessCheck();
};

/**
 * Retorna o relatório de prontidão como TextOutput em JSON para consumo HTTP autorizado.
 * @returns {Object} ContentService TextOutput com o relatório
 */
function getLagoProductionStatus() {
  var report = LagoProductionReadiness.inspect();
  if (typeof ContentService !== 'undefined' && ContentService.createTextOutput) {
    return ContentService.createTextOutput(JSON.stringify(report)).setMimeType(ContentService.MimeType.JSON);
  }
  return report;
}
