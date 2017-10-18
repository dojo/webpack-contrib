import * as loader from '../../../src/css-module-dts-loader/index';

const { registerSuite } = intern.getInterface('object');
const { assert } = intern.getPlugin('chai');

registerSuite('css-module-dts-loader index', {
	'exists'() {
		assert(loader);
	}
});
