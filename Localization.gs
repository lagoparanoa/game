/**
 * @file Localization.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Centraliza textos, mensagens pedagógicas, glossário hidrológico e narrativas do DF.
 * @context Integração da lógica técnica robusta (V1) com a narrativa do DF (V2). Suporta interpolação
 *          de variáveis dinâmicas, busca normalizada com remoção de acentos, validação de integridade
 *          e expansão incremental de idiomas (preparado para i18n futuro).
 * @version 1.1.0
 * @since 2026-09-02
 */

function Localization() {
  Logger.log('Iniciando componente: Localization.gs');
}

/** Idioma padrão do sistema (ISO 639-1). */
Localization.DEFAULT_LOCALE = 'pt';

/** Locale ativo na sessão (configurável via Script Properties ou por chamada explícita). */
Localization._currentLocale = Localization.DEFAULT_LOCALE;

/**
 * Define o locale ativo para mensagens e glossário.
 * 
 * @param {string} locale - Código ISO (ex: 'pt', 'en', 'es')
 * @returns {boolean} true se o locale foi definido, false se não suportado
 */
Localization.setLocale = function(locale) {
  var normalized = String(locale || '').toLowerCase().trim();
  // Atualmente apenas 'pt' suportado; estrutura preparada para expansão
  if (normalized !== 'pt') {
    Logger.log('[Localization] Locale não suportado: ' + locale + ', mantendo padrão.');
    return false;
  }
  Localization._currentLocale = normalized;
  return true;
};

/**
 * Retorna o locale ativo.
 * 
 * @returns {string} Código ISO do locale atual
 */
Localization.getLocale = function() {
  return Localization._currentLocale;
};

/**
 * Mensagens do sistema e feedbacks pedagógicos (pt-BR)
 */
Localization.MESSAGES = {
  roundSuccess: 'A rodada terminou. Compare o ganho com o impacto no recurso compartilhado.',
  roundWaterLimited: 'A produção ficou limitada pela água. O que mudaria na próxima tentativa?',
  waterInsufficient: 'Água insuficiente para esta decisão. Reduza a quantidade ou escolha outra cultura.',
  reflectionPrompt: 'Registre uma previsão antes de agir e explique o que mudou depois.',
  welcomeTitle: 'Bem-vindo ao Lago Paranoá!',
  welcomeSubtitle: 'Gerencie recursos hídricos com sabedoria e cooperação.',
  aquiferRechargeHigh: 'As fortes chuvas de verão no Planalto Central recarregaram os lençóis freáticos.',
  aquiferDepletionWarning: 'Atenção: A estiagem prolongada reduziu a vazão dos afluentes do Lago.',
  orlaPreserved: 'A preservação da faixa de 30m de mata ciliar evitou o assoreamento da orla.',
  cooperationBonus: 'Sua vila atingiu a meta de economia hídrica coletiva!',
  rankUp: 'Parabéns! Você subiu para o {{rank}}º lugar no ranking regional.',
  badgeEarned: 'Conquista desbloqueada: {{badgeName}}!',
  tutorialCompleted: 'Tutorial concluído. Você está pronto para decisões estratégicas reais.',
  villageJoined: 'Você agora faz parte da vila {{villageName}} na região {{region}}.',
  privacyReminder: 'Seus dados educacionais são protegidos conforme LGPD e política de privacidade.',
  sessionExpired: 'Sua sessão expirou. Faça login novamente para continuar.',
  errorGeneric: 'Ocorreu um erro inesperado. Tente novamente ou contate o suporte.'
};

/**
 * Glossário contextualizado com a hidrografia do Distrito Federal
 */
Localization.GLOSSARY = {
  aquiferoPoroso: {
    term: 'Aquífero Poroso (Manto de Intemperismo)',
    definition: 'Camada superficial de solo e rocha alterada que retém água da chuva e alimenta nascentes no DF.',
    category: 'Hidrologia'
  },
  aquiferoFraturado: {
    term: 'Aquífero Fraturado (Grupo Paranoá / Canastra)',
    definition: 'Reservatório subterrâneo em rochas fraturadas, de onde poços profundos extraem água.',
    category: 'Hidrologia'
  },
  mataCiliar: {
    term: 'Mata Ciliar e APP',
    definition: 'Vegetação nativa nas margens de cursos d\'água que protege contra erosão e assoreamento.',
    category: 'Ecologia'
  },
  fluxoDeBase: {
    term: 'Fluxo de Base',
    definition: 'Volume contínuo de água subterrânea que mantém rios e o Lago Paranoá abastecidos na seca.',
    category: 'Hidrologia'
  },
  assoreamento: {
    term: 'Assoreamento',
    definition: 'Acúmulo de sedimentos que reduz a profundidade e capacidade de reservatórios.',
    category: 'Impactos'
  },
  vazao: {
    term: 'Vazão',
    definition: 'Volume de água que passa por uma seção do rio em determinado tempo (m³/s).',
    category: 'Hidrologia'
  },
  recarga: {
    term: 'Recarga de Aquífero',
    definition: 'Processo pelo qual a água da chuva infiltra no solo e reabastece lençóis freáticos.',
    category: 'Hidrologia'
  },
  eutrofizacao: {
    term: 'Eutrofização',
    definition: 'Excesso de nutrientes na água que causa proliferação de algas e reduz oxigênio.',
    category: 'Impactos'
  }
};

/**
 * Recupera uma mensagem localizada pelo identificador
 * @param {string} key - Chave da mensagem
 * @param {string} [fallback] - Texto alternativo se a chave não existir
 * @param {Object} [values] - Objeto com variáveis dinâmicas para interpolação
 * @returns {string} Mensagem localizada
 */
Localization.get = function(key, fallback, values) {
  try {
    var normalizedKey = String(key || '').trim();
    var message = Localization.MESSAGES[normalizedKey];
    var resolved = message || String(fallback || normalizedKey);
    return values ? Localization.interpolate(resolved, values) : resolved;
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('Localization.get', error, { key: key });
    }
    return String(fallback || key || '');
  }
};

/**
 * Interpola tokens {{nome}} sem avaliar código ou HTML.
 * @param {string} template
 * @param {Object} values
 * @returns {string}
 */
Localization.interpolate = function(template, values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    throw new Error('Os valores de interpolação devem formar um objeto.');
  }

  var output = String(template == null ? '' : template);
  var keys = Object.keys(values);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var safeKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var token = new RegExp('{{\\s*' + safeKey + '\\s*}}', 'g');
    output = output.replace(token, String(values[key] == null ? '' : values[key]));
  }
  return output;
};

/**
 * Renderiza mensagem ou texto formatado utilizando o TemplateEngine do sistema se disponível.
 * @param {string} templateText - Texto com tags de template
 * @param {Object} contextData - Dados contextuais
 * @returns {string} Texto renderizado
 */
Localization.renderWithTemplateEngine = function(templateText, contextData) {
  try {
    if (typeof TemplateEngine !== 'undefined' && TemplateEngine.render) {
      return TemplateEngine.render(templateText, contextData || {});
    }
    return Localization.interpolate(templateText, contextData || {});
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('Localization.renderWithTemplateEngine', error);
    }
    return String(templateText || '');
  }
};

/**
 * Carrega a preferência de idioma a partir das Script Properties do ambiente.
 * @returns {string} Locale configurado ou padrão
 */
Localization.loadLocaleFromProperties = function() {
  try {
    if (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties) {
      var props = PropertiesService.getScriptProperties();
      var configuredLocale = props.getProperty('LAGO_LOCALE') || props.getProperty('LOCALE');
      if (configuredLocale) {
        Localization.setLocale(configuredLocale);
      }
    }
    return Localization.getLocale();
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('Localization.loadLocaleFromProperties', error);
    }
    return Localization.DEFAULT_LOCALE;
  }
};

/**
 * Retorna mensagem encapsulada em HtmlOutput seguro para visualização.
 * @param {string} key
 * @param {Object} [values]
 * @returns {Object|null}
 */
Localization.getAsHtmlOutput = function(key, values) {
  try {
    var text = Localization.get(key, '', values);
    if (typeof HtmlService !== 'undefined' && HtmlService.createHtmlOutput) {
      return HtmlService.createHtmlOutput(text);
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Recupera um termo do glossário
 * @param {string} termKey - Chave do termo
 * @returns {Object|null} Objeto com termo e definição
 */
Localization.getGlossaryTerm = function(termKey) {
  var entry = Localization.GLOSSARY[String(termKey || '').trim()];
  if (!entry) return null;
  return { term: entry.term, definition: entry.definition };
};

/**
 * Busca termos por título ou definição, ignorando acentos e caixa.
 * @param {string} query
 * @returns {Array<Object>}
 */
Localization.searchGlossary = function(query) {
  var normalizedQuery = Localization.normalizeForSearch(query);
  if (!normalizedQuery) return [];

  var matches = [];
  var keys = Object.keys(Localization.GLOSSARY);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var entry = Localization.GLOSSARY[key];
    var searchable = Localization.normalizeForSearch(entry.term + ' ' + entry.definition);
    if (searchable.indexOf(normalizedQuery) !== -1) {
      matches.push({ key: key, term: entry.term, definition: entry.definition });
    }
  }
  return matches;
};

Localization.normalizeForSearch = function(value) {
  var text = String(value || '').toLowerCase();
  if (text.normalize) text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return text.trim();
};

/** Verifica a integridade mínima do catálogo usado nas telas pedagógicas. */
Localization.validate = function() {
  var issues = [];
  var messageKeys = Object.keys(Localization.MESSAGES);
  for (var m = 0; m < messageKeys.length; m++) {
    var mKey = messageKeys[m];
    if (!String(Localization.MESSAGES[mKey] || '').trim()) issues.push('Mensagem vazia: ' + mKey);
  }
  var glossaryKeys = Object.keys(Localization.GLOSSARY);
  for (var g = 0; g < glossaryKeys.length; g++) {
    var gKey = glossaryKeys[g];
    var entry = Localization.GLOSSARY[gKey] || {};
    if (!String(entry.term || '').trim() || !String(entry.definition || '').trim()) {
      issues.push('Termo incompleto: ' + gKey);
    }
  }
  return { valid: issues.length === 0, issues: issues };
};
