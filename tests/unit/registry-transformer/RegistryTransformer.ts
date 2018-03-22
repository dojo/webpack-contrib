import registryTransformer from '../../../src/registry-transformer/index';
import * as ts from 'typescript';

const { describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

const source = `
import { v, w } from '@dojo/widget-core/d';
import WidgetBase from '@dojo/widget-core/WidgetBase';
import Bar from './Bar';
import Baz from './Baz';
import Quz from './Quz';
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

export class Another extends WidgetBase {
	protected render() {
		return v('div' [
			w(Bar, {}),
			w(Baz, {}),
			w(Quz, {})
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
import Quz from './Quz';
import { Blah } from './Qux';
export class Foo extends WidgetBase {
    render() {
        return v('div'[v('div', ['Foo']),
            w(Bar, {}),
            w(Baz, {}),
            w(Blah, {})]);
    }
}
export class Another extends WidgetBase {
    render() {
        return v('div'[w(Bar, {}),
            w(Baz, {}),
            w(Quz, {})]);
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
var __autoRegistryItems_1 = { '__autoRegistryItem_Bar': () => import("./Bar") };
var __autoRegistryItems_2 = { '__autoRegistryItem_Bar': () => import("./Bar") };
import { v, w } from '@dojo/widget-core/d';
import WidgetBase from '@dojo/widget-core/WidgetBase';
import Baz from './Baz';
import Quz from './Quz';
import { Blah } from './Qux';
let Foo = class Foo extends WidgetBase {
    render() {
        return v('div'[v('div', ['Foo']),
            w("__autoRegistryItem_Bar", {}),
            w(Baz, {}),
            w(Blah, {})]);
    }
};
Foo = tslib_1.__decorate([
    __autoRegistry(__autoRegistryItems_1)
], Foo);
export { Foo };
let Another = class Another extends WidgetBase {
    render() {
        return v('div'[w("__autoRegistryItem_Bar", {}),
            w(Baz, {}),
            w(Quz, {})]);
    }
};
Another = tslib_1.__decorate([
    __autoRegistry(__autoRegistryItems_2)
], Another);
export { Another };
export default HelloWorld;
`;
		assert.equal(result.outputText, expected);
	});

	it('does add import and decorator for commonjs', () => {
		const transformer = registryTransformer(process.cwd(), ['Bar', 'Qux', 'Quz']);
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
var __autoRegistryItems_1 = { '__autoRegistryItem_Bar': () => Promise.resolve().then(() => require("./Bar")) };
var __autoRegistryItems_2 = { '__autoRegistryItem_Bar': () => Promise.resolve().then(() => require("./Bar")), '__autoRegistryItem_Quz': () => Promise.resolve().then(() => require("./Quz")) };
const d_1 = require("@dojo/widget-core/d");
const WidgetBase_1 = require("@dojo/widget-core/WidgetBase");
const Baz_1 = require("./Baz");
const Qux_1 = require("./Qux");
let Foo = class Foo extends WidgetBase_1.default {
    render() {
        return d_1.v('div'[d_1.v('div', ['Foo']),
            d_1.w("__autoRegistryItem_Bar", {}),
            d_1.w(Baz_1.default, {}),
            d_1.w(Qux_1.Blah, {})]);
    }
};
Foo = tslib_1.__decorate([
    registry_1.registry(__autoRegistryItems_1)
], Foo);
exports.Foo = Foo;
let Another = class Another extends WidgetBase_1.default {
    render() {
        return d_1.v('div'[d_1.w("__autoRegistryItem_Bar", {}),
            d_1.w(Baz_1.default, {}),
            d_1.w("__autoRegistryItem_Quz", {})]);
    }
};
Another = tslib_1.__decorate([
    registry_1.registry(__autoRegistryItems_2)
], Another);
exports.Another = Another;
exports.default = HelloWorld;
`;

		assert.equal(result.outputText, expected);
	});
});
