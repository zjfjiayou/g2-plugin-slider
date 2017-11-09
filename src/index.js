/**
 * @fileOverview G2's plugin for datazoom.
 * @author sima.zhang
 */
const G2 = window && window.G2;
const { Chart, Util, G, Global } = G2;
const { Canvas, DomUtil } = G;
const Range = require('./component/range');

class Slider {
  _initProps() {
    this.height = null;
    this.width = null;
    this.padding = Global.plotCfg.padding;
    this.container = null;
    this.xAxis = null;
    this.yAxis = null;
    // 选中区域的样式
    this.fillerStyle = {
      fill: '#BDCCED',
      fillOpacity: 0.3
    };
    // 滑动条背景样式
    this.backgroundStyle = {
      stroke: '#CCD6EC',
      fill: '#CCD6EC',
      fillOpacity: 0.3,
      lineWidth: 1
    };
    this.range = [ 0, 100 ];
    this.layout = 'horizontal';
    // 文本颜色
    this.textStyle = {
      fill: '#545454'
    };
    // 滑块的样式
    this.handleStyle = {
      img: 'https://gw.alipayobjects.com/zos/rmsportal/QXtfhORGlDuRvLXFzpsQ.png',
      width: 5
    };
    // 背景图表的配置，如果为 false 则表示不渲染
    this.backgroundChart = {
      type: [ 'area' ], // 图表的类型，可以是字符串也可是是数组
      color: '#CCD6EC'
    };
  }

  constructor(cfg) {
    this._initProps();
    Util.mix(this, cfg);
    this.domContainer = document.getElementById(this.container);
    this.handleStyle = Util.mix({
      width: this.height,
      height: this.height
    }, this.handleStyle);
    if (this.width === 'auto') { // 宽度自适应
      window.addEventListener('resize', Util.wrapBehavior(this, '_initForceFitEvent'));
    }
  }

  _initForceFitEvent() {
    const timer = setTimeout(Util.wrapBehavior(this, 'forceFit'), 200);
    clearTimeout(this.resizeTimer);
    this.resizeTimer = timer;
  }

  forceFit() {
    const width = DomUtil.getWidth(this.domContainer);
    const height = this.height;
    if (width !== this.domWidth) {
      const canvas = this.canvas;
      canvas.changeSize(width, height); // 改变画布尺寸
      this.bgChart && this.bgChart.changeWidth(width);
      canvas.clear();
      this._initWidth();
      this._initSlider(); // 初始化滑动条
      this._bindEvent();
      canvas.draw();
    }
  }

  _initWidth() {
    let width;
    if (this.width === 'auto') {
      width = DomUtil.getWidth(this.domContainer);
    } else {
      width = this.width;
    }
    this.domWidth = width;
    const padding = Util.toAllPadding(this.padding);

    if (this.layout === 'horizontal') {
      this.plotWidth = width - padding[1] - padding[3];
      this.plotPadding = padding[3];
      this.plotHeight = this.height;
    } else if (this.layout === 'vertical') {
      this.plotWidth = this.width;
      this.plotHeight = this.height - padding[0] - padding[2];
      this.plotPadding = padding[0];
    }
  }

  render() {
    this._initWidth();
    this._initCanvas(); // 初始化 canvas
    this._initBackground(); // 初始化背景图表
    this._initSlider(); // 初始化滑动条
    this._bindEvent();
    this.canvas.draw();
  }

  changeData(data) {
    this.data = data;
    this.repaint();
  }

  destroy() {
    const rangeElement = this.rangeElement;
    rangeElement.off('sliderchange');
    this.bgChart && this.bgChart.destroy();
    this.canvas.destroy();
    const container = this.domContainer;
    while (container.hasChildNodes()) {
      container.removeChild(container.firstChild);
    }
    window.removeEventListener('resize', Util.getWrapBehavior(this, '_initForceFitEvent'));
  }

  clear() {
    this.canvas.clear();
    this.bgChart && this.bgChart.destroy();
    this.bgChart = null;
    this.scale = null;
    this.canvas.draw();
  }

  repaint() {
    this.clear();
    this.render();
  }

  _initCanvas() {
    const width = this.domWidth;
    const height = this.height;
    const canvas = new Canvas({
      width,
      height,
      containerDOM: this.domContainer,
      capture: false
    });
    const node = canvas.get('el');
    node.style.position = 'absolute';
    node.style.top = 0;
    node.style.left = 0;
    node.style.zIndex = 3;
    this.canvas = canvas;
  }

  _initBackground() {
    const data = this.data;
    const xAxis = this.xAxis;
    const yAxis = this.yAxis;
    if (!data) { // 没有数据，则不创建
      throw new Error('Please specify the data!');
    }
    if (!xAxis) {
      throw new Error('Please specify the xAxis!');
    }
    if (!yAxis) {
      throw new Error('Please specify the yAxis!');
    }

    const backgroundChart = this.backgroundChart;
    let type = backgroundChart.type;
    const color = backgroundChart.color;
    if (!Util.isArray(type)) {
      type = [ type ];
    }

    const padding = Util.toAllPadding(this.padding);
    const bgChart = new Chart({
      container: this.container,
      width: this.domWidth,
      height: this.height,
      padding: [ 0, padding[1], 0, padding[3] ],
      animate: false
    });
    bgChart.source(data);
    bgChart.scale(xAxis, {
      range: [ 0, 1 ],
      nice: false
    });
    bgChart.axis(false);
    bgChart.tooltip(false);
    bgChart.legend(false);
    Util.each(type, eachType => {
      bgChart[eachType]()
        .position(xAxis + '*' + yAxis)
        .color(color)
        .opacity(1);
    });
    bgChart.render();
    this.bgChart = bgChart;
    this.scale = this.layout === 'horizontal' ? bgChart.getXScale() : bgChart.getYScales()[0];
    if (this.layout === 'vertical') {
      bgChart.destroy();
    }
  }

  _initRange() {
    const start = this.start;
    const end = this.end;
    const scale = this.scale;
    const min = start ? scale.scale(start) : 1;
    const max = end ? scale.scale(end) : 1;
    const range = [ min * 100, max * 100 ];
    this.range = range;
    return range;
  }

  _getHandleValue(type) {
    let value;
    const range = this.range;
    const min = range[0] / 100;
    const max = range[1] / 100;
    const scale = this.scale;
    if (type === 'min') {
      value = this.start ? this.start : scale.invert(min);
    } else {
      value = this.end ? this.end : scale.invert(max);
    }
    return value;
  }

  _initSlider() {
    const canvas = this.canvas;
    const range = this._initRange();
    const scale = this.scale;
    const rangeElement = canvas.addGroup(Range, {
      middleAttr: this.fillerStyle,
      range,
      layout: this.layout,
      width: this.plotWidth,
      height: this.plotHeight,
      backgroundStyle: this.backgroundStyle,
      textStyle: this.textStyle,
      handleStyle: this.handleStyle,
      minText: scale.getText(this._getHandleValue('min')),
      maxText: scale.getText(this._getHandleValue('max'))
    });
    if (this.layout === 'horizontal') {
      rangeElement.translate(this.plotPadding, 0);
    } else if (this.layout === 'vertical') {
      rangeElement.translate(0, this.plotPadding);
    }
    this.rangeElement = rangeElement;
  }

  _bindEvent() {
    const self = this;
    const rangeElement = self.rangeElement;
    rangeElement.on('sliderchange', function(ev) {
      const range = ev.range;
      const minRatio = range[0] / 100;
      const maxRatio = range[1] / 100;
      self._updateElement(minRatio, maxRatio);
    });
  }

  _updateElement(minRatio, maxRatio) {
    const scale = this.scale;
    const rangeElement = this.rangeElement;
    const minTextElement = rangeElement.get('minTextElement');
    const maxTextElement = rangeElement.get('maxTextElement');
    const min = scale.invert(minRatio);
    const max = scale.invert(maxRatio);
    const minText = scale.getText(min);
    const maxText = scale.getText(max);
    minTextElement.attr('text', minText);
    maxTextElement.attr('text', maxText);
    this.start = minText;
    this.end = maxText;

    if (this.onChange) {
      this.onChange(minText, maxText);
    }
  }
}

module.exports = Slider;
