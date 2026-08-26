Módulo 2: Fundação — Engineering Contract 2.0 (FINAL CORRIGIDO) Este é o DNA do sistema. Ele garante isolamento total de dados, segurança estrutural e capacidade de escalar de 1 para 10.000 clientes sem refatoração. Nada neste módulo é opcional.

🔐 2.1 Isolamento de Dados (Multi-Tenant Absoluto) O sistema deve ser incapaz de executar qualquer operação sem um tenant definido. ✔ Regras obrigatórias Toda tabela do banco de dados DEVE conter obrigatoriamente: • tenant_id • created_at • created_by Sem exceções.

✔ Segurança de acesso (RLS) • Row Level Security (RLS) deve estar ativo em 100% das queries • Nenhuma query pode ser executada sem filtro de tenant_id • O banco de dados é responsável por bloquear acessos indevidos, independentemente da aplicação

✔ Identificadores • É proibido uso de IDs sequenciais (1, 2, 3…) • Deve-se utilizar UUID v7 em todas as entidades • Objetivo: impedir enumeração e acesso indevido por tentativa

✔ Objetivo • Impedir vazamento de dados entre clientes • Garantir segurança estrutural • Permitir escala sem refatoração

🔑 2.2 Permission-First Architecture (Controle de Acesso) O sistema não valida “quem é o usuário”, mas sim “o que ele pode fazer”.

✔ Regras obrigatórias • Toda decisão de permissão ocorre no backend • O frontend nunca toma decisões de acesso, apenas reflete o estado retornado

✔ Estrutura padrão de permissões (obrigatória) Toda entidade deve seguir o padrão base: • can_read • can_create • can_update • can_delete Permissões adicionais (ex: finance.read) são permitidas, mas não substituem o padrão base

✔ Política de segurança • Sistema opera com “negação por padrão” (deny by default) • Se uma permissão não for explicitamente definida, o acesso é automaticamente bloqueado

✔ Comportamento da interface • Elementos sem permissão não devem ser exibidos • O usuário nunca vê ações que não pode executar • O frontend apenas renderiza o que o backend autoriza

✔ Objetivo • Eliminar inconsistência entre backend e frontend • Reduzir falhas de segurança • Tornar o comportamento previsível

⚡ 2.3 Event-Driven Architecture (Sistema Orientado a Eventos) O sistema não apenas executa ações — ele registra e comunica eventos.

✔ Regra obrigatória Toda ação relevante DEVE gerar um evento.

✔ Padrão de nomenclatura (obrigatório) Todos os eventos devem seguir o formato: • entity.action Exemplos: • contract.created • invoice.paid • user.invited

✔ Processamento • O sistema principal não executa tarefas pesadas diretamente • Eventos são enviados para processamento assíncrono (background workers) • Exemplo: envio de e-mail, geração de documentos, integrações externas

✔ Benefícios obrigatórios • Eliminação de acoplamento entre módulos • Possibilidade de automações futuras • Preparação para integrações (IA, APIs externas, mensageria)

🎨 2.4 Design System Inteligente (Interface Padronizada) A interface não é apenas visual — ela segue regras estruturais.

✔ Regras obrigatórias Todos os componentes da interface devem possuir: • Estados definidos: o loading o erro o vazio o sucesso • Validação de permissão integrada • Feedback visual imediato para qualquer ação

✔ Comportamento • O frontend nunca contém lógica de negócio • Toda decisão vem do backend • A interface apenas reflete o estado do sistema

✔ Objetivo • Garantir consistência visual • Reduzir erros de implementação • Acelerar desenvolvimento

🔌 2.5 API-First & Headless (Base para Integração) O sistema deve ser construído com a API como núcleo central.

✔ Regra obrigatória Toda funcionalidade disponível no sistema DEVE estar disponível via API. O frontend é apenas o primeiro consumidor dessa API.

✔ Padrões obrigatórios API Keys (Self-Service) • Cada tenant pode gerar suas próprias chaves de acesso • As chaves possuem controle de uso e podem ser revogadas

Rate Limiting (obrigatório) • Toda API deve possuir limitação de uso por tenant • Objetivo: proteger infraestrutura e evitar abusos

Documentação automática • A API deve gerar documentação automaticamente (Swagger/OpenAPI) • A documentação deve estar sempre atualizada com o código

✔ Objetivo • Permitir integrações externas (ERP, CRM, RH, etc.) • Viabilizar automações pelos clientes • Preparar o sistema para expansão futura (mobile, integrações, IA)

🏁 DEFINIÇÃO DE PRONTO (DoP) — Módulo 2 Este módulo só é considerado concluído quando TODAS as regras abaixo são atendidas:

Segurança Invisível • Todo dado está protegido por tenant_id • RLS está ativo em 100% das operações • Não existe acesso fora do escopo do tenant
Controle Total de Acesso • Todas as ações passam pelo backend • Permissões seguem o padrão definido • Sistema opera com negação por padrão
Eventos Padronizados • Toda ação relevante gera evento • Eventos seguem o padrão entity.action • Processamento assíncrono está implementado
Interface Consistente • Componentes possuem estados definidos • Permissões são refletidas corretamente • Não existe lógica de negócio no frontend
API Completa • Todas as funcionalidades estão disponíveis via API • API possui autenticação por chave • Rate limiting está ativo por tenant • Documentação está gerada automaticamente
Escalabilidade Garantida • Sistema suporta múltiplos tenants sem alteração estrutural • Adicionar novos clientes não exige mudanças no código
✅ RESULTADO FINAL Este módulo garante que o sistema seja: • Seguro por padrão • Escalável por design • Consistente em qualquer cenário • Preparado para integrações e crescimento