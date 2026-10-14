export function photoTargetSize(width: number, height: number) {
  const scale = Math.min(1, 1000 / Math.max(width, height));
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}
