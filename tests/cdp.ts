let ws: WebSocket;
let nextId = 1;
const pending = new Map<number, (value: any) => void>();

function reportUnansweredSend(id: number, method: string, reject: (error: Error) => void) {
  const stillPending = pending.delete(id);
  if (stillPending)
    reject(new Error(`CDP ${method} got no reply within 15000ms`));
}

export function send(method: string, params: Record<string, unknown> = {}) {
  return new Promise<any>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, resolve);
    setTimeout(reportUnansweredSend, 15000, id, method, reject).unref();
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function getNoResponse() {
  return null;
}

export async function waitForPort(port: number, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const response = await fetch(`http://localhost:${port}`).catch(getNoResponse);
    if (response)
      return;
    await waitMilliseconds(100);
  }
  throw new Error(`port ${port} did not open within ${timeoutMs}ms`);
}

export async function executeExpression(expression: string) {
  const { result } = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  return result.value;
}

export function waitMilliseconds(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForFunction(name: string, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const typeName = await executeExpression(`typeof ${name}`);
    const isFunction = typeName === "function";
    if (isFunction)
      return;
    await waitMilliseconds(50);
  }
  throw new Error(`${name} was not defined within ${timeoutMs}ms`);
}

function receiveMessage(event: MessageEvent) {
  const message = JSON.parse(event.data as string);
  const hasId = !!message.id;
  const isPending = pending.has(message.id);
  const isAnswer = hasId && isPending;
  if (isAnswer) {
    pending.get(message.id)!(message.result);
    pending.delete(message.id);
  }
}

export async function openCdp(cdpPort: number) {
  const targetResponse = await fetch(`http://localhost:${cdpPort}/json/new?about:blank`, { method: "PUT" });
  const target = await targetResponse.json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.addEventListener("message", receiveMessage);
}

export function closeCdp() {
  ws?.close();
}
