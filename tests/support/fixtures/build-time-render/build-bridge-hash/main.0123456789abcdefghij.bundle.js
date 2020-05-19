"use strict";
(function main() {
    window.test = {}
    var app = document.getElementById('app');
    var div = document.createElement('div');
    /** @preserve dojoBuildBridgeCache 'foo.block' **/
    window.__dojoBuildBridge('foo.block', ['a']).then(function (result) {
        div.innerHTML = result;
        window.test.blocksPending = 0;
    });
    window.test.blocksPending = 1;
    app.appendChild(div);
	window.test.rendering = false;
})();
//# sourceMappingURL=main.0123456789abcdefghij.bundle.js.map
