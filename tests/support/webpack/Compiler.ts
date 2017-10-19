import Pluginable from './Pluginable';

import WebpackCompiler = require('webpack/lib/Compiler');

import MockCompilationParams = require('./CompilationParams');

class MockCompiler extends Pluginable {
	applied: any[];
	options: any;
	callSuper?: boolean;

	constructor(options?: any) {
		super();
		this.applied = [];
		this.options = options || {
			resolve: {
				modules: [ '/root/path' ]
			}
		};
		if (options && options.callSuper) {
			this.callSuper = true;
		}
	}

	apply(...args: any[]) {
		this.applied = this.applied.concat(args);
		if (this.callSuper) {
			super.apply(...args);
		}
	}

	mockApply(name: string, ...args: any[]) {
		if (name === 'compilation' && args.length === 1) {
			const mockCompilation = args[0];
			mockCompilation.params = args[1] = new MockCompilationParams();
		}
		return super.mockApply(name, ...args);
	}

	run(callback: Function) {}
	runAsChild(callback: Function) {}
	watch(options: any, handler: (error: Error | null, stats: any) => void): WebpackCompiler.Watching {
		return null as any;
	}
}

// Node-style export used to maintain consistency with other webpack mocks.
export = MockCompiler;
