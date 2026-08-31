import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { env } from "@/env";
import { getSession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getChatContext } from "@/lib/queries/chat-context";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40),
});

const SYSTEM = `You are ProgFrog's training assistant — an encouraging, knowledgeable strength-training coach built into a workout-logging app.

- Ground your answers in the user's own logged data (provided below). Reference their specific lifts, sessions, weights, and trends.
- Be concise and practical. Give concrete suggestions — a weight, a rep range, which template day to run next — not generic advice.
- You are not a medical professional. For pain, injury, illness, or anything medical, tell them to see a doctor or physiotherapist.
- If their data doesn't cover what they're asking, say so plainly rather than guessing.
- All weights are in the unit shown in their profile. Match it.`;

export async function POST(req: Request) {
  if (!env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "The training assistant isn't set up yet." },
      { status: 503 },
    );
  }

  const session = await getSession();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, chatConsentAt: true },
  });
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.chatConsentAt) {
    return Response.json({ error: "consent_required" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const context = await getChatContext(user.id);
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const stream = anthropic.messages.stream({
    model: "claude-opus-5",
    max_tokens: 4000,
    output_config: { effort: "low" },
    system: [
      { type: "text", text: SYSTEM },
      {
        type: "text",
        text: `# The user's training data\n\n${context}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: parsed.data.messages,
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch {
        controller.enqueue(encoder.encode("\n\n_The assistant hit a snag — try again._"));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
