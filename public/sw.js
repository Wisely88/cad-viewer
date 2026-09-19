/**
 * CAD Viewer PWA 离线 Service Worker (v4 自愈安全版)
 * 采用稳健的 Network-First (导航) + Cache-First (静态资源) 策略
 * 严禁向 event.respondWith 传递 undefined，杜绝 WebKit / Safari "重复出现问题" 崩溃
 */

const CACHE_NAME = 'cad-viewer-v4';

// 核心预缓存资源清单 (确保 install 快速稳定完成)
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).catch((err) => {
      console.warn('Precache failed, continue anyway:', err);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // 只处理 http/https 协议
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    (async () => {
      // 1. 如果是页面导航 (HTML)，优先网络获取最新内容，断网时走缓存
      if (event.request.mode === 'navigate') {
        try {
          const freshResponse = await fetch(event.request);
          if (freshResponse && freshResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, freshResponse.clone()).catch(() => {});
            return freshResponse;
          }
        } catch {
          // 断网时走缓存
          const cachedHtml = await caches.match(event.request) ||
                             await caches.match('./index.html') ||
                             await caches.match('./');
          if (cachedHtml) {
            return cachedHtml;
          }
        }
      }

      // 2. 静态资源：优先查缓存 (Cache First)
      const cached = await caches.match(event.request);
      if (cached) {
        return cached;
      }

      // 3. 缓存未命中：尝试网络获取并加入缓存
      try {
        const response = await fetch(event.request);
        if (response && response.ok) {
          // 缓存同源资源或 wasm 引擎
          const isSameOrigin = url.origin === self.location.origin;
          const isWasm = url.pathname.endsWith('.wasm');
          if (isSameOrigin || isWasm) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, response.clone()).catch(() => {});
          }
        }
        return response;
      } catch {
        // 4. 终极断网兜底：绝不返回 undefined，避免 WebKit 进程崩溃
        if (event.request.mode === 'navigate') {
          const fallbackHtml = await caches.match('./index.html') || await caches.match('./');
          if (fallbackHtml) return fallbackHtml;
        }

        // 构造合法的 503 兜底响应
        return new Response('Network offline and asset not in cache', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })()
  );
});
