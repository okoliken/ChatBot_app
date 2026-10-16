import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: Request) {
  const { messages } = (await req.json()) as {
    messages: Anthropic.Beta.BetaMessageParam[];
  };

  const stream = client.beta.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 64000,
    output_config: { effort: "low" },
    system: "You are a helpful assistant. Format answers with Markdown when it helps.",
    messages,
    // If the main model declines, retry on a suitable fallback model server-side.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n_The model declined to answer this one._"));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong.";
        controller.enqueue(encoder.encode(`\n\n**Error:** ${message}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
