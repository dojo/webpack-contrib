// tslint:disable-next-line
var has = require('@dojo/framework/has/has'),
	globals = require('@dojo/framework/shim/global');

if (!has.exists('build-time-render')) {
	has.add('build-time-render', false, false);
}

if (globals.default.__public_path__) {
	// @ts-ignore
	__webpack_public_path__ = globals.default.__public_path__;
}
