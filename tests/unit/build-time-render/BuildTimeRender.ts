import MockModule from '../../support/MockModule';
import { stub } from 'sinon';
import * as path from 'path';
import { readFileSync, existsSync } from 'fs';

const { afterEach, beforeEach, describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

let mockModule: MockModule;

const outputPath = path.join(__dirname, '..', '..', 'support', 'fixtures', 'build-time-render');

const pluginStub = stub();
const compiler = {
	plugin: pluginStub,
	options: {
		output: {
			path: outputPath
		}
	}
};

pluginStub.yields();

describe('build-time-render', () => {
	beforeEach(() => {
		mockModule = new MockModule('../../../src/build-time-render/BuildTimeRender', require);
		mockModule.dependencies(['fs']);
	});

	afterEach(() => {
		mockModule.destroy();
	});

	it('should inject btr using entry names', () => {
		const fs = mockModule.getMock('fs');
		const writeFileSync = stub();
		fs.writeFileSync = writeFileSync;
		fs.readFileSync = readFileSync;
		fs.existsSync = existsSync;
		const Btr = mockModule.getModuleUnderTest().default;
		const btr = new Btr({
			entries: ['runtime', 'main'],
			root: 'app'
		});
		btr.apply(compiler);
		const expected = readFileSync(path.join(outputPath, 'expected', 'index.html'), 'utf-8');
		const actual = writeFileSync.firstCall.args[1];
		assert.strictEqual(actual, expected);
	});

	it('should inject btr using manifest to map', () => {
		const fs = mockModule.getMock('fs');
		const writeFileSync = stub();
		fs.writeFileSync = writeFileSync;
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
		const expected = readFileSync(path.join(outputPath, 'expected', 'index.html'), 'utf-8');
		const actual = writeFileSync.firstCall.args[1];
		assert.strictEqual(actual, expected);
	});

	it('should inject btr for paths specified', () => {
		const fs = mockModule.getMock('fs');
		const writeFileSync = stub();
		fs.writeFileSync = writeFileSync;
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
		const expected = readFileSync(path.join(outputPath, 'expected', 'indexWithPaths.html'), 'utf-8');
		const actual = writeFileSync.firstCall.args[1];
		assert.strictEqual(actual, expected);
	});

	it('should not inject btr when missing root', () => {
		const fs = mockModule.getMock('fs');
		const writeFileSync = stub();
		fs.writeFileSync = writeFileSync;
		fs.readFileSync = readFileSync;
		fs.existsSync = existsSync;
		const Btr = mockModule.getModuleUnderTest().default;
		const btr = new Btr({
			paths: [],
			useManifest: true,
			entries: ['runtime', 'main']
		});
		btr.apply(compiler);
		assert.isTrue(writeFileSync.notCalled);
	});

	it('should not inject btr when no output path can be found', () => {
		const fs = mockModule.getMock('fs');
		const writeFileSync = stub();
		fs.writeFileSync = writeFileSync;
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
		assert.isTrue(writeFileSync.notCalled);
	});
});
