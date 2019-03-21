function buildBridgeCache(modulePath, args, value) {
	window.__dojoBuildBridgeCache = window.__dojoBuildBridgeCache || {};
	window.__dojoBuildBridgeCache[modulePath] = window.__dojoBuildBridgeCache[modulePath] || {};
	window.__dojoBuildBridgeCache[modulePath][args] = value;
};
buildBridgeCache('foo.block','["a"]', "hello world a");
"use strict";
(function main() {
    var app = document.getElementById('app');
    var div = document.createElement('div');
    /** @preserve dojoBuildBridgeCache 'foo.block' **/
    window.__dojoBuildBridge('foo.block', ['a']).then(function (result) {
        div.innerHTML = result;
    });
    app.appendChild(div);
})();
//# sourceMappingURL=main.js.map
