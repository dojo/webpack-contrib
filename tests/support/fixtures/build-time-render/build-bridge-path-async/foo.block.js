let paths = [];
module.exports = {
	default(...args) {
		return new Promise(resolve => {
			paths.push('foo');
			resolve(`hello world ${args[0]}`);
		});
	},
	paths() {
		return paths;
	}
}
