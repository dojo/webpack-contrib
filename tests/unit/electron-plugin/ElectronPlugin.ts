const { afterEach, beforeEach, describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');
import MockModule from '../../support/MockModule';
import { stub } from 'sinon';

let compiler: any;
let mockModule: MockModule;
let runner: any = {};
const doneStub = (name: string, cb: Function) => {
	runner[name] = cb;
};

let defineStub = stub();
let normalReplacementStub = stub();
let writeFileSyncStub = stub();
let electronPackagerStub = stub();

describe('ElectronPlugin', () => {
	beforeEach(() => {
		mockModule = new MockModule('../../../src/electron-plugin/ElectronPlugin', require);

		mockModule.proxy('webpack', {
			DefinePlugin: defineStub.returns({ apply: () => {} }),
			NormalModuleReplacementPlugin: normalReplacementStub.returns({ apply: () => {} })
		});

		mockModule.proxy('fs', {
			writeFileSync: writeFileSyncStub,
			existsSync: () => false
		});

		mockModule.proxy('electron-packager', electronPackagerStub.returns(Promise.resolve()));

		mockModule.proxy('path', {
			resolve: () => 'resolved-path'
		});

		compiler = {
			hooks: {
				done: {
					tapAsync: doneStub
				}
			}
		};
	});

	afterEach(() => {
		mockModule.destroy();
		defineStub.resetHistory();
		normalReplacementStub.resetHistory();
		writeFileSyncStub.resetHistory();
	});

	it('defines constants based on options', async () => {
		const ElectronPlugin = mockModule.getModuleUnderTest().default;
		const electronPlugin = new ElectronPlugin({
			electron: {
				browser: {
					foo: 'bar'
				}
			},
			watch: true,
			serve: true,
			port: 555
		});
		electronPlugin.apply(compiler);

		await new Promise((resolve) => {
			runner['ElectronPlugin']({}, () => {
				resolve();
			});
		});

		assert.isTrue(
			defineStub.calledWith({
				ELECTRON_BROWSER_OPTIONS: JSON.stringify({ width: 800, height: 600, foo: 'bar' }),
				ELECTRON_WATCH_SERVE: 'true',
				ELECTRON_SERVE_PORT: '555'
			})
		);
	});

	it('rewrites the package json with a new main file', async () => {
		const ElectronPlugin = mockModule.getModuleUnderTest().default;
		const electronPlugin = new ElectronPlugin({});
		electronPlugin.apply(compiler);

		await new Promise((resolve) => {
			runner['ElectronPlugin']({}, () => {
				resolve();
			});
		});

		assert.isTrue(
			writeFileSyncStub.calledWith(
				'resolved-path',
				JSON.stringify({
					main: 'main.electron.js'
				})
			)
		);
	});

	it('does not call packager if not in dist mode and not watch mode', async () => {
		const ElectronPlugin = mockModule.getModuleUnderTest().default;
		const electronPlugin = new ElectronPlugin({});
		electronPlugin.apply(compiler);

		await new Promise((resolve) => {
			runner['ElectronPlugin']({}, () => {
				resolve();
			});
		});

		assert.isFalse(electronPackagerStub.called);
	});

	it('calls packager if in dist mode and not watch mode', async () => {
		const ElectronPlugin = mockModule.getModuleUnderTest().default;
		const electronPlugin = new ElectronPlugin({
			dist: true,
			watch: false
		});
		electronPlugin.apply(compiler);

		await new Promise((resolve) => {
			runner['ElectronPlugin']({}, () => {
				resolve();
			});
		});

		assert.isTrue(electronPackagerStub.called);
	});
});
