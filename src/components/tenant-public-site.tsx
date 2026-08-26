import type { Metadata } from "next";
import { Suspense } from "react";
import type { CSSProperties } from "react";
import { getPublicTenantSiteCritical, getPublicTenantSiteSecondary } from "@/backend/repos/public-tenant-site-repo";
import { LandingGalleryDrawer } from "@/components/landing/gallery-drawer";
import { LandingPostCarousel } from "@/components/landing/post-carousel";
import { LandingImage } from "@/components/landing/landing-image";
import { deriveLandingTimeline } from "@/backend/shared/landing-timeline";
import { buildGoogleMapsDirectionsLink, buildGoogleMapsEmbedUrl } from "@/backend/shared/tenant-location";
import { getOptionalGoogleMapsApiKey } from "@/lib/env";
import { LANDING_CARD_GRADIENT, LANDING_SECTION_GRADIENT } from "@/components/landing/visual-tokens";

function digitsOnly(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function buildWhatsappUrl(phone: string | null | undefined, message: string | null | undefined) {
  const digits = digitsOnly(phone);
  if (!digits) return null;
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  const text = encodeURIComponent((message ?? "Olá, vim pela sua página pública.").trim());
  return `https://wa.me/${normalized}?text=${text}`;
}

function formatPhone(phone: string | null | undefined) {
  const digits = digitsOnly(phone);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  return phone ?? "";
}

function parseOpeningHoursList(value: string | null | undefined) {
  return (value ?? "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

type PublicPost = {
  id: string;
  title: string;
  caption: string;
  createdAt: string;
  cta?: string | null;
  imageUrl?: string | null;
  images?: string[];
  likeCount?: number;
  comments?: Array<{ id: string; author_name: string; body: string; created_at: string }>;
};

type PublicReview = {
  id: string;
  customerName: string;
  rating: number;
  quote: string;
};

function encodeSvg(svg: string) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function inferThematicBackground(input: {
  category: string | null | undefined;
  companyName: string;
  services: Array<{ name: string }>;
}) {
  const haystack = [input.category, input.companyName, ...input.services.map((service) => service.name)].join(" ").toLowerCase();

  if (/(pet|banho|tosa|veter|animal|cachorr|gato)/i.test(haystack)) {
    return "pet";
  }

  if (/(funilar|polimento|vitrifica|martelinho|est[ée]tica automotiva|detalhamento)/i.test(haystack)) {
    return "bodyshop";
  }

  if (/(oficina|mec[âa]nic|motor|inje[cç][ãa]o|freio|suspens[aã]o)/i.test(haystack)) {
    return "mechanic";
  }

  return "wash";
}

function buildLandingBackgroundStyle(input: {
  backgroundStyle:
    | "dark"
    | "white"
    | "gray"
    | "black"
    | "lilac"
    | "theme"
    | "water"
    | "pet"
    | "bodyshop"
    | "mechanic"
    | "fashion"
    | "furniture";
  category: string | null | undefined;
  companyName: string;
  services: Array<{ name: string }>;
}): CSSProperties {
  if (input.backgroundStyle === "white") {
    return {
      backgroundColor: "#f3f5f7",
      backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(237,241,245,0.98))",
    };
  }

  if (input.backgroundStyle === "gray") {
    return {
      backgroundColor: "#d9dee4",
      backgroundImage: "linear-gradient(180deg, rgba(232,236,241,0.98), rgba(214,220,228,0.98))",
    };
  }

  if (input.backgroundStyle === "black") {
    return {
      backgroundColor: "#eef7f5",
      backgroundImage: "linear-gradient(180deg, rgba(238,247,245,1), rgba(224,240,236,1))",
    };
  }

  if (input.backgroundStyle === "lilac") {
    return {
      backgroundColor: "#ece7f7",
      backgroundImage: "linear-gradient(180deg, rgba(243,239,251,0.98), rgba(230,222,246,0.98))",
    };
  }

  const thematic =
    input.backgroundStyle === "theme"
      ? inferThematicBackground(input)
      : input.backgroundStyle === "water"
        ? "wash"
        : input.backgroundStyle === "pet"
          ? "pet"
          : input.backgroundStyle === "bodyshop"
            ? "bodyshop"
            : input.backgroundStyle === "mechanic"
              ? "mechanic"
              : input.backgroundStyle === "fashion"
                ? "fashion"
                : input.backgroundStyle === "furniture"
                  ? "furniture"
                  : null;

  if (thematic) {

    if (thematic === "pet") {
      return {
        backgroundColor: "#f4f7f3",
        backgroundImage: [
          "radial-gradient(circle at 12% 16%, rgba(123, 201, 168, 0.12), transparent 18%)",
          "radial-gradient(circle at 86% 14%, rgba(162, 214, 188, 0.1), transparent 16%)",
          encodeSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><g fill="rgba(90,160,130,0.14)"><g transform="translate(34 30)"><ellipse cx="30" cy="30" rx="12" ry="18"/><ellipse cx="58" cy="18" rx="14" ry="20"/><ellipse cx="94" cy="18" rx="14" ry="20"/><ellipse cx="122" cy="30" rx="12" ry="18"/><path d="M48 74c0-22 16-38 37-38s37 16 37 38c0 21-16 36-37 36S48 95 48 74Z"/></g><g transform="translate(196 124) scale(0.9)"><ellipse cx="30" cy="30" rx="12" ry="18"/><ellipse cx="58" cy="18" rx="14" ry="20"/><ellipse cx="94" cy="18" rx="14" ry="20"/><ellipse cx="122" cy="30" rx="12" ry="18"/><path d="M48 74c0-22 16-38 37-38s37 16 37 38c0 21-16 36-37 36S48 95 48 74Z"/></g><g transform="translate(196 36)"><circle cx="16" cy="24" r="12"/><circle cx="70" cy="24" r="12"/><rect x="16" y="16" width="54" height="16" rx="8"/><circle cx="10" cy="16" r="8"/><circle cx="76" cy="16" r="8"/><circle cx="10" cy="32" r="8"/><circle cx="76" cy="32" r="8"/></g><g transform="translate(26 154)"><circle cx="28" cy="28" r="22" fill="none" stroke="rgba(90,160,130,0.16)" stroke-width="4"/><path d="M28 28l22-10" fill="none" stroke="rgba(90,160,130,0.16)" stroke-width="4" stroke-linecap="round"/><path d="M20 10c10 8 12 20 8 30" fill="none" stroke="rgba(90,160,130,0.16)" stroke-width="4" stroke-linecap="round"/></g></g></svg>`),
          "linear-gradient(180deg, rgba(251,252,251,0.96), rgba(239,244,241,0.96))",
        ].join(", "),
        backgroundSize: "auto, auto, 320px 240px, auto",
      };
    }

    if (thematic === "bodyshop") {
      return {
        backgroundColor: "#f4f2ef",
        backgroundImage: [
          "radial-gradient(circle at 14% 18%, rgba(175, 190, 201, 0.12), transparent 18%)",
          "radial-gradient(circle at 82% 14%, rgba(134, 176, 196, 0.08), transparent 16%)",
          encodeSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><g fill="none" stroke="rgba(82,120,138,0.09)" stroke-width="2"><circle cx="78" cy="116" r="34"/><circle cx="78" cy="116" r="16"/><path d="M112 116h92"/><path d="M204 116l28-18"/><path d="M204 116l28 18"/><path d="M50 86l20 20"/><path d="M50 146l20-20"/><rect x="214" y="94" width="56" height="44" rx="14"/><path d="M250 84l20-16"/><path d="M250 148l20 16"/></g></svg>`),
          "linear-gradient(180deg, rgba(250,248,245,0.97), rgba(239,235,229,0.97))",
        ].join(", "),
        backgroundSize: "auto, auto, 320px 240px, auto",
      };
    }

    if (thematic === "mechanic") {
      return {
        backgroundColor: "#eef2f5",
        backgroundImage: [
          "radial-gradient(circle at 14% 18%, rgba(141, 165, 184, 0.1), transparent 16%)",
          "radial-gradient(circle at 84% 12%, rgba(122, 152, 178, 0.08), transparent 18%)",
          encodeSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="340" height="240" viewBox="0 0 340 240"><g fill="none" stroke="rgba(70,98,124,0.09)" stroke-width="2"><rect x="34" y="88" width="112" height="64" rx="18"/><circle cx="74" cy="120" r="18"/><circle cx="74" cy="120" r="7"/><circle cx="118" cy="120" r="12"/><path d="M146 120h54"/><path d="M200 102h52v36h-52z"/><path d="M252 110h34"/><path d="M252 130h34"/><path d="M182 76l18 18"/><path d="M182 164l18-18"/></g></svg>`),
          "linear-gradient(180deg, rgba(247,250,252,0.97), rgba(232,238,242,0.97))",
        ].join(", "),
        backgroundSize: "auto, auto, 340px 240px, auto",
      };
    }

    if (thematic === "fashion") {
      return {
        backgroundColor: "#f7f1f4",
        backgroundImage: [
          "radial-gradient(circle at 14% 18%, rgba(221, 171, 197, 0.12), transparent 16%)",
          "radial-gradient(circle at 84% 12%, rgba(194, 158, 214, 0.09), transparent 18%)",
          encodeSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><g fill="none" stroke="rgba(167,111,143,0.10)" stroke-width="2"><path d="M84 62c12 18 24 30 36 42 10 10 18 26 18 42v42"/><path d="M236 62c-12 18-24 30-36 42-10 10-18 26-18 42v42"/><path d="M118 92h84"/><path d="M102 180h116"/><path d="M74 170c26-8 52-12 86-12s60 4 86 12"/><circle cx="160" cy="50" r="14"/></g></svg>`),
          "linear-gradient(180deg, rgba(252,248,250,0.97), rgba(243,233,239,0.97))",
        ].join(", "),
        backgroundSize: "auto, auto, 320px 240px, auto",
      };
    }

    if (thematic === "furniture") {
      return {
        backgroundColor: "#f4f1eb",
        backgroundImage: [
          "radial-gradient(circle at 12% 16%, rgba(189, 160, 126, 0.10), transparent 16%)",
          "radial-gradient(circle at 84% 10%, rgba(148, 126, 96, 0.08), transparent 18%)",
          encodeSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="340" height="240" viewBox="0 0 340 240"><g fill="none" stroke="rgba(139,106,74,0.10)" stroke-width="2"><rect x="42" y="74" width="106" height="78" rx="6"/><path d="M58 152v34"/><path d="M132 152v34"/><path d="M170 96h122"/><path d="M170 126h122"/><path d="M170 156h122"/><path d="M202 82v90"/><path d="M260 82v90"/></g></svg>`),
          "linear-gradient(180deg, rgba(250,247,242,0.97), rgba(239,232,221,0.97))",
        ].join(", "),
        backgroundSize: "auto, auto, 340px 240px, auto",
      };
    }

    return {
      backgroundColor: "#eef8fb",
      backgroundImage: [
        "radial-gradient(circle at 14% 18%, rgba(86, 214, 228, 0.14), transparent 16%)",
        "radial-gradient(circle at 84% 10%, rgba(102, 189, 221, 0.12), transparent 16%)",
        encodeSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><g fill="none" stroke="rgba(61,163,187,0.10)" stroke-width="2"><path d="M0 74c34 0 34 18 68 18s34-18 68-18 34 18 68 18 34-18 68-18 34 18 68 18"/><path d="M0 126c34 0 34 18 68 18s34-18 68-18 34 18 68 18 34-18 68-18 34 18 68 18"/><circle cx="64" cy="44" r="10"/><circle cx="110" cy="58" r="6"/><circle cx="254" cy="52" r="12"/><circle cx="286" cy="84" r="7"/><circle cx="162" cy="182" r="9"/></g></svg>`),
        "linear-gradient(180deg, rgba(249,253,254,0.97), rgba(232,244,247,0.97))",
      ].join(", "),
      backgroundSize: "auto, auto, 320px 240px, auto",
    };
  }

  return {
    backgroundColor: "#eef7f5",
    backgroundImage: "linear-gradient(180deg, rgba(238,247,245,1), rgba(224,240,236,1))",
  };
}

export async function getTenantPublicSite(slug: string) {
  return getPublicTenantSiteCritical(slug);
}

export async function buildTenantPublicMetadata(slug: string, origin: string): Promise<Metadata | null> {
  const site = await getTenantPublicSite(slug);
  if (!site || !site.tenantSettings?.landing_enabled || (site.landing && !site.landing.is_published)) {
    return null;
  }

  const companyName = site.singleSource.displayName;
  const description =
    site.landing?.bio?.trim() ||
    `${companyName} em ${site.singleSource.cityLabel ?? "sua região"}. Serviços automotivos, publicações reais e atendimento direto no WhatsApp.`;
  const url = `${origin.replace(/\/+$/, "")}/${slug}`;
  const image = site.landing?.cover_image_url ?? site.landing?.profile_image_url ?? null;

  return {
    title: `${companyName} | Verifica Solutions`,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: companyName,
      description,
      url,
      siteName: "Verifica Solutions",
      locale: "pt_BR",
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: companyName,
      description,
      images: image ? [image] : undefined,
    },
  };
}

function LandingSectionsSkeleton() {
  return (
    <>
      <section className={`rounded-[28px] border border-black/10 ${LANDING_SECTION_GRADIENT} p-6`}>
        <div className="h-4 w-44 animate-pulse rounded bg-black/10" />
        <div className="mt-3 h-8 w-72 animate-pulse rounded bg-black/10" />
        <div className="mt-6 aspect-square w-full max-w-2xl animate-pulse rounded-[26px] bg-black/10" />
      </section>
      <section className={`rounded-[28px] border border-black/10 ${LANDING_SECTION_GRADIENT} p-6`}>
        <div className="h-4 w-40 animate-pulse rounded bg-black/10" />
        <div className="mt-3 h-8 w-72 animate-pulse rounded bg-black/10" />
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-[20px] bg-black/10" />
          ))}
        </div>
      </section>
    </>
  );
}

async function DeferredLandingSections({ slug }: { slug: string }) {
  const secondary = await getPublicTenantSiteSecondary(slug);
  if (!secondary) {
    return null;
  }

  const posts = secondary.posts ?? [];
  const reviews = secondary.reviews ?? [];
  const beforeAfter = secondary.beforeAfter ?? [];
  const timeline = deriveLandingTimeline(posts);

  return (
    <>
      {beforeAfter.length > 0 ? (
        <section id="antes-depois" className={`rounded-[28px] border border-black/10 ${LANDING_SECTION_GRADIENT} p-6`}>
          <p className="text-xs uppercase tracking-[0.3em] text-landing-text">Antes e depois</p>
          <h2 className="mt-2 text-3xl font-semibold text-landing-text">Transformações reais</h2>
          <div className="mt-6 space-y-6">
            {beforeAfter.map((item: { id: string; title: string; caption: string; beforeUrl?: string | null; afterUrl?: string | null }) => (
              <article key={item.id} className={`rounded-[24px] border border-black/10 ${LANDING_CARD_GRADIENT} p-4`}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="overflow-hidden rounded-[20px] border border-black/10 bg-[#0d1218]">
                    {item.beforeUrl ? (
                      <LandingImage
                        src={item.beforeUrl}
                        alt={`Antes ${item.title}`}
                        width={960}
                        height={720}
                        sizes="(min-width: 768px) 50vw, 100vw"
                        className="h-full w-full object-contain"
                      />
                    ) : null}
                  </div>
                  <div className="overflow-hidden rounded-[20px] border border-black/10 bg-[#0d1218]">
                    {item.afterUrl ? (
                      <LandingImage
                        src={item.afterUrl}
                        alt={`Depois ${item.title}`}
                        width={960}
                        height={720}
                        sizes="(min-width: 768px) 50vw, 100vw"
                        className="h-full w-full object-contain"
                      />
                    ) : null}
                  </div>
                </div>
                <p className="mt-4 text-lg font-semibold text-landing-text">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-landing-text">{item.caption}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section id="feed" className={`rounded-[28px] border border-black/10 ${LANDING_SECTION_GRADIENT} p-6`}>
        <p className="text-xs uppercase tracking-[0.3em] text-landing-text">Publicações</p>
        <h2 className="mt-2 text-3xl font-semibold text-landing-text">Feed da operação</h2>

        <div className="mx-auto mt-6 flex max-w-2xl flex-col gap-6">
          {timeline.feed.map((post: PublicPost) => (
            <LandingPostCarousel
              key={post.id}
              anchorId={`post-${post.id}`}
              postId={post.id}
              title={post.title}
              caption={post.caption}
              dateLabel={formatDateLabel(post.createdAt)}
              cta={post.cta}
              images={post.images ?? []}
              initialLikeCount={post.likeCount ?? 0}
              comments={post.comments ?? []}
            />
          ))}
          {posts.length === 0 ? (
            <p className="text-center text-sm text-landing-text">Publicações aprovadas aparecerão aqui.</p>
          ) : null}
        </div>
      </section>

      <section id="galeria" className={`rounded-[28px] border border-black/10 ${LANDING_SECTION_GRADIENT} p-6`}>
        <p className="text-xs uppercase tracking-[0.3em] text-landing-text">Galeria</p>
        <h2 className="mt-2 text-3xl font-semibold text-landing-text">Fotos da operação</h2>
        <div className="mt-6 grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {timeline.gallery.map((post: PublicPost) => (
            <a
              key={post.id}
              href={`#post-${post.id}`}
              className={`group overflow-hidden rounded-[20px] border border-black/10 ${LANDING_CARD_GRADIENT}`}
            >
              {post.imageUrl ? (
                <LandingImage
                  src={post.imageUrl}
                  alt={post.title}
                  width={640}
                  height={640}
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="aspect-square h-full w-full object-cover transition group-hover:brightness-110"
                />
              ) : null}
              <p className="line-clamp-2 p-3 text-sm text-landing-text">{post.title}</p>
            </a>
          ))}
        </div>
        {posts.length > 8 ? (
          <div className="mt-4">
            <LandingGalleryDrawer
              images={timeline.drawer.map((post) => ({ id: post.id, url: post.imageUrl ?? "", title: post.title }))}
              triggerLabel="Ver todas"
            />
          </div>
        ) : null}
        {posts.length === 0 ? (
          <p className="mt-3 text-center text-sm text-landing-text">As publicações aprovadas aparecerão aqui.</p>
        ) : null}
      </section>

      <section id="avaliacoes" className={`rounded-[28px] border border-black/10 ${LANDING_SECTION_GRADIENT} p-6`}>
        <p className="text-xs uppercase tracking-[0.3em] text-landing-text">Avaliações</p>
        <h2 className="mt-2 text-3xl font-semibold text-landing-text">Clientes falando da experiência</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reviews.map((review: PublicReview) => (
            <article key={review.id} className={`rounded-[24px] border border-black/10 ${LANDING_CARD_GRADIENT} p-5`}>
              <p className="text-sm text-landing-text">{"★".repeat(review.rating)}</p>
              <p className="mt-4 text-base leading-7 text-landing-text">“{review.quote}”</p>
              <p className="mt-5 text-sm font-semibold text-landing-text">{review.customerName}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export async function TenantPublicSite({ slug, origin }: { slug: string; origin: string }) {
  const site = await getTenantPublicSite(slug);

  if (!site || !site.tenantSettings?.landing_enabled || (site.landing && !site.landing.is_published)) {
    return null;
  }

  const companyName = site.singleSource.displayName;
  const cityLabel = site.singleSource.cityLabel;
  const resolvedAddressLabel = site.singleSource.addressLabel;
  const mapsApiKey = getOptionalGoogleMapsApiKey();
  const resolvedMapEmbedUrl = buildGoogleMapsEmbedUrl(resolvedAddressLabel, mapsApiKey);
  const mapsLink = buildGoogleMapsDirectionsLink(resolvedAddressLabel);
  const contactEmail = site.singleSource.email;
  const website = site.singleSource.website;
  const whatsapp = site.singleSource.phone;
  const whatsappUrl = buildWhatsappUrl(whatsapp, site.landing?.cta_whatsapp_message);
  const callHref = whatsapp ? `tel:${digitsOnly(whatsapp)}` : null;
  const canonicalUrl = `${origin.replace(/\/+$/, "")}/${slug}`;
  const pageBackgroundStyle = buildLandingBackgroundStyle({
    backgroundStyle: site.landing?.background_style ?? "dark",
    category: site.landing?.category,
    companyName,
    services: site.services.map((service) => ({ name: service.name })),
  });
  const highlightItems = [
    { id: "antes-depois", label: "Antes/Depois" },
    { id: "servicos", label: "Serviços" },
    { id: "feed", label: "Publicações" },
    { id: "galeria", label: "Galeria" },
    { id: "avaliacoes", label: "Avaliações" },
    { id: "informacoes", label: "Localização" },
  ];

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "AutomotiveBusiness",
    name: companyName,
    description: site.landing?.bio ?? undefined,
    telephone: whatsapp ?? undefined,
    image: [site.landing?.cover_image_url, site.landing?.profile_image_url].filter(Boolean),
    address: resolvedAddressLabel ?? undefined,
    areaServed: cityLabel || undefined,
    url: canonicalUrl,
  };

  return (
    <main className="min-h-screen text-landing-text" style={pageBackgroundStyle}>
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }} />

      <section className="border-b border-black/10">
        <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
          <div
            className="relative min-h-[300px] overflow-hidden rounded-[34px] border border-black/10 sm:min-h-[380px] lg:min-h-[460px]"
            style={{
              backgroundImage:
                "radial-gradient(circle at top left, rgba(0,245,212,0.20), transparent 28%), linear-gradient(180deg, rgba(10,15,21,1), rgba(8,11,17,1))",
              backgroundColor: "#081018",
            }}
          >
            {site.landing?.cover_image_url ? (
              // capa é LCP: eager + alta prioridade, dimensões estáveis (min-h fixo) e fallback do gradiente atrás
              <LandingImage
                src={site.landing.cover_image_url}
                alt={`Capa ${companyName}`}
                fill
                sizes="(min-width: 1024px) 1152px, (min-width: 640px) calc(100vw - 3rem), calc(100vw - 2rem)"
                priority
                className="object-contain"
              />
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className={`rounded-[30px] border border-black/10 ${LANDING_CARD_GRADIENT} p-6 shadow-[0_20px_70px_rgba(0,0,0,0.28)]`}>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-[28px] border border-black/15 bg-black/8 shadow-[0_16px_42px_rgba(0,0,0,0.3)]">
                {site.landing?.profile_image_url ? (
                  <LandingImage
                    src={site.landing.profile_image_url}
                    alt={companyName}
                    width={112}
                    height={112}
                    sizes="112px"
                    priority
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-semibold text-landing-text">{companyName.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div>
                <h1 className="mt-3 text-4xl font-semibold text-landing-text sm:text-5xl">{companyName}</h1>
                {site.landing?.category ? <p className="mt-3 text-lg text-landing-text">{site.landing.category}</p> : null}
                {cityLabel ? <p className="mt-1 text-sm text-landing-text">{cityLabel}</p> : null}
                {site.landing?.bio ? <p className="mt-4 max-w-2xl text-sm leading-7 text-landing-text">{site.landing.bio}</p> : null}
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 sm:max-w-[300px]">
              {whatsappUrl ? (
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-black/10 bg-black/5 px-5 text-sm font-semibold text-landing-text">
                  WhatsApp
                </a>
              ) : null}
              {callHref ? (
                <a href={callHref} className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-black/10 bg-black/5 px-5 text-sm font-semibold text-landing-text">
                  Ligar
                </a>
              ) : null}
              {site.landing?.instagram_url ? (
                <a href={site.landing.instagram_url} target="_blank" rel="noreferrer" className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-black/10 bg-black/5 px-5 text-sm font-semibold text-landing-text">
                  Instagram
                </a>
              ) : null}
              {resolvedAddressLabel ? (
                <a href="#informacoes" className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-black/10 bg-black/5 px-5 text-sm font-semibold text-landing-text">
                  Localização
                </a>
              ) : null}
              {website ? (
                <a href={website} target="_blank" rel="noreferrer" className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-black/10 bg-black/5 px-5 text-sm font-semibold text-landing-text">
                  Site
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className={`rounded-[28px] border border-black/10 ${LANDING_SECTION_GRADIENT} p-6`}>
          <p className="text-xs uppercase tracking-[0.3em] text-landing-text">Destaques</p>
          <div className="mt-5 grid gap-4 grid-cols-3 sm:grid-cols-6">
            {highlightItems.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="group flex flex-col items-center gap-3 text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#063b66] bg-[linear-gradient(180deg,#0b5fa5,#063b66)] text-xs font-semibold text-white transition group-hover:border-[var(--accent)]">
                  {item.label.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-xs text-landing-text">{item.label}</span>
              </a>
            ))}
          </div>
        </section>

        <section id="servicos" className={`rounded-[28px] border border-black/10 ${LANDING_SECTION_GRADIENT} p-6`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-landing-text">Serviços</p>
              <h2 className="mt-2 text-3xl font-semibold text-landing-text">O que fazemos</h2>
            </div>
            {whatsappUrl ? (
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-black/10 bg-black/5 px-4 py-2 text-sm text-landing-text">
                Solicitar orçamento
              </a>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {site.services.map((service) => (
              <article key={service.id} className={`rounded-[24px] border border-black/10 ${LANDING_CARD_GRADIENT} p-5`}>
                <p className="text-lg font-semibold text-landing-text">{service.name}</p>
                <p className="mt-2 text-sm leading-6 text-landing-text">{service.shortDescription ?? "Serviço configurado dentro da operação do tenant."}</p>
                <p className="mt-4 text-sm font-semibold text-landing-text">A partir de {formatCurrency(service.startingPrice)}</p>
              </article>
            ))}
          </div>
        </section>

        <Suspense fallback={<LandingSectionsSkeleton />}>
          {/* feed, galeria, antes/depois e avaliações NÃO bloqueiam o hero/perfil (streaming) */}
          <DeferredLandingSections slug={slug} />
        </Suspense>

        <section id="informacoes" className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className={`rounded-[28px] border border-black/10 ${LANDING_SECTION_GRADIENT} p-6`}>
            <p className="text-xs uppercase tracking-[0.3em] text-landing-text">Informações</p>
            <h2 className="mt-2 text-3xl font-semibold text-landing-text">Contato</h2>
            <div className="mt-6 space-y-4 text-sm text-landing-text">
              {whatsapp ? <p><span className="text-landing-text">WhatsApp:</span> {formatPhone(whatsapp)}</p> : null}
              {whatsappUrl ? (
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-landing-text">
                  Chamar no WhatsApp
                </a>
              ) : null}
              {contactEmail ? <p><span className="text-landing-text">E-mail:</span> {contactEmail}</p> : null}
              {parseOpeningHoursList(site.landing?.opening_hours).length > 0 ? (
                <div>
                  <p><span className="text-landing-text">Horário:</span></p>
                  <div className="mt-2 space-y-1">
                    {parseOpeningHoursList(site.landing?.opening_hours).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              ) : null}
              {resolvedAddressLabel ? <p><span className="text-landing-text">Endereço:</span> {resolvedAddressLabel}</p> : null}
            </div>
          </div>

          <div className={`flex flex-col items-stretch overflow-hidden rounded-[28px] border border-black/10 ${LANDING_SECTION_GRADIENT} p-4`}>
            {resolvedMapEmbedUrl ? (
              <iframe
                src={resolvedMapEmbedUrl}
                className="h-[320px] w-full rounded-[24px] border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Mapa ${companyName}`}
              />
            ) : resolvedAddressLabel ? (
              <div className="flex h-[320px] w-full flex-col items-center justify-center gap-3 rounded-[24px] bg-black/20 px-6 text-center text-sm text-landing-text">
                <p>{resolvedAddressLabel}</p>
                {mapsLink ? (
                  <a href={mapsLink} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-landing-text">
                    Ver no Google Maps
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="flex h-[320px] w-full items-center justify-center rounded-[24px] bg-black/20 text-sm text-landing-text">
                Endereço não cadastrado no cadastro.
              </div>
            )}
            {mapsLink ? (
              <a href={mapsLink} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-2xl border border-black/10 bg-black/5 px-4 text-sm text-landing-text">
                Abrir no Google Maps
              </a>
            ) : null}
          </div>
        </section>

        <section className={`rounded-[30px] border border-black/10 ${LANDING_CARD_GRADIENT} p-6`}>
          <p className="text-xs uppercase tracking-[0.3em] text-landing-text">Agendamento</p>
          <h2 className="mt-2 text-3xl font-semibold text-landing-text">Quer agendar agora?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-landing-text">
            Fale direto com a equipe e solicite seu orçamento sem sair desta página.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {whatsappUrl ? (
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-landing-text">
                Chamar no WhatsApp
              </a>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
