const loaderUtils = require('loader-utils');
const SourceNode = require('source-map').SourceNode;
const SourceMapConsumer = require('source-map').SourceMapConsumer;

module.exports = function(this: any, content: string) {
	if (this.cacheable) {
		this.cacheable();
	}

	const query = loaderUtils.getOptions(this) || {};
	const imports: string[] = [];

	Object.keys(query).forEach(function(name) {
		let value;
		if (typeof query[name] === 'string' && query[name].substr(0, 1) === '>') {
			value = query[name].substr(1);
		}
		imports.push('var ' + name + ' = ' + value + ';');
	});

	const prefix = imports.join('\n') + '\n\n';
	const modulePath = query.modulePath.substr(1);
	content = content.replace('{{ REPLACE }}', `build-bridge-cache ${modulePath}`);
	return prefix + content;
};
