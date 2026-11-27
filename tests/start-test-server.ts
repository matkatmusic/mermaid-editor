// Disabled for task #128: no test starts its own server. Lost: no test shows that a server from startTestServer stops when its starter is killed.
// import { killWhenParentExits } from "./kill-when-parent-exits.ts";
//
// // Every test server starts here, so no test needs its own cleanup code for a killed run.
// // export function startTestServer(serverSettings) {
// export function startTestServer(serverSettings: Record<string, string>) {
//     // return Bun.spawn(["bun", "server.js", "--port", "0"], { stdout: "pipe", env: { ...process.env, ...serverSettings } });
//     // const serverProcess = Bun.spawn(["bun", "server.js", "--port", "0"], { stdout: "pipe", env: { ...process.env, ...serverSettings } });
//     const serverProcess = Bun.spawn(["bun", "server.ts", "--port", "0"], { stdout: "pipe", env: { ...process.env, ...serverSettings } });
//     killWhenParentExits(serverProcess.pid);
//     return serverProcess;
// }
