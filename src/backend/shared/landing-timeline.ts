import "server-only";

export type LandingTimeline<T> = {
  /** 3 publicações mais recentes (feed estilo Instagram). */
  feed: T[];
  /** 8 publicações mais recentes (galeria da página). */
  gallery: T[];
  /** Todas as publicações (drawer "Ver todas"). */
  drawer: T[];
};

/**
 * Linha do tempo única da landing: feed, galeria e drawer derivam da MESMA lista de
 * publicações aprovadas (ordenadas por created_at DESC). Nenhuma tabela separada.
 * Nova publicação aprovada entra no topo: sai do feed → galeria; sai da galeria → drawer.
 */
export function deriveLandingTimeline<T>(posts: T[], feedLimit = 3, galleryLimit = 8): LandingTimeline<T> {
  return {
    feed: posts.slice(0, feedLimit),
    gallery: posts.slice(0, galleryLimit),
    drawer: posts,
  };
}
