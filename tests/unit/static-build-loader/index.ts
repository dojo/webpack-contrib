import * as loader from '../../../src/static-build-loader/index';

const { registerSuite } = intern.getInterface('object');
const { assert } = intern.getPlugin('chai');

registerSuite('static-build-loader index', {
	exists() {
		assert(loader);
	}
});
