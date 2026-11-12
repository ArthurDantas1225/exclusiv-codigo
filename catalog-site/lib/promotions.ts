export type Campaign = {
  id: string; createdAt?: string; name: string; active: boolean; channels: ("app" | "catalog")[]; startsAt?: string; endsAt?: string;
  productIds: string[]; categories: string[]; requirements?: { kind: "category" | "subcategory" | "product"; value: string; quantity: number }[]; priority: number; type: "percent_tiers" | "fixed" | "bundle" | "buy_get";
  tiers?: { quantity: number; percent: number }[]; minQuantity?: number; discountCents?: number;
  bundleQuantity?: number; bundlePriceCents?: number; buyQuantity?: number; freeQuantity?: number;
};
export type Line = { productId: string; category: string; subcategory?: string; unitPrice: number; quantity: number };

function matchesRequirement(line: Line, item: NonNullable<Campaign["requirements"]>[number]) {
  if (item.kind === "product") return line.productId === item.value;
  if (item.kind === "subcategory") return (line.subcategory ?? "").trim().toLocaleLowerCase() === item.value.trim().toLocaleLowerCase();
  return line.category.trim().toLocaleLowerCase() === item.value.trim().toLocaleLowerCase();
}

function eligibleLines(campaign: Campaign, lines: Line[]) {
  if (!campaign.requirements?.length) return lines.filter((line) => (!campaign.productIds?.length && !campaign.categories?.length) || campaign.productIds?.includes(line.productId) || campaign.categories?.some((category) => category.trim().toLocaleLowerCase() === line.category.trim().toLocaleLowerCase()));
  const remaining = lines.map((line) => line.quantity);
  const ordered = campaign.requirements.map((item) => ({ item, matches: lines.reduce((sum, line) => sum + (matchesRequirement(line, item) ? 1 : 0), 0), specificity: item.kind === "product" ? 3 : item.kind === "subcategory" ? 2 : 1 })).sort((a, b) => a.matches - b.matches || b.specificity - a.specificity);
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
  return lines.filter((line) => campaign.requirements!.some((item) => matchesRequirement(line, item)));
}

export function promotionProductIds<T extends { id: string; category: string; subcategory?: string }>(products: T[], campaigns: Campaign[], now = new Date()) {
  const active = campaigns.filter((campaign) => validCampaign(campaign) && campaign.active && campaign.channels.includes("catalog")
    && (!campaign.startsAt || now >= new Date(`${campaign.startsAt}T00:00:00-03:00`))
    && (!campaign.endsAt || now <= new Date(`${campaign.endsAt}T23:59:59.999-03:00`)));
  const normalize = (value: string) => value.trim().toLocaleLowerCase("pt-BR");
  return new Set(products.filter((product) => active.some((campaign) => {
    if (campaign.requirements?.length) return campaign.requirements.some((item) => item.kind === "product"
      ? product.id === item.value
      : item.kind === "subcategory" ? normalize(product.subcategory ?? "") === normalize(item.value) : normalize(product.category) === normalize(item.value));
    if (!campaign.productIds.length && !campaign.categories.length) return true;
    return campaign.productIds.includes(product.id) || campaign.categories.some((category) => normalize(category) === normalize(product.category));
  })).map((product) => product.id));
}

function validCampaign(campaign: Campaign) {
  if (!campaign || typeof campaign !== "object" || typeof campaign.id !== "string" || typeof campaign.name !== "string" || !campaign.name.trim() || typeof campaign.active !== "boolean" || !Array.isArray(campaign.channels) || campaign.channels.some((channel) => channel !== "app" && channel !== "catalog") || !Array.isArray(campaign.productIds) || campaign.productIds.some((id) => typeof id !== "string") || !Array.isArray(campaign.categories) || campaign.categories.some((category) => typeof category !== "string") || !Number.isSafeInteger(campaign.priority) || campaign.priority < 0) return false;
  if (campaign.requirements !== undefined && (!Array.isArray(campaign.requirements) || campaign.requirements.length === 1 || campaign.requirements.length > 10 || campaign.requirements.some((item) => !item || !["category", "subcategory", "product"].includes(item.kind) || typeof item.value !== "string" || !item.value.trim() || item.value.length > 80 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 2000) || new Set(campaign.requirements.map((item) => `${item.kind}:${item.value.trim().toLocaleLowerCase("pt-BR")}`)).size !== campaign.requirements.length)) return false;
  if ([campaign.startsAt, campaign.endsAt].some((date) => date !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))))) return false;
  if (campaign.startsAt && campaign.endsAt && campaign.startsAt > campaign.endsAt) return false;
  if (campaign.type === "percent_tiers") return Array.isArray(campaign.tiers) && campaign.tiers.length > 0 && campaign.tiers.length <= 10 && campaign.tiers.every((tier, index) => Number.isInteger(tier.quantity) && tier.quantity > 0 && Number.isInteger(tier.percent) && tier.percent > 0 && tier.percent <= 90 && (index === 0 || tier.quantity > campaign.tiers![index - 1].quantity));
  if (campaign.type === "fixed") return Number.isInteger(campaign.minQuantity) && campaign.minQuantity! > 0 && Number.isSafeInteger(campaign.discountCents) && campaign.discountCents! > 0;
  if (campaign.type === "bundle") return Number.isInteger(campaign.bundleQuantity) && campaign.bundleQuantity! >= 2 && Number.isSafeInteger(campaign.bundlePriceCents) && campaign.bundlePriceCents! >= 0;
  if (campaign.type === "buy_get") return Number.isInteger(campaign.buyQuantity) && campaign.buyQuantity! >= 1 && Number.isInteger(campaign.freeQuantity) && campaign.freeQuantity! >= 1 && campaign.buyQuantity! + campaign.freeQuantity! <= 10;
  return false;
}

function savings(campaign: Campaign, lines: Line[], now: Date) {
  if (!validCampaign(campaign)) return 0;
  if (!campaign.active || !campaign.channels?.includes("catalog")) return 0;
  if (campaign.startsAt && now < new Date(`${campaign.startsAt}T00:00:00-03:00`)) return 0;
  if (campaign.endsAt && now > new Date(`${campaign.endsAt}T23:59:59.999-03:00`)) return 0;
  const eligible = eligibleLines(campaign, lines);
  const quantity = eligible.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = eligible.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  let discount = 0;
  if (campaign.type === "percent_tiers") {
    const tier = [...(campaign.tiers ?? [])].filter((item) => item.quantity <= quantity).sort((a, b) => b.quantity - a.quantity)[0];
    if (tier && tier.percent > 0 && tier.percent <= 90) discount = Math.round(subtotal * tier.percent / 100);
  } else if (campaign.type === "fixed" && quantity >= (campaign.minQuantity ?? Number.MAX_SAFE_INTEGER)) discount = campaign.discountCents ?? 0;
  else if (campaign.type === "bundle") {
    const group = campaign.bundleQuantity ?? 0; const repeats = group > 0 ? Math.floor(quantity / group) : 0; let units = group * repeats;
    const groupedTotal = [...eligible].sort((a, b) => a.unitPrice - b.unitPrice).reduce((sum, line) => { const take = Math.min(units, line.quantity); units -= take; return sum + take * line.unitPrice; }, 0);
    discount = Math.max(0, groupedTotal - repeats * (campaign.bundlePriceCents ?? 0));
  } else if (campaign.type === "buy_get") {
    const group = (campaign.buyQuantity ?? 0) + (campaign.freeQuantity ?? 0); let units = group > 0 ? Math.floor(quantity / group) * (campaign.freeQuantity ?? 0) : 0;
    discount = [...eligible].sort((a, b) => a.unitPrice - b.unitPrice).reduce((sum, line) => { const take = Math.min(units, line.quantity); units -= take; return sum + take * line.unitPrice; }, 0);
  }
  return Math.min(Math.max(0, subtotal - 1), Math.max(0, Math.round(discount)));
}

export function calculate(campaigns: Campaign[], lines: Line[], now = new Date()) {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const candidates = campaigns.filter(validCampaign).map((campaign) => ({ campaign, eligible: eligibleLines(campaign, lines), discount: savings(campaign, lines, now) })).filter((item) => item.discount > 0);
  const groups: typeof candidates[] = [];
  for (const item of candidates) {
    const overlaps = groups.filter((group) => group.some((entry) => entry.eligible.some((line) => item.eligible.includes(line))));
    if (!overlaps.length) groups.push([item]);
    else { overlaps[0].push(item); for (const extra of overlaps.slice(1)) { overlaps[0].push(...extra); groups.splice(groups.indexOf(extra), 1); } }
  }
  const winners = groups.map((group) => group.sort((a, b) => b.discount - a.discount || a.campaign.priority - b.campaign.priority || (a.campaign.createdAt ?? "").localeCompare(b.campaign.createdAt ?? "") || a.campaign.id.localeCompare(b.campaign.id))[0]);
  const applied = winners.map(({ campaign, discount }) => ({ id: campaign.id, name: campaign.name, discount }));
  return { version: 0, subtotal, discount: Math.min(subtotal, applied.reduce((sum, item) => sum + item.discount, 0)), campaignIds: applied.map((item) => item.id), applied };
}
