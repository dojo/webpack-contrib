const { afterEach, beforeEach, describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');
import MockModule from '../../support/MockModule';
import * as fs from 'fs';
import * as path from 'path';

let mockModule: MockModule;
let mockLoaderUtils: { getOptions: sinon.SinonStub };

const basePath = path.join(process.cwd(), 'tests', 'support', 'fixtures', 'cldr');

describe('cldr loader', () => {
	beforeEach(() => {
		mockModule = new MockModule('../../../src/cldr/loader', require);
		mockModule.dependencies(['loader-utils']);
		mockLoaderUtils = mockModule.getMock('loader-utils');
	});

	afterEach(() => {
		mockModule.destroy();
	});

	describe('async', () => {
		it('should generate loader for the locale', () => {
			mockLoaderUtils.getOptions.returns({
				locale: 'en'
			});
			const cldrLoaderOutput = mockModule.getModuleUnderTest().default();
			const expected = fs.readFileSync(path.join(basePath, 'expectedSingleLocaleBootstrap.js'), 'utf8');
			assert.strictEqual(cldrLoaderOutput, expected);
		});

		it('should generate loaders for the all supported locales', () => {
			mockLoaderUtils.getOptions.returns({
				locale: 'en',
				supportedLocales: ['fr', 'ja']
			});
			const cldrLoaderOutput = mockModule.getModuleUnderTest().default();
			const expected = fs.readFileSync(path.join(basePath, 'expectedMultipleLocaleBootstrap.js'), 'utf8');
			assert.strictEqual(cldrLoaderOutput, expected);
		});
	});

	describe('sync', () => {
		it('should generate loader for the locale', () => {
			mockLoaderUtils.getOptions.returns({
				locale: 'en',
				sync: true
			});
			const cldrLoaderOutput = mockModule.getModuleUnderTest().default();
			const expected = fs.readFileSync(path.join(basePath, 'expectedSingleLocaleBootstrapSync.js'), 'utf8');
			assert.strictEqual(cldrLoaderOutput, expected);
		});

		it('should generate loaders for the all supported locales', () => {
			mockLoaderUtils.getOptions.returns({
				locale: 'en',
				supportedLocales: ['fr', 'ja'],
				sync: true
			});
			const cldrLoaderOutput = mockModule.getModuleUnderTest().default();
			const expected = fs.readFileSync(path.join(basePath, 'expectedMultipleLocaleBootstrapSync.js'), 'utf8');
			assert.strictEqual(cldrLoaderOutput, expected);
		});
	});
});
