const { app, BrowserWindow, ipcMain } = require('electron');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');

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
    { title: 'Full reset', status: 'available', expiresAt: 1785108949 },
    { title: 'Full reset', status: 'available', expiresAt: 1786482506 },
    { title: 'Full reset', status: 'available', expiresAt: 1786556074 },
  ],
  today: { total: 7135439 },
  cumulative: { total: 651705306 },
};

let captureWindow;

ipcMain.handle('codex:get-data', () => mockData);
ipcMain.handle('window:get-always-on-top', () => true);
ipcMain.handle('window:hide', () => undefined);
ipcMain.handle('window:quit', () => app.quit());
ipcMain.handle('window:set-always-on-top', (_event, value) => Boolean(value));
ipcMain.handle('window:set-content-height', (_event, height) => {
  captureWindow.setContentSize(584, Math.ceil(Number(height)));
  return captureWindow.getContentSize()[1];
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
      partition: 'codex-capture-1.3.0',
    },
  });
  await captureWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  captureWindow.showInactive();
  await new Promise((resolve) => setTimeout(resolve, 600));
  const title = await captureWindow.webContents.executeJavaScript(
    "document.querySelector('h1')?.textContent",
  );
  if (title !== 'Codex Quota') throw new Error('Renderer did not load');
  const image = await captureWindow.webContents.capturePage();
  const output = path.join(__dirname, '..', 'outputs', 'ui-1.3.0-zh.png');
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, image.toPNG());
  console.log(output);

  await captureWindow.webContents.executeJavaScript(
    "document.querySelector('#language-button')?.click()",
  );
  captureWindow.hide();
  captureWindow.showInactive();
  captureWindow.webContents.invalidate();
  await new Promise((resolve) => setTimeout(resolve, 600));
  const englishImage = await captureWindow.webContents.capturePage();
  const englishOutput = path.join(__dirname, '..', 'outputs', 'ui-1.3.0-en.png');
  await writeFile(englishOutput, englishImage.toPNG());
  console.log(englishOutput);
  app.quit();
});
