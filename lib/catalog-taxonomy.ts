export const catalogCategories = {
  Camisa: ["Oversized 30.1", "Oversized Suedine", "Polo", "Básica", "Texturizada"],
  Short: ["Sarja", "Linho", "Jeans", "Elastano"],
  Calça: ["Jeans", "Alfaiataria", "Jogador", "Cargo"],
  Calçados: ["Tênis", "Chinelos"],
  Fitness: ["Camisas", "Shorts", "Tênis"],
  Outros: [],
} as const;

export type CatalogCategory = keyof typeof catalogCategories;
export const categoryNames = Object.keys(catalogCategories) as CatalogCategory[];

export function categoryForProduct(category: string, name = ""): CatalogCategory {
  const normalized = category.trim().toLocaleLowerCase("pt-BR");
  const exact = categoryNames.find((item) => item.toLocaleLowerCase("pt-BR") === normalized);
  if (exact) return exact;
  const sample = `${category} ${name}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\b(camisa|camiseta|polo)\b/.test(sample)) return "Camisa";
  if (/\b(short|bermuda)\b/.test(sample)) return "Short";
  if (/\b(calca|cargo)\b/.test(sample)) return "Calça";
  if (/\b(tenis|chinelo|calcado)\b/.test(sample)) return "Calçados";
  if (/\b(fitness|academia)\b/.test(sample)) return "Fitness";
  return "Outros";
}

export function searchable(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}
