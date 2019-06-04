var has = require('@dojo/framework/has/has');
require('./common');

var modules = [];

if (has.default('build-serve')) {
	modules.push(import(/* webpackChunkName: "platform/client" */ '../webpack-hot-client/client'));
}

modules.push(import(/* webpackChunkName: "blocks" */ '../build-time-render/blocks'));

if (has.default(__dojoframeworkshimIntersectionObserver) && !has.default('dom-intersection-observer')) {
	modules.push(
		import(/* webpackChunkName: "platform/IntersectionObserver" */ '@dojo/framework/shim/IntersectionObserver')
	);
}

if (has.default(__dojoframeworkshimFetch) && !has.default('fetch')) {
	modules.push(import(/* webpackChunkName: "platform/fetch" */ '@dojo/framework/shim/fetch'));
}

if (has.default(__dojoframeworkshimWebAnimations) && !has.default('dom-webanimation')) {
	modules.push(import(/* webpackChunkName: "platform/WebAnimations" */ '@dojo/framework/shim/WebAnimations'));
}

if (has.default(__dojoframeworkshimResizeObserver) && !has.default('dom-resize-observer')) {
	modules.push(import(/* webpackChunkName: "platform/ResizeObserver" */ '@dojo/framework/shim/ResizeObserver'));
}

if (!has.default('dom-pointer-events')) {
	modules.push(import(/* webpackChunkName: "platform/pointerEvents" */ '@dojo/framework/shim/pointerEvents'));
}

Promise.all(modules).then(function() {
	import(/* webpackChunkName: "main" */ __MAIN_ENTRY);
});
