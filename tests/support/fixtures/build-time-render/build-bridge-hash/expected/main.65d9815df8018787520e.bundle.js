window.__dojoBuildBridgeCache = window.__dojoBuildBridgeCache || {};window.__dojoBuildBridgeCache['foo.block'] = window.__dojoBuildBridgeCache['foo.block'] || {};window.__dojoBuildBridgeCache['foo.block']['["a"]'] = "hello world a";
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
//# sourceMappingURL=main.65d9815df8018787520e.bundle.js.map
