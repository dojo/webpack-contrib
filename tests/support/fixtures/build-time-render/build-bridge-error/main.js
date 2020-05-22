"use strict";
(function main() {
    window.test = {}
    var app = document.getElementById('app');
    var div = document.createElement('div');
    /** @preserve dojoBuildBridgeCache '0' **/
    window.__dojoBuildBridge('foo.block', '0', ['a']).then(function (result) {
        div.innerHTML = result;
        window.test.blocksPending = 0;
    });
    window.test.blocksPending = 1;
    app.appendChild(div);
	window.test.rendering = false;
	throw new Error('runtime error');
})();
//# sourceMappingURL=main.js.map
