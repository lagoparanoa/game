/**
 * @file TutorialService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Guia interativo e pedagógico para novos jogadores aprenderem a dinâmica
 *              hidrológica, agronômica e socioeconômica da Bacia do Paranoá.
 * @context Alinhado com as competências da BNCC e o ciclo de investigação científica.
 */

function TutorialService() {
  Logger.log('Iniciando componente: TutorialService.gs');
}

/**
 * Módulos do tutorial pedagógico
 */
TutorialService.MODULES = [
  {
    stepId: 'step-01',
    title: '1. O Lago Paranoá e o Clima do DF',
    description: 'Compreenda a sazonalidade climática de Brasília (seca e chuva) e como o espelho d\'água depende do equilíbrio das chuvas.',
    bnccCode: 'EF06CI03',
    objective: 'Reconhecer o papel das chuvas e da evaporação na estabilidade hídrica.',
    question: 'Qual é o período em que a demanda por irrigação se torna mais crítica no DF?',
    options: ['Estação Seca (Maio a Setembro)', 'Estação Chuvosa (Novembro a Março)'],
    correctIndex: 0
  },
  {
    stepId: 'step-02',
    title: '2. O Aquífero e o Fluxo de Base',
    description: 'Entenda os aquíferos Poroso e Fraturado que alimentam os tributários do Lago Paranoá durante o período de estiagem.',
    bnccCode: 'EF07CI08',
    objective: 'Identificar a relação entre recarga de aquíferos e extração via poços.',
    question: 'O que acontece quando a extração total supera a recarga anual da bacia?',
    options: ['O lençol freático rebaixa e o fluxo de base diminui', 'A água subterrânea se multiplica automaticamente'],
    correctIndex: 0
  },
  {
    stepId: 'step-03',
    title: '3. Culturas, Irrigação e Eficiência Hídrica',
    description: 'Compare culturas como Milho, Soja e Hortaliças, ponderando custo hídrico, rendimento esperado e preço de mercado.',
    bnccCode: 'EF08GE14',
    objective: 'Calcular a eficiência econômica por metro cúbico de água aplicado.',
    question: 'Qual é a melhor estratégia durante uma seca severa?',
    options: ['Optar por culturas de baixo consumo hídrico e irrigação de precisão', 'Dobrar o volume de irrigação sem planejamento'],
    correctIndex: 0
  },
  {
    stepId: 'step-04',
    title: '4. O Dilema dos Comuns e Decisões Coletivas',
    description: 'Experimente a tomada de decisão coletiva em vilas: a ação individual afeta a sustentabilidade de todos.',
    bnccCode: 'EF09CI13',
    objective: 'Desenvolver responsabilidade socioambiental e cooperação comunitária.',
    question: 'O que garante a preservação a longo prazo do Lago Paranoá?',
    options: ['Acordos comunitários de uso racional e governança da orla', 'Competição desenfreada por recursos finitos'],
    correctIndex: 0
  }
];

/**
 * Retorna todos os passos disponíveis do tutorial
 * @returns {Array<Object>} Lista de passos
 */
TutorialService.getTutorialSteps = function() {
  try {
    return TutorialService.MODULES.map(function(module) {
      return {
        stepId: module.stepId,
        title: module.title,
        description: module.description,
        bnccCode: module.bnccCode,
        objective: module.objective,
        question: module.question,
        options: module.options
      };
    });
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('TutorialService.getTutorialSteps', error);
    }
    return [];
  }
};

/**
 * Retorna um passo específico
 * @param {string} stepId - Identificador do passo
 * @returns {Object|null} Módulo correspondente
 */
TutorialService.getStepById = function(stepId) {
  try {
    return TutorialService.MODULES.find(function(m) {
      return m.stepId === stepId;
    }) || null;
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('TutorialService.getStepById', error, { stepId });
    }
    return null;
  }
};

/**
 * Valida a resposta de um desafio do tutorial e registra conclusão
 * @param {string} stepId - Identificador do passo
 * @param {number} answerIndex - Índice da resposta escolhida pelo jogador
 * @returns {Object} Resultado da validação
 */
TutorialService.validateStepAnswer = function(stepId, answerIndex) {
  try {
    const step = TutorialService.getStepById(stepId);
    if (!step) {
      return { success: false, error: 'Passo do tutorial não encontrado.' };
    }

    const isCorrect = Number(answerIndex) === step.correctIndex;
    return {
      success: true,
      stepId: stepId,
      correct: isCorrect,
      feedback: isCorrect
        ? 'Excelente! Conceito compreendido com sucesso.'
        : 'Resposta incorreta. Revise as diretrizes da rodada e tente novamente.'
    };
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('TutorialService.validateStepAnswer', error, { stepId, answerIndex });
    }
    return { success: false, error: error.message };
  }
};

/**
 * Retorna o progresso estimado do tutorial de um jogador
 * @param {Array<string>} completedStepIds - IDs dos passos já concluídos
 * @returns {Object} Percentual e status do tutorial
 */
TutorialService.calculateProgress = function(completedStepIds) {
  try {
    const completed = Array.isArray(completedStepIds) ? completedStepIds : [];
    const total = TutorialService.MODULES.length;
    const count = completed.length;
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;

    return {
      totalSteps: total,
      completedSteps: count,
      percentage: Math.min(100, percent),
      isComplete: count >= total
    };
  } catch (error) {
    return { totalSteps: 5, completedSteps: 0, percentage: 0, isComplete: false };
  }
};

/**
 * Obtém o estado pedagógico do tutorial para um jogador a partir das configurações
 * @param {string} playerId
 * @returns {Object}
 */
TutorialService.getPlayerTutorialState = function(playerId) {
  try {
    if (!playerId) return TutorialService.calculateProgress([]);
    let completedSteps = [];
    if (typeof SettingsService !== 'undefined' && SettingsService.getUserSetting) {
      const raw = SettingsService.getUserSetting('tutorial_' + playerId, '[]');
      try { completedSteps = JSON.parse(raw); } catch (e) { completedSteps = []; }
    }
    return TutorialService.calculateProgress(completedSteps);
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('TutorialService.getPlayerTutorialState', error, { playerId });
    }
    return TutorialService.calculateProgress([]);
  }
};

