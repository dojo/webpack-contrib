declare module 'webpack-sources/lib/ConcatSource' {
	import Source = require('webpack-sources/lib/Source');
	import sourceMap = require('source-map');

	class ConcatSource extends Source {
		constructor(...children: (string | Source)[]);

		add(child: string | Source): void;
		node(options: Source.Options): sourceMap.SourceNode;
	}

	export = ConcatSource;
}

declare module 'webpack-sources/lib/RawSource' {
	import * as Source from 'webpack-sources/lib/Source';

	class RawSource extends Source {
		constructor(value: string);
	}

	namespace RawSource {

	}

	export = RawSource;
}

declare module 'webpack-sources/lib/ReplaceSource' {
	import Source = require('webpack-sources/lib/Source');
	import sourceMap = require('source-map');

	class ReplaceSource extends Source {
		constructor(...children: (string | Source)[]);

		add(child: string | Source): void;
		insert(position: number, content: string): void;
		node(options: Source.Options): sourceMap.SourceNode;
		original(): Source;
		replace(start: number, end: number, content: string): void;
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

declare module 'webpack-sources/lib/SourceMapSource' {
	import * as Source from 'webpack-sources/lib/Source';
	import * as sourceMap from 'source-map';

	class SourceMapSource extends Source {
		constructor(value: string, name?: string, sourceMap?: string, originalSource?: string, innerSourceMap?: string);
	}

	namespace SourceMapSource {

	}

	export = SourceMapSource;
}
