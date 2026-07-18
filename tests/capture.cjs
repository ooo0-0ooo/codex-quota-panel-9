const { app, BrowserWindow, ipcMain } = require('electron');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');

app.commandLine.appendSwitch('lang', 'zh-CN');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.disableHardwareAcceleration();

const mockData = {
  source: 'official-codex-app-server',
  sourceLabel: 'OpenAI 官方账户',
  tokenSource: 'official-with-local-today',
  todayPeriod: 'today',
  todaySource: 'local-session-logs',
  weekly: {
    usedPercent: 13,
    remainingPercent: 87,
    resetsAt: 1784908717,
    windowMinutes: 10080,
  },
  resetCreditCount: 3,
  resetCredits: [
    { id: 'reset-1', title: 'Full reset', status: 'available', expiresAt: 1785108949 },
    { id: 'reset-2', title: 'Full reset', status: 'available', expiresAt: 1786482506 },
    { id: 'reset-3', title: 'Full reset', status: 'available', expiresAt: 1786556074 },
  ],
  today: { total: 7135439 },
  cumulative: { total: 651705306 },
};

let captureWindow;
let resetConsumeCalls = 0;

ipcMain.handle('codex:get-data', () => mockData);
ipcMain.handle('window:get-always-on-top', () => true);
ipcMain.handle('window:hide', () => undefined);
ipcMain.handle('window:minimize', () => undefined);
ipcMain.handle('window:quit', () => app.quit());
ipcMain.handle('window:set-always-on-top', (_event, value) => Boolean(value));
ipcMain.handle('window:set-content-height', (_event, height) => {
  captureWindow.setContentSize(584, Math.ceil(Number(height)));
  return captureWindow.getContentSize()[1];
});
ipcMain.handle('codex:consume-reset-credit', (_event, creditId) => {
  if (creditId !== 'reset-1') throw new Error('Unexpected reset credit');
  resetConsumeCalls += 1;
  return { outcome: { type: 'reset' } };
});

app.whenReady().then(async () => {
  captureWindow = new BrowserWindow({
    width: 584,
    height: 540,
    useContentSize: true,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: 'codex-capture-1.5.2',
    },
  });
  await captureWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  captureWindow.showInactive();
  await new Promise((resolve) => setTimeout(resolve, 600));
  const title = await captureWindow.webContents.executeJavaScript(
    "document.querySelector('h1')?.textContent",
  );
  if (title !== 'Codex Quota') throw new Error('Renderer did not load');
  const controlsMatch = await captureWindow.webContents.executeJavaScript(`
    (() => {
      const language = document.querySelector('#language-button').getBoundingClientRect();
      const minimize = document.querySelector('#minimize-button').getBoundingClientRect();
      const close = document.querySelector('#close-button').getBoundingClientRect();
      const centerY = (rect) => rect.top + rect.height / 2;
      return Math.abs(language.width - 22) < 0.01
        && language.width === minimize.width
        && language.width === close.width
        && language.height === minimize.height
        && language.height === close.height
        && Math.abs(centerY(language) - centerY(minimize)) < 0.01
        && Math.abs(centerY(language) - centerY(close)) < 0.01;
    })()
  `);
  if (!controlsMatch) throw new Error('All three window controls must have matching dimensions');
  const resetInteraction = await captureWindow.webContents.executeJavaScript(`
    (async () => {
      const card = document.querySelector('.reset-card');
      const button = document.querySelector('.reset-button');
      const overlay = document.querySelector('#confirm-overlay');
      card.click();
      const openedByCard = !overlay.hidden;
      button.click();
      const openedByButton = !overlay.hidden;
      document.querySelector('#confirm-reset-button').click();
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { openedByCard, openedByButton, closedAfterConfirm: overlay.hidden };
    })()
  `);
  if (resetInteraction.openedByCard || !resetInteraction.openedByButton
      || !resetInteraction.closedAfterConfirm || resetConsumeCalls !== 1) {
    throw new Error('Reset confirmation must open only from the reset button and consume once');
  }
  const image = await captureWindow.webContents.capturePage();
  const output = path.join(__dirname, '..', 'outputs', 'ui-1.5.2-zh.png');
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, image.toPNG());
  console.log(output);

  mockData.resetCreditCount = 4;
  mockData.resetCredits.push({
    id: 'reset-4',
    title: 'Full reset',
    status: 'available',
    expiresAt: 1787173200,
  });
  await captureWindow.webContents.executeJavaScript(`
    document.querySelector('#language-button')?.click();
    document.querySelector('[data-action="refresh"]')?.click();
  `);
  await new Promise((resolve) => setTimeout(resolve, 300));
  captureWindow.hide();
  captureWindow.showInactive();
  captureWindow.webContents.invalidate();
  await new Promise((resolve) => setTimeout(resolve, 600));
  const englishImage = await captureWindow.webContents.capturePage();
  const englishOutput = path.join(__dirname, '..', 'outputs', 'ui-1.5.2-en.png');
  await writeFile(englishOutput, englishImage.toPNG());
  console.log(englishOutput);
  const wheelResult = await captureWindow.webContents.executeJavaScript(`
    (() => {
      const panel = document.querySelector('.quota-panel');
      const list = document.querySelector('#reset-list');
      const before = list.scrollTop;
      panel.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: 80,
      }));
      return { before, after: list.scrollTop };
    })()
  `);
  if (wheelResult.after <= wheelResult.before) {
    throw new Error('Panel wheel did not scroll the reset-credit list');
  }
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
