// Shared medal ranking so Home and Summary award 1st/2nd/3rd identically.
//
// Rules (competition ranking, like the Olympics):
//   • Ties SHARE a medal — two 100%s both get gold.
//   • A shared place consumes the ones below it — two golds means no silver,
//     the next child drops to bronze (🥇 🥇 🥉).
//   • A zero (or negative) score never earns a medal — no reward for no effort.
//
// `value`     = this child's score (stars, or completion %)
// `allValues` = every child's score for the same metric
export function medalFor(value: number, allValues: number[]): string | null {
  if (value <= 0) return null
  const ahead = allValues.filter(v => v > value).length // children strictly ahead
  return ahead === 0 ? '🥇' : ahead === 1 ? '🥈' : ahead === 2 ? '🥉' : null
}
