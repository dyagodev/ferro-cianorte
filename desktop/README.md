# Ferro Cianorte — Desktop (Electron)

App desktop pra Windows e Mac que empacota o mesmo front-end Next.js do
`/web`. Comportamento: abre como uma **bolha flutuante** arrastável na tela;
clicar nela expande pra janela cheia do sistema; minimizar pela barra de
título volta a mostrar só a bolha (a janela principal não fecha, só some —
uma venda em andamento não é perdida).

## Como funciona

- **Duas janelas Electron**: `bubbleWindow` (72x72, sem moldura, transparente,
  sempre no topo, posição arrastável e persistida em
  `bubble-position.json` dentro do userData) e `mainWindow` (janela normal,
  redimensionável/maximizável, também sem moldura — por isso o Next.js
  renderiza uma barra de título própria só quando roda dentro do Electron,
  veja `web/src/components/ElectronTitlebar.tsx`).
- **Em desenvolvimento** (`npm start`), a janela principal carrega
  `http://127.0.0.1:3000` — precisa do `npm run dev` já rodando em `/web`.
- **Empacotado**, o Next.js roda embutido: o build `output: "standalone"` do
  `/web` é copiado pra `desktop/web-standalone/` (via `prepare:web`) e
  o Electron sobe esse `server.js` como processo filho numa porta livre,
  com `LARAVEL_API_URL=https://ferro.dmtecnologia.com/api` — ou seja, o app
  desktop sempre fala com a API de produção, não com um Laravel local.
- **Início automático**: `app.setLoginItemSettings({ openAtLogin: true })` —
  o app já sobe direto como bolha ao ligar o computador, igual ao
  `sync-agent`.

## Desenvolvimento

```bash
cd web && npm run dev        # janela 1: Next.js em localhost:3000
cd desktop && npm install && npm start   # janela 2: Electron
```

## Build de distribuição

```bash
cd desktop
npm run dist:mac   # gera .dmg em release/ (só funciona rodando no macOS)
npm run dist:win   # gera instalador NSIS em release/ (build cross-plataforma do Windows a partir do Mac exige `wine` instalado)
```

Cada `dist:*` já roda `next build` em `/web` e monta `web-standalone/`
automaticamente antes de empacotar.
