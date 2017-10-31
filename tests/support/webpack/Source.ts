class Source {
	private _source: string;

	constructor(source: string) {
		this._source = source;
	}

	source() {
		return this._source;
	}
}

export = Source;
