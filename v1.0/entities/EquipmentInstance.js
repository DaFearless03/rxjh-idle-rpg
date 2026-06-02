/**
 * @file entities/EquipmentInstance.js
 * @desc 装备实例工厂
 * @ref 09_economy_drops.md drop_helpers.create_equipment_instance
 */
import { generateUUID } from '../utils/uuid.js';

/**
 * 从装备模板创建唯一实例
 * @param {Object} equipmentTemplate 装备模板（来自 equipments[] 列表的某一条）
 * @returns {Object} 装备实例 { instance_id, item_key, enhance_level, synthesis_slots }
 */
export function createEquipmentInstance(equipmentTemplate) {
  return {
    instance_id: generateUUID(),
    item_key: equipmentTemplate.key,
    enhance_level: 0,
    synthesis_slots: []
  };
}