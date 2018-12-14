var has = require('@dojo/framework/has/has');
require('./common');

if (has.default('build-serve')) {
	require('webpack-hot-middleware/client?reload=true');
}
