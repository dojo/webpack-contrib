window.blockCacheEntry = function (modulePath, args, content) {
    window.__dojoBuildBridgeCache = window.__dojoBuildBridgeCache || {};
    window.__dojoBuildBridgeCache[modulePath] = window.__dojoBuildBridgeCache[modulePath] || {};
    window.__dojoBuildBridgeCache[modulePath][args] = function() {
        return content;
    }
};
/** @preserve APPEND_BLOCK_CACHE_ENTRY **/ 
