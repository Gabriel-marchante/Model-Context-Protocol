type Predicate<T> = (item: T) => boolean;

/**
 * 从后往前筛选满足 predicate 的元素，最多保留 limit 个，保持原顺序。
 * 如果没有任何元素满足 predicate，则返回原始数组的前 limit 个元素。
 */
export function filterFromEndUntilLimit<T>(
  arr: T[],
  predicate: Predicate<T>,
  limit: number,
): T[] {
  if (arr.length === 0 || limit <= 0) {
    return [];
  }

  const result: T[] = [];
  let count = 0;

  // 从后往前遍历，收集满足 predicate 的项
  for (let i = 0; arr.length > i; i++) {
    const item = arr[i];
    if (predicate(item)) {
      result.unshift(item); // 插入前面以保持原顺序
      count++;
    }
  }

  // 如果没有满足 predicate 的项，返回原始数组的前 limit 个
  if (count === 0) {
    return arr.slice(0, limit);
  }

  return result;
}
