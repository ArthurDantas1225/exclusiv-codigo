import type { Product, ProductImage, Variant } from "./types.ts";
import { categoryForProduct, searchable } from "./catalog-taxonomy.ts";
import { z } from "zod";

export type StylistPairing = "shirt_short" | "shirt_pants";
export type StylistGoal = "sell_today" | "new_arrivals" | "move_stock";

export type StylistPiece = {
  productId: string;
  name: string;
  category: string;
  subcategory?: string;
  collection: string;
  color: string;
  sizes: string[];
  price: number;
  stock: number;
  imageId: string;
  createdAt: string;
};

export type StylistCandidate = {
  id: string;
  pairing: StylistPairing;
  top: StylistPiece;
  bottom: StylistPiece;
  totalPrice: number;
  score: number;
};

const stylistPieceSchema = z.object({
  productId: z.string().min(1).max(100),
  name: z.string().min(1).max(160),
  category: z.string().max(100),
  subcategory: z.string().max(100).optional(),
  collection: z.string().max(100),
  color: z.string().min(1).max(80),
  sizes: z.array(z.string().min(1).max(40)).max(30),
  price: z.number().int().nonnegative(),
  stock: z.number().int().positive(),
  imageId: z.string().min(1).max(100),
  createdAt: z.string().min(1).max(50),
}).strict();

const stylistCandidateSchema = z.object({
  id: z.string().min(1).max(250),
  pairing: z.enum(["shirt_short", "shirt_pants"]),
  top: stylistPieceSchema,
  bottom: stylistPieceSchema,
  totalPrice: z.number().int().nonnegative(),
  score: z.number().finite(),
}).strict();

export const stylistRequestSchema = z.object({
  pairing: z.enum(["shirt_short", "shirt_pants"]),
  goal: z.enum(["sell_today", "new_arrivals", "move_stock"]),
  candidates: z.array(stylistCandidateSchema).min(1).max(12),
}).strict();

const resultPieceSchema = z.object({
  productId: z.string().min(1).max(100),
  color: z.string().min(1).max(80),
}).strict();

export const stylistResultSchema = z.object({
  kits: z.array(z.object({
    candidateId: z.string().min(1).max(250),
    top: resultPieceSchema,
    bottom: resultPieceSchema,
    title: z.string().min(1).max(80),
    caption: z.string().min(1).max(320),
    cta: z.string().min(1).max(120),
    story: z.array(z.object({
      headline: z.string().min(1).max(80),
      body: z.string().min(1).max(180),
    }).strict()).length(3),
  }).strict()).min(1).max(3),
}).strict();

export type StylistRequest = z.infer<typeof stylistRequestSchema>;
export type StylistResult = z.infer<typeof stylistResultSchema>;

function kind(product: Product): "shirt" | "short" | "pants" | undefined {
  const category = categoryForProduct(product.category, product.name);
  if (category === "Camisa") return "shirt";
  if (category === "Short") return "short";
  if (category === "Calça") return "pants";
  if (category !== "Fitness") return undefined;
  const subcategory = searchable(product.subcategory ?? "");
  if (subcategory.includes("camisa")) return "shirt";
  if (subcategory.includes("short")) return "short";
  return undefined;
}

function colorKey(value: string) {
  const normalized = searchable(value).replace(/\s*-\s*/g, "-").replace(/\s+/g, " ");
  return ({ preta: "preto", branca: "branco", vermelha: "vermelho", amarela: "amarelo" } as Record<string, string>)[normalized] ?? normalized;
}

function visibleImages(images: ProductImage[], productId: string) {
  return images.filter((image) => image.product_id === productId && !image.hidden_at);
}

export function resolveStylistPhoto(
  images: ProductImage[],
  productId: string,
  color: string,
): ProductImage | undefined {
  const photos = visibleImages(images, productId);
  const sameColor = photos.filter((photo) => colorKey(photo.color ?? "") === colorKey(color));
  return sameColor.find((photo) => photo.view === "front")
    ?? sameColor[0]
    ?? photos.find((photo) => photo.is_primary)
    ?? photos[0];
}

function pieces(
  products: Product[],
  variants: Variant[],
  images: ProductImage[],
  expected: "shirt" | "short" | "pants",
) {
  return products.flatMap((product) => {
    const photos = visibleImages(images, product.id);
    if (!product.active || product.archived_at || product.catalog_visible !== true || kind(product) !== expected || !photos.length) return [];
    const byColor = new Map<string, Variant[]>();
    for (const variant of variants) {
      if (variant.product_id !== product.id || variant.stock <= 0) continue;
      const key = colorKey(variant.color);
      byColor.set(key, [...(byColor.get(key) ?? []), variant]);
    }
    return [...byColor.entries()].map(([key, colorVariants]): StylistPiece => {
      const color = colorVariants[0].color.trim();
      const photo = resolveStylistPhoto(photos, product.id, color)!;
      return {
        productId: product.id,
        name: product.name,
        category: product.category,
        subcategory: product.subcategory,
        collection: product.collection,
        color,
        sizes: [...new Set(colorVariants.map((variant) => variant.size))].sort((a, b) => a.localeCompare(b, "pt-BR")),
        price: product.price,
        stock: colorVariants.reduce((sum, variant) => sum + variant.stock, 0),
        imageId: photo.id,
        createdAt: product.created_at,
      };
    });
  });
}

const colorGroups: Record<string, string> = {
  preto: "neutral", branco: "neutral", bege: "neutral", cinza: "neutral", chumbo: "neutral", marrom: "earth",
  azul: "cold", "azul marinho": "cold", verde: "cold", "verde militar": "earth",
  vermelho: "warm", vinho: "warm", amarelo: "warm", laranja: "warm",
};

function colorScore(top: string, bottom: string) {
  const topKey = colorKey(top), bottomKey = colorKey(bottom);
  if (topKey === bottomKey) return 8;
  const topGroup = colorGroups[topKey], bottomGroup = colorGroups[bottomKey];
  if (topGroup === "neutral" || bottomGroup === "neutral") return 7;
  if (topGroup && topGroup === bottomGroup) return 5;
  return 3;
}

function baseScore(top: StylistPiece, bottom: StylistPiece, images: ProductImage[], goal: StylistGoal) {
  const exactPhotos = [top, bottom].filter((piece) => images.some((image) => image.id === piece.imageId && colorKey(image.color ?? "") === colorKey(piece.color))).length;
  const goalScore = goal === "new_arrivals"
    ? Math.floor((Date.parse(top.createdAt) + Date.parse(bottom.createdAt)) / 86_400_000)
    : goal === "move_stock" ? Math.min(top.stock + bottom.stock, 100) * 3 : 0;
  return exactPhotos * 20 + (top.sizes.length + bottom.sizes.length) * 3
    + Math.min(top.stock + bottom.stock, 20) + colorScore(top.color, bottom.color) + goalScore;
}

export function buildStylistCandidates(
  input: { products: Product[]; variants: Variant[]; images: ProductImage[] },
  pairing: StylistPairing,
  goal: StylistGoal,
): StylistCandidate[] {
  const tops = pieces(input.products, input.variants, input.images, "shirt");
  const bottoms = pieces(input.products, input.variants, input.images, pairing === "shirt_short" ? "short" : "pants");
  return tops.flatMap((top) => bottoms.map((bottom): StylistCandidate => ({
    id: `${top.productId}:${colorKey(top.color)}|${bottom.productId}:${colorKey(bottom.color)}`,
    pairing,
    top,
    bottom,
    totalPrice: top.price + bottom.price,
    score: baseScore(top, bottom, input.images, goal),
  }))).sort((a, b) => b.score - a.score || a.top.name.localeCompare(b.top.name, "pt-BR") || a.id.localeCompare(b.id)).slice(0, 12);
}

export function validateStylistResult(
  value: unknown,
  candidates: StylistCandidate[],
  currentVariants?: Variant[],
): StylistResult | null {
  const parsed = stylistResultSchema.safeParse(value);
  if (!parsed.success) return null;

  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const seen = new Set<string>();
  for (const kit of parsed.data.kits) {
    if (seen.has(kit.candidateId)) return null;
    seen.add(kit.candidateId);
    const candidate = byId.get(kit.candidateId);
    if (!candidate) return null;

    const matches = (result: { productId: string; color: string }, piece: StylistPiece) =>
      result.productId === piece.productId && colorKey(result.color) === colorKey(piece.color);
    if (!matches(kit.top, candidate.top) || !matches(kit.bottom, candidate.bottom)) return null;

    if (currentVariants) {
      const hasStock = (piece: StylistPiece) => currentVariants.some((variant) =>
        variant.product_id === piece.productId && colorKey(variant.color) === colorKey(piece.color) && variant.stock > 0,
      );
      if (!hasStock(candidate.top) || !hasStock(candidate.bottom)) return null;
    }
  }
  return parsed.data;
}

export function fallbackStylistResult(candidate: StylistCandidate, goal: StylistGoal): StylistResult {
  const goalLead = goal === "new_arrivals"
    ? "Novidade que chegou para renovar seu visual"
    : goal === "move_stock" ? "Uma combinação especial esperando por você" : "Look pronto para usar hoje";
  const title = `${candidate.top.name} + ${candidate.bottom.name}`;
  const cta = "Fale com a EXCLUSIV no WhatsApp e escolha seu tamanho.";
  return {
    kits: [{
      candidateId: candidate.id,
      top: { productId: candidate.top.productId, color: candidate.top.color },
      bottom: { productId: candidate.bottom.productId, color: candidate.bottom.color },
      title,
      caption: `${goalLead}: ${candidate.top.name} ${candidate.top.color} com ${candidate.bottom.name} ${candidate.bottom.color}.`,
      cta,
      story: [
        { headline: "Inspiração EXCLUSIV", body: goalLead },
        { headline: title, body: `Combine ${candidate.top.color} com ${candidate.bottom.color} e deixe o look completo.` },
        { headline: "Escolha o seu", body: cta },
      ],
    }],
  };
}
