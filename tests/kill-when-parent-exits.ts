import { spawn } from "node:child_process";

// `cat` ends when this process dies, even on SIGKILL, because its input pipe closes. The start time check protects a reused process number.
const WATCHER_SCRIPT = 'target_start=$(ps -o lstart= -p "$0"); cat > /dev/null; [ "$(ps -o lstart= -p "$0")" = "$target_start" ] && kill -9 "$0"';

export function killWhenParentExits(targetProcessId: number) {
    // detached: a kill of this process group must not also kill the watcher.
    const watcher = spawn("sh", ["-c", WATCHER_SCRIPT, String(targetProcessId)], { stdio: ["pipe", "ignore", "ignore"], detached: true });
    watcher.unref();
}
