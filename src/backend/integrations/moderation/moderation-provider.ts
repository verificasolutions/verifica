import "server-only";

/**
 * Provider server-only de moderação opcional (Gemini via GEMINI_API_KEY).
 * NUNCA publica automaticamente: o resultado é apenas uma sugestão armazenada;
 * o comentário permanece 'pending' até aprovação explícita do owner/manager.
 * Sem chave configurada, retorna null (sem moderação — fica pending).
 */
export interface CommentModerationProvider {
  moderate(input: { text: string; authorName: string }): Promise<string | null>;
}

class GeminiCommentModerationProvider implements CommentModerationProvider {
  constructor(private readonly apiKey: string) {}

  async moderate(input: { text: string; authorName: string }): Promise<string | null> {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(this.apiKey)}`;
      const prompt = [
        "Classifique o comentário abaixo para moderação de página pública de lavagem de carros.",
        "Responda apenas com: APROVADO ou REJEITADO ou DUVIDOSO, seguido de uma frase curta.",
        `Autor: ${input.authorName}`,
        `Comentário: ${input.text}`,
      ].join("\n");

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        return null;
      }

      const json = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!text) {
        return null;
      }

      // nunca publica: apenas a sugestão
      return text.slice(0, 200);
    } catch {
      return null;
    }
  }
}

export function getCommentModerationProvider(): CommentModerationProvider | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new GeminiCommentModerationProvider(apiKey);
}
