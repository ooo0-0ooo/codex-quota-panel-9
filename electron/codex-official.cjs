const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');

async function fileExists(file) {
  try {
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
}

async function findCodexBinary(explicitBinary) {
  const directCandidates = [explicitBinary, process.env.CODEX_BINARY].filter(Boolean);
  for (const candidate of directCandidates) {
    if (await fileExists(candidate)) return candidate;
  }

  const localAppData = process.env.LOCALAPPDATA
    ?? path.join(os.homedir(), 'AppData', 'Local');
  const binRoot = path.join(localAppData, 'OpenAI', 'Codex', 'bin');
  try {
    const folders = await fs.readdir(binRoot, { withFileTypes: true });
    const binaries = [];
    for (const folder of folders) {
      if (!folder.isDirectory()) continue;
      const binary = path.join(binRoot, folder.name, 'codex.exe');
      try {
        const stat = await fs.stat(binary);
        if (stat.isFile()) binaries.push({ binary, modified: stat.mtimeMs });
      } catch {
        // Ignore partially installed Codex versions.
      }
    }
    binaries.sort((a, b) => b.modified - a.modified);
    if (binaries[0]) return binaries[0].binary;
  } catch {
    // Fall back to the Windows app execution alias below.
  }

  return process.platform === 'win32' ? 'codex.exe' : 'codex';
}

class CodexAppServerClient {
  constructor(options = {}) {
    this.binary = options.binary;
    this.timeoutMs = options.timeoutMs ?? 25_000;
    this.child = null;
    this.lines = null;
    this.pending = new Map();
    this.nextId = 1;
    this.readyPromise = null;
    this.lastStderr = '';
  }

  async start() {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this.#spawnAndInitialize().catch((error) => {
      this.stop(error);
      throw error;
    });
    return this.readyPromise;
  }

  async #spawnAndInitialize() {
    const binary = await findCodexBinary(this.binary);
    this.child = spawn(binary, ['app-server', '--stdio'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    await new Promise((resolve, reject) => {
      const onError = (error) => reject(error);
      this.child.once('error', onError);
      this.child.once('spawn', () => {
        this.child.off('error', onError);
        resolve();
      });
    });

    this.lines = readline.createInterface({ input: this.child.stdout });
    this.lines.on('line', (line) => this.#handleLine(line));
    this.child.stderr.on('data', (chunk) => {
      this.lastStderr = `${this.lastStderr}${chunk}`.slice(-2_000);
    });
    this.child.once('exit', (code) => {
      const suffix = this.lastStderr.trim() ? `: ${this.lastStderr.trim()}` : '';
      this.#rejectPending(new Error(`Codex app-server exited (${code ?? 'unknown'})${suffix}`));
      this.child = null;
      this.readyPromise = null;
    });

    await this.#sendRequest('initialize', {
      clientInfo: {
        name: 'codex-quota-panel-9',
        title: 'Codex Quota Panel 9',
        version: '1.1.0',
      },
      capabilities: {},
    });
    this.#write({ method: 'initialized' });
  }

  #write(message) {
    if (!this.child?.stdin?.writable) throw new Error('Codex app-server is not writable');
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  #sendRequest(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      try {
        this.#write({ method, id, ...(params === undefined ? {} : { params }) });
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  #handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    const request = this.pending.get(message.id);
    if (!request) return;
    this.pending.delete(message.id);
    clearTimeout(request.timeout);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  }

  #rejectPending(error) {
    for (const request of this.pending.values()) {
      clearTimeout(request.timeout);
      request.reject(error);
    }
    this.pending.clear();
  }

  async request(method, params) {
    await this.start();
    return this.#sendRequest(method, params);
  }

  stop(reason = new Error('Codex app-server stopped')) {
    this.#rejectPending(reason);
    this.lines?.close();
    this.lines = null;
    if (this.child) {
      this.child.removeAllListeners('exit');
      this.child.kill();
      this.child = null;
    }
    this.readyPromise = null;
  }
}

function numberFrom(object, ...keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function normalizeWindow(value, key) {
  if (!value || typeof value !== 'object') return null;
  const usedPercent = numberFrom(value, 'usedPercent', 'used_percent');
  const resetsAt = numberFrom(value, 'resetsAt', 'resets_at');
  const windowMinutes = numberFrom(value, 'windowDurationMins', 'window_minutes', 'windowMinutes');
  if (usedPercent === null && resetsAt === null && windowMinutes === null) return null;
  const boundedUsed = Math.min(100, Math.max(0, usedPercent ?? 0));
  return {
    key,
    name: key,
    usedPercent: boundedUsed,
    remainingPercent: 100 - boundedUsed,
    resetsAt: resetsAt ?? 0,
    windowMinutes: windowMinutes ?? 0,
  };
}

function collectOfficialWindows(rateResult) {
  const rateLimits = rateResult?.rateLimits ?? rateResult?.rate_limits ?? null;
  const values = [];
  for (const key of ['primary', 'secondary']) {
    const window = normalizeWindow(rateLimits?.[key], key);
    if (window) values.push(window);
  }

  const byLimitId = rateResult?.rateLimitsByLimitId ?? rateResult?.rate_limits_by_limit_id;
  for (const [limitId, limit] of Object.entries(byLimitId ?? {})) {
    for (const key of ['primary', 'secondary']) {
      const window = normalizeWindow(limit?.[key], `${limitId}.${key}`);
      if (window) values.push(window);
    }
  }

  const unique = new Map();
  for (const window of values) {
    const fingerprint = `${window.windowMinutes}:${window.resetsAt}:${window.usedPercent}`;
    if (!unique.has(fingerprint)) unique.set(fingerprint, window);
  }
  return [...unique.values()].sort((a, b) => b.windowMinutes - a.windowMinutes);
}

function normalizeResetCredits(rateResult) {
  const source = rateResult?.rateLimitResetCredits
    ?? rateResult?.rate_limit_reset_credits
    ?? null;
  const availableCount = numberFrom(source, 'availableCount', 'available_count') ?? 0;
  const credits = Array.isArray(source?.credits) ? source.credits : [];
  return {
    availableCount,
    credits: credits.map((credit) => ({
      id: credit.id ?? null,
      title: credit.title || 'Full reset',
      description: credit.description ?? '',
      status: credit.status ?? 'available',
      grantedAt: numberFrom(credit, 'grantedAt', 'granted_at') ?? 0,
      expiresAt: numberFrom(credit, 'expiresAt', 'expires_at') ?? 0,
    })),
  };
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function emptyTokenUsage(total = 0) {
  return { input: null, cachedInput: null, output: null, reasoning: null, total };
}

function normalizeOfficialData(rateResult, usageResult, options = {}) {
  const now = options.now ?? new Date();
  const windows = collectOfficialWindows(rateResult);
  const weekly = windows[0] ?? null;
  const resetCredits = normalizeResetCredits(rateResult);
  const summary = usageResult?.summary ?? null;
  const dailyBuckets = usageResult?.dailyUsageBuckets ?? usageResult?.daily_usage_buckets ?? [];
  const todayBucket = Array.isArray(dailyBuckets)
    ? dailyBuckets.find((bucket) => (bucket.startDate ?? bucket.start_date) === localDateKey(now))
    : null;
  const todayTokens = numberFrom(todayBucket, 'tokens');
  const lifetimeTokens = numberFrom(summary, 'lifetimeTokens', 'lifetime_tokens');
  const usageAvailable = Boolean(usageResult && typeof usageResult === 'object');

  return {
    source: 'official-codex-app-server',
    sourceLabel: 'OpenAI 官方账户',
    tokenSource: usageAvailable ? 'official' : 'unavailable',
    updatedAt: new Date().toISOString(),
    weekly,
    limits: windows,
    resetCredits: resetCredits.credits,
    resetCreditCount: resetCredits.availableCount,
    today: usageAvailable ? emptyTokenUsage(todayTokens ?? 0) : null,
    cumulative: lifetimeTokens === null ? null : emptyTokenUsage(lifetimeTokens),
    usageSummary: summary,
    dailyUsageBuckets: Array.isArray(dailyBuckets) ? dailyBuckets : [],
  };
}

function mergeWithLocalFallback(official, local) {
  const merged = {
    ...local,
    ...official,
    weekly: official.weekly ?? local?.weekly ?? null,
    limits: official.limits?.length ? official.limits : (local?.limits ?? []),
    today: official.today ?? local?.today ?? emptyTokenUsage(0),
    cumulative: official.cumulative ?? local?.cumulative ?? emptyTokenUsage(0),
    resetCredits: official.resetCredits ?? [],
    resetCreditCount: official.resetCreditCount ?? 0,
  };
  const officialComplete = Boolean(official.weekly && official.today && official.cumulative);
  merged.source = officialComplete
    ? 'official-codex-app-server'
    : 'official-with-local-fallback';
  merged.sourceLabel = officialComplete
    ? 'OpenAI 官方账户'
    : '官方数据 + 本机降级';
  merged.tokenSource = official.today && official.cumulative ? 'official' : 'local';
  return merged;
}

async function collectOfficialCodexData(client, options = {}) {
  const [rate, usage] = await Promise.allSettled([
    client.request('account/rateLimits/read'),
    client.request('account/usage/read'),
  ]);
  if (rate.status === 'rejected' && usage.status === 'rejected') {
    throw new AggregateError([rate.reason, usage.reason], 'Official Codex usage requests failed');
  }
  const official = normalizeOfficialData(
    rate.status === 'fulfilled' ? rate.value : null,
    usage.status === 'fulfilled' ? usage.value : null,
    options,
  );
  if (official.weekly && official.today && official.cumulative) return official;
  const local = options.localFallback ? await options.localFallback() : null;
  return mergeWithLocalFallback(official, local);
}

module.exports = {
  CodexAppServerClient,
  collectOfficialCodexData,
  findCodexBinary,
  normalizeOfficialData,
  normalizeResetCredits,
};
