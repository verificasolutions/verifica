import Link from "next/link";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { BusinessHoursField } from "@/components/business-hours-field";
import { LandingPageForm } from "@/components/landing-page-form";
import { getAppUrl } from "@/backend/shared/app-url";
import { getLandingWorkspaceUseCase } from "@/backend/use-cases/tenant/get-landing-workspace";
import { listPendingLandingCommentsUseCase } from "@/backend/use-cases/tenant/review-landing-comment";
import { deleteLandingReviewAction, saveLandingReviewAction, reviewLandingCommentAction } from "./actions";

// a tela interna reflete sempre a URL pública atual do deploy (sem cache obsoleto)
export const dynamic = "force-dynamic";

function normalizeWhatsappLink(value: string | null | undefined, fallbackMessage: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const message = encodeURIComponent((fallbackMessage ?? "").trim());
  return `https://wa.me/55${digits}?text=${message}`;
}

function formatPublicPath(slug: string | null | undefined) {
  return slug ? `/verifica/${slug}` : null;
}

export default async function LandingWorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await getLandingWorkspaceUseCase();
  const pendingComments = await listPendingLandingCommentsUseCase();
  const params = searchParams ? await searchParams : {};
  const message = typeof params.message === "string" ? params.message : "";
  const error = typeof params.error === "string" ? params.error : "";
  const publicPath = formatPublicPath(workspace.tenant.slug);
  const publicUrl = publicPath ? `${getAppUrl()}${publicPath.replace(/^\/verifica/, "")}` : null;
  const landingUnlocked = workspace.settings?.landing_enabled ?? false;
  const whatsappLink = normalizeWhatsappLink(
    workspace.companyProfile?.phone ?? workspace.companyProfile?.phone_secondary ?? workspace.tenant.whatsapp,
    workspace.landing?.cta_whatsapp_message ?? "Olá, vim pela sua página pública.",
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(0,245,212,0.16),transparent_30%),linear-gradient(180deg,rgba(15,20,27,0.98),rgba(9,12,18,1))] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
        <div className="mb-5">
          <Link href="/app/dashboard?section=adm" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white/82">
            Voltar para ADM
          </Link>
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(500px,0.62fr)] lg:items-start">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--accent)]">Landing Page</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Perfil público do tenant</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/62">
              Aqui você controla a vitrine pública da sua operação: capa, perfil, botões, serviços, publicações aprovadas e avaliações.
            </p>
          </div>

          <div className="grid w-full max-w-[540px] gap-3 self-start sm:grid-cols-2 lg:justify-self-start">
            <div className="min-w-0 rounded-[22px] border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.24em] text-white/42">Slug público</p>
              <p className="mt-2 text-sm font-semibold text-white">{workspace.tenant.slug ?? "Sem slug"}</p>
            </div>
            <div className="min-w-0 rounded-[22px] border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.24em] text-white/42">URL pública</p>
              {publicUrl && landingUnlocked ? (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block break-all text-xs font-semibold text-[var(--accent)] sm:text-sm"
                >
                  {publicUrl}
                </a>
              ) : (
                <p className="mt-2 text-sm font-semibold text-white/48">{publicPath ? "Bloqueada pelo admin" : "Sem URL"}</p>
              )}
            </div>
          </div>
        </div>

        {message ? <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{message}</div> : null}
        {error ? <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
        {!landingUnlocked ? (
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            O admin master ainda não liberou a landing pública para este tenant.
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
        <div className="space-y-6">
          <div className="rounded-[26px] border border-white/10 bg-[#11161d] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-white">Perfil e identidade</p>
                <p className="mt-1 text-sm text-white/56">Capa, foto, bio, cidade e links principais.</p>
              </div>
              {publicUrl && landingUnlocked ? (
                <a href={publicUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
                  Abrir página
                </a>
              ) : null}
            </div>

            <LandingPageForm actionUrl="/verifica/app/landing/save" className="mt-5 space-y-4">
              <input type="hidden" name="current_cover_image_url" value={workspace.landing?.cover_image_storage_path ?? ""} />
              <input type="hidden" name="current_profile_image_url" value={workspace.landing?.profile_image_storage_path ?? ""} />

              <div className="grid gap-4 md:grid-cols-2">
                <input name="category" defaultValue={workspace.landing?.category ?? ""} placeholder="Categoria do negócio" className="h-12 rounded-2xl border border-white/10 bg-[#0c1117] px-4 text-sm text-white outline-none" />
                <div className="flex items-center rounded-2xl border border-white/10 bg-[#0c1117] px-4 text-sm text-white/60">
                  {[workspace.companyProfile?.city, workspace.companyProfile?.state].filter(Boolean).join(" - ") || "Cidade/estado vêm do cadastro (ADM)"}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,280px)_1fr]">
                <select
                  name="background_style"
                  defaultValue={workspace.landing?.background_style ?? "dark"}
                  className="h-12 rounded-2xl border border-white/10 bg-[#0c1117] px-4 text-sm text-white outline-none"
                >
                  <option value="dark">Fundo sólido escuro</option>
                  <option value="white">Fundo branco</option>
                  <option value="gray">Fundo cinza</option>
                  <option value="black">Fundo preto</option>
                  <option value="lilac">Fundo lilás</option>
                  <option value="theme">Fundo temático automático</option>
                  <option value="water">Fundo aquático</option>
                  <option value="pet">Fundo de patinhas</option>
                  <option value="mechanic">Fundo de motor</option>
                  <option value="bodyshop">Fundo de funilaria</option>
                  <option value="fashion">Fundo de moda</option>
                  <option value="furniture">Fundo de móveis e marcenaria</option>
                </select>
                <AuthSubmitButton
                  label="Trocar o fundo"
                  pendingLabel="Aplicando fundo..."
                  className="flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>

              <textarea name="bio" defaultValue={workspace.landing?.bio ?? ""} rows={4} placeholder="Bio curta da empresa" className="w-full rounded-[22px] border border-white/10 bg-[#0c1117] px-4 py-3 text-sm text-white outline-none" />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[22px] border border-white/10 bg-[#0c1117] p-4">
                  <p className="text-sm font-semibold text-white">Foto de capa</p>
                  <input type="file" name="cover_image_file" accept="image/png,image/jpeg,image/webp" className="mt-3 block w-full text-sm text-white/72 file:mr-4 file:rounded-2xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:text-white" />
                  {workspace.landing?.cover_image_url ? (
                    <img src={workspace.landing.cover_image_url} alt="Capa atual" className="mt-4 h-32 w-full rounded-[18px] object-cover" />
                  ) : null}
                </div>
                <div className="rounded-[22px] border border-white/10 bg-[#0c1117] p-4">
                  <p className="text-sm font-semibold text-white">Foto de perfil</p>
                  <input type="file" name="profile_image_file" accept="image/png,image/jpeg,image/webp" className="mt-3 block w-full text-sm text-white/72 file:mr-4 file:rounded-2xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:text-white" />
                  {workspace.landing?.profile_image_url ? (
                    <img src={workspace.landing.profile_image_url} alt="Perfil atual" className="mt-4 h-24 w-24 rounded-[18px] object-cover" />
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <input name="instagram_url" defaultValue={workspace.landing?.instagram_url ?? ""} placeholder="Link do Instagram" className="h-12 rounded-2xl border border-white/10 bg-[#0c1117] px-4 text-sm text-white outline-none" />
                <input name="facebook_url" defaultValue={workspace.landing?.facebook_url ?? ""} placeholder="Link do Facebook" className="h-12 rounded-2xl border border-white/10 bg-[#0c1117] px-4 text-sm text-white outline-none" />
              </div>

              <div className="rounded-[22px] border border-white/10 bg-[#0c1117] p-4">
                <p className="text-sm font-semibold text-white">Contato e endereço (fonte única: cadastro)</p>
                <p className="mt-2 text-sm text-white/60">
                  {(() => {
                    const addressParts = [
                      workspace.companyProfile?.street,
                      workspace.companyProfile?.street_number,
                      workspace.companyProfile?.complement,
                      workspace.companyProfile?.neighborhood,
                      workspace.companyProfile?.city,
                      workspace.companyProfile?.state,
                    ].filter(Boolean);
                    const address = addressParts.join(", ");
                    return address ? `${address}${workspace.companyProfile?.postal_code ? `, CEP ${workspace.companyProfile.postal_code}` : ""}` : "Endereço não cadastrado.";
                  })()}
                </p>
                <p className="mt-2 text-sm text-white/60">
                  WhatsApp: {workspace.companyProfile?.phone ?? workspace.companyProfile?.phone_secondary ?? workspace.tenant.whatsapp ?? "-"} · E-mail:{" "}
                  {workspace.companyProfile?.email ?? "-"} · Site: {workspace.companyProfile?.website ?? "-"}
                </p>
                <p className="mt-2 text-xs text-white/38">
                  Nome, telefone, e-mail, endereço, CEP, cidade/estado e site são editados no cadastro (ADM). A landing sempre exibe os valores atuais.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <BusinessHoursField name="opening_hours" defaultValue={workspace.landing?.opening_hours ?? ""} />
                <div className="flex items-center rounded-2xl border border-white/10 bg-[#0c1117] px-4 text-sm text-white/60">
                  Mapa gerado automaticamente a partir do endereço do cadastro
                </div>
              </div>

              <textarea
                name="cta_whatsapp_message"
                defaultValue={workspace.landing?.cta_whatsapp_message ?? "Olá, vim pela sua página pública e quero solicitar um orçamento."}
                rows={3}
                placeholder="Mensagem padrão do botão WhatsApp"
                className="w-full rounded-[22px] border border-white/10 bg-[#0c1117] px-4 py-3 text-sm text-white outline-none"
              />

              <input type="hidden" name="is_published" value="false" />
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white/82">
                <input type="checkbox" name="is_published" value="true" defaultChecked={workspace.landing?.is_published ?? true} className="size-4" />
                Página pública liberada
              </label>

              <AuthSubmitButton
                label="Salvar landing"
                pendingLabel="Salvando landing..."
                className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-70"
              />
            </LandingPageForm>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-[#11161d] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-white">Avaliações</p>
                <p className="mt-1 text-sm text-white/56">Cadastre prova social para aparecer na página pública.</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">{workspace.reviews.length} ativa(s)</span>
            </div>

            <form action={saveLandingReviewAction} className="mt-5 grid gap-4 rounded-[22px] border border-white/10 bg-black/15 p-4">
              <div className="grid gap-4 md:grid-cols-[1fr_120px_120px]">
                <input name="customer_name" placeholder="Nome do cliente" className="h-12 rounded-2xl border border-white/10 bg-[#0c1117] px-4 text-sm text-white outline-none" />
                <input name="rating" type="number" min="1" max="5" defaultValue="5" className="h-12 rounded-2xl border border-white/10 bg-[#0c1117] px-4 text-sm text-white outline-none" />
                <input name="sort_order" type="number" defaultValue="0" className="h-12 rounded-2xl border border-white/10 bg-[#0c1117] px-4 text-sm text-white outline-none" />
              </div>
              <textarea name="quote" rows={3} placeholder="Depoimento" className="w-full rounded-[20px] border border-white/10 bg-[#0c1117] px-4 py-3 text-sm text-white outline-none" />
              <input type="hidden" name="is_active" value="true" />
              <AuthSubmitButton
                label="Adicionar avaliação"
                pendingLabel="Salvando avaliação..."
                className="flex min-h-11 items-center justify-center rounded-2xl border border-transparent bg-white/90 px-4 text-sm font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-70"
              />
            </form>

            <div className="mt-4 space-y-3">
              {workspace.reviews.map((review) => (
                <div key={review.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{review.customer_name}</p>
                      <p className="mt-1 text-xs text-amber-200">{"★".repeat(Number(review.rating ?? 5))}</p>
                    </div>
                    <form action={deleteLandingReviewAction}>
                      <input type="hidden" name="review_id" value={review.id} />
                      <button className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">Remover</button>
                    </form>
                  </div>
                  <p className="mt-3 text-sm text-white/68">{review.quote}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-[#11161d] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-white">Comentários (revisão)</p>
                <p className="mt-1 text-sm text-white/56">Comentários ficam pendentes até aprovação do responsável.</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">{pendingComments.length} pendente(s)</span>
            </div>

            {pendingComments.length === 0 ? (
              <div className="mt-4 rounded-[20px] border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/52">
                Nenhum comentário aguardando revisão.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {pendingComments.map((comment) => (
                  <div key={comment.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-semibold text-white">{comment.author_name}</p>
                    <p className="mt-2 text-sm text-white/68">{comment.body}</p>
                    {comment.moderation_suggestion ? (
                      <p className="mt-2 rounded-[14px] border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                        Sugestão de moderação: {comment.moderation_suggestion}
                      </p>
                    ) : null}
                    <div className="mt-3 flex gap-2">
                      <form action={reviewLandingCommentAction}>
                        <input type="hidden" name="comment_id" value={comment.id} />
                        <input type="hidden" name="status" value="approved" />
                        <button className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-100">Aprovar</button>
                      </form>
                      <form action={reviewLandingCommentAction}>
                        <input type="hidden" name="comment_id" value={comment.id} />
                        <input type="hidden" name="status" value="rejected" />
                        <button className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-xs text-rose-100">Rejeitar</button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[26px] border border-white/10 bg-[#11161d] p-5">
            <p className="text-base font-semibold text-white">Resumo da página</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-white/40">Serviços</p>
                <p className="mt-2 text-sm font-semibold text-white">{workspace.services.length} ativos</p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-white/40">Publicações aprovadas</p>
                <p className="mt-2 text-sm font-semibold text-white">{workspace.assets.length} prontas para o feed</p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-white/40">WhatsApp</p>
                {whatsappLink ? (
                  <a href={whatsappLink} target="_blank" rel="noreferrer" className="mt-2 block text-sm font-semibold text-[var(--accent)]">
                    Botão pronto
                  </a>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-white/48">Sem número principal</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-[#11161d] p-5">
            <p className="text-base font-semibold text-white">Feed que já vai aparecer</p>
            <p className="mt-1 text-sm text-white/56">A landing usa as peças aprovadas do motor social.</p>
            <div className="mt-4 space-y-3">
              {workspace.assets.length === 0 ? (
                <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/52">
                  Nenhuma peça aprovada ainda.
                </div>
              ) : (
                workspace.assets.slice(0, 5).map((asset) => (
                  <div key={asset.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-semibold text-white">{asset.title ?? "Publicação"}</p>
                    <p className="mt-2 line-clamp-3 text-sm text-white/66">{asset.generated_text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
