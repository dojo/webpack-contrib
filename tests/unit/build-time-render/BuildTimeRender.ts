import { readFileSync, existsSync } from 'fs-extra';
import * as path from 'path';
import { stub } from 'sinon';
import MockModule from '../../support/MockModule';

const { afterEach, beforeEach, describe, it } = intern.getInterface('bdd');
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

function normalise(value: string) {
	return value.replace(/^(\s*)(\r\n?|\n)/gm, '').trim();
}

const callbackStub = stub();

const createCompilation = (
	type:
		| 'state'
		| 'state-scoped'
		| 'state-static'
		| 'state-static-per-path'
		| 'state-static-no-paths'
		| 'hash'
		| 'build-bridge'
		| 'build-bridge-hash'
		| 'build-bridge-error'
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
			const Btr = mockModule.getModuleUnderTest().default;
			const btr = new Btr({
				entries: ['runtime', 'main'],
				root: 'missing',
				puppeteerOptions: { args: ['--no-sandbox'] }
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
			const Btr = mockModule.getModuleUnderTest().default;
			const basePath = path.join(process.cwd(), 'tests/support/fixtures/build-time-render/build-bridge-error');
			const btr = new Btr({
				basePath,
				paths: [],
				entries: ['bootstrap', 'main'],
				root: 'app',
				puppeteerOptions: { args: ['--no-sandbox'] }
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
			const Btr = mockModule.getModuleUnderTest().default;
			const basePath = path.join(process.cwd(), 'tests/support/fixtures/build-time-render/build-bridge-error');
			const btr = new Btr({
				basePath,
				paths: [],
				entries: ['bootstrap', 'main'],
				root: 'app',
				puppeteerOptions: { args: ['--no-sandbox'] }
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
			const Btr = mockModule.getModuleUnderTest().default;
			const basePath = path.join(process.cwd(), 'tests/support/fixtures/build-time-render/build-bridge-error');
			const btr = new Btr({
				basePath,
				entries: ['runtime', 'main'],
				root: 'app',
				puppeteerOptions: { args: ['--no-sandbox'] }
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
			const Btr = mockModule.getModuleUnderTest().default;
			const btr = new Btr({
				paths: [],
				entries: ['runtime', 'main'],
				root: 'app',
				puppeteerOptions: { args: ['--no-sandbox'] }
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
			const Btr = mockModule.getModuleUnderTest().default;
			const btr = new Btr({
				paths: [
					{
						path: '#my-path'
					}
				],
				entries: ['runtime', 'main'],
				root: 'app',
				puppeteerOptions: { args: ['--no-sandbox'] }
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
			const Btr = mockModule.getModuleUnderTest().default;
			const btr = new Btr({
				paths: [],
				entries: ['runtime', 'main'],
				puppeteerOptions: { args: ['--no-sandbox'] }
			});
			btr.apply(compiler);
			assert.isFalse(pluginRegistered);
		});

		it('should not inject btr when no output path can be found', () => {
			const fs = mockModule.getMock('fs-extra');
			const outputFileSync = stub();
			fs.outputFileSync = outputFileSync;
			fs.readFileSync = readFileSync;
			fs.existsSync = existsSync;
			const Btr = mockModule.getModuleUnderTest().default;
			const btr = new Btr({
				paths: [],
				entries: ['runtime', 'main'],
				root: 'app',
				puppeteerOptions: { args: ['--no-sandbox'] }
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
			const Btr = mockModule.getModuleUnderTest().default;
			const btr = new Btr({
				paths: [
					{
						path: 'my-path'
					},
					'other',
					'my-path/other'
				],
				entries: ['runtime', 'main'],
				root: 'app',
				puppeteerOptions: { args: ['--no-sandbox'] }
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
			const Btr = mockModule.getModuleUnderTest().default;
			const btr = new Btr({
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
				puppeteerOptions: { args: ['--no-sandbox'] }
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
				const Btr = mockModule.getModuleUnderTest().default;
				const btr = new Btr({
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
					puppeteerOptions: { args: ['--no-sandbox'] }
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
							path.join('support', 'fixtures', 'build-time-render', 'state-static', 'other', 'index.html')
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
				const Btr = mockModule.getModuleUnderTest().default;
				const btr = new Btr({
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
					puppeteerOptions: { args: ['--no-sandbox'] }
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
				const Btr = mockModule.getModuleUnderTest().default;
				const btr = new Btr({
					static: true,
					entries: ['runtime', 'main'],
					root: 'app',
					puppeteerOptions: { args: ['--no-sandbox'] }
				});
				btr.apply(compiler);
				assert.isTrue(pluginRegistered);
				return runBtr(createCompilation('state-static-no-paths'), callbackStub).then(() => {
					assert.isTrue(callbackStub.calledOnce);
					assert.strictEqual(outputFileSync.callCount, 1);
					assert.isTrue(
						outputFileSync.firstCall.args[0].indexOf(
							path.join('support', 'fixtures', 'build-time-render', 'state-static-no-paths', 'index.html')
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

	describe('application scope', () => {
		beforeEach(() => {
			outputPath = path.join(__dirname, '..', '..', 'support', 'fixtures', 'build-time-render', 'state-scoped');
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

		it('Should use application scope', () => {
			const fs = mockModule.getMock('fs-extra');
			const outputFileSync = stub();
			fs.outputFileSync = outputFileSync;
			fs.readFileSync = readFileSync;
			fs.existsSync = existsSync;
			const Btr = mockModule.getModuleUnderTest().default;
			const btr = new Btr({
				paths: [
					{
						path: 'my-path'
					},
					'other',
					'my-path/other'
				],
				entries: ['runtime', 'main'],
				root: 'app',
				scope: 'app-scope',
				puppeteerOptions: { args: ['--no-sandbox'] }
			});
			btr.apply(compiler);
			assert.isTrue(pluginRegistered);
			return runBtr(createCompilation('state-scoped'), callbackStub).then(() => {
				assert.isTrue(callbackStub.calledOnce);
				assert.strictEqual(outputFileSync.callCount, 4);
				assert.isTrue(
					outputFileSync.secondCall.args[0].indexOf(
						path.join('support', 'fixtures', 'build-time-render', 'state-scoped', 'my-path', 'index.html')
					) > -1
				);
				assert.isTrue(
					outputFileSync.thirdCall.args[0].indexOf(
						path.join('support', 'fixtures', 'build-time-render', 'state-scoped', 'other', 'index.html')
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
								'state-scoped',
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
								'state-scoped',
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
								'state-scoped',
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
								'state-scoped',
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
	});

	describe('build bridge', () => {
		it('should call node module, return result to render in html, and write to cache in bundle', () => {
			outputPath = path.join(__dirname, '..', '..', 'support', 'fixtures', 'build-time-render', 'build-bridge');
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
			const Btr = mockModule.getModuleUnderTest().default;
			const basePath = path.join(process.cwd(), 'tests/support/fixtures/build-time-render/build-bridge');
			const btr = new Btr({
				basePath,
				paths: [],
				entries: ['bootstrap', 'main'],
				root: 'app',
				puppeteerOptions: { args: ['--no-sandbox'] }
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
			const Btr = mockModule.getModuleUnderTest().default;
			const basePath = path.join(process.cwd(), 'tests/support/fixtures/build-time-render/build-bridge-hash');
			const btr = new Btr({
				basePath,
				paths: [],
				entries: ['bootstrap', 'main'],
				root: 'app',
				puppeteerOptions: { args: ['--no-sandbox'] }
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
});
