import global from '@dojo/framework/shim/global';
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import { v, w } from '@dojo/framework/widget-core/d';
import { Sunburst } from './components/Sunburst';
import Select from '@dojo/widgets/select';
import * as filesize from 'filesize';

import * as css from './App.m.css';
import dojo from '@dojo/themes/dojo';

interface AppProperties {
	bundles: string[];
}

export class App extends WidgetBase<AppProperties> {
	private _chartData: any;
	private _item: any;
	private _selectedBundle = '';

	private _onHover(item: any) {
		this._item = item;
		this.invalidate();
	}

	protected onAttach() {
		this._selectedBundle = this.properties.bundles[0];
		this._chartData = global.window.__bundleContent[this._selectedBundle];
		this.invalidate();
	}

	protected render() {
		const singleBundle = this.properties.bundles.length === 1;

		return v('div', { classes: [css.root] }, [
			v('div', { classes: [css.stats] }, [
				singleBundle
					? null
					: w(Select, {
							theme: dojo,
							extraClasses: {
								root: css.selectOverride
							},
							options: this.properties.bundles,
							getOptionSelected: (result: any) => {
								return result === this._selectedBundle;
							},
							onChange: (result: any) => {
								this._selectedBundle = result;
								this._chartData = global.window.__bundleContent[result];
								this.invalidate();
							},
							value: this._selectedBundle
					  }),
				this._item
					? v('div', { classes: [css.infoInner] }, [
							v('div', { classes: [css.filename] }, [this._item.label]),
							v('div', { classes: [css.contents] }, [
								v('div', { classes: [css.size] }, [filesize(this._item.statSize)]),
								v('div', { classes: [css.type] }, ['stat']),
								v('div', { classes: [css.size] }, [
									this._item.parsedSize ? filesize(this._item.parsedSize) : null
								]),
								v('div', { classes: [css.type] }, [this._item.parsedSize ? 'parsed' : null]),
								v('div', { classes: [css.size] }, [
									this._item.gzipSize ? filesize(this._item.gzipSize) : null
								]),
								v('div', { classes: [css.type] }, [this._item.gzipSize ? 'gzip' : null])
							])
					  ])
					: null
			]),
			v('div', { classes: [css.sunburst] }, [
				this._chartData
					? w(Sunburst, { key: this._selectedBundle, chartData: this._chartData, onHover: this._onHover })
					: null
			])
		]);
	}
}
