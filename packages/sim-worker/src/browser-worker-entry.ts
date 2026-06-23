import { connectSimulationWorkerPort, type SimulationWorkerPort } from "./index";

// Browser WorkerGlobalScope has this message-port shape; the local declaration keeps
// the repository-wide TypeScript lib free of DOM/WebWorker globals.
declare const self: SimulationWorkerPort;

connectSimulationWorkerPort(self);
