#!/usr/bin/env node

import { runCli } from "./src/cli.js";

runCli().catch((error) => {
  console.error("HATA:", error.message || error);
  process.exitCode = 1;
});
