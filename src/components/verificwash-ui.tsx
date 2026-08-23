"use client";

import { useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  CarFront,
  ChartColumn,
  Check,
  ChevronRight,
  CircleDollarSign,
  Filter,
  Gauge,
  Grip,
  IdCard,
  LockKeyhole,
  Menu,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Settings,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  appointments,
  cashEntries,
  customers,
  dashboardStats,
  dayWashes,
  employees,
  operatorHistory,
  operatorStats,
  queueItems,
  queueTabs,
  reportCards,
  services,
  tenant,
  trackerSteps,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const quickActions: Array<{
  id: string;
  label: string;
  hint: string;
  icon: typeof Plus;
  accent?: boolean;
}> = [
  { id: "novo-atendimento", label: "Novo Atendimento", hint: "menos de 30s", icon: Plus, accent: true },
  { id: "fila", label: "Fila", hint: "4 aguardando", icon: Grip },
  { id: "agendamentos", label: "Agendamentos", hint: "3 horários", icon: CalendarDays },
  { id: "caixa", label: "Caixa", hint: "R$ 1.240 hoje", icon: CircleDollarSign },
  { id: "funcionarios", label: "Funcionários", hint: "2 presentes", icon: Users },
  { id: "servicos", label: "Serviços", hint: "2 ativos", icon: Wrench },
  { id: "clientes", label: "Clientes", hint: "busca rápida", icon: IdCard },
  { id: "relatorios", label: "Relatórios", hint: "hoje e mês", icon: ChartColumn },
  { id: "configuracoes", label: "Configurações", hint: "mensagens e acesso", icon: Settings },
] as const;

const operatorActions = [
  { id: "minha-fila", label: "Minha Fila", hint: "2 carros", icon: CarFront },
  { id: "todos-os-carros", label: "Todos os Carros", hint: "fila geral", icon: Grip },
  { id: "historico-do-dia", label: "Histórico do Dia", hint: "5 finalizadas", icon: Gauge },
] as const;

const atendimentoSchema = z.object({
  customerName: z.string().min(2, "Informe o cliente"),
  whatsapp: z.string().min(8, "Informe o WhatsApp"),
  plate: z.string().min(7, "Informe a placa"),
  model: z.string().min(2, "Informe o modelo"),
  color: z.string().min(2, "Informe a cor"),
  service: z.string().min(2, "Selecione o serviço"),
  washer: z.string().min(2, "Selecione o lavador"),
  amount: z.string().min(1, "Informe o valor"),
  payment: z.enum(["Dinheiro", "Pix", "Cartão", "Pendente"]),
});

type AtendimentoValues = z.infer<typeof atendimentoSchema>;

const initialAtendimento: AtendimentoValues = {
  customerName: "",
  whatsapp: "",
  plate: "",
  model: "",
  color: "Preto",
  service: "Lavagem completa",
  washer: "Carlos",
  amount: "90",
  payment: "Pix",
};

const toneStyles = {
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  cyan: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  green: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  mint: "border-teal-300/30 bg-teal-300/10 text-teal-100",
} as const;

function SectionCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[22px] border border-white/10 bg-white/6 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </section>
  );
}

function PrimaryButton({
  children,
  className,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(
        "flex min-h-12 items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_30px_rgba(0,245,212,0.24)] transition active:scale-[0.98]",
        className,
      )}
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/82 transition active:scale-[0.98]",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-2 text-xs font-semibold transition active:scale-[0.98]",
        active
          ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
          : "border-white/10 bg-white/5 text-white/65",
      )}
    >
      {label}
    </button>
  );
}

function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/70 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] border border-white/10 bg-[rgba(22,27,34,0.94)] p-4 pb-8 shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-white/12" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/45">Drawer</p>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
          </div>
          <GhostButton onClick={onClose} className="min-h-10 rounded-full px-3">
            Fechar
          </GhostButton>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-white/78">{label}</span>
      {children}
      {error ? <span className="text-xs text-rose-300">{error}</span> : null}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-[var(--accent)]",
        props.className,
      )}
    />
  );
}

function DrawerContent({ drawer }: { drawer: string }) {
  const [queueTab, setQueueTab] = useState<(typeof queueTabs)[number]>("Todos");
  const [appointmentFilter, setAppointmentFilter] = useState("Hoje");
  const [reportFilter, setReportFilter] = useState("Hoje");
  const form = useForm<AtendimentoValues>({
    resolver: zodResolver(atendimentoSchema),
    defaultValues: initialAtendimento,
  });
  const paymentValue = useWatch({
    control: form.control,
    name: "payment",
  });

  if (drawer === "novo-atendimento") {
    return (
      <div className="space-y-4">
        <SectionCard className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/58">Objetivo</p>
              <h3 className="text-base font-semibold text-white">Cadastrar carro em menos de 30 segundos</h3>
            </div>
            <div className="rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/12 px-3 py-2 text-xs font-semibold text-[var(--accent)]">
              Fluxo rápido
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <GhostButton className="justify-start gap-2">
              <Search className="size-4" />
              Buscar por telefone ou placa
            </GhostButton>
            <GhostButton className="justify-start gap-2">
              <Users className="size-4" />
              Cliente já cadastrado?
            </GhostButton>
          </div>
        </SectionCard>

        <form className="space-y-4">
          <Field label="Nome do cliente" error={form.formState.errors.customerName?.message}>
            <Input {...form.register("customerName")} placeholder="João Silva" />
          </Field>
          <Field label="WhatsApp" error={form.formState.errors.whatsapp?.message}>
            <Input {...form.register("whatsapp")} placeholder="(11) 99999-9999" />
          </Field>
          <Field label="Placa" error={form.formState.errors.plate?.message}>
            <Input
              {...form.register("plate")}
              placeholder="ABC1D23"
              className="border-white/15 bg-gradient-to-r from-slate-100 to-white text-center font-mono text-lg tracking-[0.35em] text-slate-900 uppercase"
              onChange={(event) => {
                form.setValue("plate", event.target.value.toUpperCase());
              }}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Modelo" error={form.formState.errors.model?.message}>
              <Input {...form.register("model")} placeholder="Civic" />
            </Field>
            <Field label="Cor" error={form.formState.errors.color?.message}>
              <Input {...form.register("color")} placeholder="Preto" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Serviço" error={form.formState.errors.service?.message}>
              <Input {...form.register("service")} placeholder="Lavagem completa" />
            </Field>
            <Field label="Lavador responsável" error={form.formState.errors.washer?.message}>
              <Input {...form.register("washer")} placeholder="Carlos" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor" error={form.formState.errors.amount?.message}>
              <Input {...form.register("amount")} placeholder="90" />
            </Field>
            <Field label="Pagamento" error={form.formState.errors.payment?.message}>
              <div className="grid grid-cols-2 gap-2">
                {["Dinheiro", "Pix", "Cartão", "Pendente"].map((method) => (
                  <Chip
                    key={method}
                    label={method}
                    active={paymentValue === method}
                    onClick={() =>
                      form.setValue("payment", method as AtendimentoValues["payment"], {
                        shouldValidate: true,
                      })
                    }
                  />
                ))}
              </div>
            </Field>
          </div>
        </form>

        <SectionCard className="space-y-3">
          <h3 className="text-sm font-semibold text-white">Ao salvar</h3>
          <div className="grid gap-2 text-sm text-white/62">
            <p>cria cliente</p>
            <p>cria veículo</p>
            <p>cria atendimento</p>
            <p>adiciona na fila</p>
            <p>gera link público</p>
            <p>volta para dashboard ou fila</p>
          </div>
        </SectionCard>

        <div className="grid gap-2">
          <PrimaryButton>Adicionar à fila</PrimaryButton>
          <GhostButton>Adicionar e avisar cliente</GhostButton>
          <GhostButton>Salvar sem avisar</GhostButton>
          <GhostButton className="text-rose-200">Cancelar</GhostButton>
        </div>
      </div>
    );
  }

  if (drawer === "fila") {
    return (
      <div className="space-y-4">
        <SectionCard className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/58">Objetivo</p>
              <h3 className="text-base font-semibold text-white">Controlar o dia</h3>
            </div>
            <GhostButton className="min-h-10 gap-2 px-3">
              <Filter className="size-4" />
              Filtrar
            </GhostButton>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {queueTabs.map((tab) => (
              <Chip key={tab} label={tab} active={queueTab === tab} onClick={() => setQueueTab(tab)} />
            ))}
          </div>
        </SectionCard>

        {queueItems.map((item) => (
          <SectionCard key={item.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{item.vehicle}</h3>
                <p className="text-sm text-white/55">{item.plate}</p>
              </div>
              <div className={cn("rounded-full border px-3 py-1 text-xs font-semibold", toneStyles[item.statusTone])}>
                {item.status}
              </div>
            </div>
            <div className="space-y-1 text-sm text-white/74">
              <p>
                {item.customer} - {item.service}
              </p>
              <p>Previsão: {item.eta}</p>
              <p>Lavador: {item.washer}</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/7">
              <div
                className={cn(
                  "h-full rounded-full",
                  item.statusTone === "green"
                    ? "w-full bg-emerald-400"
                    : item.statusTone === "cyan"
                      ? "w-3/5 bg-sky-400"
                      : "w-1/3 bg-amber-400",
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <PrimaryButton className="bg-white text-slate-950 shadow-none">Iniciar</PrimaryButton>
              <GhostButton>Avançar</GhostButton>
              <GhostButton>Finalizar</GhostButton>
              <GhostButton>Avisar cliente</GhostButton>
              <GhostButton>Adicionar extra</GhostButton>
              <GhostButton className="text-rose-200">Cancelar</GhostButton>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {["editar atendimento", "trocar lavador", "ver cliente", "registrar observação", "tirar foto"].map(
                (action) => (
                  <GhostButton key={action} className="min-h-10 justify-start px-3 text-white/60">
                    {action}
                  </GhostButton>
                ),
              )}
            </div>
          </SectionCard>
        ))}
      </div>
    );
  }

  if (drawer === "agendamentos") {
    return (
      <div className="space-y-4">
        <SectionCard className="space-y-3">
          <div className="flex gap-2">
            {["Hoje", "Amanhã", "Semana"].map((tab) => (
              <Chip key={tab} label={tab} active={appointmentFilter === tab} onClick={() => setAppointmentFilter(tab)} />
            ))}
          </div>
        </SectionCard>

        <SectionCard className="space-y-3">
          <h3 className="text-lg font-semibold text-white">Hoje</h3>
          {appointments.map((item) => (
            <div
              key={`${item.time}-${item.vehicle}`}
              className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/15 p-3"
            >
              <div>
                <p className="text-sm font-semibold text-white">
                  {item.time} - {item.vehicle} - {item.customer}
                </p>
              </div>
              <ChevronRight className="size-4 text-white/45" />
            </div>
          ))}
        </SectionCard>

        <SectionCard className="space-y-3">
          <h3 className="text-base font-semibold text-white">Novo agendamento</h3>
          <div className="grid gap-3">
            {["cliente", "WhatsApp", "carro", "serviço", "data", "horário", "observação"].map((label) => (
              <Input key={label} placeholder={label} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <PrimaryButton>Novo agendamento</PrimaryButton>
            <GhostButton>Confirmar chegada</GhostButton>
            <GhostButton>Remarcar</GhostButton>
            <GhostButton>Cancelar</GhostButton>
            <GhostButton className="col-span-2">Enviar lembrete</GhostButton>
          </div>
        </SectionCard>
      </div>
    );
  }

  if (drawer === "caixa") {
    return (
      <div className="space-y-4">
        <SectionCard className="space-y-2">
          <p className="text-sm text-white/58">Caixa do Dia</p>
          <h3 className="text-xl font-semibold text-white">Aberto às {tenant.cashOpenAt}</h3>
        </SectionCard>

        <SectionCard className="grid grid-cols-2 gap-3">
          {cashEntries.map((entry) => (
            <div key={entry.label} className="rounded-2xl border border-white/8 bg-black/12 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-white/42">{entry.label}</p>
              <p className="mt-2 text-lg font-semibold text-white">{entry.value}</p>
            </div>
          ))}
        </SectionCard>

        <SectionCard className="space-y-3">
          <h3 className="text-base font-semibold text-white">Lavagens do dia</h3>
          {dayWashes.map((item) => (
            <div key={item.vehicle} className="flex items-center justify-between text-sm text-white/76">
              <span>{item.vehicle}</span>
              <span>{item.amount}</span>
              <span>{item.method}</span>
            </div>
          ))}
        </SectionCard>

        <SectionCard className="space-y-3">
          <h3 className="text-base font-semibold text-white">Funcionários</h3>
          {employees.map((employee) => (
            <div key={employee.name} className="rounded-2xl border border-white/8 bg-black/12 p-3">
              <p className="font-semibold text-white">{employee.name}</p>
              <p className="text-sm text-white/58">{employee.production}</p>
              <p className="text-sm text-white/58">{employee.payment}</p>
            </div>
          ))}
        </SectionCard>

        <div className="grid grid-cols-2 gap-2">
          <PrimaryButton>Abrir caixa</PrimaryButton>
          <GhostButton>Lançar entrada</GhostButton>
          <GhostButton>Lançar despesa</GhostButton>
          <GhostButton>Fechar dia</GhostButton>
          <GhostButton className="col-span-2">Exportar CSV</GhostButton>
        </div>
      </div>
    );
  }

  if (drawer === "funcionarios") {
    return (
      <div className="space-y-4">
        {employees.map((employee) => (
          <SectionCard key={employee.name} className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-white">{employee.name}</h3>
              <p className="text-sm text-white/58">{employee.presence}</p>
              <p className="text-sm text-white/58">{employee.production}</p>
              <p className="text-sm text-white/58">{employee.payment}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {["Novo funcionário", "Marcar presença", "Ver produção", "Editar pagamento", "Desativar"].map((action) => (
                <GhostButton key={action}>{action}</GhostButton>
              ))}
            </div>
          </SectionCard>
        ))}
        <SectionCard className="space-y-3">
          <h3 className="text-base font-semibold text-white">Cadastro</h3>
          <div className="grid gap-3">
            {["nome", "telefone", "função", "acesso ao sistema: sim/não", "tipo: diária, comissão, fixo", "valor"].map(
              (label) => (
                <Input key={label} placeholder={label} />
              ),
            )}
          </div>
        </SectionCard>
      </div>
    );
  }

  if (drawer === "servicos") {
    return (
      <div className="space-y-4">
        {services.map((service) => (
          <SectionCard key={service.name} className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{service.name}</h3>
                <p className="text-sm text-white/58">{service.price}</p>
                <p className="text-sm text-white/58">{service.duration}</p>
              </div>
              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                {service.state}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <PrimaryButton>Novo serviço</PrimaryButton>
              <GhostButton>Editar</GhostButton>
              <GhostButton>Desativar</GhostButton>
              <GhostButton>Reordenar</GhostButton>
            </div>
          </SectionCard>
        ))}
        <SectionCard className="space-y-3">
          <h3 className="text-base font-semibold text-white">Cadastro</h3>
          <div className="grid gap-3">
            {["nome", "preço", "tempo médio", "descrição curta", "serviço extra ou principal", "ativo/inativo"].map(
              (label) => (
                <Input key={label} placeholder={label} />
              ),
            )}
          </div>
        </SectionCard>
      </div>
    );
  }

  if (drawer === "clientes") {
    return (
      <div className="space-y-4">
        <SectionCard>
          <Input placeholder="Buscar por nome, telefone ou placa" />
        </SectionCard>
        {customers.map((customer) => (
          <SectionCard key={customer.name} className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-white">{customer.name}</h3>
              <p className="text-sm text-white/58">{customer.vehicle}</p>
              <p className="text-sm text-white/58">{customer.lastWash}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {["Novo atendimento", "Ver histórico", "Editar cliente", "Enviar lembrete", "Excluir/inativar"].map(
                (action) => (
                  <GhostButton key={action}>{action}</GhostButton>
                ),
              )}
            </div>
          </SectionCard>
        ))}
      </div>
    );
  }

  if (drawer === "relatorios") {
    return (
      <div className="space-y-4">
        <SectionCard className="space-y-3">
          <div className="flex gap-2">
            {["Hoje", "Semana", "Mês"].map((tab) => (
              <Chip key={tab} label={tab} active={reportFilter === tab} onClick={() => setReportFilter(tab)} />
            ))}
          </div>
        </SectionCard>
        <SectionCard className="grid grid-cols-2 gap-3">
          {reportCards.map((report) => (
            <div key={report.label} className="rounded-2xl border border-white/8 bg-black/12 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-white/42">{report.label}</p>
              <p className="mt-2 text-lg font-semibold text-white">{report.value}</p>
            </div>
          ))}
        </SectionCard>
        <SectionCard className="space-y-2 text-sm text-white/64">
          <p>lavagens por dia</p>
          <p>faturamento</p>
          <p>serviços mais vendidos</p>
          <p>produção por lavador</p>
          <p>clientes recorrentes</p>
        </SectionCard>
        <div className="grid grid-cols-2 gap-2">
          <PrimaryButton>Exportar CSV</PrimaryButton>
          <GhostButton>Enviar resumo por WhatsApp</GhostButton>
          <GhostButton className="col-span-2">Ver detalhes</GhostButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard className="space-y-4">
        <div>
          <p className="text-sm text-white/58">Dados do lava rápido</p>
          <h3 className="text-base font-semibold text-white">Configurações importantes</h3>
        </div>
        <div className="grid gap-2 text-sm text-white/62">
          {[
            "tempo padrão dos serviços",
            "mensagem de entrada na fila",
            "mensagem de início",
            "mensagem de pronto",
            "lembrete de retorno",
            "permissões do operador",
          ].map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </SectionCard>

      <SectionCard className="space-y-3">
        {[
          "Dados do lava rápido",
          "Horários",
          "Mensagens automáticas",
          "Formas de pagamento",
          "Permissões",
          "Conta e plano",
        ].map((section) => (
          <div key={section} className="rounded-2xl border border-white/8 bg-black/12 p-3 text-sm text-white/72">
            {section}
          </div>
        ))}
      </SectionCard>

      <div className="grid grid-cols-2 gap-2">
        {["Editar dados", "Configurar mensagens", "Convidar operador", "Salvar alterações", "Testar WhatsApp", "Sair da conta"].map(
          (action) => (
            <GhostButton key={action}>{action}</GhostButton>
          ),
        )}
      </div>
    </div>
  );
}

export function LoginScreen() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
      <SectionCard className="overflow-hidden p-0">
        <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top,_rgba(0,245,212,0.22),_transparent_55%),linear-gradient(135deg,_rgba(56,189,248,0.08),_rgba(13,17,23,0.96))] p-5">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
              <Sparkles className="size-6 text-[var(--accent)]" />
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              SaaS POS
            </span>
          </div>
          <p className="text-xs uppercase tracking-[0.28em] text-white/48">Logo do SaaS</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Verifica</h1>
          <p className="mt-2 text-sm text-white/60">Lava Rápido Central</p>
        </div>

        <div className="space-y-4 p-5">
          <Field label="E-mail">
            <div className="relative">
              <Phone className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/28" />
              <Input type="email" placeholder="seu@email.com" className="pl-11" />
            </div>
          </Field>
          <Field label="Senha">
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/28" />
              <Input type="password" placeholder="••••••••" className="pl-11" />
            </div>
          </Field>
          <div className="grid gap-2">
            <PrimaryButton>Entrar</PrimaryButton>
            <GhostButton>Esqueci minha senha</GhostButton>
            <GhostButton>Criar conta</GhostButton>
          </div>
        </div>
      </SectionCard>
    </main>
  );
}

export function TenantDashboard() {
  const [openDrawer, setOpenDrawer] = useState<string | null>(null);

  return (
    <>
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-5 pb-28">
        <SectionCard className="bg-[radial-gradient(circle_at_top,_rgba(0,245,212,0.14),_transparent_52%),rgba(22,27,34,0.9)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-white/62">{tenant.greeting}</p>
              <h1 className="mt-1 text-2xl font-semibold text-white">{tenant.washName}</h1>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                <span className="size-2 rounded-full bg-emerald-300" />
                {tenant.cashLabel}
              </div>
            </div>
            <button className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-white/72">
              <Menu className="size-5" />
            </button>
          </div>
        </SectionCard>

        <div className="grid grid-cols-2 gap-3">
          {dashboardStats.map((stat) => (
            <SectionCard key={stat.label} className="space-y-3">
              <div className="flex items-start justify-between">
                <p className="max-w-[8rem] text-sm text-white/58">{stat.label}</p>
                <div className={cn("rounded-full border px-2 py-1 text-[10px] font-semibold uppercase", toneStyles[stat.tone])}>
                  Live
                </div>
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{stat.value}</p>
                <p className="mt-1 text-xs text-white/46">{stat.note}</p>
              </div>
            </SectionCard>
          ))}
        </div>

        <PrimaryButton className="h-14 justify-start rounded-[20px] px-5 text-base" onClick={() => setOpenDrawer("novo-atendimento")}>
          <Plus className="mr-3 size-5" />
          Novo Atendimento
        </PrimaryButton>

        <SectionCard className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/42">Painel de operação rápida</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Decisão em 2 segundos</h2>
            </div>
            <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/55">Mobile</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => setOpenDrawer(action.id)}
                  className={cn(
                    "rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 text-left transition active:scale-[0.98]",
                    action.accent ? "shadow-[0_0_0_1px_rgba(0,245,212,0.08),0_18px_40px_rgba(0,245,212,0.14)]" : "",
                  )}
                >
                  <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-black/18">
                    <Icon className={cn("size-6", action.accent ? "text-[var(--accent)]" : "text-white/72")} />
                  </div>
                  <p className="mt-4 text-base font-semibold text-white">{action.label}</p>
                  <p className="mt-1 text-sm text-white/48">{action.hint}</p>
                </button>
              );
            })}
          </div>
        </SectionCard>
      </main>

      <button
        type="button"
        onClick={() => setOpenDrawer("novo-atendimento")}
        className="fixed bottom-4 left-1/2 z-30 flex h-14 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-center rounded-[20px] border border-[var(--accent)]/15 bg-[var(--accent)] px-4 text-base font-semibold text-slate-950 shadow-[0_20px_50px_rgba(0,245,212,0.25)]"
      >
        <Plus className="mr-2 size-5" />
        Novo Atendimento
      </button>

      <Drawer open={openDrawer !== null} onClose={() => setOpenDrawer(null)} title={titleByDrawer(openDrawer)}>
        {openDrawer ? <DrawerContent drawer={openDrawer} /> : null}
      </Drawer>
    </>
  );
}

export function OperatorDashboard() {
  const [openDrawer, setOpenDrawer] = useState<string | null>(null);

  return (
    <>
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-5 pb-12">
        <SectionCard className="bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_50%),rgba(22,27,34,0.92)]">
          <p className="text-sm text-white/62">Olá, Carlos</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Hoje: 4 lavagens atribuídas</h1>
        </SectionCard>

        <div className="grid grid-cols-3 gap-3">
          {operatorStats.map((item) => (
            <SectionCard key={item.label} className="p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/38">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
            </SectionCard>
          ))}
        </div>

        <div className="grid gap-3">
          {operatorActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => setOpenDrawer(action.id)}
                className="flex min-h-24 items-center gap-4 rounded-[24px] border border-white/10 bg-white/6 p-4 text-left shadow-[0_12px_40px_rgba(0,0,0,0.24)] transition active:scale-[0.98]"
              >
                <div className="flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-black/18">
                  <Icon className="size-7 text-[var(--accent-secondary)]" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{action.label}</p>
                  <p className="text-sm text-white/52">{action.hint}</p>
                </div>
              </button>
            );
          })}
        </div>
      </main>

      <Drawer open={openDrawer !== null} onClose={() => setOpenDrawer(null)} title={titleByDrawer(openDrawer)}>
        {openDrawer === "minha-fila" ? (
          <div className="space-y-4">
            {queueItems.slice(0, 2).map((item) => (
              <SectionCard key={item.id} className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{item.vehicle}</h3>
                  <p className="text-sm text-white/55">{item.plate}</p>
                  <p className="mt-2 text-sm text-white/72">{item.service}</p>
                  <p className="text-sm text-white/58">Tempo estimado: {item.eta}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <PrimaryButton>Iniciar lavagem</PrimaryButton>
                  <GhostButton>Pausar</GhostButton>
                  <GhostButton>Finalizar</GhostButton>
                  <GhostButton>Adicionar observação</GhostButton>
                  <GhostButton className="col-span-2">Enviar foto</GhostButton>
                </div>
              </SectionCard>
            ))}
          </div>
        ) : null}

        {openDrawer === "todos-os-carros" ? (
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {["Aguardando", "Em lavagem", "Pronto"].map((tab) => (
                <Chip key={tab} label={tab} active={tab === "Aguardando"} />
              ))}
            </div>
            {queueItems.map((item) => (
              <SectionCard key={item.id} className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{item.vehicle}</h3>
                    <p className="text-sm text-white/58">{item.plate}</p>
                  </div>
                  <div className={cn("rounded-full border px-3 py-1 text-xs font-semibold", toneStyles[item.statusTone])}>
                    {item.status}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <PrimaryButton>Assumir carro</PrimaryButton>
                  <GhostButton>Ver detalhes</GhostButton>
                  <GhostButton className="col-span-2">Avisar responsável</GhostButton>
                </div>
              </SectionCard>
            ))}
          </div>
        ) : null}

        {openDrawer === "historico-do-dia" ? (
          <div className="space-y-4">
            <SectionCard className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/38">Finalizadas</p>
                <p className="mt-2 text-2xl font-semibold text-white">5</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/38">Andamento</p>
                <p className="mt-2 text-2xl font-semibold text-white">1</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/38">Tempo médio</p>
                <p className="mt-2 text-2xl font-semibold text-white">42 min</p>
              </div>
            </SectionCard>
            {operatorHistory.map((entry) => (
              <SectionCard key={`${entry.vehicle}-${entry.finishedAt}`} className="space-y-2">
                <p className="text-base font-semibold text-white">{entry.vehicle}</p>
                <p className="text-sm text-white/58">{entry.service}</p>
                <p className="text-sm text-white/58">{entry.finishedAt}</p>
                <div className="grid grid-cols-2 gap-2">
                  <GhostButton>Ver detalhes</GhostButton>
                  <GhostButton>Corrigir status</GhostButton>
                </div>
              </SectionCard>
            ))}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}

export function PublicTracker({ code }: { code: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
      <SectionCard className="overflow-hidden p-0">
        <div className="bg-[radial-gradient(circle_at_top,_rgba(74,222,128,0.24),_transparent_60%),linear-gradient(180deg,rgba(22,27,34,0.98),rgba(13,17,23,0.96))] p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/70">Acompanhar atendimento</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">Seu carro está na fila</h1>
          <p className="mt-2 text-sm text-white/62">Código público: {code}</p>
        </div>
        <div className="space-y-5 p-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Honda Civic Preto</h2>
            <p className="mt-1 text-sm text-white/58">Status: Em lavagem</p>
            <p className="text-sm text-white/58">Previsão: 35 min</p>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {trackerSteps.map((step, index) => {
              const done = index <= 2;
              return (
                <div key={step} className="space-y-2 text-center">
                  <div
                    className={cn(
                      "mx-auto flex size-10 items-center justify-center rounded-full border text-xs font-semibold",
                      done
                        ? "border-emerald-300/30 bg-emerald-300/15 text-emerald-100 shadow-[0_0_20px_rgba(74,222,128,0.28)]"
                        : "border-white/10 bg-white/5 text-white/38",
                    )}
                  >
                    {done ? <Check className="size-4" /> : index + 1}
                  </div>
                  <p className="text-[11px] text-white/55">{step}</p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-2">
            <PrimaryButton className="bg-emerald-300 text-slate-950 shadow-[0_15px_40px_rgba(74,222,128,0.2)]">
              <MessageCircle className="mr-2 size-4" />
              Falar com o lava rápido
            </PrimaryButton>
            <GhostButton>Ver localização</GhostButton>
            <GhostButton>Solicitar serviço extra</GhostButton>
          </div>

          <SectionCard className="border-emerald-300/15 bg-emerald-300/10">
            <p className="text-sm font-semibold text-emerald-100">Seu carro está pronto para retirada.</p>
            <p className="mt-1 text-sm text-emerald-100/68">
              Sem histórico de gastos, dados internos, caixa ou outros clientes.
            </p>
          </SectionCard>
        </div>
      </SectionCard>
    </main>
  );
}

function titleByDrawer(drawer: string | null) {
  switch (drawer) {
    case "novo-atendimento":
      return "Novo Atendimento";
    case "fila":
      return "Fila";
    case "agendamentos":
      return "Agendamentos";
    case "caixa":
      return "Caixa";
    case "funcionarios":
      return "Funcionários";
    case "servicos":
      return "Serviços";
    case "clientes":
      return "Clientes";
    case "relatorios":
      return "Relatórios";
    case "configuracoes":
      return "Configurações";
    case "minha-fila":
      return "Minha Fila";
    case "todos-os-carros":
      return "Todos os Carros";
    case "historico-do-dia":
      return "Histórico do Dia";
    default:
      return "Painel";
  }
}
