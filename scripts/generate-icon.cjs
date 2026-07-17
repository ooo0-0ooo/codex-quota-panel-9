const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const source = path.join(__dirname, '..', 'src', 'assets', 'logo.svg');
  const target = path.join(__dirname, '..', 'src', 'assets', 'logo.png');
  const window = new BrowserWindow({
    width: 400,
    height: 400,
    useContentSize: true,
    show: false,
    frame: false,
    transparent: true,
  });
  await window.loadFile(source);
  const image = await window.webContents.capturePage();
  fs.writeFileSync(target, image.resize({ width: 512, height: 512 }).toPNG());
  window.destroy();
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
