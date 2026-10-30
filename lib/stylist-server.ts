import { generateText, Output } from "ai";
import {
  fallbackStylistResult,
  stylistResultSchema,
  validateStylistResult,
  type StylistCandidate,
  type StylistGoal,
  type StylistPairing,
  type StylistRequest,
  type StylistResult,
} from "./stylist.ts";

export type StylistGenerator = (
  prompt: string,
  schema: typeof stylistResultSchema,
) => Promise<unknown>;

export function buildStylistPrompt(
  pairing: StylistPairing,
  goal: StylistGoal,
  candidates: StylistCandidate[],
): string {
  const safeCandidates = candidates.map((candidate) => ({
    id: candidate.id,
    pairing: candidate.pairing,
    top: {
      productId: candidate.top.productId,
      name: candidate.top.name,
      category: candidate.top.category,
      subcategory: candidate.top.subcategory,
      collection: candidate.top.collection,
      color: candidate.top.color,
      sizes: candidate.top.sizes,
      price: candidate.top.price,
      stock: candidate.top.stock,
    },
    bottom: {
      productId: candidate.bottom.productId,
      name: candidate.bottom.name,
      category: candidate.bottom.category,
      subcategory: candidate.bottom.subcategory,
      collection: candidate.bottom.collection,
      color: candidate.bottom.color,
      sizes: candidate.bottom.sizes,
      price: candidate.bottom.price,
      stock: candidate.bottom.stock,
    },
    totalPrice: candidate.totalPrice,
  }));
  return [
    "Você é o stylist da marca brasileira EXCLUSIV.",
    "Crie até três kits em português brasileiro e um roteiro de exatamente três telas para cada kit.",
    "Use exclusivamente candidateId, productId e cor presentes nos dados. Não invente peças, cores ou tamanhos.",
    `Tipo: ${pairing}. Objetivo: ${goal}.`,
    `Opções: ${JSON.stringify(safeCandidates)}`,
  ].join("\n");
}

const defaultGenerator: StylistGenerator = async (prompt, schema) => {
  const model = process.env.AI_GATEWAY_MODEL;
  if (!model) throw new Error("AI_GATEWAY_MODEL is not configured");
  const { output } = await generateText({
    model,
    output: Output.object({ schema }),
    prompt,
    maxOutputTokens: 1_200,
    reasoning: "minimal",
    abortSignal: AbortSignal.timeout(12_000),
  });
  return output;
};

export async function generateStylistResult(
  input: StylistRequest,
  generate: StylistGenerator = defaultGenerator,
): Promise<{ result: StylistResult; source: "ai" | "fallback" }> {
  const candidate = input.candidates[0];
  if (!candidate) throw new Error("At least one candidate is required");
  const fallback = fallbackStylistResult(candidate, input.goal);
  try {
    const value = await generate(buildStylistPrompt(input.pairing, input.goal, input.candidates), stylistResultSchema);
    const validated = validateStylistResult(value, input.candidates);
    return validated ? { result: validated, source: "ai" } : { result: fallback, source: "fallback" };
  } catch {
    return { result: fallback, source: "fallback" };
  }
}
