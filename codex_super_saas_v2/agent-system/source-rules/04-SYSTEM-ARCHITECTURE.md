Módulo 3: Core — Control Plane (FINAL CORRIGIDO) Este módulo garante que o sistema se adapte a qualquer estrutura organizacional do mundo, sem necessidade de alteração de código. Nada neste módulo é opcional.

🧱 3.1 Hierarquia Organizacional (Grafo Estruturado) O sistema deve representar a estrutura organizacional de forma flexível e escalável.

✔ Modelo obrigatório Toda estrutura organizacional deve suportar os seguintes níveis: • Organização (tenant) • Órgãos / Diretorias • Departamentos • Unidades / Setores • Usuários

✔ Estrutura técnica obrigatória • A base de dados deve ser um grafo (nodes + relações) • A interface deve representar os dados como árvore (estrutura visual)

✔ Regras obrigatórias • Um usuário pode pertencer a múltiplos nós simultaneamente • Um nó pode possuir múltiplos relacionamentos (não hierárquicos) • Não é permitido duplicar entidades para simular múltiplos vínculos

✔ Controle de visibilidade • O sistema deve suportar estruturas: o públicas (visíveis para todos os membros do tenant) o privadas (visíveis apenas para usuários autorizados)

✔ Objetivo • Suportar qualquer organograma existente • Evitar refatorações estruturais futuras • Permitir compartilhamento entre áreas

🚦 3.2 Feature Flags (Controle de Ativação) Funcionalidades do sistema devem ser controladas dinamicamente, sem necessidade de deploy.

✔ Regra obrigatória Toda funcionalidade relevante deve poder ser controlada por feature flag.

✔ Escopos obrigatórios de controle • Por tenant • Por usuário • Por nó organizacional • Por ambiente (ex: produção, staging)

✔ Recursos obrigatórios • Rollout progressivo (ex: ativação por percentual de usuários) • Ativação parcial por grupos específicos • Ativação baseada em plano/comercial (ex: features pagas)

✔ Regras de segurança • Feature flag nunca pode ser controlada exclusivamente pelo frontend • O backend é a fonte de verdade da ativação

✔ Objetivo • Permitir testes sem risco • Liberar funcionalidades sem impacto global • Controlar acesso a features por plano ou estratégia

🕵️ 3.3 Impersonation com Auditoria (Acesso Assistido) O sistema deve permitir acesso controlado para suporte e diagnóstico.

✔ Regra obrigatória Toda ação realizada em modo impersonation deve ser auditada.

✔ Comportamento obrigatório • Deve existir indicação visual persistente (banner) informando que o modo está ativo • O usuário alvo deve ser claramente identificado durante toda a sessão • O modo deve ser explicitamente ativado e encerrado

✔ Auditoria obrigatória Todos os logs devem registrar: • Usuário administrador (quem iniciou) • Usuário alvo (quem está sendo representado) • Ação executada • Data e hora Formato esperado: admin_user executou ação X como target_user

✔ Restrições • Impersonation não pode ignorar permissões do sistema • Todas as regras de segurança continuam válidas

✔ Objetivo • Permitir suporte eficiente • Garantir rastreabilidade total • Evitar abuso de acesso

🔍 3.4 Command Center (Busca + Navegação + Ação) O sistema deve possuir um ponto único para execução de ações e navegação.

✔ Regra obrigatória O Command Center deve permitir: • Buscar entidades • Navegar entre recursos • Executar ações diretamente

✔ Comportamento obrigatório • Abertura via atalho global (ex: Ctrl + K ou equivalente) • Retorno unificado contendo: o resultados de busca o ações disponíveis o atalhos relevantes

✔ Funcionalidades obrigatórias • Execução de ações sem necessidade de navegação prévia • Suporte completo a uso por teclado • Sugestões baseadas em contexto e uso do usuário

✔ Regras técnicas • Resultados devem respeitar permissões do usuário • Nenhuma ação pode ser executada sem validação no backend

✔ Objetivo • Reduzir tempo de navegação • Aumentar produtividade • Centralizar interação do usuário

🏁 DEFINIÇÃO DE PRONTO (DoP) — Módulo 3 Este módulo é considerado concluído apenas quando TODAS as condições abaixo são atendidas:

Estrutura Organizacional Completa • Sistema suporta qualquer organograma sem alteração de código • Estrutura baseada em grafo está implementada • Interface em árvore reflete corretamente os dados
Relacionamentos Flexíveis • Usuários podem pertencer a múltiplos nós • Não existe duplicação de entidades para contornar limitações
Controle de Funcionalidades • Todas as features relevantes possuem feature flag • Controle por tenant, usuário, nó e ambiente está ativo • Backend é responsável por toda decisão
Segurança em Suporte • Impersonation possui auditoria completa • Banner visível está ativo durante o uso • Nenhuma ação ocorre sem rastreabilidade
Produtividade Operacional • Command Center permite buscar, navegar e executar ações • Interface responde em tempo real • Uso por teclado é totalmente suportado
Consistência com o Sistema • Todas as regras respeitam permissões (Módulo 1) • Todas as ações continuam auditáveis • Nenhuma funcionalidade viola isolamento por tenant
✅ RESULTADO FINAL Este módulo garante que o sistema seja: • Adaptável a qualquer empresa • Controlável em tempo real • Seguro em operações críticas • Extremamente eficiente para o usuário

