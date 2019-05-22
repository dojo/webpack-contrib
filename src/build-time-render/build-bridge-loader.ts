const loaderUtils = require('loader-utils');

module.exports = function(this: any, content: string) {
	if (this.cacheable) {
		this.cacheable();
	}
	const query = loaderUtils.getOptions(this) || {};
	const { modulePath, id } = query;
	const prefix = `var modulePath = ${modulePath};
var id = ${id};
`;
	content = content.replace('{{ REPLACE }}', `dojoBuildBridgeCache ${id}`);
	return prefix + content;
};
