import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runHundredSeedBatch, summarize } from '../../tools/simulate5year.ts';

describe.skipIf(process.env.CEO_EXPORT_SIMULATION_EVIDENCE !== '1')('R40 evidence export', () => {
  it('writes all 900 actual run rows and summary', () => {
    const { rows, csv } = runHundredSeedBatch();
    const summary = summarize(rows);
    const output = path.resolve('evidence/m3/TASK-M3-09-R40/attempt-01');
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'simulation-900.csv'), `${csv}\n`, 'utf8');
    fs.writeFileSync(path.join(output, 'simulation-900.json'), JSON.stringify({ generatedAt: new Date().toISOString(), configHashAlgorithm: 'FNV-1a 64-bit over UTF-8 economy.v1.json bytes', summary, rows }, null, 2), 'utf8');
    expect(rows).toHaveLength(900);
    expect(summary.incomplete).toBe(0);
    expect(summary.conservationFail + summary.cashDeltaFail + summary.annualCashBridgeFail).toBe(0);
  });
});
