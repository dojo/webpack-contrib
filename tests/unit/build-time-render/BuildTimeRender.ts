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
			const btr = new Btr({
				entries: ['runtime', 'main'],
				root: 'app',
				puppeteerOptions: { args: ['--no-sandbox'] }
			});
			btr.apply(compiler);
			assert.isTrue(pluginRegistered);
			return runBtr('', callbackStub).then(() => {
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
			return runBtr('', callbackStub).then(() => {
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
			return runBtr('', callbackStub).then(() => {
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
			return runBtr('', callbackStub).then(() => {
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
			return runBtr('', callbackStub).then(() => {
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
					normalise(readFileSync(outputFileSync.getCall(1).args[0], 'utf8'))
				);
				assert.strictEqual(
					normalise(outputFileSync.thirdCall.args[1]),
					normalise(readFileSync(outputFileSync.getCall(2).args[0], 'utf8'))
				);
				assert.strictEqual(
					normalise(outputFileSync.getCall(3).args[1]),
					normalise(readFileSync(outputFileSync.getCall(3).args[0], 'utf8'))
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
			return runBtr('', callbackStub).then(() => {
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
					normalise(readFileSync(outputFileSync.getCall(1).args[0], 'utf8'))
				);
				assert.strictEqual(
					normalise(outputFileSync.thirdCall.args[1]),
					normalise(readFileSync(outputFileSync.getCall(2).args[0], 'utf8'))
				);
				assert.strictEqual(
					normalise(outputFileSync.getCall(3).args[1]),
					normalise(readFileSync(outputFileSync.getCall(3).args[0], 'utf8'))
				);
			});
		});
	});

	describe('build bridge', () => {
		beforeEach(() => {
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
						path: outputPath
					}
				}
			};
		});

		it('should call node module, return result to render in html, and write to cache in bundle', () => {
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
				entries: ['runtime', 'main'],
				root: 'app',
				puppeteerOptions: { args: ['--no-sandbox'] }
			});
			btr.apply(compiler);
			const callback = normalModuleReplacementPluginStub.firstCall.args[1];
			const resource = {
				context: `${basePath}/foo/bar`,
				request: `something.build.js`
			};
			callback(resource);
			assert.equal(
				resource.request,
				"@dojo/webpack-contrib/build-time-render/build-bridge-loader?modulePath='foo/bar/something.build.js'!@dojo/webpack-contrib/build-time-render/bridge"
			);
			return runBtr('', callbackStub).then(() => {
				const html = outputFileSync.firstCall.args[1];
				const source = outputFileSync.secondCall.args[1];
				const map = outputFileSync.thirdCall.args[1];
				assert.strictEqual(
					normalise(html),
					normalise(readFileSync(path.join(outputPath, 'expected', 'index.html'), 'utf-8'))
				);
				assert.strictEqual(
					normalise(source),
					normalise(readFileSync(path.join(outputPath, 'expected', 'main.js'), 'utf-8'))
				);
				assert.strictEqual(
					normalise(map),
					normalise(readFileSync(path.join(outputPath, 'expected', 'main.js.map'), 'utf-8'))
				);
			});
		});
	});
});
