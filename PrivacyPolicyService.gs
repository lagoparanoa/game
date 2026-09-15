/**
 * @file PrivacyPolicyService.gs
 * @description RPC mínimo para registrar visitas ao aviso de privacidade.
 *
 * Esta função é chamada por PrivacyPolicy.html em contexto anônimo. O cliente
 * não escolhe o tipo de evento nem pode gravar dados arbitrários no AuditLog.
 */

/**
 * Registra uma visita ao aviso de privacidade.
 *
 * @param {{page?: string, ts?: string}=} payload dados não confiáveis do cliente
 * @return {{success: boolean, eventType?: string, timestamp?: string}}
 */
function logPrivacyPolicyVisit(payload) {
  try {
    payload = payload && typeof payload === 'object' ? payload : {};

    var clientTimestamp = String(payload.ts || '').trim().slice(0, 80);
    var result = AuditLog.logEvent('PRIVACY_POLICY_VISIT', {
      page: 'privacyPolicy',
      clientTimestamp: clientTimestamp,
      source: 'Web'
    });

    return result && result.success
      ? { success: true, eventType: result.eventType, timestamp: result.timestamp }
      : { success: false };
  } catch (error) {
    // A visita não deve impedir a navegação nem expor detalhes do backend.
    Logger.log('logPrivacyPolicyVisit falhou: ' + (error.message || error));
    return { success: false };
  }
}
