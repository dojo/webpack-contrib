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
		mockModule.dependencies(['cssnano', 'fs', 'typescript']);
		mockModule.getMock('cssnano').ctor.process = stub().callsFake((css: string) => Promise.resolve({ css }));
		mockModule.getMock('typescript').visitNode = stub().callsFake((node, visit) => visit(node));
		const mockFs = mockModule.getMock('fs');
		mockFs.existsSync = stub().returns(true);
		mockFs.readFileSync = stub().returns('');
		compiler = createCompiler();
	});

	afterEach(() => {
		mockModule.destroy();
	});

	describe('plugin', () => {
		it('prevents webpack from emitting a bundle', () => {
			const factory = mockModule.getModuleUnderTest().emitAllFactory;
			const emitAll = factory().plugin;
			const compilation = createCompilation(compiler);

			emitAll.apply(compiler);
			compilation.chunks = [{}];
			compiler.hooks.emit.callAsync(compilation, () => {});

			assert.deepEqual(compilation.chunks, []);
		});

		it('prevents webpack from emitting assets based on a filter', () => {
			const factory = mockModule.getModuleUnderTest().emitAllFactory;
			const emitAll = factory({
				assetFilter: (key: string) => key !== 'foo'
			}).plugin;
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
			const factory = mockModule.getModuleUnderTest().emitAllFactory;
			const emitAll = factory().plugin;
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
			const applyPlugin = (
				file: string,
				source: string,
				sourceMap?: { mappings: string; sources: string[] },
				options: EmitAllPluginOptions = {}
			) => {
				file = file.replace(/\//g, path.sep);
				options.basePath = options.basePath || `src${path.sep}`;

				const factory = mockModule.getModuleUnderTest().emitAllFactory;
				const emitAll = factory(options).plugin;
				const compilation = createCompilation(compiler);
				const jsModule = {
					resource: file,
					originalSource: () => ({
						_sourceMap: sourceMap,
						source: () => source
					})
				};

				compilation.modules = [jsModule];
				emitAll.apply(compiler);
				compiler.hooks.emit.callAsync(compilation, () => {});

				const assetName = file.replace(options.basePath, '').replace(/\..*$/, options.legacy ? '.js' : '.mjs');
				const asset = compilation.assets[assetName];
				const assetSourceMap = sourceMap && compilation.assets[`${assetName}.map`];

				return { asset, compilation, assetSourceMap };
			};

			it('outputs individual mjs files for .ts files', () => {
				const source = 'module.exports = {}';
				const { asset } = applyPlugin('src/dir/asset.ts', source);
				assert.isObject(asset);
				assert.strictEqual(asset.source(), source);
				assert.strictEqual(asset.size(), Buffer.byteLength(source));
			});

			it('outputs individual mjs files for .tsx files', () => {
				const source = 'module.exports = {}';
				const { asset } = applyPlugin('src/dir/asset.tsx', source);
				assert.isObject(asset);
				assert.strictEqual(asset.source(), source);
				assert.strictEqual(asset.size(), Buffer.byteLength(source));
			});

			it('compiles .ts files to a `.js` extension in legacy mode', () => {
				const source = 'module.exports = {}';
				const { asset } = applyPlugin('src/dir/asset.tsx', source, undefined, {
					legacy: true
				});
				assert.isObject(asset);
				assert.strictEqual(asset.source(), source);
				assert.strictEqual(asset.size(), Buffer.byteLength(source));
			});

			it('compiles .tsx files to a `.js` extension in legacy mode', () => {
				const source = 'module.exports = {}';
				const { asset } = applyPlugin('src/dir/asset.tsx', source, undefined, {
					legacy: true
				});
				assert.isObject(asset);
				assert.strictEqual(asset.source(), source);
				assert.strictEqual(asset.size(), Buffer.byteLength(source));
			});

			it('excludes files outside the base path', () => {
				const source = 'module.exports = {}';
				const { compilation } = applyPlugin('other/dir/asset.ts', source);

				assert.deepEqual(Object.keys(compilation.assets), []);
			});

			it('ignores modules without a resource', () => {
				const source = 'module.exports = {}';
				const { compilation } = applyPlugin('', source);

				assert.deepEqual(Object.keys(compilation.assets), []);
			});

			it('outputs JS sourcemaps', () => {
				const source = 'module.exports = {}';
				const sourceMap = {
					mappings: 'abcd',
					sources: []
				};
				const { asset, assetSourceMap } = applyPlugin('src/dir/asset.ts', source, sourceMap);
				const assetSourceMapString = JSON.stringify(sourceMap);

				assert.isObject(assetSourceMap);
				assert.strictEqual(assetSourceMap.source(), assetSourceMapString);
				assert.strictEqual(assetSourceMap.size(), Buffer.byteLength(assetSourceMapString));
				assert.isTrue(asset.source().endsWith('\n/*# sourceMappingURL=asset.mjs.map*/'));
			});

			it('inlines JS sourcemaps with a flag', () => {
				const source = 'module.exports = {}';
				const sourceMap = { mappings: 'abcd', sources: [] };
				const { asset, assetSourceMap } = applyPlugin('src/dir/asset.ts', source, sourceMap, {
					inlineSourceMaps: true
				});

				const sourceMapUrl = `\n/*# sourceMappingURL=data:application/json;base64,${Buffer.from(
					JSON.stringify(sourceMap)
				).toString('base64')}*/`;
				assert.isTrue(asset.source().endsWith(sourceMapUrl));
				assert.isUndefined(assetSourceMap);
			});

			it('removes the base path from the source map sources', () => {
				const file = 'src/dir/asset.ts';
				const resource = file.replace(/\//g, path.sep);
				const source = 'module.exports = {}';
				const sourceMap = {
					mappings: 'abcd',
					sources: [resource]
				};
				const { assetSourceMap } = applyPlugin(file, source, sourceMap);

				const assetSourceMapString = JSON.stringify({
					mappings: 'abcd',
					sources: [path.relative(`src${path.sep}`, resource)]
				});
				assert.strictEqual(assetSourceMap.source(), assetSourceMapString);
			});
		});

		describe('CSS assets', () => {
			function applyCssModule(cssModule: any, pluginOptions?: EmitAllPluginOptions): Promise<any> {
				const factory = mockModule.getModuleUnderTest().emitAllFactory;
				const emitAll = factory({
					basePath: `src${path.sep}`,
					...pluginOptions
				}).plugin;

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
					resource: `src${path.sep}dir${path.sep}styles.css`,
					originalSource: () => ({
						source: () => source
					}),
					dependencies: [
						{
							content: source,
							identifier: `src${path.sep}dir${path.sep}styles.css`
						}
					]
				};

				return applyCssModule(cssModule).then((compilation) => {
					const asset = compilation.assets[`dir${path.sep}styles.css`];
					assert.isObject(asset);
					assert.strictEqual(asset.source(), source);
					assert.strictEqual(asset.size(), Buffer.byteLength(source));
				});
			});

			it('excludes files outside the base path', () => {
				const source = '.root {}';
				const cssModule = {
					resource: `other${path.sep}dir${path.sep}styles.css`,
					originalSource: () => ({
						source: () => source
					}),
					dependencies: [
						{
							content: source,
							identifier: `other${path.sep}dir${path.sep}styles.css`
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
					resource: `src${path.sep}dir${path.sep}styles.css`,
					originalSource: () => ({
						source: () => source
					}),
					dependencies: [
						{
							content: source,
							identifier: `src${path.sep}other${path.sep}asset.css`
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
					resource: `src${path.sep}dir${path.sep}styles.css`,
					originalSource: () => ({
						source: () => source
					}),
					dependencies: [
						{
							content: source,
							identifier: `src${path.sep}dir${path.sep}styles.css`,
							sourceMap: { mappings: 'abcd' }
						}
					]
				};

				return applyCssModule(cssModule).then((compilation) => {
					const asset = compilation.assets[`dir${path.sep}styles.css`];
					const assetMap = compilation.assets[`dir${path.sep}styles.css.map`];
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
					resource: `src${path.sep}dir${path.sep}styles.css`,
					originalSource: () => ({
						source: () => source
					}),
					dependencies: [
						{
							content: source,
							identifier: `src${path.sep}dir${path.sep}styles.css`,
							sourceMap
						}
					]
				};

				return applyCssModule(cssModule, { inlineSourceMaps: true }).then((compilation) => {
					const asset = compilation.assets[`dir${path.sep}styles.css`];
					const sourceMapUrl = `\n/*# sourceMappingURL=data:application/json;base64,${Buffer.from(
						JSON.stringify(sourceMap)
					).toString('base64')}*/`;
					assert.isTrue(asset.source().endsWith(sourceMapUrl));
					assert.isUndefined(compilation.assets[`dir${path.sep}styles.css.map`]);
				});
			});

			it('removes the base path from the source map sources', () => {
				const source = `module.exports = {}`;
				const sourceMap = {
					mappings: 'abcd',
					sources: [`src${path.sep}dir${path.sep}styles.css`]
				};
				const cssModule = {
					resource: `src${path.sep}dir${path.sep}styles.css`,
					originalSource: () => ({
						source: () => source
					}),
					dependencies: [
						{
							content: source,
							identifier: `src${path.sep}dir${path.sep}styles.css`,
							sourceMap
						}
					]
				};

				return applyCssModule(cssModule).then((compilation) => {
					const assetMap = compilation.assets[`dir${path.sep}styles.css.map`];
					const assetMapSource = {
						mappings: 'abcd',
						sources: [path.relative(`src${path.sep}`, `src${path.sep}dir${path.sep}styles.css`)]
					};
					const assetMapSourceString = JSON.stringify(assetMapSource);
					assert.strictEqual(assetMap.source(), assetMapSourceString);
				});
			});
		});
	});

	describe('transformer', () => {
		it('registers .d.ts files to be emitted', () => {
			const factory = mockModule.getModuleUnderTest().emitAllFactory;
			const { plugin, transformer } = factory({
				basePath: '/src'
			});
			const context = {};
			const node = {
				resolvedModules: new Map([
					['name.d.ts', { extension: '.d.ts', resolvedFileName: '/src/name.d.ts' }],
					['name.ts', { extension: '.ts', resolvedFileName: '/src/name.ts' }]
				])
			};
			transformer(context)(node);
			const compilation = createCompilation(compiler);
			plugin.apply(compiler);
			compiler.hooks.emit.callAsync(compilation, () => {});
			assert.isDefined(compilation.assets['name.d.ts']);
		});

		it('ignores .d.ts files outside the src path or those that do not exist', () => {
			const factory = mockModule.getModuleUnderTest().emitAllFactory;
			const { plugin, transformer } = factory({
				basePath: '/src'
			});
			const context = {};
			const node = {
				resolvedModules: new Map([
					['foo.d.ts', { extension: '.d.ts', resolvedFileName: '/node_modules/foo.d.ts' }],
					['bar.d.ts', { extension: '.d.ts', resolvedFileName: '/src/bar.d.ts' }]
				])
			};
			mockModule.getMock('fs').existsSync = stub().callsFake((file: string) => {
				return !file.includes('bar.d.ts');
			});
			transformer(context)(node);
			const compilation = createCompilation(compiler);
			plugin.apply(compiler);
			compiler.hooks.emit.callAsync(compilation, () => {});
			assert.isUndefined(compilation.assets['foo.d.ts']);
			assert.isUndefined(compilation.assets['bar.d.ts']);
		});

		it('guards against malformed nodes', () => {
			const factory = mockModule.getModuleUnderTest().emitAllFactory;
			const { plugin, transformer } = factory({
				basePath: '/src'
			});
			const context = {};
			const node = {
				resolvedModules: new Map([['foo.d.ts', null]])
			};
			mockModule.getMock('fs').existsSync = stub().callsFake((file: string) => {
				return !file.includes('bar.d.ts');
			});
			transformer(context)(node);
			transformer(context)({});
			const compilation = createCompilation(compiler);
			plugin.apply(compiler);
			compiler.hooks.emit.callAsync(compilation, () => {});
			assert.deepEqual(compilation.assets, {});
		});
	});
});
