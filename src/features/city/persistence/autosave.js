// Debounce frequent edits with a maximum wait. Serialize writes so an older
// snapshot never wins a race against a newer edit.
export class Autosave {
  constructor(store, onStatus, { delay = 1800, maxWait = 10000, timers = globalThis } = {}) {
    Object.assign(this, { store, onStatus, delay, maxWait, timers });
    this.pending = null; this.writer = null; this.disposed = false;
  }
  schedule(city, projectId) {
    if (this.disposed) return;
    this.pending = { city, projectId };
    this.onStatus({ state: 'pending' });
    this.timers.clearTimeout(this.timer);
    const save = () => { this.flush().catch(() => {}); };
    this.timer = this.timers.setTimeout(save, this.delay);
    this.maxTimer ??= this.timers.setTimeout(save, this.maxWait);
  }
  clearTimers() {
    this.timers.clearTimeout(this.timer); this.timers.clearTimeout(this.maxTimer);
    this.timer = null; this.maxTimer = null;
  }
  flush() {
    this.clearTimers();
    if (this.writer) return this.writer;
    if (!this.pending) return Promise.resolve();
    this.writer = this.drain().finally(() => { this.writer = null; });
    return this.writer;
  }
  async drain() {
    while (this.pending) {
      const next = this.pending; this.pending = null;
      this.onStatus({ state: 'saving' });
      try {
        const record = await this.store.save(next.city, next.projectId);
        this.onStatus({ state: this.pending ? 'pending' : 'saved', savedAt: record.updatedAt });
      } catch (error) {
        this.pending ||= next;
        this.onStatus({ state: 'error', message: error.message || '저장 공간을 확인하고 파일로 내보내세요.' });
        throw error;
      }
    }
  }
  get dirty() { return !!(this.pending || this.writer); }
  dispose() { this.disposed = true; this.clearTimers(); }
}
