'use strict';

self.addEventListener('install', (event) => {
    console.info('install', event);
    
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    console.info('activate', event);
    
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    console.info('fetch', event);
});

self.addEventListener('push', (event) => {
    console.info('push2', event);
    //console.info("data" ,event.data.text());
    var data = {};
    if(event.data){
        data = JSON.parse(event.data.text());
    }
    const message = data.message ? data.message : '(・∀・)';
    
    event.waitUntil(
        self.registration.showNotification('yy Push Notification Title', {
            body: message,
            icon: 'https://kanatapple.github.io/service-worker/push/images/image.jpg',
            tag: 'push-notification-tag',
            vibrate: [400,100,400], // ミリ秒単位で振動と休止の時間を交互に任意の回数だけ配列に格納
            data: {
                link_to: data.link_to
            }
        })
    );
});

self.addEventListener("notificationclick", function(event) {
    console.info("click");
  event.notification.close();
  clients.openWindow("/");
}, false);
