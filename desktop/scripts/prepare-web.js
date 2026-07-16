// Monta a pasta desktop/web-standalone/ a partir do build do Next.js (output:
// "standalone"), no formato que o Next espera pra rodar sozinho: o server.js
// gerado + .next/static + public copiados por cima (o build standalone não
// inclui esses dois por padrão, é preciso copiar manualmente).
const fs = require("fs");
const path = require("path");

const webDir = path.join(__dirname, "..", "..", "web");
const standaloneSrc = path.join(webDir, ".next", "standalone");
const destDir = path.join(__dirname, "..", "web-standalone");

if (!fs.existsSync(standaloneSrc)) {
  console.error(`Build standalone não encontrado em ${standaloneSrc}. Rode "npm run build:web" primeiro.`);
  process.exit(1);
}

fs.rmSync(destDir, { recursive: true, force: true });
fs.cpSync(standaloneSrc, destDir, { recursive: true });

// O standalone do Next espelha o caminho relativo até a raiz do monorepo
// (aqui, .../standalone/web/server.js, não .../standalone/server.js), então
// achamos o server.js gerado em vez de assumir onde ele cai.
function findServerEntry(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name === "server.js") return path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      const found = findServerEntry(path.join(dir, entry.name));
      if (found) return found;
    }
  }
  return null;
}

const serverEntry = findServerEntry(destDir);
if (!serverEntry) {
  console.error(`Não encontrei server.js dentro de ${destDir}`);
  process.exit(1);
}
const appDir = path.dirname(serverEntry);

fs.cpSync(path.join(webDir, ".next", "static"), path.join(appDir, ".next", "static"), { recursive: true });

const publicDir = path.join(webDir, "public");
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, path.join(appDir, "public"), { recursive: true });
}

// O app não usa next/image, então "sharp" nunca é chamado de verdade — mas o
// npm instala ele mesmo assim (dependência opcional do Next) com o binário
// nativo da máquina que rodou o build (aqui, sempre Mac). Empacotar esse
// binário dentro do instalador Windows é peso morto arriscado: se o Next
// tentar carregar sharp por engano lá, quebra o servidor embutido sem
// deixar rastro. Mais seguro tirar do pacote de vez.
for (const pasta of ["sharp", "@img"]) {
  fs.rmSync(path.join(appDir, "node_modules", pasta), { recursive: true, force: true });
}

fs.writeFileSync(path.join(destDir, "server-entry.json"), JSON.stringify({ entry: path.relative(destDir, serverEntry) }));

console.log(`web-standalone pronto em ${destDir} (server.js em ${path.relative(destDir, serverEntry)})`);
