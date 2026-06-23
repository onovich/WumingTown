import { runHeadlessCli } from "@wuming-town/headless-runner";

const exitCode = runHeadlessCli(process.argv.slice(2), {
  writeLine(line: string): void {
    console.log(line);
  },
  writeError(line: string): void {
    console.error(line);
  },
});

process.exitCode = exitCode;
