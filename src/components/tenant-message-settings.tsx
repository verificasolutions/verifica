"use client";

import { useState } from "react";

type MessageSettingsProps = {
  isUnlocked: boolean;
  queueEntryEnabled: boolean;
  queueEntryMessage: string;
  washStartEnabled: boolean;
  washStartMessage: string;
  finishingEnabled: boolean;
  finishingMessage: string;
  readyEnabled: boolean;
  readyMessage: string;
  returnReminderMessage: string;
  returnReminderEnabled: boolean;
  returnReminderDays: number;
  returnReminderTime: string;
};

const PRESETS = {
  queue: [
    "Olá, {cliente}. Recebemos seu atendimento de {servico} na {tenant}. Previsão: {previsao} min. Acompanhe aqui: {link}",
    "Seu serviço foi registrado na {tenant}. Assim que houver avanço, avisaremos por aqui. Acompanhe: {link}",
    "Atendimento recebido. Nossa equipe já tem as informações do serviço {servico} e manterá você atualizado.",
  ],
  washing: [
    "Olá, {cliente}. Seu atendimento de {servico} entrou em execução agora na {tenant}. Acompanhe aqui: {link}",
    "Nossa equipe iniciou o serviço {servico}. Avisaremos quando avançar para a próxima etapa.",
    "O serviço está em andamento na {tenant}. Você pode acompanhar a evolução por aqui: {link}",
  ],
  finishing: [
    "Olá, {cliente}. Seu atendimento está na etapa final de conferência e acabamento na {tenant}.",
    "Estamos finalizando o serviço {servico} e fazendo a última revisão antes da conclusão.",
    "Falta pouco: sua solicitação está em finalização na {tenant}. Acompanhe aqui: {link}",
  ],
  ready: [
    "Olá, {cliente}. Seu serviço {servico} foi concluído na {tenant}. Nossa equipe está à disposição para combinar a entrega ou retirada.",
    "Atendimento finalizado na {tenant}. Veja os detalhes e fale com a equipe por aqui: {link}",
    "Tudo pronto por aqui. Seu atendimento foi concluído e você já pode seguir com a próxima etapa.",
  ],
  reminder: [
    "Olá, {cliente}. Já faz alguns dias desde seu último atendimento na {tenant}. Quer agendar um novo serviço?",
    "Passando para lembrar que podemos cuidar do seu próximo serviço. Responda esta mensagem e a {tenant} ajuda no agendamento.",
    "Seu histórico mostra que pode ser hora de um novo atendimento. Quer que a gente te ajude a agendar?",
  ],
};

function PresetButtons({
  items,
  onSelect,
  disabled,
}: {
  items: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item, index) => (
        <button
          key={`${index}-${item}`}
          type="button"
          onClick={() => onSelect(item)}
          disabled={disabled}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/72 transition hover:border-[var(--accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          Usar frase {index + 1}
        </button>
      ))}
    </div>
  );
}

function StageMessageCard({
  label,
  name,
  enabledName,
  enabled,
  onEnabledChange,
  value,
  onChange,
  presets,
  disabled,
}: {
  label: string;
  name: string;
  enabledName: string;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  presets: string[];
  disabled?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
      <input type="hidden" name={enabledName} value="false" />
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="mt-1 text-xs text-white/52">Marque se o sistema deve disparar essa etapa automaticamente.</p>
        </div>
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0f141b] px-4 py-3 text-sm text-white/82">
          <input
            type="checkbox"
            name={enabledName}
            value="true"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
            disabled={disabled}
            className="size-4"
          />
          Disparar mensagem
        </label>
      </div>
      <textarea
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        disabled={disabled}
        className="mt-4 min-h-[132px] w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-45"
      />
      <PresetButtons items={presets} onSelect={onChange} disabled={disabled} />
    </div>
  );
}

function ReminderCard({
  enabled,
  onEnabledChange,
  days,
  onDaysChange,
  time,
  onTimeChange,
  value,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  days: string;
  onDaysChange: (value: string) => void;
  time: string;
  onTimeChange: (value: string) => void;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
      <input type="hidden" name="return_reminder_enabled" value="false" />
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-base font-semibold text-white">Lembrete de retorno</p>
          <p className="mt-1 text-sm text-white/56">Define se o cliente volta a receber um lembrete depois de alguns dias.</p>
        </div>
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
          <input
            type="checkbox"
            name="return_reminder_enabled"
            value="true"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
            disabled={disabled}
            className="size-4"
          />
          Disparo automático ativado
        </label>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.6fr_0.6fr_1.8fr]">
        <div>
          <p className="mb-2 text-sm font-medium text-white">Dias após o último atendimento</p>
          <input
            name="return_reminder_days"
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(event) => onDaysChange(event.target.value)}
            disabled={disabled}
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-45"
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-white">Horário do disparo</p>
          <input
            name="return_reminder_time"
            type="time"
            value={time}
            onChange={(event) => onTimeChange(event.target.value)}
            disabled={disabled}
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-45"
          />
        </div>
        <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold text-white">Mensagem de lembrete</p>
          <textarea
            name="return_reminder_message"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={4}
            disabled={disabled}
            className="mt-4 min-h-[132px] w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-45"
          />
          <PresetButtons items={PRESETS.reminder} onSelect={onChange} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}

export function TenantMessageSettings(props: MessageSettingsProps) {
  const [queueEntryEnabled, setQueueEntryEnabled] = useState(props.queueEntryEnabled);
  const [queueEntryMessage, setQueueEntryMessage] = useState(props.queueEntryMessage);
  const [washStartEnabled, setWashStartEnabled] = useState(props.washStartEnabled);
  const [washStartMessage, setWashStartMessage] = useState(props.washStartMessage);
  const [finishingEnabled, setFinishingEnabled] = useState(props.finishingEnabled);
  const [finishingMessage, setFinishingMessage] = useState(props.finishingMessage);
  const [readyEnabled, setReadyEnabled] = useState(props.readyEnabled);
  const [readyMessage, setReadyMessage] = useState(props.readyMessage);
  const [returnReminderMessage, setReturnReminderMessage] = useState(props.returnReminderMessage);
  const [returnReminderEnabled, setReturnReminderEnabled] = useState(props.returnReminderEnabled);
  const [returnReminderDays, setReturnReminderDays] = useState(String(props.returnReminderDays));
  const [returnReminderTime, setReturnReminderTime] = useState(props.returnReminderTime);

  return (
    <div className="space-y-4 xl:col-span-2">
      <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
        <div className="flex flex-col gap-2">
          <p className="text-base font-semibold text-white">Mensagens automáticas</p>
          <p className="text-sm text-white/56">
            Você decide em quais etapas o cliente recebe mensagem: entrada, execução, finalização e serviço concluído.
          </p>
          <p className="text-sm text-white/56">
            Use as variáveis {`{tenant}`}, {`{cliente}`}, {`{veiculo}`}, {`{placa}`}, {`{servico}`}, {`{previsao}`} e {`{link}`}.
          </p>
        </div>

        {!props.isUnlocked ? (
          <div className="mt-4 rounded-[20px] border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            O Admin Master ainda não liberou o uso das mensagens automáticas para este tenant.
          </div>
        ) : null}

        <div className={`mt-4 grid gap-4 xl:grid-cols-2 ${props.isUnlocked ? "" : "opacity-60"}`}>
          <StageMessageCard
            label="Mensagem de entrada na fila"
            name="queue_entry_message"
            enabledName="queue_entry_message_enabled"
            enabled={queueEntryEnabled}
            onEnabledChange={setQueueEntryEnabled}
            value={queueEntryMessage}
            onChange={setQueueEntryMessage}
            presets={PRESETS.queue}
            disabled={!props.isUnlocked}
          />
          <StageMessageCard
            label="Mensagem de serviço em execução"
            name="wash_start_message"
            enabledName="wash_start_message_enabled"
            enabled={washStartEnabled}
            onEnabledChange={setWashStartEnabled}
            value={washStartMessage}
            onChange={setWashStartMessage}
            presets={PRESETS.washing}
            disabled={!props.isUnlocked}
          />
          <StageMessageCard
            label="Mensagem de finalização do serviço"
            name="finishing_message"
            enabledName="finishing_message_enabled"
            enabled={finishingEnabled}
            onEnabledChange={setFinishingEnabled}
            value={finishingMessage}
            onChange={setFinishingMessage}
            presets={PRESETS.finishing}
            disabled={!props.isUnlocked}
          />
          <StageMessageCard
            label="Mensagem de serviço concluído"
            name="ready_message"
            enabledName="ready_message_enabled"
            enabled={readyEnabled}
            onEnabledChange={setReadyEnabled}
            value={readyMessage}
            onChange={setReadyMessage}
            presets={PRESETS.ready}
            disabled={!props.isUnlocked}
          />
        </div>
      </div>

      <ReminderCard
        enabled={returnReminderEnabled}
        onEnabledChange={setReturnReminderEnabled}
        days={returnReminderDays}
        onDaysChange={setReturnReminderDays}
        time={returnReminderTime}
        onTimeChange={setReturnReminderTime}
        value={returnReminderMessage}
        onChange={setReturnReminderMessage}
        disabled={!props.isUnlocked}
      />
    </div>
  );
}
