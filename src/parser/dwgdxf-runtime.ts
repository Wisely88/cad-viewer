/**
 * DWG WebAssembly 运行时驱动 (基于 acadrust wasm-bindgen 封装)
 * 纯内联 ESM 模块，杜绝动态 import 模块脚本导致的 Safari/移动端加载失败
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wasm: any;
let cachedUint8ArrayMemory0: Uint8Array | null = null;
let WASM_VECTOR_LEN = 0;

function getUint8ArrayMemory0(): Uint8Array {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr: number, len: number): string {
  return decodeText(ptr >>> 0, len);
}

function passArray8ToWasm0(arg: Uint8Array, malloc: (size: number, align: number) => number): number {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory0().set(arg, ptr / 1);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function takeFromExternrefTable0(idx: number): any {
  const value = wasm.__wbindgen_externrefs.get(idx);
  wasm.__externref_table_dealloc(idx);
  return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;

function decodeText(ptr: number, len: number): string {
  numBytesDecoded += len;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    numBytesDecoded = len;
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function getWbgImports(): WebAssembly.Imports {
  const import0 = {
    __wbindgen_cast_0000000000000001: function (arg0: number, arg1: number): string {
      return getStringFromWasm0(arg0, arg1);
    },
    __wbindgen_init_externref_table: function (): void {
      const table = wasm.__wbindgen_externrefs;
      const offset = table.grow(4);
      table.set(0, undefined);
      table.set(offset + 0, undefined);
      table.set(offset + 1, null);
      table.set(offset + 2, true);
      table.set(offset + 3, false);
    },
  };
  return {
    './dwgdxf_bg.js': import0 as unknown as WebAssembly.ModuleImports,
  };
}

function finalizeInit(instance: WebAssembly.Instance, _module: WebAssembly.Module) {
  wasm = instance.exports;
  cachedUint8ArrayMemory0 = null;
  wasm.__wbindgen_start();
  return wasm;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function initWasm(source: BufferSource | Response | WebAssembly.Module): Promise<any> {
  if (wasm !== undefined) return wasm;

  const imports = getWbgImports();

  if (typeof Response !== 'undefined' && source instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === 'function') {
      try {
        const res = await WebAssembly.instantiateStreaming(source, imports);
        return finalizeInit(res.instance, res.module);
      } catch (e) {
        console.warn('WebAssembly.instantiateStreaming 失败，回退至 arrayBuffer 模式:', e);
      }
    }
    const bytes = await source.arrayBuffer();
    const res = await WebAssembly.instantiate(bytes, imports);
    return finalizeInit(res.instance, res.module);
  }

  if (source instanceof WebAssembly.Module) {
    const instance = new WebAssembly.Instance(source, imports);
    return finalizeInit(instance, source);
  }

  // source is BufferSource (ArrayBuffer or TypedArray)
  const res = await WebAssembly.instantiate(source as BufferSource, imports);
  return finalizeInit(res.instance, res.module);
}

export function isEngineReady(): boolean {
  return wasm !== undefined;
}

export function convertDwgToDxf(dwgBytes: Uint8Array): Uint8Array {
  if (!wasm) {
    throw new Error('WebAssembly DWG 引擎尚未初始化');
  }
  const ptr0 = passArray8ToWasm0(dwgBytes, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.convertDwgToDxf(ptr0, len0);
  if (ret[3]) {
    throw takeFromExternrefTable0(ret[2]);
  }
  const v2 = getUint8ArrayMemory0().subarray(ret[0] >>> 0, (ret[0] >>> 0) + ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
  return v2;
}
