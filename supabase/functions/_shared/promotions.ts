export type PromotionTier = { quantity: number; percent: number };
export type PromotionCampaign = {
  id: string;
  createdAt?: string;
  name: string;
  active: boolean;
  channels: ("app" | "catalog")[];
  startsAt?: string;
  endsAt?: string;
  productIds: string[];
  categories: string[];
  priority: number;
  type: "percent_tiers" | "fixed" | "bundle" | "buy_get";
  tiers?: PromotionTier[];
  minQuantity?: number;
  discountCents?: number;
  bundleQuantity?: number;
  bundlePriceCents?: number;
  buyQuantity?: number;
  freeQuantity?: number;
};

export type PromotionLine = { productId: string; category: string; unitPrice: number; quantity: number };
export type PromotionResult = { subtotal: number; discount: number; campaignIds: string[]; savings: { id: string; name: string; discount: number }[] };

export function parsePromotions(value?: string | null): { version: number; campaigns: PromotionCampaign[] } {
  try {
    const parsed = JSON.parse(value || "{}");
    return { version: Number.isSafeInteger(parsed.version) ? parsed.version : 0, campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [] };
  } catch { return { version: 0, campaigns: [] }; }
}

export function promotionDiscount(campaign: PromotionCampaign, lines: PromotionLine[], channel: "app" | "catalog", now = new Date()): number {
  if (!campaign.active || !campaign.channels?.includes(channel)) return 0;
  if (campaign.startsAt && now < new Date(`${campaign.startsAt}T00:00:00-03:00`)) return 0;
  if (campaign.endsAt && now > new Date(`${campaign.endsAt}T23:59:59.999-03:00`)) return 0;
  const eligible = lines.filter((line) => (!campaign.productIds?.length && !campaign.categories?.length) || campaign.productIds?.includes(line.productId) || campaign.categories?.includes(line.category));
  const quantity = eligible.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = eligible.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  let discount = 0;
  if (campaign.type === "percent_tiers") {
    const tier = [...(campaign.tiers ?? [])].filter((item) => item.quantity <= quantity).sort((a, b) => b.quantity - a.quantity)[0];
    if (tier && tier.percent > 0 && tier.percent <= 90) discount = Math.round(subtotal * tier.percent / 100);
  } else if (campaign.type === "fixed" && quantity >= (campaign.minQuantity ?? Number.MAX_SAFE_INTEGER)) {
    discount = campaign.discountCents ?? 0;
  } else if (campaign.type === "bundle") {
    const group = campaign.bundleQuantity ?? 0;
    const repeats = group > 0 ? Math.floor(quantity / group) : 0;
    let unitsToBundle = group * repeats;
    const bundleSubtotal = [...eligible].sort((a, b) => a.unitPrice - b.unitPrice).reduce((sum, line) => {
      const units = Math.min(unitsToBundle, line.quantity);
      unitsToBundle -= units;
      return sum + units * line.unitPrice;
    }, 0);
    discount = Math.max(0, bundleSubtotal - repeats * (campaign.bundlePriceCents ?? 0));
  } else if (campaign.type === "buy_get") {
    const group = (campaign.buyQuantity ?? 0) + (campaign.freeQuantity ?? 0);
    let freeUnits = group > 0 ? Math.floor(quantity / group) * (campaign.freeQuantity ?? 0) : 0;
    discount = [...eligible].sort((a, b) => a.unitPrice - b.unitPrice).reduce((sum, line) => {
      const units = Math.min(freeUnits, line.quantity);
      freeUnits -= units;
      return sum + units * line.unitPrice;
    }, 0);
  }
  return Math.max(0, Math.min(Math.max(0, subtotal - 1), Math.round(discount)));
}

export function calculatePromotions(campaigns: PromotionCampaign[], lines: PromotionLine[], channel: "app" | "catalog", now = new Date()): PromotionResult {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const candidates = campaigns.map((campaign) => {
    const scoped = lines.filter((line) => (!campaign.productIds?.length && !campaign.categories?.length) || campaign.productIds?.includes(line.productId) || campaign.categories?.includes(line.category));
    return { campaign, scoped, discount: promotionDiscount(campaign, lines, channel, now) };
  }).filter((candidate) => candidate.discount > 0);
  const groups: typeof candidates[] = [];
  for (const candidate of candidates) {
    const overlapping = groups.filter((group) => group.some((entry) => entry.scoped.some((line) => candidate.scoped.includes(line))));
    if (!overlapping.length) groups.push([candidate]);
    else {
      overlapping[0].push(candidate);
      for (const extra of overlapping.slice(1)) { overlapping[0].push(...extra); groups.splice(groups.indexOf(extra), 1); }
    }
  }
  const winners = groups.map((group) => group.sort((a, b) => b.discount - a.discount || a.campaign.priority - b.campaign.priority || (a.campaign.createdAt ?? "").localeCompare(b.campaign.createdAt ?? "") || a.campaign.id.localeCompare(b.campaign.id))[0]);
  const savings = winners.map(({ campaign, discount }) => ({ id: campaign.id, name: campaign.name, discount }));
  const discount = Math.min(subtotal, savings.reduce((sum, item) => sum + item.discount, 0));
  return { subtotal, discount, campaignIds: savings.map((item) => item.id), savings };
}
