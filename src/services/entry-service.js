export class EntryService {
  constructor({ version, currentURL, replace, readState = () => ({}) }) {
    Object.assign(this, { version, currentURL, replace, readState });
  }

  async start() {
    try {
      await this.version.refresh();
    } catch {
      return 'continue';
    }
    const { dirty = false, saving = false } = this.readState() || {};
    if (dirty || saving || !this.version.pendingBuild) return 'continue';
    const target = new URL(this.currentURL);
    if (target.searchParams.get('_pc')?.startsWith(this.version.pendingBuild + '-')) {
      return 'continue';
    }
    target.searchParams.set('_pc', this.version.pendingBuild + '-' + crypto.randomUUID());
    this.replace(target.href);
    return 'replaced';
  }
}
