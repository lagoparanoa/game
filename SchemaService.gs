/**
 * @file SchemaService.gs
 * @project Lago Paranoá - O Desafio das Águas (V3 Integrada)
 * @description Serviço responsável por montar e manter a estrutura de abas e colunas da planilha
 *              unificadora de CRUD do projeto, além de semear dados sintéticos para validação.
 *
 * @context Este serviço centraliza a definição de schema das abas principais, permitindo criar
 *          ou reparar a estrutura esperada e carregar exemplos de registros que cobrem todas as
 *          colunas definidas para suporte a testes e demonstrações.
 */

function SchemaService() {
  Logger.log('Iniciando componente: SchemaService.gs');
}

SchemaService.SCHEMA = {
  Usuarios: {
    headers: ['userId', 'username', 'email', 'role', 'password', 'createdAt', 'lastLogin', 'status'],
    description: 'Tabela de usuários do sistema com credenciais e perfis de acesso',
    columnTypes: {
      userId: 'String (PK, formato U-XXX)',
      username: 'String (único, 3-20 chars)',
      email: 'String (único, formato email)',
      role: "Enum ('admin' | 'educator' | 'player')",
      password: 'String (min 6 chars)',
      createdAt: 'Date',
      lastLogin: 'Date | null',
      status: "Enum ('ATIVO' | 'INATIVO' | 'SUSPENSO')"
    },
    samples: [
      ['U-001', 'admin', 'admin@lago-paranoa.edu.br', 'admin', 'admin123', new Date(2026, 7, 1, 8, 30), new Date(2026, 7, 8, 9, 0), 'ATIVO'],
      ['U-002', 'professor', 'professor@lago-paranoa.edu.br', 'educator', 'Senha456!', new Date(2026, 7, 2, 10, 15), new Date(2026, 7, 8, 9, 10), 'ATIVO']
    ]
  },
  Jogadores: {
    headers: ['playerId', 'userId', 'villageId', 'playerName', 'level', 'waterCredits', 'foodUnits', 'sustainabilityScore', 'lastActivity', 'status', 'experiencePoints'],
    description: 'Perfis de jogadores com recursos e progresso no jogo mantidos em campos independentes',
    columnTypes: {
      playerId: 'String (PK, formato P-XXX)',
      userId: 'String (FK -> Usuarios.userId)',
      villageId: 'String (FK -> Vilas.villageId)',
      playerName: 'String',
      level: 'Number (>=1)',
      waterCredits: 'Number (>=0)',
      foodUnits: 'Number (>=0)',
      sustainabilityScore: 'Number (0-100)',
      lastActivity: 'Date',
      status: "Enum ('ATIVO' | 'INATIVO')",
      experiencePoints: 'Number (>=0, progressão pedagógica; não representa saldo hídrico)'
    },
    samples: [
      ['P-100', 'U-002', 'V-01', 'Ana Silva', 3, 1240, 760, 85, new Date(2026, 7, 8, 11, 20), 'ATIVO', 500],
      ['P-101', 'U-001', 'V-02', 'Bruno Lima', 2, 980, 540, 72, new Date(2026, 7, 8, 11, 30), 'ATIVO', 200]
    ]
  },
  Vilas: {
    headers: ['villageId', 'name', 'region', 'population', 'waterAllocation', 'foodStock', 'sustainabilityIndex', 'createdAt', 'status'],
    description: 'Comunidades com recursos compartilhados e métricas de sustentabilidade',
    columnTypes: {
      villageId: 'String (PK, formato V-XX)',
      name: 'String (único, 3-30 chars)',
      region: "Enum ('Norte' | 'Sul' | 'Leste' | 'Oeste')",
      population: 'Number (>0)',
      waterAllocation: 'Number (>=0, em litros)',
      foodStock: 'Number (>=0, em unidades)',
      sustainabilityIndex: 'Number (0-100)',
      createdAt: 'Date',
      status: "Enum ('ATIVA' | 'INATIVA')"
    },
    samples: [
      ['V-01', 'Vila das Acácias', 'Norte', 6, 3200, 1800, 78, new Date(2026, 6, 15), 'ATIVA'],
      ['V-02', 'Vila do Arvoredo', 'Sul', 5, 2800, 1600, 82, new Date(2026, 6, 18), 'ATIVA']
    ]
  },
  Clima: {
    headers: ['round', 'season', 'rainValue', 'drySpellLength', 'probability', 'temperature', 'createdAt'],
    description: 'Estados climáticos simplificados usados em cada rodada',
    columnTypes: {
      round: 'Number (>=0)',
      season: 'String',
      rainValue: 'Number (>=0, em mm)',
      drySpellLength: 'Number (>=0)',
      probability: 'Number (0-1)',
      temperature: 'Number (graus Celsius)',
      createdAt: 'Date'
    },
    samples: []
  },
  Aquifero: {
    headers: ['round', 'depth', 'extraction', 'recharge', 'evaporation', 'status', 'createdAt'],
    description: 'Estado do reservatório didático de água usado na simulação',
    columnTypes: {
      round: 'Number (>=0)',
      depth: 'Number (>=0, em m³)',
      extraction: 'Number (>=0, em litros por decisão)',
      recharge: 'Number (>=0, em m³ por rodada)',
      evaporation: 'Number (>=0, em m³ por rodada)',
      status: "Enum ('ESTÁVEL' | 'ALERTA' | 'CRÍTICO') - Calculado dinamicamente",
      createdAt: 'Date'
    },
    samples: []
  },
  Culturas: {
    headers: ['cropId', 'name', 'growthDays', 'waterNeed', 'yieldPerCycle', 'status'],
    description: 'Catálogo de culturas adaptadas ao Cerrado para agricultura sustentável',
    columnTypes: {
      cropId: 'String (PK, formato C-XX)',
      name: 'String (único)',
      growthDays: 'Number (>0, dias até colheita)',
      waterNeed: 'Number (>0, litros/dia)',
      yieldPerCycle: 'Number (>0, unidades produzidas)',
      status: "Enum ('ATIVO' | 'DESCONTINUADO')"
    },
    samples: [
      ['C-01', 'Milho', 45, 12, 220, 'ATIVO'],
      ['C-02', 'Feijão', 35, 10, 160, 'ATIVO']
    ]
  },
  Plantios: {
    headers: ['plantingId', 'playerId', 'cropId', 'quantity', 'waterUsed', 'plantedAt', 'harvestDate', 'harvestedAt', 'status', 'notes'],
    description: 'Plantios persistidos e vinculados ao jogador',
    columnTypes: {
      plantingId: 'String (PK)',
      playerId: 'String (FK -> Jogadores.playerId)',
      cropId: 'String (FK -> Culturas.cropId)',
      quantity: 'Number (>0)',
      waterUsed: 'Number (>=0)',
      plantedAt: 'Date',
      harvestDate: 'Date',
      harvestedAt: 'Date | null',
      status: "Enum ('ATIVO' | 'COLHIDO')",
      notes: 'String | null'
    },
    samples: []
  },
  Mercado: {
    headers: ['transactionId', 'playerId', 'cropId', 'quantity', 'priceUnit', 'totalPrice', 'transactionDate', 'type'],
    description: 'Registro de transações comerciais entre jogadores',
    columnTypes: {
      transactionId: 'String (PK, formato T-XXX)',
      playerId: 'String (FK -> Jogadores.playerId)',
      cropId: 'String (FK -> Culturas.cropId)',
      quantity: 'Number (>0)',
      priceUnit: 'Number (>0)',
      totalPrice: 'Number (>0)',
      transactionDate: 'Date',
      type: "Enum ('COMPRA' | 'VENDA')"
    },
    samples: [
      ['T-001', 'P-100', 'C-01', 20, 12.5, 250, new Date(2026, 7, 3, 14, 45), 'COMPRA'],
      ['T-002', 'P-101', 'C-02', 15, 9.0, 135, new Date(2026, 7, 4, 10, 5), 'VENDA']
    ]
  },
  Ranking: {
    headers: ['rank', 'playerId', 'playerName', 'score', 'sustainabilityScore', 'lastUpdated'],
    description: 'Classificação de jogadores por desempenho e sustentabilidade',
    columnTypes: {
      rank: 'Number (>0, posição no ranking)',
      playerId: 'String (FK -> Jogadores.playerId)',
      playerName: 'String',
      score: 'Number (>=0, pontuação geral)',
      sustainabilityScore: 'Number (0-100)',
      lastUpdated: 'Date'
    },
    samples: [
      [1, 'P-100', 'Ana Silva', 980, 85, new Date(2026, 7, 8, 12, 0)],
      [2, 'P-101', 'Bruno Lima', 870, 72, new Date(2026, 7, 8, 12, 0)]
    ]
  },
  LogAuditoria: {
    headers: ['timestamp', 'eventType', 'payload', 'userId', 'username', 'source'],
    description: 'Log de auditoria para rastreabilidade de ações no sistema',
    columnTypes: {
      timestamp: 'Date (PK)',
      eventType: 'String (tipo de evento)',
      payload: 'String (JSON com detalhes)',
      userId: 'String (FK -> Usuarios.userId) | null',
      username: 'String | null',
      source: "Enum ('Web' | 'Admin' | 'API')"
    },
    samples: [
      [new Date(2026, 7, 8, 8, 0), 'LOGIN', '{"success":true}', 'U-001', 'admin', 'Web'],
      [new Date(2026, 7, 8, 8, 05), 'PLAYER_CREATED', '{"playerId":"P-100"}', 'U-002', 'professor', 'Admin']
    ]
  },
  Eventos: {
    headers: ['eventId', 'round', 'eventType', 'title', 'description', 'impact', 'affectedPlayers', 'createdAt'],
    description: 'Eventos produzidos pelas rodadas e condições do jogo',
    columnTypes: {
      eventId: 'String (PK, formato E-XXX)',
      round: 'Number (>=0)',
      eventType: 'String',
      title: 'String',
      description: 'String',
      impact: 'String',
      affectedPlayers: 'String | null',
      createdAt: 'Date'
    },
    samples: []
  },
  HistoricoRodadas: {
    headers: ['historyId', 'round', 'playerId', 'villageId', 'action', 'outcome', 'metricsJson', 'createdAt'],
    description: 'Decisões, resultados e reflexões de cada rodada investigativa',
    columnTypes: {
      historyId: 'String (PK)',
      round: 'Number (>=0)',
      playerId: 'String (FK -> Jogadores.playerId)',
      villageId: 'String (FK -> Vilas.villageId)',
      action: 'String',
      outcome: 'String',
      metricsJson: 'String (JSON sem dados pessoais)',
      createdAt: 'Date'
    },
    samples: []
  },
  Notificacoes: {
    headers: ['notificationId', 'playerId', 'villageId', 'type', 'priority', 'title', 'message', 'read', 'createdAt'],
    description: 'Feedback persistente para retomada do jogador',
    columnTypes: {
      notificationId: 'String (PK)',
      playerId: 'String (FK -> Jogadores.playerId)',
      villageId: 'String (FK -> Vilas.villageId) | null',
      type: 'String',
      priority: 'Number (1-4)',
      title: 'String',
      message: 'String',
      read: 'Boolean',
      createdAt: 'Date'
    },
    samples: []
  }
};

SchemaService.getSyntheticFallbackValue = function(header, type, rowNumber) {
  var normalizedType = (type || '').toString().toUpperCase();
  var fallbackIndex = rowNumber + 1;

  if (normalizedType.indexOf('DATE') !== -1) {
    return new Date(2026, 7, Math.min(28, 1 + rowNumber));
  }

  if (normalizedType.indexOf('NUMBER') !== -1) {
    return fallbackIndex * 10;
  }

  var enumMatch = normalizedType.match(/\('([^']+)'(?:\s*\|\s*'([^']+)')*\)/);
  if (enumMatch) {
    var values = normalizedType.replace(/\(/g, '').replace(/\)/g, '').split('|').map(function(value) {
      return value.replace(/['\s]/g, '');
    }).filter(Boolean);
    if (values.length > 0) {
      return values[rowNumber % values.length] || values[0];
    }
  }

  if (/id$/i.test(header)) {
    var prefix = header.charAt(0).toUpperCase();
    switch (header.toLowerCase()) {
      case 'userid': return 'U-' + (100 + fallbackIndex);
      case 'playerid': return 'P-' + (100 + fallbackIndex);
      case 'villageid': return 'V-' + (10 + fallbackIndex);
      case 'cropid': return 'C-' + (10 + fallbackIndex);
      case 'transactionid': return 'T-' + (100 + fallbackIndex);
      case 'eventid': return 'E-' + (100 + fallbackIndex);
      default: return prefix + '-' + (100 + fallbackIndex);
    }
  }

  if (/email/i.test(header)) {
    return 'user' + fallbackIndex + '@lago-paranoa.edu.br';
  }

  if (/name/i.test(header)) {
    return header === 'playerName' ? 'Jogador ' + fallbackIndex : 'Nome ' + fallbackIndex;
  }

  if (/status/i.test(header)) {
    return normalizedType.indexOf('INATIVO') !== -1 ? (rowNumber % 2 === 0 ? 'ATIVO' : 'INATIVO') : (rowNumber % 2 === 0 ? 'ATIVO' : 'SUSPENSO');
  }

  return 'Valor ' + fallbackIndex;
};

SchemaService.buildSchema = function() {
  try {
    Object.keys(SchemaService.SCHEMA).forEach(function(sheetName) {
      var schema = SchemaService.SCHEMA[sheetName];
      var sheet = SheetManager.createSheet(sheetName, schema.headers);

      if (!sheet) {
        throw new Error('Não foi possível criar ou obter aba: ' + sheetName);
      }

      var width = sheet.getLastColumn();
      var currentHeaders = width > 0
        ? sheet.getRange(1, 1, 1, width).getValues()[0].map(function(value) {
            return String(value || '').trim();
          })
        : [];
      var missingHeaders = schema.headers.filter(function(header) {
        return currentHeaders.indexOf(header) === -1;
      });

      if (missingHeaders.length) {
        sheet.getRange(1, currentHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
      }
      sheet.getRange(1, 1, 1, currentHeaders.length + missingHeaders.length).setFontWeight('bold');
    });

    return true;
  } catch (error) {
    ErrorHandler.logError('SchemaService.buildSchema', error);
    return false;
  }
};

SchemaService.seedSyntheticData = function() {
  try {
    SchemaService.buildSchema();

    Object.keys(SchemaService.SCHEMA).forEach(function(sheetName) {
      var schema = SchemaService.SCHEMA[sheetName];
      var sheet = Config.getSheet(sheetName);
      var existingCount = Math.max(0, sheet.getLastRow() - 1);
      var requiredCount = Math.max(0, 2 - existingCount);
      var sampleStart = existingCount;

      for (var i = 0; i < requiredCount; i++) {
        var sampleRow = (schema.samples && schema.samples[sampleStart + i]) || null;
        var rowData;

        if (sampleRow && sampleRow.length >= schema.headers.length) {
          rowData = sampleRow;
        } else {
          rowData = schema.headers.map(function(header, headerIndex) {
            var sampleValue = sampleRow ? sampleRow[headerIndex] : undefined;
            if (sampleValue !== undefined && sampleValue !== null && sampleValue !== '') {
              return sampleValue;
            }
            return SchemaService.getSyntheticFallbackValue(header, schema.columnTypes && schema.columnTypes[header], i);
          });
        }

        sheet.appendRow(rowData);
      }
    });

    return true;
  } catch (error) {
    ErrorHandler.logError('SchemaService.seedSyntheticData', error);
    return false;
  }
};

SchemaService.getSchemaDefinition = function() {
  return JSON.parse(JSON.stringify(SchemaService.SCHEMA));
};

/**
 * Função de teste para criar o esquema completo e semear dados sintéticos.
 */
function testSchemaService() {
  Logger.log('=== Testando SchemaService.buildSchema ===');
  var built = SchemaService.buildSchema();
  Logger.log('buildSchema: ' + built);

  Logger.log('=== Testando SchemaService.seedSyntheticData ===');
  var seeded = SchemaService.seedSyntheticData();
  Logger.log('seedSyntheticData: ' + seeded);
}
