import has from '@dojo/framework/has/has';
import '@dojo/framework/shim/Promise';

var modules = [];

if (has('bootstrap-intersection-observer') && !has('dom-intersection-observer')) {
	modules.push(
		import(/* webpackChunkName: "platform/IntersectionObserver" */ '@dojo/framework/shim/IntersectionObserver')
	);
}

if (has('bootstrap-web-animations') && !has('dom-webanimation')) {
	modules.push(import(/* webpackChunkName: "platform/WebAnimations" */ '@dojo/framework/shim/WebAnimations'));
}

if (has('bootstrap-resize-observer') && !has('dom-resize-observer')) {
	modules.push(import(/* webpackChunkName: "platform/ResizeObserver" */ '@dojo/framework/shim/ResizeObserver'));
}

if (!has('dom-pointer-events')) {
	modules.push(import(/* webpackChunkName: "platform/pointerEvents" */ '@dojo/framework/shim/pointerEvents'));
}

Promise.all(modules).then(function() {
	import(/* webpackChunkName: "main" */ __MAIN_ENTRY);
});
