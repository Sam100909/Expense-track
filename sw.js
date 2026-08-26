// Bump this value whenever app-shell files change. The cache-first fetch
// strategy otherwise continues serving an older HTML/JavaScript bundle.
const CACHE_NAME = "expense-track-v60";

const FILES_TO_CACHE = [
"./",
"./index.html",
"./style.css?v=60",
"./script.js?v=60",
"./firebase-config.js",
"./manifest.json",
"./app-icon.png",
"./app-icon-512.png",
"./app-icon-192.png",
"./app-icon-maskable-512.png",
"./app-icon-maskable-192.png"
];

self.addEventListener("install", function (event) {
event.waitUntil(
caches.open(CACHE_NAME)
.then(function (cache) {
return cache.addAll(FILES_TO_CACHE);
})
.then(function () {
return self.skipWaiting();
})
);

});

self.addEventListener("message", function (event) {
if (event.data && event.data.type === "SKIP_WAITING") {
self.skipWaiting();
}
});

self.addEventListener("activate", function (event) {
event.waitUntil(
caches.keys()
.then(function (cacheNames) {
return Promise.all(
cacheNames
.filter(function (name) {
return name.startsWith("expense-track-v") && name !== CACHE_NAME;
})
.map(function (name) {
return caches.delete(name);
})
);
})
.then(function () {
return self.clients.claim();
})
);

});

self.addEventListener("fetch", function (event) {
const requestUrl = new URL(event.request.url);
const shouldPreferNetwork =
requestUrl.origin === self.location.origin &&
(
event.request.mode === "navigate" ||
event.request.destination === "script" ||
event.request.destination === "style"
);

if (shouldPreferNetwork) {
event.respondWith(
fetch(event.request)
.then(function (response) {
const copy = response.clone();
caches.open(CACHE_NAME).then(function (cache) {
cache.put(event.request, copy);
});
return response;
})
.catch(function () {
return caches.match(event.request)
.then(function (cachedResponse) {
return cachedResponse || caches.match("./index.html");
});
})
);
return;
}

event.respondWith(
caches.match(event.request)
.then(function (cachedResponse) {
if (cachedResponse) {
return cachedResponse;
}

            return fetch(event.request);
        })
);

});
