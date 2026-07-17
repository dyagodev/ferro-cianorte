const { app, BrowserWindow, screen, ipcMain, Menu, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const net = require("net");
const { spawn } = require("child_process");

const BUBBLE_SIZE = 72;
const PROD_API_URL = "https://ferro.dmtecnologia.com/api";
const ICON_PATH = path.join(__dirname, "..", "assets", "icon.png");
const POSITION_FILE = path.join(app.getPath("userData"), "bubble-position.json");
const WINDOW_STATE_FILE = path.join(app.getPath("userData"), "window-state.json");
const SERVER_LOG_FILE = path.join(app.getPath("userData"), "server.log");

let bubbleWindow = null;
let mainWindow = null;
let splashWindow = null;
let serverProcess = null;
let serverUrl = null;
let isQuitting = false;
let reassertTopmostInterval = null;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 320,
    frame: false,
    // Sem transparent:true de propósito — o cartão branco arredondado já é
    // desenhado no próprio splash.html; janela transparente a mais só
    // aumenta o risco do bug de composição do Windows (ver
    // disableHardwareAcceleration acima).
    backgroundColor: "#ffffff",
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    icon: ICON_PATH,
  });

  splashWindow.loadFile(path.join(__dirname, "splash.html"));
  splashWindow.once("ready-to-show", () => splashWindow?.show());
}

function fecharSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
  }
  splashWindow = null;
}

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
    // Windows 11 aplica Mica (efeito de vidro fosco, misturando o papel de
    // parede) automaticamente em janela sem moldura (frame: false) — é
    // exatamente o vazamento visual reportado (área de trabalho aparecendo
    // atrás dos modais). "none" desliga esse material e força a janela a
    // ficar opaca de verdade, respeitando o backgroundColor acima.
    backgroundMaterial: "none",
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
    { label: "Abrir DM Nexus", click: showMain },
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
ipcMain.handle("app:versao", () => app.getVersion());

// Auto-atualização: só faz sentido pra quem instalou pelo NSIS (Setup.exe)
// — o portátil não tem como se autoatualizar (não existe "instalação" pra
// sobrescrever). autoUpdater.checkForUpdates() lança um erro nesse caso
// (não acha app-update.yml dentro do pacote); o catch trata isso como um
// resultado normal ("sem suporte"), não como falha de verdade.
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function enviarStatusAtualizacao(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:status", status);
  }
}

autoUpdater.on("checking-for-update", () => enviarStatusAtualizacao({ estado: "verificando" }));
autoUpdater.on("update-available", (info) => enviarStatusAtualizacao({ estado: "disponivel", versao: info.version }));
autoUpdater.on("update-not-available", () => enviarStatusAtualizacao({ estado: "atualizado" }));
autoUpdater.on("download-progress", (progresso) =>
  enviarStatusAtualizacao({ estado: "baixando", percentual: Math.round(progresso.percent) }),
);
autoUpdater.on("update-downloaded", (info) => enviarStatusAtualizacao({ estado: "pronto", versao: info.version }));
autoUpdater.on("error", (erro) => enviarStatusAtualizacao({ estado: "erro", mensagem: erro.message }));

ipcMain.handle("app:verificar-atualizacao", async () => {
  try {
    await autoUpdater.checkForUpdates();
  } catch (erro) {
    enviarStatusAtualizacao({ estado: "erro", mensagem: erro.message });
  }
});

// quitAndInstall() dispara app.quit() por baixo dos panos, que manda
// "close" pra mainWindow — sem isQuitting=true antes, o handler de close
// (linha abaixo, showBubble()) engoliria o fechamento e a instalação nunca
// aconteceria de verdade.
ipcMain.handle("app:instalar-atualizacao", () => {
  isQuitting = true;
  autoUpdater.quitAndInstall();
});

// Verifica ao abrir (com um atraso pra não competir com o carregamento
// inicial) e depois a cada 4h — o app costuma ficar aberto dias seguidos
// (abre com o Windows, nunca fecha sozinho), então não dá pra confiar só
// na checagem do startup.
function iniciarChecagemPeriodicaDeAtualizacao() {
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 30_000);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
}

// Imprime a página atual direto na impressora padrão do Windows, sem o
// diálogo nativo de impressão (que pede confirmação a cada venda) — usa a
// API de impressão do próprio Electron em vez do window.print() do
// navegador, que sempre abre o diálogo. Silencioso de propósito: cupom de
// venda tem que sair sozinho no caixa, sem clique extra.
ipcMain.handle("app:print-silent", (event) =>
  new Promise((resolve) => {
    // margins "none" é essencial aqui: sem isso o Electron aplica a margem
    // padrão do driver da impressora, que em impressora térmica de cupom
    // (rolo estreito) corta o conteúdo encostado na borda — tanto direita
    // quanto esquerda, dependendo do driver. Com o diálogo nativo (antes da
    // impressão silenciosa) o usuário via o preview e ajustava; sem
    // diálogo, ninguém percebe até o cupom sair cortado no papel.
    //
    // pageSize explícito em 80mm de largura pelo mesmo motivo: sem isso o
    // Chromium usa o tamanho de papel padrão configurado no Windows pra
    // essa impressora (Carta/A4, se a instalação padrão não foi trocada),
    // que não bate com o rolo físico e faz o driver cortar o excesso.
    // Altura generosa (297mm) cobre cupom longo — impressora de rolo
    // contínuo corta pelo conteúdo real, não pela altura declarada aqui.
    event.sender.print(
      {
        silent: true,
        printBackground: true,
        margins: { marginType: "none" },
        pageSize: { width: 80000, height: 297000 },
      },
      (success, failureReason) => {
        resolve({ success, failureReason });
      },
    );
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

  // stdio ia direto pro limbo (stdio: "ignore") — se o servidor embutido
  // travasse ao subir, não sobrava rastro nenhum pra diagnosticar. Agora
  // stdout/stderr do processo filho vão pro mesmo log de diagnóstico.
  const logStream = fs.createWriteStream(SERVER_LOG_FILE, { flags: "a" });
  logStream.write(`\n--- iniciando servidor embutido em ${new Date().toISOString()} ---\n`);

  serverProcess = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      LARAVEL_API_URL: PROD_API_URL,
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProcess.stdout.pipe(logStream);
  serverProcess.stderr.pipe(logStream);
  serverProcess.on("exit", (code, signal) => {
    logStream.write(`--- servidor embutido encerrou (code=${code} signal=${signal}) ---\n`);
  });

  serverUrl = `http://127.0.0.1:${port}`;
  await waitForServer(serverUrl);
}

function relatarErroFatal(erro) {
  console.error(erro);
  try {
    fs.appendFileSync(SERVER_LOG_FILE, `\n--- erro fatal no startup em ${new Date().toISOString()} ---\n${erro?.stack ?? erro}\n`);
  } catch {
    // Se nem o log deu pra escrever, não tem mais o que fazer — só mostra o diálogo.
  }
  dialog.showErrorBox(
    "DM Nexus não conseguiu iniciar",
    `Ocorreu um erro ao abrir o app:\n\n${erro?.message ?? erro}\n\nDetalhes em: ${SERVER_LOG_FILE}`,
  );
  app.quit();
}

app.whenReady().then(async () => {
  try {
    app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });

    // Mostra a splash na hora — o resto (subir o servidor embutido, carregar
    // a janela principal) leva alguns segundos, e sem isso a primeira
    // impressão é o Windows não mostrando nada por um tempo.
    createSplashWindow();

    await startEmbeddedServer();
    await createMainWindow();
    createBubbleWindow();
    fecharSplashWindow();

    // Sempre começa como bolha flutuante, tanto no login automático quanto ao
    // abrir manualmente — a janela cheia só some (fica em memória) até expandir.
    showBubble();

    if (app.isPackaged) iniciarChecagemPeriodicaDeAtualizacao();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow().then(showBubble);
      }
    });
  } catch (erro) {
    fecharSplashWindow();
    relatarErroFatal(erro);
  }
});

process.on("uncaughtException", relatarErroFatal);

app.on("before-quit", () => {
  isQuitting = true;
  pararReassertTopmost();
  matarServidorEmbutido();
});

// O servidor Next embutido roda com o MESMO executável do app (spawn de
// process.execPath com ELECTRON_RUN_AS_NODE=1) — no Gerenciador de Tarefas
// e pra qualquer ferramenta que cheque "está rodando?" (como o instalador
// NSIS antes de atualizar), ele aparece como outro "DM Nexus.exe".
// serverProcess.kill() sozinho não é confiável no Windows pra matar esse
// tipo de processo filho — ele pode sobreviver ao "Sair" e deixar o
// instalador travado achando que o app ainda está aberto. taskkill /t
// (árvore inteira) /f (força) garante que morre de verdade.
function matarServidorEmbutido() {
  if (!serverProcess || !serverProcess.pid) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"]);
  } else {
    serverProcess.kill();
  }
}

app.on("window-all-closed", () => {
  // Minimizar pra bolha não fecha o processo (ver mainWindow "close" acima);
  // isso só dispara de fato ao sair pelo botão de fechar com isQuitting=true.
  if (process.platform !== "darwin" && isQuitting) app.quit();
});
