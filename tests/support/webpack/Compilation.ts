import CompilationParams = require('./CompilationParams');
import Pluginable from './Pluginable';

class MockCompilation extends Pluginable {
	dependencyFactories = new Map();
	dependencyTemplates = new Map();
	options: any;
	modules: any[] = [];
	moduleTemplate = new Pluginable();
	// Non-standard property used only for testing
	params: CompilationParams;
	resolvers: any[] = [];

	constructor(options?: any) {
		super();
		this.options = options || {
			resolve: {
				modules: [ '/root/path' ]
			}
		};
	}

	addModule(module: any) {
		this.modules.push(module);
	}

	buildModule(module: any, optional: boolean, origin: any, dependencies: any[], callback: Function) {
		module.isBuilt = true;
		callback();
	}

	processModuleDependencies(module: any, callback: Function) {
		module.dependenciesProcessed = true;
		callback();
	}
}

// Node-style export used to maintain consistency with other webpack mocks.
export = MockCompilation;
