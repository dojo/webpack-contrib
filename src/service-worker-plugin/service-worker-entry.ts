import has from '@dojo/framework/has/has';
import global from '@dojo/framework/shim/global';

if ('serviceWorker' in global.navigator) {
	// tslint:disable-next-line
	var prefix = '';
	if (has('public-path')) {
		prefix = String(has('public-path')).replace(/\/$/, '') + '/';
	}
	global.addEventListener('load', function() {
		global.navigator.serviceWorker.register(prefix + 'service-worker.js');
	});
}
