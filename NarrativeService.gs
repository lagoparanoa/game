/**
 * @file NarrativeService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Converte dados técnicos em narrativas imersivas, notícias do DF e reflexões formativas.
 * @context Integração da lógica técnica robusta (V1) com a narrativa contextualizada do DF (V2).
 */

function NarrativeService() {
  Logger.log('Iniciando componente: NarrativeService.gs');
}

/**
 * Regras únicas para transformar o resultado numérico em evidência exibível.
 * Os limites impedem que valores inválidos ou extremos cheguem à narrativa.
 */
NarrativeService.METRIC_RULES = [
  { key: 'waterUsed', min: 0, max: 100000, decimals: 2 },
  { key: 'yieldUnits', min: 0, max: 100000, decimals: 2 },
  { key: 'profit', min: -1000000, max: 1000000, decimals: 2 },
  { key: 'sustainabilityDelta', min: -100, max: 100, decimals: 1 }
];

NarrativeService.normalizeNumber_ = function(value, minimum, maximum, decimals) {
  var number = Number(value);
  if (!Number.isFinite(number)) number = 0;
  number = Math.max(minimum, Math.min(maximum, number));
  var precision = Math.pow(10, decimals);
  return Math.round(number * precision) / precision;
};

NarrativeService.normalizeOutcome_ = function(outcome) {
  var source = outcome && typeof outcome === 'object' && !Array.isArray(outcome) ? outcome : {};
  var normalized = {};
  for (var index = 0; index < NarrativeService.METRIC_RULES.length; index += 1) {
    var rule = NarrativeService.METRIC_RULES[index];
    normalized[rule.key] = NarrativeService.normalizeNumber_(
      source[rule.key], rule.min, rule.max, rule.decimals
    );
  }
  normalized.waterFactor = NarrativeService.normalizeNumber_(source.waterFactor, 0, 1, 2);
  return normalized;
};

NarrativeService.localizedMessage_ = function(key, fallback) {
  try {
    if (typeof Localization !== 'undefined' && Localization.get) {
      return String(Localization.get(key, fallback) || fallback);
    }
    return fallback;
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('NarrativeService.localizedMessage_', error, { key: key });
    }
    return fallback;
  }
};

NarrativeService.classifyRound_ = function(outcome) {
  if (outcome.waterFactor < 1) {
    return { status: 'water-limited', title: 'Água como limite', messageKey: 'roundWaterLimited' };
  }
  if (outcome.profit < 0) {
    return { status: 'economic-review', title: 'Rodada para revisar', messageKey: 'roundSuccess' };
  }
  return { status: 'balanced-comparison', title: 'Rodada para comparar', messageKey: 'roundSuccess' };
};

/**
 * Constrói a narrativa e feedback da rodada para o jogador
 * @param {Object} outcome - Resultado da rodada
 * @returns {Object} Narrativa com título, evidências e prompt de aprendizagem
 */
NarrativeService.buildRoundNarrative = function(outcome) {
  var evidence = NarrativeService.normalizeOutcome_(outcome);
  var classification = NarrativeService.classifyRound_(evidence);

  return {
    status: classification.status,
    title: classification.title,
    message: NarrativeService.localizedMessage_(
      classification.messageKey,
      classification.status === 'water-limited'
        ? 'A produção ficou limitada pela água. O que mudaria na próxima tentativa?'
        : 'A rodada terminou. Compare o ganho com o impacto no recurso compartilhado.'
    ),
    evidence: evidence,
    comparison: [
      { key: 'waterUsed', label: 'Água usada', value: evidence.waterUsed },
      { key: 'yieldUnits', label: 'Produção', value: evidence.yieldUnits },
      { key: 'profit', label: 'Resultado', value: evidence.profit },
      { key: 'sustainabilityDelta', label: 'Impacto ambiental', value: evidence.sustainabilityDelta }
    ],
    prompt: NarrativeService.localizedMessage_(
      'reflectionPrompt',
      'Registre uma previsão antes de agir e explique o que mudou depois.'
    )
  };
};

/**
 * Gera notícia jornalística simulada do DF baseada no estado coletivo da bacia
 * @param {number} sustainabilityScore - Score da bacia (0-100)
 * @param {Object} climate - Condições climáticas atuais
 * @returns {Object} Notícia com manchete, resumo e impacto institucional
 */
NarrativeService.generateBasinNews = function(sustainabilityScore, climate) {
  var rawScore = Number(sustainabilityScore);
  var score = NarrativeService.normalizeNumber_(Number.isFinite(rawScore) ? rawScore : 50, 0, 100, 1);
  var rain = NarrativeService.normalizeNumber_(climate && climate.rainValue, 0, 1000, 1);

  var headline = '';
  var body = '';
  var tag = 'DIÁRIO DO PARANOÁ';
  var severity = 'ATENÇÃO';

  if (score >= 75) {
    headline = 'Comunidades do DF alcançam índice recorde de preservação no Lago Paranoá';
    body = 'A gestão equilibrada entre irrigação rural e conservação da mata ciliar mantém os reservatórios em níveis seguros.';
    severity = 'POSITIVO';
  } else if (score < 40) {
    headline = 'Comitê de Bacia alerta para risco de racionamento hídrico no Distrito Federal';
    body = 'A extração desenfreada sem respeito à recarga natural dos aquíferos pressiona o abastecimento na capital.';
    severity = 'ALERTA';
  } else {
    headline = rain > 100
      ? 'Temporais de verão trazem alívio temporário para produtores rurais da bacia'
      : 'Produtores adotam técnicas de manejo sustentável para enfrentar estiagem no Cerrado';
    body = 'Especialistas reforçam a importância de monitorar o fluxo de base que alimenta o Lago Paranoá.';
  }

  return {
    tag: tag,
    severity: severity,
    headline: headline,
    body: body,
    evidence: { sustainabilityScore: score, rainValue: rain },
    question: 'Qual dado desta notícia ajuda a decidir a próxima ação da comunidade?',
    publishedAt: new Date().toISOString().split('T')[0]
  };
};

/**
 * Constrói narrativa para eventos históricos registrados na simulação.
 * @param {Object} event - Objeto de evento com tipo, título e impacto
 * @returns {Object} Narrativa com contextualização e reflexão
 */
NarrativeService.buildEventNarrative = function(event) {
  try {
    if (!event || typeof event !== 'object') {
      return { title: 'Evento Geral', description: 'Monitoramento contínuo da bacia.', reflection: 'Analise o impacto nas próximas rodadas.' };
    }
    var title = String(event.title || event.eventType || 'Evento no DF');
    var desc = String(event.description || 'Variações climáticas e operacionais registradas no período.');
    var impact = event.impact || {};

    var narrativeText = desc;
    if (typeof TemplateEngine !== 'undefined' && TemplateEngine.render) {
      narrativeText = TemplateEngine.render(desc, impact);
    }

    return {
      title: title,
      description: narrativeText,
      impact: impact,
      timestamp: event.createdAt || new Date().toISOString(),
      reflection: 'Como as decisões individuais influenciaram o resultado deste evento?'
    };
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('NarrativeService.buildEventNarrative', error);
    }
    return { title: 'Evento', description: 'Evento registrado.', reflection: '' };
  }
};

/**
 * Registra a geração de narrativa no log de auditoria se disponível.
 * @param {string} playerId
 * @param {Object} outcome
 */
NarrativeService.auditNarrativeGeneration = function(playerId, outcome) {
  try {
    if (typeof AuditLog !== 'undefined' && AuditLog.logEvent) {
      AuditLog.logEvent('NARRATIVE_GENERATED', {
        playerId: playerId,
        waterUsed: outcome && outcome.waterUsed,
        profit: outcome && outcome.profit
      });
    }
  } catch (e) {
    // Registro de auditoria não-bloqueante
  }
};

/**
 * Carrega parâmetros de narrativa a partir das Script Properties.
 * @returns {Object} Configuração de narrativa
 */
NarrativeService.loadNarrativeConfig = function() {
  try {
    if (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties) {
      var props = PropertiesService.getScriptProperties();
      return {
        basinTitle: props.getProperty('LAGO_BASIN_NAME') || 'Bacia Hidrográfica do Paranoá',
        institution: props.getProperty('LAGO_INSTITUTION') || 'Comitê de Bacia Hidrográfica dos Afluentes do Rio Paranoá',
        activeMode: props.getProperty('LAGO_NARRATIVE_MODE') || 'pedagogico'
      };
    }
    return { basinTitle: 'Bacia Hidrográfica do Paranoá', institution: 'Comitê de Bacia', activeMode: 'pedagogico' };
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('NarrativeService.loadNarrativeConfig', error);
    }
    return { basinTitle: 'Bacia do Paranoá', institution: 'Comitê', activeMode: 'pedagogico' };
  }
};

/**
 * Retorna uma síntese da notícia em formato HTML para exibição rápida.
 * @param {number} sustainabilityScore
 * @param {Object} climate
 * @returns {Object|null} HtmlOutput
 */
NarrativeService.getBasinNewsAsHtml = function(sustainabilityScore, climate) {
  try {
    var news = NarrativeService.generateBasinNews(sustainabilityScore, climate);
    var html = '<div class="news-card"><h3>' + news.headline + '</h3><p>' + news.body + '</p></div>';
    if (typeof HtmlService !== 'undefined' && HtmlService.createHtmlOutput) {
      return HtmlService.createHtmlOutput(html);
    }
    return null;
  } catch (e) {
    return null;
  }
};

/**
 * Retorna as notícias da bacia em JSON para consumo HTTP.
 * @returns {Object} ContentService TextOutput
 */
function getBasinNewsJson(score, climateJson) {
  var climate = climateJson ? JSON.parse(climateJson) : null;
  var news = NarrativeService.generateBasinNews(score || 50, climate);
  if (typeof ContentService !== 'undefined' && ContentService.createTextOutput) {
    return ContentService.createTextOutput(JSON.stringify(news)).setMimeType(ContentService.MimeType.JSON);
  }
  return news;
}
