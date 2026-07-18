const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { collectCodexData, normalizeWindows } = require('../electron/codex-data.cjs');
const { collectOfficialCodexData, normalizeOfficialData } = require('../electron/codex-official.cjs');

test('collectCodexData aggregates real token deltas without double counting snapshots', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-widget-'));
  const day = path.join(home, 'sessions', '2026', '07', '17');
  await fs.mkdir(day, { recursive: true });
  const records = [
    { timestamp: '2026-07-17T01:00:00Z', type: 'event_msg', payload: { type: 'token_count', info: { last_token_usage: { input_tokens: 80, output_tokens: 20, total_tokens: 100 }, total_token_usage: { input_tokens: 80, output_tokens: 20, total_tokens: 100 } } } },
    { timestamp: '2026-07-17T01:01:00Z', type: 'event_msg', payload: { type: 'token_count', info: { last_token_usage: { input_tokens: 40, output_tokens: 10, total_tokens: 50 }, total_token_usage: { input_tokens: 120, output_tokens: 30, total_tokens: 150 } }, rate_limits: { primary: { used_percent: 25, window_minutes: 300, resets_at: 1784250000 }, secondary: { used_percent: 40, window_minutes: 10080, resets_at: 1784850000 } } } },
  ];
  await fs.writeFile(path.join(day, 'rollout.jsonl'), records.map(JSON.stringify).join('\n'));
  const data = await collectCodexData({ codexHome: home, now: new Date('2026-07-17T12:00:00Z') });
  assert.equal(data.today.total, 150);
  assert.equal(data.today.events, 2);
  assert.equal(data.today.available, true);
  assert.equal(data.cumulative.input, 120);
  assert.equal(data.weekly.windowMinutes, 10080);
  assert.equal(data.weekly.remainingPercent, 60);
});

test('collectCodexData uses cumulative deltas and ignores repeated snapshots', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-widget-last-usage-'));
  const day = path.join(home, 'sessions', '2026', '07', '18');
  await fs.mkdir(day, { recursive: true });
  const records = [
    { timestamp: '2026-07-18T02:00:00Z', type: 'event_msg', payload: { type: 'token_count', info: { last_token_usage: { input_tokens: 8, output_tokens: 2, total_tokens: 10 }, total_token_usage: { input_tokens: 800, output_tokens: 200, total_tokens: 1000 } } } },
    { timestamp: '2026-07-18T02:01:00Z', type: 'event_msg', payload: { type: 'token_count', info: { last_token_usage: { input_tokens: 16, output_tokens: 4, total_tokens: 20 }, total_token_usage: { input_tokens: 816, output_tokens: 204, total_tokens: 1020 } } } },
    { timestamp: '2026-07-18T02:02:00Z', type: 'event_msg', payload: { type: 'token_count', info: { last_token_usage: { input_tokens: 800, output_tokens: 199, total_tokens: 999 }, total_token_usage: { input_tokens: 816, output_tokens: 204, total_tokens: 1020 } } } },
  ];
  await fs.writeFile(path.join(day, 'rollout.jsonl'), records.map(JSON.stringify).join('\n'));
  const data = await collectCodexData({ codexHome: home, now: new Date(2026, 6, 18, 12) });
  assert.equal(data.today.total, 30);
  assert.equal(data.cumulative.total, 1020);
});

test('collectCodexData includes today events appended to a session created on an earlier day', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-widget-resumed-session-'));
  const originalDay = path.join(home, 'sessions', '2026', '07', '17');
  await fs.mkdir(originalDay, { recursive: true });
  const records = [
    { timestamp: '2026-07-18T04:00:00Z', type: 'event_msg', payload: { type: 'token_count', info: { last_token_usage: { input_tokens: 75, output_tokens: 25, total_tokens: 100 } } } },
    { timestamp: '2026-07-18T04:01:00Z', type: 'response_item', payload: { type: 'token_count', info: { last_token_usage: { total_tokens: 999 } } } },
  ];
  await fs.writeFile(path.join(originalDay, 'resumed-rollout.jsonl'), records.map(JSON.stringify).join('\n'));

  const data = await collectCodexData({ codexHome: home, now: new Date(2026, 6, 18, 12) });

  assert.equal(data.today.total, 100);
  assert.equal(data.today.events, 1);
});

test('normalizeWindows returns the longest rate window first', () => {
  const windows = normalizeWindows({
    primary: { used_percent: 20, window_minutes: 300, resets_at: 1 },
    secondary: { used_percent: 30, window_minutes: 10080, resets_at: 2 },
  });
  assert.equal(windows[0].windowMinutes, 10080);
});

test('normalizeOfficialData uses account usage and banked resets without duplicating the weekly limit', () => {
  const data = normalizeOfficialData({
    rateLimits: {
      primary: { usedPercent: 6, windowDurationMins: 10080, resetsAt: 1784908717 },
      secondary: null,
    },
    rateLimitResetCredits: {
      availableCount: 3,
      credits: [
        { id: 'reset-1', title: 'Full reset', status: 'available', expiresAt: 1785108949 },
        { id: 'reset-2', title: 'Full reset', status: 'available', expiresAt: 1786482506 },
        { id: 'reset-3', title: 'Full reset', status: 'available', expiresAt: 1786556074 },
      ],
    },
  }, {
    summary: { lifetimeTokens: 651705306, peakDailyTokens: 106045423 },
    dailyUsageBuckets: [{ startDate: '2026-07-17', tokens: 958077 }],
  }, { now: new Date(2026, 6, 17, 12, 0, 0) });

  assert.equal(data.weekly.remainingPercent, 94);
  assert.equal(data.today.total, 958077);
  assert.equal(data.cumulative.total, 651705306);
  assert.equal(data.resetCreditCount, 3);
  assert.equal(data.resetCredits[0].title, 'Full reset');
  assert.equal(data.limits.length, 1);
});

test('normalizeOfficialData labels a delayed official daily bucket as yesterday', () => {
  const data = normalizeOfficialData(null, {
    summary: { lifetimeTokens: 42 },
    dailyUsageBuckets: [{ startDate: '2026-07-17', tokens: 10 }],
  }, { now: new Date(2026, 6, 18, 1) });
  assert.equal(data.today.total, 10);
  assert.equal(data.todayPeriod, 'yesterday');
  assert.equal(data.todayDate, '2026-07-17');
  assert.equal(data.cumulative.total, 42);
});

test('collectOfficialCodexData prefers verified local today while retaining official cumulative usage', async () => {
  const client = {
    request(method) {
      if (method === 'account/rateLimits/read') {
        return Promise.resolve({ rateLimits: { primary: { usedPercent: 20, windowDurationMins: 10080 } } });
      }
      return Promise.resolve({
        summary: { lifetimeTokens: 42 },
        dailyUsageBuckets: [{ startDate: '2026-07-17', tokens: 10 }],
      });
    },
  };
  const data = await collectOfficialCodexData(client, {
    now: new Date(2026, 6, 18, 12),
    localFallback: async () => ({
      today: { total: 30, events: 2, available: true, date: '2026-07-18' },
      cumulative: { total: 30 },
      limits: [],
    }),
  });
  assert.equal(data.today.total, 30);
  assert.equal(data.todayPeriod, 'today');
  assert.equal(data.todaySource, 'local-session-logs');
  assert.equal(data.cumulative.total, 42);
});
