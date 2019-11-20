import { readFileSync, existsSync } from 'fs-extra';
import * as path from 'path';
import { stub } from 'sinon';
import MockModule from '../../support/MockModule';
import { BuildTimeRenderArguments } from '../../../src/build-time-render/BuildTimeRender';

const { afterEach, beforeEach, describe, it, before, after } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

let mockModule: MockModule;
let outputPath: string;
let compiler: any;
let pluginRegistered = false;
let runBtr: Function = () => {};
const tapStub = (name: string, cb: Function) => {
	pluginRegistered = true;
	runBtr = cb;
};

function getBuildTimeRenderModule(): {
	new (options: BuildTimeRenderArguments): any;
} {
	return mockModule.getModuleUnderTest().default;
}

function normalise(value: string) {
	return value.replace(/^(\s*)(\r\n?|\n)/gm, '').trim();
}

const callbackStub = stub();

const createCompilation = (
	type:
		| 'state'
		| 'state-auto-discovery'
		| 'state-scoped'
		| 'state-static'
		| 'state-static-per-path'
		| 'state-static-no-paths'
		| 'hash'
		| 'build-bridge'
		| 'build-bridge-hash'
		| 'build-bridge-error'
		| 'build-bridge-single-bundle'
		| 'build-bridge-blocks-only'
) => {
	const errors: Error[] = [];
	const manifest = readFileSync(
		path.join(__dirname, `./../../support/fixtures/build-time-render/${type}/manifest.json`),
		'utf-8'
	);
	let assets: any = {
		'manifest.json': { source: () => manifest }
	};
	const parsedManifest = JSON.parse(manifest);
	assets = Object.keys(parsedManifest).reduce((obj: any, key: string) => {
		const content = readFileSync(
			path.join(__dirname, `./../../support/fixtures/build-time-render/${type}/${parsedManifest[key]}`),
			'utf-8'
		);
		assets[parsedManifest[key]] = { source: () => content };
		return assets;
	}, assets);
	return { assets, errors };
};

let normalModuleReplacementPluginStub: any;

describe('build-time-render', () => {
	let originalWindow: any;
	let originalDocument: any;
	before(() => {
		originalWindow = (global as any).window;
		originalDocument = (global as any).document;
	});

	after(() => {
		(global as any).window = originalWindow;
		(global as any).document = originalDocument;
	});

	beforeEach(() => {
		mockModule = new MockModule('../../../src/build-time-render/BuildTimeRender', require);
		mockModule.dependencies(['fs-extra', 'webpack']);
		const webpack = mockModule.getMock('webpack');
		normalModuleReplacementPluginStub = stub().returns({
			apply: stub()
		});
		webpack.ctor.NormalModuleReplacementPlugin = normalModuleReplacementPluginStub;
	});

	afterEach(() => {
		pluginRegistered = false;
		mockModule.destroy();
		callbackStub.reset();
		runBtr = () => {};
	});

	describe('puppeteer', () => {
		describe('errors', () => {
			beforeEach(() => {
				outputPath = path.join(
					__dirname,
					'..',
					'..',
					'support',
					'fixtures',
					'build-time-render',
					'build-bridge-error'
				);
				compiler = {
					hooks: {
						afterEmit: {
							tapAsync: tapStub
						},
						normalModuleFactory: {
							tap: stub()
						}
					},
					options: {
						output: {
							path: outputPath
						}
					}
				};
			});

			it('should report an error if the root node is not in the index.html', () => {
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const btr = new Btr({
					basePath: '',
					entries: ['runtime', 'main'],
					root: 'missing',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test'
				});
				btr.apply(compiler);
				assert.isTrue(pluginRegistered);
				const compilation = createCompilation('build-bridge-error');
				return runBtr(compilation, callbackStub).then(() => {
					assert.isTrue(callbackStub.calledOnce);
					assert.lengthOf(compilation.errors, 1);
					assert.strictEqual(
						compilation.errors[0].message,
						'Failed to run build time rendering. Could not find DOM node with id: "missing" in src/index.html'
					);
				});
			});

			it('should report errors from running build bridge', () => {
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const basePath = path.join(
					process.cwd(),
					'tests/support/fixtures/build-time-render/build-bridge-error'
				);
				const btr = new Btr({
					basePath,
					paths: [],
					entries: ['bootstrap', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test'
				});
				btr.apply(compiler);
				const callback = normalModuleReplacementPluginStub.firstCall.args[1];
				const resource = {
					context: `${basePath}/foo/bar`,
					request: `something.build.js`,
					contextInfo: {
						issuer: 'foo'
					}
				};
				callback(resource);
				assert.equal(
					resource.request,
					"@dojo/webpack-contrib/build-time-render/build-bridge-loader?modulePath='foo/bar/something.build.js'!@dojo/webpack-contrib/build-time-render/bridge"
				);
				const compilation = createCompilation('build-bridge-error');
				return runBtr(compilation, callbackStub).then(() => {
					assert.isTrue(callbackStub.calledOnce);
					assert.lengthOf(compilation.errors, 2);
					assert.strictEqual(compilation.errors[0].message, 'Block error');
					assert.include(
						compilation.errors[1].message,
						'BTR runtime Error: runtime error\n    at main (http://localhost'
					);
				});
			});

			it('should capture errors during build time rendering', () => {
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				outputFileSync.throws(() => new Error('Test Error'));
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const basePath = path.join(
					process.cwd(),
					'tests/support/fixtures/build-time-render/build-bridge-error'
				);
				const btr = new Btr({
					basePath,
					paths: [],
					entries: ['bootstrap', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test'
				});
				btr.apply(compiler);
				const callback = normalModuleReplacementPluginStub.firstCall.args[1];
				const resource = {
					context: `${basePath}/foo/bar`,
					request: `something.build.js`,
					contextInfo: {
						issuer: 'foo'
					}
				};
				callback(resource);
				assert.equal(
					resource.request,
					"@dojo/webpack-contrib/build-time-render/build-bridge-loader?modulePath='foo/bar/something.build.js'!@dojo/webpack-contrib/build-time-render/bridge"
				);
				const compilation = createCompilation('build-bridge-error');
				return runBtr(compilation, callbackStub).then(() => {
					assert.isTrue(callbackStub.calledOnce);
					assert.lengthOf(compilation.errors, 3);
					assert.strictEqual(compilation.errors[0].message, 'Block error');
					assert.include(
						compilation.errors[1].message,
						'BTR runtime Error: runtime error\n    at main (http://localhost'
					);
					assert.strictEqual(compilation.errors[2].message, 'Test Error');
				});
			});
		});

		describe('hash history', () => {
			beforeEach(() => {
				outputPath = path.join(__dirname, '..', '..', 'support', 'fixtures', 'build-time-render', 'hash');
				compiler = {
					hooks: {
						afterEmit: {
							tapAsync: tapStub
						},
						normalModuleFactory: {
							tap: stub()
						}
					},
					options: {
						output: {
							path: outputPath
						}
					}
				};
			});

			it('should inject btr using entry names', () => {
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const basePath = path.join(
					process.cwd(),
					'tests/support/fixtures/build-time-render/build-bridge-error'
				);
				const btr = new Btr({
					basePath,
					entries: ['runtime', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test'
				});
				btr.apply(compiler);
				assert.isTrue(pluginRegistered);
				return runBtr(createCompilation('hash'), callbackStub).then(() => {
					assert.isTrue(callbackStub.calledOnce);
					const expected = readFileSync(path.join(outputPath, 'expected', 'index.html'), 'utf-8');
					const actual = outputFileSync.firstCall.args[1];
					assert.strictEqual(normalise(actual), normalise(expected));
				});
			});

			it('should inject btr using manifest to map', () => {
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const btr = new Btr({
					basePath: '',
					paths: [],
					entries: ['runtime', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test'
				});
				btr.apply(compiler);
				assert.isTrue(pluginRegistered);
				return runBtr(createCompilation('hash'), callbackStub).then(() => {
					assert.isTrue(callbackStub.calledOnce);
					const expected = readFileSync(path.join(outputPath, 'expected', 'index.html'), 'utf-8');
					const actual = outputFileSync.firstCall.args[1];
					assert.strictEqual(normalise(actual), normalise(expected));
				});
			});

			it('should inject btr for paths specified', () => {
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const btr = new Btr({
					basePath: '',
					paths: [
						{
							path: '#my-path'
						}
					],
					entries: ['runtime', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test'
				});
				btr.apply(compiler);
				assert.isTrue(pluginRegistered);
				return runBtr(createCompilation('hash'), callbackStub).then(() => {
					assert.isTrue(callbackStub.calledOnce);
					const expected = readFileSync(path.join(outputPath, 'expected', 'indexWithPaths.html'), 'utf-8');
					const actual = outputFileSync.firstCall.args[1];
					assert.strictEqual(normalise(actual), normalise(expected));
				});
			});

			it('should not inject btr when missing root', () => {
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const btr = new Btr({
					basePath: '',
					paths: [],
					entries: ['runtime', 'main'],
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test'
				} as any);
				btr.apply(compiler);
				assert.isFalse(pluginRegistered);
			});

			it('should not inject btr when no output path can be found', () => {
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const btr = new Btr({
					basePath: '',
					paths: [],
					entries: ['runtime', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test'
				});
				btr.apply({ ...compiler, options: {} });
				assert.isTrue(pluginRegistered);
				return runBtr(createCompilation('hash'), callbackStub).then(() => {
					assert.isTrue(callbackStub.calledOnce);
					assert.isTrue(outputFileSync.notCalled);
				});
			});
		});

		describe('history api', () => {
			beforeEach(() => {
				outputPath = path.join(__dirname, '..', '..', 'support', 'fixtures', 'build-time-render', 'state');
				compiler = {
					hooks: {
						afterEmit: {
							tapAsync: tapStub
						},
						normalModuleFactory: {
							tap: stub()
						}
					},
					options: {
						output: {
							path: outputPath
						}
					}
				};
			});

			it('should auto detect history routing and statically build an index file for each route', () => {
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const btr = new Btr({
					basePath: '',
					paths: [
						{
							path: 'my-path'
						},
						'other',
						'my-path/other'
					],
					entries: ['runtime', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test'
				});
				btr.apply(compiler);
				assert.isTrue(pluginRegistered);
				return runBtr(createCompilation('state'), callbackStub).then(() => {
					assert.isTrue(callbackStub.calledOnce);
					assert.strictEqual(outputFileSync.callCount, 4);
					assert.isTrue(
						outputFileSync.secondCall.args[0].indexOf(
							path.join('support', 'fixtures', 'build-time-render', 'state', 'my-path', 'index.html')
						) > -1
					);
					assert.isTrue(
						outputFileSync.thirdCall.args[0].indexOf(
							path.join('support', 'fixtures', 'build-time-render', 'state', 'other', 'index.html')
						) > -1
					);
					assert.isTrue(
						outputFileSync
							.getCall(3)
							.args[0].indexOf(
								path.join(
									'support',
									'fixtures',
									'build-time-render',
									'state',
									'my-path',
									'other',
									'index.html'
								)
							) > -1
					);
					assert.strictEqual(
						normalise(outputFileSync.secondCall.args[1]),
						normalise(
							readFileSync(
								path.join(
									__dirname,
									'..',
									'..',
									'support',
									'fixtures',
									'build-time-render',
									'state',
									'expected',
									'my-path',
									'index.html'
								),
								'utf8'
							)
						)
					);
					assert.strictEqual(
						normalise(outputFileSync.thirdCall.args[1]),
						normalise(
							readFileSync(
								path.join(
									__dirname,
									'..',
									'..',
									'support',
									'fixtures',
									'build-time-render',
									'state',
									'expected',
									'other',
									'index.html'
								),
								'utf8'
							)
						)
					);
					assert.strictEqual(
						normalise(outputFileSync.getCall(3).args[1]),
						normalise(
							readFileSync(
								path.join(
									__dirname,
									'..',
									'..',
									'support',
									'fixtures',
									'build-time-render',
									'state',
									'expected',
									'my-path',
									'other',
									'index.html'
								),
								'utf8'
							)
						)
					);
				});
			});

			it('should statically build an index file for each route', () => {
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const btr = new Btr({
					basePath: '',
					paths: [
						{
							path: 'my-path'
						},
						'other',
						'my-path/other'
					],
					useHistory: true,
					entries: ['runtime', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test'
				});
				btr.apply(compiler);
				assert.isTrue(pluginRegistered);
				return runBtr(createCompilation('state'), callbackStub).then(() => {
					assert.isTrue(callbackStub.calledOnce);
					assert.strictEqual(outputFileSync.callCount, 4);
					assert.isTrue(
						outputFileSync.secondCall.args[0].indexOf(
							path.join('support', 'fixtures', 'build-time-render', 'state', 'my-path', 'index.html')
						) > -1
					);
					assert.isTrue(
						outputFileSync.thirdCall.args[0].indexOf(
							path.join('support', 'fixtures', 'build-time-render', 'state', 'other', 'index.html')
						) > -1
					);
					assert.isTrue(
						outputFileSync
							.getCall(3)
							.args[0].indexOf(
								path.join(
									'support',
									'fixtures',
									'build-time-render',
									'state',
									'my-path',
									'other',
									'index.html'
								)
							) > -1
					);
					assert.strictEqual(
						normalise(outputFileSync.secondCall.args[1]),
						normalise(
							readFileSync(
								path.join(
									__dirname,
									'..',
									'..',
									'support',
									'fixtures',
									'build-time-render',
									'state',
									'expected',
									'my-path',
									'index.html'
								),
								'utf8'
							)
						)
					);
					assert.strictEqual(
						normalise(outputFileSync.thirdCall.args[1]),
						normalise(
							readFileSync(
								path.join(
									__dirname,
									'..',
									'..',
									'support',
									'fixtures',
									'build-time-render',
									'state',
									'expected',
									'other',
									'index.html'
								),
								'utf8'
							)
						)
					);
					assert.strictEqual(
						normalise(outputFileSync.getCall(3).args[1]),
						normalise(
							readFileSync(
								path.join(
									__dirname,
									'..',
									'..',
									'support',
									'fixtures',
									'build-time-render',
									'state',
									'expected',
									'my-path',
									'other',
									'index.html'
								),
								'utf8'
							)
						)
					);
				});
			});

			it('should auto discover paths to build from each rendered page', () => {
				compiler = {
					hooks: {
						afterEmit: {
							tapAsync: tapStub
						},
						normalModuleFactory: {
							tap: stub()
						}
					},
					options: {
						output: {
							path: path.join(
								__dirname,
								'..',
								'..',
								'support',
								'fixtures',
								'build-time-render',
								'state-auto-discovery'
							)
						}
					}
				};
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const btr = new Btr({
					basePath: '',
					useHistory: true,
					entries: ['runtime', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test'
				});
				btr.apply(compiler);
				assert.isTrue(pluginRegistered);
				return runBtr(createCompilation('state-auto-discovery'), callbackStub).then(() => {
					assert.isTrue(callbackStub.calledOnce);
					assert.strictEqual(outputFileSync.callCount, 4);
					assert.isTrue(
						outputFileSync.secondCall.args[0].indexOf(
							path.join(
								'support',
								'fixtures',
								'build-time-render',
								'state-auto-discovery',
								'my-path',
								'index.html'
							)
						) > -1
					);
					assert.isTrue(
						outputFileSync.thirdCall.args[0].indexOf(
							path.join(
								'support',
								'fixtures',
								'build-time-render',
								'state-auto-discovery',
								'other',
								'index.html'
							)
						) > -1
					);
					assert.isTrue(
						outputFileSync
							.getCall(3)
							.args[0].indexOf(
								path.join(
									'support',
									'fixtures',
									'build-time-render',
									'state-auto-discovery',
									'my-path',
									'other',
									'index.html'
								)
							) > -1
					);
					assert.strictEqual(
						normalise(outputFileSync.secondCall.args[1]),
						normalise(
							readFileSync(
								path.join(
									__dirname,
									'..',
									'..',
									'support',
									'fixtures',
									'build-time-render',
									'state-auto-discovery',
									'expected',
									'my-path',
									'index.html'
								),
								'utf8'
							)
						)
					);
					assert.strictEqual(
						normalise(outputFileSync.thirdCall.args[1]),
						normalise(
							readFileSync(
								path.join(
									__dirname,
									'..',
									'..',
									'support',
									'fixtures',
									'build-time-render',
									'state-auto-discovery',
									'expected',
									'other',
									'index.html'
								),
								'utf8'
							)
						)
					);
					assert.strictEqual(
						normalise(outputFileSync.getCall(3).args[1]),
						normalise(
							readFileSync(
								path.join(
									__dirname,
									'..',
									'..',
									'support',
									'fixtures',
									'build-time-render',
									'state-auto-discovery',
									'expected',
									'my-path',
									'other',
									'index.html'
								),
								'utf8'
							)
						)
					);
				});
			});

			describe('static', () => {
				beforeEach(() => {
					outputPath = path.join(
						__dirname,
						'..',
						'..',
						'support',
						'fixtures',
						'build-time-render',
						'state-static'
					);
					compiler = {
						hooks: {
							afterEmit: {
								tapAsync: tapStub
							},
							normalModuleFactory: {
								tap: stub()
							}
						},
						options: {
							output: {
								path: outputPath
							}
						}
					};
				});

				it('should create index files for each route without js and css', () => {
					const fs = mockModule.getMock('fs-extra');
					const outputFileSync = stub();
					fs.outputFileSync = outputFileSync;
					fs.readFileSync = readFileSync;
					fs.existsSync = existsSync;
					const Btr = getBuildTimeRenderModule();
					const btr = new Btr({
						basePath: '',
						paths: [
							{
								path: 'my-path'
							},
							'other',
							'my-path/other'
						],
						static: true,
						entries: ['runtime', 'main'],
						root: 'app',
						puppeteerOptions: { args: ['--no-sandbox'] },
						scope: 'test'
					});
					btr.apply(compiler);
					assert.isTrue(pluginRegistered);
					return runBtr(createCompilation('state-static'), callbackStub).then(() => {
						assert.isTrue(callbackStub.calledOnce);
						assert.strictEqual(outputFileSync.callCount, 4);
						assert.isTrue(
							outputFileSync.secondCall.args[0].indexOf(
								path.join(
									'support',
									'fixtures',
									'build-time-render',
									'state-static',
									'my-path',
									'index.html'
								)
							) > -1
						);
						assert.isTrue(
							outputFileSync.thirdCall.args[0].indexOf(
								path.join(
									'support',
									'fixtures',
									'build-time-render',
									'state-static',
									'other',
									'index.html'
								)
							) > -1
						);
						assert.isTrue(
							outputFileSync
								.getCall(3)
								.args[0].indexOf(
									path.join(
										'support',
										'fixtures',
										'build-time-render',
										'state-static',
										'my-path',
										'other',
										'index.html'
									)
								) > -1
						);
						assert.strictEqual(
							normalise(outputFileSync.secondCall.args[1]),
							normalise(
								readFileSync(
									path.join(
										__dirname,
										'..',
										'..',
										'support',
										'fixtures',
										'build-time-render',
										'state-static',
										'expected',
										'my-path',
										'index.html'
									),
									'utf8'
								)
							)
						);
						assert.strictEqual(
							normalise(outputFileSync.thirdCall.args[1]),
							normalise(
								readFileSync(
									path.join(
										__dirname,
										'..',
										'..',
										'support',
										'fixtures',
										'build-time-render',
										'state-static',
										'expected',
										'other',
										'index.html'
									),
									'utf8'
								)
							)
						);
						assert.strictEqual(
							normalise(outputFileSync.getCall(3).args[1]),
							normalise(
								readFileSync(
									path.join(
										__dirname,
										'..',
										'..',
										'support',
										'fixtures',
										'build-time-render',
										'state-static',
										'expected',
										'my-path',
										'other',
										'index.html'
									),
									'utf8'
								)
							)
						);
					});
				});

				it('should create index files for specified routes without js and css', () => {
					outputPath = path.join(
						__dirname,
						'..',
						'..',
						'support',
						'fixtures',
						'build-time-render',
						'state-static-per-path'
					);
					compiler = {
						hooks: {
							afterEmit: {
								tapAsync: tapStub
							},
							normalModuleFactory: {
								tap: stub()
							}
						},
						options: {
							output: {
								path: outputPath
							}
						}
					};
					const fs = mockModule.getMock('fs-extra');
					const outputFileSync = stub();
					fs.outputFileSync = outputFileSync;
					fs.readFileSync = readFileSync;
					fs.existsSync = existsSync;
					const Btr = getBuildTimeRenderModule();
					const btr = new Btr({
						basePath: '',
						paths: [
							{
								path: 'my-path',
								static: true
							},
							'other',
							'my-path/other'
						],
						entries: ['runtime', 'main'],
						root: 'app',
						puppeteerOptions: { args: ['--no-sandbox'] },
						scope: 'test'
					});
					btr.apply(compiler);
					assert.isTrue(pluginRegistered);
					return runBtr(createCompilation('state-static-per-path'), callbackStub).then(() => {
						assert.isTrue(callbackStub.calledOnce);
						assert.strictEqual(outputFileSync.callCount, 4);
						assert.isTrue(
							outputFileSync.secondCall.args[0].indexOf(
								path.join(
									'support',
									'fixtures',
									'build-time-render',
									'state-static-per-path',
									'my-path',
									'index.html'
								)
							) > -1
						);
						assert.isTrue(
							outputFileSync.thirdCall.args[0].indexOf(
								path.join(
									'support',
									'fixtures',
									'build-time-render',
									'state-static-per-path',
									'other',
									'index.html'
								)
							) > -1
						);
						assert.isTrue(
							outputFileSync
								.getCall(3)
								.args[0].indexOf(
									path.join(
										'support',
										'fixtures',
										'build-time-render',
										'state-static-per-path',
										'my-path',
										'other',
										'index.html'
									)
								) > -1
						);
						assert.strictEqual(
							normalise(outputFileSync.secondCall.args[1]),
							normalise(
								readFileSync(
									path.join(
										__dirname,
										'..',
										'..',
										'support',
										'fixtures',
										'build-time-render',
										'state-static-per-path',
										'expected',
										'my-path',
										'index.html'
									),
									'utf8'
								)
							)
						);
						assert.strictEqual(
							normalise(outputFileSync.thirdCall.args[1]),
							normalise(
								readFileSync(
									path.join(
										__dirname,
										'..',
										'..',
										'support',
										'fixtures',
										'build-time-render',
										'state-static-per-path',
										'expected',
										'other',
										'index.html'
									),
									'utf8'
								)
							)
						);
						assert.strictEqual(
							normalise(outputFileSync.getCall(3).args[1]),
							normalise(
								readFileSync(
									path.join(
										__dirname,
										'..',
										'..',
										'support',
										'fixtures',
										'build-time-render',
										'state-static-per-path',
										'expected',
										'my-path',
										'other',
										'index.html'
									),
									'utf8'
								)
							)
						);
					});
				});

				it('should create index without js and css even with no paths', () => {
					outputPath = path.join(
						__dirname,
						'..',
						'..',
						'support',
						'fixtures',
						'build-time-render',
						'state-static-no-paths'
					);
					compiler = {
						hooks: {
							afterEmit: {
								tapAsync: tapStub
							},
							normalModuleFactory: {
								tap: stub()
							}
						},
						options: {
							output: {
								path: outputPath
							}
						}
					};
					const fs = mockModule.getMock('fs-extra');
					const outputFileSync = stub();
					fs.outputFileSync = outputFileSync;
					fs.readFileSync = readFileSync;
					fs.existsSync = existsSync;
					const Btr = getBuildTimeRenderModule();
					const btr = new Btr({
						basePath: '',
						static: true,
						entries: ['runtime', 'main'],
						root: 'app',
						puppeteerOptions: { args: ['--no-sandbox'] },
						scope: 'test'
					});
					btr.apply(compiler);
					assert.isTrue(pluginRegistered);
					return runBtr(createCompilation('state-static-no-paths'), callbackStub).then(() => {
						assert.isTrue(callbackStub.calledOnce);
						assert.strictEqual(outputFileSync.callCount, 1);
						assert.isTrue(
							outputFileSync.firstCall.args[0].indexOf(
								path.join(
									'support',
									'fixtures',
									'build-time-render',
									'state-static-no-paths',
									'index.html'
								)
							) > -1
						);
						assert.strictEqual(
							normalise(outputFileSync.firstCall.args[1]),
							normalise(
								readFileSync(
									path.join(
										__dirname,
										'..',
										'..',
										'support',
										'fixtures',
										'build-time-render',
										'state-static-no-paths',
										'expected',
										'index.html'
									),
									'utf8'
								)
							)
						);
					});
				});
			});
		});

		describe('build bridge', () => {
			it('should call node module, return result to render in html, and write to cache in bundle', () => {
				outputPath = path.join(
					__dirname,
					'..',
					'..',
					'support',
					'fixtures',
					'build-time-render',
					'build-bridge'
				);
				compiler = {
					hooks: {
						afterEmit: {
							tapAsync: tapStub
						},
						normalModuleFactory: {
							tap: stub()
						}
					},
					options: {
						output: {
							path: outputPath,
							jsonpFunction: 'foo'
						}
					}
				};
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const basePath = path.join(process.cwd(), 'tests/support/fixtures/build-time-render/build-bridge');
				const btr = new Btr({
					basePath,
					paths: [],
					entries: ['bootstrap', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test'
				});
				btr.apply(compiler);
				const callback = normalModuleReplacementPluginStub.firstCall.args[1];
				const resource = {
					context: `${basePath}/foo/bar`,
					request: `something.build.js`,
					contextInfo: {
						issuer: 'foo'
					}
				};
				callback(resource);
				assert.equal(
					resource.request,
					"@dojo/webpack-contrib/build-time-render/build-bridge-loader?modulePath='foo/bar/something.build.js'!@dojo/webpack-contrib/build-time-render/bridge"
				);
				return runBtr(createCompilation('build-bridge'), callbackStub).then(() => {
					const calls = outputFileSync.getCalls();
					let html = '';
					let blocks = '';
					let block = '';
					calls.map((call) => {
						const [filename, content] = call.args;
						if (filename.match(/index\.html$/)) {
							html = content;
						}
						if (filename.match(/blocks\.js$/)) {
							blocks = content;
						}
						if (filename.match(/block-.*\.js$/)) {
							block = content;
						}
					});
					assert.strictEqual(
						normalise(html),
						normalise(readFileSync(path.join(outputPath, 'expected', 'index.html'), 'utf-8'))
					);
					assert.strictEqual(
						normalise(blocks),
						normalise(readFileSync(path.join(outputPath, 'expected', 'blocks.js'), 'utf-8'))
					);
					assert.strictEqual(
						normalise(block),
						normalise(readFileSync(path.join(outputPath, 'expected', 'block.js'), 'utf-8'))
					);
				});
			});

			it('should call node module, return result to render in html, and write to cache in bundle with new hashes', () => {
				outputPath = path.join(
					__dirname,
					'..',
					'..',
					'support',
					'fixtures',
					'build-time-render',
					'build-bridge-hash'
				);
				compiler = {
					hooks: {
						afterEmit: {
							tapAsync: tapStub
						},
						normalModuleFactory: {
							tap: stub()
						}
					},
					options: {
						output: {
							path: outputPath,
							jsonpFunction: 'foo'
						}
					}
				};
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const basePath = path.join(process.cwd(), 'tests/support/fixtures/build-time-render/build-bridge-hash');
				const btr = new Btr({
					basePath,
					paths: [],
					entries: ['bootstrap', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test'
				});
				btr.apply(compiler);
				const callback = normalModuleReplacementPluginStub.firstCall.args[1];
				const resource = {
					context: `${basePath}/foo/bar`,
					request: `something.build.js`,
					contextInfo: {
						issuer: 'foo'
					}
				};
				callback(resource);
				return runBtr(createCompilation('build-bridge-hash'), callbackStub).then(() => {
					const calls = outputFileSync.getCalls();
					let html = '';
					let blocks = '';
					let blocksFileName = '';
					let block = '';
					let blockFilename;
					let originalManifest = '';
					let manifest = '';
					let bootstrap = '';
					let bootstrapFilename = '';
					calls.forEach((call) => {
						const [filename, content] = call.args;
						const parsedFilename = path.parse(filename);
						if (filename.match(/index\.html$/)) {
							html = content;
						}
						if (filename.match(/blocks\..*\.bundle\.js$/)) {
							blocks = content;
							blocksFileName = `${parsedFilename.name}${parsedFilename.ext}`;
						}
						if (filename.match(/block-.*\.js$/)) {
							block = content;
							blockFilename = `${parsedFilename.name}${parsedFilename.ext}`;
						}
						if (filename.match(/bootstrap\..*\.bundle\.js$/)) {
							bootstrap = content;
							bootstrapFilename = `${parsedFilename.name}${parsedFilename.ext}`;
						}
						if (filename.match(/manifest\.original\.json$/)) {
							originalManifest = content;
						}
						if (filename.match(/manifest\.json$/)) {
							manifest = content;
						}
					});
					assert.strictEqual(
						normalise(html),
						normalise(readFileSync(path.join(outputPath, 'expected', 'index.html'), 'utf-8'))
					);
					assert.strictEqual(bootstrapFilename, 'bootstrap.247d4597a12706983d2c.bundle.js');
					assert.strictEqual(
						normalise(bootstrap),
						normalise(readFileSync(path.join(outputPath, 'expected', 'bootstrap.js'), 'utf-8'))
					);
					assert.strictEqual(blocksFileName, 'blocks.abcdefghij0123456789.bundle.js');
					assert.strictEqual(
						normalise(blocks),
						normalise(readFileSync(path.join(outputPath, 'expected', 'blocks.js'), 'utf-8'))
					);
					assert.strictEqual(blockFilename, 'block-49e457933c3c36eeb77f.9eba5eaa6f8cfe7b34e3.bundle.js');
					assert.strictEqual(
						normalise(block),
						normalise(readFileSync(path.join(outputPath, 'expected', 'block.js'), 'utf-8'))
					);
					assert.strictEqual(
						normalise(originalManifest),
						normalise(readFileSync(path.join(outputPath, 'expected', 'manifest.original.json'), 'utf-8'))
					);
					assert.strictEqual(
						normalise(manifest),
						normalise(readFileSync(path.join(outputPath, 'expected', 'manifest.json'), 'utf-8'))
					);
				});
			});
		});

		describe('build bridge with blocks only', () => {
			it('should call node module, return result to render in html, and write to cache in bundle', () => {
				outputPath = path.join(
					__dirname,
					'..',
					'..',
					'support',
					'fixtures',
					'build-time-render',
					'build-bridge-blocks-only'
				);
				compiler = {
					hooks: {
						afterEmit: {
							tapAsync: tapStub
						},
						normalModuleFactory: {
							tap: stub()
						}
					},
					options: {
						output: {
							path: outputPath,
							jsonpFunction: 'foo'
						}
					}
				};
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const basePath = path.join(
					process.cwd(),
					'tests/support/fixtures/build-time-render/build-bridge-blocks-only'
				);
				const btr = new Btr({
					basePath,
					paths: [],
					entries: ['bootstrap', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test',
					writeHtml: false
				});
				btr.apply(compiler);
				const callback = normalModuleReplacementPluginStub.firstCall.args[1];
				const resource = {
					context: `${basePath}/foo/bar`,
					request: `something.build.js`,
					contextInfo: {
						issuer: 'foo'
					}
				};
				callback(resource);
				assert.equal(
					resource.request,
					"@dojo/webpack-contrib/build-time-render/build-bridge-loader?modulePath='foo/bar/something.build.js'!@dojo/webpack-contrib/build-time-render/bridge"
				);
				return runBtr(createCompilation('build-bridge-blocks-only'), callbackStub).then(() => {
					const calls = outputFileSync.getCalls();
					let html = '';
					let blocks = '';
					let block = '';
					calls.map((call) => {
						const [filename, content] = call.args;
						if (filename.match(/index\.html$/)) {
							html = content;
						}
						if (filename.match(/blocks\.js$/)) {
							blocks = content;
						}
						if (filename.match(/block-.*\.js$/)) {
							block = content;
						}
					});
					assert.strictEqual(
						normalise(html),
						normalise(readFileSync(path.join(outputPath, 'expected', 'index.html'), 'utf-8'))
					);
					assert.strictEqual(
						normalise(blocks),
						normalise(readFileSync(path.join(outputPath, 'expected', 'blocks.js'), 'utf-8'))
					);
					assert.strictEqual(
						normalise(block),
						normalise(readFileSync(path.join(outputPath, 'expected', 'block.js'), 'utf-8'))
					);
				});
			});
		});
	});

	describe('jsdom', () => {
		describe('hash history', () => {
			beforeEach(() => {
				outputPath = path.join(__dirname, '..', '..', 'support', 'fixtures', 'build-time-render', 'hash');
				compiler = {
					hooks: {
						afterEmit: {
							tapAsync: tapStub
						},
						normalModuleFactory: {
							tap: stub()
						}
					},
					options: {
						output: {
							path: outputPath
						}
					}
				};
			});

			it('should inject btr using entry names', () => {
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const basePath = path.join(
					process.cwd(),
					'tests/support/fixtures/build-time-render/build-bridge-error'
				);
				const btr = new Btr({
					basePath,
					entries: ['runtime', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test',
					renderer: 'jsdom'
				});
				btr.apply(compiler);
				assert.isTrue(pluginRegistered);
				return runBtr(createCompilation('hash'), callbackStub).then(() => {
					assert.isTrue(callbackStub.calledOnce);
					const expected = readFileSync(path.join(outputPath, 'expected', 'index.html'), 'utf-8');
					const actual = outputFileSync.firstCall.args[1];
					assert.strictEqual(normalise(actual), normalise(expected));
				});
			});

			it('should inject btr using manifest to map', () => {
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const btr = new Btr({
					basePath: '',
					paths: [],
					entries: ['runtime', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test',
					renderer: 'jsdom'
				});
				btr.apply(compiler);
				assert.isTrue(pluginRegistered);
				return runBtr(createCompilation('hash'), callbackStub).then(() => {
					assert.isTrue(callbackStub.calledOnce);
					const expected = readFileSync(path.join(outputPath, 'expected', 'index.html'), 'utf-8');
					const actual = outputFileSync.firstCall.args[1];
					assert.strictEqual(normalise(actual), normalise(expected));
				});
			});

			it('should inject btr for paths specified', () => {
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const btr = new Btr({
					basePath: '',
					paths: [
						{
							path: '#my-path'
						}
					],
					entries: ['runtime', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test',
					renderer: 'jsdom'
				});
				btr.apply(compiler);
				assert.isTrue(pluginRegistered);
				return runBtr(createCompilation('hash'), callbackStub).then(() => {
					assert.isTrue(callbackStub.calledOnce);
					const expected = readFileSync(path.join(outputPath, 'expected', 'indexWithPaths.html'), 'utf-8');
					const actual = outputFileSync.firstCall.args[1];
					assert.strictEqual(normalise(actual), normalise(expected));
				});
			});

			it('should not inject btr when missing root', () => {
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const btr = new Btr({
					basePath: '',
					paths: [],
					entries: ['runtime', 'main'],
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test',
					renderer: 'jsdom'
				} as any);
				btr.apply(compiler);
				assert.isFalse(pluginRegistered);
			});

			it('should not inject btr when no output path can be found', () => {
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const btr = new Btr({
					basePath: '',
					paths: [],
					entries: ['runtime', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test',
					renderer: 'jsdom'
				});
				btr.apply({ ...compiler, options: {} });
				assert.isTrue(pluginRegistered);
				return runBtr(createCompilation('hash'), callbackStub).then(() => {
					assert.isTrue(callbackStub.calledOnce);
					assert.isTrue(outputFileSync.notCalled);
				});
			});
		});

		describe('history api', () => {
			beforeEach(() => {
				outputPath = path.join(__dirname, '..', '..', 'support', 'fixtures', 'build-time-render', 'state');
				compiler = {
					hooks: {
						afterEmit: {
							tapAsync: tapStub
						},
						normalModuleFactory: {
							tap: stub()
						}
					},
					options: {
						output: {
							path: outputPath
						}
					}
				};
			});

			it('should auto detect history routing and statically build an index file for each route', () => {
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const btr = new Btr({
					basePath: '',
					paths: [
						{
							path: 'my-path'
						},
						'other',
						'my-path/other'
					],
					entries: ['runtime', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test',
					renderer: 'jsdom'
				});
				btr.apply(compiler);
				assert.isTrue(pluginRegistered);
				return runBtr(createCompilation('state'), callbackStub).then(() => {
					assert.isTrue(callbackStub.calledOnce);
					assert.strictEqual(outputFileSync.callCount, 4);
					assert.isTrue(
						outputFileSync.secondCall.args[0].indexOf(
							path.join('support', 'fixtures', 'build-time-render', 'state', 'my-path', 'index.html')
						) > -1
					);
					assert.isTrue(
						outputFileSync.thirdCall.args[0].indexOf(
							path.join('support', 'fixtures', 'build-time-render', 'state', 'other', 'index.html')
						) > -1
					);
					assert.isTrue(
						outputFileSync
							.getCall(3)
							.args[0].indexOf(
								path.join(
									'support',
									'fixtures',
									'build-time-render',
									'state',
									'my-path',
									'other',
									'index.html'
								)
							) > -1
					);
					assert.strictEqual(
						normalise(outputFileSync.secondCall.args[1]),
						normalise(
							readFileSync(
								path.join(
									__dirname,
									'..',
									'..',
									'support',
									'fixtures',
									'build-time-render',
									'state',
									'expected',
									'my-path',
									'index.html'
								),
								'utf8'
							)
						)
					);
					assert.strictEqual(
						normalise(outputFileSync.thirdCall.args[1]),
						normalise(
							readFileSync(
								path.join(
									__dirname,
									'..',
									'..',
									'support',
									'fixtures',
									'build-time-render',
									'state',
									'expected',
									'other',
									'index.html'
								),
								'utf8'
							)
						)
					);
					assert.strictEqual(
						normalise(outputFileSync.getCall(3).args[1]),
						normalise(
							readFileSync(
								path.join(
									__dirname,
									'..',
									'..',
									'support',
									'fixtures',
									'build-time-render',
									'state',
									'expected',
									'my-path',
									'other',
									'index.html'
								),
								'utf8'
							)
						)
					);
				});
			});

			it('should statically build an index file for each route', () => {
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const btr = new Btr({
					basePath: '',
					paths: [
						{
							path: 'my-path'
						},
						'other',
						'my-path/other'
					],
					useHistory: true,
					entries: ['runtime', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test',
					renderer: 'jsdom'
				});
				btr.apply(compiler);
				assert.isTrue(pluginRegistered);
				return runBtr(createCompilation('state'), callbackStub).then(() => {
					assert.isTrue(callbackStub.calledOnce);
					assert.strictEqual(outputFileSync.callCount, 4);
					assert.isTrue(
						outputFileSync.secondCall.args[0].indexOf(
							path.join('support', 'fixtures', 'build-time-render', 'state', 'my-path', 'index.html')
						) > -1
					);
					assert.isTrue(
						outputFileSync.thirdCall.args[0].indexOf(
							path.join('support', 'fixtures', 'build-time-render', 'state', 'other', 'index.html')
						) > -1
					);
					assert.isTrue(
						outputFileSync
							.getCall(3)
							.args[0].indexOf(
								path.join(
									'support',
									'fixtures',
									'build-time-render',
									'state',
									'my-path',
									'other',
									'index.html'
								)
							) > -1
					);
					assert.strictEqual(
						normalise(outputFileSync.secondCall.args[1]),
						normalise(
							readFileSync(
								path.join(
									__dirname,
									'..',
									'..',
									'support',
									'fixtures',
									'build-time-render',
									'state',
									'expected',
									'my-path',
									'index.html'
								),
								'utf8'
							)
						)
					);
					assert.strictEqual(
						normalise(outputFileSync.thirdCall.args[1]),
						normalise(
							readFileSync(
								path.join(
									__dirname,
									'..',
									'..',
									'support',
									'fixtures',
									'build-time-render',
									'state',
									'expected',
									'other',
									'index.html'
								),
								'utf8'
							)
						)
					);
					assert.strictEqual(
						normalise(outputFileSync.getCall(3).args[1]),
						normalise(
							readFileSync(
								path.join(
									__dirname,
									'..',
									'..',
									'support',
									'fixtures',
									'build-time-render',
									'state',
									'expected',
									'my-path',
									'other',
									'index.html'
								),
								'utf8'
							)
						)
					);
				});
			});

			it('should auto discover paths to build from each rendered page', () => {
				compiler = {
					hooks: {
						afterEmit: {
							tapAsync: tapStub
						},
						normalModuleFactory: {
							tap: stub()
						}
					},
					options: {
						output: {
							path: path.join(
								__dirname,
								'..',
								'..',
								'support',
								'fixtures',
								'build-time-render',
								'state-auto-discovery'
							)
						}
					}
				};
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const btr = new Btr({
					basePath: '',
					useHistory: true,
					entries: ['runtime', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test',
					renderer: 'jsdom'
				});
				btr.apply(compiler);
				assert.isTrue(pluginRegistered);
				return runBtr(createCompilation('state-auto-discovery'), callbackStub).then(() => {
					assert.isTrue(callbackStub.calledOnce);
					assert.strictEqual(outputFileSync.callCount, 4);
					assert.isTrue(
						outputFileSync.secondCall.args[0].indexOf(
							path.join(
								'support',
								'fixtures',
								'build-time-render',
								'state-auto-discovery',
								'my-path',
								'index.html'
							)
						) > -1
					);
					assert.isTrue(
						outputFileSync.thirdCall.args[0].indexOf(
							path.join(
								'support',
								'fixtures',
								'build-time-render',
								'state-auto-discovery',
								'other',
								'index.html'
							)
						) > -1
					);
					assert.isTrue(
						outputFileSync
							.getCall(3)
							.args[0].indexOf(
								path.join(
									'support',
									'fixtures',
									'build-time-render',
									'state-auto-discovery',
									'my-path',
									'other',
									'index.html'
								)
							) > -1
					);
					assert.strictEqual(
						normalise(outputFileSync.secondCall.args[1]),
						normalise(
							readFileSync(
								path.join(
									__dirname,
									'..',
									'..',
									'support',
									'fixtures',
									'build-time-render',
									'state-auto-discovery',
									'expected',
									'my-path',
									'index.html'
								),
								'utf8'
							)
						)
					);
					assert.strictEqual(
						normalise(outputFileSync.thirdCall.args[1]),
						normalise(
							readFileSync(
								path.join(
									__dirname,
									'..',
									'..',
									'support',
									'fixtures',
									'build-time-render',
									'state-auto-discovery',
									'expected',
									'other',
									'index.html'
								),
								'utf8'
							)
						)
					);
					assert.strictEqual(
						normalise(outputFileSync.getCall(3).args[1]),
						normalise(
							readFileSync(
								path.join(
									__dirname,
									'..',
									'..',
									'support',
									'fixtures',
									'build-time-render',
									'state-auto-discovery',
									'expected',
									'my-path',
									'other',
									'index.html'
								),
								'utf8'
							)
						)
					);
				});
			});

			it('should not auto discover paths when option set to false', () => {
				compiler = {
					hooks: {
						afterEmit: {
							tapAsync: tapStub
						},
						normalModuleFactory: {
							tap: stub()
						}
					},
					options: {
						output: {
							path: path.join(
								__dirname,
								'..',
								'..',
								'support',
								'fixtures',
								'build-time-render',
								'state-auto-discovery'
							)
						}
					}
				};
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const btr = new Btr({
					basePath: '',
					useHistory: true,
					paths: ['other'],
					discoverPaths: false,
					entries: ['runtime', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test',
					renderer: 'jsdom'
				});
				btr.apply(compiler);
				assert.isTrue(pluginRegistered);
				return runBtr(createCompilation('state-auto-discovery'), callbackStub).then(() => {
					assert.isTrue(callbackStub.calledOnce);
					assert.strictEqual(outputFileSync.callCount, 2);
					assert.isTrue(
						outputFileSync.secondCall.args[0].indexOf(
							path.join(
								'support',
								'fixtures',
								'build-time-render',
								'state-auto-discovery',
								'other',
								'index.html'
							)
						) > -1
					);
					assert.strictEqual(
						normalise(outputFileSync.secondCall.args[1]),
						normalise(
							readFileSync(
								path.join(
									__dirname,
									'..',
									'..',
									'support',
									'fixtures',
									'build-time-render',
									'state-auto-discovery',
									'expected',
									'other',
									'index.html'
								),
								'utf8'
							)
						)
					);
				});
			});

			describe('static', () => {
				beforeEach(() => {
					outputPath = path.join(
						__dirname,
						'..',
						'..',
						'support',
						'fixtures',
						'build-time-render',
						'state-static'
					);
					compiler = {
						hooks: {
							afterEmit: {
								tapAsync: tapStub
							},
							normalModuleFactory: {
								tap: stub()
							}
						},
						options: {
							output: {
								path: outputPath
							}
						}
					};
				});

				it('should create index files for each route without js and css', () => {
					const fs = mockModule.getMock('fs-extra');
					const outputFileSync = stub();
					fs.outputFileSync = outputFileSync;
					fs.readFileSync = readFileSync;
					fs.existsSync = existsSync;
					const Btr = getBuildTimeRenderModule();
					const btr = new Btr({
						basePath: '',
						paths: [
							{
								path: 'my-path'
							},
							'other',
							'my-path/other'
						],
						static: true,
						entries: ['runtime', 'main'],
						root: 'app',
						puppeteerOptions: { args: ['--no-sandbox'] },
						scope: 'test',
						renderer: 'jsdom'
					});
					btr.apply(compiler);
					assert.isTrue(pluginRegistered);
					return runBtr(createCompilation('state-static'), callbackStub).then(() => {
						assert.isTrue(callbackStub.calledOnce);
						assert.strictEqual(outputFileSync.callCount, 4);
						assert.isTrue(
							outputFileSync.secondCall.args[0].indexOf(
								path.join(
									'support',
									'fixtures',
									'build-time-render',
									'state-static',
									'my-path',
									'index.html'
								)
							) > -1
						);
						assert.isTrue(
							outputFileSync.thirdCall.args[0].indexOf(
								path.join(
									'support',
									'fixtures',
									'build-time-render',
									'state-static',
									'other',
									'index.html'
								)
							) > -1
						);
						assert.isTrue(
							outputFileSync
								.getCall(3)
								.args[0].indexOf(
									path.join(
										'support',
										'fixtures',
										'build-time-render',
										'state-static',
										'my-path',
										'other',
										'index.html'
									)
								) > -1
						);
						assert.strictEqual(
							normalise(outputFileSync.secondCall.args[1]),
							normalise(
								readFileSync(
									path.join(
										__dirname,
										'..',
										'..',
										'support',
										'fixtures',
										'build-time-render',
										'state-static',
										'expected',
										'my-path',
										'index.html'
									),
									'utf8'
								)
							)
						);
						assert.strictEqual(
							normalise(outputFileSync.thirdCall.args[1]),
							normalise(
								readFileSync(
									path.join(
										__dirname,
										'..',
										'..',
										'support',
										'fixtures',
										'build-time-render',
										'state-static',
										'expected',
										'other',
										'index.html'
									),
									'utf8'
								)
							)
						);
						assert.strictEqual(
							normalise(outputFileSync.getCall(3).args[1]),
							normalise(
								readFileSync(
									path.join(
										__dirname,
										'..',
										'..',
										'support',
										'fixtures',
										'build-time-render',
										'state-static',
										'expected',
										'my-path',
										'other',
										'index.html'
									),
									'utf8'
								)
							)
						);
					});
				});

				it('should create index files for specified routes without js and css', () => {
					outputPath = path.join(
						__dirname,
						'..',
						'..',
						'support',
						'fixtures',
						'build-time-render',
						'state-static-per-path'
					);
					compiler = {
						hooks: {
							afterEmit: {
								tapAsync: tapStub
							},
							normalModuleFactory: {
								tap: stub()
							}
						},
						options: {
							output: {
								path: outputPath
							}
						}
					};
					const fs = mockModule.getMock('fs-extra');
					const outputFileSync = stub();
					fs.outputFileSync = outputFileSync;
					fs.readFileSync = readFileSync;
					fs.existsSync = existsSync;
					const Btr = getBuildTimeRenderModule();
					const btr = new Btr({
						basePath: '',
						paths: [
							{
								path: 'my-path',
								static: true
							},
							'other',
							'my-path/other'
						],
						entries: ['runtime', 'main'],
						root: 'app',
						puppeteerOptions: { args: ['--no-sandbox'] },
						scope: 'test',
						renderer: 'jsdom'
					});
					btr.apply(compiler);
					assert.isTrue(pluginRegistered);
					return runBtr(createCompilation('state-static-per-path'), callbackStub).then(() => {
						assert.isTrue(callbackStub.calledOnce);
						assert.strictEqual(outputFileSync.callCount, 4);
						assert.isTrue(
							outputFileSync.secondCall.args[0].indexOf(
								path.join(
									'support',
									'fixtures',
									'build-time-render',
									'state-static-per-path',
									'my-path',
									'index.html'
								)
							) > -1
						);
						assert.isTrue(
							outputFileSync.thirdCall.args[0].indexOf(
								path.join(
									'support',
									'fixtures',
									'build-time-render',
									'state-static-per-path',
									'other',
									'index.html'
								)
							) > -1
						);
						assert.isTrue(
							outputFileSync
								.getCall(3)
								.args[0].indexOf(
									path.join(
										'support',
										'fixtures',
										'build-time-render',
										'state-static-per-path',
										'my-path',
										'other',
										'index.html'
									)
								) > -1
						);
						assert.strictEqual(
							normalise(outputFileSync.secondCall.args[1]),
							normalise(
								readFileSync(
									path.join(
										__dirname,
										'..',
										'..',
										'support',
										'fixtures',
										'build-time-render',
										'state-static-per-path',
										'expected',
										'my-path',
										'index.html'
									),
									'utf8'
								)
							)
						);
						assert.strictEqual(
							normalise(outputFileSync.thirdCall.args[1]),
							normalise(
								readFileSync(
									path.join(
										__dirname,
										'..',
										'..',
										'support',
										'fixtures',
										'build-time-render',
										'state-static-per-path',
										'expected',
										'other',
										'index.html'
									),
									'utf8'
								)
							)
						);
						assert.strictEqual(
							normalise(outputFileSync.getCall(3).args[1]),
							normalise(
								readFileSync(
									path.join(
										__dirname,
										'..',
										'..',
										'support',
										'fixtures',
										'build-time-render',
										'state-static-per-path',
										'expected',
										'my-path',
										'other',
										'index.html'
									),
									'utf8'
								)
							)
						);
					});
				});

				it('should create index without js and css even with no paths', () => {
					outputPath = path.join(
						__dirname,
						'..',
						'..',
						'support',
						'fixtures',
						'build-time-render',
						'state-static-no-paths'
					);
					compiler = {
						hooks: {
							afterEmit: {
								tapAsync: tapStub
							},
							normalModuleFactory: {
								tap: stub()
							}
						},
						options: {
							output: {
								path: outputPath
							}
						}
					};
					const fs = mockModule.getMock('fs-extra');
					const outputFileSync = stub();
					fs.outputFileSync = outputFileSync;
					fs.readFileSync = readFileSync;
					fs.existsSync = existsSync;
					const Btr = getBuildTimeRenderModule();
					const btr = new Btr({
						basePath: '',
						static: true,
						entries: ['runtime', 'main'],
						root: 'app',
						puppeteerOptions: { args: ['--no-sandbox'] },
						scope: 'test',
						renderer: 'jsdom'
					});
					btr.apply(compiler);
					assert.isTrue(pluginRegistered);
					return runBtr(createCompilation('state-static-no-paths'), callbackStub).then(() => {
						assert.isTrue(callbackStub.calledOnce);
						assert.strictEqual(outputFileSync.callCount, 1);
						assert.isTrue(
							outputFileSync.firstCall.args[0].indexOf(
								path.join(
									'support',
									'fixtures',
									'build-time-render',
									'state-static-no-paths',
									'index.html'
								)
							) > -1
						);
						assert.strictEqual(
							normalise(outputFileSync.firstCall.args[1]),
							normalise(
								readFileSync(
									path.join(
										__dirname,
										'..',
										'..',
										'support',
										'fixtures',
										'build-time-render',
										'state-static-no-paths',
										'expected',
										'index.html'
									),
									'utf8'
								)
							)
						);
					});
				});
			});
		});

		describe('build bridge', () => {
			it('should call node module, return result to render in html, and write to cache in bundle', () => {
				outputPath = path.join(
					__dirname,
					'..',
					'..',
					'support',
					'fixtures',
					'build-time-render',
					'build-bridge'
				);
				compiler = {
					hooks: {
						afterEmit: {
							tapAsync: tapStub
						},
						normalModuleFactory: {
							tap: stub()
						}
					},
					options: {
						output: {
							path: outputPath,
							jsonpFunction: 'foo'
						}
					}
				};
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const basePath = path.join(process.cwd(), 'tests/support/fixtures/build-time-render/build-bridge');
				const btr = new Btr({
					basePath,
					paths: [],
					entries: ['bootstrap', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test',
					renderer: 'jsdom'
				});
				btr.apply(compiler);
				const callback = normalModuleReplacementPluginStub.firstCall.args[1];
				const resource = {
					context: `${basePath}/foo/bar`,
					request: `something.build.js`,
					contextInfo: {
						issuer: 'foo'
					}
				};
				callback(resource);
				assert.equal(
					resource.request,
					"@dojo/webpack-contrib/build-time-render/build-bridge-loader?modulePath='foo/bar/something.build.js'!@dojo/webpack-contrib/build-time-render/bridge"
				);
				return runBtr(createCompilation('build-bridge'), callbackStub).then(() => {
					const calls = outputFileSync.getCalls();
					let html = '';
					let blocks = '';
					let block = '';
					calls.map((call) => {
						const [filename, content] = call.args;
						if (filename.match(/index\.html$/)) {
							html = content;
						}
						if (filename.match(/blocks\.js$/)) {
							blocks = content;
						}
						if (filename.match(/block-.*\.js$/)) {
							block = content;
						}
					});
					assert.strictEqual(
						normalise(html),
						normalise(readFileSync(path.join(outputPath, 'expected', 'index.html'), 'utf-8'))
					);
					assert.strictEqual(
						normalise(blocks),
						normalise(readFileSync(path.join(outputPath, 'expected', 'blocks.js'), 'utf-8'))
					);
					assert.strictEqual(
						normalise(block),
						normalise(readFileSync(path.join(outputPath, 'expected', 'block.js'), 'utf-8'))
					);
				});
			});

			it('should call node module, return result to render in html, and write to cache in bundle with new hashes', () => {
				outputPath = path.join(
					__dirname,
					'..',
					'..',
					'support',
					'fixtures',
					'build-time-render',
					'build-bridge-hash'
				);
				compiler = {
					hooks: {
						afterEmit: {
							tapAsync: tapStub
						},
						normalModuleFactory: {
							tap: stub()
						}
					},
					options: {
						output: {
							path: outputPath,
							jsonpFunction: 'foo'
						}
					}
				};
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const basePath = path.join(process.cwd(), 'tests/support/fixtures/build-time-render/build-bridge-hash');
				const btr = new Btr({
					basePath,
					paths: [],
					entries: ['bootstrap', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test',
					renderer: 'jsdom'
				});
				btr.apply(compiler);
				const callback = normalModuleReplacementPluginStub.firstCall.args[1];
				const resource = {
					context: `${basePath}/foo/bar`,
					request: `something.build.js`,
					contextInfo: {
						issuer: 'foo'
					}
				};
				callback(resource);
				return runBtr(createCompilation('build-bridge-hash'), callbackStub).then(() => {
					const calls = outputFileSync.getCalls();
					let html = '';
					let blocks = '';
					let blocksFileName = '';
					let block = '';
					let blockFilename;
					let originalManifest = '';
					let manifest = '';
					let bootstrap = '';
					let bootstrapFilename = '';
					calls.forEach((call) => {
						const [filename, content] = call.args;
						const parsedFilename = path.parse(filename);
						if (filename.match(/index\.html$/)) {
							html = content;
						}
						if (filename.match(/blocks\..*\.bundle\.js$/)) {
							blocks = content;
							blocksFileName = `${parsedFilename.name}${parsedFilename.ext}`;
						}
						if (filename.match(/block-.*\.js$/)) {
							block = content;
							blockFilename = `${parsedFilename.name}${parsedFilename.ext}`;
						}
						if (filename.match(/bootstrap\..*\.bundle\.js$/)) {
							bootstrap = content;
							bootstrapFilename = `${parsedFilename.name}${parsedFilename.ext}`;
						}
						if (filename.match(/manifest\.original\.json$/)) {
							originalManifest = content;
						}
						if (filename.match(/manifest\.json$/)) {
							manifest = content;
						}
					});
					assert.strictEqual(
						normalise(html),
						normalise(readFileSync(path.join(outputPath, 'expected', 'index.html'), 'utf-8'))
					);
					assert.strictEqual(bootstrapFilename, 'bootstrap.247d4597a12706983d2c.bundle.js');
					assert.strictEqual(
						normalise(bootstrap),
						normalise(readFileSync(path.join(outputPath, 'expected', 'bootstrap.js'), 'utf-8'))
					);
					assert.strictEqual(blocksFileName, 'blocks.abcdefghij0123456789.bundle.js');
					assert.strictEqual(
						normalise(blocks),
						normalise(readFileSync(path.join(outputPath, 'expected', 'blocks.js'), 'utf-8'))
					);
					assert.strictEqual(blockFilename, 'block-49e457933c3c36eeb77f.9eba5eaa6f8cfe7b34e3.bundle.js');
					assert.strictEqual(
						normalise(block),
						normalise(readFileSync(path.join(outputPath, 'expected', 'block.js'), 'utf-8'))
					);
					assert.strictEqual(
						normalise(originalManifest),
						normalise(readFileSync(path.join(outputPath, 'expected', 'manifest.original.json'), 'utf-8'))
					);
					assert.strictEqual(
						normalise(manifest),
						normalise(readFileSync(path.join(outputPath, 'expected', 'manifest.json'), 'utf-8'))
					);
				});
			});
		});

		describe('build bridge - single bundle', () => {
			it('should call node module, return result to render in html, and write to cache in single bundle', () => {
				outputPath = path.join(
					__dirname,
					'..',
					'..',
					'support',
					'fixtures',
					'build-time-render',
					'build-bridge-single-bundle'
				);
				compiler = {
					hooks: {
						afterEmit: {
							tapAsync: tapStub
						},
						normalModuleFactory: {
							tap: stub()
						}
					},
					options: {
						output: {
							path: outputPath,
							jsonpFunction: 'foo'
						}
					}
				};
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const basePath = path.join(
					process.cwd(),
					'tests/support/fixtures/build-time-render/build-bridge-single-bundle'
				);
				const btr = new Btr({
					basePath,
					paths: [],
					entries: ['bootstrap', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test',
					renderer: 'jsdom',
					sync: true
				});
				btr.apply(compiler);
				const callback = normalModuleReplacementPluginStub.firstCall.args[1];
				const resource = {
					context: `${basePath}/foo/bar`,
					request: `something.build.js`,
					contextInfo: {
						issuer: 'foo'
					}
				};
				callback(resource);
				assert.equal(
					resource.request,
					"@dojo/webpack-contrib/build-time-render/build-bridge-loader?modulePath='foo/bar/something.build.js'!@dojo/webpack-contrib/build-time-render/bridge"
				);
				return runBtr(createCompilation('build-bridge-single-bundle'), callbackStub).then(() => {
					const calls = outputFileSync.getCalls();
					let html = '';
					let main = '';
					calls.map((call) => {
						const [filename, content] = call.args;
						if (filename.match(/index\.html$/)) {
							html = content;
						}
						if (filename.match(/main\.js$/)) {
							main = content;
						}
					});
					assert.strictEqual(
						normalise(html),
						normalise(readFileSync(path.join(outputPath, 'expected', 'index.html'), 'utf-8'))
					);
					assert.strictEqual(
						normalise(main),
						normalise(readFileSync(path.join(outputPath, 'expected', 'main.js'), 'utf-8'))
					);
				});
			});
		});

		describe('build bridge with blocks only', () => {
			it('should call node module, return result to render in html, and write to cache in bundle', () => {
				outputPath = path.join(
					__dirname,
					'..',
					'..',
					'support',
					'fixtures',
					'build-time-render',
					'build-bridge-blocks-only'
				);
				compiler = {
					hooks: {
						afterEmit: {
							tapAsync: tapStub
						},
						normalModuleFactory: {
							tap: stub()
						}
					},
					options: {
						output: {
							path: outputPath,
							jsonpFunction: 'foo'
						}
					}
				};
				const fs = mockModule.getMock('fs-extra');
				const outputFileSync = stub();
				fs.outputFileSync = outputFileSync;
				fs.readFileSync = readFileSync;
				fs.existsSync = existsSync;
				const Btr = getBuildTimeRenderModule();
				const basePath = path.join(
					process.cwd(),
					'tests/support/fixtures/build-time-render/build-bridge-blocks-only'
				);
				const btr = new Btr({
					basePath,
					paths: [],
					entries: ['bootstrap', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] },
					scope: 'test',
					renderer: 'jsdom',
					writeHtml: false
				});
				btr.apply(compiler);
				const callback = normalModuleReplacementPluginStub.firstCall.args[1];
				const resource = {
					context: `${basePath}/foo/bar`,
					request: `something.build.js`,
					contextInfo: {
						issuer: 'foo'
					}
				};
				callback(resource);
				assert.equal(
					resource.request,
					"@dojo/webpack-contrib/build-time-render/build-bridge-loader?modulePath='foo/bar/something.build.js'!@dojo/webpack-contrib/build-time-render/bridge"
				);
				return runBtr(createCompilation('build-bridge-blocks-only'), callbackStub).then(() => {
					const calls = outputFileSync.getCalls();
					let html = '';
					let blocks = '';
					let block = '';
					calls.map((call) => {
						const [filename, content] = call.args;
						if (filename.match(/index\.html$/)) {
							html = content;
						}
						if (filename.match(/blocks\.js$/)) {
							blocks = content;
						}
						if (filename.match(/block-.*\.js$/)) {
							block = content;
						}
					});
					assert.strictEqual(
						normalise(html),
						normalise(readFileSync(path.join(outputPath, 'expected', 'index.html'), 'utf-8'))
					);
					assert.strictEqual(
						normalise(blocks),
						normalise(readFileSync(path.join(outputPath, 'expected', 'blocks.js'), 'utf-8'))
					);
					assert.strictEqual(
						normalise(block),
						normalise(readFileSync(path.join(outputPath, 'expected', 'block.js'), 'utf-8'))
					);
				});
			});
		});
	});
});
