const { app, BrowserWindow, screen, ipcMain, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const net = require("net");
const { spawn } = require("child_process");

const BUBBLE_SIZE = 72;
const PROD_API_URL = "https://ferro.dmtecnologia.com/api";
const ICON_PATH = path.join(__dirname, "..", "assets", "icon.png");
const POSITION_FILE = path.join(app.getPath("userData"), "bubble-position.json");
const WINDOW_STATE_FILE = path.join(app.getPath("userData"), "window-state.json");

let bubbleWindow = null;
let mainWindow = null;
let serverProcess = null;
let serverUrl = null;
let isQuitting = false;
let reassertTopmostInterval = null;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data));
  } catch {
    // Não é crítico perder a posição salva — o app volta a usar o padrão.
  }
}

function loadBubblePosition() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  return readJson(POSITION_FILE, { x: width - BUBBLE_SIZE - 24, y: 80 });
}

function loadWindowState() {
  return readJson(WINDOW_STATE_FILE, { width: 1280, height: 800 });
}

function createBubbleWindow() {
  const pos = loadBubblePosition();

  bubbleWindow = new BrowserWindow({
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, "preload-bubble.js"),
    },
  });

  // Nível mais alto disponível — sem isso, outro app que também peça
  // "sempre no topo" (como o Link Pro no Windows) pode ganhar a disputa e
  // cobrir a bolha.
  bubbleWindow.setAlwaysOnTop(true, "screen-saver");
  bubbleWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  bubbleWindow.loadFile(path.join(__dirname, "bubble.html"));

  bubbleWindow.on("moved", () => {
    const [x, y] = bubbleWindow.getPosition();
    writeJson(POSITION_FILE, { x, y });
  });

  // Mesmo no nível máximo, o Windows deixa outro app "roubar" o topo quando
  // ele também é topmost e é ativado depois. Reforça periodicamente pra
  // bolha voltar a ficar por cima de qualquer coisa (ex.: abrir o Link Pro).
  bubbleWindow.on("blur", reafirmarTopmost);
  bubbleWindow.on("show", () => {
    reafirmarTopmost();
    if (!reassertTopmostInterval) {
      reassertTopmostInterval = setInterval(reafirmarTopmost, 1000);
    }
  });
  bubbleWindow.on("hide", pararReassertTopmost);
}

function reafirmarTopmost() {
  if (!bubbleWindow || bubbleWindow.isDestroyed() || !bubbleWindow.isVisible()) return;
  bubbleWindow.setAlwaysOnTop(true, "screen-saver");
  bubbleWindow.moveTop();
}

function pararReassertTopmost() {
  if (reassertTopmostInterval) {
    clearInterval(reassertTopmostInterval);
    reassertTopmostInterval = null;
  }
}

async function createMainWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    minWidth: 960,
    minHeight: 600,
    show: false,
    frame: false,
    backgroundColor: "#ffffff",
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  await mainWindow.loadURL(serverUrl);

  mainWindow.on("resize", saveWindowState);
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    showBubble();
  });
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isMaximized()) return;
  const [width, height] = mainWindow.getSize();
  writeJson(WINDOW_STATE_FILE, { width, height });
}

function showBubble() {
  if (mainWindow) mainWindow.hide();
  if (!bubbleWindow) createBubbleWindow();
  bubbleWindow.show();
}

function showMain() {
  if (bubbleWindow) bubbleWindow.hide();
  if (mainWindow) mainWindow.show();
}

ipcMain.on("bubble:expand", showMain);
ipcMain.on("bubble:move", (_event, { x, y }) => {
  if (bubbleWindow) bubbleWindow.setPosition(Math.round(x), Math.round(y));
});
ipcMain.on("bubble:context-menu", () => {
  const menu = Menu.buildFromTemplate([
    { label: "Abrir Ferro Cianorte", click: showMain },
    { type: "separator" },
    {
      label: "Sair",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  menu.popup({ window: bubbleWindow });
});
ipcMain.on("app:minimize-to-bubble", showBubble);
ipcMain.on("app:toggle-maximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on("app:close", () => {
  isQuitting = true;
  app.quit();
});
ipcMain.handle("app:platform", () => process.platform);

// Imprime a página atual direto na impressora padrão do Windows, sem o
// diálogo nativo de impressão (que pede confirmação a cada venda) — usa a
// API de impressão do próprio Electron em vez do window.print() do
// navegador, que sempre abre o diálogo. Silencioso de propósito: cupom de
// venda tem que sair sozinho no caixa, sem clique extra.
ipcMain.handle("app:print-silent", (event) =>
  new Promise((resolve) => {
    event.sender.print({ silent: true, printBackground: true }, (success, failureReason) => {
      resolve({ success, failureReason });
    });
  }),
);

function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => {
      if (startPort > 3999) {
        reject(new Error("Nenhuma porta livre encontrada"));
        return;
      }
      resolve(findFreePort(startPort + 1));
    });
    server.listen(startPort, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function waitForServer(url, tries = 60) {
  const { port, hostname } = new URL(url);
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      const socket = net.connect({ host: hostname, port: Number(port) }, () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (remaining <= 0) {
          reject(new Error("Servidor local do app não respondeu a tempo"));
          return;
        }
        setTimeout(() => attempt(remaining - 1), 200);
      });
    };
    attempt(tries);
  });
}

async function startEmbeddedServer() {
  if (!app.isPackaged) {
    // Em desenvolvimento, usa o `next dev` já rodando em /web (npm run dev).
    serverUrl = "http://127.0.0.1:3000";
    return;
  }

  const port = await findFreePort(3100);
  const webStandaloneDir = path.join(process.resourcesPath, "web-standalone");
  const { entry } = readJson(path.join(webStandaloneDir, "server-entry.json"), null) ?? {};
  if (!entry) throw new Error("server-entry.json não encontrado em web-standalone/ — rode prepare:web antes de empacotar");
  const serverEntry = path.join(webStandaloneDir, entry);

  serverProcess = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      LARAVEL_API_URL: PROD_API_URL,
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: "ignore",
  });

  serverUrl = `http://127.0.0.1:${port}`;
  await waitForServer(serverUrl);
}

app.whenReady().then(async () => {
  app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });

  await startEmbeddedServer();
  await createMainWindow();
  createBubbleWindow();

  // Sempre começa como bolha flutuante, tanto no login automático quanto ao
  // abrir manualmente — a janela cheia só some (fica em memória) até expandir.
  showBubble();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow().then(showBubble);
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  pararReassertTopmost();
  if (serverProcess) serverProcess.kill();
});

app.on("window-all-closed", () => {
  // Minimizar pra bolha não fecha o processo (ver mainWindow "close" acima);
  // isso só dispara de fato ao sair pelo botão de fechar com isQuitting=true.
  if (process.platform !== "darwin" && isQuitting) app.quit();
});
