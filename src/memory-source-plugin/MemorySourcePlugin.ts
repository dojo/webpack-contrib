import uuid from '@dojo/core/uuid';
import * as fs from 'fs';
import { join } from 'path';
import Compiler = require('webpack/lib/Compiler');

/**
 * @private
 * Map an array of string keys to an object, with each key being set to the same value.
 *
 * @param keys The keys for the object
 * @param value The value to set for each key
 *
 * @return The mapped object
 */
function mapKeys<T>(keys: string[], value: T): { [key: string]: T } {
	return keys.reduce((result: { [key: string]: T }, key: string) => {
		result[key] = value;
		return result;
	}, Object.create(null));
}

/**
 * @private
 * Return a mock fs.Stats object for the provided "file" buffer.
 *
 * @param buffer A buffer object
 *
 * @return The canned fs.Stats object
 */
function getStats(buffer: Buffer) {
	const date = new Date();
	const dates = mapKeys([ 'atime', 'birthtime', 'ctime', 'mtime' ], date);
	const times = mapKeys([ 'atimeMs', 'birthtimeMs', 'ctimeMs', 'mitemMs' ], date.getTime());
	const falses = mapKeys([ 'isBlockDevice', 'isCharacterDevice', 'isDirectory', 'isFIFO', 'isSocket', 'isSymbolicLink' ], () => false);

	return Object.assign({
		blksize: 4096,
		blocks: 8,
		dev: 1234567890,
		gid: process.getgid ? process.getgid() : 0,
		ino: 9876543210,
		isFile: () => true,
		mode: 666,
		nlink: 1,
		rdev: 0,
		size: buffer.byteLength,
		uid: process.getuid ? process.getuid() : 0
	}, dates, times, falses) as any;
}

/**
 * @private
 * Return a proxy method that accepts a file system object and list of plugins and returns another function
 * that either executes a provided callback if the file path matches a plugin path or executes the original
 * file system method.
 *
 * @param name The name of the method being proxied.
 * @param getResult A method that accepts a file Buffer and returns a canned response.
 *
 * @return A proxy method that calls the provided getResult callback if the file path matches a plugin path.
 */
function getOverride<T>(name: string, getResult: (buffer: Buffer) => T) {
	return (target: any, plugins: MemorySourcePlugin[]) => {
		return (path: string, callback?: (error: Error | null, result: T) => void) => {
			const plugin = plugins.filter(plugin => plugin.resource === path)[0];
			if (plugin) {
				const result = getResult(plugin.source);
				return typeof callback === 'function' ? callback(null, result) : result;
			}

			return target[name](path, callback);
		};
	};
}

/**
 * Webpack currently uses `stat` and `readFile` to retrieve module information, but proxy methods are
 * provided for their synchronous equivalents just to be safe.
 */
const overrides = {
	readFile: getOverride<Buffer>('readFile', (buffer: Buffer) => buffer),
	readFileSync: getOverride<Buffer>('readFileSync', (buffer: Buffer) => buffer),
	stat: getOverride<fs.Stats>('stat', (buffer: Buffer) => getStats(buffer)),
	statSync: getOverride<fs.Stats>('statSync', (buffer: Buffer) => getStats(buffer))
};

const compilerMap = new WeakMap<Compiler, MemorySourcePlugin[]>();

/**
 * A custom Webpack plugin that allows an arbitary string to be treated as if it were a module on disk.
 */
export default class MemorySourcePlugin {
	/**
	 * A unique identifier used to represent the module.
	 */
	readonly resource = join(process.cwd(), uuid());

	/**
	 * The source buffer returned by the proxied file system.
	 */
	readonly source: Buffer;

	constructor(source: string) {
		this.source = new Buffer(source);
	}

	/**
	 * Proxy the compiler's input file system to return the specified source string.
	 *
	 * @param compiler The Webpack compiler
	 */
	apply(compiler: Compiler) {
		let plugins = compilerMap.get(compiler);

		if (!plugins) {
			plugins = [];
			compilerMap.set(compiler, plugins);
			compiler.inputFileSystem = new Proxy(compiler.inputFileSystem, {
				get: (target: any, name: string) => {
					const override = (<any> overrides)[name];
					return typeof override === 'function' ?
						override(target, compilerMap.get(compiler)) :
						target[name];
				}
			});
		}

		plugins.push(this);
	}
}
