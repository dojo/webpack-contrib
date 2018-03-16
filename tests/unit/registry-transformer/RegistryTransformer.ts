import registryTransformer from '../../../src/registry-transformer/index';
import * as ts from 'typescript';

const { describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

const source = `
import { v, w } from '@dojo/widget-core/d';
import WidgetBase from '@dojo/widget-core/WidgetBase';
import Bar from './Bar';
import Baz from './Baz';
import { Blah } from './Qux';

export class Foo extends WidgetBase {
	protected render() {
		return v('div' [
			v('div', ['Foo']),
			w(Bar, {}),
			w(Baz, {}),
			w(Blah, {})
		]);
	}
}
export default HelloWorld;
`;

describe('registry-transformer', () => {
	it('does not add import or decorator when no modules specified', () => {
		const transformer = registryTransformer(process.cwd(), []);
		const result = ts.transpileModule(source, {
			compilerOptions: {
				importHelpers: true,
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ESNext
			},
			transformers: {
				before: [transformer]
			}
		});

		const expected = `import { v, w } from '@dojo/widget-core/d';
import WidgetBase from '@dojo/widget-core/WidgetBase';
import Bar from './Bar';
import Baz from './Baz';
import { Blah } from './Qux';
export class Foo extends WidgetBase {
    render() {
        return v('div'[v('div', ['Foo']),
            w(Bar, {}),
            w(Baz, {}),
            w(Blah, {})]);
    }
}
export default HelloWorld;
`;
		assert.equal(result.outputText, expected);
	});

	it('does add import and decorator for esm', () => {
		const transformer = registryTransformer(process.cwd(), ['Bar', 'Qux']);
		const result = ts.transpileModule(source, {
			compilerOptions: {
				importHelpers: true,
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ESNext
			},
			transformers: {
				before: [transformer]
			}
		});

		const expected = `import * as tslib_1 from "tslib";
import { registry as __autoRegistry } from "@dojo/widget-core/decorators/registry";
var __autoRegistryItems = { '__autoRegistryItem_Bar': () => import("./Bar"), '__autoRegistryItem_Blah': () => import("./Qux").then(module => module.Blah) };
import { v, w } from '@dojo/widget-core/d';
import WidgetBase from '@dojo/widget-core/WidgetBase';
import Baz from './Baz';
let Foo = class Foo extends WidgetBase {
    render() {
        return v('div'[v('div', ['Foo']),
            w("__autoRegistryItem_Bar", {}),
            w(Baz, {}),
            w("__autoRegistryItem_Blah", {})]);
    }
};
Foo = tslib_1.__decorate([
    __autoRegistry(__autoRegistryItems)
], Foo);
export { Foo };
export default HelloWorld;
`;

		assert.equal(result.outputText, expected);
	});

	it('does add import and decorator for commonjs', () => {
		const transformer = registryTransformer(process.cwd(), ['Bar', 'Qux']);
		const result = ts.transpileModule(source, {
			compilerOptions: {
				importHelpers: true,
				module: ts.ModuleKind.CommonJS,
				target: ts.ScriptTarget.ESNext
			},
			transformers: {
				before: [transformer]
			}
		});

		const expected = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const registry_1 = require("@dojo/widget-core/decorators/registry");
var __autoRegistryItems = { '__autoRegistryItem_Bar': () => Promise.resolve().then(() => require("./Bar")), '__autoRegistryItem_Blah': () => Promise.resolve().then(() => require("./Qux")).then(module => module.Blah) };
const d_1 = require("@dojo/widget-core/d");
const WidgetBase_1 = require("@dojo/widget-core/WidgetBase");
const Baz_1 = require("./Baz");
let Foo = class Foo extends WidgetBase_1.default {
    render() {
        return d_1.v('div'[d_1.v('div', ['Foo']),
            d_1.w("__autoRegistryItem_Bar", {}),
            d_1.w(Baz_1.default, {}),
            d_1.w("__autoRegistryItem_Blah", {})]);
    }
};
Foo = tslib_1.__decorate([
    registry_1.registry(__autoRegistryItems)
], Foo);
exports.Foo = Foo;
exports.default = HelloWorld;
`;
		assert.equal(result.outputText, expected);
	});
});
