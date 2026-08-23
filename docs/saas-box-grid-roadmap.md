# Roadmap Técnico: Operação em Boxes, Prova Operacional, Retenção e IA Social

## Objetivo
Implementar o novo modelo operacional do VERIFICWASH sem quebrar os fluxos já estáveis de:

- atendimento
- fila
- operador
- caixa
- agendamento
- WhatsApp
- acompanhamento público
- recuperador de clientes

O princípio é simples:

- nada será refeito de uma vez
- o modelo atual continua operando
- o novo modelo entra por camadas
- cada fase fecha banco, backend, tela e validação

## Regras do escopo

### Regras de compatibilidade
- manter `attendances.status` funcionando durante toda a transição
- introduzir `posição operacional` sem remover status antigo
- fazer migrations apenas aditivas nas fases iniciais
- toda operação crítica nova deve entrar por RPC atômica no banco
- toda tela nova deve nascer com modo isolado, sem substituir a atual de imediato
- toda permissão deve seguir RLS e funções já alinhadas ao SOS

### Regras de segurança
- nada sensível validado só no frontend
- gravação operacional só por backend/RPC
- multi-tenant estritamente isolado
- fotos, mensagens e eventos sempre vinculados ao `tenant_id`

### Regras de rollout
- fase nova entra com `feature flag`
- tenant pode permanecer no modo atual enquanto o novo modo é validado
- deploy só depois de build, revisão visual e validação operacional

## Estado atual preservado

### Já funcional hoje
- criação de atendimento
- fila operacional por status
- operador assume carro
- agendamento, confirmação, cancelamento e reagendamento
- caixa, despesas, diária e fechamento
- mensagens de entrada e pronto
- lembrete de retorno
- acompanhamento público

### O que muda
- o centro operacional deixa de ser apenas `status`
- o centro operacional passa a ser `box/posição`
- status continua existindo como derivação compatível

## Fase 1: Modelo de boxes e posição operacional

### Objetivo
Adicionar a estrutura de pátio real sem quebrar o fluxo atual.

### Banco
Criar tabela `operation_boxes`:

- `id`
- `tenant_id`
- `name`
- `code`
- `kind`
- `sort_order`
- `sla_minutes`
- `color_token`
- `is_active`
- `created_at`
- `updated_at`

Criar tabela `attendance_box_events`:

- `id`
- `tenant_id`
- `attendance_id`
- `from_box_id`
- `to_box_id`
- `moved_by`
- `moved_at`
- `note`

Adicionar colunas em `attendances`:

- `current_box_id`
- `queue_position`
- `extra_minutes`
- `operational_stage`
- `started_at`
- `ready_at`

Adicionar em `tenant_settings`:

- `operations_mode` (`classic` | `boxes`)
- `tv_mode_enabled`
- `require_ready_photo`
- `allow_step_photos`

### RPCs novas
- `create_operation_box_atomic`
- `update_operation_box_atomic`
- `reorder_operation_boxes_atomic`
- `move_attendance_to_box_atomic`
- `set_attendance_queue_position_atomic`

### Backend
- repositório de boxes
- repositório de eventos de box
- resolvedor de status legado a partir de box
- cálculo de SLA por box + `extra_minutes`

### Frontend
- tela de configuração de boxes no tenant
- CRUD de boxes
- ordem visual dos boxes
- definição de tipo:
  - `entry`
  - `wash`
  - `dry`
  - `finish`
  - `ready`

### Critério de aceite
- tenant consegue cadastrar boxes reais
- carro pode existir sem box no fluxo antigo
- carro pode ser movido para box sem quebrar caixa, operador ou acompanhamento

## Fase 2: Grid de Boxes do tenant

### Objetivo
Criar a nova visão operacional do pátio.

### Frontend
Nova tela do tenant:

- `Operação visual`
- grid responsivo conforme quantidade de boxes
- esteira lateral de entrada
- área separada para `prontos/retirada`
- modo `TV` com interface limpa e alto contraste

### Componentes novos
- `OperationYardGrid`
- `OperationEntryBelt`
- `OperationBoxCard`
- `VehiclePlateCard`
- `SlaFuelBar`
- `ServiceGlyph`
- `YardTvMode`

### Regras visuais
- placa no topo estilo Mercosul
- cor dominante baseada na cor do veículo
- ícone do tipo de serviço
- barra de SLA horizontal
- box inteiro pulsa quando SLA zera
- boxes vazios continuam visíveis como capacidade operacional

### Dados necessários
- box atual
- SLA previsto
- tempo restante
- placa
- modelo
- cor
- tipo de serviço
- operador responsável

### Critério de aceite
- tenant consegue olhar a tela e entender:
  - quem está esperando
  - qual box está ocupado
  - qual box travou
  - quais carros estão prontos

## Fase 3: Fluxo novo do operador

### Objetivo
Trocar a lógica de "mudar status" por "mover no pátio".

### Fluxo
- assumir carro
- levar para box de entrada ou lavagem
- mover para o próximo box
- registrar início/fim da etapa
- finalizar para retirada

### RPCs novas
- `claim_attendance_box_atomic`
- `start_box_step_atomic`
- `finish_box_step_atomic`
- `handoff_attendance_to_next_box_atomic`

### Regras
- operador só move carros permitidos
- operador só enxerga o necessário
- operador não mexe em caixa
- tenant escolhe se operador pode ver telefone do cliente

### Tela do operador
- fila de entrada
- meu box atual
- próximos movimentos sugeridos
- botão claro:
  - `Assumir`
  - `Entrar no box`
  - `Mover`
  - `Finalizar etapa`
  - `Pronto para retirada`

### Critério de aceite
- operador consegue trabalhar o dia inteiro sem depender da dashboard completa do tenant

## Fase 4: Fotos operacionais e prova de serviço

### Objetivo
Transformar a operação em evidência.

### Banco
Criar tabela `attendance_media`:

- `id`
- `tenant_id`
- `attendance_id`
- `box_id`
- `uploaded_by`
- `kind` (`entry` | `step` | `ready` | `damage_note` | `marketing`)
- `file_path`
- `caption`
- `created_at`

### Storage
Bucket por tenant com caminho padronizado:

- `tenant/{tenantId}/attendances/{attendanceId}/...`

### Backend
- upload seguro com vínculo ao tenant
- validação de tamanho e tipo
- associação da foto ao atendimento e box

### Frontend
- captura opcional na entrada
- captura por etapa
- captura final do carro pronto
- galeria no histórico do atendimento

### Regras
- foto final obrigatória só se tenant ativar
- fotos não quebram o fluxo antigo
- se upload falhar, operação principal não pode corromper atendimento

### Critério de aceite
- tenant consegue provar visualmente a execução
- operador consegue anexar foto sem fluxo confuso

## Fase 5: WhatsApp operacional refinado

### Objetivo
Fechar o fluxo certo de comunicação.

### Regras de negócio
- mensagem 1: atendimento recebido com link
- nenhuma mensagem extra durante lavagem, salvo regra futura explícita
- mensagem 2: carro pronto para retirada
- opcionalmente enviar foto final
- lembrete de retorno continua ativo

### Backend
- separar claramente:
  - mensagem de entrada
  - mensagem de pronto
  - lembrete de retorno
- suportar mídia na mensagem de pronto se provedor aceitar

### Frontend tenant
- editor dos textos
- toggle de anexar foto final na mensagem de pronto
- pré-visualização do texto

### Admin
- conexão técnica continua fora da área do tenant
- tenant escolhe conteúdo, admin cuida da infraestrutura

### Critério de aceite
- cliente recebe comunicação útil, sem spam

## Fase 6: Recuperador de clientes ampliado

### Objetivo
Levar o robô de recuperação para um nível comercial.

### Banco
Criar estrutura de campanhas e segmentos:

Tabela `customer_recovery_rules`:
- `id`
- `tenant_id`
- `name`
- `days_without_return`
- `service_ids`
- `min_spend`
- `max_spend`
- `is_active`

Tabela `customer_recovery_runs`:
- `id`
- `tenant_id`
- `rule_id`
- `customer_id`
- `channel`
- `message`
- `status`
- `sent_at`

### Backend
- seleção por recência
- seleção por frequência
- seleção por ticket
- seleção por tipo de serviço
- deduplicação

### Frontend tenant
- regras de recuperação
- histórico de clientes recuperados
- taxa de resposta

### Critério de aceite
- tenant consegue operar retenção sem depender de disparo manual diário

## Fase 7: Motor de IA para redes sociais

### Objetivo
Transformar operação em ativo de marketing.

### Entradas
- fotos do atendimento
- serviços realizados
- volume do dia
- carros premium ou especiais

### Saídas
- legenda de post
- legenda de story
- chamada promocional
- variações por campanha
- peça de antes/depois

### Banco
Criar tabela `marketing_assets`:

- `id`
- `tenant_id`
- `attendance_id`
- `media_id`
- `kind`
- `prompt_snapshot`
- `generated_text`
- `status`
- `approved_by`
- `created_at`

### Frontend tenant
- biblioteca de fotos aptas para marketing
- botão `Gerar post`
- revisão antes de publicar
- marcação:
  - `usar`
  - `descartar`
  - `aprovar`

### Regras
- primeira versão não precisa publicar direto em Instagram/Facebook
- primeiro objetivo é gerar material pronto

### Critério de aceite
- tenant consegue sair da operação com conteúdo pronto para postar

## Fase 8: Tempo real

### Objetivo
Remover dependência de refresh manual.

### Camada técnica
- Supabase Realtime ou canal equivalente já suportado pela stack
- inscrição por tenant
- atualização de:
  - fila
  - boxes
  - atendimento
  - fotos
  - pronto

### Eventos
- atendimento criado
- atendimento assumido
- carro movido de box
- carro pronto
- foto anexada

### Frontend
- atualização instantânea do grid do tenant
- atualização instantânea da tela do operador
- transições suaves entre boxes

### Critério de aceite
- operador move
- TV do pátio reflete sem F5

## Fase 9: Painel administrativo de suporte operacional

### Objetivo
Dar ao admin visão e suporte sem invadir a operação do tenant.

### Admin
- visualizar boxes do tenant
- verificar conexão do WhatsApp
- ver estado da operação
- ver gargalos por box
- ver SLA estourado
- ver saúde do tenant

### Critério de aceite
- admin consegue apoiar sem misturar configuração técnica com conteúdo operacional do tenant

## Ordem oficial de implementação

### Bloco 1
- fase 1
- fase 2
- fase 3

### Bloco 2
- fase 4
- fase 5

### Bloco 3
- fase 6
- fase 7

### Bloco 4
- fase 8
- fase 9

## Estratégia de não regressão

### O que nunca pode quebrar durante a evolução
- abertura de atendimento
- caixa
- agendamento
- confirmação de chegada
- operador atual
- acompanhamento público
- disparo de pronto

### Como proteger
- feature flags por tenant
- migrations aditivas
- RPCs novas sem desmontar as antigas
- adaptação progressiva da UI
- fallback para modo clássico

## Backlog técnico por módulo

### Banco
- criar `operation_boxes`
- criar `attendance_box_events`
- criar `attendance_media`
- criar `customer_recovery_rules`
- criar `customer_recovery_runs`
- criar `marketing_assets`
- adicionar campos operacionais em `attendances`
- adicionar flags em `tenant_settings`

### Backend
- repos de boxes
- repos de mídia
- repos de campanhas de recuperação
- repos de marketing assets
- serviços de SLA por box
- resolvedor de status legado
- RPCs atômicas de movimento operacional

### Frontend tenant
- tela de boxes
- tela TV
- configuração de boxes
- fluxo novo do operador
- galeria de atendimento
- editor de regras de recuperação
- gerador de conteúdo social

### Frontend admin
- suporte operacional por tenant
- saúde da conexão WhatsApp
- visão de boxes do tenant

### Integrações
- Evolution para texto e mídia
- storage para fotos
- realtime para operação viva
- motor de IA para legendas e peças

## Critério final de sucesso
O produto só estará concluído quando:

- o dono conseguir olhar para uma TV e entender o pátio em segundos
- o operador conseguir mover carros sem pensar em software
- o cliente receber só mensagens úteis
- o tenant conseguir provar a execução com foto
- o sistema conseguir recuperar clientes automaticamente
- o tenant conseguir gerar marketing a partir da própria operação
- tudo isso rodar sem quebrar caixa, agenda, segurança e isolamento multi-tenant
