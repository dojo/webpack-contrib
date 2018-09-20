import * as path from 'path';
import * as mkdir from 'mkdirp';
import * as viewer from './viewer';
import { Compiler } from 'webpack';
const bfj = require('bfj-node4');

export interface BundleAnalyzerOptions {
	reportFileName: string;
	generateStatsFile: boolean;
	statsFileName: string;
	statsOptions: string | null;
}

export default class BundleAnalyzerPlugin {
	private opts: BundleAnalyzerOptions;
	private compiler: any;

	constructor(opts: Partial<BundleAnalyzerOptions>) {
		this.opts = {
			reportFileName: 'report.html',
			generateStatsFile: false,
			statsFileName: 'stats.json',
			statsOptions: null,
			...opts
		};
	}

	apply(compiler: Compiler) {
		this.compiler = compiler;
		const done = (stats: any) => {
			stats = stats.toJson(this.opts.statsOptions);
			if (this.opts.generateStatsFile) {
				this.generateStatsFile(stats);
			}
			this.generateStaticReport(stats);
		};

		compiler.plugin('done', done);
	}

	async generateStatsFile(stats: any) {
		const statsFilePath = path.resolve(this.compiler.outputPath, this.opts.statsFileName);
		mkdir.sync(path.dirname(statsFilePath));

		try {
			await bfj.write(statsFilePath, stats, {
				promises: 'ignore',
				buffers: 'ignore',
				maps: 'ignore',
				iterables: 'ignore',
				circular: 'ignore'
			});
		} catch {}
	}

	generateStaticReport(stats: any) {
		viewer.generateReportData(stats, {
			reportFileName: path.resolve(this.compiler.outputPath, this.opts.reportFileName),
			bundleDir: this.getBundleDirFromCompiler()
		});
	}

	getBundleDirFromCompiler() {
		return this.compiler.outputFileSystem.constructor.name === 'MemoryFileSystem' ? null : this.compiler.outputPath;
	}
}
