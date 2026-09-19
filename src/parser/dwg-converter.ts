/**
 * 客户端 WebAssembly DWG 解码与转换适配器
 * 基于 Rust/WASM (acadrust) 实现纯前端 100% 本地 DWG -> DXF 转换
 */

import { convertDwgToDxf, init, CDN_WASM_BASE } from 'dwgdxf';

let isWasmInitialized = false;

/**
 * 将 DWG 二进制 ArrayBuffer 转换为标准 DXF 文本字符串
 */
export async function convertDwgBufferToDxfString(
  dwgBuffer: ArrayBuffer | Uint8Array,
  onProgress?: (message: string) => void
): Promise<string> {
  if (onProgress) {
    onProgress('正在初始化 WebAssembly 解码引擎...');
  }

  if (!isWasmInitialized) {
    try {
      // 1. 优先使用本地打包的 WASM
      await init({ wasmBase: './wasm/' });
      isWasmInitialized = true;
    } catch (localErr) {
      console.warn('本地 WASM 初始化异常，尝试直接初始化或回退 CDN:', localErr);
      try {
        await init();
        isWasmInitialized = true;
      } catch (cdnErr) {
        console.warn('尝试使用 CDN WASM 基址:', cdnErr);
        await init({ wasmBase: CDN_WASM_BASE });
        isWasmInitialized = true;
      }
    }
  }

  if (onProgress) {
    onProgress('正在解码 DWG 二进制图元...');
  }

  const bytes = dwgBuffer instanceof Uint8Array ? dwgBuffer : new Uint8Array(dwgBuffer);
  const dxfBytes = await convertDwgToDxf(bytes);

  if (onProgress) {
    onProgress('DWG 解码完成，正在准备图纸几何...');
  }

  // 解码文本：优先 UTF-8，降级至 GBK / ASCII
  try {
    return new TextDecoder('utf-8').decode(dxfBytes);
  } catch {
    try {
      return new TextDecoder('gbk').decode(dxfBytes);
    } catch {
      return new TextDecoder('ascii').decode(dxfBytes);
    }
  }
}
