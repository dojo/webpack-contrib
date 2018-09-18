import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import { dom } from '@dojo/framework/widget-core/d';
import * as d3 from 'd3';

import * as css from './Sunburst.m.css';

interface SunburstProperties {
	chartData: any;
	onHover: Function;
}

export class Sunburst extends WidgetBase<SunburstProperties> {
	private _arc: any;
	private _radius: any;
	private _x: any;
	private _y: any;
	private _sunburst: HTMLDivElement;
	private _path: any;

	constructor() {
		super();
		this._sunburst = document.createElement('div');
	}

	protected render() {
		return dom({
			node: this._sunburst,
			props: { classes: [css.sunburst] }
		});
	}

	protected onAttach() {
		if (this.properties.chartData) {
			const color = d3.scale.category20c();
			const width = Math.min(this._sunburst.offsetWidth, this._sunburst.offsetHeight);
			const height = width + 50;

			this._radius = Math.min(width, height) / 2;
			this._x = d3.scale.linear().range([0, 2 * Math.PI]);
			this._y = d3.scale.sqrt().range([0, this._radius]);

			const svg = d3
				.select(this._sunburst)
				.append('svg')
				.attr('width', width)
				.attr('height', height)
				.append('g')
				.attr('transform', `translate(${width / 2}, ${height / 2 + 10})`);

			const partition = d3.layout
				.partition()
				.value((d: any) => d.statSize)
				.children((d: any) => d.groups);

			this._arc = d3.svg
				.arc()
				.startAngle((d: any) => Math.max(0, Math.min(2 * Math.PI, this._x(d.x))))
				.endAngle((d: any) => Math.max(0, Math.min(2 * Math.PI, this._x(d.x + d.dx))))
				.innerRadius((d: any) => Math.max(0, this._y(d.y)))
				.outerRadius((d: any) => Math.max(0, this._y(d.y + d.dy)));

			this._path = svg
				.selectAll('path')
				.data(partition.nodes(this.properties.chartData))
				.enter()
				.append('path')
				.attr('d', this._arc)
				.style('fill', (d: any) => color((d.children || !d.parent ? d : d.parent).label))
				.on('click', this.onClick.bind(this))
				.on('mouseover', this.onMouseOver.bind(this));

			this.onMouseOver(this.properties.chartData);
		}
	}

	onClick(d: any) {
		this._path
			.transition()
			.duration(750)
			.attrTween('d', this.arcTween(d));
	}

	onMouseOver(d: any) {
		this.properties.onHover(d);
	}

	arcTween(d: any) {
		const xd = d3.interpolate(this._x.domain(), [d.x, d.x + d.dx]);
		const yd = d3.interpolate(this._y.domain(), [d.y, 1]);
		const yr = d3.interpolate(this._y.range(), [d.y ? 20 : 0, this._radius]);

		return (d: any, i: any) => {
			return i
				? (t: any) => {
						return this._arc(d);
				  }
				: (t: any) => {
						this._x.domain(xd(t));
						this._y.domain(yd(t)).range(yr(t));
						return this._arc(d);
				  };
		};
	}
}
