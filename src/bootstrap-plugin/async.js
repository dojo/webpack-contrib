
__MAIN_CSS_ENTRY && import(/* webpackChunkName: "main" */ __MAIN_CSS_ENTRY);

var has = require('@dojo/framework/core/has');
var cldrLoader = require('../cldr/bootstrap').default;
require('./common');

var modules = [];

if (has.default('build-serve')) {
	modules.push(import(/* webpackChunkName: "runtime/client" */ 'eventsource-polyfill'));
	modules.push(import(/* webpackChunkName: "runtime/client" */ '../webpack-hot-client/client'));
}

if (has.default(__dojoBuildBlocks)) {
	modules.push(import(/* webpackChunkName: "runtime/blocks" */ '../build-time-render/blocks'));
}

if (has.default(__dojoframeworkshimIntersectionObserver) && !has.default('dom-intersection-observer')) {
	modules.push(
		import(/* webpackChunkName: "runtime/IntersectionObserver" */ '@dojo/framework/shim/IntersectionObserver')
	);
}

if (has.default(__dojoframeworkshimfetch) && !has.default('fetch')) {
	modules.push(import(/* webpackChunkName: "runtime/fetch" */ '@dojo/framework/shim/fetch'));
}

if (has.default(__dojoframeworkshimWebAnimations) && !has.default('dom-webanimation')) {
	modules.push(import(/* webpackChunkName: "runtime/WebAnimations" */ '@dojo/framework/shim/WebAnimations'));
}

if (has.default(__dojoframeworkshimResizeObserver) && !has.default('dom-resize-observer')) {
	modules.push(import(/* webpackChunkName: "runtime/ResizeObserver" */ '@dojo/framework/shim/ResizeObserver'));
}

if (has.default(__dojoframeworkshiminert) && !has.default('dom-inert')) {
	modules.push(import(/* webpackChunkName: "runtime/inert" */ '@dojo/framework/shim/inert'));
}

if (!has.default('dom-pointer-events')) {
	modules.push(import(/* webpackChunkName: "runtime/pointerEvents" */ '@dojo/framework/shim/pointerEvents'));
}

modules.push(cldrLoader);

module.exports = Promise.all(modules).then(function() {
	return import(/* webpackChunkName: "main" */ __MAIN_ENTRY);
});
