// Bump this value whenever app-shell files change. The cache-first fetch
// strategy otherwise continues serving an older HTML/JavaScript bundle.
const CACHE_NAME = "spendly-v7";

const FILES_TO_CACHE = [
"./",
"./index.html",
"./style.css",
"./script.js",
"./firebase-config.js",
"./manifest.json",
"./icons/app-icon.png",
"./favicon.svg"
];

self.addEventListener("install", function (event) {
event.waitUntil(
caches.open(CACHE_NAME)
.then(function (cache) {
return cache.addAll(FILES_TO_CACHE);
})
);

self.skipWaiting();

});

self.addEventListener("activate", function (event) {
event.waitUntil(
caches.keys()
.then(function (cacheNames) {
return Promise.all(
cacheNames
.filter(function (name) {
return name !== CACHE_NAME;
})
.map(function (name) {
return caches.delete(name);
})
);
})
);

self.clients.claim();

});

self.addEventListener("fetch", function (event) {
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
