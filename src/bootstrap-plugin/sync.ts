import { exists, add } from '@dojo/framework/has/has';
import global from '@dojo/framework/shim/global';

if (!exists('build-time-render')) {
	add('build-time-render', false, false);
}

if (global.default.__public_path__) {
	// @ts-ignore
	__webpack_public_path__ = window.location.origin + global.default.__public_path__;
	add('public-path', global.default.__public_path__, true);
}
