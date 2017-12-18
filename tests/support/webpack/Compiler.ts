import Pluginable from './Pluginable';
import MockCompilationParams = require('./CompilationParams');
import { Compiler } from 'webpack';

class MockCompiler extends Pluginable {
	applied: any[];
	callSuper?: boolean;
	name = '';
	options: any;
	outputFileSystem: any;

	constructor(options?: any) {
		super();
		this.applied = [];
		this.options = options || {
			resolve: {
				modules: ['/root/path']
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
	watch(options: Compiler.WatchOptions, handler: Compiler.Handler): Compiler.Watching {
		return null as any;
	}
}

// Node-style export used to maintain consistency with other webpack mocks.
export = MockCompiler;
