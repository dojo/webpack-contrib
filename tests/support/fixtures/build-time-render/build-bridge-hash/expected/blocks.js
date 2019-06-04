window.blockCacheEntry = function (modulePath, args, hash) {
    window.__dojoBuildBridgeCache = window.__dojoBuildBridgeCache || {};
    window.__dojoBuildBridgeCache[modulePath] = window.__dojoBuildBridgeCache[modulePath] || {};
    window.__dojoBuildBridgeCache[modulePath][args] = function () {
        return __webpack_require__.e(hash).then(__webpack_require__.bind(null, hash + '.js')).then(function (module) {
			return module.default;
		});
    };
};
/** @preserve APPEND_BLOCK_CACHE_ENTRY **/
blockCacheEntry('foo.block', '["a"]', 'block-49e457933c3c36eeb77f')
