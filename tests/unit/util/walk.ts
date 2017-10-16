import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import { Program } from 'estree';
import walk from '../../../src/static-build/util/walk';

function getAst(name: string): Program {
	return (require as any).nodeRequire((require as any).toUrl(`../../support/fixtures/${name}.json`));
}

registerSuite({
	name: 'plugins/util/walk',

	'enter/leave'() {
		const enterstack: any[] = [];
		const leavestack: any[] = [];
		walk(getAst('ast-walk'), {
			enter(...args: any[]) {
				enterstack.push(args);
			},
			leave(...args: any[]) {
				leavestack.push(args);
			}
		});
		assert.lengthOf(enterstack, 37);
		assert.lengthOf(leavestack, 37);
	},

	'enter only'() {
		const enterstack: any[] = [];
		walk(getAst('ast-walk'), {
			enter(...args: any[]) {
				enterstack.push(args);
			}
		});
		assert.lengthOf(enterstack, 37);
	},

	'leave only'() {
		const leavestack: any[] = [];
		walk(getAst('ast-walk'), {
			leave(...args: any[]) {
				leavestack.push(args);
			}
		});
		assert.lengthOf(leavestack, 37);
	}
});
