import global from '@dojo/framework/shim/global';
import has from '@dojo/framework/has/has';
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import { v, w } from '@dojo/framework/widget-core/d';
import { Sunburst } from './components/Sunburst';
import Select from '@dojo/widgets/select';
import * as filesize from 'filesize';

let bundleContent: any = global.window.__bundleContent || {};
let bundleList = global.window.__bundleList || [];

if (has('env') === 'dev') {
	console.log('In development mode; using static test data');
	bundleContent = require('./data/bundleContent').default;
	bundleList = require('./data/bundleList').default;
}

import * as css from './App.m.css';
import dojo from '@dojo/themes/dojo';

export class App extends WidgetBase {
	private _selectedBundle = bundleList[0];
	private _chartData = bundleContent[this._selectedBundle];
	private _item: any;

	private _onHover(item: any) {
		this._item = item;
		this.invalidate();
	}

	protected render() {
		const singleBundle = bundleList.length <= 1;

		let segmentDescription: any = null;
		if (this._item) {
			const label =
				this._item.label.indexOf(this._selectedBundle) === -1 ? this._item.label : this._selectedBundle;
			segmentDescription = v('div', { classes: [css.infoInner] }, [
				v('div', { classes: [css.filename] }, [label]),
				v('div', { classes: [css.contents] }, [
					v('div', { classes: [css.size] }, [filesize(this._item.statSize)]),
					v('div', { classes: [css.type] }, ['stat']),
					v('div', { classes: [css.size] }, [this._item.parsedSize ? filesize(this._item.parsedSize) : null]),
					v('div', { classes: [css.type] }, [this._item.parsedSize ? 'parsed' : null]),
					v('div', { classes: [css.size] }, [this._item.gzipSize ? filesize(this._item.gzipSize) : null]),
					v('div', { classes: [css.type] }, [this._item.gzipSize ? 'gzip' : null])
				])
			]);
		}

		return v('div', { classes: [css.root] }, [
			v('div', { classes: [css.stats] }, [
				singleBundle
					? null
					: w(Select, {
							theme: dojo,
							extraClasses: {
								root: css.selectOverride
							},
							options: bundleList,
							getOptionSelected: (result: any) => {
								return result === this._selectedBundle;
							},
							onChange: (result: any) => {
								this._selectedBundle = result;
								this._chartData = bundleContent[result];
								this.invalidate();
							},
							value: this._selectedBundle
					  }),
				segmentDescription
			]),
			v('div', { key: 'container', classes: [css.sunburst] }, [
				this._chartData
					? w(Sunburst, { key: this._selectedBundle, chartData: this._chartData, onHover: this._onHover })
					: null
			])
		]);
	}
}
