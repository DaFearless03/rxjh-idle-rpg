/**
 * @file systems/NPCSystem.js
 * @desc NPC 对话状态机：open_dialog / close_dialog / UIState.active_npc
 * @ref 08_maps_npc_quests NPC 对话状态
 */

export const UIState = {
  active_npc: null   // runtime only, not saved
};

/**
 * 强行关闭 NPC 对话（切场景/死亡时调用）
 */
export function forceCloseDialog() {
  UIState.active_npc = null;
}

export const NPCSystem = {
  /**
   * 打开 NPC 对话
   * @param {Object} npcData npc.json 中的 NPC 对象（含 key / type / name 等）
   */
  openDialog(npcData) {
    UIState.active_npc = {
      npc_key: npcData.key,
      type: npcData.type,
      name: npcData.name,
      data: npcData       // 完整引用
    };
    console.log(`[NPC] 与 ${npcData.name} 对话中`);
    return UIState.active_npc;
  },

  /**
   * 关闭当前 NPC 对话
   */
  closeDialog() {
    if (UIState.active_npc) {
      console.log(`[NPC] 关闭 ${UIState.active_npc.name} 对话`);
    }
    UIState.active_npc = null;
  },

  /**
   * 获取当前 NPC
   */
  getActiveNPC() {
    return UIState.active_npc;
  },

  /**
   * 是否在与 NPC 对话
   */
  isInDialog() {
    return UIState.active_npc !== null;
  },

  /**
   * 是否在城镇中（任意 NPC 对话中 = 在城镇）
   */
  isInTown() {
    return UIState.active_npc !== null;
  }
};