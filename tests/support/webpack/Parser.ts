import NormalModule = require('./NormalModule');
import Pluginable from './Pluginable';

namespace MockParser {
	export interface ParserState {
		current?: NormalModule;
	}
}

class MockParser extends Pluginable {
	state: MockParser.ParserState;

	constructor(options?: any) {
		super();
		this.state = {} as MockParser.ParserState;
	}
}

// Node-style export used to maintain consistency with other webpack mocks.
export = MockParser;
