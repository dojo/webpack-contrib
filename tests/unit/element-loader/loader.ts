import * as path from 'path';
import MockModule from '../../support/MockModule';
import * as ts from 'typescript';
import * as sinon from 'sinon';
import '../../../src/element-loader/ElementLoader';

const { assert } = intern.getPlugin('chai');
const { afterEach, beforeEach, describe, it } = intern.getInterface('bdd');

describe('element loader', () => {
	let loaderUnderTest: any;
	let mockModule: MockModule;
	let mockUtils: any;
	let mockTs: any;
	let mockTsNode: any;
	let mockPath: any;
	let sandbox: sinon.SinonSandbox;
	const async = () => () => null;
	const loaderContextResolve = (context: string, loadPath: string, callback: (error: any, path?: string) => void) => {
		callback(null, path.join(context, loadPath));
	};
	const resourcePath = 'src/path';
	const defaultScope = { async, resourcePath, resolve: loaderContextResolve };
	let fileIndex = 0;

	const files = {
		'defaultExportFactory.ts': `
		import {create} from '@dojo/framework/core/vdom';

		const render = create();
		const DojoInput = render(() => 'foo');
		export default DojoInput;
		`,
		'directExportFactory.ts': `
		import {create} from '@dojo/framework/core/vdom';

		enum StringEnum { value1 = 'value1', value2 = 'value2' };
		enum IntEnum { value1 = 0, value2 = 1 };
		type stringOrNumber = string | number;

		interface DojoInputProperties {
			attribute: string;
			property: boolean;
			onClick: () => void;
			onChange(value: string): void;
			stringEnum: StringEnum;
			intEnum?: IntEnum;
			stringOrNumber: stringOrNumber;
		}

		const foo = create().properties<{ foo?: string; }>()(() => ({}));

		const render = create({ foo }).properties<DojoInputProperties>();
		export default render(function DojoInput(){ return 'foo'; });
		`,
		'defaultExportClass.ts': `
		class WidgetBase<T> {}
		interface DojoInputProperties {}
		export default class DojoInput extends WidgetBase<DojoInputProperties> {
		}
		`,
		'aliasedExportClass.ts': `
			class WidgetBase<T> {}
			interface DojoInputProperties {}
			export class DojoInput extends WidgetBase<DojoInputProperties> {
			}
			export default DojoInput;
		`
	};
	const host = testCompilerHost(files);
	const program = ts.createProgram(
		Object.keys(files),
		{
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ESNext
		},
		host
	);
	beforeEach(() => {
		fileIndex = 0;
		sandbox = sinon.sandbox.create();
		mockModule = new MockModule('../../../src/element-loader/ElementLoader', require);
		mockModule.dependencies(['typescript', 'path', 'loader-utils', 'ts-node']);
		mockUtils = mockModule.getMock('loader-utils');
		mockUtils.getOptions = sandbox.stub();
		mockPath = mockModule.getMock('path');
		mockPath.resolve = sandbox.stub().returns('./ElementLoader');
		mockTs = mockModule.getMock('typescript');
		for (let prop in ts) {
			if (typeof (ts as any)[prop] === 'function' && prop !== 'createProgram') {
				mockTs[prop] = (ts as any)[prop];
			}
		}

		const original = program.getSourceFile;
		program.getSourceFile = function(fileName: string, ...args: any[]) {
			const endsWithLoader = fileName.endsWith('ElementLoader.js');
			if (endsWithLoader) {
				fileName = Object.keys(files)[fileIndex++];
			}
			return original.apply(program, [fileName, ...args] as any);
		};
		mockTs.createProgram = sandbox.stub().returns(program);
		mockTsNode = mockModule.getMock('ts-node');
		mockTsNode.register = sandbox.stub();

		loaderUnderTest = mockModule.getModuleUnderTest().default;
	});

	afterEach(() => {
		sandbox.restore();
		mockModule.destroy();
	});

	it('should add custom element descriptors the provided source file for all specified widgets', () => {
		mockUtils.getOptions.returns({
			widgets: Object.keys(files).map((key) => ({ path: key }))
		});

		assert.strictEqual(
			loaderUnderTest.call(defaultScope, ''),
			'registerCustomElement(() => useDefault(import(\'defaultExportFactory.ts\')), {"tagName":"-dojo-input","attributes":["key"],"properties":[],"events":[]});registerCustomElement(() => useDefault(import(\'directExportFactory.ts\')), {"tagName":"-dojo-input","attributes":["key","attribute","stringEnum","stringOrNumber","foo"],"properties":["property","intEnum"],"events":["onClick","onChange"]});registerCustomElement(() => useDefault(import(\'defaultExportClass.ts\')), {"tagName":"-dojo-input","attributes":[],"properties":[],"events":[]});registerCustomElement(() => useDefault(import(\'aliasedExportClass.ts\')), {"tagName":"-dojo-input","attributes":[],"properties":[],"events":[]});'
		);
	});

	function testCompilerHost(inputs: Record<string, string>): ts.CompilerHost {
		const compilerHost = ts.createCompilerHost({});

		return {
			...compilerHost,
			getSourceFile(fileName: string, languageVersion: ts.ScriptTarget) {
				return inputs[fileName]
					? ts.createSourceFile(fileName, inputs[fileName], languageVersion)
					: compilerHost.getSourceFile(fileName, languageVersion, () => {});
			},
			resolveModuleNames(moduleNames: string[], containingFile: string): (ts.ResolvedModule | undefined)[] {
				const resolvedModules = [];

				for (const moduleName of moduleNames) {
					let result = ts.resolveModuleName(moduleName, containingFile, {}, compilerHost);

					if (result.resolvedModule) {
						resolvedModules.push(result.resolvedModule);
					} else {
						let result = ts.resolveModuleName(
							path.resolve(__dirname, '../node_modules', moduleName),
							containingFile,
							{},
							compilerHost
						);
						resolvedModules.push(result.resolvedModule);
					}
				}

				return resolvedModules;
			}
		};
	}
});
