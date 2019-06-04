const loaderUtils = require('loader-utils');

module.exports = function(this: any, content: string) {
	if (this.cacheable) {
		this.cacheable();
	}
	const query = loaderUtils.getOptions(this) || {};
	const { modulePath } = query;
	const prefix = `var modulePath = ${modulePath};
`;
	return prefix + content;
};
