import has from '@dojo/framework/has/has';
import global from '@dojo/framework/shim/global';

export default function () {
	var args = Array.prototype.slice.call(arguments);
	/** @preserve {{ REPLACE }} **/
	if (has('build-time-render') && global.__dojoBuildBridge) {
		return global.__dojoBuildBridge(modulePath, args);
	}
	else {
		var stringifiedArgs = JSON.stringify(args);
		if (global.__dojoBuildBridgeCache &&
			global.__dojoBuildBridgeCache[modulePath] &&
			global.__dojoBuildBridgeCache[modulePath][stringifiedArgs]
		) {
			return global.__dojoBuildBridgeCache[modulePath][stringifiedArgs]();
		}
		return undefined;
	}
}
