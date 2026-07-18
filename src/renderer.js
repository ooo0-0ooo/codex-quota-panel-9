const translations = {
  zh: {
    panelLabel: 'Codex 额度面板',
    closeLabel: '隐藏到系统托盘',
    minimizeLabel: '最小化到任务栏',
    weeklyLimit: '每周使用限额',
    resetCredits: '使用限额重置',
    tokenUsage: 'Token 用量',
    todayToken: '今日用量',
    yesterdayToken: '昨日用量',
    totalToken: '累计用量',
    useReset: '使用重置',
    useResetLabel: '可用的额度重置',
    confirmReset: '确定要使用这次重置吗？',
    cancel: '取消',
    resetting: '正在重置…',
    resetNothing: '当前没有可重置的限额。',
    resetNoCredit: '这次重置已不可用。',
    resetFailed: '重置失败，请稍后重试。',
    refresh: '刷新真实数据',
    pin: '始终置顶',
    unpin: '取消置顶',
    quit: '退出应用',
    resetPending: '重置日期暂未提供',
    expiryPending: '到期日期待官方返回',
    waiting: '等待 Codex 官方限额数据',
    unavailable: 'Codex 官方数据暂不可用',
    unsynced: '未同步',
    officialAndLocal: '官方累计 · 本机今日',
    officialOnly: '官方账户',
    localOnly: '本机日志',
    data: 'Codex 数据',
  },
  en: {
    panelLabel: 'Codex quota panel',
    closeLabel: 'Hide to system tray',
    minimizeLabel: 'Minimize to taskbar',
    weeklyLimit: 'Weekly usage limit',
    resetCredits: 'Usage limit resets',
    tokenUsage: 'Token activity',
    todayToken: 'Tokens used today',
    yesterdayToken: 'Tokens used yesterday',
    totalToken: 'Lifetime tokens',
    useReset: 'Use reset',
    useResetLabel: 'Available usage-limit reset',
    confirmReset: 'Are you sure you want to use a reset?',
    cancel: 'Cancel',
    resetting: 'Resetting…',
    resetNothing: 'There is no limit to reset right now.',
    resetNoCredit: 'This reset is no longer available.',
    resetFailed: 'Reset failed. Please try again.',
    refresh: 'Refresh data',
    pin: 'Keep on top',
    unpin: 'Unpin',
    quit: 'Quit',
    resetPending: 'Reset date unavailable',
    expiryPending: 'Expiry date unavailable',
    waiting: 'Waiting for Codex quota data',
    unavailable: 'Codex data is unavailable',
    unsynced: 'Not synced',
    officialAndLocal: 'Official total · Local today',
    officialOnly: 'Official account',
    localOnly: 'Local logs',
    data: 'Codex data',
  },
};

const elements = {
  panel: document.querySelector('.quota-panel'),
  language: document.querySelector('#language-button'),
  languageIcon: document.querySelector('#language-icon'),
  minimize: document.querySelector('#minimize-button'),
  close: document.querySelector('#close-button'),
  weeklyTitle: document.querySelector('#weekly-title'),
  weeklyReset: document.querySelector('#weekly-reset'),
  remaining: document.querySelector('#remaining'),
  progress: document.querySelector('#progress-value'),
  resetHeading: document.querySelector('#reset-heading'),
  tokenHeading: document.querySelector('#token-heading'),
  todayLabel: document.querySelector('#today-label'),
  todayTokens: document.querySelector('#today-tokens'),
  totalLabel: document.querySelector('#total-label'),
  totalTokens: document.querySelector('#total-tokens'),
  resetList: document.querySelector('#reset-list'),
  menu: document.querySelector('#context-menu'),
  refreshMenu: document.querySelector('#refresh-menu'),
  pinMenu: document.querySelector('#pin-menu'),
  quitMenu: document.querySelector('#quit-menu'),
  confirmOverlay: document.querySelector('#confirm-overlay'),
  confirmMessage: document.querySelector('#confirm-message'),
  confirmReset: document.querySelector('#confirm-reset-button'),
  cancelReset: document.querySelector('#cancel-reset-button'),
};

const savedLanguage = localStorage.getItem('codexQuotaLanguage');
const systemLanguage = (navigator.languages?.[0] ?? navigator.language ?? 'en')
  .toLowerCase()
  .startsWith('zh') ? 'zh' : 'en';
let language = savedLanguage === 'zh' || savedLanguage === 'en'
  ? savedLanguage
  : systemLanguage;
let currentData = null;
let pendingResetCreditId = null;

function copy() {
  return translations[language];
}

function compact(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(number);
}

function monthDay(timestamp) {
  const date = new Date(Number(timestamp) * 1000);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function monthDayTime(timestamp) {
  const date = new Date(Number(timestamp) * 1000);
  if (!Number.isFinite(date.getTime())) return null;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getMonth() + 1}/${date.getDate()} ${hours}:${minutes}`;
}

function formatReset(timestamp) {
  const text = copy();
  const value = monthDayTime(timestamp);
  if (!value) return text.resetPending;
  return language === 'zh' ? `将于 ${value} 重置` : `Resets ${value}`;
}

function formatExpiry(timestamp) {
  const text = copy();
  const value = monthDay(timestamp);
  if (!value) return text.expiryPending;
  return language === 'zh' ? `将于 ${value} 到期` : `Expires ${value}`;
}

function applyLanguage() {
  const text = copy();
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  elements.panel.setAttribute('aria-label', text.panelLabel);
  elements.languageIcon.src = language === 'zh' ? './assets/language-en.svg' : './assets/language-zh.svg';
  elements.language.setAttribute('aria-label', language === 'zh' ? 'Switch to English' : '切换到中文');
  elements.minimize.setAttribute('aria-label', text.minimizeLabel);
  elements.close.setAttribute('aria-label', text.closeLabel);
  elements.weeklyTitle.textContent = text.weeklyLimit;
  elements.tokenHeading.textContent = text.tokenUsage;
  elements.totalLabel.textContent = text.totalToken;
  elements.refreshMenu.textContent = text.refresh;
  elements.quitMenu.textContent = text.quit;
  elements.confirmMessage.textContent = text.confirmReset;
  elements.confirmReset.textContent = text.useReset;
  elements.cancelReset.textContent = text.cancel;
}

function syncWindowHeight() {
  requestAnimationFrame(() => {
    const panelHeight = Math.ceil(elements.panel.getBoundingClientRect().height);
    window.codexWidget.setContentHeight(panelHeight + 24);
  });
}

function renderResetCards(credits, availableCount) {
  const text = copy();
  const details = Array.isArray(credits) ? credits : [];
  const reportedCount = Number.isFinite(Number(availableCount))
    ? Math.max(0, Math.floor(Number(availableCount)))
    : details.length;
  const rows = details.slice(0, reportedCount);

  while (rows.length < reportedCount) {
    rows.push({ title: 'Full reset', expiresAt: 0, status: 'available' });
  }

  elements.resetHeading.textContent = `${text.resetCredits} (${reportedCount})`;
  elements.resetList.classList.toggle('is-scrollable', rows.length > 3);
  elements.resetList.scrollTop = 0;
  elements.resetList.replaceChildren(...rows.map((credit) => {
    const card = document.createElement('article');
    card.className = 'card reset-card';

    const content = document.createElement('div');
    content.className = 'reset-copy';
    const title = document.createElement('strong');
    title.textContent = credit.title || 'Full reset';
    const date = document.createElement('span');
    date.textContent = formatExpiry(credit.expiresAt);

    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'reset-button no-drag';
    badge.textContent = text.useReset;
    badge.setAttribute('aria-label', text.useResetLabel);
    badge.disabled = !credit.id || credit.status !== 'available';
    badge.addEventListener('click', (event) => {
      event.stopPropagation();
      openResetConfirmation(credit.id);
    });

    content.append(title, date);
    card.append(content, badge);
    return card;
  }));
}

function openResetConfirmation(creditId) {
  if (!creditId) return;
  const text = copy();
  pendingResetCreditId = creditId;
  elements.confirmMessage.textContent = text.confirmReset;
  elements.confirmReset.textContent = text.useReset;
  elements.confirmReset.disabled = false;
  elements.cancelReset.disabled = false;
  elements.confirmOverlay.hidden = false;
  elements.confirmReset.focus();
}

function closeResetConfirmation() {
  pendingResetCreditId = null;
  elements.confirmOverlay.hidden = true;
}

function resetOutcome(result) {
  const outcome = result?.outcome?.type ?? result?.outcome ?? result?.type ?? result?.status;
  return typeof outcome === 'string' ? outcome : null;
}

async function confirmResetCredit() {
  if (!pendingResetCreditId) return;
  const text = copy();
  const creditId = pendingResetCreditId;
  elements.confirmReset.disabled = true;
  elements.cancelReset.disabled = true;
  elements.confirmReset.textContent = text.resetting;
  try {
    const result = await window.codexWidget.consumeResetCredit(creditId);
    const outcome = resetOutcome(result);
    if (outcome === 'nothingToReset') {
      elements.confirmMessage.textContent = text.resetNothing;
    } else if (outcome === 'noCredit') {
      elements.confirmMessage.textContent = text.resetNoCredit;
    } else if (outcome === 'reset' || outcome === 'alreadyRedeemed') {
      closeResetConfirmation();
      await refresh();
      return;
    } else {
      throw new Error('Unknown reset-credit outcome');
    }
  } catch {
    elements.confirmMessage.textContent = text.resetFailed;
  }
  elements.confirmReset.textContent = text.useReset;
  elements.confirmReset.disabled = false;
  elements.cancelReset.disabled = false;
}

function render(data) {
  currentData = data;
  const text = copy();
  const weekly = data.weekly;
  const remaining = weekly?.remainingPercent ?? 0;
  const sourceLabel = data.tokenSource === 'official-with-local-today'
    ? text.officialAndLocal
    : (data.tokenSource === 'official' ? text.officialOnly : text.localOnly);

  elements.weeklyReset.textContent = weekly ? formatReset(weekly.resetsAt) : text.waiting;
  elements.remaining.textContent = weekly
    ? (language === 'zh' ? `剩余 ${Math.round(remaining)}%` : `${Math.round(remaining)}% left`)
    : text.unsynced;
  elements.progress.style.width = `${remaining}%`;
  elements.todayLabel.textContent = data.todayPeriod === 'yesterday'
    ? text.yesterdayToken
    : text.todayToken;
  elements.todayTokens.textContent = compact(data.today?.total);
  elements.totalTokens.textContent = compact(data.cumulative?.total);

  renderResetCards(data.resetCredits, data.resetCreditCount);
  document.body.title = `${data.sourceLabel ?? text.data} · ${sourceLabel}`;
  syncWindowHeight();
}

function renderError() {
  const text = copy();
  elements.weeklyReset.textContent = text.unavailable;
  elements.remaining.textContent = text.unsynced;
  elements.progress.style.width = '0%';
  elements.todayLabel.textContent = text.todayToken;
  elements.todayTokens.textContent = '—';
  elements.totalTokens.textContent = '—';
  renderResetCards([], 0);
  syncWindowHeight();
}

async function refresh() {
  try {
    render(await window.codexWidget.getCodexData());
  } catch {
    renderError();
  }
}

function hideMenu() {
  elements.menu.hidden = true;
}

elements.language.addEventListener('click', () => {
  language = language === 'zh' ? 'en' : 'zh';
  localStorage.setItem('codexQuotaLanguage', language);
  applyLanguage();
  if (currentData) render(currentData);
  else renderError();
});

elements.minimize.addEventListener('click', () => window.codexWidget.minimize());
elements.confirmReset.addEventListener('click', confirmResetCredit);
elements.cancelReset.addEventListener('click', closeResetConfirmation);
elements.confirmOverlay.addEventListener('click', (event) => {
  if (event.target === elements.confirmOverlay) closeResetConfirmation();
});

elements.panel.addEventListener('wheel', (event) => {
  if (!elements.resetList.classList.contains('is-scrollable')) return;
  const maximum = elements.resetList.scrollHeight - elements.resetList.clientHeight;
  if (maximum <= 0) return;
  const before = elements.resetList.scrollTop;
  elements.resetList.scrollTop = Math.max(0, Math.min(maximum, before + event.deltaY));
  if (elements.resetList.scrollTop !== before) event.preventDefault();
}, { passive: false });

elements.close.addEventListener('click', () => window.codexWidget.hide());
document.addEventListener('keydown', (event) => {
  if (event.key === 'F5' || (event.ctrlKey && event.key.toLowerCase() === 'r')) {
    event.preventDefault();
    refresh();
  }
  if (event.key === 'Escape') {
    hideMenu();
    closeResetConfirmation();
  }
});

document.addEventListener('contextmenu', async (event) => {
  event.preventDefault();
  elements.pinMenu.textContent = (await window.codexWidget.getAlwaysOnTop())
    ? copy().unpin
    : copy().pin;
  elements.menu.hidden = false;
  const bounds = elements.menu.getBoundingClientRect();
  elements.menu.style.left = `${Math.max(8, Math.min(event.clientX, innerWidth - bounds.width - 8))}px`;
  elements.menu.style.top = `${Math.max(8, Math.min(event.clientY, innerHeight - bounds.height - 8))}px`;
});

document.addEventListener('click', async (event) => {
  const action = event.target?.dataset?.action;
  if (!action) {
    if (!elements.menu.contains(event.target)) hideMenu();
    return;
  }
  if (action === 'refresh') await refresh();
  if (action === 'pin') {
    const current = await window.codexWidget.getAlwaysOnTop();
    await window.codexWidget.setAlwaysOnTop(!current);
  }
  if (action === 'quit') await window.codexWidget.quit();
  hideMenu();
});

applyLanguage();
refresh();
setInterval(refresh, 60_000);
