/**
 * @file entities/QuestInstance.js
 * @desc 任务实例：accepted[] 项的运行时对象 + lookup
 */

/**
 * 创建任务实例（接取时调用）
 * @param {Object} questTemplate
 * @returns {Object} 任务实例
 */
export function createQuestInstance(questTemplate) {
  return {
    key: questTemplate.key,
    type: questTemplate.type,
    name: questTemplate.name,
    description: questTemplate.description,
    faction: questTemplate.faction || null,
    current_stage: 1,
    completed_stages: [],
    accepted_at: Date.now(),
    // stage 推进后记录通知
    stage_advance_notified: false
  };
}

/**
 * 查找包含指定 item_key 的已接任务（用于 quest_item_drop_condition）
 * @param {Object} player
 * @param {string} itemKey
 * @returns {Object|null}
 */
export function lookupActiveQuest(player, itemKey) {
  const accepted = player.quests?.accepted || [];
  for (const quest of accepted) {
    for (const stageBlock of quest.objectives || []) {
      if (stageBlock.stage !== quest.current_stage) continue;
      for (const item of stageBlock.items || []) {
        if (item.item_key === itemKey) {
          return quest;
        }
      }
    }
  }
  return null;
}

/**
 * 查找指定 item_key 的 required_count
 */
export function lookupRequiredCount(quest, itemKey) {
  for (const stageBlock of quest.objectives || []) {
    if (stageBlock.stage !== quest.current_stage) continue;
    for (const item of stageBlock.items || []) {
      if (item.item_key === itemKey) return item.count;
    }
  }
  return 0;
}