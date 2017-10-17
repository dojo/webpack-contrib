import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';

registerSuite({
	name: 'index',
	'exists'() {
		const loader = require('intern/browser_modules/dojo/node!../../../src/static-build-loader/index');
		assert(loader);
	}

});
