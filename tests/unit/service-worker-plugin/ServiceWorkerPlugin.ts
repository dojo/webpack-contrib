import { spy, stub } from 'sinon';
import { Compiler } from 'webpack';
import MockModule from '../../support/MockModule';
import { createCompilation, createCompiler } from '../../support/util';

const { assert } = intern.getPlugin('chai');
const { describe, it, beforeEach, afterEach } = intern.getInterface('bdd');

let compiler: Compiler;
let mockModule: MockModule;

describe('ServiceWorkerPlugin', () => {
	beforeEach(() => {
		compiler = createCompiler();
		mockModule = new MockModule('../../../src/service-worker-plugin/ServiceWorkerPlugin', require);
		mockModule.dependencies(['copy-webpack-plugin', 'workbox-webpack-plugin']);
		mockModule.getMock('copy-webpack-plugin').ctor.returns({ apply: stub() });
		mockModule.getMock('workbox-webpack-plugin').GenerateSW.returns({ apply: stub() });
	});

	afterEach(() => {
		mockModule.destroy();
	});

	it('should copy custom service workers to the output directory', () => {
		const swPath = '/path/to/custom-sw.js';
		const ServiceWorkerPlugin = mockModule.getModuleUnderTest().default;
		const plugin = new ServiceWorkerPlugin(swPath);
		const next = spy();
		const CopyPlugin = mockModule.getMock('copy-webpack-plugin').ctor;
		plugin.apply(compiler);
		const compilation = createCompilation(compiler);
		compiler.hooks.beforeRun.callAsync(compilation, next);
		assert.isTrue(next.called);
		assert.deepEqual(CopyPlugin.firstCall.args, [{ patterns: [{ from: swPath, to: 'service-worker.js' }] }]);
	});

	it('should throw an error with an invalid service worker path', () => {
		const ServiceWorkerPlugin = mockModule.getModuleUnderTest().default;
		const plugin = new ServiceWorkerPlugin('');

		assert.throws(() => plugin.apply(compiler), Error, 'The service worker path must be a non-empty string');
	});

	it('should generate a service worker', () => {
		const ServiceWorkerPlugin = mockModule.getModuleUnderTest().default;
		const GenerateSW = mockModule.getMock('workbox-webpack-plugin').GenerateSW;
		const plugin = new ServiceWorkerPlugin({
			bundles: ['main'],
			excludeBundles: ['extra'],
			cachePrefix: 'my-app',
			clientsClaim: true,
			importScripts: ['first.js', 'second.js'],
			skipWaiting: true,
			routes: [{ urlPattern: '.*{png|gif|jpg|svg}', strategy: 'cacheFirst' }],
			precache: {
				baseDir: '/base',
				ignore: ['*.txt'],
				include: ['*'],
				index: '/index',
				maxCacheSize: 500,
				strict: false,
				symlinks: false
			}
		});
		plugin.apply(compiler);
		assert.deepEqual(GenerateSW.firstCall.args, [
			{
				cacheId: 'my-app',
				chunks: ['main'],
				clientsClaim: true,
				directoryIndex: '/index',
				excludeChunks: ['extra'],
				globDirectory: '/base',
				globFollow: false,
				globIgnores: ['*.txt'],
				globPatterns: ['*'],
				globStrict: false,
				importScripts: ['first.js', 'second.js'],
				importWorkboxFrom: 'local',
				maximumFileSizeToCacheInBytes: 500,
				skipWaiting: true,
				runtimeCaching: [{ urlPattern: new RegExp('.*{png|gif|jpg|svg}'), handler: 'cacheFirst', options: {} }]
			}
		]);
	});

	it('should allow undefined options', () => {
		const ServiceWorkerPlugin = mockModule.getModuleUnderTest().default;
		const GenerateSW = mockModule.getMock('workbox-webpack-plugin').GenerateSW;
		const plugin = new ServiceWorkerPlugin({});
		plugin.apply(compiler);
		assert.deepEqual(GenerateSW.firstCall.args, [
			{
				importScripts: [],
				importWorkboxFrom: 'local',
				runtimeCaching: []
			}
		]);
	});

	it('should throw an error with invalid routes', () => {
		const ServiceWorkerPlugin = mockModule.getModuleUnderTest().default;

		assert.throws(
			() => {
				const plugin = new ServiceWorkerPlugin({
					routes: [{ strategy: 'cacheFirst' }]
				});
				plugin.apply(compiler);
			},
			Error,
			'Each route must have both a `urlPattern` and `strategy`'
		);
		assert.throws(
			() => {
				const plugin = new ServiceWorkerPlugin({
					routes: [{ urlPattern: '.*{png|gif|jpg|svg}' }]
				});
				plugin.apply(compiler);
			},
			Error,
			'Each route must have both a `urlPattern` and `strategy`'
		);
	});

	it('should ignore unsupported options', () => {
		const ServiceWorkerPlugin = mockModule.getModuleUnderTest().default;
		const GenerateSW = mockModule.getMock('workbox-webpack-plugin').GenerateSW;
		const plugin = new ServiceWorkerPlugin({
			bogusValue: 'x',
			precache: {
				nonExistentOption: true
			},
			routes: [{ urlPattern: '.*\\.svg', strategy: 'networkFirst', options: { fakeOption: 42 } }]
		});
		plugin.apply(compiler);

		const options = GenerateSW.firstCall.args[0];
		const keys = Object.keys(options);
		assert.sameMembers(keys, ['importScripts', 'importWorkboxFrom', 'runtimeCaching']);
		assert.deepEqual(options.runtimeCaching[0].options, {});
	});
});
