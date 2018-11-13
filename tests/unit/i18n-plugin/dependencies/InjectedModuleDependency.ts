import ReplaceSource = require('webpack-sources/lib/ReplaceSource');
import InjectedModuleDependency from '../../../../src/i18n-plugin/dependencies/InjectedModuleDependency';

const { assert } = intern.getPlugin('chai');
const { describe, it } = intern.getInterface('bdd');

function getReplacement(source: ReplaceSource, position: number, content: string) {
	return {
		start: position,
		end: position - 1,
		content,
		insertIndex: source.replacements.length - 1,
		name: undefined
	};
}

describe('InjectedModuleDependency', () => {
	it('should inject the provided string into the source', () => {
		const source = new ReplaceSource('');
		const dep = new InjectedModuleDependency('/resource');
		const template = new InjectedModuleDependency.Template();
		const module = { id: 42 } as any;

		dep.module = module;
		template.apply(dep, source);

		assert.sameDeepMembers(source.replacements, [getReplacement(source, 0, '__webpack_require__(42);\n')]);
	});

	it('should assign the require to the specified variable', () => {
		const source = new ReplaceSource('');
		const dep = new InjectedModuleDependency('/resource');
		const template = new InjectedModuleDependency.Template();
		const module = { id: 42 } as any;

		dep.variable = 'answer';
		dep.module = module;
		template.apply(dep, source);

		assert.sameDeepMembers(source.replacements, [
			getReplacement(source, 0, 'var answer = __webpack_require__(42);\n')
		]);
	});

	it('should account for string mids', () => {
		const source = new ReplaceSource('');
		const dep = new InjectedModuleDependency('/resource');
		const template = new InjectedModuleDependency.Template();
		const id = '/path/to/module.js';
		const module = { id } as any;

		dep.variable = 'answer';
		dep.module = module;
		template.apply(dep, source);

		assert.sameDeepMembers(source.replacements, [
			getReplacement(source, 0, `var answer = __webpack_require__(${JSON.stringify(id)});\n`)
		]);
	});

	it('inject a missing module error without a module', () => {
		const source = new ReplaceSource('');
		const dep = new InjectedModuleDependency('/resource');
		const template = new InjectedModuleDependency.Template();

		template.apply(dep, source);

		const { content } = source.replacements[0];
		assert.include(content, 'function webpackMissingModule()');
	});
});
