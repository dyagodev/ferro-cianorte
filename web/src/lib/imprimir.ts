/**
 * Dentro do app desktop (Electron), imprime direto na impressora padrão sem
 * o diálogo nativo de confirmação — window.print() no navegador sempre abre
 * esse diálogo, o que não dá pra evitar de dentro do Chromium puro; só a
 * API de impressão do próprio Electron (exposta via preload como
 * window.electronAPI.imprimirSilencioso) consegue pular a confirmação.
 * Fora do Electron (navegador comum), cai para window.print() normal.
 */
export async function imprimir(): Promise<void> {
  if (typeof window !== "undefined" && window.electronAPI?.isElectron) {
    await window.electronAPI.imprimirSilencioso();
    return;
  }

  window.print();
}
