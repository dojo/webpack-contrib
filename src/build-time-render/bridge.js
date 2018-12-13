import has from '@dojo/framework/has/has';
import global from '@dojo/framework/shim/global';

export default function () {
	var args = Array.prototype.slice.call(arguments);
	/** @preserve {{ REPLACE }} **/
	if (has('build-time-render') && global.__dojoBuildBridge) {
		return global.__dojoBuildBridge(modulePath, args);
	}
	else {
		return global.__dojoBuildBridgeCache[modulePath][JSON.stringify(args)];
	}
}
