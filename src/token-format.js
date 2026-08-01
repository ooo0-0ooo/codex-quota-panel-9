export function compactTokenCount(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: Math.abs(number) >= 1_000_000_000 ? 2 : 1,
  }).format(number);
}
