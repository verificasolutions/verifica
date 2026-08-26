"use server";

import { likeLandingPostUseCase } from "@/backend/use-cases/public/like-landing-post";
import { submitLandingCommentUseCase } from "@/backend/use-cases/public/submit-landing-comment";

export async function likeLandingPostAction(assetId: string): Promise<{ count: number } | { error: string }> {
  const result = await likeLandingPostUseCase({ assetId });
  if (result.error) {
    return { error: result.error };
  }
  return { count: result.data!.count };
}

export async function submitLandingCommentAction(input: {
  assetId: string;
  authorName: string;
  body: string;
}): Promise<{ ok: true; message: string } | { error: string }> {
  const result = await submitLandingCommentUseCase(input);
  if (result.error) {
    return { error: result.error };
  }
  return { ok: true, message: "Comentário enviado e aguardando aprovação." };
}
