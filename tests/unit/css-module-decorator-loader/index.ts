import * as loader from '../../../src/css-module-decorator-loader/index';

const { registerSuite } = intern.getInterface('object');
const { assert } = intern.getPlugin('chai');

registerSuite('css-module-decorator-loader index', {
	'exists'() {
		assert(loader);
	}
});
