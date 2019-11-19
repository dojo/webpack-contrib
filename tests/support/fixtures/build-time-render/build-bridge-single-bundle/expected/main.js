"use strict";
window.blockCacheEntry = function (modulePath, args, content) {
    window.__dojoBuildBridgeCache = window.__dojoBuildBridgeCache || {};
    window.__dojoBuildBridgeCache[modulePath] = window.__dojoBuildBridgeCache[modulePath] || {};
    window.__dojoBuildBridgeCache[modulePath][args] = function () {
        return content;
    };
};
/** @preserve APPEND_BLOCK_CACHE_ENTRY **/ blockCacheEntry('foo.block', '["a"]', "hello world a");
(function main() {
    var app = document.getElementById('app');
    var div = document.createElement('div');
    /** @preserve dojoBuildBridgeCache 'foo.block' **/
    window.__dojoBuildBridge('foo.block', ['a']).then(function (result) {
        div.innerHTML = result;
    });
    app.appendChild(div);
	window.test = {
		rendering: false
	}
})();
//# sourceMappingURL=main.js.map
