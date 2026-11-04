export type CloudHeadRelation = 'same' | 'cloud-descends-from-local' | 'local-descends-from-cloud' | 'conflict' | 'unknown';

/** Parent links prove ancestry; timestamps, cash and local revision never choose a winner. */
export function compareCloudHeads(
  localCheckpointId: string | null,
  cloudCheckpointId: string,
  parentIdsByCheckpoint: ReadonlyMap<string, readonly string[]>,
): CloudHeadRelation {
  if (!localCheckpointId) return 'unknown';
  if (localCheckpointId === cloudCheckpointId) return 'same';
  const cloudHasLocal = hasAncestor(cloudCheckpointId, localCheckpointId, parentIdsByCheckpoint);
  const localHasCloud = hasAncestor(localCheckpointId, cloudCheckpointId, parentIdsByCheckpoint);
  if (cloudHasLocal === true && localHasCloud === false) return 'cloud-descends-from-local';
  if (localHasCloud === true && cloudHasLocal === false) return 'local-descends-from-cloud';
  if (cloudHasLocal === null || localHasCloud === null) return 'unknown';
  return 'conflict';
}

function hasAncestor(
  from: string,
  target: string,
  parents: ReadonlyMap<string, readonly string[]>,
): boolean | null {
  const visited = new Set<string>();
  const queue = [from];
  let incomplete = false;
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    if (visited.size > 512) return null;
    if (id === target) return true;
    const parentIds = parents.get(id);
    if (!parentIds) { incomplete = true; continue; }
    queue.push(...parentIds);
  }
  return incomplete ? null : false;
}
