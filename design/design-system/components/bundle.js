/* @ds-bundle: {"format":4,"namespace":"Vidcosmos","components":[{"name":"Button"},{"name":"Icon"},{"name":"TextField"},{"name":"SegmentedControl"},{"name":"Chip"},{"name":"Badge"},{"name":"ProgressBar"},{"name":"Toast"},{"name":"Card"},{"name":"Logo"},{"name":"PromptComposer"},{"name":"VideoCard"},{"name":"SceneRow"},{"name":"ChatMessage"},{"name":"ProposalCard"},{"name":"UsageMeter"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;

  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(' ');
  }
  function omit(obj, keys) {
    var out = {};
    for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k) && keys.indexOf(k) < 0) out[k] = obj[k];
    return out;
  }

  /* Icon: a few Lucide-style outline glyphs, 24 grid, 1.75 stroke */
  var GLYPHS = {
    play: ['M7 4.5l12 7.5-12 7.5z'],
    check: ['M20 6L9 17l-5-5'],
    clock: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 7.5V12l3 2'],
    alert: ['M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4', 'M12 17h.01'],
    x: ['M18 6L6 18', 'M6 6l12 12'],
    sparkles: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', 'M19 15.5l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6z'],
    'arrow-right': ['M5 12h14', 'M13 6l6 6-6 6'],
    'arrow-up': ['M12 19V5', 'M5 12l7-7 7 7'],
    mic: ['M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z', 'M19 11a7 7 0 0 1-14 0', 'M12 18v3'],
    pencil: ['M4 20h4L19 9l-4-4L4 16v4z', 'M13.5 6.5l4 4'],
    loader: ['M12 3a9 9 0 1 0 9 9'],
    film: ['M4 4h16v16H4z', 'M8 4v16', 'M16 4v16', 'M4 9h4', 'M4 15h4', 'M16 9h4', 'M16 15h4'],
    send: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4z']
  };
  function Icon(props) {
    var size = props.size || 20;
    var paths = GLYPHS[props.name] || GLYPHS.sparkles;
    var a11y = props.label ? { role: 'img', 'aria-label': props.label } : { 'aria-hidden': 'true' };
    return h('svg', Object.assign({
      className: cx('vc-icon', props.name === 'loader' && 'vc-spin', props.className),
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', focusable: 'false'
    }, a11y), paths.map(function (d, i) { return h('path', { key: i, d: d }); }));
  }

  /* Button */
  function Button(props) {
    var variant = props.variant || 'primary';
    var size = props.size || 'md';
    var rest = omit(props, ['variant', 'size', 'icon', 'iconEnd', 'loading', 'fullWidth', 'className', 'children', 'type']);
    var iconSize = size === 'sm' ? 16 : 18;
    var lead = props.loading ? h(Icon, { name: 'loader', size: iconSize }) : (props.icon ? h(Icon, { name: props.icon, size: iconSize }) : null);
    return h('button', Object.assign({
      type: props.type || 'button',
      className: cx('vc-btn', 'vc-btn--' + variant, 'vc-btn--' + size, props.fullWidth && 'vc-btn--full', props.loading && 'is-loading', props.className),
      'aria-busy': props.loading ? 'true' : undefined
    }, rest), lead, props.children ? h('span', { className: 'vc-btn__label' }, props.children) : null,
      props.iconEnd ? h(Icon, { name: props.iconEnd, size: iconSize }) : null);
  }

  /* TextField */
  function TextField(props) {
    var autoId = React.useId();
    var id = props.id || autoId;
    var helpId = id + '-help';
    var rest = omit(props, ['label', 'helper', 'error', 'multiline', 'rows', 'id', 'className', 'lang']);
    var control = h(props.multiline ? 'textarea' : 'input', Object.assign({
      id: id,
      className: cx('vc-field__control', props.multiline && 'vc-field__control--multi'),
      rows: props.multiline ? (props.rows || 3) : undefined,
      'aria-invalid': props.error ? 'true' : undefined,
      'aria-describedby': (props.error || props.helper) ? helpId : undefined,
      lang: props.lang
    }, rest));
    return h('div', { className: cx('vc-field', props.error && 'is-invalid', props.className) },
      props.label ? h('label', { className: 'vc-field__label', htmlFor: id }, props.label) : null,
      control,
      (props.error || props.helper) ? h('p', { id: helpId, className: 'vc-field__help' },
        props.error ? h(Icon, { name: 'alert', size: 14 }) : null, props.error || props.helper) : null);
  }

  /* SegmentedControl */
  function SegmentedControl(props) {
    var options = props.options || [];
    var first = options.length ? options[0].value : undefined;
    var st = React.useState(props.defaultValue !== undefined ? props.defaultValue : first);
    var value = props.value !== undefined ? props.value : st[0];
    function pick(v) { if (props.value === undefined) st[1](v); if (props.onChange) props.onChange(v); }
    return h('div', { className: cx('vc-seg', props.size === 'sm' && 'vc-seg--sm', props.className), role: 'radiogroup', 'aria-label': props.label },
      options.map(function (o) {
        var on = o.value === value;
        return h('button', {
          key: String(o.value), type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false',
          className: cx('vc-seg__item', on && 'is-selected'), lang: o.lang, onClick: function () { pick(o.value); }
        }, o.label);
      }));
  }

  /* Chip */
  function Chip(props) {
    var rest = omit(props, ['selected', 'icon', 'className', 'children']);
    return h('button', Object.assign({
      type: 'button', 'aria-pressed': props.selected ? 'true' : 'false',
      className: cx('vc-chip', props.selected && 'is-selected', props.className)
    }, rest), props.icon ? h(Icon, { name: props.icon, size: 16 }) : null, props.children);
  }

  /* Badge */
  function Badge(props) {
    var tone = props.tone || 'neutral';
    return h('span', { className: cx('vc-badge', 'vc-badge--' + tone, props.className) },
      props.icon ? h(Icon, { name: props.icon, size: 14 }) : null, props.children);
  }

  /* ProgressBar */
  function ProgressBar(props) {
    var v = Math.max(0, Math.min(100, Math.round(props.value || 0)));
    return h('div', { className: cx('vc-progress', props.className) },
      (props.label || props.showValue !== false) ? h('div', { className: 'vc-progress__row' },
        h('span', { className: 'vc-progress__label' }, props.label || ''),
        props.showValue !== false ? h('span', { className: 'vc-progress__value' }, v + '%') : null) : null,
      h('div', { className: 'vc-progress__track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': v, 'aria-label': props.label || 'Progress' },
        h('div', { className: 'vc-progress__fill', style: { width: v + '%' } })));
  }

  /* Toast */
  function Toast(props) {
    var tone = props.tone || 'default';
    var icon = tone === 'success' ? 'check' : tone === 'danger' ? 'alert' : null;
    return h('div', { className: cx('vc-toast', 'vc-toast--' + tone, props.className), role: 'status' },
      icon ? h(Icon, { name: icon, size: 18 }) : null,
      h('span', { className: 'vc-toast__msg' }, props.children),
      props.actionLabel ? h('button', { type: 'button', className: 'vc-toast__action', onClick: props.onAction }, props.actionLabel) : null,
      props.onClose ? h('button', { type: 'button', className: 'vc-toast__close', 'aria-label': 'Dismiss', onClick: props.onClose }, h(Icon, { name: 'x', size: 16 })) : null);
  }

  /* Card */
  function Card(props) {
    var rest = omit(props, ['padding', 'interactive', 'selected', 'as', 'className', 'children']);
    return h(props.as || 'div', Object.assign({
      className: cx('vc-card', 'vc-card--pad-' + (props.padding || 'md'), props.interactive && 'vc-card--interactive', props.selected && 'is-selected', props.className)
    }, rest), props.children);
  }

  /* Logo */
  var WORDMARK = 'M9 21.8 0.4 0H6.9L11.6 13.1L16.4 0H22.8L14.2 21.8Z M24.3 21.8V0H30.3V21.8ZM24.3 -2V-8H30.3V-2Z M43.8 22.3Q40.6 22.3 38 20.8Q35.5 19.3 34.1 16.7Q32.6 14.1 32.6 10.9Q32.6 7.7 34.1 5.1Q35.6 2.6 38.1 1Q40.6 -0.5 43.7 -0.5Q46.1 -0.5 48 0.4Q49.2 1 50 1.8V-8.4H56V21.8H50.4V19.8Q49.4 20.9 47.9 21.5Q46 22.3 43.8 22.3ZM44.5 16.9Q46.1 16.9 47.4 16.2Q48.6 15.4 49.3 14Q50 12.7 50 10.9Q50 9.2 49.3 7.8Q48.6 6.4 47.4 5.7Q46.1 4.9 44.5 4.9Q42.8 4.9 41.5 5.7Q40.2 6.5 39.5 7.8Q38.8 9.2 38.8 10.9Q38.8 12.7 39.5 14Q40.2 15.4 41.5 16.2Q42.8 16.9 44.5 16.9Z M69.9 22.3Q66.6 22.3 64 20.8Q61.4 19.3 59.9 16.7Q58.3 14.1 58.3 10.9Q58.3 7.6 59.8 5.1Q61.4 2.5 64 1Q66.6 -0.5 69.9 -0.5Q72.4 -0.5 74.4 0.4Q76.5 1.2 78 2.7Q79.5 4.2 80.1 6.2L74.9 8.5Q74.4 6.8 73 5.9Q71.7 4.9 69.9 4.9Q68.4 4.9 67.1 5.7Q65.9 6.4 65.2 7.8Q64.5 9.2 64.5 10.9Q64.5 12.7 65.2 14Q65.9 15.4 67.1 16.2Q68.4 16.9 69.9 16.9Q71.7 16.9 73 16Q74.4 15 74.9 13.4L80.1 15.6Q79.5 17.6 78 19.1Q76.6 20.6 74.5 21.5Q72.4 22.3 69.9 22.3Z M93.3 22.3Q90 22.3 87.4 20.8Q84.7 19.4 83.1 16.8Q81.6 14.2 81.6 10.9Q81.6 7.6 83.1 5Q84.7 2.5 87.4 1Q90 -0.5 93.3 -0.5Q96.5 -0.5 99.2 1Q101.8 2.5 103.4 5Q105 7.6 105 10.9Q105 14.2 103.4 16.8Q101.8 19.4 99.2 20.8Q96.5 22.3 93.3 22.3ZM93.3 16.9Q94.9 16.9 96.1 16.2Q97.4 15.4 98.1 14Q98.8 12.7 98.8 10.9Q98.8 9.2 98.1 7.8Q97.4 6.5 96.1 5.7Q94.9 4.9 93.3 4.9Q91.6 4.9 90.4 5.7Q89.2 6.5 88.5 7.8Q87.8 9.2 87.8 10.9Q87.8 12.7 88.5 14Q89.2 15.4 90.4 16.2Q91.6 16.9 93.3 16.9Z M115.8 22.3Q112.2 22.3 109.6 20.6Q106.9 18.9 106 16L110.4 14Q111.2 15.7 112.6 16.7Q114.1 17.7 115.8 17.7Q117.1 17.7 117.8 17.2Q118.5 16.7 118.5 15.8Q118.5 15.3 118.2 14.9Q118 14.6 117.5 14.3Q117 14 116.3 13.8L112.6 12.8Q109.9 12 108.5 10.3Q107 8.6 107 6.3Q107 4.3 108.1 2.8Q109.1 1.2 111 0.4Q112.9 -0.5 115.3 -0.5Q118.5 -0.5 120.9 1Q123.4 2.5 124.4 5.2L119.9 7.3Q119.4 6 118.2 5.1Q116.9 4.3 115.3 4.3Q114.2 4.3 113.5 4.8Q112.8 5.3 112.8 6.1Q112.8 6.6 113.1 6.9Q113.3 7.3 113.9 7.6Q114.4 7.8 115.2 8.1L118.7 9.1Q121.4 9.9 122.8 11.5Q124.3 13.2 124.3 15.5Q124.3 17.6 123.2 19.1Q122.2 20.6 120.3 21.5Q118.4 22.3 115.8 22.3Z M126.7 21.8V0H132.3V2.6Q132.9 1.4 134 0.7Q135.8 -0.5 138.4 -0.5Q141.1 -0.5 143.2 0.9Q144.4 1.7 145 2.8Q145.9 1.6 147.1 0.8Q149.1 -0.5 151.8 -0.5Q154.2 -0.5 156 0.6Q157.8 1.6 158.8 3.5Q159.9 5.3 159.9 7.8V21.8H153.9V9.1Q153.9 7.8 153.4 6.9Q153 6 152.1 5.4Q151.3 4.9 150.1 4.9Q148.9 4.9 148.1 5.4Q147.2 6 146.7 6.9Q146.3 7.8 146.3 9.1V21.8H140.3V9.1Q140.3 7.8 139.8 6.9Q139.4 6 138.5 5.4Q137.7 4.9 136.5 4.9Q135.3 4.9 134.5 5.4Q133.6 6 133.1 6.9Q132.7 7.8 132.7 9.1V21.8Z M173.5 22.3Q170.2 22.3 167.6 20.8Q164.9 19.4 163.3 16.8Q161.8 14.2 161.8 10.9Q161.8 7.6 163.3 5Q164.9 2.5 167.6 1Q170.2 -0.5 173.5 -0.5Q176.7 -0.5 179.4 1Q182 2.5 183.6 5Q185.2 7.6 185.2 10.9Q185.2 14.2 183.6 16.8Q182 19.4 179.4 20.8Q176.7 22.3 173.5 22.3ZM173.5 16.9Q175.1 16.9 176.3 16.2Q177.6 15.4 178.3 14Q179 12.7 179 10.9Q179 9.2 178.3 7.8Q177.6 6.5 176.3 5.7Q175.1 4.9 173.5 4.9Q171.8 4.9 170.6 5.7Q169.4 6.5 168.7 7.8Q168 9.2 168 10.9Q168 12.7 168.7 14Q169.4 15.4 170.6 16.2Q171.8 16.9 173.5 16.9Z M196 22.3Q192.4 22.3 189.8 20.6Q187.1 18.9 186.2 16L190.6 14Q191.4 15.7 192.8 16.7Q194.3 17.7 196 17.7Q197.3 17.7 198 17.2Q198.7 16.7 198.7 15.8Q198.7 15.3 198.4 14.9Q198.2 14.6 197.7 14.3Q197.2 14 196.5 13.8L192.8 12.8Q190.1 12 188.7 10.3Q187.2 8.6 187.2 6.3Q187.2 4.3 188.3 2.8Q189.3 1.2 191.2 0.4Q193.1 -0.5 195.5 -0.5Q198.7 -0.5 201.1 1Q203.6 2.5 204.6 5.2L200.1 7.3Q199.6 6 198.4 5.1Q197.1 4.3 195.5 4.3Q194.4 4.3 193.7 4.8Q193 5.3 193 6.1Q193 6.6 193.3 6.9Q193.5 7.3 194.1 7.6Q194.6 7.8 195.4 8.1L198.9 9.1Q201.6 9.9 203 11.5Q204.5 13.2 204.5 15.5Q204.5 17.6 203.4 19.1Q202.4 20.6 200.5 21.5Q198.6 22.3 196 22.3Z';
  function Logo(props) {
    var variant = props.variant || 'full';
    var size = props.size || 32;
    var clip = React.useId().replace(/:/g, '');
    var mark = [
      h('defs', { key: 'd' }, h('clipPath', { id: clip, clipPathUnits: 'userSpaceOnUse' }, h('rect', { x: -4, y: 22, width: 52, height: 26 }))),
      h('g', { key: 'o1', transform: 'rotate(-24 22 22)' }, h('ellipse', { className: 'vc-logo__orbit', cx: 22, cy: 22, rx: 21, ry: 7.2 })),
      h('circle', { key: 'c', className: 'vc-logo__disc', cx: 22, cy: 22, r: 16.5 }),
      h('g', { key: 'o2', transform: 'rotate(-24 22 22)' }, h('ellipse', { className: 'vc-logo__orbit', cx: 22, cy: 22, rx: 21, ry: 7.2, clipPath: 'url(#' + clip + ')' })),
      h('path', { key: 'p', className: 'vc-logo__play', d: 'M18.6 15.2 L28.6 22 L18.6 28.8 Z' })
    ];
    var full = variant !== 'mark';
    return h('svg', {
      className: cx('vc-logo', props.className), role: 'img', 'aria-label': props.title || 'Vidcosmos',
      viewBox: full ? '0 0 262 44' : '0 0 44 44', height: size, width: full ? size * 262 / 44 : size
    }, mark, full ? h('path', { className: 'vc-logo__word', transform: 'translate(54 12)', d: WORDMARK }) : null);
  }

  /* PromptComposer */
  function PromptComposer(props) {
    var types = props.types || ['Explainer', 'Product ad', 'Story', 'Travel', 'Quote', 'Music visual'];
    var formats = props.formats || [{ value: '9:16', label: '9:16' }, { value: '16:9', label: '16:9' }, { value: '1:1', label: '1:1' }];
    var st = React.useState(props.defaultType || types[0]);
    var type = props.type !== undefined ? props.type : st[0];
    function pickType(t) { if (props.type === undefined) st[1](t); if (props.onTypeChange) props.onTypeChange(t); }
    return h('form', { className: cx('vc-composer', props.className), onSubmit: function (e) { e.preventDefault(); if (props.onGenerate) props.onGenerate(); } },
      h(TextField, { label: props.label || 'Describe your video', multiline: true, rows: props.rows || 3, placeholder: props.placeholder || 'A 30-second reel that…', defaultValue: props.defaultValue, value: props.value, onChange: props.onChange, id: props.id }),
      h('div', { className: 'vc-composer__types', role: 'group', 'aria-label': 'Video type' },
        types.map(function (t) { return h(Chip, { key: t, selected: t === type, onClick: function () { pickType(t); } }, t); })),
      h('div', { className: 'vc-composer__foot' },
        h(SegmentedControl, { label: 'Format', size: 'sm', options: formats, defaultValue: props.defaultFormat || formats[0].value, onChange: props.onFormatChange }),
        h(Button, { type: 'submit', icon: 'sparkles', loading: props.loading }, props.loading ? 'Generating…' : (props.submitLabel || 'Generate video'))));
  }

  /* VideoCard */
  var THEMES = ['midnight', 'paper', 'ocean', 'sunset'];
  function VideoCard(props) {
    var theme = THEMES.indexOf(props.theme) >= 0 ? props.theme : 'midnight';
    var aspect = props.aspect || '9:16';
    var ratio = aspect === '16:9' ? '16 / 9' : aspect === '1:1' ? '1 / 1' : '9 / 16';
    var tone = { ready: 'success', generating: 'brand', scheduled: 'warning', failed: 'danger', draft: 'neutral', published: 'success' }[props.status] || null;
    var thumb = h('div', { className: 'vc-video__thumb vc-vt--' + theme, style: { aspectRatio: ratio } },
      h('div', { className: 'vc-video__headline' }, props.headline || props.title),
      h('div', { className: 'vc-video__tiles', 'aria-hidden': 'true' }, h('span', null), h('span', null), h('span', null)),
      props.caption ? h('div', { className: 'vc-video__caption' }, props.caption.before ? props.caption.before + ' ' : '', h('mark', null, props.caption.word), props.caption.after ? ' ' + props.caption.after : '') : null,
      props.status === 'generating' && typeof props.progress === 'number' ? h('div', { className: 'vc-video__bar' }, h('div', { style: { width: props.progress + '%' } })) : null,
      props.duration ? h('span', { className: 'vc-video__dur' }, props.duration) : null);
    return h(props.href ? 'a' : 'div', { className: cx('vc-video', props.className), href: props.href },
      thumb,
      h('div', { className: 'vc-video__meta' },
        h('div', { className: 'vc-video__title' }, props.title),
        h('div', { className: 'vc-video__sub' },
          props.type ? h('span', null, props.type) : null,
          tone ? h(Badge, { tone: tone }, props.statusLabel || props.status) : null)));
  }

  /* SceneRow */
  function SceneRow(props) {
    var rest = omit(props, ['index', 'title', 'template', 'duration', 'selected', 'edited', 'failed', 'className']);
    return h('button', Object.assign({ type: 'button', className: cx('vc-scene', props.selected && 'is-selected', props.className), 'aria-current': props.selected ? 'true' : undefined }, rest),
      h('span', { className: 'vc-scene__num' }, String(props.index || 1).padStart(2, '0')),
      h('span', { className: 'vc-scene__thumb', 'aria-hidden': 'true' }),
      h('span', { className: 'vc-scene__text' },
        h('span', { className: 'vc-scene__title' }, props.title),
        h('span', { className: 'vc-scene__meta' }, [props.template, props.duration].filter(Boolean).join(' · '))),
      props.failed ? h(Badge, { tone: 'danger', icon: 'alert' }, 'No narration') : (props.edited ? h(Badge, { tone: 'warning', icon: 'pencil' }, 'Edited') : null));
  }

  /* ChatMessage */
  function ChatMessage(props) {
    var role = props.role || 'user';
    return h('div', { className: cx('vc-msg', 'vc-msg--' + role, props.className) }, props.children);
  }

  /* ProposalCard */
  function ProposalCard(props) {
    var status = props.status || 'proposed';
    var chips = [];
    if (props.scenes) chips.push(h(Badge, { key: 's', tone: 'brand' }, props.scenes));
    if (props.regeneratesVoice) chips.push(h(Badge, { key: 'v', tone: 'warning', icon: 'mic' }, 'New narration'));
    if (props.duration) chips.push(h(Badge, { key: 'd', tone: 'neutral', icon: 'clock' }, props.duration));
    return h('div', { className: cx('vc-proposal', 'is-' + status, props.className) },
      h('p', { className: 'vc-proposal__summary' }, props.summary),
      chips.length ? h('div', { className: 'vc-proposal__chips' }, chips) : null,
      (props.warnings || []).map(function (w, i) { return h('p', { key: i, className: 'vc-proposal__warn' }, h(Icon, { name: 'alert', size: 14 }), w); }),
      status === 'proposed' ? h('div', { className: 'vc-proposal__actions' },
        h(Button, { size: 'sm', onClick: props.onApply }, props.applyLabel || 'Apply'),
        h(Button, { size: 'sm', variant: 'secondary', onClick: props.onDismiss }, 'Dismiss')) :
        h('p', { className: 'vc-proposal__status' }, status === 'applied' ? h(Icon, { name: 'check', size: 16 }) : null,
          status === 'applied' ? ('Applied' + (props.version ? ' as version ' + props.version : '')) : status === 'stale' ? 'The video changed since this was suggested. Ask again.' : 'Dismissed'));
  }

  /* UsageMeter */
  function UsageMeter(props) {
    var used = props.used || 0, max = props.max || 1;
    var pct = Math.min(100, Math.round(used / max * 100));
    var near = pct >= 80;
    return h('div', { className: cx('vc-usage', near && 'is-near', props.className) },
      h('div', { className: 'vc-usage__label' }, props.label || 'Videos this month'),
      h('div', { className: 'vc-usage__row' },
        h('span', { className: 'vc-usage__num' }, used),
        h('span', { className: 'vc-usage__of' }, 'of ' + max + (props.resetsOn ? ' · resets ' + props.resetsOn : ''))),
      h('div', { className: 'vc-progress__track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': used, 'aria-label': props.label || 'Videos this month' },
        h('div', { className: 'vc-progress__fill', style: { width: pct + '%' } })));
  }

  var api = { Button: Button, Icon: Icon, TextField: TextField, SegmentedControl: SegmentedControl, Chip: Chip, Badge: Badge, ProgressBar: ProgressBar, Toast: Toast, Card: Card, Logo: Logo, PromptComposer: PromptComposer, VideoCard: VideoCard, SceneRow: SceneRow, ChatMessage: ChatMessage, ProposalCard: ProposalCard, UsageMeter: UsageMeter };
  window.Vidcosmos = Object.assign(window.Vidcosmos || {}, api);
})();
