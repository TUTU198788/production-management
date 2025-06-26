/**
 * Service Worker for Production Management System
 * 提供离线功能和缓存管理
 */

const CACHE_NAME = 'production-management-v1.0.0';
const STATIC_CACHE = 'static-v1.0.0';
const DYNAMIC_CACHE = 'dynamic-v1.0.0';

// 需要缓存的静态资源
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles/main.css',
    '/styles/responsive.css',
    '/scripts/main.js',
    '/scripts/data-management.js',
    '/scripts/mobile-optimization.js',
    '/manifest.json',
    // 字体和图标
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    // 第三方库
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// 需要网络优先的资源
const NETWORK_FIRST = [
    '/api/',
    '/data/',
    '.json'
];

// 安装事件
self.addEventListener('install', (event) => {
    console.log('📦 Service Worker 安装中...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('📥 缓存静态资源...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('✅ Service Worker 安装完成');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ Service Worker 安装失败:', error);
            })
    );
});

// 激活事件
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker 激活中...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('🗑️ 删除旧缓存:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker 激活完成');
                return self.clients.claim();
            })
    );
});

// 拦截请求
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // 跳过非GET请求
    if (request.method !== 'GET') {
        return;
    }
    
    // 跳过chrome-extension和其他协议
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    event.respondWith(
        handleRequest(request)
    );
});

async function handleRequest(request) {
    const url = new URL(request.url);
    
    try {
        // 1. 静态资源 - 缓存优先
        if (isStaticAsset(request)) {
            return await cacheFirst(request, STATIC_CACHE);
        }
        
        // 2. API请求 - 网络优先
        if (isNetworkFirst(request)) {
            return await networkFirst(request, DYNAMIC_CACHE);
        }
        
        // 3. HTML页面 - 网络优先，离线时使用缓存
        if (request.headers.get('accept').includes('text/html')) {
            return await networkFirst(request, DYNAMIC_CACHE);
        }
        
        // 4. 其他资源 - 缓存优先
        return await cacheFirst(request, DYNAMIC_CACHE);
        
    } catch (error) {
        console.error('请求处理失败:', error);
        
        // 返回离线页面或默认响应
        if (request.headers.get('accept').includes('text/html')) {
            return await getOfflinePage();
        }
        
        return new Response('离线状态', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// 缓存优先策略
async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
        // 后台更新缓存
        updateCache(request, cacheName);
        return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
}

// 网络优先策略
async function networkFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('网络请求失败，尝试使用缓存:', request.url);
        
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        throw error;
    }
}

// 后台更新缓存
async function updateCache(request, cacheName) {
    try {
        const cache = await caches.open(cacheName);
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            await cache.put(request, networkResponse);
        }
    } catch (error) {
        // 静默失败，不影响用户体验
        console.log('后台缓存更新失败:', request.url);
    }
}

// 判断是否为静态资源
function isStaticAsset(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    return pathname.endsWith('.css') ||
           pathname.endsWith('.js') ||
           pathname.endsWith('.png') ||
           pathname.endsWith('.jpg') ||
           pathname.endsWith('.jpeg') ||
           pathname.endsWith('.gif') ||
           pathname.endsWith('.svg') ||
           pathname.endsWith('.ico') ||
           pathname.endsWith('.woff') ||
           pathname.endsWith('.woff2') ||
           pathname.endsWith('.ttf') ||
           pathname.includes('font-awesome') ||
           pathname.includes('chart.js') ||
           pathname.includes('xlsx');
}

// 判断是否需要网络优先
function isNetworkFirst(request) {
    const url = new URL(request.url);
    
    return NETWORK_FIRST.some(pattern => 
        url.pathname.includes(pattern)
    );
}

// 获取离线页面
async function getOfflinePage() {
    const cache = await caches.open(STATIC_CACHE);
    const offlinePage = await cache.match('/index.html');
    
    if (offlinePage) {
        return offlinePage;
    }
    
    return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>离线状态 - 生产管理系统</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-align: center;
                    padding: 20px;
                }
                .offline-icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                }
                h1 {
                    font-size: 24px;
                    margin-bottom: 16px;
                }
                p {
                    font-size: 16px;
                    opacity: 0.8;
                    max-width: 400px;
                    line-height: 1.5;
                }
                .retry-btn {
                    margin-top: 20px;
                    padding: 12px 24px;
                    background: rgba(255, 255, 255, 0.2);
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-radius: 8px;
                    color: white;
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .retry-btn:hover {
                    background: rgba(255, 255, 255, 0.3);
                }
            </style>
        </head>
        <body>
            <div class="offline-icon">📱</div>
            <h1>当前处于离线状态</h1>
            <p>请检查您的网络连接，然后重试。部分功能可能在离线状态下仍可使用。</p>
            <button class="retry-btn" onclick="window.location.reload()">重新加载</button>
        </body>
        </html>
    `, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8'
        }
    });
}

// 消息处理
self.addEventListener('message', (event) => {
    const { type, payload } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'GET_VERSION':
            event.ports[0].postMessage({
                version: CACHE_NAME
            });
            break;
            
        case 'CLEAR_CACHE':
            clearAllCaches().then(() => {
                event.ports[0].postMessage({
                    success: true
                });
            });
            break;
    }
});

// 清除所有缓存
async function clearAllCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('🗑️ 所有缓存已清除');
}

// 推送通知支持
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    const data = event.data.json();
    const options = {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [200, 100, 200],
        data: data.data || {},
        actions: data.actions || []
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// 通知点击处理
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const urlToOpen = event.notification.data.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window' })
            .then((clientList) => {
                // 如果已有窗口打开，则聚焦到该窗口
                for (const client of clientList) {
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                // 否则打开新窗口
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

console.log('🔧 Service Worker 已加载');
