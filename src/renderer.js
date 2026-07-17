const elements = {
  weeklyReset: document.querySelector('#weekly-reset'),
  remaining: document.querySelector('#remaining'),
  progress: document.querySelector('#progress-value'),
  todayTokens: document.querySelector('#today-tokens'),
  todayCost: document.querySelector('#today-cost'),
  totalTokens: document.querySelector('#total-tokens'),
  totalCost: document.querySelector('#total-cost'),
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

function exact(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value) || 0);
}

function compactChinese(value) {
  return new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
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

function renderResetCards(credits, availableCount) {
  const rows = [...(credits ?? [])];
  while (rows.length < Math.min(availableCount ?? 0, 4)) {
    rows.push({ title: 'Full reset', expiresAt: 0, status: 'available', detailPending: true });
  }
  while (rows.length < 4) rows.push(null);

  elements.resetList.replaceChildren(...rows.slice(0, 4).map((credit) => {
    const card = document.createElement('article');
    card.className = 'card reset-card';

    const copy = document.createElement('div');
    copy.className = 'reset-copy';
    const title = document.createElement('strong');
    title.textContent = credit?.title || '暂无更多重置';
    const date = document.createElement('span');
    date.textContent = credit
      ? formatExpiry(credit.expiresAt)
      : '以 Codex 官方账户为准';

    const badge = document.createElement('span');
    badge.className = 'reset-button';
    badge.textContent = credit ? '可用' : '—';
    badge.setAttribute('aria-label', credit ? '此额度重置可用' : '暂无可用额度重置');

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
  const tokenSourceShort = officialTokens ? '官方' : '本机';

  elements.weeklyReset.textContent = weekly
    ? formatReset(weekly.resetsAt)
    : '等待 Codex 官方限额数据';
  elements.remaining.textContent = weekly ? `剩余 ${Math.round(remaining)}%` : '未同步';
  elements.progress.style.width = `${remaining}%`;

  elements.todayTokens.textContent = compact(data.today?.total);
  elements.todayCost.textContent = `${tokenSourceShort} ${compactChinese(data.today?.total)}`;
  elements.todayCost.title = `精确值 ${exact(data.today?.total)}`;
  elements.totalTokens.textContent = compact(data.cumulative?.total);
  elements.totalCost.textContent = `${tokenSourceShort} ${compactChinese(data.cumulative?.total)}`;
  elements.totalCost.title = `精确值 ${exact(data.cumulative?.total)}`;

  renderResetCards(data.resetCredits, data.resetCreditCount);
  document.body.title = `${data.sourceLabel ?? 'Codex 数据'} · ${tokenSource}`;
}

function renderError() {
  elements.weeklyReset.textContent = 'Codex 官方数据暂不可用';
  elements.remaining.textContent = '未同步';
  elements.progress.style.width = '0%';
  elements.todayTokens.textContent = '—';
  elements.todayCost.textContent = '等待同步';
  elements.totalTokens.textContent = '—';
  elements.totalCost.textContent = '等待同步';
  renderResetCards([], 0);
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
