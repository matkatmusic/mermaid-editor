export interface TestProcesses {
    servers: Map<number, string>;
    chromes: Map<number, string>;
}

interface ProcessLine {
    processId: number;
    parentProcessId: number;
    command: string;
}

export function countTestProcesses(psOutput: string, runnerProcessId: number): TestProcesses {
    const processLines: ProcessLine[] = [];
    for (const line of psOutput.split("\n")) {
        const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
        if (match) {
            processLines.push({ processId: Number(match[1]), parentProcessId: Number(match[2]), command: match[3] });
        }
    }

    const testProcesses: TestProcesses = { servers: new Map(), chromes: new Map() };
    const runProcessIds = new Set<number>([runnerProcessId]);
    let foundNewChild = true;
    while (foundNewChild) {
        foundNewChild = false;
        for (const { processId, parentProcessId, command } of processLines) {
            if (!runProcessIds.has(parentProcessId)) {
                continue;
            }
            if (runProcessIds.has(processId)) {
                continue;
            }
            runProcessIds.add(processId);
            foundNewChild = true;
            if (/server\.(js|ts) --port/.test(command)) {
                testProcesses.servers.set(processId, command);
            }
            if (command.includes("--remote-debugging-port")) {
                if (!command.includes("--type=")) {
                    testProcesses.chromes.set(processId, command);
                }
            }
        }
    }
    return testProcesses;
}
