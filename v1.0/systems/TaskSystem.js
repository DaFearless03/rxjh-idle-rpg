/**
 * @file systems/TaskSystem.js
 * @desc 任务系统：接取过滤 / stage_advance_check / submit_quest
 * @ref 08_maps_npc_quests / 09_economy_drops
 */
import { InventorySystem } from './InventorySystem.js';
import { UIState, NPCSystem } from './NPCSystem.js';
import { eventBus } from '../core/EventBus.js';

export const TaskSystem = {
  /**
   * 获取当前 NPC 可接任务列表（过滤后）
   * @param {Object} player
   * @param {Object} npcData npc.json 中的 quest_npc 条目
   * @returns {Object[]} 可见任务列表
   */
  listVisibleQuests(player, npcData) {
    if (!npcData || npcData.type !== 'quest') return [];

    const completed = player.quests?.completed || [];
    const accepted = player.quests?.accepted || [];
    const transferCount = this._getTransferCount(player);

    return npcData.quests
      .map(entry => this._questTemplates.find(q => q.key === entry.key))
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
    if (!player.quests) player.quests = { accepted: [], completed: [] };
    const accepted = player.quests.accepted || [];

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
      current_stage: 1,
      completed_stages: [],
      objectives: questTemplate.objectives,
      rewards: questTemplate.rewards,
      dialogue: questTemplate.dialogue,
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
    const accepted = player.quests?.accepted || [];
    let advanced = false;

    for (const quest of accepted) {
      // 找当前 stage 的 items
      const stageBlock = quest.objectives.find(s => s.stage === quest.current_stage);
      if (!stageBlock) continue;

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
        const hasNext = quest.objectives.some(s => s.stage === nextStage);

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
    const accepted = player.quests?.accepted || [];
    if (!accepted.find(q => q.key === questInstance.key)) {
      return { success: false, message: '任务未接取' };
    }

    // 所有 stage 必须全部 completed
    // 兼容通过 giveItem 获得任务物品但未触发 stageAdvanceCheck 的情况：同时检查背包实际数量
    const allStages = questInstance.objectives.map(s => s.stage);
    for (let i = 0; i < allStages.length; i++) {
      if (!this.stageAdvanceCheck(player)) break;
    }
    const allStagesDone = allStages.every(stage => questInstance.completed_stages.includes(stage));
    if (!allStagesDone) {
      return { success: false, message: '任务尚未全部完成' };
    }

    // 必须在 quest_npc 处提交
    if (!UIState.active_npc || UIState.active_npc.npc_key !== 'quest_npc') {
      return { success: false, message: '请到泫渤派门主处提交此任务' };
    }

    const template = questTemplates.find(t => t.key === questInstance.key);
    if (!template) return { success: false, message: '任务模板未找到' };

    // 2. 扣除任务物品
    for (const stageBlock of questInstance.objectives) {
      for (const item of stageBlock.items) {
        InventorySystem.remove(player, item.item_key, item.count);
      }
    }

    // 3. 应用奖励
    for (const reward of template.rewards) {
      if (reward.type === 'unlock_career') {
        const fromCareer = player.career;
        // 按 career_family 匹配目标职业
        const targetCareer = reward.careers.find(c => {
          const cd = careersData.find(career => career.key === c);
          return cd && cd.career_family === player.career_family;
        });
        if (targetCareer) {
          player.career = targetCareer;
          player.career_history = player.career_history || [];
          player.career_history.push(targetCareer);
          console.log(`[转职] ${fromCareer} → ${targetCareer}`);
        }
      } else if (reward.type === 'set_faction') {
        if (player.faction !== reward.faction) {
          console.warn(`[警告] faction 不匹配: 期望 ${reward.faction}，当前 ${player.faction}`);
        }
      }
    }

    // 4. accepted → completed
    player.quests.accepted = player.quests.accepted.filter(q => q.key !== questInstance.key);
    player.quests.completed.push(questInstance.key);

    // 5. log / EventBus
    console.log(`[任务] 完成: ${questInstance.name}`);
    if (template.dialogue?.complete) {
      console.log(`  "${template.dialogue.complete}"`);
    }
    eventBus.emit('quest.completed', { questKey: questInstance.key, career: player.career });
    eventBus.emit('player.career_transfer', { from_career: player.career_history[player.career_history.length - 2], to_career: player.career });

    return { success: true, message: `任务完成: ${questInstance.name}` };
  },

  /**
   * 获取玩家 transfer_count（由 career key 派生）
   */
  _getTransferCount(player) {
    const career = player.career || '';
    const match = career.match(/_transfer_(\d+)st/);
    return match ? parseInt(match[1]) : 0;
  },

  _canAcceptQuest(player, questTemplate, precomputed = {}) {
    const completed = precomputed.completed || player.quests?.completed || [];
    const transferCount = precomputed.transferCount ?? this._getTransferCount(player);

    if (completed.includes(questTemplate.key)) {
      return { success: false, message: '任务已完成' };
    }
    if (questTemplate.required_transfer > transferCount) {
      return { success: false, message: '转职次数不足' };
    }
    if (player.level < questTemplate.prerequisite.level) {
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
