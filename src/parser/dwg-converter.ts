/**
 * 客户端 WebAssembly DWG 解码与转换适配器
 * 基于 Rust/WASM (acadrust) 实现纯前端 100% 本地 DWG -> DXF 转换
 * 解决移动端 / Safari 动态 import 模块脚本失败问题，采用标准二进制流加载与实例化
 */

import { initWasm, convertDwgToDxf, isEngineReady } from './dwgdxf-runtime.ts';

/**
 * 寻找可用的 WASM 二进制文件资源
 */
async function fetchWasmBinary(onProgress?: (msg: string) => void): Promise<ArrayBuffer> {
  const candidateUrls: string[] = [];

  // 1. 基于 document.baseURI (兼容 GitHub Pages 等子路径部署)
  if (typeof document !== 'undefined' && document.baseURI) {
    try {
      const url = new URL('wasm/dwgdxf_bg.wasm', document.baseURI).href;
      candidateUrls.push(url);
    } catch {}
  }

  // 2. 基于 window.location.href (应对某些单页应用哈希或相对基底)
  if (typeof window !== 'undefined' && window.location?.href) {
    try {
      const pathParts = window.location.pathname.split('/');
      pathParts.pop(); // 移除当前页面文件名如 index.html
      const dirPath = pathParts.join('/') || '';
      const origin = window.location.origin;
      candidateUrls.push(`${origin}${dirPath}/wasm/dwgdxf_bg.wasm`);
    } catch {}
  }

  // 3. 相对路径
  candidateUrls.push('./wasm/dwgdxf_bg.wasm');

  // 4. 常见已知绝对路径
  candidateUrls.push('/cad-viewer/wasm/dwgdxf_bg.wasm');

  // 5. 全球公共 CDN 镜像回退 (当本地缓存或资源不可用时兜底)
  candidateUrls.push('https://cdn.jsdelivr.net/npm/dwgdxf@2.0.1/dist/wasm/dwgdxf_bg.wasm');
  candidateUrls.push('https://unpkg.com/dwgdxf@2.0.1/dist/wasm/dwgdxf_bg.wasm');

  // 去重
  const uniqueUrls = Array.from(new Set(candidateUrls));

  let lastError: unknown = null;
  for (const url of uniqueUrls) {
    try {
      if (onProgress) {
        const isRemote = url.startsWith('http') && (typeof window !== 'undefined' && !url.includes(window.location.host));
        onProgress(`正在载入 WASM 引擎 (${isRemote ? 'CDN' : '本地'})...`);
      }
      const resp = await fetch(url, { mode: 'cors' });
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        if (buf && buf.byteLength > 0) {
          return buf;
        }
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`无法载入 WebAssembly 引擎二进制文件: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

/**
 * 将 DWG 二进制 ArrayBuffer 转换为标准 DXF 文本字符串
 */
export async function convertDwgBufferToDxfString(
  dwgBuffer: ArrayBuffer | Uint8Array,
  onProgress?: (message: string) => void
): Promise<string> {
  if (!isEngineReady()) {
    if (onProgress) {
      onProgress('正在载入 WebAssembly 解码引擎...');
    }
    const wasmBytes = await fetchWasmBinary(onProgress);

    if (onProgress) {
      onProgress('正在编译与初始化 WebAssembly 引擎...');
    }
    await initWasm(wasmBytes);
  }

  if (onProgress) {
    onProgress('正在解码 DWG 二进制图元...');
  }

  const bytes = dwgBuffer instanceof Uint8Array ? dwgBuffer : new Uint8Array(dwgBuffer);
  const dxfBytes = convertDwgToDxf(bytes);

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
