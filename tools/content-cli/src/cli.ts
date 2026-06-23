import { runContentCli } from "./index";

const exitCode = await runContentCli(process.argv.slice(2), {
  writeLine(line: string): void {
    process.stdout.write(`${line}\n`);
  },
  writeError(line: string): void {
    process.stderr.write(`${line}\n`);
  },
});

process.exitCode = exitCode;
