const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const source = path.join(__dirname, '..', 'src', 'assets', 'logo.svg');
  const target = path.join(__dirname, '..', 'src', 'assets', 'logo.png');
  const svg = fs.readFileSync(source, 'utf8');
  const width = Number(svg.match(/\bwidth="([\d.]+)"/)?.[1]) || 512;
  const height = Number(svg.match(/\bheight="([\d.]+)"/)?.[1]) || 512;
  const window = new BrowserWindow({
    width,
    height,
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
