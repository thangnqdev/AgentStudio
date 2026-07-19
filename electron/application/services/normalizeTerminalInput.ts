export function normalizePipeTerminalInput(data: string) {
  return data.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}
