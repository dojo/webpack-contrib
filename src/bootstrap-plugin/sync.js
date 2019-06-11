var has = require('@dojo/framework/core/has');
require('./common');

if (has.default('build-serve')) {
	require('../webpack-hot-client/client');
}

require('../build-time-render/blocks');
