import Compiler = require('../../support/webpack/Compiler');
import MemorySourcePlugin from '../../../src/memory-source-plugin/MemorySourcePlugin';
import { stub } from 'sinon';

const { assert } = intern.getPlugin('chai');
const { describe, it, beforeEach, afterEach } = intern.getInterface('bdd');

const statStub = stub();
const statSyncStub = stub();
const readFileStub = stub();
const readFileSyncStub = stub();
const source = `console.log('hello, world!')`;
let compiler: Compiler;

function assertStats(buffer: Buffer, stats: any) {
	const dateKeys = [ 'atime', 'birthtime', 'ctime', 'mtime' ];
	const timeKeys = [ 'atimeMs', 'birthtimeMs', 'ctimeMs', 'mitemMs' ];
	const falseKeys = [ 'isBlockDevice', 'isCharacterDevice', 'isDirectory', 'isFIFO', 'isSocket', 'isSymbolicLink' ];

	dateKeys.forEach((key) => {
		assert.instanceOf(stats[key], Date, `${key} should be a date.`);
	});

	timeKeys.forEach((key) => {
		assert.isNumber(stats[key], `${key} should be a time.`);
	});

	falseKeys.forEach((key) => {
		const value = stats[key];
		assert.isFunction(value, `${key} should be a function.`);
		assert.isFalse(value(), `The ${key} method should return false.`);
	});

	assert.isFunction(stats.isFile);
	assert.isTrue(stats.isFile(), 'The isFile method should return true.');

	const fixedKeys: any = {
		blksize: 4096,
		blocks: 8,
		dev: 1234567890,
		gid: process.getgid ? process.getgid() : 0,
		ino: 9876543210,
		mode: 666,
		nlink: 1,
		rdev: 0,
		size: buffer.byteLength,
		uid: process.getuid ? process.getuid() : 0
	};

	Object.keys(fixedKeys).forEach((key) => {
		assert.strictEqual(stats[key], fixedKeys[key]);
	});
}

type NodeCallback<T> = (error: Error | null, value: T) => void;
function createCallbackPromise<T>(operation: (callback: NodeCallback<T>) => void) {
	return new Promise((resolve, reject) => {
		operation((error: Error | null, value: T) => {
			if (error) {
				reject(error);
			}
			resolve(value);
		});
	});
}

describe('MemorySourcePlugin', () => {

	beforeEach(() => {
		compiler = new Compiler();
		compiler.inputFileSystem = {
			F_OK: 0,
			stat: statStub,
			statSync: statSyncStub,
			readFile: readFileStub,
			readFileSync: readFileSyncStub
		};
	});

	afterEach(() => {
		statStub.reset();
		statSyncStub.reset();
		readFileStub.reset();
		readFileSyncStub.reset();
	});

	it('should store its source as a buffer', () => {
		const plugin = new MemorySourcePlugin(source);

		assert.instanceOf(plugin.source, Buffer, 'The plugin source should be a buffer');
		assert.strictEqual(plugin.source.toString(), source);
	});

	it('should create a unique resource for the module', () => {
		const { resource } = new MemorySourcePlugin(source);
		assert.isTrue(resource.indexOf(process.cwd()) === 0, 'The resource should begin with the cwd');
	});

	it('should return mock stats for the module', () => {
		const plugin = new MemorySourcePlugin(source);
		plugin.apply(compiler);

		const stats = compiler.inputFileSystem.statSync(plugin.resource);
		assert.isFalse(statSyncStub.called, 'The original fs.statSync should not be called.');
		assertStats(plugin.source, stats);

		return createCallbackPromise((callback: NodeCallback<any>) => {
			compiler.inputFileSystem.stat(plugin.resource, callback);
		}).then((stats: any) => {
			assertStats(plugin.source, stats);
			assert.isFalse(statStub.called, 'The original fs.stat should not be called.');
		});
	});

	it('should return 0 in the mock stats for unsupported process methods', () => {
		const getgid = process.getgid;
		const getuid = process.getuid;

		(<any> process).getgid = undefined;
		(<any> process).getuid = undefined;

		const plugin = new MemorySourcePlugin(source);
		plugin.apply(compiler);

		const stats = compiler.inputFileSystem.statSync(plugin.resource);
		assert.isFalse(statSyncStub.called, 'The original fs.statSync should not be called.');
		assertStats(plugin.source, stats);

		return createCallbackPromise((callback: NodeCallback<any>) => {
			compiler.inputFileSystem.stat(plugin.resource, callback);
		}).then((stats: any) => {
			assertStats(plugin.source, stats);
			assert.isFalse(statStub.called, 'The original fs.stat should not be called.');
		}).catch((error) => {
			(<any> process).getgid = getgid;
			(<any> process).getuid = getuid;
			throw error;
		});
	});

	it('should return the module source', () => {
		const plugin = new MemorySourcePlugin(source);
		plugin.apply(compiler);

		const result = compiler.inputFileSystem.readFileSync(plugin.resource);
		assert.isFalse(readFileSyncStub.called, 'The original fs.readFileSync should not be called.');
		assert.strictEqual(result, plugin.source, `The plugin's buffer source should be returned.`);

		return createCallbackPromise((callback: NodeCallback<Buffer>) => {
			compiler.inputFileSystem.readFile(plugin.resource, callback);
		}).then((result: Buffer) => {
			assert.isFalse(readFileStub.called, 'The original fs.readFileshould not be called.');
			assert.strictEqual(result, plugin.source, `The plugin's buffer source should be returned.`);
		});
	});

	it('should call the original methods for other modules', () => {
		const plugin = new MemorySourcePlugin(source);
		const resource = '/path/to/some/resource';
		plugin.apply(compiler);

		assert.strictEqual(compiler.inputFileSystem.F_OK, 0, 'Properties should be returned correctly.');

		compiler.inputFileSystem.statSync(resource);
		compiler.inputFileSystem.readFileSync(resource);

		assert.isTrue(statSyncStub.called, 'The original fs.statSync should be called.');
		assert.isTrue(readFileSyncStub.called, 'The original fs.readFileSync should be called.');

		statStub.callsFake((path: string, callback: NodeCallback<any>) => {
			callback(null, {});
		});
		readFileStub.callsFake((path: string, callback: NodeCallback<Buffer>) => {
			callback(null, new Buffer(''));
		});

		return Promise.all([
			createCallbackPromise((callback: NodeCallback<any>) => {
				compiler.inputFileSystem.stat(resource, callback);
			}),
			createCallbackPromise((callback: NodeCallback<Buffer>) => {
				compiler.inputFileSystem.readFile(resource, callback);
			})
		]).then(() => {
			assert.isTrue(statStub.calledWith(resource), 'The original fs.stat should be called.');
			assert.isFunction(statStub.firstCall.args[1], 'fs.stat should be called with a callback.');
			assert.isTrue(readFileStub.calledWith(resource), 'The original fs.readFile should be called.');
			assert.isFunction(readFileStub.firstCall.args[1], 'fs.readFile should be called with a callback.');
		});
	});

	it('should create only one Proxy per compiler', () => {
		const inputFileSystem = compiler.inputFileSystem;
		const proxies = [];

		for (let i = 0; i < 10; i++) {
			const plugin = new MemorySourcePlugin(`console.log('${i}');`);
			plugin.apply(compiler);
			proxies.push(compiler.inputFileSystem);
		}

		const isSameProxy = proxies.every(proxy => proxy === compiler.inputFileSystem);
		assert.isTrue(isSameProxy, 'Only one Proxy should be created for each compiler.');

		const newCompiler = new Compiler();
		newCompiler.inputFileSystem = inputFileSystem;
		new MemorySourcePlugin(source).apply(newCompiler);

		assert.notStrictEqual(newCompiler.inputFileSystem, compiler.inputFileSystem, 'A different compiler should use a different proxy.');
	});
});
