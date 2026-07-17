const { app, BrowserWindow } = require('electron');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 314,
    height: 326,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await window.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await new Promise((resolve) => setTimeout(resolve, 250));
  const title = await window.webContents.executeJavaScript(
    "document.querySelector('h1')?.textContent",
  );
  if (title !== 'Codex Quota') throw new Error('Renderer did not load');
  const image = await window.webContents.capturePage();
  const output = path.join(__dirname, '..', 'outputs', 'ui.png');
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, image.toPNG());
  console.log(output);
  app.quit();
});
