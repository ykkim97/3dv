import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

async function main() {
  const repoRoot = process.cwd();
  const watPath = path.join(repoRoot, "src", "wasm", "demo.wat");
  const outDir = path.join(repoRoot, "public", "wasm");
  const outWasmPath = path.join(outDir, "demo.wasm");

  const watSource = await fs.readFile(watPath, "utf8");

  // wabt is a JS wrapper around WebAssembly Binary Toolkit.
  const wabtFactory = (await import("wabt")).default;
  const wabt = await wabtFactory();

  const parsed = wabt.parseWat(watPath, watSource, {
    features: {
      // keep defaults; enable more features here if you need them
    },
  });

  const { buffer } = parsed.toBinary({
    log: false,
    write_debug_names: true,
  });

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outWasmPath, Buffer.from(buffer));

  // eslint-disable-next-line no-console
  console.log(`[wasm] wrote ${path.relative(repoRoot, outWasmPath)}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[wasm] build failed", err);
  process.exitCode = 1;
});
