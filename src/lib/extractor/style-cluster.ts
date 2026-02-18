import type { Weighted } from "@/lib/extractor/extraction-types";
import { colorDistance } from "@/lib/extractor/style-normalize";

export type WeightedValue<T> = {
  value: T;
  weight: number;
};

function round(value: number, precision = 2) {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

export function rankWeightedStrings(
  values: Array<Weighted<string>>,
  options?: { limit?: number; minWeight?: number },
): Array<WeightedValue<string>> {
  const buckets = new Map<string, number>();

  for (const item of values) {
    const key = item.value.trim().toLowerCase();
    if (!key) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + item.weight);
  }

  const minWeight = options?.minWeight ?? 0;
  const ranked = [...buckets.entries()]
    .map(([value, weight]) => ({ value, weight: round(weight) }))
    .filter((item) => item.weight > minWeight)
    .sort((a, b) => b.weight - a.weight);

  const limit = options?.limit;
  return limit ? ranked.slice(0, limit) : ranked;
}

export function clusterNumberScale(
  values: Array<Weighted<number>>,
  options?: { tolerance?: number; limit?: number; sort?: "asc" | "desc" | "weight" },
): Array<WeightedValue<number>> {
  const tolerance = options?.tolerance ?? 1;
  const clusters: Array<{ center: number; weight: number }> = [];

  for (const item of values) {
    if (!Number.isFinite(item.value)) continue;

    let targetIndex = -1;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < clusters.length; i += 1) {
      const distance = Math.abs(clusters[i].center - item.value);
      if (distance <= tolerance && distance < closestDistance) {
        closestDistance = distance;
        targetIndex = i;
      }
    }

    if (targetIndex >= 0) {
      const cluster = clusters[targetIndex];
      const totalWeight = cluster.weight + item.weight;
      cluster.center = (cluster.center * cluster.weight + item.value * item.weight) / totalWeight;
      cluster.weight = totalWeight;
      continue;
    }

    clusters.push({ center: item.value, weight: item.weight });
  }

  const mergedByRoundedValue = new Map<number, number>();
  for (const cluster of clusters) {
    const rounded = Math.round(cluster.center);
    mergedByRoundedValue.set(
      rounded,
      (mergedByRoundedValue.get(rounded) ?? 0) + cluster.weight,
    );
  }

  const result = [...mergedByRoundedValue.entries()].map(([value, weight]) => ({
    value,
    weight: round(weight),
  }));

  const sort = options?.sort ?? "asc";
  if (sort === "asc") {
    result.sort((a, b) => a.value - b.value);
  } else if (sort === "desc") {
    result.sort((a, b) => b.value - a.value);
  } else {
    result.sort((a, b) => b.weight - a.weight);
  }

  const limit = options?.limit;
  return limit ? result.slice(0, limit) : result;
}

export function clusterColors(
  values: Array<Weighted<string>>,
  options?: { distance?: number; limit?: number },
): Array<WeightedValue<string>> {
  const distance = options?.distance ?? 12;
  const clusters: Array<{ color: string; weight: number }> = [];

  for (const item of values) {
    const color = item.value.trim().toLowerCase();
    if (!color.startsWith("#")) continue;

    let targetIndex = -1;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < clusters.length; i += 1) {
      const currentDistance = colorDistance(clusters[i].color, color);
      if (currentDistance <= distance && currentDistance < closestDistance) {
        closestDistance = currentDistance;
        targetIndex = i;
      }
    }

    if (targetIndex >= 0) {
      const cluster = clusters[targetIndex];
      cluster.weight += item.weight;
      if (item.weight > cluster.weight / 2) {
        cluster.color = color;
      }
      continue;
    }

    clusters.push({ color, weight: item.weight });
  }

  const result = clusters
    .map((item) => ({ value: item.color, weight: round(item.weight) }))
    .sort((a, b) => b.weight - a.weight);

  const limit = options?.limit ?? 12;
  return result.slice(0, limit);
}
