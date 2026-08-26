🚨 NON NEGOTIABLE RULES (LEIS INQUEBRÁVEIS)
ARQUITETURA
Toda entidade DEVE conter: tenant_id, created_at, created_by
Sistema é obrigatoriamente multi-tenant
RLS deve estar ativo em 100% das queries
IDs devem ser UUID (proibido sequencial)
BACKEND vs FRONTEND
Frontend NÃO contém lógica de negócio
UI NÃO acessa dados diretamente
Fluxo obrigatório: UI → Service → Repository → DB
PERMISSÕES
Sistema opera em deny-by-default
Toda ação deve validar permissão no backend
Frontend apenas reflete permissões
EVENTOS E LOGS
Toda ação DEVE gerar log
Toda ação DEVE gerar evento (entity.action)
Nenhuma ação ocorre sem rastreabilidade
API
Toda funcionalidade DEVE estar disponível via API
API-first é obrigatório
MÓDULOS
Todo módulo segue estrutura: domain / service / repository / permissions / events / ui
Módulos NÃO podem ser acoplados diretamente
STATE MACHINE
Toda entidade com ciclo de vida DEVE ter state machine
Transições inválidas devem ser bloqueadas
SEGURANÇA
Rate limiting obrigatório
Dados sensíveis NÃO podem ser armazenados em texto puro
Soft delete obrigatório
REGRA FINAL
Se qualquer regra acima for violada → IMPLEMENTAÇÃO INVÁLIDA