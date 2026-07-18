const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

function numberFrom(object, ...keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (Number.isFinite(Number(value))) return Number(value);
  }
  return 0;
}

function usageFrom(info) {
  const usage = info?.total_token_usage ?? info?.totalTokenUsage;
  return normalizeUsage(usage);
}

function lastUsageFrom(info) {
  const usage = info?.last_token_usage ?? info?.lastTokenUsage;
  return normalizeUsage(usage);
}

function normalizeUsage(usage) {
  if (!usage) return null;
  const input = numberFrom(usage, 'input_tokens', 'inputTokens');
  const cachedInput = numberFrom(usage, 'cached_input_tokens', 'cachedInputTokens');
  const output = numberFrom(usage, 'output_tokens', 'outputTokens');
  const reasoning = numberFrom(usage, 'reasoning_output_tokens', 'reasoningOutputTokens');
  const total = numberFrom(usage, 'total_tokens', 'totalTokens') || input + output;
  return { input, cachedInput, output, reasoning, total };
}

function usageDelta(current, previous) {
  const delta = {};
  for (const key of ['input', 'cachedInput', 'output', 'reasoning', 'total']) {
    delta[key] = Math.max(0, current[key] - (previous?.[key] ?? 0));
  }
  return delta;
}

function addUsage(target, delta) {
  for (const key of ['input', 'cachedInput', 'output', 'reasoning', 'total']) {
    target[key] += delta[key];
  }
}

function isSameLocalDay(timestamp, now) {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime())
    && date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

async function listJsonlFiles(directory) {
  const output = [];
  async function walk(current) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) output.push(fullPath);
    }));
  }
  await walk(directory);
  return output;
}

function collectLimitWindows(value, trail = [], output = []) {
  if (!value || typeof value !== 'object') return output;
  const usedPercent = numberFrom(value, 'used_percent', 'usedPercent');
  const resetsAt = numberFrom(value, 'resets_at', 'resetsAt');
  const windowMinutes = numberFrom(value, 'window_minutes', 'windowMinutes');
  if (resetsAt || windowMinutes || Object.hasOwn(value, 'used_percent') || Object.hasOwn(value, 'usedPercent')) {
    output.push({
      key: trail.join('.') || 'limit',
      name: String(value.limit_name ?? value.limitName ?? trail.at(-1) ?? 'Codex limit'),
      usedPercent: Math.min(100, Math.max(0, usedPercent)),
      resetsAt,
      windowMinutes,
    });
  }
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === 'object') collectLimitWindows(child, [...trail, key], output);
  }
  return output;
}

function normalizeWindows(rateLimits) {
  const unique = new Map();
  for (const window of collectLimitWindows(rateLimits)) {
    const key = `${window.windowMinutes}:${window.resetsAt}:${window.name}`;
    if (!unique.has(key)) unique.set(key, window);
  }
  return [...unique.values()].sort((a, b) => {
    if (a.windowMinutes !== b.windowMinutes) return b.windowMinutes - a.windowMinutes;
    return a.resetsAt - b.resetsAt;
  });
}

async function collectCodexData(options = {}) {
  const now = options.now ?? new Date();
  const codexHome = options.codexHome
    ?? process.env.CODEX_HOME
    ?? path.join(os.homedir(), '.codex');
  const sessionsPath = path.join(codexHome, 'sessions');
  const files = await listJsonlFiles(sessionsPath);
  const today = {
    input: 0,
    cachedInput: 0,
    output: 0,
    reasoning: 0,
    total: 0,
    events: 0,
    countedEvents: 0,
    duplicateSnapshots: 0,
    sessionFiles: 0,
    resumedSessionFiles: 0,
    sameDayTokens: 0,
    resumedSessionTokens: 0,
    sessionDateBreakdown: {},
    available: false,
    date: localDateKey(now),
  };
  const cumulative = { input: 0, cachedInput: 0, output: 0, reasoning: 0, total: 0 };
  let latestRateLimits = null;
  let latestRateTimestamp = 0;

  await Promise.all(files.map(async (file) => {
    let content;
    try {
      content = await fs.readFile(file, 'utf8');
    } catch {
      return;
    }
    let previous = null;
    let fileTodayEvents = 0;
    let fileTodayTokens = 0;
    for (const line of content.split(/\r?\n/)) {
      if (!line.includes('token_count')) continue;
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      const payload = record?.payload;
      if (record?.type !== 'event_msg' || payload?.type !== 'token_count') continue;
      const timestamp = Date.parse(record.timestamp ?? record.created_at ?? 0);
      const current = usageFrom(payload.info);
      const last = lastUsageFrom(payload.info);
      if (current) {
        const delta = usageDelta(current, previous);
        addUsage(cumulative, delta);
        if (isSameLocalDay(timestamp, now)) {
          const counterReset = previous && current.total < previous.total;
          const contribution = !previous || counterReset ? (last ?? delta) : delta;
          addUsage(today, contribution);
          today.events += 1;
          fileTodayEvents += 1;
          fileTodayTokens += contribution.total;
          if (contribution.total > 0) today.countedEvents += 1;
          else today.duplicateSnapshots += 1;
        }
        previous = current;
      } else if (last && isSameLocalDay(timestamp, now)) {
        addUsage(today, last);
        today.events += 1;
        today.countedEvents += 1;
        fileTodayEvents += 1;
        fileTodayTokens += last.total;
      }
      if (payload.rate_limits && timestamp >= latestRateTimestamp) {
        latestRateLimits = payload.rate_limits;
        latestRateTimestamp = timestamp;
      }
    }
    if (fileTodayEvents > 0) {
      today.sessionFiles += 1;
      const relative = path.relative(sessionsPath, file).split(path.sep);
      const fileDate = relative.length >= 3 ? relative.slice(0, 3).join('-') : '';
      const bucket = today.sessionDateBreakdown[fileDate] ?? { files: 0, events: 0, tokens: 0 };
      bucket.files += 1;
      bucket.events += fileTodayEvents;
      bucket.tokens += fileTodayTokens;
      today.sessionDateBreakdown[fileDate] = bucket;
      if (fileDate === today.date) {
        today.sameDayTokens += fileTodayTokens;
      } else {
        today.resumedSessionFiles += 1;
        today.resumedSessionTokens += fileTodayTokens;
      }
    }
  }));

  const windows = normalizeWindows(latestRateLimits);
  const weekly = windows[0] ?? null;
  today.available = today.events > 0;
  return {
    source: 'local-codex-sessions',
    codexHome,
    scannedSessions: files.length,
    updatedAt: latestRateTimestamp ? new Date(latestRateTimestamp).toISOString() : null,
    today,
    cumulative,
    weekly: weekly ? { ...weekly, remainingPercent: Math.max(0, 100 - weekly.usedPercent) } : null,
    limits: windows.slice(0, 4),
  };
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = { collectCodexData, lastUsageFrom, normalizeWindows, usageFrom };
