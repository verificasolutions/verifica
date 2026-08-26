11 MODULE TEMPLATE

MODULE TEMPLATE
Todo módulo do sistema deve seguir esta estrutura obrigatória.

Estrutura
domain/
service/
repository/
permissions/
events/
ui/
Descrição
domain/
Regras de negócio puras

service/
Orquestração de regras e fluxos

repository/
Acesso a dados

permissions/
Controle de acesso

events/
Eventos emitidos pelo módulo

ui/
Interface do usuário

Regras
Nenhuma lógica no frontend
Toda ação gera evento
Toda operação respeita permissões
Código deve ser modular e isolado
Objetivo
Garantir padronização, escalabilidade e consistência