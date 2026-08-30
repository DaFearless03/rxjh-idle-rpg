/**
 * @file utils/martial_arts.js
 * @desc 武功学习与使用共用条件判定
 */

export function getCareerTransferCount(player) {
  return [player?.career, ...(Array.isArray(player?.career_history) ? player.career_history : [])]
    .reduce((maxTransfer, career) => {
      const match = String(career || '').match(/_transfer_(\d+)/);
      return Math.max(maxTransfer, match ? Number(match[1]) : 0);
    }, 0);
}

export function getCareerFamily(player) {
  if (['blade', 'sword', 'spear', 'staff'].includes(player?.career_family)) {
    return player.career_family;
  }
  const career = String(player?.career || '');
  if (career.startsWith('warrior_blade')) return 'blade';
  if (career.startsWith('warrior_sword')) return 'sword';
  if (career.startsWith('warrior_spear')) return 'spear';
  if (career.startsWith('healer')) return 'staff';
  return '';
}

export function meetsMartialArtRequirements(player, martialArt) {
  if (!player || !martialArt || typeof martialArt !== 'object') return false;
  const requirement = martialArt.requirement || {};
  const level = Number(player.level);
  const requiredLevel = Number(requirement.level ?? 1);
  const requiredTransfer = Number(requirement.min_transfer ?? 0);
  if (!Number.isSafeInteger(level) || level < 1
    || !Number.isSafeInteger(requiredLevel) || requiredLevel < 1
    || !Number.isSafeInteger(requiredTransfer) || requiredTransfer < 0) {
    return false;
  }
  if (level < requiredLevel || getCareerTransferCount(player) < requiredTransfer) return false;
  if (requirement.career_family && requirement.career_family !== getCareerFamily(player)) return false;
  if (requirement.faction && requirement.faction !== player.faction) return false;
  return true;
}

export function isMartialArtUsable(player, martialArt) {
  return Array.isArray(player?.learned_martial_arts)
    && player.learned_martial_arts.includes(martialArt?.key)
    && meetsMartialArtRequirements(player, martialArt);
}
