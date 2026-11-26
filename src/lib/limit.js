// Pembatas permintaan sederhana (jendela bergeser, disimpan di memori server)
const buckets = new Map();

// true = masih boleh; false = terlalu banyak permintaan
export function hit(key, max, windowMs) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k);
  }
  return arr.length <= max;
}
