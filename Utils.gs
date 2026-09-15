/**
 * @file Utils.gs
 * @description Helpers pequenos e determinísticos usados pelo motor e pelas
 *              telas. Manter estas regras em um único lugar reduz divergência
 *              entre o que a criança vê e o que o servidor calcula.
 */

function Utils() {
  Logger.log('Iniciando componente: Utils.gs');
}

Utils.toNumber = function(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : (fallback || 0);
};

Utils.clamp = function(value, min, max) {
  return Math.min(Math.max(Utils.toNumber(value, min), min), max);
};

Utils.round = function(value, decimals) {
  const precision = Math.pow(10, Math.max(0, Number(decimals) || 0));
  return Math.round(Utils.toNumber(value) * precision) / precision;
};

Utils.normalizeLimit = function(value, fallback, maximum) {
  const limit = Math.floor(Utils.toNumber(value, fallback));
  return Math.min(Math.max(limit || fallback, 1), maximum || 100);
};

Utils.formatCurrency = function(value) {
  return 'R$ ' + Utils.toNumber(value).toFixed(2).replace('.', ',');
};

Utils.formatPercent = function(value, decimals) {
  return Utils.round(value, decimals === undefined ? 1 : decimals).toFixed(decimals === undefined ? 1 : decimals) + '%';
};

Utils.slugify = function(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};

Utils.truncate = function(value, length, suffix) {
  const text = String(value || '');
  const size = Math.max(1, Number(length) || 80);
  const ending = suffix === undefined ? '…' : String(suffix);
  return text.length > size ? text.slice(0, Math.max(0, size - ending.length)) + ending : text;
};

Utils.groupBy = function(items, key) {
  return (items || []).reduce(function(groups, item) {
    const value = item && item[key] !== undefined ? item[key] : 'undefined';
    (groups[value] = groups[value] || []).push(item);
    return groups;
  }, {});
};

Utils.sum = function(items, key) {
  return (items || []).reduce(function(total, item) {
    return total + Utils.toNumber(key ? item[key] : item);
  }, 0);
};

Utils.average = function(items, key) {
  return items && items.length ? Utils.sum(items, key) / items.length : 0;
};

Utils.unique = function(items) {
  return Array.from(new Set(items || []));
};

Utils.safeJsonParse = function(value, fallback) {
  try { return JSON.parse(String(value)); } catch (ignore) { return fallback === undefined ? {} : fallback; }
};

Utils.safeClone = function(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('Utils.safeClone', error);
    }
    return Object.assign({}, obj);
  }
};

Utils.safeGet = function(obj, path, fallback) {
  if (!obj || typeof obj !== 'object') return fallback;
  const segments = Array.isArray(path) ? path : String(path || '').split('.');
  let current = obj;
  for (let i = 0; i < segments.length; i++) {
    const key = segments[i];
    if (current === null || current === undefined || !Object.prototype.hasOwnProperty.call(current, key)) {
      return fallback;
    }
    current = current[key];
  }
  return current !== undefined ? current : fallback;
};

Utils.pick = function(obj, keys) {
  if (!obj || typeof obj !== 'object') return {};
  const result = {};
  (keys || []).forEach(function(k) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      result[k] = obj[k];
    }
  });
  return result;
};

Utils.omit = function(obj, keys) {
  if (!obj || typeof obj !== 'object') return {};
  const omitSet = new Set(keys || []);
  const result = {};
  Object.keys(obj).forEach(function(k) {
    if (!omitSet.has(k)) {
      result[k] = obj[k];
    }
  });
  return result;
};

Utils.capitalize = function(str) {
  const text = String(str || '').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

Utils.escapeRegex = function(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

Utils.formatDate = function(dateInput, includeTime) {
  if (!dateInput) return '';
  try {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const datePart = day + '/' + month + '/' + year;
    if (!includeTime) return datePart;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return datePart + ' ' + hours + ':' + minutes;
  } catch (error) {
    return '';
  }
};

