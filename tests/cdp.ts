let ws: WebSocket;
let nextId = 1;
const pending = new Map<number, (value: any) => void>();

export function send(method: string, params: Record<string, unknown> = {}) {
  return new Promise<any>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, resolve);
    setTimeout(() => {
      const stillPending = pending.delete(id);
      if (stillPending)
        reject(new Error(`CDP ${method} got no reply within 15000ms`));
    }, 15000).unref();
    ws.send(JSON.stringify({ id, method, params }));
  });
}

export async function waitForPort(port: number, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const response = await fetch(`http://localhost:${port}`).catch(() => null);
    if (response)
      return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`port ${port} did not open within ${timeoutMs}ms`);
}

export async function evaluate(expression: string) {
  const { result } = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  return result.value;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForFunction(name: string, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if ((await evaluate(`typeof ${name}`)) === "function")
      return;
    await sleep(50);
  }
  throw new Error(`${name} was not defined within ${timeoutMs}ms`);
}

export async function connectCdp(cdpPort: number) {
  const target = await fetch(`http://localhost:${cdpPort}/json/new?about:blank`, { method: "PUT" }).then((r) => r.json());
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data as string);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)!(message.result);
      pending.delete(message.id);
    }
  });
}

export function closeCdp() {
  ws?.close();
}
