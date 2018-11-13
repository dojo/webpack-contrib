declare module 'webpack-sources/lib/ReplaceSource' {
	import Source = require('webpack-sources/lib/Source');
	import sourceMap = require('source-map');

	interface Replacement {
		content: string;
		end: number;
		insertIndex: number;
		name?: string;
		start: number;
	}

	class ReplaceSource extends Source {
		replacements: Replacement[];

		constructor(source: Source | string, name?: string);

		insert(position: number, content: string, name?: string): void;
		next(): void;
		node(options: Source.Options): sourceMap.SourceNode;
		original(): Source;
		replace(start: number, end: number, content: string, name?: string): void;
	}

	export = ReplaceSource;
}

declare module 'webpack-sources/lib/Source' {
	import * as crypto from 'crypto';

	abstract class Source {
		map(options: Source.Options): string;
		size(): number;
		source(): string;
		sourceAndMap(options: Source.Options): { code: string; map: any };
		updateHash(hash: crypto.Hash): void;
	}

	namespace Source {
		interface Options {
			columns?: boolean;
			module?: boolean;
		}
	}

	export = Source;
}
