import fs from 'fs';
import path from 'path';

type BlockedEntry = {
  ip: string;
  reason?: string;
  addedBy?: string;
  addedAt: string;
};

export class BlockedIPs {
  private filePath: string;
  private map: Map<string, BlockedEntry> = new Map();

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, 'blocked_ips.json');
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const arr: BlockedEntry[] = JSON.parse(raw);
        this.map.clear();
        arr.forEach(e => this.map.set(e.ip, e));
      }
    } catch (e) {
      console.error('Failed to load blocked IPs:', e);
    }
  }

  private save() {
    try {
      const arr = Array.from(this.map.values());
      fs.writeFileSync(this.filePath, JSON.stringify(arr, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save blocked IPs:', e);
    }
  }

  isBlocked(ip: string): boolean {
    return this.map.has(ip);
  }

  list(): BlockedEntry[] {
    return Array.from(this.map.values()).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }

  add(ip: string, reason?: string, addedBy?: string) {
    const entry: BlockedEntry = { ip, reason, addedBy, addedAt: new Date().toISOString() };
    this.map.set(ip, entry);
    this.save();
  }

  remove(ip: string) {
    this.map.delete(ip);
    this.save();
  }
}
