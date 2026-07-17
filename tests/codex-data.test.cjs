const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { collectCodexData, normalizeWindows } = require('../electron/codex-data.cjs');

test('collectCodexData aggregates real token deltas without double counting snapshots', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-widget-'));
  const day = path.join(home, 'sessions', '2026', '07', '17');
  await fs.mkdir(day, { recursive: true });
  const records = [
    { timestamp: '2026-07-17T01:00:00Z', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 80, output_tokens: 20, total_tokens: 100 } } } },
    { timestamp: '2026-07-17T01:01:00Z', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 120, output_tokens: 30, total_tokens: 150 } }, rate_limits: { primary: { used_percent: 25, window_minutes: 300, resets_at: 1784250000 }, secondary: { used_percent: 40, window_minutes: 10080, resets_at: 1784850000 } } } },
  ];
  await fs.writeFile(path.join(day, 'rollout.jsonl'), records.map(JSON.stringify).join('\n'));
  const data = await collectCodexData({ codexHome: home, now: new Date('2026-07-17T12:00:00Z') });
  assert.equal(data.today.total, 150);
  assert.equal(data.cumulative.input, 120);
  assert.equal(data.weekly.windowMinutes, 10080);
  assert.equal(data.weekly.remainingPercent, 60);
});

test('normalizeWindows returns the longest rate window first', () => {
  const windows = normalizeWindows({
    primary: { used_percent: 20, window_minutes: 300, resets_at: 1 },
    secondary: { used_percent: 30, window_minutes: 10080, resets_at: 2 },
  });
  assert.equal(windows[0].windowMinutes, 10080);
});

