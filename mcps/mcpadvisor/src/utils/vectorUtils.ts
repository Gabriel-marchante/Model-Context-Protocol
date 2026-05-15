/**
 * 向量工具函数
 * 提供向量操作相关的工具函数
 */

/**
 * 归一化向量
 * 将向量转换为单位向量（长度为1）
 *
 * @param vector 输入向量
 * @returns 归一化后的向量
 */
export function normalizeVector(vector: number[]): number[] {
  // 计算向量的欧几里得范数（L2范数）
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));

  // 避免除以零
  if (magnitude === 0 || !isFinite(magnitude)) {
    return [...vector]; // 返回原向量的副本
  }

  // 归一化向量
  return vector.map(val => val / magnitude);
}

/**
 * 计算两个向量的余弦相似度
 *
 * @param vectorA 第一个向量
 * @param vectorB 第二个向量
 * @returns 余弦相似度，范围为 [-1, 1]
 */
export function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }

  // 归一化向量
  const normalizedA = normalizeVector(vectorA);
  const normalizedB = normalizeVector(vectorB);

  // 计算点积
  return normalizedA.reduce((sum, val, i) => sum + val * normalizedB[i], 0);
}

/**
 * 计算两个向量的欧几里得距离
 *
 * @param vectorA 第一个向量
 * @param vectorB 第二个向量
 * @returns 欧几里得距离
 */
export function euclideanDistance(
  vectorA: number[],
  vectorB: number[],
): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }

  // 计算欧几里得距离
  return Math.sqrt(
    vectorA.reduce((sum, val, i) => sum + Math.pow(val - vectorB[i], 2), 0),
  );
}

/**
 * 将余弦相似度转换为距离
 * 距离 = 1 - 相似度
 *
 * @param similarity 余弦相似度
 * @returns 距离值
 */
export function similarityToDistance(similarity: number): number {
  return 1 - similarity;
}

/**
 * 将距离转换为相似度
 * 相似度 = 1 - 距离
 *
 * @param distance 距离值
 * @returns 相似度值
 */
export function distanceToSimilarity(distance: number): number {
  return 1 - distance;
}
