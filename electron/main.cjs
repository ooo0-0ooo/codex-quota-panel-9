const { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } = require('electron');
const path = require('node:path');
const { collectCodexData: collectLocalCodexData } = require('./codex-data.cjs');
const {
  CodexAppServerClient,
  collectOfficialCodexData,
  consumeResetCredit,
} = require('./codex-official.cjs');

let mainWindow;
let tray;
let isQuitting = false;

const APP_ID = 'com.ooo0-0ooo.codex-quota-panel-9';
const WINDOW_WIDTH = 584;
const INITIAL_WINDOW_HEIGHT = 540;
const APP_ICON = path.join(__dirname, '..', 'src', 'assets', 'logo.png');
const officialClient = new CodexAppServerClient();
const launchHidden = process.argv.includes('--hidden');

function isAutoStartEnabled() {
  if (!app.isPackaged) return false;
  return app.getLoginItemSettings({
    path: process.execPath,
    args: ['--hidden'],
  }).openAtLogin;
}

function setAutoStartEnabled(enabled) {
  if (!app.isPackaged) return false;
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    path: process.execPath,
    args: ['--hidden'],
  });
  return isAutoStartEnabled();
}

async function getCodexData() {
  try {
    return await collectOfficialCodexData(officialClient, {
      localFallback: () => collectLocalCodexData(),
    });
  } catch (error) {
    const local = await collectLocalCodexData();
    return {
      ...local,
      source: 'local-codex-sessions-fallback',
      sourceLabel: '本机日志降级',
      tokenSource: 'local',
      todayPeriod: 'today',
      todaySource: 'local-session-logs',
      resetCredits: [],
      resetCreditCount: 0,
      syncError: error.message,
    };
  }
}

function applicationIcon(size) {
  const icon = nativeImage.createFromPath(APP_ICON);
  return size && !icon.isEmpty() ? icon.resize({ width: size, height: size }) : icon;
}

function resizeWindowToContent(requestedHeight) {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const height = Number(requestedHeight);
  if (!Number.isFinite(height)) return mainWindow.getContentSize()[1];
  const display = screen.getDisplayMatching(mainWindow.getBounds());
  const maxHeight = Math.max(420, display.workAreaSize.height - 24);
  const nextHeight = Math.max(420, Math.min(Math.ceil(height), maxHeight));
  mainWindow.setContentSize(WINDOW_WIDTH, nextHeight);
  return nextHeight;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: INITIAL_WINDOW_HEIGHT,
    minWidth: WINDOW_WIDTH,
    maxWidth: WINDOW_WIDTH,
    useContentSize: true,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Codex Quota Panel',
    icon: applicationIcon(),
    show: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    if (!launchHidden) mainWindow.show();
  });
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  tray = new Tray(applicationIcon(32));
  tray.setToolTip('Codex Quota Panel');
  const rebuildMenu = () => {
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: '显示面板',
          click: () => {
            mainWindow.show();
            mainWindow.focus();
          },
        },
        {
          label: '始终置顶',
          type: 'checkbox',
          checked: mainWindow.isAlwaysOnTop(),
          click: (item) => mainWindow.setAlwaysOnTop(item.checked),
        },
        {
          label: '开机自启动',
          type: 'checkbox',
          enabled: app.isPackaged,
          checked: isAutoStartEnabled(),
          click: (item) => {
            setAutoStartEnabled(item.checked);
            rebuildMenu();
          },
        },
        { type: 'separator' },
        {
          label: '退出',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ]),
    );
  };
  rebuildMenu();
  tray.on('click', () => {
    if (mainWindow.isVisible()) mainWindow.hide();
    else {
      mainWindow.show();
      mainWindow.focus();
    }
    rebuildMenu();
  });
}

app.setAppUserModelId(APP_ID);
app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', (event) => event.preventDefault());
app.on('before-quit', () => {
  isQuitting = true;
  officialClient.stop();
});

ipcMain.handle('window:hide', () => mainWindow.hide());
ipcMain.handle('window:minimize', () => mainWindow.minimize());
ipcMain.handle('window:quit', () => {
  isQuitting = true;
  app.quit();
});
ipcMain.handle('window:get-always-on-top', () => mainWindow.isAlwaysOnTop());
ipcMain.handle('window:set-always-on-top', (_event, value) => {
  mainWindow.setAlwaysOnTop(Boolean(value));
  return mainWindow.isAlwaysOnTop();
});
ipcMain.handle('window:set-content-height', (_event, height) => resizeWindowToContent(height));
ipcMain.handle('codex:get-data', () => getCodexData());
ipcMain.handle('codex:consume-reset-credit', (_event, creditId) => (
  consumeResetCredit(officialClient, creditId)
));
