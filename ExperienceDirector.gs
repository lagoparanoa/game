/**
 * @file ExperienceDirector.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Diretor de experiência pedagógica e narrativa de Lago Paranoá.
 * Inspirado em ZQuestClassic (capítulos/estado), Unciv (decisões por rodada)
 * e GCompris (andaimes e evidência formativa). Funções puras e determinísticas.
 *
 * Estrutura de fases:
 *   Fase 1 — Exploração (cap. 1–2): decisão binária clara, estado generoso.
 *   Fase 2 — Tensão     (cap. 3–4): 3 opções com trade-offs reais.
 *   Fase 3 — Crise      (cap. 5–6): decisões encadeadas, estado pressionado.
 *   Fase 4 — Bacia Sustentável (cap. 7–8): governança participativa e visão sistêmica.
 */

function ExperienceDirector() {
  Logger.log('Iniciando componente: ExperienceDirector.gs');
}

var EXPERIENCE_GAME_ = {
  id: "lago-paranoa",
  title: "Lago Paranoá",
  sharedResource: "água compartilhada e resiliência da bacia do Paranoá",
  chapters: [
    // ── FASE 1 · Exploração ──────────────────────────────────────────────────
    { id: "prever-clima", order: 1, phase: 1, constraint: null,
      title: "Nuvens sobre a bacia",
      situation: "A previsão pluviométrica é incerta e cada comunidade ribeirinha precisa planejar a captação sem esgotar o espelho d'água.",
      decisions: [
        { id: "reservar", label: "Manter cota de reserva preventiva e declarar hipótese de consumo", delta: { knowledge: 2, cooperation: 2, pressure: -1 } },
        { id: "captar",   label: "Captar o volume máximo imediato sem coordenar com os vizinhos",    delta: { knowledge: -1, cooperation: -2, pressure: 2 } }
      ]
    },
    { id: "qualidade-nascentes", order: 2, phase: 1, constraint: null,
      title: "A saúde dos afluentes",
      situation: "Monitorar a turbidez e o oxigênio dissolvido nos córregos Bananal e Torto antes do período chuvoso.",
      decisions: [
        { id: "amostragem-coletiva", label: "Realizar mutirão de coleta de amostras com escolas ribeirinhas", delta: { knowledge: 2, cooperation: 2, pressure: -1 } },
        { id: "presumir-limpo",      label: "Supor que a água está pura sem realizar testes laboratoriais",   delta: { knowledge: -1, cooperation: -1, pressure: 2 } }
      ]
    },

    // ── FASE 2 · Tensão ──────────────────────────────────────────────────────
    { id: "negociar", order: 3, phase: 2, constraint: "Estiagem prolongada: nível do reservatório atinge cota de alerta amarelo.",
      title: "A rodada das margens",
      situation: "Agricultura irrigada, abastecimento urbano e esportes náuticos apresentam demandas simultâneas e conflitantes.",
      decisions: [
        { id: "pactuar",        label: "Pactuar cotas proporcionais sazonais e critérios de prioridade pública", delta: { knowledge: 2, cooperation: 2, pressure: -1 } },
        { id: "individualizar", label: "Permitir que cada setor busque outorgas individuais sem restrição",     delta: { knowledge: 0, cooperation: -2, pressure: 2 } },
        { id: "campanha-reuso", label: "Implementar incentivos fiscais para reúso predial de águas cinzas",     delta: { knowledge: 1, cooperation: 2, pressure: 0 } }
      ]
    },
    { id: "floracao-algas", order: 4, phase: 2, constraint: "Eutrofização: floração de cianobactérias detectada no braço do Riacho Fundo.",
      title: "O florescer que sufoca",
      situation: "Excesso de nutrientes exige intervenção coordenada para evitar mortandade de peixes e interrupção na captação.",
      decisions: [
        { id: "biorremediacao", label: "Implantar jardins flutuantes de macrófitas e dragagem ecológica", delta: { knowledge: 2, cooperation: 2, pressure: -1 } },
        { id: "quimico-pesado", label: "Aplicar algicidas químicos de alto impacto sem plano de manejo",   delta: { knowledge: 0, cooperation: -2, pressure: 2 } },
        { id: "conter-esgoto",  label: "Fiscalizar e multar ligações clandestinas com suporte cidadão",    delta: { knowledge: 2, cooperation: 1, pressure: 0 } }
      ]
    },

    // ── FASE 3 · Crise ───────────────────────────────────────────────────────
    { id: "adaptar", order: 5, phase: 3, constraint: "Crise hídrica severa: volume útil abaixo de 20% e temperatura em elevação.",
      title: "Depois da estiagem extrema",
      situation: "Os dados mostram efeitos acumulados nos aquíferos e exigem transição para modelos urbanos e agrícolas resilientes.",
      decisions: [
        { id: "diversificar", label: "Transicionar para agroecologia de sequeiro e infraestrutura verde", delta: { knowledge: 2, cooperation: 2, pressure: -1 } },
        { id: "persistir",    label: "Manter o modelo hídrico convencional apesar das novas evidências", delta: { knowledge: -2, cooperation: -1, pressure: 2 } },
        { id: "tarifa-social", label: "Tarifação progressiva e garantia de mínimo vital para vulneráveis", delta: { knowledge: 1, cooperation: 3, pressure: -1 } }
      ]
    },
    { id: "plano-centenario", order: 6, phase: 3, constraint: "Pacto de Estado: aprovação do Plano Diretor de Águas do Distrito Federal para 50 anos.",
      title: "O horizonte das águas do Paranoá",
      situation: "A assembleia dos povos das águas vota a governança permanente da bacia do Paranoá como patrimônio comum inalienável.",
      decisions: [
        { id: "conselho-participativo", label: "Consolidar comitê de bacia com maioria de representação popular e científica", delta: { knowledge: 2, cooperation: 3, pressure: -1 } },
        { id: "privatizar-gestao",      label: "Conceder a bacia para exploração comercial sem controle social",               delta: { knowledge: -2, cooperation: -3, pressure: 2 } },
        { id: "paranoa-educador",       label: "Tornar toda a orla um parque escolar de educação científica e ambiental",      delta: { knowledge: 3, cooperation: 3, pressure: -1 } }
      ]
    },

    // ── FASE 4 · Bacia Sustentável ──────────────────────────────────────────────────
    { id: "pacto-das-aguas", order: 7, phase: 4, constraint: "Visão sistêmica: proteger os afluentes do Bananal e do Torto para manter o lago limpo.",
      title: "O comitê mirim de bacia hidrográfica",
      situation: "Os estudantes organizam redes de monitoramento comunitário nas nascentes que deságuam no Lago Paranoá.",
      decisions: [
        { id: "monitoramento-nascentes", label: "Instalar pontos de coleta e reflorestar as matas ciliares dos córregos alimentadores", delta: { knowledge: 2, cooperation: 3, pressure: -1 } },
        { id: "ignorar-afluentes", label: "Cuidar apenas da margem central do lago e abandonar a fiscalização das nascentes", delta: { knowledge: -1, cooperation: -2, pressure: 2 } },
        { id: "campanha-cidadania-hidrica", label: "Realizar campanhas nas escolas ribeirinhas sobre descarte correto e economia de água", delta: { knowledge: 2, cooperation: 2, pressure: 0 } }
      ]
    },
    { id: "paranoa-do-amanha", order: 8, phase: 4, constraint: "Plano Diretor Vivo: equilibrar múltiplos usos — lazer, captação potável e biodiversidade aquática.",
      title: "O lago das próximas gerações",
      situation: "A escola apresenta à cidade o plano de conservação integrada para que o Paranoá continue sendo fonte de vida e beleza.",
      decisions: [
        { id: "plano-integrado-sustentavel", label: "Consolidar zoneamento ecológico participativo garantindo acesso público e águas cristalinas", delta: { knowledge: 2, cooperation: 3, pressure: -1 } },
        { id: "privatizar-orlas", label: "Permitir ocupação desordenada e cercamento privado de toda a extensão das margens", delta: { knowledge: -2, cooperation: -3, pressure: 3 } },
        { id: "parque-ecologico-educativo", label: "Inaugurar estação flutuante de biologia lacustre com visitas guiadas para escolas públicas", delta: { knowledge: 2, cooperation: 2, pressure: -1 } }
      ]
    }
  ]
};

function experienceClamp_(value) {
  return Math.max(0, Math.min(10, Number(value) || 0));
}

function getExperienceChapter(chapterId, year) {
  var chapter = EXPERIENCE_GAME_.chapters.filter(function (item) {
    return item.id === String(chapterId || '');
  })[0] || EXPERIENCE_GAME_.chapters[0];
  var schoolYear = Math.max(1, Math.min(5, Number(year) || 3));
  var phaseLabels = { 1: 'Exploração', 2: 'Tensão', 3: 'Crise', 4: 'Bacia Sustentável' };
  return {
    success: true,
    data: {
      gameId:         EXPERIENCE_GAME_.id,
      title:          chapter.title,
      situation:      chapter.situation,
      sharedResource: EXPERIENCE_GAME_.sharedResource,
      phase:          chapter.phase,
      phaseLabel:     phaseLabels[chapter.phase] || 'Exploração',
      constraint:     chapter.constraint || null,
      totalChapters:  EXPERIENCE_GAME_.chapters.length,
      decisions: chapter.decisions.map(function (item) { return { id: item.id, label: item.label }; }),
      cycle: {
        prediction:  schoolYear <= 2 ? 'Desenhe ou conte o que você acha que vai acontecer.' : 'Registre sua previsão e a evidência que pretende observar.',
        observation: 'O que mudou depois da escolha? Use um dado, sinal ou acontecimento do jogo.',
        explanation: 'Como a decisão contribuiu para esse resultado?',
        revision:    'O que o grupo manteria ou mudaria na próxima rodada?'
      },
      support: schoolYear <= 2 ? 'Leitura em voz alta, ícones e resposta oral.' : 'Tabela comparativa, pausa e papéis cooperativos.'
    }
  };
}

function resolveExperienceDecision(state, chapterId, decisionId, evidence) {
  var chapter = EXPERIENCE_GAME_.chapters.filter(function (item) {
    return item.id === String(chapterId || '');
  })[0] || EXPERIENCE_GAME_.chapters[0];
  var decision = chapter.decisions.filter(function (item) {
    return item.id === String(decisionId || '');
  })[0];
  if (!decision) return { success: false, error: 'Escolha não reconhecida para este capítulo.' };
  var current = state || {};
  var next = {
    chapter:     Math.min(EXPERIENCE_GAME_.chapters.length, (Number(current.chapter) || chapter.order) + 1),
    knowledge:   experienceClamp_((Number(current.knowledge)   || 5) + decision.delta.knowledge),
    cooperation: experienceClamp_((Number(current.cooperation) || 5) + decision.delta.cooperation),
    pressure:    experienceClamp_((Number(current.pressure)    || 2) + decision.delta.pressure)
  };
  var balance = next.knowledge + next.cooperation - next.pressure;
  return {
    success:   true,
    gameId:    EXPERIENCE_GAME_.id,
    choice:    { id: decision.id, label: decision.label },
    phase:     chapter.phase,
    previousState: {
      knowledge:   experienceClamp_(Number(current.knowledge)   || 5),
      cooperation: experienceClamp_(Number(current.cooperation) || 5),
      pressure:    experienceClamp_(Number(current.pressure)    || 2)
    },
    nextState:   next,
    consequence: balance >= 8
      ? 'A decisão assegurou a resiliência hídrica e a governança ética de ' + EXPERIENCE_GAME_.sharedResource + '.'
      : balance >= 4
      ? 'A partilha de água foi mantida com compensações que exigem monitoramento hidrológico estrito.'
      : 'A decisão provocou escassez setorial que demanda novas rodadas de negociação no comitê de bacia.',
    evidence:    String(evidence || '').trim().substring(0, 420),
    reflection:  getExperienceChapter(chapterId, 3).data.cycle.revision,
    complete:    chapter.order >= EXPERIENCE_GAME_.chapters.length
  };
}

/**
 * Calcula o desfecho final com base no estado acumulado de Lago Paranoá.
 */
function getExperienceEndgame(state) {
  var s = state || {};
  var k = experienceClamp_(Number(s.knowledge)   || 5);
  var c = experienceClamp_(Number(s.cooperation) || 5);
  var p = experienceClamp_(Number(s.pressure)    || 2);
  var balance = k + c - p;
  var route, title, summary, recommendation;
  if (balance >= 10) {
    route          = 'equilibrado';
    title          = 'Bacia do Paranoá Viva e Sustentável';
    summary        = 'A comunidade garantiu a qualidade da água, equilibrou múltiplos usos e consolidou a cidadania hídrica participativa.';
    recommendation = 'Apresentem a carta das águas do Paranoá no fórum mundial das águas.';
  } else if (p >= 7) {
    route          = 'sobrecarga';
    title          = 'Estresse Hídrico Crítico';
    summary        = 'A demanda excessiva sem conservação preventiva colocou o reservatório em níveis perigosamente baixos.';
    recommendation = 'Reavaliem as decisões da fase 2 relativas ao controle de perdas e outorgas de irrigação.';
  } else {
    route          = 'fragmentado';
    title          = 'Uso Desarmônico da Água';
    summary        = 'Alguns afluentes estão bem cuidados, mas outros continuam vulneráveis à contaminação e ao assoreamento.';
    recommendation = 'Fortaleçam os mutirões de proteção das matas ciliares nascentes.';
  }
  return {
    success:        true,
    gameId:         EXPERIENCE_GAME_.id,
    route:          route,
    title:          title,
    summary:        summary,
    recommendation: recommendation,
    finalState:     { knowledge: k, cooperation: c, pressure: p, balance: balance }
  };
}

/**
 * Workflow mínimo compartilhado: orientar → prever → decidir → observar →
 * refletir. O estado retornado é serializável e pode ser salvo pelo cliente.
 */
function getExperienceBasicWorkflow(year) {
  var first = EXPERIENCE_GAME_.chapters[0];
  return {
    success: true,
    data: {
      gameId:    EXPERIENCE_GAME_.id,
      title:     EXPERIENCE_GAME_.title,
      chapterId: first.id,
      stage:     'briefing',
      stages:    ['briefing', 'prediction', 'decision', 'observation', 'reflection'],
      briefing:  getExperienceChapter(first.id, year).data,
      state:     { chapter: 1, knowledge: 5, cooperation: 5, pressure: 2 },
      complete:  false
    }
  };
}

function advanceExperienceBasicWorkflow(workflow, input, year) {
  var current = workflow && workflow.data ? workflow.data : workflow;
  if (!current || current.gameId !== EXPERIENCE_GAME_.id) {
    current = getExperienceBasicWorkflow(year).data;
  }
  var payload = input || {};
  var stages  = ['briefing', 'prediction', 'decision', 'observation', 'reflection'];
  var stage   = current.stage || 'briefing';
  var chapter = EXPERIENCE_GAME_.chapters.filter(function (item) {
    return item.id === String(current.chapterId || '');
  })[0] || EXPERIENCE_GAME_.chapters[0];

  // Verificação de pré-requisito na transição entre fases
  if (stage === 'briefing' && chapter.phase > 1) {
    var prevIdx     = chapter.order - 2;
    var prevChapter = prevIdx >= 0 ? EXPERIENCE_GAME_.chapters[prevIdx] : null;
    if (prevChapter && prevChapter.phase < chapter.phase &&
        (Number((current.state || {}).knowledge) || 5) < 3) {
      return {
        success:     true,
        needsReview: true,
        message:     'A comunidade precisa consolidar os acordos da fase anterior antes de deliberar novas cotas de uso da água.',
        data:        current
      };
    }
  }

  var next = {
    gameId:      EXPERIENCE_GAME_.id,
    title:       EXPERIENCE_GAME_.title,
    chapterId:   chapter.id,
    stage:       stage,
    stages:      stages.slice(),
    briefing:    getExperienceChapter(chapter.id, year).data,
    state:       current.state || { chapter: chapter.order, knowledge: 5, cooperation: 5, pressure: 2 },
    prediction:  String(current.prediction  || ''),
    observation: String(current.observation || ''),
    reflection:  String(current.reflection  || ''),
    lastResult:  current.lastResult || null,
    complete:    false
  };

  if (stage === 'briefing') {
    next.stage = 'prediction';
  } else if (stage === 'prediction') {
    next.prediction = String(payload.text || payload.prediction || '').trim().substring(0, 420);
    if (!next.prediction) return { success: false, error: 'Registre uma previsão antes de decidir.', data: next };
    next.stage = 'decision';
  } else if (stage === 'decision') {
    var result = resolveExperienceDecision(next.state, chapter.id, payload.decisionId, payload.evidence);
    if (!result.success) return { success: false, error: result.error, data: next };
    next.state      = result.nextState;
    next.lastResult = result;
    next.stage      = 'observation';
  } else if (stage === 'observation') {
    next.observation = String(payload.text || payload.observation || '').trim().substring(0, 420);
    if (!next.observation) return { success: false, error: 'Registre uma evidência observada.', data: next };
    next.stage = 'reflection';
  } else {
    next.reflection = String(payload.text || payload.reflection || '').trim().substring(0, 420);
    if (!next.reflection) return { success: false, error: 'Registre o que manter ou revisar.', data: next };
    var nextChapter = EXPERIENCE_GAME_.chapters[chapter.order];
    if (!nextChapter) {
      next.complete = true;
      next.stage    = 'complete';
      next.endgame  = getExperienceEndgame(next.state);
    } else {
      next.chapterId   = nextChapter.id;
      next.stage       = 'briefing';
      next.briefing    = getExperienceChapter(nextChapter.id, year).data;
      next.prediction  = '';
      next.observation = '';
      next.reflection  = '';
    }
  }
  return { success: true, data: next };
}

ExperienceDirector.getChapter = function(chapterId, year) {
  try {
    return getExperienceChapter(chapterId, year);
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('ExperienceDirector.getChapter', error, { chapterId, year });
    }
    return { success: false, error: error.message };
  }
};

ExperienceDirector.resolveDecision = function(state, chapterId, decisionId, evidence) {
  try {
    return resolveExperienceDecision(state, chapterId, decisionId, evidence);
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('ExperienceDirector.resolveDecision', error, { chapterId, decisionId });
    }
    return { success: false, error: error.message };
  }
};

ExperienceDirector.getEndgame = function(state) {
  try {
    return getExperienceEndgame(state);
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('ExperienceDirector.getEndgame', error);
    }
    return { success: false, error: error.message };
  }
};

ExperienceDirector.getBasicWorkflow = function(year) {
  try {
    return getExperienceBasicWorkflow(year);
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('ExperienceDirector.getBasicWorkflow', error, { year });
    }
    return { success: false, error: error.message };
  }
};

ExperienceDirector.advanceBasicWorkflow = function(workflow, input, year) {
  try {
    return advanceExperienceBasicWorkflow(workflow, input, year);
  } catch (error) {
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.logError) {
      ErrorHandler.logError('ExperienceDirector.advanceBasicWorkflow', error);
    }
    return { success: false, error: error.message };
  }
};

ExperienceDirector.GAME = EXPERIENCE_GAME_;


