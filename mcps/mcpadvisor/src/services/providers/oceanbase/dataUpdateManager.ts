/**
 * 数据更新管理器
 * 负责跟踪和管理数据库更新时间
 */

import { Pool } from 'mysql2/promise';
import { getClient } from './controller.js';
import logger from '../../../utils/logger.js';

// 表名
const UPDATE_INFO_TABLE = 'mcp_data_update_info';

// 更新类型
export enum UpdateType {
  VECTOR_DATA = 'vector_data',
}

/**
 * 数据更新管理器
 */
export class DataUpdateManager {
  /**
   * 初始化更新信息表
   */
  static async initUpdateInfoTable(): Promise<void> {
    try {
      const sql = `
        CREATE TABLE IF NOT EXISTS ${UPDATE_INFO_TABLE} (
          update_type VARCHAR(50) PRIMARY KEY,
          last_update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          update_count INT DEFAULT 0
        );
      `;

      const client = await getClient();
      await client.query(sql);
      logger.debug('Update info table initialized');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error initializing update info table: ${message}`);
      throw error;
    }
  }

  /**
   * 获取上次更新时间
   * @param updateType 更新类型
   * @returns 上次更新时间，如果没有记录则返回null
   */
  static async getLastUpdateTime(updateType: UpdateType): Promise<Date | null> {
    try {
      const sql = `
        SELECT last_update_time 
        FROM ${UPDATE_INFO_TABLE} 
        WHERE update_type = ?
      `;

      const client = await getClient();
      const [rows] = await client.query(sql, [updateType]);
      const result = rows as any[];

      if (result.length === 0) {
        return null;
      }

      return new Date(result[0].last_update_time);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error getting last update time: ${message}`);
      return null;
    }
  }

  /**
   * 更新上次更新时间
   * @param updateType 更新类型
   */
  static async updateLastUpdateTime(updateType: UpdateType): Promise<void> {
    try {
      const now = new Date();
      const client = await getClient();

      // 检查记录是否存在
      const existingRecord = await this.getLastUpdateTime(updateType);

      if (existingRecord === null) {
        // 插入新记录
        const insertSql = `
          INSERT INTO ${UPDATE_INFO_TABLE} (update_type, last_update_time, update_count)
          VALUES (?, ?, 1)
        `;

        await client.query(insertSql, [updateType, now]);
      } else {
        // 更新现有记录
        const updateSql = `
          UPDATE ${UPDATE_INFO_TABLE}
          SET last_update_time = ?,
              update_count = update_count + 1
          WHERE update_type = ?
        `;

        await client.query(updateSql, [now, updateType]);
      }

      logger.info(
        `Updated last update time for ${updateType} to ${now.toISOString()}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error updating last update time: ${message}`);
      throw error;
    }
  }

  /**
   * 检查数据是否需要更新
   * @param updateType 更新类型
   * @param maxAgeHours 最大有效时间（小时）
   * @returns 是否需要更新
   */
  static async needsUpdate(
    updateType: UpdateType,
    maxAgeHours: number = 1,
  ): Promise<boolean> {
    const lastUpdateTime = await this.getLastUpdateTime(updateType);

    // 如果没有记录，需要更新
    if (lastUpdateTime === null) {
      logger.info(`No previous update record for ${updateType}, update needed`);
      return true;
    }

    const now = new Date();
    const ageMs = now.getTime() - lastUpdateTime.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    const needsUpdate = ageHours > maxAgeHours;

    if (needsUpdate) {
      logger.info(
        `Data for ${updateType} is ${ageHours.toFixed(2)} hours old, update needed`,
      );
    } else {
      logger.info(
        `Data for ${updateType} is ${ageHours.toFixed(2)} hours old, still fresh`,
      );
    }

    return needsUpdate;
  }
}
