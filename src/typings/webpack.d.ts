import * as webpack from 'webpack';

declare module 'webpack' {
	interface Compiler {
		newCompilation: Function;
		newCompilationParams: Function;
	}

	interface RawSourceMap {
		file: string;
	}
}
