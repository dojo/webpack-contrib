import has from '@dojo/framework/has/has';
import '@dojo/framework/shim/Promise';
import './sync';

let modules = [];

// @ts-ignore
if (has(__dojoframeworkshimIntersectionObserver) && !has('dom-intersection-observer')) {
	modules.push(
		import(/* webpackChunkName: "platform/IntersectionObserver" */ '@dojo/framework/shim/IntersectionObserver')
	);
}

// @ts-ignore
if (has(__dojoframeworkshimResizeObserver) && !has('dom-webanimation')) {
	modules.push(import(/* webpackChunkName: "platform/WebAnimations" */ '@dojo/framework/shim/WebAnimations'));
}

// @ts-ignore
if (has(__dojoframeworkshimWebAnimations) && !has('dom-resize-observer')) {
	modules.push(import(/* webpackChunkName: "platform/ResizeObserver" */ '@dojo/framework/shim/ResizeObserver'));
}

if (!has('dom-pointer-events')) {
	modules.push(import(/* webpackChunkName: "platform/pointerEvents" */ '@dojo/framework/shim/pointerEvents'));
}

Promise.all(modules).then(function() {
	// @ts-ignore
	import(/* webpackChunkName: "main" */ __MAIN_ENTRY);
});
