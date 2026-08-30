/**
 * @file systems/TaskSystem.js
 * @desc 任务系统：接取过滤 / stage_advance_check / submit_quest
 * @ref 08_maps_npc_quests / 09_economy_drops
 */
import { InventorySystem } from './InventorySystem.js?v=release-20260830-3';
import { UIState } from './NPCSystem.js?v=release-20260830-3';
import { eventBus } from '../core/EventBus.js?v=release-20260830-3';

export const TaskSystem = {
  /**
   * 获取当前 NPC 可接任务列表（过滤后）
   * @param {Object} player
   * @param {Object} npcData npc.json 中的 quest_npc 条目
   * @returns {Object[]} 可见任务列表
   */
  listVisibleQuests(player, npcData) {
    if (!npcData || npcData.type !== 'quest') return [];

    const completed = Array.isArray(player?.quests?.completed) ? player.quests.completed : [];
    const accepted = Array.isArray(player?.quests?.accepted) ? player.quests.accepted : [];
    const transferCount = this._getTransferCount(player);

    return (Array.isArray(npcData.quests) ? npcData.quests : [])
      .map(entry => (this._questTemplates || []).find(q => q.key === entry.key))
      .filter(t => {
        if (!t) return false;
        if (accepted.find(q => q.key === t.key)) return false;
        return this._canAcceptQuest(player, t, { completed, transferCount }).success;
      });
  },

  /**
   * 接取任务
   * @param {Object} player
   * @param {Object} questTemplate
   * @returns {{ success: boolean, message: string }}
   */
  acceptQuest(player, questTemplate) {
    if (!player || typeof player !== 'object' || !questTemplate?.key) {
      return { success: false, message: '任务数据无效' };
    }
    if (!player.quests || typeof player.quests !== 'object') player.quests = {};
    if (!Array.isArray(player.quests.accepted)) player.quests.accepted = [];
    if (!Array.isArray(player.quests.completed)) player.quests.completed = [];
    const accepted = player.quests.accepted;

    // 不可重复接取
    if (accepted.find(q => q.key === questTemplate.key)) {
      return { success: false, message: '任务已接取' };
    }

    const check = this._canAcceptQuest(player, questTemplate);
    if (!check.success) return check;

    // faction 设定（接取时立即生效）
    if (questTemplate.faction) {
      player.faction = questTemplate.faction;
      console.log(`[任务] 派系设定为: ${player.faction}`);
    }

    // 创建实例并加入 accepted
    const instance = {
      key: questTemplate.key,
      type: questTemplate.type,
      name: questTemplate.name,
      description: questTemplate.description,
      faction: questTemplate.faction || null,
      required_transfer: questTemplate.required_transfer || 0,
      target_transfer: questTemplate.target_transfer,
      prerequisite: structuredClone(questTemplate.prerequisite || {}),
      current_stage: 1,
      completed_stages: [],
      objectives: structuredClone(questTemplate.objectives || []),
      rewards: structuredClone(questTemplate.rewards || []),
      dialogue: structuredClone(questTemplate.dialogue || {}),
      accepted_at: Date.now()
    };

    player.quests.accepted.push(instance);

    console.log(`[任务] 接取: ${questTemplate.name}`);
    if (questTemplate.dialogue?.accept) {
      console.log(`  "${questTemplate.dialogue.accept}"`);
    }

    eventBus.emit('quest.accepted', { questKey: questTemplate.key, name: questTemplate.name });
    return { success: true, message: `接取成功: ${questTemplate.name}` };
  },

  /**
   * stage_advance_check：任务物品入背包后立即调用
   * @param {Object} player
   */
  stageAdvanceCheck(player) {
    const accepted = Array.isArray(player?.quests?.accepted) ? player.quests.accepted : [];
    let advanced = false;

    for (const quest of accepted) {
      if (!Array.isArray(quest?.objectives)) continue;
      quest.completed_stages = Array.isArray(quest.completed_stages)
        ? [...new Set(quest.completed_stages
          .map(Number)
          .filter(stage => Number.isSafeInteger(stage) && stage > 0))]
        : [];
      const currentStage = Number(quest.current_stage);
      quest.current_stage = Number.isSafeInteger(currentStage) && currentStage > 0 ? currentStage : 1;
      // 找当前 stage 的 items
      const stageBlock = quest.objectives.find(s => Number(s?.stage) === quest.current_stage);
      if (!stageBlock || !Array.isArray(stageBlock.items)) continue;

      // 判断是否全部收齐
      const allCollected = stageBlock.items.every(item => {
        return InventorySystem.count(player, item.item_key) >= item.count;
      });

      if (allCollected) {
        const alreadyCompleted = quest.completed_stages.includes(quest.current_stage);
        if (!alreadyCompleted) {
          quest.completed_stages.push(quest.current_stage);
        }
        const nextStage = quest.current_stage + 1;
        const hasNext = quest.objectives.some(s => Number(s?.stage) === nextStage);

        if (hasNext && !alreadyCompleted) {
          quest.current_stage = nextStage;
          quest.stage_advance_notified = false;
          console.log(`[任务] ${quest.name} 进入第 ${nextStage} 阶段`);
          eventBus.emit('quest.stage_advance', { questKey: quest.key, stage: nextStage });
        } else if (!alreadyCompleted) {
          // 全部 stage 完成，可提交
          console.log(`[任务] ${quest.name} 已完成所有阶段，可提交`);
          eventBus.emit('quest.all_stages_complete', { questKey: quest.key });
        }
        advanced = advanced || !alreadyCompleted;
      }
    }
    return advanced;
  },

  /**
   * 提交任务（5步流程）
   * @param {Object} player
   * @param {Object} questInstance accepted 列表中的任务实例
   * @param {Object[]} questTemplates 用于查 reward.careers
   * @param {Object[]} careersData 用于匹配 career_family
   * @returns {{ success: boolean, message: string }}
   */
  submitQuest(player, questInstance, questTemplates, careersData) {
    // 1. 校验前置
    const accepted = Array.isArray(player?.quests?.accepted) ? player.quests.accepted : [];
    const acceptedQuest = accepted.find(q => q.key === questInstance?.key);
    if (!acceptedQuest) {
      return { success: false, message: '任务未接取' };
    }

    const template = Array.isArray(questTemplates)
      ? questTemplates.find(t => t.key === acceptedQuest.key)
      : null;
    if (!template || !Array.isArray(template.objectives) || !Array.isArray(template.rewards)) {
      return { success: false, message: '任务模板未找到' };
    }

    // 所有 stage 必须全部 completed
    // 兼容通过 giveItem 获得任务物品但未触发 stageAdvanceCheck 的情况：同时检查背包实际数量
    const allStages = template.objectives.map(s => Number(s.stage));
    for (let i = 0; i < allStages.length; i++) {
      if (!this.stageAdvanceCheck(player)) break;
    }
    const completedStages = Array.isArray(acceptedQuest.completed_stages)
      ? acceptedQuest.completed_stages.map(Number)
      : [];
    const allStagesDone = allStages.every(stage => completedStages.includes(stage));
    if (!allStagesDone) {
      return { success: false, message: '任务尚未全部完成' };
    }

    // 必须在 quest_npc 处提交
    if (!UIState.active_npc || UIState.active_npc.npc_key !== 'quest_npc') {
      return { success: false, message: '请到泫渤派门主处提交此任务' };
    }

    const requirements = new Map();
    for (const stageBlock of template.objectives) {
      if (!Array.isArray(stageBlock?.items)) return { success: false, message: '任务目标数据无效' };
      for (const item of stageBlock.items) {
        const count = Number(item?.count);
        if (typeof item?.item_key !== 'string' || !item.item_key || !Number.isSafeInteger(count) || count <= 0) {
          return { success: false, message: '任务目标数据无效' };
        }
        const existing = requirements.get(item.item_key) || 0;
        if (count > Number.MAX_SAFE_INTEGER - existing) {
          return { success: false, message: '任务目标数据无效' };
        }
        requirements.set(item.item_key, existing + count);
      }
    }
    for (const [itemKey, count] of requirements) {
      if (InventorySystem.count(player, itemKey) < count) {
        return { success: false, message: '任务物品数量不足' };
      }
    }

    let targetCareer = player.career;
    let targetFaction = player.faction;
    for (const reward of template.rewards) {
      if (reward?.type === 'unlock_career') {
        targetCareer = Array.isArray(reward.careers) ? reward.careers.find(careerKey => {
          const career = Array.isArray(careersData) ? careersData.find(entry => entry.key === careerKey) : null;
          return career?.career_family === player.career_family;
        }) : null;
        if (!targetCareer) return { success: false, message: '转职奖励配置无效' };
      } else if (reward?.type === 'set_faction') {
        if (!['positive', 'negative', 'neutral'].includes(reward.faction)) {
          return { success: false, message: '派系奖励配置无效' };
        }
        targetFaction = reward.faction;
      }
    }

    // 2. 扣除任务物品
    const inventorySnapshot = structuredClone(player.inventory?.slots || []);
    for (const [itemKey, count] of requirements) {
      if (!InventorySystem.remove(player, itemKey, count)) {
        player.inventory.slots = inventorySnapshot;
        return { success: false, message: '任务物品扣除失败' };
      }
    }

    // 3. 应用奖励
    const fromCareer = player.career;
    player.career = targetCareer;
    player.faction = targetFaction;
    player.career_history = Array.isArray(player.career_history) ? player.career_history : [];
    if (targetCareer && !player.career_history.includes(targetCareer)) player.career_history.push(targetCareer);
    if (fromCareer !== targetCareer) {
      console.log(`[转职] ${fromCareer} → ${targetCareer}`);
    }

    // 4. accepted → completed
    player.quests.accepted = player.quests.accepted.filter(q => q.key !== acceptedQuest.key);
    if (!Array.isArray(player.quests.completed)) player.quests.completed = [];
    if (!player.quests.completed.includes(acceptedQuest.key)) player.quests.completed.push(acceptedQuest.key);

    // 5. log / EventBus
    console.log(`[任务] 完成: ${acceptedQuest.name}`);
    if (template.dialogue?.complete) {
      console.log(`  "${template.dialogue.complete}"`);
    }
    eventBus.emit('quest.completed', { questKey: acceptedQuest.key, career: player.career });
    if (fromCareer !== player.career) {
      eventBus.emit('player.career_transfer', { from_career: fromCareer, to_career: player.career });
    }

    return { success: true, message: `任务完成: ${acceptedQuest.name}` };
  },

  /**
   * 获取玩家 transfer_count（由 career key 派生）
   */
  _getTransferCount(player) {
    return [player?.career, ...(Array.isArray(player?.career_history) ? player.career_history : [])]
      .reduce((maxTransfer, career) => {
        const match = String(career || '').match(/_transfer_(\d+)/);
        return Math.max(maxTransfer, match ? Number(match[1]) : 0);
      }, 0);
  },

  _canAcceptQuest(player, questTemplate, precomputed = {}) {
    if (!player || !questTemplate?.key || !questTemplate.prerequisite) {
      return { success: false, message: '任务数据无效' };
    }
    const completed = Array.isArray(precomputed.completed)
      ? precomputed.completed
      : (Array.isArray(player.quests?.completed) ? player.quests.completed : []);
    const transferCount = precomputed.transferCount ?? this._getTransferCount(player);

    if (completed.includes(questTemplate.key)) {
      return { success: false, message: '任务已完成' };
    }
    const requiredTransfer = Number(questTemplate.required_transfer || 0);
    if (!Number.isSafeInteger(requiredTransfer) || requiredTransfer < 0) {
      return { success: false, message: '任务转职条件无效' };
    }
    if (questTemplate.type === 'career_transfer' && requiredTransfer !== transferCount) {
      return { success: false, message: requiredTransfer > transferCount ? '转职次数不足' : '已超过该转职阶段' };
    }
    const requiredLevel = Number(questTemplate.prerequisite.level);
    if (!Number.isFinite(requiredLevel) || requiredLevel < 1) return { success: false, message: '任务等级条件无效' };
    if (Number(player.level) < requiredLevel) {
      return { success: false, message: `等级不足，需要 Lv${questTemplate.prerequisite.level}` };
    }
    if (questTemplate.faction && questTemplate.faction !== player.faction && player.faction !== 'neutral') {
      return { success: false, message: '派系不符合' };
    }
    return { success: true, message: '可接取' };
  },

  /** 设置 quest_templates 引用（main.js 加载后注入） */
  setTemplates(templates) {
    this._questTemplates = templates;
  }
};
