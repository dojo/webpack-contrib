import registryTransformer from '../../../src/registry-transformer/index';
import * as ts from 'typescript';

const nl = require('normalize-newline');
const { beforeEach, describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

const source = `
import { v, w } from '@dojo/framework/widget-core/d';
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import Bar from './widgets/Bar';
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

const sourceTsx = `
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import Bar from './widgets/Bar';
import Baz from './Baz';
import Quz from './Quz';
import { Blah } from './Qux';

export class Foo extends WidgetBase {
	protected render() {
		return (
			<div>
				<div>
					<div>Foo</div>
					<Bar prop="hello" />
					<Baz>
						<div>child</div>
					</Baz>
					<Blah />
				</div>
			</div>
		);
	}
}

export class Another extends WidgetBase {
	protected render() {
		return (
			<div>
				<Bar />
				<Baz />
				<Qux />
			</div>
		);
	}
}
`;

describe('registry-transformer', () => {
	let shared: any = {};

	beforeEach(() => {
		shared = require('../../../src/registry-transformer/shared');
		shared.modules = {};
	});

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

		const resultTsx = ts.transpileModule(sourceTsx, {
			compilerOptions: {
				importHelpers: true,
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ESNext,
				jsx: ts.JsxEmit.Preserve,
				jsxFactory: 'tsx'
			},
			transformers: {
				before: [transformer]
			}
		});

		const expected = `import { v, w } from '@dojo/framework/widget-core/d';
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import Bar from './widgets/Bar';
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

		const expectedTsx = `import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import Bar from './widgets/Bar';
import Baz from './Baz';
import { Blah } from './Qux';
export class Foo extends WidgetBase {
    render() {
        return (<div>
				<div>
					<div>Foo</div>
					<Bar prop="hello"/>
					<Baz>
						<div>child</div>
					</Baz>
					<Blah />
				</div>
			</div>);
    }
}
export class Another extends WidgetBase {
    render() {
        return (<div>
				<Bar />
				<Baz />
				<Qux />
			</div>);
    }
}
`;

		assert.equal(nl(result.outputText), expected);
		assert.equal(nl(resultTsx.outputText), expectedTsx);
	});

	it('does add import and decorator for esm', () => {
		const transformer = registryTransformer(process.cwd(), ['widgets/Bar', 'Qux', 'Baz']);
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

		const resultTsx = ts.transpileModule(sourceTsx, {
			compilerOptions: {
				importHelpers: true,
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ESNext,
				jsx: ts.JsxEmit.Preserve,
				jsxFactory: 'tsx'
			},
			transformers: {
				before: [transformer]
			}
		});

		const expected = `import * as tslib_1 from "tslib";
import { registry as __autoRegistry } from "@dojo/framework/widget-core/decorators/registry";
var __autoRegistryItems_1 = { '__autoRegistryItem_Bar': () => import("./widgets/Bar"), '__autoRegistryItem_Baz': () => import("./Baz") };
var __autoRegistryItems_2 = { '__autoRegistryItem_Bar': () => import("./widgets/Bar"), '__autoRegistryItem_Baz': () => import("./Baz") };
import { v, w } from '@dojo/framework/widget-core/d';
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import Quz from './Quz';
import { Blah } from './Qux';
let Foo = class Foo extends WidgetBase {
    render() {
        return v('div'[v('div', ['Foo']),
            w("__autoRegistryItem_Bar", {}),
            w("__autoRegistryItem_Baz", {}),
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
            w("__autoRegistryItem_Baz", {}),
            w(Quz, {})]);
    }
};
Another = tslib_1.__decorate([
    __autoRegistry(__autoRegistryItems_2)
], Another);
export { Another };
export default HelloWorld;
`;

		const expectedTsx = `import * as tslib_1 from "tslib";
import { registry as __autoRegistry } from "@dojo/framework/widget-core/decorators/registry";
var Loadable__ = { type: "registry" };
var __autoRegistryItems_1 = { '__autoRegistryItem_Bar': () => import("./widgets/Bar"), '__autoRegistryItem_Baz': () => import("./Baz") };
var __autoRegistryItems_2 = { '__autoRegistryItem_Bar': () => import("./widgets/Bar"), '__autoRegistryItem_Baz': () => import("./Baz") };
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import { Blah } from './Qux';
let Foo = class Foo extends WidgetBase {
    render() {
        return (<div>
				<div>
					<div>Foo</div>
					<Loadable__ prop="hello" __autoRegistryItem="__autoRegistryItem_Bar"/>
					<Loadable__ __autoRegistryItem="__autoRegistryItem_Baz">
						<div>child</div>
					</Loadable__>
					<Blah />
				</div>
			</div>);
    }
};
Foo = tslib_1.__decorate([
    __autoRegistry(__autoRegistryItems_1)
], Foo);
export { Foo };
let Another = class Another extends WidgetBase {
    render() {
        return (<div>
				<Loadable__ __autoRegistryItem="__autoRegistryItem_Bar"/>
				<Loadable__ __autoRegistryItem="__autoRegistryItem_Baz"/>
				<Qux />
			</div>);
    }
};
Another = tslib_1.__decorate([
    __autoRegistry(__autoRegistryItems_2)
], Another);
export { Another };
`;

		assert.equal(nl(result.outputText), expected);
		assert.equal(nl(resultTsx.outputText), expectedTsx);
	});

	it('does add import and decorator for commonjs', () => {
		const transformer = registryTransformer(process.cwd(), ['widgets/Bar', 'Qux', 'Quz']);
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
const registry_1 = require("@dojo/framework/widget-core/decorators/registry");
var __autoRegistryItems_1 = { '__autoRegistryItem_Bar': () => Promise.resolve().then(() => require("./widgets/Bar")) };
var __autoRegistryItems_2 = { '__autoRegistryItem_Bar': () => Promise.resolve().then(() => require("./widgets/Bar")), '__autoRegistryItem_Quz': () => Promise.resolve().then(() => require("./Quz")) };
const d_1 = require("@dojo/framework/widget-core/d");
const WidgetBase_1 = require("@dojo/framework/widget-core/WidgetBase");
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

		assert.equal(nl(result.outputText), expected);
	});

	it('replaces all widgets in all mode', () => {
		const transformer = registryTransformer(process.cwd(), [], true);
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
import { registry as __autoRegistry } from "@dojo/framework/widget-core/decorators/registry";
var __autoRegistryItems_1 = { '__autoRegistryItem_Bar': () => import("./widgets/Bar"), '__autoRegistryItem_Baz': () => import("./Baz") };
var __autoRegistryItems_2 = { '__autoRegistryItem_Bar': () => import("./widgets/Bar"), '__autoRegistryItem_Baz': () => import("./Baz"), '__autoRegistryItem_Quz': () => import("./Quz") };
import { v, w } from '@dojo/framework/widget-core/d';
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import { Blah } from './Qux';
let Foo = class Foo extends WidgetBase {
    render() {
        return v('div'[v('div', ['Foo']),
            w("__autoRegistryItem_Bar", {}),
            w("__autoRegistryItem_Baz", {}),
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
            w("__autoRegistryItem_Baz", {}),
            w("__autoRegistryItem_Quz", {})]);
    }
};
Another = tslib_1.__decorate([
    __autoRegistry(__autoRegistryItems_2)
], Another);
export { Another };
export default HelloWorld;
`;
		assert.equal(nl(result.outputText), expected);
		assert.deepEqual(shared, {
			modules: {
				__autoRegistryItem_Bar: { path: 'widgets/Bar', outletName: undefined },
				__autoRegistryItem_Baz: { path: 'Baz', outletName: undefined },
				__autoRegistryItem_Quz: { path: 'Quz', outletName: undefined }
			}
		});
	});

	it('can distinguish widgets in an outlet renderer', () => {
		const source = `
		import { v, w } from '@dojo/framework/widget-core/d';
		import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
		import { Outlet } from '@dojo/framework/routing/Outlet';
		import Bar from './widgets/Bar';
		import Baz from './Baz';
		import Quz from './Quz';
		import Blah from './Qux';
		import Something from './Something';

		export class Foo extends WidgetBase {
			protected render() {
				return v('div' [
					v('div', ['Foo']),
					w(Outlet, {
						id: 'my-foo-outlet',
						renderer: () => {
							return w(Something, {});
						}
					}),
					w(Outlet, {
						id: 'my-blah-outlet',
						renderer() {
							return w(Blah, {});
						}
					}),
					w(Bar, {}),
					w(Baz, {})
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
		const transformer = registryTransformer(process.cwd(), ['widgets/Bar', 'Quz'], false, [
			'my-foo-outlet',
			'my-blah-outlet'
		]);
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
import { registry as __autoRegistry } from "@dojo/framework/widget-core/decorators/registry";
var __autoRegistryItems_1 = { '__autoRegistryItem_Something': () => import("./Something"), '__autoRegistryItem_Blah': () => import("./Qux"), '__autoRegistryItem_Bar': () => import("./widgets/Bar") };
var __autoRegistryItems_2 = { '__autoRegistryItem_Bar': () => import("./widgets/Bar"), '__autoRegistryItem_Quz': () => import("./Quz") };
import { v, w } from '@dojo/framework/widget-core/d';
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import { Outlet } from '@dojo/framework/routing/Outlet';
import Baz from './Baz';
let Foo = class Foo extends WidgetBase {
    render() {
        return v('div'[v('div', ['Foo']),
            w(Outlet, {
                id: 'my-foo-outlet',
                renderer: () => {
                    return w("__autoRegistryItem_Something", {});
                }
            }),
            w(Outlet, {
                id: 'my-blah-outlet',
                renderer() {
                    return w("__autoRegistryItem_Blah", {});
                }
            }),
            w("__autoRegistryItem_Bar", {}),
            w(Baz, {})]);
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
            w("__autoRegistryItem_Quz", {})]);
    }
};
Another = tslib_1.__decorate([
    __autoRegistry(__autoRegistryItems_2)
], Another);
export { Another };
export default HelloWorld;
`;
		assert.equal(nl(result.outputText), expected);
		assert.deepEqual(shared, {
			modules: {
				__autoRegistryItem_Bar: { path: 'widgets/Bar', outletName: undefined },
				__autoRegistryItem_Blah: { path: 'Qux', outletName: 'my-blah-outlet' },
				__autoRegistryItem_Quz: { path: 'Quz', outletName: undefined },
				__autoRegistryItem_Something: { outletName: 'my-foo-outlet', path: 'Something' }
			}
		});
	});

	it('can distinguish widgets in an outlet renderer tsx', () => {
		const source = `
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import Bar from './widgets/Bar';
import Baz from './Baz';
import Outlet from '@dojo/framework/routing/Outlet';

export class Foo extends WidgetBase {
	protected render() {
		return (
			<div>
				<div>
					<div>Foo</div>
					<Baz>
						<div>child</div>
					</Baz>
					<Outlet id="my-bar-outlet" renderer={ () => (<Bar />) } />
				</div>
			</div>
		);
	}
}
`;
		const transformer = registryTransformer(process.cwd(), [], false, ['my-bar-outlet']);
		const result = ts.transpileModule(source, {
			compilerOptions: {
				importHelpers: true,
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ESNext,
				jsx: ts.JsxEmit.Preserve,
				jsxFactory: 'tsx'
			},
			transformers: {
				before: [transformer]
			}
		});
		const expected = `import * as tslib_1 from "tslib";
import { registry as __autoRegistry } from "@dojo/framework/widget-core/decorators/registry";
var Loadable__ = { type: "registry" };
var __autoRegistryItems_1 = { '__autoRegistryItem_Bar': () => import("./widgets/Bar") };
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import Baz from './Baz';
import Outlet from '@dojo/framework/routing/Outlet';
let Foo = class Foo extends WidgetBase {
    render() {
        return (<div>
				<div>
					<div>Foo</div>
					<Baz>
						<div>child</div>
					</Baz>
					<Outlet id="my-bar-outlet" renderer={() => (<Loadable__ __autoRegistryItem="__autoRegistryItem_Bar"/>)}/>
				</div>
			</div>);
    }
};
Foo = tslib_1.__decorate([
    __autoRegistry(__autoRegistryItems_1)
], Foo);
export { Foo };
`;
		assert.equal(nl(result.outputText), expected);
		assert.deepEqual(shared, {
			modules: {
				__autoRegistryItem_Bar: { path: 'widgets/Bar', outletName: 'my-bar-outlet' }
			}
		});
	});
});
