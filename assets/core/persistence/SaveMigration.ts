import type { SaveEnvelope } from './SaveTypes';

/**
 * 存档迁移骨架（设计文档 02.7）。
 * 规则：只允许向前迁移；迁移前校验来源、迁移后校验目标；失败不破坏原档。
 * 当前 schemaVersion=1，尚无历史版本，保留注册结构供 vN→vN+1 使用。
 */
type Migrator = (envelope: SaveEnvelope) => SaveEnvelope;

const migrators = new Map<number, Migrator>();

export function registerMigrator(fromVersion: number, migrate: Migrator): void {
  migrators.set(fromVersion, migrate);
}

export function migrateEnvelope(envelope: SaveEnvelope, targetVersion = 1): SaveEnvelope {
  let current = envelope;
  while (current.schemaVersion < targetVersion) {
    const migrate = migrators.get(current.schemaVersion);
    if (!migrate) {
      throw new Error(`no migrator from schemaVersion ${current.schemaVersion}`);
    }
    current = migrate(current);
  }
  if (current.schemaVersion > targetVersion) {
    throw new Error(`save schema ${current.schemaVersion} is newer than supported ${targetVersion}`);
  }
  return current;
}
