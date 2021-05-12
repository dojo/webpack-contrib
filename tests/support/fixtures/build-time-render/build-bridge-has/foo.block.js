var has = require('@dojo/framework/core/has').default;

module.exports = {
	default(...args) {
		if (has('foo')) {
			return `hello foo world ${args[0]}`;
		}
		return `hello world ${args[0]}`;
	}
}
