const $ = selector => document.querySelector(selector);
let toastTimer;
function notify(message) {
  const toast = $('#sample-toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
}
document.querySelectorAll('[data-notice]').forEach(button => {
  button.addEventListener('click', () => notify(button.dataset.notice));
});
document.querySelectorAll('.rpg-nav button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.rpg-nav button').forEach(item => item.removeAttribute('aria-current'));
    button.setAttribute('aria-current', 'page');
    $('#nav-selection').textContent = '选中示例：' + button.textContent.trim() + '（不跳转游戏）';
  });
});
document.querySelectorAll('.rpg-item:not(:disabled)').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.rpg-item').forEach(item => item.setAttribute('aria-pressed', 'false'));
    button.setAttribute('aria-pressed', 'true');
    $('#item-selection').textContent = '已选择：' + button.getAttribute('aria-label');
  });
});
$('#toggle-monsters').addEventListener('click', () => {
  const empty = !$('#enemy-list').hidden;
  $('#enemy-list').hidden = empty;
  $('#enemy-empty').hidden = !empty;
  $('#enemy-count').textContent = empty ? '0/8' : '8/8';
  $('#toggle-monsters').textContent = empty ? '展示怪物列表' : '展示空状态';
});
$('#status-case').addEventListener('change', event => {
  const cases = {
    normal: ['少侠无名', '820/1000', '82%', '1250/3000', '42%'],
    danger: ['少侠无名', '120/1000', '12%', '1250/3000', '42%'],
    large: ['这是一位十字名字少侠', '9.9M/10M', '99%', '满级 MAX', '100%'],
  };
  const values = cases[event.target.value];
  $('#sample-name').textContent = values[0];
  $('#sample-hp-text').textContent = values[1];
  $('#sample-hp').style.setProperty('--value', values[2]);
  $('#sample-hp').classList.toggle('rpg-meter--danger', event.target.value === 'danger');
  $('#sample-exp-text').textContent = values[3];
  $('#sample-exp').style.setProperty('--value', values[4]);
});
$('#potion-enabled').addEventListener('change', event => {
  $('#threshold').disabled = !event.target.checked;
  $('#potion-choice').disabled = !event.target.checked;
  $('#potion-state').textContent = event.target.checked ? '已开启' : '已关闭';
});
$('#threshold').addEventListener('input', event => { $('#threshold-value').textContent = event.target.value + '%'; });
$('#sample-form').addEventListener('submit', event => {
  event.preventDefault();
  const value = $('#role-name').value.trim();
  const valid = /^[\p{Script=Han}A-Za-z0-9_]{1,10}$/u.test(value);
  $('#role-name').setAttribute('aria-invalid', String(!valid));
  $('#name-error').hidden = valid;
  if (valid) notify('样板校验通过；未写入任何游戏设置。');
  else $('#role-name').focus();
});
document.querySelectorAll('[data-open]').forEach(button => {
  button.addEventListener('click', () => {
    const dialog = document.getElementById(button.dataset.open);
    if (dialog.id === 'quantity-dialog') {
      $('#quantity').value = '1';
      $('#quantity').removeAttribute('aria-invalid');
      $('#qty-error').hidden = true;
    }
    dialog.showModal();
  });
});
document.querySelectorAll('[data-close]').forEach(button => {
  button.addEventListener('click', () => button.closest('dialog').close());
});
document.querySelectorAll('dialog').forEach(dialog => {
  // Keep keyboard traversal inside the modal even at the browser's focus boundary.
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return;
    const controls = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')]
      .filter(element => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
});
const quantity = $('#quantity');
function quantityValue() {
  const n = Number(quantity.value);
  return Number.isFinite(n) ? Math.max(1, Math.min(12, Math.floor(n))) : 1;
}
document.querySelectorAll('[data-step]').forEach(button => {
  button.addEventListener('click', () => {
    quantity.value = String(Math.max(1, Math.min(12, quantityValue() + Number(button.dataset.step))));
    quantity.removeAttribute('aria-invalid');
    $('#qty-error').hidden = true;
  });
});
$('#qty-confirm').addEventListener('click', () => {
  const n = Number(quantity.value);
  if (!quantity.value || !Number.isInteger(n) || n < 1 || n > 12) {
    $('#qty-error').hidden = false;
    quantity.setAttribute('aria-invalid', 'true');
    quantity.focus();
    return;
  }
  quantity.setAttribute('aria-invalid', 'false');
  $('#quantity-dialog').close();
  notify('数量示例确认：' + n + '。没有移动实际物品。');
});
quantity.addEventListener('input', () => { quantity.removeAttribute('aria-invalid'); $('#qty-error').hidden = true; });
document.querySelectorAll('[data-location]').forEach(button => {
  button.addEventListener('click', () => {
    $('#map-dialog').close();
    notify('地点选择示例：' + button.dataset.location + '。没有切换实际地图。');
  });
});
for (let i = 0; i < 18; i++) {
  const line = document.createElement('p');
  const time = document.createElement('time');
  time.textContent = '14:32:' + String(i).padStart(2, '0');
  line.append(time, document.createTextNode(i % 2 ? '野猫 → 你：伤害 8' : '你 → 野猫：伤害 36'));
  $('#sample-combat-log').append(line);
}
