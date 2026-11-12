type Option = { size: string; color: string; stock: number };

export function matchesAvailableOptions(variants: Option[], size: string, color: string) {
  return variants.some((variant) => variant.stock > 0 &&
    (!size || variant.size.trim() === size) &&
    (!color || variant.color.trim() === color));
}
