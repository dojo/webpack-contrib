import { Compiler } from 'webpack';

export function createCompiler() {
	// `@types/webpack` currently misses the `context` argument for the Compiler constructor
	return new (Compiler as any)('');
}

export function createCompilation(compiler: Compiler) {
	const { options = {} } = compiler;
	compiler.options = {
		...options,
		module: {
			...options.module,
			rules: [],
			defaultRules: []
		} as any
	};
	return compiler.newCompilation(compiler.newCompilationParams());
}
