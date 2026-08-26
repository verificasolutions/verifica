Módulo 4: Módulos — Module Contract (FINAL CORRIGIDO E BLINDADO) Este módulo define o padrão obrigatório para construção de qualquer funcionalidade dentro do sistema. Todo módulo deve seguir exatamente este contrato, sem exceções. O objetivo é garantir consistência, segurança, escalabilidade e previsibilidade. Nada neste módulo é opcional.

🧱 4.1 Estrutura de Módulo (Arquitetura Obrigatória) Todo módulo DEVE seguir a mesma estrutura de organização.

✔ Estrutura obrigatória Cada módulo deve conter: • domain/ → definições de negócio (entidades, regras, estados) • service/ → lógica de aplicação (processamento, validações, execução) • repository/ → acesso a dados (persistência, queries) • permissions/ → definição de permissões do módulo • events/ → definição de eventos emitidos pelo módulo • ui/ → interface do usuário (componentes, telas)

✔ Regras obrigatórias • Nenhum código pode existir fora dessa estrutura • Cada camada possui responsabilidade única • É proibido misturar responsabilidades entre camadas

✔ Objetivo • Padronizar desenvolvimento • Facilitar manutenção • Permitir previsibilidade entre módulos

🚫 4.2 Leis Capitais (Regras Invioláveis) Estas regras se aplicam a todos os módulos, sem exceção.

❌ 1. UI não acessa dados diretamente • A interface nunca acessa banco de dados ou APIs diretamente • Fluxo obrigatório: UI → Service → Repository → Banco

❌ 2. Lógica de negócio não existe no frontend • Nenhuma regra crítica pode rodar no cliente (browser) • Todo cálculo, validação e decisão ocorre no backend

❌ 3. Nenhuma ação sem auditoria Toda ação DEVE registrar obrigatoriamente: • quem executou • o que foi executado • quando foi executado Se não houver log, a ação não pode ser concluída.

❌ 4. Nenhuma ação sem evento Toda mudança relevante DEVE gerar evento seguindo padrão: • entity.action Exemplos: • invoice.created • contract.signed • user.updated

✔ Regras complementares obrigatórias • Todos os eventos devem ser disparados pelo backend • Todos os logs devem respeitar o escopo de tenant (Módulo 1) • Nenhuma ação pode ignorar permissões (Módulo 1)

✔ Objetivo • Garantir rastreabilidade total • Permitir automação e integrações • Evitar inconsistências

🔄 4.3 State Machine (Controle de Estados Obrigatório) Toda entidade que possui ciclo de vida DEVE implementar máquina de estados.

✔ Regra obrigatória Nenhuma entidade pode mudar de estado sem seguir transições válidas.

✔ Estrutura obrigatória Cada entidade deve definir: • Estados possíveis • Transições permitidas • Ações associadas a cada transição

✔ Exemplo padrão • draft → active → suspended → canceled

✔ Regras obrigatórias • Transições inválidas devem ser bloqueadas pelo sistema • Mudanças de estado devem gerar: o log o evento • Não é permitido “pular estados”

✔ Objetivo • Evitar inconsistências • Garantir integridade de processos • Guiar o usuário dentro de fluxos válidos

🛡️ 4.4 Autonomia de Módulo (Isolamento Operacional) Cada módulo deve funcionar de forma independente.

✔ Regra obrigatória A falha de um módulo não pode impactar outros módulos.

✔ Regras técnicas obrigatórias • Comunicação entre módulos deve ocorrer via eventos (event-driven) • Não é permitido acoplamento direto entre módulos • Dependências devem ser mínimas e controladas

✔ Comportamento esperado • Um módulo pode ser desativado sem quebrar o sistema • Funcionalidades continuam operando mesmo com falhas isoladas

✔ Objetivo • Permitir arquitetura plug & play • Viabilizar venda de módulos (add-ons) • Garantir resiliência do sistema

🧩 4.5 Contrato de Consistência (Integração com o Sistema) Todo módulo deve respeitar integralmente os módulos anteriores.

✔ Regras obrigatórias • Todas as entidades devem conter: o tenant_id, created_at, created_by (Módulo 1) • Todas as ações devem: o respeitar permissões (Módulo 1) o gerar eventos (Módulo 1) • Todas as interfaces devem: o respeitar Design System (Módulo 1) • Todas as ações devem ser: o acessíveis via API (Módulo 1 — API-First)

✔ Objetivo • Garantir padronização global • Evitar desvios de arquitetura • Manter coerência entre módulos

🏁 DEFINIÇÃO DE PRONTO (DoP) — Módulo 4 Este módulo é considerado concluído apenas quando TODAS as condições abaixo são atendidas:

Estrutura Padronizada • Todos os módulos seguem exatamente a mesma estrutura de pastas • Não existe código fora do padrão definido
Separação de Responsabilidades • UI, Service e Repository estão claramente separados • Nenhuma camada executa função indevida
Rastreabilidade Total • Todas as ações geram log • Todas as ações geram evento • Todos os registros possuem autoria e timestamp
Controle de Estados • Entidades possuem state machine implementada • Transições inválidas são bloqueadas • Mudanças de estado são auditadas
Isolamento de Módulos • Módulos funcionam de forma independente • Falhas não se propagam entre módulos
Consistência Global • Todas as regras do Módulo 1 são respeitadas • Arquitetura segue padrão event-driven • API expõe todas as funcionalidades
✅ RESULTADO FINAL Este módulo garante que o sistema seja: • Padronizado em escala • Seguro por construção • Fácil de manter e evoluir • Resiliente e desacoplado