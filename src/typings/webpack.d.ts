import * as webpack from 'webpack';

declare module 'webpack' {
	interface LoaderContext {
		version: number;
		context: string;
		request: string;
		query: string;
		data: any;
		loaders: any[];
		loaderIndex: number;
		resource: string;
		resourcePath: string;
		value: any;
		inputValue: any;
		options: any;
		debug: boolean;
		minimize: boolean;
		sourceMap: boolean;
		target: string;
		webpack: boolean;

		async(): (error?: Error | null, content?: string | Buffer, sourceMap?: any) => void;
		callback(error?: Error | null, content?: string | Buffer, sourceMap?: any, ast?: any): void;
		cacheable(flag?: boolean): void;
		emitWarning(warning: string): void;
		emitError(error: string): void;
		exec(code: string, filename: string): void;
		resolve(context: string, request: string, callback: (error?: Error | null, result?: string) => void): void;
		addDependency(file: string): void;
		dependency(file: string): void;
		addContextDependency(directory: string): void;
		clearDependencies(): void;
		emitFile(name: string, content: String | Buffer, sourceMap: any): void;
	}

	interface RawSourceMap {
		file: string;
	}
}
