declare abstract class Tapable {
	apply(...args: any[]): void;
	plugin(name: string | string[], fn: Function): void;
}

declare module 'webpack/lib/Chunk' {
	import Module = require('webpack/lib/Module');
	import DependenciesBlock = require('webpack/lib/DependenciesBlock');

	class Chunk {
		id: number;
		ids: number[];
		debugId: number;
		name: string;
		modules: Module[];
		chunks: Chunk[];
		parents: Chunk[];
		blocks: DependenciesBlock[];
		origins: Chunk.Origin[];
		files: any[];
		rendered: boolean;

		constructor(name: string, module: Module, loc: any);

		addChunk(chunk: Chunk): boolean;
		addParent(chunk: Chunk): boolean;
		hasRuntime(): boolean;
		isInitial(): boolean;
		hasEntryModule(): boolean;
		addModule(module: Module): boolean;
		removeModule(module: Module): void;
		removeChunk(chunk: Chunk): void;
		removeParent(chunk: Chunk): void;

		addBlock(block: DependenciesBlock): boolean;
		addOrigin(origin: Chunk.Origin): void;

		remove(reason: string): void;

		moveModule(module: Module, other: Chunk): void;
	}

	namespace Chunk {
		interface Origin {
			module: Module;
			loc: any;
			name: string;
		}
	}

	export = Chunk;
}

declare module 'webpack/lib/Compilation' {
	import MainTemplate = require('webpack/lib/MainTemplate');
	import NormalModule = require('webpack/lib/NormalModule');
	import Chunk = require('webpack/lib/Chunk');
	import Source = require('webpack-sources/lib/Source');
	import ModuleTemplate = require('webpack/lib/ModuleTemplate');
	import Dependency = require('webpack/lib/Dependency');

	import { Compiler, Module } from 'webpack';

	class Compilation extends Tapable {
		dependencyFactories: Map<typeof Dependency, any>;
		dependencyTemplates: Map<typeof Dependency, any>;
		mainTemplate: MainTemplate;
		modules: NormalModule[];
		moduleTemplate: ModuleTemplate;

		constructor(compiler: Compiler);

		addModule(module: Module, cacheGroup?: string): Module | boolean;
		buildModule(
			module: Module,
			optional: boolean,
			origin: Module | null,
			dependencies: any[] | null,
			callback: (error?: Error) => void
		): void;
		processModuleDependencies(module: Module, callback: (error?: Error) => void): void;

		plugin(name: 'normal-module-loader', fn: (this: Compilation, loaderContext: any, module: Module) => void): void;
		plugin(name: 'seal', fn: (this: Compilation) => void): void;
		plugin(name: 'optimize', fn: (this: Compilation) => void): void;
		plugin(name: 'optimize-chunks-basic', fn: (this: Compilation, chunks: Chunk[]) => void): void;
		plugin(
			name: 'optimize-tree',
			fn: (this: Compilation, chunks: Chunk[], modules: Module[], callback: (error?: Error) => void) => void
		): void;
		plugin(name: 'optimize-modules', fn: (this: Compilation, modules: Module[]) => any): void;
		plugin(name: 'after-optimize-modules', fn: (this: Compilation, modules: Module[]) => void): void;
		plugin(name: 'optimize-chunks', fn: (this: Compilation, chunks: Chunk[]) => any): void;
		plugin(name: 'after-optimize-chunks', fn: (this: Compilation, chunks: Chunk[]) => void): void;
		plugin(name: 'revive-modules', fn: (this: Compilation, modules: Module[], records: any) => void): void;
		plugin(name: 'optimize-module-order', fn: (this: Compilation, modules: Module[]) => void): void;
		plugin(name: 'optimize-module-ids', fn: (this: Compilation, modules: Module[]) => void): void;
		plugin(name: 'after-optimize-module-ids', fn: (this: Compilation, modules: Module[]) => void): void;
		plugin(name: 'revive-chunks', fn: (this: Compilation, chunks: Chunk[], records: any) => void): void;
		plugin(name: 'optimize-chunk-order', fn: (this: Compilation, chunks: Chunk[]) => void): void;
		plugin(name: 'optimize-chunk-ids', fn: (this: Compilation, chunks: Chunk[]) => void): void;
		plugin(name: 'after-optimize-chunk-ids', fn: (this: Compilation, chunks: Chunk[]) => void): void;
		plugin(name: 'record-modules', fn: (this: Compilation, modules: Module[], records: any) => void): void;
		plugin(name: 'record-chunks', fn: (this: Compilation, chunks: Chunk[], records: any) => void): void;
		plugin(name: 'before-hash', fn: (this: Compilation) => void): void;
		plugin(name: 'after-hash', fn: (this: Compilation) => void): void;
		plugin(name: 'before-chunk-assets', fn: (this: Compilation) => void): void;
		plugin(name: 'additional-chunk-assets', fn: (this: Compilation, chunks: Chunk[]) => void): void;
		plugin(name: 'record', fn: (this: Compilation, compilation: Compilation, records: any) => void): void;
		plugin(
			name: 'optimize-chunk-assets',
			fn: (this: Compilation, chunks: Chunk[], callback: (error?: Error) => void) => void
		): void;
		plugin(name: 'after-optimize-chunk-assets', fn: (this: Compilation, chunks: Chunk[]) => void): void;
		plugin(
			name: 'optimize-assets',
			fn: (this: Compilation, assets: { [key: string]: Source }, callback: (error?: Error) => void) => void
		): void;
		plugin(name: 'after-optimize-assets', fn: (this: Compilation, assets: { [key: string]: Source }) => void): void;
		plugin(name: 'build-module', fn: (this: Compilation, module: Module) => void): void;
		plugin(name: 'succeed-module', fn: (this: Compilation, module: Module) => void): void;
		plugin(name: 'failed-module', fn: (this: Compilation, module: Module, error: Error) => void): void;
		plugin(name: 'module-asset', fn: (this: Compilation, module: Module, file: string) => void): void;
		plugin(name: 'chunk-asset', fn: (this: Compilation, chunk: Chunk, file: string) => void): void;
		plugin(name: 'need-additional-pass', fn: (this: Compilation) => boolean): void;

		rebuildModule(module: Module, callback: (error: Error) => void): void;
	}

	export = Compilation;
}

declare module 'webpack/lib/ContextModuleFactory' {
	import Parser = require('webpack/lib/Parser');
	import Dependency = require('webpack/lib/Dependency');

	class ContextModuleFactory extends Tapable {
		plugin(name: 'before-resolve', fn: ContextModuleFactory.BeforeHandler): void;
		plugin(name: 'parser', fn: (this: ContextModuleFactory, parser: Parser, options: any) => void): void;
	}

	namespace ContextModuleFactory {
		interface BeforeData {
			contextInfo?: any;
			context: string;
			dependencies?: Dependency[];
			request: string;
		}

		type BeforeHandler = (this: ContextModuleFactory, current: BeforeData, callback: Callback<BeforeData>) => void;

		type Callback<T> = (error?: Error | null, nextValue?: T) => void;
	}

	export = ContextModuleFactory;
}

declare module 'webpack/lib/DependenciesBlock' {
	import Dependency = require('webpack/lib/Dependency');
	import DependenciesBlockVariable = require('webpack/lib/DependenciesBlockVariable');
	import * as crypto from 'crypto';

	class DependenciesBlock {
		dependencies: Dependency[];
		blocks: DependenciesBlock[];
		variables: DependenciesBlockVariable[];

		addBlock(block: DependenciesBlock): void;
		addDependency(dependency: Dependency): void;
		addVariable(name: string, expression: string, dependencies?: Dependency[]): void;
		updateHash(hash: crypto.Hash): void;
		disconnect(): void;
		unseal(): void;
		hasDependencies(filter: (dependency: Dependency) => boolean): boolean;
		sortItems(): void;
	}
	export = DependenciesBlock;
}

declare module 'webpack/lib/DependenciesBlockVariable' {
	import Dependency = require('webpack/lib/Dependency');
	import * as crypto from 'crypto';

	class DependenciesBlockVariable {
		name: string;
		expression: string;
		dependencies: Dependency[];

		constructor(name: string, expression: string, dependencies?: Dependency[]);

		updateHash(hash: crypto.Hash): void;
	}

	export = DependenciesBlockVariable;
}

declare module 'webpack/lib/dependencies/ConstDependency' {
	import NullDependency = require('webpack/lib/dependencies/NullDependency');

	class ConstDependencyTemplate {
		apply(dep: any, source: any): void;
	}

	class ConstDependency extends NullDependency {
		constructor(expression?: any, range?: [number, number]);

		public expression?: any;
		public loc?: any;
		public range?: [number, number];

		updateHash(hash: any): void;

		static Template: typeof ConstDependencyTemplate;
	}

	export = ConstDependency;
}

declare module 'webpack/lib/dependencies/ModuleDependency' {
	import Dependency = require('webpack/lib/Dependency');

	class ModuleDependencyTemplate {
		apply(dep: any, source: any): void;
	}

	class ModuleDependency extends Dependency {
		constructor(request: string);

		public request: string;
		public userRequest: string;

		static Template: typeof ModuleDependencyTemplate;
	}

	export = ModuleDependency;
}

declare module 'webpack/lib/dependencies/NullDependency' {
	import Dependency = require('webpack/lib/Dependency');

	class NullDependencyTemplate {
		apply(dep: any, source: any): void;
	}

	class NullDependency extends Dependency {
		readonly type: string;
		isEqualResource(): boolean;
		updateHash(hash: any): void;
		static Template: typeof NullDependencyTemplate;
	}

	export = NullDependency;
}

declare module 'webpack/lib/dependencies/WebpackMissingModule' {
	namespace WebpackMissingModule {
		const module: (request: string) => string;
		const moduleCode: (request: string) => string;
		const promise: (request: string) => string;
	}
	export = WebpackMissingModule;
}

declare module 'webpack/lib/Dependency' {
	import Module = require('webpack/lib/Module');
	import * as crypto from 'crypto';

	class Dependency {
		static compare(a: any, b: any): boolean;

		loc?: any;
		module: Module;
		range?: [number, number];

		isEqualResource(): boolean;
		getReference(): { module: Module; importedNames: boolean } | null;
		getExports(): string[] | null;
		getWarnings(): string[] | null;
		getErrors(): string[] | null;
		updateHash(hash: crypto.Hash): void;
		disconnect(): void;
		compare(a: any, b: any): boolean;
	}
	export = Dependency;
}

declare module 'webpack/lib/MainTemplate' {
	class MainTemplate {}
	export = MainTemplate;
}

declare module 'webpack/lib/Module' {
	import DependenciesBlock = require('webpack/lib/DependenciesBlock');
	import Chunk = require('webpack/lib/Chunk');

	class Module extends DependenciesBlock {
		context: any;
		reasons: any[];
		debugId: number;
		lastId: number;
		id: number;
		portableId: number;
		chunks: Chunk[];
		strict: boolean;
		meta: any;

		addChunk(chunk: Chunk): void;
		removeChunk(chunk: Chunk): void;
	}

	export = Module;
}

declare module 'webpack/lib/ModuleTemplate' {
	import Template = require('webpack/lib/Template');
	import Module = require('webpack/lib/Module');
	import Chunk = require('webpack/lib/Chunk');
	import Source = require('webpack-sources/lib/Source');
	import * as crypto from 'crypto';

	class ModuleTemplate extends Template {
		plugin(
			name: 'module',
			fn: (
				this: ModuleTemplate,
				moduleSource: Source,
				module: Module,
				chunk: Chunk,
				dependencyTemplates: Template[]
			) => Source
		): void;
		plugin(
			name: 'render',
			fn: (
				this: ModuleTemplate,
				moduleSource: Source,
				module: Module,
				chunk: Chunk,
				dependencyTemplates: Template[]
			) => Source
		): void;
		plugin(
			name: 'package',
			fn: (
				this: ModuleTemplate,
				moduleSource: Source,
				module: Module,
				chunk: Chunk,
				dependencyTemplates: Template[]
			) => Source
		): void;
		plugin(name: 'hash', fn: (this: ModuleTemplate, hash: crypto.Hash) => void): void;
	}

	export = ModuleTemplate;
}

declare module 'webpack/lib/NormalModule' {
	import Module = require('webpack/lib/Module');
	import Parser = require('webpack/lib/Parser');

	class NormalModule extends Module {
		request: string;
		userRequest: string;
		rawRequest: string;
		parser: Parser;
		resource: string;
		context: any;
		loaders: string[];

		constructor(
			request: string,
			userRequest: string,
			rawRequest: string,
			loaders: string[],
			resource: string,
			parser: Parser
		);
	}

	export = NormalModule;
}

declare module 'webpack/lib/NormalModuleFactory' {
	import Parser = require('webpack/lib/Parser');
	import Dependency = require('webpack/lib/Dependency');

	class NormalModuleFactory extends Tapable {
		plugin(name: 'after-resolve', fn: NormalModuleFactory.AfterHandler): void;
		plugin(name: 'before-resolve', fn: NormalModuleFactory.BeforeHandler): void;
		plugin(name: 'parser', fn: (this: NormalModuleFactory, parser: Parser, options: any) => void): void;
		plugin(
			name: 'resolver',
			fn: (this: NormalModuleFactory, resolver: NormalModuleFactory.Resolver) => NormalModuleFactory.Resolver
		): void;
	}
	namespace NormalModuleFactory {
		interface BeforeData {
			contextInfo?: any;
			context: string;
			dependencies?: Dependency[];
			request: string;
		}

		type BeforeHandler = (this: NormalModuleFactory, current: BeforeData, callback: Callback<BeforeData>) => void;

		type Callback<T> = (error?: Error | null, nextValue?: T) => void;

		interface AfterData {
			context: string;
			request: string;
			userRequest: string;
			rawRequest: string;
			loaders: string[];
			resource: string;
			parser: Parser;
		}

		type AfterHandler = (this: NormalModuleFactory, current: AfterData, callback: Callback<AfterData>) => void;

		type Resolver = (data: BeforeData, callback: ResolverCallback) => void;
		type ResolverCallback = (error?: Error | null, value?: AfterData) => void;
	}

	export = NormalModuleFactory;
}

declare module 'webpack/lib/NullFactory' {
	class NullFactory {
		create(data: any, callback: () => void): void;
	}

	export = NullFactory;
}

declare module 'webpack/lib/Parser' {
	import NormalModule = require('webpack/lib/NormalModule');
	import Module = require('webpack/lib/Module');
	import Compilation = require('webpack/lib/Compilation');
	import Dependency = require('webpack/lib/Dependency');

	class Parser extends Tapable {
		state: Parser.NormalModuleState | Parser.ParsedVariableState;
		plugin(name: string, fn: (this: Parser, ...args: any[]) => any): void;
	}

	namespace Parser {
		interface NormalModuleState {
			current: NormalModule;
			module: NormalModule;
			compilation: Compilation;
			options: any;
		}
		interface ParsedVariableState {
			current: {
				addDependency(dependency: Dependency): void;
			};
			module: Module;
		}
	}

	export = Parser;
}

declare module 'webpack/lib/Template' {
	class Template extends Tapable {
		constructor(options: any);
	}

	export = Template;
}
