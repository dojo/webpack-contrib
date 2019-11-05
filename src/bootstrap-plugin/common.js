var has = require('@dojo/framework/core/has');
var global = require('@dojo/framework/shim/global');

var scope = typeof __DOJO_SCOPE === 'string' ? __DOJO_SCOPE : undefined;

if (scope && !global.default[scope]) {
	global.default[scope] = {};
}

if (!has.exists('build-time-render')) {
	has.add('build-time-render', false, false);
}

if (!has.exists('build-serve')) {
	has.add('build-serve', false, false);
}

var appBase = scope && global.default[scope].base ? global.default[scope].base : global.default.__app_base__;

var initialPublicPath =
	scope && global.default[scope].publicPath ? global.default[scope].publicPath : global.default.__public_path__;

var initialPublicOrigin =
	scope && global.default[scope].publicOrigin ? global.default[scope].publicOrigin : global.default.__public_origin__;

has.add('app-base', appBase || '/', true);

if (initialPublicPath || initialPublicOrigin) {
	var publicPath = initialPublicOrigin || window.location.origin;
	if (initialPublicPath) {
		publicPath = publicPath + initialPublicPath;
		has.add('public-path', initialPublicPath, true);
	}
	__webpack_public_path__ = publicPath;
}
