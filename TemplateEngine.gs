/**
 * @file TemplateEngine.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Motor de renderização e interpolação de templates dinâmicos para componentes HTML.
 * @context MVC View helper com escape seguro e filtros de formatação.
 */

function TemplateEngine() {
  Logger.log('Iniciando componente: TemplateEngine.gs');
}

TemplateEngine.MAX_TEMPLATE_LENGTH = 200000;
TemplateEngine.MAX_PATH_DEPTH = 8;
TemplateEngine.BLOCKED_PATH_KEYS = { '__proto__': true, 'prototype': true, 'constructor': true };

TemplateEngine.toFiniteNumber_ = function(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Escapa caracteres HTML para prevenção de XSS
 * @param {string} str - Texto a escapar
 * @returns {string} Texto seguro
 */
TemplateEngine.escapeHTML = function(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Filtros de formatação pré-definidos
 */
TemplateEngine.filters = {
  currency: function(val) {
    const num = TemplateEngine.toFiniteNumber_(val);
    return 'R$ ' + num.toFixed(2).replace('.', ',');
  },
  number: function(val) {
    return TemplateEngine.toFiniteNumber_(val);
  },
  percent: function(val) {
    const num = TemplateEngine.toFiniteNumber_(val);
    return num.toFixed(1) + '%';
  },
  upper: function(val) {
    return String(val || '').toUpperCase();
  },
  lower: function(val) {
    return String(val || '').toLowerCase();
  },
  truncate: function(val) {
    const str = String(val || '');
    return str.length > 50 ? str.slice(0, 47) + '…' : str;
  },
  integer: function(val) {
    return Math.round(TemplateEngine.toFiniteNumber_(val));
  },
  yesno: function(val) {
    return val === true || String(val).toLowerCase() === 'true' ? 'Sim' : 'Não';
  }
};

/**
 * Resolve caminho aninhado em um objeto (ex: "player.name")
 */
TemplateEngine.resolvePath_ = function(obj, path) {
  if (!obj || typeof obj !== 'object') return '';
  const parts = String(path || '').split('.');
  if (!parts.length || parts.length > TemplateEngine.MAX_PATH_DEPTH) return '';
  let current = obj;
  for (let i = 0; i < parts.length; i++) {
    if (current === null || current === undefined) return '';
    if (TemplateEngine.BLOCKED_PATH_KEYS[parts[i]]) return '';
    if ((typeof current !== 'object' && typeof current !== 'function') || !Object.prototype.hasOwnProperty.call(current, parts[i])) return '';
    current = current[parts[i]];
  }
  return current !== undefined ? current : '';
};

/**
 * Interpola dados em uma string de template simples: {{variavel}} ou {{variavel|filtro}}
 * @param {string} template - String com placeholders
 * @param {Object} data - Objeto com dados
 * @returns {string} String com valores substituídos
 */
TemplateEngine.interpolate = function(template, data) {
  if (!template) return '';
  if (String(template).length > TemplateEngine.MAX_TEMPLATE_LENGTH) throw new Error('Template excede o limite permitido.');
  if (data !== undefined && data !== null && (typeof data !== 'object' || Array.isArray(data))) {
    throw new Error('O contexto do template deve formar um objeto.');
  }
  const context = data || {};

  return String(template).replace(/\{\{\s*([a-zA-Z0-9_.]+)(?:\|([a-zA-Z0-9_]+))?\s*\}\}/g, function(match, key, filter) {
    let value = TemplateEngine.resolvePath_(context, key);
    if (filter && typeof TemplateEngine.filters[filter] === 'function') {
      value = TemplateEngine.filters[filter](value);
    }
    return TemplateEngine.escapeHTML(value);
  });
};

/**
 * Renderiza um template com contexto
 * @param {string} templateString - String de template
 * @param {Object} data - Objeto de dados
 * @returns {string} HTML renderizado
 */
TemplateEngine.render = function(templateString, data) {
  try {
    return TemplateEngine.interpolate(templateString, data);
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('TemplateEngine.render', error);
    }
    return '';
  }
};

/** Inspeciona tokens antes da renderização para detectar paths e filtros inválidos. */
TemplateEngine.validateTemplate = function(templateString) {
  const issues = [];
  const source = String(templateString || '');
  if (source.length > TemplateEngine.MAX_TEMPLATE_LENGTH) issues.push('Template excede o limite permitido.');
  const pattern = /\{\{\s*([a-zA-Z0-9_.]+)(?:\|([a-zA-Z0-9_]+))?\s*\}\}/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const parts = match[1].split('.');
    if (parts.length > TemplateEngine.MAX_PATH_DEPTH || parts.some(function(part) { return TemplateEngine.BLOCKED_PATH_KEYS[part]; })) {
      issues.push('Caminho de template não permitido: ' + match[1]);
    }
    if (match[2] && typeof TemplateEngine.filters[match[2]] !== 'function') {
      issues.push('Filtro desconhecido: ' + match[2]);
    }
  }
  return { valid: issues.length === 0, issues: issues };
};
