var has = require('@dojo/framework/core/has');
require('./common');
require('../cldr-loader/bootstrap');

if (has.default('build-serve')) {
	`has('dojo-debug')`;
	require('eventsource-polyfill');
	`has('dojo-debug')`;
	require('../webpack-hot-client/client');
}

require('../build-time-render/blocks-sync');
