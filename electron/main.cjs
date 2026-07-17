const { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } = require('electron');
const path = require('node:path');
const { collectCodexData } = require('./codex-data.cjs');

let mainWindow;
let tray;
let isQuitting = false;

const APP_ID = 'com.ooo0-0ooo.codex-quota-panel-9';

function createTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#dedede"/>
      <path d="M8 10h16M8 16h11M8 22h7" stroke="#333" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="23" cy="22" r="4" fill="#555"/>
    </svg>`;
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 314,
    height: 326,
    minWidth: 314,
    minHeight: 326,
    maxWidth: 314,
    maxHeight: 326,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Codex Quota Panel 9',
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
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Codex Quota Panel 9');
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
});

ipcMain.handle('window:hide', () => mainWindow.hide());
ipcMain.handle('window:quit', () => {
  isQuitting = true;
  app.quit();
});
ipcMain.handle('window:get-always-on-top', () => mainWindow.isAlwaysOnTop());
ipcMain.handle('window:set-always-on-top', (_event, value) => {
  mainWindow.setAlwaysOnTop(Boolean(value));
  return mainWindow.isAlwaysOnTop();
});
ipcMain.handle('codex:get-data', () => collectCodexData());
