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

export interface DwgHeaderInfo {
  versionCode: string;
  versionName: string;
  isSupported: boolean;
}

/**
 * 快速检查 DWG 文件的 Header Magic Bytes (前 6 字节)
 */
export function inspectDwgHeader(buffer: ArrayBuffer | Uint8Array): DwgHeaderInfo {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 6) {
    return { versionCode: 'INVALID', versionName: '文件过小或无效 (小于 6 字节)', isSupported: false };
  }
  let header = '';
  for (let i = 0; i < 6; i++) {
    header += String.fromCharCode(bytes[i]);
  }

  const versionMap: Record<string, { name: string; supported: boolean }> = {
    'AC1032': { name: 'AutoCAD 2018 - 2026', supported: true },
    'AC1027': { name: 'AutoCAD 2013 - 2017', supported: true },
    'AC1024': { name: 'AutoCAD 2010 - 2012', supported: true },
    'AC1021': { name: 'AutoCAD 2007 - 2009', supported: true },
    'AC1018': { name: 'AutoCAD 2004 - 2006', supported: true },
    'AC1015': { name: 'AutoCAD 2000 - 2002', supported: true },
    'AC1014': { name: 'AutoCAD Release 14', supported: true },
    'AC1012': { name: 'AutoCAD Release 13', supported: true },
    'AC1009': { name: 'AutoCAD Release 11/12 (旧于 R13)', supported: false },
    'AC1006': { name: 'AutoCAD Release 10 (旧于 R13)', supported: false },
  };

  const match = versionMap[header];
  if (match) {
    return { versionCode: header, versionName: match.name, isSupported: match.supported };
  }

  return { versionCode: header, versionName: `非标准或未知 DWG 版本 (${header})`, isSupported: false };
}

const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 30));

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
      await yieldToMain();
    }
    const wasmBytes = await fetchWasmBinary(onProgress);

    if (onProgress) {
      onProgress('正在编译与初始化 WebAssembly 引擎...');
      await yieldToMain();
    }
    await initWasm(wasmBytes);
  }

  if (onProgress) {
    onProgress('正在解码 DWG 二进制图元...');
    await yieldToMain();
  }

  const bytes = dwgBuffer instanceof Uint8Array ? dwgBuffer : new Uint8Array(dwgBuffer);
  let dxfBytes: Uint8Array;
  try {
    dxfBytes = convertDwgToDxf(bytes);
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    let hint = rawMsg;
    if (rawMsg.includes('IO error') || rawMsg.includes('failed to fill')) {
      hint = `二进制数据解析截断 (${rawMsg})：图纸包含天正建筑 (TArch) 等专有代理对象或未内嵌的外部参照`;
    } else if (rawMsg.includes('unreachable') || rawMsg.includes('memory') || rawMsg.includes('RangeError')) {
      hint = `WebAssembly 引擎内存溢出 (${rawMsg})：图纸实体量过大，超出手机浏览器内存配额`;
    }
    throw new Error(hint);
  }

  if (onProgress) {
    onProgress('DWG 解码完成，正在准备图纸几何...');
    await yieldToMain();
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
