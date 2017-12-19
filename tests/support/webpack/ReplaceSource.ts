import Source = require('./Source');

class ReplaceSource {
	private _source: Source;
	name?: string;
	insertions: [number, string][];
	replacements: [number, number, string][];

	constructor(source: string) {
		this.insertions = [];
		this.replacements = [];
		this._source = new Source(source);
	}

	original() {
		return this._source;
	}

	insert(index: number, value: string) {
		this.insertions.push([index, value]);
	}

	replace(start: number, end: number, value: string) {
		this.replacements.push([start, end, value]);
	}

	source() {
		return this._source.source();
	}
}

export = ReplaceSource;
