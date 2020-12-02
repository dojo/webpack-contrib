import { existsSync, writeFileSync, readFileSync } from 'fs-extra';
import { encode, decode } from '@msgpack/msgpack';
import * as zlib from 'zlib';

const pageCachePath = 'cache.btr';

export interface CacheItem {
	path?: any;
	head: string[];
	content: string;
	styles: string;
	script: string;
	blockScripts: string[];
	additionalScripts: string[];
	additionalCss: string[];
	paths?: string[];
	time?: number;
}

export interface Cache {
	pages: { [index: string]: CacheItem };
}

export function read(): Promise<Cache> {
	return new Promise((resolve) => {
		if (existsSync(pageCachePath)) {
			const content = readFileSync(pageCachePath);
			zlib.gunzip(content, {}, (error, result) => {
				if (!error) {
					resolve(decode(result) as any);
				} else {
					resolve({ pages: {} });
				}
			});
		} else {
			resolve({ pages: {} });
		}
	});
}

export function write(cache: Cache) {
	return new Promise((resolve) => {
		zlib.gzip(Buffer.from(encode(cache)), {}, (error, result) => {
			writeFileSync(pageCachePath, result, 'binary');
			resolve();
		});
	});
}
