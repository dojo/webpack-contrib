import * as path from 'path';
import { stub } from 'sinon';
import { Compiler } from 'webpack';
import { EmitAllPluginOptions } from '../../../src/emit-all-plugin/EmitAllPlugin';
import MockModule from '../../support/MockModule';
import { createCompilation, createCompiler } from '../../support/util';

const { assert } = intern.getPlugin('chai');
const { afterEach, beforeEach, describe, it } = intern.getInterface('bdd');

describe('EmitAllPlugin', () => {
	let compiler: Compiler;
	let mockModule: MockModule;

	beforeEach(() => {
		mockModule = new MockModule('../../../src/emit-all-plugin/EmitAllPlugin', require);
		mockModule.dependencies(['cssnano']);
		mockModule.getMock('cssnano').ctor.process = stub().callsFake((css: string) => Promise.resolve({ css }));
		compiler = createCompiler();
	});

	afterEach(() => {
		mockModule.destroy();
	});

	it('prevents webpack from emitting a bundle', () => {
		const EmitAll = mockModule.getModuleUnderTest().default;
		const emitAll = new EmitAll();
		const compilation = createCompilation(compiler);

		emitAll.apply(compiler);
		compilation.chunks = [{}];
		compiler.hooks.emit.callAsync(compilation, () => {});

		assert.deepEqual(compilation.chunks, []);
	});

	it('prevents webpack from emitting assets based on a filter', () => {
		const EmitAll = mockModule.getModuleUnderTest().default;
		const emitAll = new EmitAll({
			assetFilter: (key: string) => key !== 'foo'
		});
		const compilation = createCompilation(compiler);

		compilation.assets = {
			foo: {},
			bar: {},
			baz: {}
		};
		emitAll.apply(compiler);
		compiler.hooks.emit.callAsync(compilation, () => {});

		assert.deepEqual(compilation.assets, {
			bar: {},
			baz: {}
		});
	});

	it('emits all assets by default', () => {
		const EmitAll = mockModule.getModuleUnderTest().default;
		const emitAll = new EmitAll();
		const compilation = createCompilation(compiler);
		const assets = {
			foo: {},
			bar: {},
			baz: {}
		};

		compilation.assets = assets;
		emitAll.apply(compiler);
		compiler.hooks.emit.callAsync(compilation, () => {});

		assert.deepEqual(compilation.assets, assets);
	});

	describe('JavaScript assets', () => {
		it('outputs individual mjs files', () => {
			const EmitAll = mockModule.getModuleUnderTest().default;
			const emitAll = new EmitAll({
				basePath: 'src/'
			});
			const compilation = createCompilation(compiler);
			const source = 'module.exports = {}';
			const jsModule = {
				resource: 'src/dir/asset.ts',
				originalSource: () => ({
					source: () => source
				})
			};

			compilation.modules = [jsModule];
			emitAll.apply(compiler);
			compiler.hooks.emit.callAsync(compilation, () => {});

			const asset = compilation.assets['dir/asset.mjs'];
			assert.isObject(asset);
			assert.strictEqual(asset.source(), source);
			assert.strictEqual(asset.size(), Buffer.byteLength(source));
		});

		it('outputs JS files with the `.js` extension in legacy mode', () => {
			const EmitAll = mockModule.getModuleUnderTest().default;
			const emitAll = new EmitAll({
				basePath: 'src/',
				legacy: true
			});
			const compilation = createCompilation(compiler);
			const source = 'module.exports = {}';
			const jsModule = {
				resource: 'src/dir/asset.ts',
				originalSource: () => ({
					source: () => source
				})
			};

			compilation.modules = [jsModule];
			emitAll.apply(compiler);
			compiler.hooks.emit.callAsync(compilation, () => {});

			const asset = compilation.assets['dir/asset.js'];
			assert.isObject(asset);
			assert.strictEqual(asset.source(), source);
			assert.strictEqual(asset.size(), Buffer.byteLength(source));
		});

		it('excludes files outside the base path', () => {
			const EmitAll = mockModule.getModuleUnderTest().default;
			const emitAll = new EmitAll({
				basePath: 'src/'
			});
			const compilation = createCompilation(compiler);
			const source = 'module.exports = {}';
			const jsModule = {
				resource: 'other/dir/asset.ts',
				originalSource: () => ({
					source: () => source
				})
			};

			compilation.modules = [jsModule];
			emitAll.apply(compiler);
			compiler.hooks.emit.callAsync(compilation, () => {});

			assert.deepEqual(Object.keys(compilation.assets), []);
		});

		it('ignores modules without a resource', () => {
			const EmitAll = mockModule.getModuleUnderTest().default;
			const emitAll = new EmitAll({
				basePath: 'src/'
			});
			const compilation = createCompilation(compiler);
			const source = 'module.exports = {}';
			const jsModule = {
				originalSource: () => ({
					source: () => source
				})
			};

			compilation.modules = [jsModule];
			emitAll.apply(compiler);
			compiler.hooks.emit.callAsync(compilation, () => {});

			assert.deepEqual(Object.keys(compilation.assets), []);
		});

		it('outputs JS sourcemaps', () => {
			const EmitAll = mockModule.getModuleUnderTest().default;
			const emitAll = new EmitAll({
				basePath: 'src/'
			});
			const compilation = createCompilation(compiler);
			const source = 'module.exports = {}';
			const jsModule = {
				resource: 'src/dir/asset.ts',
				originalSource: () => ({
					_sourceMap: { mappings: 'abcd' },
					source: () => source
				})
			};

			compilation.modules = [jsModule];
			emitAll.apply(compiler);
			compiler.hooks.emit.callAsync(compilation, () => {});

			const asset = compilation.assets['dir/asset.mjs'];
			const assetMap = compilation.assets['dir/asset.mjs.map'];
			const assetMapSource = {
				mappings: 'abcd',
				sources: []
			};
			const assetMapSourceString = JSON.stringify(assetMapSource);
			assert.isObject(assetMap);
			assert.strictEqual(assetMap.source(), assetMapSourceString);
			assert.strictEqual(assetMap.size(), Buffer.byteLength(assetMapSourceString));
			assert.isTrue(asset.source().endsWith('\n/*# sourceMappingURL=asset.mjs.map*/'));
		});

		it('inlines JS sourcemaps with a flag', () => {
			const EmitAll = mockModule.getModuleUnderTest().default;
			const emitAll = new EmitAll({
				basePath: 'src/',
				inlineSourceMaps: true
			});
			const compilation = createCompilation(compiler);
			const source = 'module.exports = {}';
			const sourceMap = { mappings: 'abcd', sources: [] };
			const jsModule = {
				resource: 'src/dir/asset.ts',
				originalSource: () => ({
					_sourceMap: sourceMap,
					source: () => source
				})
			};

			compilation.modules = [jsModule];
			emitAll.apply(compiler);
			compiler.hooks.emit.callAsync(compilation, () => {});

			const asset = compilation.assets['dir/asset.mjs'];
			const sourceMapUrl = `\n/*# sourceMappingURL=data:application/json;base64,${Buffer.from(
				JSON.stringify(sourceMap)
			).toString('base64')}*/`;
			assert.isTrue(asset.source().endsWith(sourceMapUrl));
			assert.isUndefined(compilation.assets['dir/asset.mjs.map']);
		});

		it('removes the base path from the source map sources', () => {
			const EmitAll = mockModule.getModuleUnderTest().default;
			const emitAll = new EmitAll({
				basePath: 'src/'
			});
			const compilation = createCompilation(compiler);
			const source = 'module.exports = {}';
			const sourceMap = {
				mappings: 'abcd',
				sources: ['src/dir/asset.ts']
			};
			const jsModule = {
				resource: 'src/dir/asset.ts',
				originalSource: () => ({
					_sourceMap: sourceMap,
					source: () => source
				})
			};

			compilation.modules = [jsModule];
			emitAll.apply(compiler);
			compiler.hooks.emit.callAsync(compilation, () => {});

			const assetMap = compilation.assets['dir/asset.mjs.map'];
			const assetMapSource = {
				mappings: 'abcd',
				sources: [path.relative('src/', 'src/dir/asset.ts')]
			};
			const assetMapSourceString = JSON.stringify(assetMapSource);
			assert.strictEqual(assetMap.source(), assetMapSourceString);
		});
	});

	describe('CSS assets', () => {
		function applyCssModule(cssModule: any, pluginOptions?: EmitAllPluginOptions): Promise<any> {
			const EmitAll = mockModule.getModuleUnderTest().default;
			const emitAll = new EmitAll({
				basePath: 'src/',
				...pluginOptions
			});

			const compilation = createCompilation(compiler);
			compilation.modules = [cssModule];
			emitAll.apply(compiler);

			return new Promise((resolve) => {
				compiler.hooks.emit.callAsync(compilation, () => {
					resolve(compilation);
				});
			});
		}

		it('outputs individual CSS files', () => {
			const source = '.root {}';
			const cssModule = {
				resource: 'src/dir/styles.css',
				originalSource: () => ({
					source: () => source
				}),
				dependencies: [
					{
						content: source,
						identifier: 'src/dir/styles.css'
					}
				]
			};

			return applyCssModule(cssModule).then((compilation) => {
				const asset = compilation.assets['dir/styles.css'];
				assert.isObject(asset);
				assert.strictEqual(asset.source(), source);
				assert.strictEqual(asset.size(), Buffer.byteLength(source));
			});
		});

		it('excludes files outside the base path', () => {
			const source = '.root {}';
			const cssModule = {
				resource: 'other/dir/styles.css',
				originalSource: () => ({
					source: () => source
				}),
				dependencies: [
					{
						content: source,
						identifier: 'other/dir/styles.css'
					}
				]
			};

			return applyCssModule(cssModule).then((compilation) => {
				assert.deepEqual(Object.keys(compilation.assets), []);
			});
		});

		it('ignores dependencies with a mismatched identifier', () => {
			const source = '.root {}';
			const cssModule = {
				resource: 'src/dir/styles.css',
				originalSource: () => ({
					source: () => source
				}),
				dependencies: [
					{
						content: source,
						identifier: 'src/other/asset.css'
					}
				]
			};

			return applyCssModule(cssModule).then((compilation) => {
				assert.deepEqual(Object.keys(compilation.assets), []);
			});
		});

		it('outputs CSS sourcemaps', () => {
			const source = '.root {}';
			const cssModule = {
				resource: 'src/dir/styles.css',
				originalSource: () => ({
					source: () => source
				}),
				dependencies: [
					{
						content: source,
						identifier: 'src/dir/styles.css',
						sourceMap: { mappings: 'abcd' }
					}
				]
			};

			return applyCssModule(cssModule).then((compilation) => {
				const asset = compilation.assets['dir/styles.css'];
				const assetMap = compilation.assets['dir/styles.css.map'];
				const assetMapSource = {
					mappings: 'abcd',
					sources: []
				};
				const assetMapSourceString = JSON.stringify(assetMapSource);
				assert.isObject(assetMap);
				assert.strictEqual(assetMap.source(), assetMapSourceString);
				assert.strictEqual(assetMap.size(), Buffer.byteLength(assetMapSourceString));
				assert.isTrue(asset.source().endsWith('\n/*# sourceMappingURL=styles.css.map*/'));
			});
		});

		it('inlines CSS sourcemaps with a flag', () => {
			const source = `module.exports = {}`;
			const sourceMap = { mappings: 'abcd', sources: [] };
			const cssModule = {
				resource: 'src/dir/styles.css',
				originalSource: () => ({
					source: () => source
				}),
				dependencies: [
					{
						content: source,
						identifier: 'src/dir/styles.css',
						sourceMap
					}
				]
			};

			return applyCssModule(cssModule, { inlineSourceMaps: true }).then((compilation) => {
				const asset = compilation.assets['dir/styles.css'];
				const sourceMapUrl = `\n/*# sourceMappingURL=data:application/json;base64,${Buffer.from(
					JSON.stringify(sourceMap)
				).toString('base64')}*/`;
				assert.isTrue(asset.source().endsWith(sourceMapUrl));
				assert.isUndefined(compilation.assets['dir/styles.css.map']);
			});
		});

		it('removes the base path from the source map sources', () => {
			const source = `module.exports = {}`;
			const sourceMap = {
				mappings: 'abcd',
				sources: ['src/dir/styles.css']
			};
			const cssModule = {
				resource: 'src/dir/styles.css',
				originalSource: () => ({
					source: () => source
				}),
				dependencies: [
					{
						content: source,
						identifier: 'src/dir/styles.css',
						sourceMap
					}
				]
			};

			return applyCssModule(cssModule).then((compilation) => {
				const assetMap = compilation.assets['dir/styles.css.map'];
				const assetMapSource = {
					mappings: 'abcd',
					sources: [path.relative('src/', 'src/dir/styles.css')]
				};
				const assetMapSourceString = JSON.stringify(assetMapSource);
				assert.strictEqual(assetMap.source(), assetMapSourceString);
			});
		});
	});
});
