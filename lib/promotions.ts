export type PromotionTier = { quantity: number; percent: number };
export type PromotionRequirement = { kind: "category" | "subcategory" | "product"; value: string; quantity: number };
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
  requirements?: PromotionRequirement[];
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

export type PromotionLine = { productId: string; category: string; subcategory?: string; unitPrice: number; quantity: number };
export type PromotionResult = { subtotal: number; discount: number; campaignIds: string[]; savings: { id: string; name: string; discount: number }[] };

function validCampaign(value: PromotionCampaign) {
  if (!value || typeof value !== "object" || typeof value.id !== "string" || typeof value.name !== "string" || !value.name.trim() || typeof value.active !== "boolean" || !Array.isArray(value.channels) || value.channels.some((channel) => channel !== "app" && channel !== "catalog") || !Array.isArray(value.productIds) || value.productIds.some((id) => typeof id !== "string") || !Array.isArray(value.categories) || value.categories.some((category) => typeof category !== "string") || !Number.isSafeInteger(value.priority) || value.priority < 0) return false;
  if (value.requirements !== undefined && (!Array.isArray(value.requirements) || value.requirements.length === 1 || value.requirements.length > 10 || value.requirements.some((item) => !item || !["category", "subcategory", "product"].includes(item.kind) || typeof item.value !== "string" || !item.value.trim() || item.value.length > 80 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 2000) || new Set(value.requirements.map((item) => `${item.kind}:${item.value.toLocaleLowerCase()}`)).size !== value.requirements.length)) return false;
  if ([value.startsAt, value.endsAt].some((date) => date !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))))) return false;
  if (value.startsAt && value.endsAt && value.startsAt > value.endsAt) return false;
  if (value.type === "percent_tiers") return Array.isArray(value.tiers) && value.tiers.length > 0 && value.tiers.length <= 10 && value.tiers.every((tier, index) => Number.isInteger(tier.quantity) && tier.quantity > 0 && Number.isInteger(tier.percent) && tier.percent > 0 && tier.percent <= 90 && (index === 0 || tier.quantity > value.tiers![index - 1].quantity));
  if (value.type === "fixed") return Number.isInteger(value.minQuantity) && value.minQuantity! > 0 && Number.isSafeInteger(value.discountCents) && value.discountCents! > 0;
  if (value.type === "bundle") return Number.isInteger(value.bundleQuantity) && value.bundleQuantity! >= 2 && Number.isSafeInteger(value.bundlePriceCents) && value.bundlePriceCents! >= 0;
  if (value.type === "buy_get") return Number.isInteger(value.buyQuantity) && value.buyQuantity! >= 1 && Number.isInteger(value.freeQuantity) && value.freeQuantity! >= 1 && value.buyQuantity! + value.freeQuantity! <= 10;
  return false;
}

function matchesRequirement(line: PromotionLine, item: PromotionRequirement) {
  if (item.kind === "product") return line.productId === item.value;
  if (item.kind === "subcategory") return (line.subcategory ?? "").trim().toLocaleLowerCase() === item.value.trim().toLocaleLowerCase();
  return line.category.trim().toLocaleLowerCase() === item.value.trim().toLocaleLowerCase();
}

function eligibleLines(campaign: PromotionCampaign, lines: PromotionLine[]) {
  if (!campaign.requirements?.length) return lines.filter((line) => (!campaign.productIds?.length && !campaign.categories?.length) || campaign.productIds?.includes(line.productId) || campaign.categories?.includes(line.category));
  const requirements = campaign.requirements;
  const remaining = lines.map((line) => line.quantity);
  const ordered = requirements.map((item) => ({ item, matches: lines.reduce((sum, line) => sum + (matchesRequirement(line, item) ? 1 : 0), 0), specificity: item.kind === "product" ? 3 : item.kind === "subcategory" ? 2 : 1 })).sort((a, b) => a.matches - b.matches || b.specificity - a.specificity);
  for (const { item } of ordered) {
    let needed = item.quantity;
    const candidates = lines.map((line, index) => ({ line, index })).filter(({ line, index }) => remaining[index] > 0 && matchesRequirement(line, item)).sort((a, b) => b.line.unitPrice - a.line.unitPrice);
    for (const { index } of candidates) {
      const amount = Math.min(needed, remaining[index]);
      remaining[index] -= amount;
      needed -= amount;
      if (!needed) break;
    }
    if (needed) return [];
  }
  return lines.filter((line) => requirements.some((item) => matchesRequirement(line, item)));
}

export function parsePromotions(value?: string | null): { version: number; campaigns: PromotionCampaign[] } {
  try {
    const parsed = JSON.parse(value || "{}");
    return { version: Number.isSafeInteger(parsed.version) ? parsed.version : 0, campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [] };
  } catch { return { version: 0, campaigns: [] }; }
}

export function promotionDiscount(campaign: PromotionCampaign, lines: PromotionLine[], channel: "app" | "catalog", now = new Date()): number {
  if (!validCampaign(campaign)) return 0;
  if (!campaign.active || !campaign.channels?.includes(channel)) return 0;
  if (campaign.startsAt && now < new Date(`${campaign.startsAt}T00:00:00-03:00`)) return 0;
  if (campaign.endsAt && now > new Date(`${campaign.endsAt}T23:59:59.999-03:00`)) return 0;
  const eligible = eligibleLines(campaign, lines);
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
  const candidates = campaigns.filter(validCampaign).map((campaign) => {
    const scoped = eligibleLines(campaign, lines);
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
