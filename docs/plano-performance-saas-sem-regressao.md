# Plano de Performance do Verifica sem Regressao

## Objetivo

Eliminar a sensacao de travamento do SaaS sem alterar o aspecto visual, o grid operacional ou os fluxos que ja funcionam.

O dashboard do Verifica nao e um dashboard analitico generico. Ele e uma tela operacional viva:

- a entrada e os boxes representam etapas reais do workflow;
- cada card representa um atendimento/veiculo;
- os cards giram dentro de cada box quando existe excesso;
- o SLA muda o estado visual do card;
- o operador move o atendimento entre etapas;
- o tenant precisa enxergar o patio atualizado sem recarregar a pagina inteira.

## Resultado esperado

O usuario deve conseguir:

1. clicar em uma acao e receber resposta visual imediata;
2. ver o atendimento mudar de etapa sem reconstruir o dashboard inteiro;
3. manter a rotacao e a posicao visual dos cards enquanto os dados mudam;
4. abrir o SaaS sem consultas de modulos que nao estao sendo usados;
5. operar com varios usuarios e ver mudancas externas em tempo real;
6. continuar usando caixa, agenda, WhatsApp, acompanhamento publico, operador e admin sem regressao.

## Regras que nao podem ser quebradas

- Nao trocar o grid operacional por cards ou graficos de outro modelo.
- Nao alterar a identidade visual, dimensoes, ordem visual ou comportamento de rotacao sem validacao especifica.
- Manter `attendances.status` durante toda a transicao.
- Manter boxes, `current_box_id`, `queue_position`, SLA e modo TV.
- Manter isolamento por `tenant_id`, RLS e autorizacao no backend.
- Manter auditoria, eventos e state machine das operacoes.
- Operacoes criticas continuam atomicas e idempotentes.
- WhatsApp nao pode bloquear a confirmacao visual da operacao.
- Nenhuma exclusao de polling pode deixar a tela sem mecanismo de recuperacao.
- Toda etapa precisa ter medicao antes e depois.
- Toda etapa precisa ter rollback ou feature flag quando houver risco operacional.

## Diagnostico confirmado

### 1. O dashboard carrega dados demais em cada render

Em `src/app/app/dashboard/page.tsx`, o carregamento principal busca simultaneamente dashboard, operacoes e relatorios. A consulta de operacoes tambem carrega servicos, clientes, fila, funcionarios, agenda, caixa, configuracoes, boxes, catalogo de veiculos e sessoes.

Isso ocorre mesmo quando o usuario esta olhando somente o grid operacional.

### 2. A pagina inteira e atualizada a cada cinco segundos

`src/components/realtime-refresh-bridge.tsx` executa `router.refresh()` em intervalo fixo de cinco segundos, alem de atualizar em foco, visibilidade e eventos Realtime.

O mesmo componente tambem chama `/api/jobs/process-messages` em intervalo fixo de cinco segundos. Cada navegador aberto pode participar desse processamento.

### 3. O estado visual do grid e reconstruido junto com o estado de dados

O grid e recalculado no servidor. Quando o dashboard e atualizado, a arvore inteira e reconstruida e os componentes de rotacao podem perder estado local. Isso explica cards mudando de posicao ou a sensacao de a tela travar e voltar.

### 4. Acoes simples esperam efeitos secundarios

Mover atendimento, alterar status e criar atendimento fazem varias consultas e gravacoes antes de redirecionar de volta para o dashboard. Acoes de WhatsApp, status publico, detalhes e midia podem ficar no caminho critico do clique.

### 5. O modelo operacional esta correto, mas o ciclo de atualizacao esta errado

O problema nao e o grid. O problema e usar a reconstrução completa da pagina como mecanismo de sincronizacao da operacao.

## Arquitetura alvo

### Estado inicial

O servidor entrega uma fotografia inicial somente do contexto necessario para a tela aberta.

### Estado operacional local

Um controlador client-side mantem o estado do grid:

- entrada;
- boxes ativos;
- atendimentos ativos;
- posicao na fila;
- SLA e estado derivado;
- identificador da versao/evento recebida.

O controlador atualiza somente o atendimento ou box afetado. A estrutura visual existente continua sendo usada.

### Sincronizacao

Supabase Realtime passa a entregar eventos operacionais por tenant. Cada evento deve conter entidade, acao, identificador e versao/instante.

Exemplos:

- `attendance.created`;
- `attendance.claimed`;
- `attendance.moved`;
- `attendance.status_changed`;
- `attendance.ready`;
- `attendance.delivered`;
- `attendance_media.created`;
- `operation_box.updated`.

O evento atualiza o estado local. `router.refresh()` fica reservado para recuperacao explicita de inconsistencias, troca de contexto ou erro de sincronizacao.

### Processamento de mensagens

O processamento da fila de WhatsApp deve ser executado por cron/worker controlado no backend. O navegador pode solicitar um disparo pontual apos uma acao, mas nao deve ser o worker recorrente de todos os usuarios.

### Caminho critico de uma operacao

O caminho critico deve conter somente:

1. validar sessao, tenant e permissao;
2. validar transicao permitida;
3. executar a gravacao atomica da operacao;
4. registrar evento e auditoria;
5. devolver sucesso e o estado alterado;
6. atualizar o grid local imediatamente.

Mensagens, status publico derivado, notificacoes e demais efeitos devem ser enfileirados sem bloquear a resposta visual, respeitando idempotencia e rastreabilidade.

## Sequencia obrigatoria de execucao

### Fase 0 — Congelamento e baseline

- [ ] Registrar o commit inicial e garantir que nenhuma mudanca visual entre no trabalho de performance.
- [ ] Definir os fluxos de referencia: abrir dashboard, mover card, alterar etapa, criar atendimento, marcar pronto, registrar retirada.
- [ ] Medir tempo de inicio de clique ate feedback visual.
- [ ] Medir tempo de clique ate persistencia no banco.
- [ ] Medir tempo de clique ate retorno da interface.
- [ ] Medir quantidade de requests, consultas e refreshes por fluxo.
- [ ] Medir tamanho do payload inicial e dos payloads de navegacao.
- [ ] Registrar erros de Realtime, falhas de fila e respostas lentas do Supabase.
- [ ] Criar uma tabela de baseline com ambiente local, preview e producao.

**Saida obrigatoria:** numeros reais antes de qualquer alteracao.

### Fase 1 — Contratos de estado e eventos

- [ ] Definir o estado minimo necessario para o grid.
- [ ] Definir quais campos podem alterar a posicao de um card.
- [ ] Definir as transicoes validas: entrada, lavagem, secagem, finalizacao, pronto, retirada e cancelamento.
- [ ] Definir o payload de cada evento operacional.
- [ ] Definir ordenacao por `queue_position`, `sort_order`, timestamp e id como desempate estavel.
- [ ] Definir idempotencia para eventos repetidos.
- [ ] Definir comportamento para evento atrasado ou fora de ordem.
- [ ] Definir fallback de ressincronizacao quando a versao local divergir da versao do servidor.

**Saida obrigatoria:** contrato escrito antes do controlador client-side.

### Fase 2 — Separacao do grid operacional

- [ ] Separar a consulta do grid das consultas de relatorios, clientes, caixa, agenda, estoque, suporte e ADM.
- [ ] Manter a mesma rota, layout, componentes visuais e URLs atuais.
- [ ] Carregar dados de secoes secundarias somente quando a secao for aberta.
- [ ] Preservar os filtros e query params existentes.
- [ ] Garantir que o grid vazio continue mostrando boxes ativos como capacidade operacional.
- [ ] Garantir que cards sem box continuem indo para a esteira de entrada/fallback atual.
- [ ] Garantir que a ordenacao visual continue identica ao comportamento atual.

**Criterio:** o dashboard operacional nao pode consultar dados de uma secao que nao esta aberta.

### Fase 3 — Atualizacao incremental sem refresh global

- [ ] Criar o controlador local do grid sem alterar o markup visual.
- [ ] Inicializar o controlador com a fotografia inicial do servidor.
- [ ] Aplicar eventos de atendimento sem recarregar a pagina inteira.
- [ ] Aplicar eventos de box sem resetar a rotacao dos cards.
- [ ] Manter `RotatingCardViewport` e `AutoScrollStrip` como comportamento visual local.
- [ ] Remover o intervalo de `router.refresh()` de cinco segundos para o tenant.
- [ ] Remover refresh por foco e visibilidade como comportamento padrao do grid.
- [ ] Manter reconexao do canal Realtime.
- [ ] Adicionar ressincronizacao somente em reconexao, falha de versao ou comando explicito.
- [ ] Debounce de eventos do mesmo atendimento para evitar render duplicado.
- [ ] Evitar que um evento recebido durante animacao interrompa a transicao visual.

**Criterio:** uma mudanca em um card nao pode reconstruir o dashboard inteiro.

### Fase 4 — Operacoes atomicas e resposta imediata

- [ ] Mapear cada acao atual e separar gravacao principal de efeitos secundarios.
- [ ] Confirmar que mover atendimento grava box, posicao, status derivado e evento de forma atomica.
- [ ] Confirmar que alterar status respeita a mesma state machine usada pelo fluxo de boxes.
- [ ] Fazer a acao retornar o registro operacional alterado ou um DTO minimo para o grid.
- [ ] Atualizar o card local com a resposta da acao sem aguardar novo carregamento completo.
- [ ] Preservar redirecionamentos de erro existentes.
- [ ] Preservar permissao, RLS, logs e eventos existentes.
- [ ] Tornar repeticao da mesma acao idempotente.
- [ ] Não enviar WhatsApp diretamente no caminho critico da movimentacao.
- [ ] Enfileirar mensagem depois da operacao confirmada.
- [ ] Mostrar falha de mensagem como estado operacional separado, sem desfazer uma movimentacao valida.

**Criterio:** mover um card confirma a mudanca operacional mesmo quando o provedor de WhatsApp estiver lento ou indisponivel.

### Fase 5 — Criacao de atendimento

- [ ] Separar a criacao do atendimento em uma operacao principal atomica.
- [ ] Manter cliente, veiculo, atendimento, itens de servico, box inicial e fila consistentes.
- [ ] Evitar sequencia de varias chamadas independentes quando uma RPC transacional puder garantir a mesma integridade.
- [ ] Retornar o atendimento criado com sua posicao inicial.
- [ ] Inserir o card no grid local assim que a operacao principal confirmar.
- [ ] Enfileirar status publico e mensagem de entrada como efeitos rastreaveis.
- [ ] Manter a validacao de duplicidade de veiculo e cliente.
- [ ] Testar perfil automotivo e perfil generico.

### Fase 6 — Operador e modo TV

- [ ] Reaproveitar o mesmo contrato de eventos do tenant.
- [ ] Remover o refresh global de cinco segundos do dashboard do operador.
- [ ] Atualizar somente o atendimento assumido ou movido.
- [ ] Garantir que o operador veja apenas dados autorizados.
- [ ] Garantir que o modo TV receba eventos sem controles extras e sem reset visual.
- [ ] Garantir que duas telas possam observar a mesma operacao sem conflito.
- [ ] Validar que o operador continue funcionando quando o Realtime cair temporariamente.

### Fase 7 — Fila de mensagens e automacoes

- [ ] Remover processamento recorrente disparado por cada navegador.
- [ ] Manter uma unica rotina de processamento por ambiente/worker.
- [ ] Garantir lock/idempotencia por item da fila.
- [ ] Definir backoff, retry e dead-letter para falhas persistentes.
- [ ] Registrar `message.queued`, `message.processing`, `message.sent` e `message.failed`.
- [ ] Exibir no sistema somente o estado necessario para suporte e diagnostico.
- [ ] Garantir que atraso do WhatsApp nao atrase movimento, caixa ou retirada.

### Fase 8 — Demais secoes do SaaS

Depois do grid operacional estabilizado, medir e corrigir separadamente:

- [ ] Caixa: abertura, lancamento, despesa, diaria e fechamento.
- [ ] Clientes: busca, abertura de ficha, historico e orcamento.
- [ ] Agenda: consulta mensal, criacao, confirmacao, cancelamento e reagendamento.
- [ ] Estoque: consulta, entrada rapida, movimentacao e atualizacao de item.
- [ ] Crescendo: leitura e salvamento de etapas.
- [ ] Suporte: abertura e consulta de tickets.
- [ ] ADM: servicos, funcionarios, configuracoes, WhatsApp e social.
- [ ] Landing do tenant: leitura, upload e salvamento.
- [ ] Admin Control: consultas agregadas e suporte operacional.
- [ ] Paginas publicas: peso de video/imagens e tempo de primeira renderizacao.

Cada secao deve ser corrigida sem reintroduzir refresh global no dashboard operacional.

## Validacao funcional obrigatoria

### Operacao normal

- [ ] Abrir dashboard com entrada vazia.
- [ ] Abrir dashboard com boxes vazios.
- [ ] Criar atendimento.
- [ ] Criar dois atendimentos com a mesma etapa.
- [ ] Verificar ordem por posicao.
- [ ] Mover atendimento para cada tipo de box.
- [ ] Marcar servico como concluido.
- [ ] Marcar atendimento como pronto.
- [ ] Registrar retirada.
- [ ] Cancelar atendimento.
- [ ] Verificar SLA dentro e fora do prazo.
- [ ] Verificar rotacao dos cards sem atualizacao do servidor.
- [ ] Verificar modo TV.

### Concorrencia

- [ ] Tenant e operador abertos simultaneamente.
- [ ] Duas abas do mesmo tenant.
- [ ] Dois usuarios tentando mover o mesmo atendimento.
- [ ] Evento Realtime duplicado.
- [ ] Evento Realtime atrasado.
- [ ] Queda e reconexao do Realtime.
- [ ] WhatsApp indisponivel durante uma movimentacao.
- [ ] Fila de mensagens com retry.

### Seguranca e integridade

- [ ] Validar tenant em toda operacao.
- [ ] Validar permissao no backend.
- [ ] Confirmar RLS.
- [ ] Confirmar auditoria e evento de cada alteracao.
- [ ] Confirmar transicoes invalidas bloqueadas.
- [ ] Confirmar que nenhuma mensagem de um tenant aparece em outro.
- [ ] Confirmar que nenhuma consulta secundaria vazou para o cliente.

## Metas de aceite

As metas abaixo devem ser comparadas com o baseline, nao assumidas sem medicao:

- feedback visual do clique: imediato, sem esperar nova pagina;
- operacao critica persistida: alvo de p95 abaixo de 1 segundo em condicoes normais;
- atualizacao visual entre usuarios: alvo de p95 abaixo de 1 segundo apos evento confirmado;
- zero `router.refresh()` periodico durante operacao normal;
- zero processamento de mensagens recorrente por aba do navegador;
- abrir o grid sem carregar secoes secundarias;
- nenhuma mudanca visual nao planejada;
- nenhuma regressao nos fluxos de caixa, agenda, WhatsApp, operador e acompanhamento publico.

## Ordem de rollout

1. Instrumentar sem alterar comportamento.
2. Separar consulta do grid das consultas secundarias.
3. Introduzir contrato de eventos e controlador local atras de feature flag.
4. Habilitar atualizacao incremental para um tenant de teste.
5. Validar concorrencia, fila, caixa, operador e modo TV.
6. Expandir por tenant.
7. Desativar refresh global somente quando a ressincronizacao estiver comprovada.
8. Mover processamento de mensagens para worker/cron unico.
9. Corrigir secoes restantes com medicao individual.
10. Fazer build, revisao visual, validacao operacional e so entao publicar.

## Condicao de conclusao

O trabalho so sera considerado concluido quando:

- o grid continuar visualmente igual;
- os cards continuarem girando e mudando de etapa como hoje;
- o clique nao depender da reconstruçao do dashboard inteiro;
- eventos externos atualizarem somente o que mudou;
- mensagens nao bloquearem a operacao;
- operador e modo TV permanecerem sincronizados;
- caixa, agenda, acompanhamento publico e demais fluxos passarem a matriz de regressao;
- os tempos antes/depois estiverem registrados;
- existir rollback funcional para qualquer etapa de rollout.

