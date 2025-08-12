// ミニ四駆レースメモ PWA Service Worker
const CACHE_NAME = 'mini4wd-race-memo-v1.0.0';
const STATIC_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Service Worker インストール時
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static resources');
        return cache.addAll(STATIC_RESOURCES);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        // 即座に新しいService Workerを有効化
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Service Worker アクティベート時
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // 古いキャッシュを削除
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        // 全てのクライアントで新しいService Workerを有効化
        return self.clients.claim();
      })
      .catch((error) => {
        console.error('Service Worker: Activation failed', error);
      })
  );
});

// ネットワークリクエストの処理
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 同一オリジンのリクエストのみ処理
  if (url.origin !== location.origin) {
    return;
  }
  
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // キャッシュがある場合
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache:', request.url);
          
          // HTMLファイルの場合は、バックグラウンドでネットワークから更新を取得
          if (request.destination === 'document') {
            // Cache-first with background update strategy
            fetch(request)
              .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                  const responseClone = networkResponse.clone();
                  caches.open(CACHE_NAME)
                    .then((cache) => {
                      cache.put(request, responseClone);
                      console.log('Service Worker: Updated cache in background:', request.url);
                    });
                }
              })
              .catch((error) => {
                console.log('Service Worker: Background update failed:', error);
              });
          }
          
          return cachedResponse;
        }
        
        // キャッシュがない場合はネットワークから取得
        console.log('Service Worker: Fetching from network:', request.url);
        return fetch(request)
          .then((networkResponse) => {
            // レスポンスが有効な場合のみキャッシュ
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // レスポンスをクローンしてキャッシュに保存
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                // 静的リソースのみキャッシュ（APIリクエストなどは除外）
                if (request.method === 'GET' && 
                    (request.url.includes('.html') || 
                     request.url.includes('.css') || 
                     request.url.includes('.js') || 
                     request.url.includes('.json') ||
                     request.url.endsWith('/'))) {
                  cache.put(request, responseToCache);
                  console.log('Service Worker: Cached new resource:', request.url);
                }
              });
            
            return networkResponse;
          })
          .catch((error) => {
            console.error('Service Worker: Network fetch failed:', error);
            
            // オフライン時のフォールバック
            if (request.destination === 'document') {
              return caches.match('/index.html');
            }
            
            // その他のリソースの場合は適切なエラーレスポンスを返す
            return new Response('オフラインです', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain; charset=utf-8'
              })
            });
          });
      })
  );
});

// プッシュ通知（将来的な拡張用）
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push event received');
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/manifest.json', // アイコン用URL
      badge: '/manifest.json', // バッジ用URL
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey || '1'
      },
      actions: [
        {
          action: 'explore',
          title: '開く',
          icon: '/manifest.json'
        },
        {
          action: 'close',
          title: '閉じる',
          icon: '/manifest.json'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // 何もしない
  } else {
    // デフォルトアクション
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// バックグラウンド同期（将来的な拡張用）
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    // バックグラウンドでのデータ同期処理
    console.log('Service Worker: Performing background sync');
    // 実装は必要に応じて追加
  } catch (error) {
    console.error('Service Worker: Background sync failed:', error);
  }
}

// Service Worker エラーハンドリング
self.addEventListener('error', (event) => {
  console.error('Service Worker: Error occurred:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker: Unhandled promise rejection:', event.reason);
});