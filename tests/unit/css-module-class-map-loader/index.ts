import * as loader from '../../../src/css-module-class-map-loader/index';

const { registerSuite } = intern.getInterface('object');
const { assert } = intern.getPlugin('chai');

registerSuite('css-module-class-map-loader index', {
	exists() {
		assert(loader);
	}
});
