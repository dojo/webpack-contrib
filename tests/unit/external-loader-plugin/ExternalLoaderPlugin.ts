import { SinonStub, stub } from 'sinon';
import ExternalLoaderPlugin from '../../../src/external-loader-plugin/ExternalLoaderPlugin';
import MockModule from '../../support/MockModule';
import { createCompiler } from '../../support/util';

const { assert } = intern.getPlugin('chai');
const { describe, it, beforeEach, afterEach } = intern.getInterface('bdd');

let mockModule: MockModule;
let Plugin: typeof ExternalLoaderPlugin;

describe('ExternalLoaderPlugin', () => {
	function resetMocks() {
		mockModule.getMock('copy-webpack-plugin').ctor.returns({ apply: stub() });
		mockModule.getMock('html-webpack-include-assets-plugin').ctor.returns({ apply: stub() });
	}

	beforeEach(() => {
		mockModule = new MockModule('../../../src/external-loader-plugin/ExternalLoaderPlugin', require);
		mockModule.dependencies(['copy-webpack-plugin', 'html-webpack-include-assets-plugin']);
		resetMocks();
		Plugin = mockModule.getModuleUnderTest().default;
	});

	afterEach(() => {
		mockModule.destroy();
	});

	it('should apply created configuration to the compiler', () => {
		const copyMock: SinonStub = mockModule.getMock('copy-webpack-plugin').ctor;
		const assetsMock: SinonStub = mockModule.getMock('html-webpack-include-assets-plugin').ctor;

		const compiler = createCompiler();
		const dependencies = [
			'a',
			{ from: 'abc', inject: true },
			{ from: 'abc', to: 'def', inject: true },
			{ from: 'abc', to: 'def/', inject: 'main' },
			{ from: 'abc', inject: ['one', 'two', 'three', 'four'] },
			{ from: 'abc' },
			{ to: 'ignore', name: 'no-from' }
		];
		const expectedCopyArgs = [
			{ from: 'abc', to: 'OUTPUT_PATH/abc' },
			{ from: 'abc', to: 'OUTPUT_PATH/def' },
			{ from: 'abc', to: 'OUTPUT_PATH/def/' },
			{ from: 'abc', to: 'OUTPUT_PATH/abc' },
			{ from: 'abc', to: 'OUTPUT_PATH/abc' }
		];

		const expectedAssets = [
			'OUTPUT_PATH/abc',
			'OUTPUT_PATH/def',
			'OUTPUT_PATH/def/main',
			'OUTPUT_PATH/abc/one',
			'OUTPUT_PATH/abc/two',
			'OUTPUT_PATH/abc/three',
			'OUTPUT_PATH/abc/four'
		];

		function test(outputPath: string) {
			const expectedCopy = expectedCopyArgs.map(({ from, to }) => ({
				from,
				to: to.replace('OUTPUT_PATH', outputPath)
			}));
			const expectedAssetInclude = {
				assets: expectedAssets.map((asset) => asset.replace('OUTPUT_PATH', outputPath)),
				append: false,
				hash: false,
				files: 'index.html'
			};

			const copyArgs = copyMock.args[0][0];
			const assetIncludeArgs = assetsMock.args[0][0];
			assert.deepEqual(copyArgs, expectedCopy);
			assert.deepEqual(assetIncludeArgs, expectedAssetInclude);

			copyMock.reset();
			assetsMock.reset();
			resetMocks();
		}

		let plugin = new Plugin({ dependencies });
		plugin.apply(compiler);
		test('externals');

		const outputPath = 'output-path';
		plugin = new Plugin({ dependencies, outputPath });
		plugin.apply(compiler);
		test(outputPath);
	});

	it('should allow a prefix to be specified for copied file paths', () => {
		const copyMock: SinonStub = mockModule.getMock('copy-webpack-plugin').ctor;
		const assetsMock: SinonStub = mockModule.getMock('html-webpack-include-assets-plugin').ctor;

		const compiler = createCompiler();
		const dependencies = [{ from: 'abc', to: 'def', inject: true }];
		let plugin = new Plugin({ dependencies, pathPrefix: 'prefix' });

		const expectedCopyArgs = [{ from: 'abc', to: 'prefix/externals/def' }];

		const expectedAssetIncludeArgs = {
			assets: ['prefix/externals/def'],
			append: false,
			hash: false,
			files: 'prefix/index.html'
		};

		plugin.apply(compiler);
		const copyArgs = copyMock.args[0][0];
		const assetIncludeArgs = assetsMock.args[0][0];
		assert.deepEqual(copyArgs, expectedCopyArgs);
		assert.deepEqual(assetIncludeArgs, expectedAssetIncludeArgs);
	});
});
