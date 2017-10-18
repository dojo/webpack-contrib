import * as plugin from '../../../src/external-loader-plugin/index';

const { registerSuite } = intern.getInterface('object');
const { assert } = intern.getPlugin('chai');

registerSuite('external-loader-plugin index', {
	'exists'() {
		assert(plugin);
	}
});
