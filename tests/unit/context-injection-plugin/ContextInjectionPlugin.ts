import ContextInjectionPlugin, {
	GroupedImportsDependency,
	TsImportDependency,
	TsImportDependencyTemplate
} from '../../../src/context-injection-plugin/ContextInjectionPlugin';
import { spy, stub } from 'sinon';
import { createContext, runInContext } from 'vm';

const Compiler = require('../../support/webpack/Compiler');
const Compilation = require('../../support/webpack/Compilation');
const CompilationParams = require('../../support/webpack/CompilationParams');
const NormalModule = require('../../support/webpack/NormalModule');
const ReplaceSource = require('../../support/webpack/ReplaceSource');

const { assert } = intern.getPlugin('chai');
const { beforeEach, describe, it } = intern.getInterface('bdd');

function createContextMap(...contexts: string[]) {
	return contexts.reduce((map: { [id: number]: string; }, context: string, i: number) => {
		map[i] = context.lastIndexOf('/') === context.length - 1 ? context : context + '/';
		return map;
	}, Object.create(null));
}

describe('ContextInjectionPlugin', () => {
	describe('TsImportDependencyTemplate', () => {
		it('registers the module id', () => {
			const source: any = {};
			const dep: any = {
				registerId: spy(),
				replaceSource: spy()
			};

			const template = new TsImportDependencyTemplate();
			template.apply(dep, source);

			assert.sameMembers(dep.registerId.firstCall.args, [ undefined ]);
			assert.isTrue(dep.replaceSource.calledWith(source));

			dep.module = { id: 42 };
			template.apply(dep, source);

			assert.sameMembers(dep.registerId.secondCall.args, [ 42 ]);
		});
	});

	describe('TsImportDependency', () => {
		const context = '/path/to/context';
		let dep: TsImportDependency;
		let group: GroupedImportsDependency;

		beforeEach(() => {
			group = new GroupedImportsDependency([ context ]);
			dep = new TsImportDependency({ context, group });
		});

		it('registers a module ID with the parent group', () => {
			const id = 42;
			stub(group, 'setContextRequireId');
			dep.registerId(id);
			assert.isTrue((<any> group.setContextRequireId).calledWith(context, id));
		});

		it('delegates source replacement to the parent group', () => {
			const source: any = {};
			stub(group, 'replaceSourceRequire');
			dep.replaceSource(source);
			assert.isTrue((<any> group.replaceSourceRequire).calledWith(source));
		});
	});

	describe('GroupedImportsDependency', () => {
		const context1 = './context1';
		const context2 = './context2';

		describe('addModuleDependencies', () => {
			it('should add its dependencies to the specified module', () => {
				const group = new GroupedImportsDependency([ context1, context2 ]);
				const module = new NormalModule();
				group.addModuleDependencies(module);

				assert.lengthOf(module.dependencies, 2, 'Each dependency should be added.');

				module.dependencies.forEach((dependency: TsImportDependency, i: number) => {
					assert.instanceOf(dependency, TsImportDependency);
					assert.strictEqual(dependency.context, group.contexts[i]);
				});
			});
		});

		describe('replaceSourceRequire', () => {
			const template = 'require([ mid ], resolve, reject)';

			it('should replace the require call with a custom loader', () => {
				const group = new GroupedImportsDependency([ context1, context2 ]);
				const source = new ReplaceSource(template);

				group.addRange([ 0, template.length ]);
				group.replaceSourceRequire(source);

				const replaced = '__dynamicImport__(mid, resolve, reject)';
				assert.sameDeepMembers(source.replacements, [ [ 0, template.length - 1, replaced ] ]);
			});

			it('should replace the source only once', () => {
				const group = new GroupedImportsDependency([ context1, context2 ]);
				const source = new ReplaceSource(template);

				group.addRange([ 0, template.length ]);
				group.replaceSourceRequire(source);
				group.replaceSourceRequire(source);
				group.replaceSourceRequire(source);
				group.replaceSourceRequire(source);

				assert.lengthOf(source.replacements, 1);
			});

			it('should not operate on the source without range', () => {
				const group = new GroupedImportsDependency([ context1, context2 ]);
				const source = new ReplaceSource(template);

				group.replaceSourceRequire(source);

				assert.lengthOf(source.replacements, 0);
			});
		});

		describe('loaderTemplate', () => {
			it('should replace tokens with the context ID map', () => {
				const group = new GroupedImportsDependency([ context1, context2 ]);
				group.setContextRequireId(context1, 0);
				group.setContextRequireId(context2, 1);

				const template = group.loaderTemplate;
				const map = createContextMap(context1, context2);

				assert.isAbove(template.indexOf('var webpackRequire = __webpack_require__;'), -1);
				assert.isAbove(template.indexOf(`var contextsById = ${JSON.stringify(map)};`), -1);
			});

			it('should match mids to contexts', () => {
				const group = new GroupedImportsDependency([ context1, context2 ]);
				group.setContextRequireId(context1, 0);
				group.setContextRequireId(context2, 1);

				const js = `${group.loaderTemplate}__dynamicImport__('./context1/main')`;
				const contextRequire = stub();
				const webpackRequire = stub().returns(contextRequire);
				const context: any = createContext({
					__webpack_require__: webpackRequire
				});

				runInContext(js, context);

				assert.isTrue(webpackRequire.calledWith(0));
				assert.isTrue(contextRequire.calledWith('./main'));
			});

			it('should call the provided resolver', () => {
				const group = new GroupedImportsDependency([ context1, context2 ]);
				group.setContextRequireId(context1, 0);
				group.setContextRequireId(context2, 1);

				const js = `${group.loaderTemplate}__dynamicImport__('./context1/main', resolve)`;
				const module = {};
				const contextRequire = stub().returns(module);
				const webpackRequire = stub().returns(contextRequire);
				const resolve = stub();
				const context: any = createContext({
					resolve,
					__webpack_require__: webpackRequire
				});

				runInContext(js, context);

				assert.isTrue(resolve.calledWith(module));
			});

			it('should throw when called with an unknown context', () => {
				const group = new GroupedImportsDependency([ context1, context2 ]);
				group.setContextRequireId(context1, 0);
				group.setContextRequireId(context2, 1);

				const js = `${group.loaderTemplate}__dynamicImport__('./context42/main')`;
				const contextRequire = stub();
				const webpackRequire = stub().returns(contextRequire);
				const context: any = createContext({
					__webpack_require__: webpackRequire
				});

				assert.throws(() => {
					runInContext(js, context);
				});
			});

			it('should reject with the provided rejector', () => {
				const group = new GroupedImportsDependency([ context1, context2 ]);
				group.setContextRequireId(context1, 0);
				group.setContextRequireId(context2, 1);

				const js = `${group.loaderTemplate}__dynamicImport__('./context42/main', resolve, reject)`;
				const contextRequire = stub();
				const webpackRequire = stub().returns(contextRequire);
				const resolve = stub();
				const reject = stub();
				const context: any = createContext({
					reject,
					resolve,
					__webpack_require__: webpackRequire
				});

				runInContext(js, context);
				assert.isTrue(reject.calledOnce);
				assert.strictEqual(reject.firstCall.args[0].message, 'Missing module: ./context42/main');
				assert.isFalse(resolve.called, 'resolve should not be called');
			});

			it('should call the provided rejector when the context require throws', () => {
				const group = new GroupedImportsDependency([ context1, context2 ]);
				group.setContextRequireId(context1, 0);
				group.setContextRequireId(context2, 1);

				const js = `${group.loaderTemplate}__dynamicImport__('./context1/main', resolve, reject)`;
				const contextRequire = stub().throws();
				const webpackRequire = stub().returns(contextRequire);
				const resolve = stub();
				const reject = stub();
				const context: any = createContext({
					reject,
					resolve,
					__webpack_require__: webpackRequire
				});

				runInContext(js, context);
				assert.isTrue(reject.calledOnce);
				assert.isFalse(resolve.called, 'resolve should not be called');
			});
		});
	});

	describe('ContextInjectionPlugin', () => {
		const contexts = [ 'context1', 'context2/' ];
		const mid = 'inject/site';
		const template = 'require([ mid ], resolve, reject)';

		function applyPlugin(plugin: ContextInjectionPlugin, mid?: string, expr?: any) {
			const compiler = new Compiler();
			const compilation = new Compilation();
			const params = new CompilationParams();
			const { parser } = params;
			const { moduleTemplate } = compilation;

			const group = plugin.group;
			contexts.forEach((context, i) => {
				group.setContextRequireId(context, i);
			});

			plugin.apply(compiler);
			compiler.mockApply('compilation', compilation);

			compiler.mockApply('compilation', compilation, params);
			params.normalModuleFactory.mockApply('parser', parser);

			const module = new NormalModule(mid, mid, mid, undefined, mid, parser);
			parser.state.current = module;
			parser.mockApply('call require', expr || {
				range: [ 0, template.length ],
				arguments: [
					{ type: 'Identifier' }
				]
			});

			const source = new ReplaceSource(template);

			const [ result ] = moduleTemplate.mockApply('module', source, module);
			return result;
		}

		it('should convert the mid to a regular expression', () => {
			let plugin = new ContextInjectionPlugin({ contexts, mid });
			assert.strictEqual(plugin.mid.toString(), '/inject\\/site/');

			const pattern = /inject\/site/;
			plugin = new ContextInjectionPlugin({
				contexts,
				mid: pattern
			});
			assert.strictEqual(plugin.mid, pattern);
		});

		it('should inject the context id map into the specified module', () => {
			const plugin = new ContextInjectionPlugin({
				mid,
				contexts
			});

			const { group } = plugin;
			const source = applyPlugin(plugin, mid);
			const map = createContextMap(...contexts);

			assert.strictEqual(source.source().indexOf(group.loaderTemplate), 0);
			assert.isAbove(group.loaderTemplate.indexOf(`var contextsById = ${JSON.stringify(map)}`), -1);
		});

		it('should inject only into the specified module', () => {
			const plugin = new ContextInjectionPlugin({
				mid,
				contexts
			});

			const { group } = plugin;
			const source = applyPlugin(plugin);

			assert.strictEqual(source.source().indexOf(group.loaderTemplate), -1);
		});

		it('should allow AMD-style requires', () => {
			const plugin = new ContextInjectionPlugin({
				mid,
				contexts
			});

			const { group } = plugin;
			const source = applyPlugin(plugin, mid, {
				expr: [ 0, template.length ],
				arguments: [
					{
						type: 'ArrayExpression',
						elements: [ { type: 'Identifier' } ]
					}
				]
			});
			const map = createContextMap(...contexts);

			assert.strictEqual(source.source().indexOf(group.loaderTemplate), 0);
			assert.isAbove(group.loaderTemplate.indexOf(`var contextsById = ${JSON.stringify(map)}`), -1);
		});

		it('should ignore normal requires', () => {
			const plugin = new ContextInjectionPlugin({
				mid,
				contexts
			});

			const { group } = plugin;
			const source = applyPlugin(plugin, mid, {
				expr: [ 0, template.length ],
				arguments: [
					{ type: 'Literal' }
				]
			});
			const map = createContextMap(...contexts);

			assert.strictEqual(source.source().indexOf(group.loaderTemplate), 0);
			assert.isAbove(group.loaderTemplate.indexOf(`var contextsById = ${JSON.stringify(map)}`), -1);
		});

		it('should ignore empty AMD requires', () => {
			const plugin = new ContextInjectionPlugin({
				mid,
				contexts
			});

			const { group } = plugin;
			const source = applyPlugin(plugin, mid, {
				expr: [ 0, template.length ],
				arguments: [
					{
						type: 'ArrayExpression',
						elements: []
					}
				]
			});
			const map = createContextMap(...contexts);

			assert.strictEqual(source.source().indexOf(group.loaderTemplate), 0);
			assert.isAbove(group.loaderTemplate.indexOf(`var contextsById = ${JSON.stringify(map)}`), -1);
		});

		it('should ignore AMD requires with string mids', () => {
			const plugin = new ContextInjectionPlugin({
				mid,
				contexts
			});

			const { group } = plugin;
			const source = applyPlugin(plugin, mid, {
				expr: [ 0, template.length ],
				arguments: [
					{
						type: 'ArrayExpression',
						elements: [ { type: 'Literal' } ]
					}
				]
			});
			const map = createContextMap(...contexts);

			assert.strictEqual(source.source().indexOf(group.loaderTemplate), 0);
			assert.isAbove(group.loaderTemplate.indexOf(`var contextsById = ${JSON.stringify(map)}`), -1);
		});
	});
});
