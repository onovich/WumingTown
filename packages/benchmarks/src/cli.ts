import { runBenchmarksCli } from "@wuming-town/benchmarks";

process.exitCode = runBenchmarksCli(process.argv.slice(2));
