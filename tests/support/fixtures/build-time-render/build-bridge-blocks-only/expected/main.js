function buildBridgeCache(id, args, value) {
	window.__dojoBuildBridgeCache = window.__dojoBuildBridgeCache || {};
	window.__dojoBuildBridgeCache[id] = window.__dojoBuildBridgeCache[id] || {};
	window.__dojoBuildBridgeCache[id][args] = value;
};
buildBridgeCache('0','["a"]', "hello world a");
"use strict";
(function main() {
    var app = document.getElementById('app');
    var div = document.createElement('div');
    /** @preserve dojoBuildBridgeCache '0' **/
    window.__dojoBuildBridge('foo.block', '0', ['a']).then(function (result) {
        div.innerHTML = result;
    });
    app.appendChild(div);
})();
//# sourceMappingURL=main.js.map
