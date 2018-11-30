import * as mockery from 'mockery';
import * as sinon from 'sinon';
import * as path from 'path';

function resolvePath(base: string, mid: string): string {
	if (mid[0] !== '.') {
		return mid;
	}
	return path.resolve(base, mid);
}

export default class MockModule {
	private basePath: string;
	private moduleUnderTestPath: string;
	private mocks: any;
	private sandbox: sinon.SinonSandbox;

	constructor(moduleUnderTestPath: string, require: NodeRequire) {
		this.moduleUnderTestPath = require.resolve(moduleUnderTestPath);
		this.basePath = path.dirname(this.moduleUnderTestPath);
		this.sandbox = sinon.sandbox.create();
		this.mocks = {};
	}

	dependencies(dependencies: string[]): void {
		dependencies.forEach((dependencyName) => {
			const dependency = this.requireDependency(dependencyName);
			const mock: any = {};

			for (let prop in dependency) {
				if (typeof dependency[prop] === 'function') {
					mock[prop] = function() {};
					this.sandbox.stub(mock, prop);
				} else {
					mock[prop] = dependency[prop];
				}
			}

			if (typeof dependency === 'function') {
				const ctor = this.sandbox.stub().returns(mock);
				mockery.registerMock(dependencyName, ctor);
				mock.ctor = ctor;
			} else {
				mockery.registerMock(dependencyName, mock);
			}
			this.mocks[dependencyName] = mock;
		});
	}

	destroy(): void {
		this.sandbox.restore();
		mockery.deregisterAll();
		mockery.disable();
	}

	getMock(dependencyName: string): any {
		return this.mocks[dependencyName];
	}

	getModuleUnderTest(): any {
		mockery.enable({ warnOnUnregistered: false, useCleanCache: true });
		mockery.registerAllowable(this.moduleUnderTestPath, true);
		return require(this.moduleUnderTestPath);
	}

	proxy(dependencyName: string, mock: any) {
		const dependency = this.requireDependency(dependencyName);
		const proxy = new Proxy(mock, {
			get(obj: any, prop: string) {
				return prop in obj ? obj[prop] : dependency[prop];
			}
		});
		mockery.registerMock(dependencyName, proxy);
		this.mocks[dependencyName] = proxy;
	}

	private requireDependency(dependencyName: string) {
		let dependency: any;
		try {
			dependency = require(resolvePath(this.basePath, dependencyName));
		} catch (e) {
			dependency = {};
		}
		return dependency;
	}
}
