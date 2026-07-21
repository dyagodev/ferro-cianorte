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
npm run dist:win   # gera instalador NSIS + portável em release/ (funciona rodando no Mac sem precisar instalar wine — electron-builder baixa seu próprio wine portátil em ~/Library/Caches/electron-builder na primeira vez)
```

Cada `dist:*` já roda `next build` em `/web` e monta `web-standalone/`
automaticamente antes de empacotar.

**Antes de buildar**: sobe a versão em `desktop/package.json` (campo
`"version"`) — é ela que aparece no `latest.yml` e que o
`electron-updater` de cada estação compara pra saber se tem update. Sem
mudar a versão, o build sai idêntico e as estações não percebem nada de
novo.

**Cuidado com `useSearchParams()`**: qualquer página em `/web` que use
`useSearchParams()` sem estar dentro de `<Suspense>` quebra o `next build`
(prerender estático) mesmo funcionando normal no `next dev` — só aparece
na hora de gerar esse build de distribuição, não no dia a dia de
desenvolvimento. Ver `web/src/app/admin/manifestos-transporte/page.tsx`
pro padrão usado (componente separado por dentro de um `<Suspense>` no
export default).

## Publicar (deploy do auto-update)

O `electron-updater` de cada estação já instalada consulta
`https://ferro.dmtecnologia.com/desktop-updates/latest.yml` sozinho (é o
`publish.url` configurado em `package.json`) — assim que esse arquivo
aponta pra uma versão nova, o app baixa e se atualiza sem precisar
reinstalar manualmente em cada máquina.

Essa URL pública **não é servida de dentro do `public/` do Laravel** — é
um `alias` separado no nginx do servidor
(`/etc/nginx/sites-available/ferro.dmtecnologia.com`):

```nginx
location /desktop-updates/ {
    alias /var/www/ferro-desktop-updates/;
    autoindex off;
}
```

Depois de gerar o build (`npm run dist:win`), sobe os 3 arquivos de
`desktop/release/` pra essa pasta no servidor — só isso, sem precisar de
`composer install`/`migrate`/reiniciar nada, o Laravel nem participa
dessa URL:

```bash
cd desktop/release
scp "DM Nexus Setup <versão>.exe" "DM Nexus Setup <versão>.exe.blockmap" latest.yml \
  root@<ip-do-servidor>:/var/www/ferro-desktop-updates/

ssh root@<ip-do-servidor> "chown www-data:www-data /var/www/ferro-desktop-updates/*"

# confirma que ficou público e apontando pra versão certa
curl -s https://ferro.dmtecnologia.com/desktop-updates/latest.yml
```

Os arquivos antigos (versões anteriores) podem ficar parados na pasta sem
problema — `autoindex off` esconde a listagem, e só o `latest.yml` importa
pro `electron-updater` decidir o que baixar.
