declare module 'webpack/lib/DependenciesBlock' {
	import * as webpack from 'webpack';
	import DependenciesBlockVariable = require('webpack/lib/DependenciesBlockVariable');

	class DependenciesBlock {
		dependencies: webpack.compilation.Dependency[];
		blocks: DependenciesBlock[];
		variables: DependenciesBlockVariable[];

		addBlock(block: DependenciesBlock): void;
		addDependency(dependency: webpack.compilation.Dependency): void;
		addVariable(name: string, expression: string, dependencies?: webpack.compilation.Dependency[]): void;
		disconnect(): void;
		unseal(): void;
		hasDependencies(filter: (dependency: webpack.compilation.Dependency) => boolean): boolean;
		sortItems(): void;
	}
	export = DependenciesBlock;
}

declare module 'webpack/lib/DependenciesBlockVariable' {
	import * as webpack from 'webpack';

	class DependenciesBlockVariable {
		name: string;
		expression: string;
		dependencies: webpack.compilation.Dependency[];

		constructor(name: string, expression: string, dependencies?: webpack.compilation.Dependency[]);
	}

	export = DependenciesBlockVariable;
}

declare module 'webpack/lib/dependencies/ModuleDependency' {
	import * as webpack from 'webpack';

	class ModuleDependencyTemplate {
		apply(dep: any, source: any): void;
	}

	class ModuleDependency extends webpack.compilation.Dependency {
		constructor(request: string);

		public module: any;
		public request: string;
		public userRequest: string;

		static Template: typeof ModuleDependencyTemplate;
	}

	export = ModuleDependency;
}

declare module 'webpack/lib/dependencies/WebpackMissingModule' {
	namespace WebpackMissingModule {
		const module: (request: string) => string;
		const moduleCode: (request: string) => string;
		const promise: (request: string) => string;
	}
	export = WebpackMissingModule;
}

declare module 'webpack/lib/Module' {
	import * as webpack from 'webpack';
	import DependenciesBlock = require('webpack/lib/DependenciesBlock');

	class Module extends DependenciesBlock {
		buildInfo?: object;
		buildMeta?: object;
		built: boolean;
		context: string;
		debugId: number;
		depth?: number;
		errors?: any[];
		factoryMeta: object;
		hash?: string;
		id?: number | string;
		index2?: number;
		index?: number;
		issuer?: Module;
		optimizationBailout: (string | Function)[];
		prefetched: boolean;
		profile?: object;
		reasons?: any[];
		renderedHash?: string;
		resolveOptions: object;
		type: string;
		useSourceMap: boolean;
		used?: boolean;
		usedExports: boolean | string[];
		warnings?: any[];

		addChunk(chunk: webpack.compilation.Chunk): void;
		removeChunk(chunk: webpack.compilation.Chunk): void;
	}

	export = Module;
}

declare module 'webpack/lib/NormalModule' {
	import Module = require('webpack/lib/Module');
	import Source = require('webpack-sources/lib/Source');

	interface NormalModuleParams {
		type: string;
		request: string;
		userRequest: string;
		rawRequest: string;
		loaders: Function[];
		resource: string;
		matchResource?: string;
		parser: { parse: Function };
		generator?: Function;
	}

	class NormalModule extends Module {
		type: string;
		request: string;
		userRequest: string;
		rawRequest: string;
		loaders: Function[];
		resource: string;
		matchResource?: string;
		parser: { parse: Function };
		generator?: Function;

		constructor(params: NormalModuleParams);

		originalSource(): Source;
	}

	export = NormalModule;
}
