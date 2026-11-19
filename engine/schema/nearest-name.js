'use strict';

function levenshtein(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev = Array.from({ length: cols }, (_, i) => i);
  for (let i = 1; i < rows; i += 1) {
    const current = [i];
    for (let j = 1; j < cols; j += 1) {
      current[j] = Math.min(
        prev[j] + 1,
        current[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = current;
  }
  return prev[cols - 1];
}

/** Closest name in `pool`, so an agent gets a fix rather than a rejection; null when none is close. */
function nearest(candidate, pool) {
  let best = null;
  let bestScore = Infinity;
  for (const option of pool) {
    const distance = levenshtein(candidate, option);
    if (distance < bestScore) {
      bestScore = distance;
      best = option;
    }
  }
  return bestScore <= Math.max(2, Math.floor(candidate.length / 3)) ? best : null;
}

module.exports = { nearest };
