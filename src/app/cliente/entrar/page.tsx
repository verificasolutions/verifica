import { resolveTenantAction, submitPhonePlateAction, loginAction, registerAction } from "./actions";
import { SubmitButton } from "@/components/cliente/submit-button";
import { getPublicTenantSiteCritical } from "@/backend/repos/public-tenant-site-repo";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^55/, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value;
}

export default async function ClienteEntrarPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const tenant = String(params.tenant ?? "");
  const step = String(params.step ?? (tenant ? "2" : "1"));
  const error = String(params.error ?? "");
  const expired = String(params.expired ?? "") === "1";
  const mode = String(params.mode ?? "register");
  const vehicleExists = String(params.vehicle ?? "new") === "existing";
  const requiresVehicleData = mode === "register" || mode === "login_new_vehicle" || (mode === "first_access" && !vehicleExists);
  const phone = String(params.phone ?? "");
  const plate = String(params.plate ?? "").toUpperCase();
  const site = tenant ? await getPublicTenantSiteCritical(tenant) : null;
  const banner = site?.landing?.cover_image_url ?? null;

  return (
    <main
      className="relative isolate mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center overflow-hidden px-4 py-8"
      style={banner ? { backgroundImage: `linear-gradient(rgba(13,17,23,.72), rgba(13,17,23,.9)), url(${JSON.stringify(banner)})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      <div className="relative rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--card)]/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
          {site?.singleSource.displayName ?? (tenant ? `Local ${tenant}` : "Portal do cliente")}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[color:var(--text-primary)]">Acesso do cliente</h1>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">
          {step === "1" ? "Digite o código do local (QR) para começar." : tenant ? `Acesso ao portal de ${site?.singleSource.displayName ?? tenant}` : ""}
        </p>

        {/* alerta PERSISTENTE: permanece até a próxima tentativa (não é toast) */}
        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-rose-400/50 bg-rose-200 px-4 py-3 text-sm leading-6 text-black"
          >
            {error}
          </div>
        ) : null}
        {expired && !error ? (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-rose-400/50 bg-rose-200 px-4 py-3 text-sm leading-6 text-black"
          >
            Sessão expirada. Entre novamente.
          </div>
        ) : null}

        {step === "1" ? (
          <form action={resolveTenantAction} className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-[color:var(--text-secondary)]">
              Local (código do QR)
              <input
                name="tenant"
                defaultValue={tenant}
                required
                autoFocus
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 text-[color:var(--text-primary)] outline-none focus:border-[var(--accent)]"
                placeholder="ex.: lavagem-do-joao"
              />
            </label>
            <SubmitButton pendingLabel="Localizando...">Continuar</SubmitButton>
          </form>
        ) : null}

        {step === "2" ? (
          <form action={submitPhonePlateAction} className="mt-5 space-y-4">
            <input type="hidden" name="tenant" value={tenant} />
            <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 py-3 text-xs text-[color:var(--text-muted)]">
              Informe o telefone cadastrado e a placa do veículo para entrar no portal.
            </div>
            <label className="block text-sm font-medium text-[color:var(--text-secondary)]">
              Telefone
              <input
                name="phone"
                type="tel"
                inputMode="numeric"
                required
                autoFocus
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 text-[color:var(--text-primary)] outline-none focus:border-[var(--accent)]"
                placeholder="(11) 99999-9999"
              />
            </label>
            <label className="block text-sm font-medium text-[color:var(--text-secondary)]">
              Placa
              <input
                name="plate"
                required
                maxLength={8}
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 text-[color:var(--text-primary)] uppercase outline-none focus:border-[var(--accent)]"
                placeholder="ABC1D23"
              />
            </label>
            <SubmitButton pendingLabel="Consultando...">Continuar</SubmitButton>
          </form>
        ) : null}

        {step === "3" ? (
          <div className="mt-5 space-y-5">
            <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-secondary)]">
              <p>
                Telefone: <span className="font-semibold text-[color:var(--text-primary)]">{formatPhone(phone)}</span>{" "}
                · Placa: <span className="font-semibold text-[color:var(--text-primary)]">{plate}</span> · Local:{" "}
                <span className="font-semibold text-[color:var(--text-primary)]">{tenant}</span>
              </p>
            </div>

            {mode === "login" || mode === "login_new_vehicle" ? (
              <div>
                <h2 className="text-xl font-bold text-[color:var(--text-primary)]">
                  {mode === "login_new_vehicle" ? "Novo veículo" : "Entrar no portal"}
                </h2>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  {mode === "login_new_vehicle"
                    ? "Encontramos sua conta. Digite sua senha e cadastre os dados deste novo veículo."
                    : "Encontramos sua conta para este telefone e placa. Digite sua senha para continuar."}
                </p>

                <form action={loginAction} className="mt-4 space-y-4">
                  <input type="hidden" name="tenant" value={tenant} />
                  <input type="hidden" name="mode" value="login" />
                  <input type="hidden" name="vehicle" value={vehicleExists ? "existing" : "new"} />
                  <input type="hidden" name="phone" value={phone} />
                  <input type="hidden" name="plate" value={plate} />
                  <label className="block text-sm font-medium text-[color:var(--text-secondary)]">
                    Senha
                    <input
                      name="password"
                      type="password"
                      required
                      autoFocus
                      className="mt-1.5 min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 text-[color:var(--text-primary)] outline-none focus:border-[var(--accent)]"
                      placeholder="Sua senha"
                    />
                  </label>
                  {mode === "login_new_vehicle" ? (
                    <>
                      <label className="block text-sm font-medium text-[color:var(--text-secondary)]">
                        Modelo do veículo
                        <input name="vehicleModel" required className="mt-1.5 min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 text-[color:var(--text-primary)] outline-none focus:border-[var(--accent)]" placeholder="Ex.: Chevrolet Onix" />
                      </label>
                      <label className="block text-sm font-medium text-[color:var(--text-secondary)]">
                        Tipo do veículo
                        <select name="vehicleType" required defaultValue="" className="mt-1.5 min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 text-[color:var(--text-primary)] outline-none focus:border-[var(--accent)]">
                          <option value="" disabled>Selecione</option>
                          <option value="hatch">Hatch</option>
                          <option value="sedan">Sedan</option>
                          <option value="suv">SUV</option>
                          <option value="pickup">Pickup</option>
                          <option value="van">Van</option>
                          <option value="moto">Moto</option>
                          <option value="outro">Outro</option>
                        </select>
                      </label>
                      <label className="block text-sm font-medium text-[color:var(--text-secondary)]">
                        Cor
                        <input name="vehicleColor" required className="mt-1.5 min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 text-[color:var(--text-primary)] outline-none focus:border-[var(--accent)]" placeholder="Ex.: Branco" />
                      </label>
                    </>
                  ) : null}
                  <SubmitButton pendingLabel="Entrando...">Entrar</SubmitButton>
                </form>
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-bold text-[color:var(--text-primary)]">
                  {mode === "first_access" ? "Primeiro acesso" : "Criar cadastro"}
                </h2>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  {mode === "first_access"
                    ? vehicleExists
                      ? "Encontramos seu cadastro e este veículo. Crie uma senha para acessar o portal."
                      : "Encontramos seu cadastro. Crie uma senha e informe os dados deste novo veículo."
                    : "Não encontramos seu cadastro neste local. Preencha os dados para criar seu acesso."}
                </p>

                <form action={registerAction} className="mt-4 space-y-4">
                  <input type="hidden" name="tenant" value={tenant} />
                  <input type="hidden" name="mode" value="register" />
                  <input type="hidden" name="vehicle" value={vehicleExists ? "existing" : "new"} />
                  <input type="hidden" name="phone" value={phone} />
                  <input type="hidden" name="plate" value={plate} />
                  {mode === "register" ? (
                    <>
                      <label className="block text-sm font-medium text-[color:var(--text-secondary)]">
                        Primeiro nome
                        <input name="firstName" required className="mt-1.5 min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 text-[color:var(--text-primary)] outline-none focus:border-[var(--accent)]" placeholder="Seu nome" />
                      </label>
                      <label className="block text-sm font-medium text-[color:var(--text-secondary)]">
                        Segundo nome
                        <input name="lastName" required className="mt-1.5 min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 text-[color:var(--text-primary)] outline-none focus:border-[var(--accent)]" placeholder="Seu sobrenome" />
                      </label>
                    </>
                  ) : null}
                  {requiresVehicleData ? <label className="block text-sm font-medium text-[color:var(--text-secondary)]">
                    Modelo do veículo
                    <input
                      name="vehicleModel"
                      required
                      className="mt-1.5 min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 text-[color:var(--text-primary)] outline-none focus:border-[var(--accent)]"
                      placeholder="Ex.: Chevrolet Onix"
                    />
                  </label> : null}
                  {requiresVehicleData ? <label className="block text-sm font-medium text-[color:var(--text-secondary)]">
                    Tipo do veículo
                    <select name="vehicleType" required defaultValue="" className="mt-1.5 min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 text-[color:var(--text-primary)] outline-none focus:border-[var(--accent)]">
                      <option value="" disabled>Selecione</option>
                      <option value="hatch">Hatch</option>
                      <option value="sedan">Sedan</option>
                      <option value="suv">SUV</option>
                      <option value="pickup">Pickup</option>
                      <option value="van">Van</option>
                      <option value="moto">Moto</option>
                      <option value="outro">Outro</option>
                    </select>
                  </label> : null}
                  {requiresVehicleData ? <label className="block text-sm font-medium text-[color:var(--text-secondary)]">
                    Cor
                    <input
                      name="vehicleColor"
                      required
                      className="mt-1.5 min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 text-[color:var(--text-primary)] outline-none focus:border-[var(--accent)]"
                      placeholder="Ex.: Branco"
                    />
                  </label> : null}
                  <label className="block text-sm font-medium text-[color:var(--text-secondary)]">
                    Senha
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={6}
                      className="mt-1.5 min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 text-[color:var(--text-primary)] outline-none focus:border-[var(--accent)]"
                      placeholder="Crie uma senha (mín. 6 caracteres)"
                    />
                  </label>
                  <SubmitButton pendingLabel="Criando conta...">Criar conta</SubmitButton>
                </form>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}
