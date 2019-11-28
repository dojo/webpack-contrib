var has = require('@dojo/framework/core/has');
require('./common');

if (has.default('build-serve')) {
	`has('dojo-debug')`;
	require('eventsource-polyfill');
	`has('dojo-debug')`;
	require('../webpack-hot-client/client');
}

require('../build-time-render/blocks-sync');
