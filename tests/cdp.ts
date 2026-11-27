let ws: WebSocket;
let targetId: string;
let nextId = 1;
// const pending = new Map<number, (value: any) => void>();
const pending = new Map<number, (value: unknown) => void>();

function reportUnansweredSend(id: number, method: string, reject: (error: Error) => void) {
  const stillPending = pending.delete(id);
  if (stillPending)
    reject(new Error(`CDP ${method} got no reply within 15000ms`));
}

// export function send(method: string, params: Record<string, unknown> = {}) {
export function send<Result = unknown>(method: string, params: Record<string, unknown> = {}) {
  // return new Promise<any>((resolve, reject) => {
  return new Promise<Result>((resolve, reject) => {
    const id = nextId++;
    // pending.set(id, resolve);
    pending.set(id, resolve as (value: unknown) => void);
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

// export async function executeExpression(expression: string) {
export async function executeExpression<Value = unknown>(expression: string): Promise<Value> {
  // const { result } = await send("Runtime.evaluate", {
  const { result } = await send<{ result: { value: Value } }>("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  return result.value;
}

// Re-renders from the current page state and waits for it, so any earlier unfinished render is superseded.
export async function waitForRender() {
  await executeExpression("render()");
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
  // const message = JSON.parse(event.data as string);
  const message = JSON.parse(event.data as string) as { id: number; result: unknown };
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
  // const target = await targetResponse.json();
  const target = await targetResponse.json() as { id: string; webSocketDebuggerUrl: string };
  targetId = target.id;
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.addEventListener("message", receiveMessage);
}

export async function closeCdpPage(cdpPort: number) {
  await fetch(`http://localhost:${cdpPort}/json/close/${targetId}`);
  // Chrome replies before the tab is gone, and a live tab still reads its watched file from the server.
  while ((await (await fetch(`http://localhost:${cdpPort}/json/list`)).text()).includes(targetId))
    await waitMilliseconds(20);
}

export function closeCdp() {
  ws?.close();
}
