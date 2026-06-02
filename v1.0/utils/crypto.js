/**
 * @file utils/crypto.js
 * @desc sha256 校验 + base64 编解码
 */

export async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function base64Encode(obj) {
  try {
    // btoa 不支持 Unicode，需要先 encodeURIComponent
    return btoa(encodeURIComponent(JSON.stringify(obj)));
  } catch {
    return null;
  }
}

export function base64Decode(str) {
  try {
    return JSON.parse(decodeURIComponent(atob(str)));
  } catch {
    return null;
  }
}

/**
 * 计算存档完整性校验和
 * @param {Object} data 原始存档数据
 * @param {string} version 存档版本
 * @param {number} savedAt 时间戳
 * @returns {string} sha256 校验和
 */
export async function computeChecksum(data, version, savedAt) {
  const payload = JSON.stringify({ data, version, saved_at: savedAt });
  return sha256(payload);
}