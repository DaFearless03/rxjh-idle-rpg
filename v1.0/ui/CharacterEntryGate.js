const ENTRY_STATES = new Set(['selecting', 'creating', 'entering', 'active']);

export class CharacterEntryGate {
  constructor() {
    this._state = 'selecting';
    this._revision = 0;
  }

  get state() {
    return this._state;
  }

  isActive() {
    return this._state === 'active';
  }

  setState(state) {
    if (!ENTRY_STATES.has(state)) {
      throw new RangeError('无效的角色入口状态：' + state);
    }
    if (this._state !== state) {
      this._state = state;
      this._revision += 1;
    }
    return this._revision;
  }

  beginEntryAttempt() {
    if (this._state === 'entering') return null;
    return this.setState('entering');
  }

  isCurrentEntryAttempt(revision) {
    return Number.isSafeInteger(revision)
      && revision === this._revision
      && this._state === 'entering';
  }

  modalCloseAction(modalId) {
    if (modalId === 'modal-offline') return 'block';
    if (this._state === 'active') return 'close';
    if (this._state === 'selecting') {
      return modalId === 'modal-delete-confirm' ? 'close' : 'block';
    }
    if (this._state === 'creating' && modalId === 'modal-create') {
      return 'return-to-list';
    }
    return 'block';
  }

  isEntryModalInteractive(modalId) {
    if (this._state === 'selecting') {
      return modalId === 'modal-multi-save' || modalId === 'modal-delete-confirm';
    }
    return this._state === 'creating' && modalId === 'modal-create';
  }
}
