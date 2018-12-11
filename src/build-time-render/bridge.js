import has from '@dojo/framework/has/has';
import global from '@dojo/framework/shim/global';

export default (...args) => {
	/** @preserve {{ REPLACE }} **/
	if (has('build-time-render') && global.__dojoBuildBridge) {
		return global.__dojoBuildBridge(modulePath, args);
	}
	else {
		return global.__dojoBuildBridgeCache[modulePath][JSON.stringify(args)];
	}
}
