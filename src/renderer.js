const elements = {
  panel: document.querySelector('.quota-panel'),
  weeklyReset: document.querySelector('#weekly-reset'),
  remaining: document.querySelector('#remaining'),
  progress: document.querySelector('#progress-value'),
  todayTokens: document.querySelector('#today-tokens'),
  totalTokens: document.querySelector('#total-tokens'),
  resetList: document.querySelector('#reset-list'),
  close: document.querySelector('#close-button'),
  menu: document.querySelector('#context-menu'),
};

function compact(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(number);
}

function formatReset(timestamp) {
  if (!timestamp) return '重置时间暂未提供';
  return `将于 ${new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp * 1000))} 重置`;
}

function formatExpiry(timestamp) {
  if (!timestamp) return '到期时间待官方返回';
  return `将于 ${new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(timestamp * 1000))} 到期`;
}

function syncWindowHeight() {
  requestAnimationFrame(() => {
    const panelHeight = Math.ceil(elements.panel.getBoundingClientRect().height);
    window.codexWidget.setContentHeight(panelHeight + 24);
  });
}

function renderResetCards(credits, availableCount) {
  const details = Array.isArray(credits) ? credits : [];
  const reportedCount = Number.isFinite(Number(availableCount))
    ? Math.max(0, Math.floor(Number(availableCount)))
    : details.length;
  const rows = details.slice(0, reportedCount);

  while (rows.length < reportedCount) {
    rows.push({
      title: 'Full reset',
      expiresAt: 0,
      status: 'available',
      detailPending: true,
    });
  }

  elements.resetList.replaceChildren(...rows.map((credit) => {
    const card = document.createElement('article');
    card.className = 'card reset-card';

    const copy = document.createElement('div');
    copy.className = 'reset-copy';
    const title = document.createElement('strong');
    title.textContent = credit.title || 'Full reset';
    const date = document.createElement('span');
    date.textContent = formatExpiry(credit.expiresAt);

    const badge = document.createElement('span');
    badge.className = 'reset-button';
    badge.textContent = '可用';
    badge.setAttribute('aria-label', '此额度重置可用');

    copy.append(title, date);
    card.append(copy, badge);
    return card;
  }));
}

function render(data) {
  const weekly = data.weekly;
  const remaining = weekly?.remainingPercent ?? 0;
  const officialTokens = data.tokenSource === 'official'
    || data.source === 'official-codex-app-server';
  const tokenSource = officialTokens ? '官方同步' : '本机降级';

  elements.weeklyReset.textContent = weekly
    ? formatReset(weekly.resetsAt)
    : '等待 Codex 官方限额数据';
  elements.remaining.textContent = weekly ? `剩余 ${Math.round(remaining)}%` : '未同步';
  elements.progress.style.width = `${remaining}%`;

  elements.todayTokens.textContent = compact(data.today?.total);
  elements.totalTokens.textContent = compact(data.cumulative?.total);

  renderResetCards(data.resetCredits, data.resetCreditCount);
  document.body.title = `${data.sourceLabel ?? 'Codex 数据'} · ${tokenSource}`;
  syncWindowHeight();
}

function renderError() {
  elements.weeklyReset.textContent = 'Codex 官方数据暂不可用';
  elements.remaining.textContent = '未同步';
  elements.progress.style.width = '0%';
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

elements.close.addEventListener('click', () => window.codexWidget.hide());
document.addEventListener('keydown', (event) => {
  if (event.key === 'F5' || (event.ctrlKey && event.key.toLowerCase() === 'r')) {
    event.preventDefault();
    refresh();
  }
  if (event.key === 'Escape') hideMenu();
});

document.addEventListener('contextmenu', async (event) => {
  event.preventDefault();
  const pin = elements.menu.querySelector('[data-action="pin"]');
  pin.textContent = (await window.codexWidget.getAlwaysOnTop()) ? '取消置顶' : '始终置顶';
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

refresh();
setInterval(refresh, 60_000);
