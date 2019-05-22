import has from '@dojo/framework/has/has';
import global from '@dojo/framework/shim/global';

export default function () {
	var args = Array.prototype.slice.call(arguments);
	/** @preserve {{ REPLACE }} **/
	if (has('build-time-render') && global.__dojoBuildBridge) {
		return global.__dojoBuildBridge(modulePath, id, args);
	}
	else {
		var stringifiedArgs = JSON.stringify(args);
		if (global.__dojoBuildBridgeCache &&
			global.__dojoBuildBridgeCache[id] &&
			global.__dojoBuildBridgeCache[id][stringifiedArgs]
		) {
			return global.__dojoBuildBridgeCache[id][stringifiedArgs];
		}
		return undefined;
	}
}
