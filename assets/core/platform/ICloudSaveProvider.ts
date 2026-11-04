import type { CloudArchiveRef, CloudCheckpointV1, CloudOperationResult } from '../persistence/CloudSaveTypes';

export interface ICloudSaveProvider {
  capabilities(): { available: boolean; deleteAvailable: boolean };
  list(operationId: string): Promise<CloudOperationResult<CloudArchiveRef[]>>;
  download(operationId: string, archive: CloudArchiveRef, targetFilePath: string): Promise<CloudOperationResult<string>>;
  writeLocal(operationId: string, filePath: string, data: string): Promise<CloudOperationResult<true>>;
  readLocal(operationId: string, filePath: string): Promise<CloudOperationResult<string>>;
  create(operationId: string, checkpoint: CloudCheckpointV1, filePath: string): Promise<CloudOperationResult<CloudArchiveRef>>;
  delete(operationId: string, archive: CloudArchiveRef): Promise<CloudOperationResult<true>>;
}
