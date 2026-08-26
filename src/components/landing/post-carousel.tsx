"use client";

import { useCallback, useState } from "react";
import { likeLandingPostAction, submitLandingCommentAction } from "@/actions/landing-actions";
import { LandingImage } from "@/components/landing/landing-image";
import { LANDING_CARD_GRADIENT } from "@/components/landing/visual-tokens";

type ApprovedComment = {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
};

type Props = {
  postId: string;
  anchorId?: string;
  title: string;
  caption: string;
  dateLabel: string;
  cta?: string | null;
  images: string[];
  initialLikeCount: number;
  comments: ApprovedComment[];
};

export function LandingPostCarousel({ postId, anchorId, title, caption, dateLabel, cta, images, initialLikeCount, comments }: Props) {
  const [index, setIndex] = useState(0);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [liking, setLiking] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const total = images.length;
  const previous = useCallback(() => setIndex((current) => (current - 1 + total) % total), [total]);
  const next = useCallback(() => setIndex((current) => (current + 1) % total), [total]);

  async function handleLike() {
    if (liking) return;
    setLiking(true);
    const result = await likeLandingPostAction(postId);
    setLiking(false);
    if ("count" in result) {
      setLikeCount(result.count);
    }
  }

  async function handleComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const result = await submitLandingCommentAction({ assetId: postId, authorName, body });
    setSubmitting(false);
    if ("ok" in result) {
      setFeedback(result.message);
      setAuthorName("");
      setBody("");
    } else {
      setFeedback(result.error);
    }
  }

  return (
    <article id={anchorId} className={`overflow-hidden rounded-[26px] border border-black/10 ${LANDING_CARD_GRADIENT}`}>
      <div className="relative flex aspect-[1/1] items-center justify-center bg-[#0d1218]">
        {images.length > 0 ? (
          <LandingImage
            src={images[index]}
            alt={`${title} - imagem ${index + 1}`}
            fill
            sizes="(min-width: 640px) 672px, calc(100vw - 4rem)"
            className="h-full w-full rounded-none object-contain"
          />
        ) : null}

        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={previous}
              aria-label="Imagem anterior"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/55 text-lg text-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Próxima imagem"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/55 text-lg text-white"
            >
              ›
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white/85">
              {index + 1} / {total}
            </span>
          </>
        ) : null}
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-semibold text-landing-text">{title}</p>
          <span className="text-xs text-landing-text">{dateLabel}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-landing-text">{caption}</p>
        {cta ? <p className="mt-4 text-sm font-semibold text-landing-text">{cta}</p> : null}

        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={handleLike}
            disabled={liking}
            aria-label="Curtir publicação"
            className="flex min-h-11 items-center gap-2 rounded-2xl border border-black/10 bg-black/5 px-4 text-sm text-landing-text transition enabled:hover:border-[var(--accent)] disabled:opacity-60"
          >
            <span aria-hidden>❤</span>
            <span>{likeCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setFormOpen((current) => !current)}
            aria-expanded={formOpen}
            className="flex min-h-11 items-center rounded-2xl border border-black/10 bg-black/5 px-4 text-sm text-landing-text"
          >
            Comentar
          </button>
        </div>

        {comments.length > 0 ? (
          <div className="mt-4 space-y-3 border-t border-black/10 pt-4">
            {comments.map((comment) => (
              <div key={comment.id}>
                <p className="text-sm font-semibold text-landing-text">{comment.author_name}</p>
                <p className="mt-0.5 text-sm leading-6 text-landing-text">{comment.body}</p>
              </div>
            ))}
          </div>
        ) : null}

        {formOpen ? (
          <form onSubmit={handleComment} className="mt-4 space-y-3 border-t border-black/10 pt-4">
            <input
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              maxLength={60}
              required
              placeholder="Seu nome"
              className="min-h-11 w-full rounded-2xl border border-black/10 bg-black/5 px-4 text-sm text-landing-text outline-none placeholder:text-landing-text"
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={500}
              required
              rows={3}
              placeholder="Seu comentário (aguarda aprovação)"
              className="w-full rounded-2xl border border-black/10 bg-black/5 px-4 py-3 text-sm text-landing-text outline-none placeholder:text-landing-text"
            />
            <button
              type="submit"
              disabled={submitting}
              className="min-h-11 w-full rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-landing-text disabled:opacity-60"
            >
              {submitting ? "Enviando..." : "Enviar comentário"}
            </button>
            {feedback ? <p className="text-sm text-landing-text">{feedback}</p> : null}
          </form>
        ) : null}
      </div>
    </article>
  );
}
