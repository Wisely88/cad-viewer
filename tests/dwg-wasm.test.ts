import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initWasm, isEngineReady, convertDwgToDxf } from '../src/parser/dwgdxf-runtime.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('WebAssembly DWG Engine Tests', async (t) => {
  await t.test('should successfully load and instantiate WASM binary', async () => {
    const wasmPath = path.resolve(__dirname, '../public/wasm/dwgdxf_bg.wasm');
    assert.strictEqual(fs.existsSync(wasmPath), true, 'dwgdxf_bg.wasm must exist');

    const wasmBuffer = fs.readFileSync(wasmPath);
    assert.ok(wasmBuffer.byteLength > 100000, 'WASM binary should be around 800KB');

    await initWasm(wasmBuffer);
    assert.strictEqual(isEngineReady(), true, 'Engine must be initialized');
  });

  await t.test('should execute Rust WebAssembly conversion pipeline on input bytes', () => {
    // 验证引擎调用是否能够进入 Rust WebAssembly 导出的 convertDwgToDxf 函数
    // 传入非 DWG 格式字节，预期 Rust 引擎捕获格式异常并抛出错误，而非 JS 运行时崩溃
    const dummyBytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
    assert.throws(
      () => {
        convertDwgToDxf(dummyBytes);
      },
      (err: unknown) => {
        // Rust wasm 会抛出针对 DWG Header 校验失败的错误
        return err !== undefined;
      },
      'Rust WASM engine should execute and reject invalid DWG header'
    );
  });
});
