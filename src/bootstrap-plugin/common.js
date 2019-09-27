var has = require('@dojo/framework/core/has');
var global = require('@dojo/framework/shim/global');

if (!global.default[__DOJO_SCOPE]) {
	global.default[__DOJO_SCOPE] = {};
}

if (!has.exists('build-time-render')) {
	has.add('build-time-render', false, false);
}

if (!has.exists('build-serve')) {
	has.add('build-serve', false, false);
}

var appBase = global.default[__DOJO_SCOPE].base ? global.default[__DOJO_SCOPE].base : global.default.__app_base__;

var initialPublicPath = global.default[__DOJO_SCOPE].publicPath
	? global.default[__DOJO_SCOPE].publicPath
	: global.default.__public_path__;

var initialPublicOrigin = global.default[__DOJO_SCOPE].publicOrigin
	? global.default[__DOJO_SCOPE].publicOrigin
	: global.default.__public_origin__;

has.add('app-base', appBase || '/', true);

if (initialPublicPath || initialPublicOrigin) {
	var publicPath = initialPublicOrigin || window.location.origin;
	if (initialPublicPath) {
		publicPath = publicPath + initialPublicPath;
		has.add('public-path', initialPublicPath, true);
	}
	__webpack_public_path__ = publicPath;
}
