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

function formatReset(timestamp) {
  if (!timestamp) return '重置时间未提供';
  return `将于 ${new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp * 1000))} 重置`;
}

function limitTitle(limit) {
  if (!limit) return '暂无更多限额';
  if (limit.windowMinutes >= 10080) return '每周限额';
  if (limit.windowMinutes >= 1440) return `${Math.round(limit.windowMinutes / 1440)} 天限额`;
  if (limit.windowMinutes >= 60) return `${Math.round(limit.windowMinutes / 60)} 小时限额`;
  return limit.name || 'Codex 限额';
}

function renderLimitCards(limits) {
  const rows = [...limits];
  while (rows.length < 4) rows.push(null);
  elements.resetList.replaceChildren(...rows.slice(0, 4).map((limit) => {
    const card = document.createElement('article');
    card.className = 'card reset-card';
    const copy = document.createElement('div');
    copy.className = 'reset-copy';
    const title = document.createElement('span');
    title.textContent = limitTitle(limit);
    const date = document.createElement('span');
    date.textContent = limit ? formatReset(limit.resetsAt) : 'Codex 未提供该项数据';
    const badge = document.createElement('button');
    badge.className = 'reset-button no-drag';
    badge.type = 'button';
    badge.disabled = true;
    badge.textContent = limit ? `${Math.round(100 - limit.usedPercent)}%` : '—';
    copy.append(title, date);
    card.append(copy, badge);
    return card;
  }));
}

function render(data) {
  const weekly = data.weekly;
  const remaining = weekly?.remainingPercent ?? 0;
  elements.weeklyReset.textContent = weekly ? formatReset(weekly.resetsAt) : '等待 Codex 写入限额数据';
  elements.remaining.textContent = weekly ? `剩余 ${Math.round(remaining)}%` : '未同步';
  elements.progress.style.width = `${remaining}%`;
  elements.todayTokens.textContent = compact(data.today.total);
  elements.todayCost.textContent = `输入 ${compact(data.today.input)}`;
  elements.totalTokens.textContent = compact(data.cumulative.total);
  elements.totalCost.textContent = `输出 ${compact(data.cumulative.output)}`;
  renderLimitCards(data.limits ?? []);
  document.body.title = `只读本机 Codex 数据 · 扫描 ${data.scannedSessions} 个会话`;
}

function renderError() {
  elements.weeklyReset.textContent = '未找到本机 Codex 数据';
  elements.remaining.textContent = '未同步';
  elements.progress.style.width = '0%';
  elements.todayTokens.textContent = '—';
  elements.todayCost.textContent = '输入 —';
  elements.totalTokens.textContent = '—';
  elements.totalCost.textContent = '输出 —';
  renderLimitCards([]);
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
  elements.menu.style.left = `${Math.min(event.clientX, 214)}px`;
  elements.menu.style.top = `${Math.min(event.clientY, 244)}px`;
  elements.menu.hidden = false;
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
setInterval(refresh, 30_000);

