# 🌊 Lago Paranoá - Jogo Educacional de Gestão de Recursos Hídricos

Arquivos e configuração do Google Drive: [DRIVE_ASSETS.md](DRIVE_ASSETS.md).
Direção artística compartilhada: [prompts_imagens.md](../../prompts_imagens.md).

<div align="center">

![Status](https://img.shields.io/badge/Status-Conclu%C3%ADdo%20localmente-brightgreen)
![Versão](https://img.shields.io/badge/Vers%C3%A3o-1.0-blue)
![Licença](https://img.shields.io/badge/Licen%C3%A7a-CC%20BY--NC--SA%204.0-orange)
![Plataforma](https://img.shields.io/badge/Plataforma-Google%20Apps%20Script-red)

**Um jogo educacional que ensina sustentabilidade através da experiência**

[📖 Documentação](DOCUMENTACAO_COMPLETA.md) | [✅ Conclusão local](CONCLUSAO_LOCAL_2026-09-02.md) | [🤝 Contribuir](#contribuindo)

</div>

## Status de Implementação

O contrato local passa em 67 testes. Todas as rotas servem páginas completas,
eventos e histórico usam registros reais e o centro operacional reúne os
módulos secundários com dados autenticados. A régua local encontra zero
placeholder e zero skeleton. Deployment, planilha e smoke test no Web App ainda
precisam ser comprovados antes do uso em sala.

---

## 📖 O que é?

**Lago Paranoá** é um jogo de simulação educacional que coloca estudantes no papel de agricultores gerenciando recursos hídricos limitados. Baseado na realidade do Lago Paranoá em Brasília-DF, o jogo ensina conceitos de sustentabilidade, economia ambiental e pensamento sistêmico através de dilemas reais.

### 🎯 Principais Características

- 🌦️ **Simulação Climática Didática**: Cenários sazonais para comparar hipóteses
- 💧 **Balanço Hídrico Simplificado**: Relações explícitas, com parâmetros ainda sujeitos a revisão
- 🌾 **Sistema Agrícola Complexo**: Culturas com características diferenciadas
- 💰 **Economia Dinâmica**: Mercado com oferta e demanda variável
- 👥 **Dilema Social**: Implementação do "Tragedy of the Commons"
- 📊 **Visualizações Interativas**: Gráficos e mapas para análise

---

## 🎓 Para Educadores

### Por que usar este jogo?

✅ **Engajamento**: Alunos aprendem fazendo, não apenas ouvindo  
✅ **Interdisciplinar**: Integra Ciências, Matemática, Geografia, Economia  
✅ **Contextualizado**: Baseado em realidade brasileira (Lago Paranoá)  
✅ **Didático e contextualizado**: Usa modelos simplificados para explorar relações entre água, clima e decisões  
✅ **Gratuito**: Sem custos de licença para uso educacional  
✅ **Acessível**: Roda no navegador, sem instalação  

### Disciplinas e Competências

| Disciplina | Conceitos Trabalhados |
|------------|----------------------|
| **Ciências/Biologia** | Ciclo da água, ecossistemas, agricultura |
| **Geografia** | Hidrografia, clima, uso do solo |
| **Matemática** | Probabilidade, gráficos, modelagem |
| **Economia** | Oferta/demanda, recursos naturais, externalidades |
| **Sociologia** | Dilemas coletivos, cooperação, governança |

**Competências BNCC**: Pensamento científico ✓ | Responsabilidade e cidadania ✓ | Argumentação ✓

---

## 🚀 Como Começar

### Para Alunos

1. **Acesse o jogo** (link fornecido pelo professor)
2. **Crie sua conta** com username e senha
3. **Entre em uma vila** com seus colegas de equipe
4. **Complete o tutorial** para aprender as mecânicas
5. **Jogue!** Tome decisões e veja os resultados

### Para Professores

1. **Solicite acesso administrativo**
2. **Configure sua turma** no painel admin
3. **Crie vilas** e distribua alunos
4. **Acompanhe em tempo real** o progresso
5. **Facilite discussões** entre rodadas

O guia completo para educadores ainda será elaborado após o primeiro piloto.

---

## 🎮 Como Funciona?

### Ciclo de Jogo

```
1️⃣ PLANEJAMENTO
   Escolha culturas para plantar
   Decida quantidade de água a usar
   
2️⃣ RODADA
   Clima é simulado
   Aquífero é atualizado
   Culturas crescem e produzem
   
3️⃣ RESULTADOS
   Calcule seu lucro
   Veja impacto no aquífero
   Compare com outros jogadores
   
4️⃣ REFLEXÃO
   Analise suas decisões
   Ajuste estratégia
   Coopere com equipe
```

Desde 15/08/2026, a tela de culturas implementa esse ciclo como contrato verificável: exige previsão antes da rodada, mostra indicadores observáveis, exige explicação e próximo teste, persiste a evidência e retoma revisões pendentes após recarga. Uma nova decisão fica bloqueada até o fechamento da anterior.

### Mecânicas Principais

- **Aquífero Compartilhado**: Todos na vila usam a mesma fonte de água
- **Clima Variável**: Anos secos e úmidos afetam produção
- **Economia Dinâmica**: Preços mudam conforme oferta total
- **Construções**: Invista em infraestrutura para vantagens
- **Sustentabilidade**: Equilibre lucro com preservação ambiental

---

## 🏗️ Arquitetura Técnica

### Stack Tecnológico

- **Backend**: Google Apps Script (JavaScript)
- **Database**: Google Sheets
- **Frontend**: HTML5, CSS3, JavaScript Vanilla
- **Gráficos**: Chart.js
- **Mapas**: Leaflet.js / Google Maps API

### Estrutura do Projeto

```
/Lago_Paranoa
├── *.gs              # Backend (Google Apps Script)
├── *.html            # Frontend (páginas)
├── game.txt          # Especificação completa (2000 linhas)
├── DOCUMENTACAO_COMPLETA.md    # Documentação técnica
├── RESUMO_EXECUTIVO.md         # Visão geral
├── INDICE_COMPONENTES.md       # Índice de arquivos
└── README.md         # Este arquivo
```

[🔧 Ver Documentação Técnica Completa](DOCUMENTACAO_COMPLETA.md)

---

## 📊 Modelo Didático

### 🌦️ Modelo Climático
**Cenário sazonal simplificado** (seco/úmido)
- Estimativas separadas das medições persistidas
- Permite comparar hipóteses de recarga e extração
- Não constitui previsão meteorológica oficial

### 💧 Modelo Hidrológico
**Equação de balanço hídrico**
```
ΔH = R_precipitação - E_extração
```
- Recarga natural por chuva
- Extração por todos os jogadores
- Limites físicos realistas

### 🌾 Modelo Agrícola
**Função de produção**
```
Rendimento = f(água, clima, solo)
```
- Culturas com características distintas
- Rendimento não-linear com água
- Sensibilidade climática

---

## ⚠️ Limite do modelo

Os parâmetros e equações têm finalidade didática; não são previsão
hidrológica, recomendação agrícola nem evidência de aprendizagem. Antes do
piloto, cada fonte, unidade e hipótese usada na experiência deve ser registrada
e revisada por um responsável docente.

---

## 📈 Evidência disponível

- 67 testes Node locais aprovados, cobrindo autenticação, contratos frontend/backend, rotas completas, rodada determinística, persistência, revisão, retomada, schema e gates;
- score médio local de 74,4%, com zero arquivo `PLACEHOLDER` ou `SKELETON`;
- verificação estrutural local disponível por `python project_maturity.py .`;
- implantação, permissões da planilha e compreensão por estudantes ainda exigem smoke test e piloto acompanhado.

Não há, neste repositório, evidência verificável para declarar resultados quantitativos de aprendizagem, engajamento ou adoção escolar. Esses indicadores só devem ser publicados após protocolo de avaliação, consentimento e registro da fonte.

---

## 🤝 Contribuindo

Este é um projeto **open source educacional**. Contribuições são muito bem-vindas!

### Como Contribuir

1. **🐛 Reporte Bugs**: Abra uma issue descrevendo o problema
2. **💡 Sugira Melhorias**: Compartilhe ideias no fórum
3. **💻 Contribua com Código**: Fork, desenvolva, envie PR
4. **📚 Crie Conteúdo**: Materiais didáticos, tutoriais, traduções
5. **🧪 Teste**: Use em sala e compartilhe feedback

### Áreas que Precisam de Ajuda

- [ ] Tutorial interativo mais envolvente
- [ ] Otimização para mobile
- [ ] Tradução para outros idiomas
- [ ] Mais cenários (outras regiões do Brasil)
- [ ] Integração com plataformas LMS

[👉 Ver Issues Abertas](https://github.com/lago-paranoa/issues)

---

## 📄 Licença

Este projeto está sob a licença **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)**.

### O que você pode fazer:

✅ **Usar** em contextos educacionais  
✅ **Modificar** e adaptar para suas necessidades  
✅ **Compartilhar** com outros educadores  

### Condições:

- 📝 **Atribuição**: Dê crédito aos criadores originais
- 🚫 **Não Comercial**: Não use para fins lucrativos
- 🔄 **Compartilhe Igual**: Distribua modificações com mesma licença

Licença declarada: Creative Commons BY-NC-SA 4.0. O arquivo jurídico completo
ainda deve ser incorporado antes de distribuição externa.

---

## 📞 Contato e Suporte

### Canais Oficiais

- 🌐 **Site**: [lagoparanoa-game.edu.br](#)
- 📧 **Email**: contato@lagoparanoa-game.edu.br
- 💬 **Discord**: [Comunidade de Educadores](#)
- 🐙 **GitHub**: [github.com/lago-paranoa-game](#)
- 📱 **WhatsApp**: Grupo de Professores

### Suporte Técnico

- 📖 **Documentação**: [DOCUMENTACAO_COMPLETA.md](DOCUMENTACAO_COMPLETA.md)
- ❓ **FAQ**: [Perguntas Frequentes](#)
- 🎥 **Tutoriais**: [Canal no YouTube](#)
- 🐛 **Bugs**: [Abrir Issue](https://github.com/lago-paranoa/issues)

---

## 🏆 Reconhecimentos

### Créditos

- **Desenvolvimento**: Manus AI
- **Consultoria Pedagógica**: Escola Classe 115 Norte
- **Consultoria Hidrológica**: UnB - Departamento de Engenharia Civil
- **Consultoria Agrícola**: EMATER-DF
- **Design**: [Nome]

### Inspirações e Referências

- Trabalhos de Elinor Ostrom sobre gestão de recursos comuns
- Modelos climáticos de Gabriel & Neumann
- Literatura de Game-Based Learning
- Realidade do Lago Paranoá (Brasília-DF)

### Agradecimentos

Agradecemos a todos os professores, alunos e pesquisadores que contribuíram para tornar este projeto realidade. Em especial:
- Secretaria de Educação do DF
- Comitê de Bacia do Lago Paranoá
- CAESB e ADASA
- Comunidade de desenvolvedores open source

---

## 🗺️ Roadmap

### ✅ v1.0 - MVP (Atual)
- Sistema core funcional
- 3 culturas básicas
- Simulação climática e hidrológica
- Interface principal

### 🔄 v1.1 - Melhorias (Q3 2026)
- Tutorial interativo guiado
- 5 tipos de construções
- Sistema de conquistas
- Otimização mobile

### 🔮 v2.0 - Expansão (Q4 2026)
- Múltiplos cenários (Pantanal, Amazônia, Semiárido)
- Editor de cenários para professores
- Dashboard avançado para educadores
- Modo multiplayer síncrono

### 🚀 v3.0 - Ecossistema (2027)
- Integração com LMS (Moodle, Google Classroom)
- API pública para pesquisadores
- Aplicativo mobile nativo
- Competições nacionais escolares

---

## 📚 Documentação Adicional

- [📘 Documentação Técnica Completa](DOCUMENTACAO_COMPLETA.md)
- [📄 Resumo Executivo](RESUMO_EXECUTIVO.md)
- [📑 Índice de Componentes](INDICE_COMPONENTES.md)
- [📝 Especificação consolidada](DOCUMENTACAO_COMPLETA.md)
- [Workflow de homologação e piloto](WORKFLOW_BASICO.md)
- [Cartão do modelo didático](MODELO_DIDATICO.md)
- [Protocolo de piloto controlado](PILOTO_CONTROLADO.md)
- Guia do Professor *(pendente após o piloto)*
- Planos de Aula *(pendentes após o piloto)*

---

<div align="center">

**Feito com 💚 para a educação ambiental brasileira**

[⭐ Star no GitHub](#) | [🍴 Fork](#) | [📢 Compartilhe](#)

---

*Lago Paranoá - Onde cada decisão conta para o futuro da água*

</div>

---

**Navegação da Frota:** [Voltar ao README Principal](../README.md)
