var has = require('@dojo/framework/has/has');
require('./common');

if (has.default('build-serve')) {
	require('../webpack-hot-client/client');
}

if (has.default(__dojoBuildBlocks)) {
	require('../build-time-render/blocks');
}
