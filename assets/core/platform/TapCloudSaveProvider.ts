import type { CloudArchiveRef, CloudCheckpointV1, CloudOperationResult } from '../persistence/CloudSaveTypes';
import { encodeCloudCheckpoint } from '../persistence/CloudSaveCodec';
import type { ICloudSaveProvider } from './ICloudSaveProvider';

type CallbackError = { errno?: number; errCode?: number; errMsg?: string };
type Callback<T> = { success?: (value: T) => void; fail?: (error: CallbackError) => void };
interface CloudManager {
  getArchiveList?(args: Callback<{ saves?: unknown[] }>): void;
  getArchiveData?(args: { archiveUUID: string; archiveFileId: string; targetFilePath: string } & Callback<{ filePath?: string }>): void;
  createArchive?(args: { archiveMetaData: Record<string, unknown>; archiveFilePath: string } & Callback<{ uuid?: string; fileId?: string }>): void;
  deleteArchive?(args: { archiveUUID: string } & Callback<unknown>): void;
}
interface FileSystem {
  readFile?(args: { filePath: string; encoding: 'utf8' } & Callback<{ data?: string | ArrayBuffer }>): void;
  writeFile?(args: { filePath: string; data: string; encoding: 'utf8' } & Callback<unknown>): void;
}
interface TapCloudRuntime {
  getCloudSaveManager?(): CloudManager;
  getFileSystemManager?(): FileSystem;
  env?: { USER_DATA_PATH?: string; TEMP_DATA_PATH?: string };
}

const OP_TIMEOUT_MS = 20_000;

/** Narrow runtime adapter; the cloud SDK is supplied by the Tap minigame host. */
export class TapCloudSaveProvider implements ICloudSaveProvider {
  private nativeLease: Promise<void> = Promise.resolve();
  private nativePending = false;

  constructor(private readonly host: unknown = globalThis) {}

  hasUnsettledNativeOperation(): boolean { return this.nativePending; }

  defaultFilePath(name: string): string | null {
    const root = this.tap()?.env?.USER_DATA_PATH;
    return typeof root === 'string' && root.length > 0 ? `${root}/${name}` : null;
  }

  capabilities(): { available: boolean; deleteAvailable: boolean } {
    const tap = this.tap();
    let manager: CloudManager | null = null;
    let fs: FileSystem | null = null;
    try { manager = tap?.getCloudSaveManager?.() ?? null; fs = tap?.getFileSystemManager?.() ?? null; } catch { /* feature detect */ }
    return {
      available: !!tap?.env?.USER_DATA_PATH && !!manager?.getArchiveList && !!manager.getArchiveData && !!manager.createArchive && !!fs?.readFile && !!fs.writeFile,
      deleteAvailable: typeof manager?.deleteArchive === 'function',
    };
  }

  list(operationId: string): Promise<CloudOperationResult<CloudArchiveRef[]>> {
    return this.invoke(operationId, (manager, settle) => manager.getArchiveList!({ success: (result) => {
      const records = Array.isArray(result?.saves) ? result.saves : [];
      const refs = records.map(toArchiveRef).filter((item): item is CloudArchiveRef => item !== null);
      settle({ kind: 'ok', value: refs });
    }, fail: (error) => settle(errorResult(error)) }));
  }

  download(operationId: string, archive: CloudArchiveRef, targetFilePath: string): Promise<CloudOperationResult<string>> {
    return this.invoke(operationId, (manager, settle) => manager.getArchiveData!({
      archiveUUID: archive.uuid, archiveFileId: archive.fileId, targetFilePath,
      success: (result) => typeof result?.filePath === 'string'
        ? settle({ kind: 'ok', value: result.filePath })
        : settle({ kind: 'unavailable', reason: 'cloud-download-empty-path' }),
      fail: (error) => settle(errorResult(error)),
    }));
  }

  writeLocal(operationId: string, filePath: string, data: string): Promise<CloudOperationResult<true>> {
    return this.invoke(operationId, (_manager, settle, fs) => fs.writeFile!({ filePath, data, encoding: 'utf8',
      success: () => settle({ kind: 'ok', value: true }), fail: (error) => settle(errorResult(error)),
    }));
  }

  readLocal(operationId: string, filePath: string): Promise<CloudOperationResult<string>> {
    return this.invoke(operationId, (_manager, settle, fs) => fs.readFile!({ filePath, encoding: 'utf8',
      success: (result) => {
        if (typeof result?.data === 'string') settle({ kind: 'ok', value: result.data });
        else settle({ kind: 'unavailable', reason: 'cloud-file-not-utf8-text' });
      },
      fail: (error) => settle(errorResult(error)),
    }));
  }

  create(operationId: string, checkpoint: CloudCheckpointV1, filePath: string): Promise<CloudOperationResult<CloudArchiveRef>> {
    const metadata = {
      name: `ceo_${checkpoint.cloudProfileId.replace(/[^A-Za-z0-9]/g, '').slice(0, 32)}`,
      summary: `第${checkpoint.summary.year}年${checkpoint.summary.month}月，员工${checkpoint.summary.employeeCount}人`,
      extra: JSON.stringify({ protocolVersion: 1, appId: checkpoint.appId, environment: checkpoint.environment,
        checkpointId: checkpoint.checkpointId, profileId: checkpoint.cloudProfileId,
        parentCheckpointIds: checkpoint.parentCheckpointIds, resetEpoch: checkpoint.resetEpoch }),
      playtime: Math.max(0, Math.floor(checkpoint.snapshot.payload.lastWallClockMs / 1000)),
    };
    const data = encodeCloudCheckpoint(checkpoint);
    return this.writeLocal(`${operationId}:file`, filePath, data).then((written) => {
      if (written.kind !== 'ok') return written as CloudOperationResult<CloudArchiveRef>;
      return this.invoke(operationId, (manager, settle) => manager.createArchive!({
        archiveMetaData: metadata, archiveFilePath: filePath,
        success: (result) => result?.uuid && result.fileId
          ? settle({ kind: 'ok', value: { uuid: result.uuid, fileId: result.fileId, name: metadata.name, summary: metadata.summary, extra: metadata.extra } })
          : settle({ kind: 'unknown', operationId, reason: 'create-response-missing-identifiers' }),
        fail: (error) => settle(errorResult(error)),
      }));
    });
  }

  delete(operationId: string, archive: CloudArchiveRef): Promise<CloudOperationResult<true>> {
    const manager = this.manager();
    if (typeof manager?.deleteArchive !== 'function') return Promise.resolve({ kind: 'unsupported' });
    return this.invoke(operationId, (m, settle) => m.deleteArchive!({ archiveUUID: archive.uuid,
      success: () => settle({ kind: 'ok', value: true }), fail: (error) => settle(errorResult(error)),
    }));
  }

  private async invoke<T>(operationId: string, call: (manager: CloudManager, settle: (result: CloudOperationResult<T>) => void, fs: FileSystem) => void): Promise<CloudOperationResult<T>> {
    const previous = this.nativeLease;
    let releaseLease!: () => void;
    this.nativeLease = new Promise<void>((resolve) => { releaseLease = resolve; });
    await previous;
    const tap = this.tap();
    const manager = this.manager();
    let fs: FileSystem;
    try { fs = tap?.getFileSystemManager?.() ?? {}; } catch { fs = {}; }
    if (!manager || !this.capabilities().available) { releaseLease(); return { kind: 'unsupported' }; }
    return new Promise<CloudOperationResult<T>>((resolveResult) => {
      let nativeSettled = false;
      let resultReturned = false;
      this.nativePending = true;
      const timer = setTimeout(() => {
        resultReturned = true;
        resolveResult({ kind: 'unknown', operationId, reason: 'callback-timeout' });
      }, OP_TIMEOUT_MS);
      const finish = (value: CloudOperationResult<T>) => {
        if (nativeSettled) return;
        nativeSettled = true;
        clearTimeout(timer);
        this.nativePending = false;
        releaseLease();
        if (!resultReturned) resolveResult(value);
      };
      try { call(manager, finish, fs); }
      catch (error) { finish({ kind: 'unavailable', reason: safeError(error) }); }
    });
  }

  private tap(): TapCloudRuntime | null {
    const value = (this.host as { tap?: unknown } | null)?.tap;
    return value && typeof value === 'object' ? value as TapCloudRuntime : null;
  }

  private manager(): CloudManager | null {
    try { return this.tap()?.getCloudSaveManager?.() ?? null; } catch { return null; }
  }
}

function toArchiveRef(value: unknown): CloudArchiveRef | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.uuid !== 'string' || typeof item.fileId !== 'string' || typeof item.name !== 'string') return null;
  return { uuid: item.uuid, fileId: item.fileId, name: item.name,
    ...(typeof item.summary === 'string' ? { summary: item.summary } : {}),
    ...(typeof item.extra === 'string' ? { extra: item.extra } : {}),
  };
}

function errorResult(error: CallbackError): CloudOperationResult<never> {
  const code = Number.isInteger(error?.errno) ? error.errno : Number.isInteger(error?.errCode) ? error.errCode : undefined;
  return { kind: 'unavailable', ...(code === undefined ? {} : { code }), reason: typeof error?.errMsg === 'string' ? error.errMsg.slice(0, 160) : 'platform-cloud-error' };
}

function safeError(error: unknown): string { return error instanceof Error ? error.message.slice(0, 160) : 'platform-cloud-throw'; }
