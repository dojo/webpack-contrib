import MockModule from '../../support/MockModule';
import { stub } from 'sinon';
import * as path from 'path';
import { readFileSync, existsSync } from 'fs-extra';

const { afterEach, beforeEach, describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

let mockModule: MockModule;
let outputPath: string;
let compiler: any;
let pluginRegistered = false;
let runBtr: Function = () => {};
const pluginStub = (type: string, cb: Function) => {
	pluginRegistered = true;
	runBtr = cb;
};

function normalise(value: string) {
	return value.replace(/^(\s*)(\r\n?|\n)/gm, '').trim();
}

const callbackStub = stub();

describe('build-time-render', () => {
	beforeEach(() => {
		mockModule = new MockModule('../../../src/build-time-render/BuildTimeRender', require);
		mockModule.dependencies(['fs-extra']);
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
				plugin: pluginStub,
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
				root: 'app'
			});
			btr.apply(compiler);
			assert.isTrue(pluginRegistered);
			return runBtr('', callbackStub).then(() => {
				assert.isTrue(callbackStub.calledOnce);
				const expected = readFileSync(path.join(outputPath, 'expected', 'index.html'), 'utf-8');
				const actual = outputFileSync.firstCall.args[1];
				assert.strictEqual(actual, expected.replace(/^(\s*)(\r\n?|\n)/gm, '').trim());
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
				useManifest: true,
				entries: ['runtime', 'main'],
				root: 'app'
			});
			btr.apply(compiler);
			assert.isTrue(pluginRegistered);
			return runBtr('', callbackStub).then(() => {
				assert.isTrue(callbackStub.calledOnce);
				const expected = readFileSync(path.join(outputPath, 'expected', 'index.html'), 'utf-8');
				const actual = outputFileSync.firstCall.args[1];
				assert.strictEqual(actual, expected.replace(/^(\s*)(\r\n?|\n)/gm, '').trim());
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
				useManifest: true,
				entries: ['runtime', 'main'],
				root: 'app'
			});
			btr.apply(compiler);
			assert.isTrue(pluginRegistered);
			return runBtr('', callbackStub).then(() => {
				assert.isTrue(callbackStub.calledOnce);
				const expected = readFileSync(path.join(outputPath, 'expected', 'indexWithPaths.html'), 'utf-8');
				const actual = outputFileSync.firstCall.args[1];
				assert.strictEqual(actual, expected.replace(/^(\s*)(\r\n?|\n)/gm, '').trim());
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
				useManifest: true,
				entries: ['runtime', 'main']
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
				useManifest: true,
				entries: ['runtime', 'main'],
				root: 'app'
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
				plugin: pluginStub,
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
				useManifest: true,
				entries: ['runtime', 'main'],
				root: 'app'
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
					outputFileSync.secondCall.args[1],
					normalise(readFileSync(outputFileSync.getCall(1).args[0], 'utf8'))
				);
				assert.strictEqual(
					outputFileSync.thirdCall.args[1],
					normalise(readFileSync(outputFileSync.getCall(2).args[0], 'utf8'))
				);
				assert.strictEqual(
					outputFileSync.getCall(3).args[1],
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
				useManifest: true,
				entries: ['runtime', 'main'],
				root: 'app'
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
					outputFileSync.secondCall.args[1],
					normalise(readFileSync(outputFileSync.getCall(1).args[0], 'utf8'))
				);
				assert.strictEqual(
					outputFileSync.thirdCall.args[1],
					normalise(readFileSync(outputFileSync.getCall(2).args[0], 'utf8'))
				);
				assert.strictEqual(
					outputFileSync.getCall(3).args[1],
					normalise(readFileSync(outputFileSync.getCall(3).args[0], 'utf8'))
				);
			});
		});
	});
});
