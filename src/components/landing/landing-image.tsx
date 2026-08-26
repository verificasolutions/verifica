"use client";

/**
 * Imagem da landing pública — SEM otimizador do Next para URLs assinadas do Supabase Storage:
 * o optimizer devolve 400 INVALID_IMAGE_OPTIMIZE_REQUEST para essas URLs (provado em produção).
 * Usa <img> nativo com src direto da URL assinada, prioridade explícita (hero/perfil eager+high,
 * demais lazy) e fallback onError sem quebrar o layout (visibility hidden preserva o espaço).
 */
type Props = {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
};

export function LandingImage({ src, alt, sizes, className, fill = false, width, height, priority = false }: Props) {
  const loading = priority ? "eager" : "lazy";
  const fetchPriority = priority ? ("high" as const) : undefined;

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      onError={(event) => {
        // fallback visual: esconde a imagem quebrada mantendo o espaço (sem layout shift);
        // o fundo do container (gradiente/moldura) fica visível no lugar.
        event.currentTarget.style.visibility = "hidden";
      }}
      onLoad={(event) => {
        event.currentTarget.style.visibility = "";
      }}
      className={className}
      style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%" } : undefined}
    />
  );
}
