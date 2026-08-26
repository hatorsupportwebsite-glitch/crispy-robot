/* =========================================================================
 * Keffaine — overlay renderer
 * One codebase drives every layer. KF_LAYER decides what is built:
 *   "hud"       — intro text, custom crosshair, gradient text, fake fov
 *   "watermark" — the clickable chip
 *   "menu"      — the cheat menu
 *   "all"       — browser preview, everything in one document
 * ========================================================================= */
(function () {
	"use strict";

	var LAYER = window.KF_LAYER || "all";
	var OPTS = window.KF_OPTS || {};
	var NATIVE = window.KfBridge || null;

	/* ================================================================ utils */
	function el(tag, cls, txt) {
		var n = document.createElement(tag);
		if (cls) n.className = cls;
		if (txt != null) n.textContent = txt;
		return n;
	}
	function clamp(v, a, b) {
		return v < a ? a : v > b ? b : v;
	}
	function rnd(a, b) {
		return a + Math.random() * (b - a);
	}
	function clone(o) {
		return JSON.parse(JSON.stringify(o));
	}
	function deepMerge(dst, src) {
		for (var k in src) {
			if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
			var v = src[k];
			if (v && typeof v === "object" && !(v instanceof Array) && dst[k] && typeof dst[k] === "object" && !(dst[k] instanceof Array)) {
				deepMerge(dst[k], v);
			} else {
				dst[k] = v;
			}
		}
		return dst;
	}

	var S = clone(DEFAULTS);
	if (OPTS.profile) deepMerge(S.profile, OPTS.profile);
	if (OPTS.state) deepMerge(S, OPTS.state);

	function get(path) {
		var p = path.split("."),
			n = S;
		for (var i = 0; i < p.length; i++) n = n[p[i]];
		return n;
	}
	function set(path, v) {
		var p = path.split("."),
			n = S;
		for (var i = 0; i < p.length - 1; i++) n = n[p[i]];
		n[p[p.length - 1]] = v;
	}

	/* ------------------------------------------------------------- colours */
	function parseColor(s) {
		s = String(s || "#FFFFFF").replace("#", "");
		if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
		if (s.length === 6) s += "FF";
		return {
			r: parseInt(s.substr(0, 2), 16) || 0,
			g: parseInt(s.substr(2, 2), 16) || 0,
			b: parseInt(s.substr(4, 2), 16) || 0,
			a: (parseInt(s.substr(6, 2), 16) || 0) / 255
		};
	}
	function hex2(n) {
		var s = Math.round(clamp(n, 0, 255)).toString(16).toUpperCase();
		return s.length < 2 ? "0" + s : s;
	}
	function toHex(c, withAlpha) {
		var h = "#" + hex2(c.r) + hex2(c.g) + hex2(c.b);
		if (withAlpha) h += hex2(c.a * 255);
		return h;
	}
	function css(s) {
		var c = parseColor(s);
		return "rgba(" + Math.round(c.r) + "," + Math.round(c.g) + "," + Math.round(c.b) + "," + c.a.toFixed(3) + ")";
	}
	function rgb2hsv(c) {
		var r = c.r / 255,
			g = c.g / 255,
			b = c.b / 255;
		var mx = Math.max(r, g, b),
			mn = Math.min(r, g, b),
			d = mx - mn;
		var h = 0;
		if (d) {
			if (mx === r) h = ((g - b) / d) % 6;
			else if (mx === g) h = (b - r) / d + 2;
			else h = (r - g) / d + 4;
			h *= 60;
			if (h < 0) h += 360;
		}
		return { h: h, s: mx ? d / mx : 0, v: mx, a: c.a };
	}
	function hsv2rgb(x) {
		var h = ((x.h % 360) + 360) % 360,
			s = clamp(x.s, 0, 1),
			v = clamp(x.v, 0, 1);
		var i = Math.floor(h / 60),
			f = h / 60 - i;
		var p = v * (1 - s),
			q = v * (1 - f * s),
			t = v * (1 - (1 - f) * s);
		var r, g, b;
		switch (i % 6) {
			case 0: r = v; g = t; b = p; break;
			case 1: r = q; g = v; b = p; break;
			case 2: r = p; g = v; b = t; break;
			case 3: r = p; g = q; b = v; break;
			case 4: r = t; g = p; b = v; break;
			default: r = v; g = p; b = q;
		}
		return { r: r * 255, g: g * 255, b: b * 255, a: x.a == null ? 1 : x.a };
	}

	/* -------------------------------------------------------------- bridge */
	var syncTimer = null;
	function sync() {
		if (!NATIVE || !NATIVE.push) return;
		if (syncTimer) return;
		syncTimer = setTimeout(function () {
			syncTimer = null;
			try {
				NATIVE.push(JSON.stringify(S));
			} catch (e) {}
		}, 40);
	}

	var listeners = [];
	function onState(fn) {
		listeners.push(fn);
	}
	function fire() {
		for (var i = 0; i < listeners.length; i++) {
			try {
				listeners[i]();
			} catch (e) {}
		}
	}
	/* native pushes remote state into consumer layers */
	window.kfState = function (json) {
		try {
			deepMerge(S, JSON.parse(json));
		} catch (e) {
			return;
		}
		fire();
	};

	function changed() {
		fire();
		sync();
	}

	/* rainbow driver: elements register a setter, one rAF loop feeds them */
	var rainbowFns = [];
	function rainbow(fn) {
		rainbowFns.push(fn);
	}
	(function loop() {
		var h = (Date.now() / 14) % 360;
		for (var i = 0; i < rainbowFns.length; i++) {
			try {
				rainbowFns[i](h);
			} catch (e) {}
		}
		requestAnimationFrame(loop);
	})();

	/* ============================================================== widgets */
	var menuEl = null;
	var curPop = null;

	function closePop() {
		if (curPop && curPop.parentNode) curPop.parentNode.removeChild(curPop);
		if (curPop && curPop.__owner) curPop.__owner.classList.remove("open");
		curPop = null;
	}

	/* layout-space offset of `node` inside the menu, scroll compensated */
	function offsetInMenu(node) {
		var x = 0,
			y = 0,
			n = node;
		while (n && n !== menuEl) {
			x += n.offsetLeft;
			y += n.offsetTop;
			n = n.offsetParent;
		}
		var a = node.parentNode;
		while (a && a !== menuEl) {
			if (a.scrollTop) y -= a.scrollTop;
			if (a.scrollLeft) x -= a.scrollLeft;
			a = a.parentNode;
		}
		return { x: x, y: y };
	}

	function placePop(pop, anchor, prefW) {
		menuEl.appendChild(pop);
		var o = offsetInMenu(anchor);
		var w = prefW || pop.offsetWidth;
		var h = pop.offsetHeight;
		var mw = menuEl.offsetWidth,
			mh = menuEl.offsetHeight;
		var x = clamp(o.x + anchor.offsetWidth - w, 6, mw - w - 6);
		var y = o.y + anchor.offsetHeight + 4;
		if (y + h > mh - 6) y = Math.max(6, o.y - h - 4);
		pop.style.left = x + "px";
		pop.style.top = y + "px";
	}

	/* --------------------------------------------------------- checkbox */
	function mkCheck(row, key) {
		var box = el("div", "cb");
		function paint() {
			var on = !!get(key);
			box.classList.toggle("on", on);
			row.classList.toggle("on", on);
		}
		function toggle(e) {
			e.stopPropagation();
			set(key, !get(key));
			paint();
			changed();
		}
		box.addEventListener("click", toggle);
		paint();
		return { node: box, paint: paint, toggle: toggle };
	}

	/* --------------------------------------------------------- colorbox */
	function mkColorbox(key, opt) {
		opt = opt || {};
		var box = el("div", "colorbox");
		var fill = el("i");
		box.appendChild(fill);

		function paint() {
			var rb = opt.rainbowKey ? !!get(opt.rainbowKey) : false;
			box.classList.toggle("rainbow", rb);
			if (!rb) fill.style.background = css(get(key));
		}
		box.addEventListener("click", function (e) {
			e.stopPropagation();
			var wasOpen = curPop && curPop.__owner === box;
			closePop();
			if (wasOpen) return;
			openPicker(box, key, opt, paint);
		});
		paint();
		return { node: box, paint: paint };
	}

	/* ------------------------------------------------------ color picker */
	function openPicker(anchor, key, opt, onPaint) {
		var pop = el("div", "pop cp");
		pop.__owner = anchor;
		anchor.classList.add("open");
		pop.addEventListener("click", function (e) {
			e.stopPropagation();
		});

		var cur = rgb2hsv(parseColor(get(key)));

		var sv = el("div", "cp__sv");
		var svHue = el("i");
		var svWhite = el("i");
		var svBlack = el("i");
		svWhite.style.background = "linear-gradient(90deg,#fff,rgba(255,255,255,0))";
		svBlack.style.background = "linear-gradient(0deg,#000,rgba(0,0,0,0))";
		var cursor = el("div", "cp__cursor");
		sv.appendChild(svHue);
		sv.appendChild(svWhite);
		sv.appendChild(svBlack);
		sv.appendChild(cursor);

		var hueBar = el("div", "cp__bar cp__bar--hue");
		var hueThumb = el("div", "cp__thumb");
		hueBar.appendChild(hueThumb);

		var alphaBar = el("div", "cp__bar cp__bar--alpha");
		var alphaFill = el("div", "cp__alphafill");
		var alphaThumb = el("div", "cp__thumb");
		alphaBar.appendChild(alphaFill);
		alphaBar.appendChild(alphaThumb);

		var foot = el("div", "cp__foot");
		var prev = el("div", "cp__prev");
		var hexIn = el("input", "cp__hex");
		hexIn.type = "text";
		hexIn.spellcheck = false;
		foot.appendChild(prev);
		foot.appendChild(hexIn);

		pop.appendChild(sv);
		pop.appendChild(hueBar);
		pop.appendChild(alphaBar);
		pop.appendChild(foot);

		var rbRow = null,
			rbBox = null;
		if (opt.rainbowKey) {
			rbRow = el("div", "cp__rb");
			rbBox = el("div", "cb");
			rbRow.appendChild(rbBox);
			rbRow.appendChild(el("span", null, "Rainbow"));
			rbRow.addEventListener("click", function () {
				set(opt.rainbowKey, !get(opt.rainbowKey));
				rbBox.classList.toggle("on", !!get(opt.rainbowKey));
				if (onPaint) onPaint();
				changed();
			});
			rbBox.classList.toggle("on", !!get(opt.rainbowKey));
			pop.appendChild(rbRow);
		}

		function paint(pushHex) {
			var rgb = hsv2rgb(cur);
			svHue.style.background = css(toHex(hsv2rgb({ h: cur.h, s: 1, v: 1, a: 1 })));
			cursor.style.left = cur.s * 100 + "%";
			cursor.style.top = (1 - cur.v) * 100 + "%";
			hueThumb.style.left = (cur.h / 360) * 100 + "%";
			alphaThumb.style.left = cur.a * 100 + "%";
			alphaFill.style.background =
				"linear-gradient(90deg, rgba(" +
				Math.round(rgb.r) + "," + Math.round(rgb.g) + "," + Math.round(rgb.b) + ",0), rgba(" +
				Math.round(rgb.r) + "," + Math.round(rgb.g) + "," + Math.round(rgb.b) + ",1))";
			prev.style.background = css(toHex(rgb, true));
			if (pushHex !== false) hexIn.value = toHex(rgb, cur.a < 0.999).replace("#", "");
			set(key, toHex(rgb, cur.a < 0.999));
			if (onPaint) onPaint();
		}

		function dragArea(node, fn) {
			function move(e) {
				var r = node.getBoundingClientRect();
				var px = clamp((e.clientX - r.left) / r.width, 0, 1);
				var py = clamp((e.clientY - r.top) / r.height, 0, 1);
				fn(px, py);
				paint();
				changed();
			}
			node.addEventListener("pointerdown", function (e) {
				e.stopPropagation();
				e.preventDefault();
				node.setPointerCapture(e.pointerId);
				move(e);
				var mv = function (ev) {
					move(ev);
				};
				var up = function () {
					node.removeEventListener("pointermove", mv);
					node.removeEventListener("pointerup", up);
					node.removeEventListener("pointercancel", up);
				};
				node.addEventListener("pointermove", mv);
				node.addEventListener("pointerup", up);
				node.addEventListener("pointercancel", up);
			});
		}

		dragArea(sv, function (px, py) {
			cur.s = px;
			cur.v = 1 - py;
		});
		dragArea(hueBar, function (px) {
			cur.h = px * 360;
		});
		dragArea(alphaBar, function (px) {
			cur.a = px;
		});

		hexIn.addEventListener("input", function () {
			var v = hexIn.value.replace(/[^0-9a-fA-F]/g, "");
			if (v.length === 6 || v.length === 8) {
				cur = rgb2hsv(parseColor("#" + v));
				paint(false);
				changed();
			}
		});

		placePop(pop, anchor, 176);
		paint();
		curPop = pop;
	}

	/* ---------------------------------------------------------- slider */
	function mkSlider(spec) {
		var row = el("div", "row row--slider");
		var head = el("div", "sl__head");
		var name = el("div", "row__name", spec.n);
		var val = el("div", "sl__val");
		head.appendChild(name);
		head.appendChild(val);

		var sl = el("div", "sl");
		var track = el("div", "sl__track");
		var fill = el("div", "sl__fill");
		var knob = el("div", "sl__knob");
		track.appendChild(fill);
		track.appendChild(knob);
		sl.appendChild(track);
		row.appendChild(head);
		row.appendChild(sl);

		function paint() {
			var v = clamp(Number(get(spec.k)), spec.min, spec.max);
			var p = ((v - spec.min) / (spec.max - spec.min)) * 100;
			fill.style.width = p + "%";
			knob.style.left = p + "%";
			val.textContent = Math.round(v) + (spec.unit || "");
		}
		function fromX(e) {
			var r = track.getBoundingClientRect();
			var p = clamp((e.clientX - r.left) / r.width, 0, 1);
			set(spec.k, Math.round(spec.min + p * (spec.max - spec.min)));
			paint();
			changed();
		}
		sl.addEventListener("pointerdown", function (e) {
			e.stopPropagation();
			e.preventDefault();
			sl.setPointerCapture(e.pointerId);
			fromX(e);
			var mv = function (ev) {
				fromX(ev);
			};
			var up = function () {
				sl.removeEventListener("pointermove", mv);
				sl.removeEventListener("pointerup", up);
				sl.removeEventListener("pointercancel", up);
			};
			sl.addEventListener("pointermove", mv);
			sl.addEventListener("pointerup", up);
			sl.addEventListener("pointercancel", up);
		});
		paint();
		return { node: row, paint: paint };
	}

	/* -------------------------------------------------------- dropdown */
	function mkDropdown(spec) {
		var dd = el("div", "dd");
		var lbl = el("div", "dd__val");
		var chev = el("div", "dd__chev", "\u25BC");
		dd.appendChild(lbl);
		dd.appendChild(chev);

		function text() {
			var v = get(spec.k);
			if (spec.multi) {
				if (!v || !v.length) return null;
				if (v.length === 1) return v[0];
				if (v.length === spec.opts.length) return "All";
				return v[0] + " +" + (v.length - 1);
			}
			return v ? v : null;
		}
		function paint() {
			var t = text();
			dd.classList.toggle("empty", !t);
			lbl.textContent = t || spec.empty;
		}

		function open() {
			var pop = el("div", "pop pop--list");
			pop.__owner = dd;
			dd.classList.add("open");
			pop.addEventListener("click", function (e) {
				e.stopPropagation();
			});

			spec.opts.forEach(function (o) {
				var item = el("div", "opt");
				var tick = el("div", "opt__tick");
				var nm = el("div", "opt__name", o);
				item.appendChild(tick);
				item.appendChild(nm);

				var cbx = null;
				if (spec.colors && spec.colors[o]) {
					cbx = mkColorbox(spec.colors[o]);
					item.appendChild(cbx.node);
				}

				function mark() {
					var v = get(spec.k);
					var on = spec.multi ? v && v.indexOf(o) >= 0 : v === o;
					item.classList.toggle("on", !!on);
				}
				item.addEventListener("click", function (e) {
					if (cbx && (e.target === cbx.node || cbx.node.contains(e.target))) return;
					if (spec.multi) {
						var arr = (get(spec.k) || []).slice();
						var i = arr.indexOf(o);
						if (i >= 0) arr.splice(i, 1);
						else arr.push(o);
						/* keep the spec order so the label is stable */
						arr.sort(function (a, b) {
							return spec.opts.indexOf(a) - spec.opts.indexOf(b);
						});
						set(spec.k, arr);
						mark();
					} else {
						/* clicking the active option clears it → placeholder */
						set(spec.k, get(spec.k) === o ? "" : o);
						Array.prototype.forEach.call(pop.querySelectorAll(".opt"), function (n) {
							n.classList.remove("on");
						});
						mark();
					}
					paint();
					changed();
				});
				mark();
				pop.appendChild(item);
			});

			placePop(pop, dd, 132);
			curPop = pop;
		}

		dd.addEventListener("click", function (e) {
			e.stopPropagation();
			var was = curPop && curPop.__owner === dd;
			closePop();
			if (!was) open();
		});
		paint();
		return { node: dd, paint: paint };
	}

	/* ============================================================ ESP view */
	var JOINTS = {
		head: [0.497, 0.105],
		headR: 0.052,
		neck: [0.497, 0.178],
		shoulderL: [0.415, 0.216],
		shoulderR: [0.583, 0.216],
		elbowL: [0.275, 0.335],
		elbowR: [0.723, 0.335],
		handL: [0.082, 0.452],
		handR: [0.916, 0.452],
		chest: [0.497, 0.262],
		pelvis: [0.497, 0.468],
		hipL: [0.443, 0.492],
		hipR: [0.553, 0.492],
		kneeL: [0.412, 0.672],
		kneeR: [0.585, 0.672],
		footL: [0.342, 0.952],
		footR: [0.657, 0.952]
	};
	var BONES = [
		["neck", "chest"],
		["chest", "pelvis"],
		["shoulderL", "shoulderR"],
		["shoulderL", "elbowL"],
		["elbowL", "handL"],
		["shoulderR", "elbowR"],
		["elbowR", "handR"],
		["pelvis", "hipL"],
		["pelvis", "hipR"],
		["hipL", "kneeL"],
		["kneeL", "footL"],
		["hipR", "kneeR"],
		["kneeR", "footR"]
	];
	var TEAM_NAME = { Enemy: "wruhe", Team: "an9el", Local: "you" };
	var TEAM_WEAPON = { Enemy: "AKR · 45", Team: "M4 · 60", Local: "USP · 12" };

	function buildEsp() {
		var wrap = el("div", "esp");
		var seg = el("div", "seg");
		var segItems = {};
		["Enemy", "Team", "Local"].forEach(function (t) {
			var i = el("div", "seg__i", t.toUpperCase());
			i.addEventListener("click", function () {
				S.esp.team = t;
				changed();
			});
			segItems[t] = i;
			seg.appendChild(i);
		});

		var stage = el("div", "esp__stage");
		var img = el("img", "esp__model");
		img.src = "img/esp_model.png";
		img.alt = "";
		var svgNS = "http://www.w3.org/2000/svg";
		var svg = document.createElementNS(svgNS, "svg");
		svg.setAttribute("class", "esp__svg");
		var nameLbl = el("div", "esp__lbl");
		var weaponLbl = el("div", "esp__lbl");
		var flagsBox = el("div", "esp__flags");
		var hint = el("div", "esp__hint", "LIVE PREVIEW");

		stage.appendChild(img);
		stage.appendChild(svg);
		stage.appendChild(nameLbl);
		stage.appendChild(weaponLbl);
		stage.appendChild(flagsBox);
		stage.appendChild(hint);
		wrap.appendChild(seg);
		wrap.appendChild(stage);

		function ns(tag, attrs) {
			var n = document.createElementNS(svgNS, tag);
			for (var k in attrs) n.setAttribute(k, attrs[k]);
			return n;
		}

		function render() {
			for (var t in segItems) segItems[t].classList.toggle("on", S.esp.team === t);

			while (svg.firstChild) svg.removeChild(svg.firstChild);
			flagsBox.textContent = "";
			nameLbl.style.display = "none";
			weaponLbl.style.display = "none";

			var sw = stage.offsetWidth,
				sh = stage.offsetHeight;
			if (!sw || !sh) return;
			svg.setAttribute("viewBox", "0 0 " + sw + " " + sh);

			var mw = img.offsetWidth,
				mh = img.offsetHeight;
			if (!mw || !mh) {
				mh = sh * 0.78;
				mw = mh * (557 / 900);
			}
			var mx = (sw - mw) / 2,
				my = (sh - mh) / 2;
			var on = !!S.esp.enable;
			img.style.opacity = on ? 1 : 0.45;
			if (!on) return;

			function P(k) {
				var j = JOINTS[k];
				return [mx + j[0] * mw, my + j[1] * mh];
			}

			/* box ------------------------------------------------------- */
			var bx = mx + mw * 0.015,
				by = my + mh * 0.01,
				bw = mw * 0.97,
				bh = mh * 0.985;
			if (S.esp.box) {
				var c = css(S.espc.box);
				svg.appendChild(ns("rect", { x: bx + 0.5, y: by + 0.5, width: bw, height: bh, fill: "none", stroke: "rgba(0,0,0,.75)", "stroke-width": 3 }));
				svg.appendChild(ns("rect", { x: bx + 0.5, y: by + 0.5, width: bw, height: bh, fill: "none", stroke: c, "stroke-width": 1 }));
				/* corner accents */
				var cl = Math.max(6, bw * 0.13);
				[
					[bx, by, cl, 0, 0, cl],
					[bx + bw, by, -cl, 0, 0, cl],
					[bx, by + bh, cl, 0, 0, -cl],
					[bx + bw, by + bh, -cl, 0, 0, -cl]
				].forEach(function (k) {
					svg.appendChild(ns("path", {
						d: "M" + (k[0] + k[2]) + " " + (k[1] + k[3]) + " L" + k[0] + " " + k[1] + " L" + (k[0] + k[4]) + " " + (k[1] + k[5]),
						fill: "none",
						stroke: c,
						"stroke-width": 2
					}));
				});
			}

			/* skeleton -------------------------------------------------- */
			if (S.esp.skeleton) {
				var sc = css(S.espc.skeleton);
				var g = ns("g", {});
				BONES.forEach(function (b) {
					var a = P(b[0]),
						z = P(b[1]);
					g.appendChild(ns("line", { x1: a[0], y1: a[1], x2: z[0], y2: z[1], stroke: "rgba(0,0,0,.7)", "stroke-width": 3, "stroke-linecap": "round" }));
				});
				BONES.forEach(function (b) {
					var a = P(b[0]),
						z = P(b[1]);
					g.appendChild(ns("line", { x1: a[0], y1: a[1], x2: z[0], y2: z[1], stroke: sc, "stroke-width": 1.4, "stroke-linecap": "round" }));
				});
				var hp = P("head");
				g.appendChild(ns("circle", { cx: hp[0], cy: hp[1], r: JOINTS.headR * mh, fill: "none", stroke: "rgba(0,0,0,.7)", "stroke-width": 3 }));
				g.appendChild(ns("circle", { cx: hp[0], cy: hp[1], r: JOINTS.headR * mh, fill: "none", stroke: sc, "stroke-width": 1.4 }));
				svg.appendChild(g);
			}

			/* health bar ------------------------------------------------ */
			if (S.esp.health) {
				var hc = css(S.espc.health);
				var hbx = bx - 6,
					hbw = 3,
					hp2 = 0.72;
				svg.appendChild(ns("rect", { x: hbx - 1, y: by - 1, width: hbw + 2, height: bh + 2, fill: "rgba(0,0,0,.65)", rx: 2 }));
				svg.appendChild(ns("rect", { x: hbx, y: by + bh * (1 - hp2), width: hbw, height: bh * hp2, fill: hc, rx: 1.5 }));
			}

			/* nickname / weapon ---------------------------------------- */
			if (S.esp.name) {
				nameLbl.style.display = "";
				nameLbl.textContent = TEAM_NAME[S.esp.team] || "player";
				nameLbl.style.color = css(S.espc.name);
				nameLbl.style.left = bx + bw / 2 + "px";
				nameLbl.style.top = Math.max(1, by - 11) + "px";
			}
			if (S.esp.weapon) {
				weaponLbl.style.display = "";
				weaponLbl.textContent = TEAM_WEAPON[S.esp.team] || "AKR";
				weaponLbl.style.color = css(S.espc.weapon);
				weaponLbl.style.left = bx + bw / 2 + "px";
				weaponLbl.style.top = Math.min(sh - 11, by + bh + 2) + "px";
			}

			/* flags ----------------------------------------------------- */
			var fl = S.esp.flags || [];
			if (fl.length) {
				flagsBox.style.left = Math.min(sw - 34, bx + bw + 5) + "px";
				flagsBox.style.top = by + 2 + "px";
				fl.forEach(function (f) {
					var k = "flag" + f;
					var d = el("div", null, f);
					d.style.color = css(S.espc[k] || "#FFFFFF");
					flagsBox.appendChild(d);
				});
			}

			/* sounds ---------------------------------------------------- */
			if (S.esp.sounds) {
				var p = P("footL");
				var scol = css(S.espc.sounds);
				[10, 17, 24].forEach(function (r, i) {
					svg.appendChild(ns("circle", {
						cx: p[0], cy: p[1], r: r, fill: "none", stroke: scol,
						"stroke-width": 1, opacity: 0.75 - i * 0.22
					}));
				});
			}

			/* offscreen arrow ------------------------------------------ */
			if (S.esp.arrow) {
				var ac = css(S.espc.arrow);
				var cxp = sw - 13,
					cyp = sh / 2;
				svg.appendChild(ns("path", {
					d: "M" + (cxp + 7) + " " + cyp + " L" + (cxp - 5) + " " + (cyp - 7) + " L" + (cxp - 5) + " " + (cyp + 7) + " Z",
					fill: ac,
					stroke: "rgba(0,0,0,.6)",
					"stroke-width": 1
				}));
			}
		}

		img.addEventListener("load", render);
		onState(render);
		setTimeout(render, 0);
		return wrap;
	}

	/* =============================================================== menu */
	function buildRow(spec) {
		if (spec.t === "slider") return mkSlider(spec).node;

		var row = el("div", "row");

		if (spec.t === "soon") {
			var s = el("div", "soon");
			s.appendChild(el("span", null, "\u2022"));
			s.appendChild(el("span", null, spec.n));
			row.appendChild(s);
			return row;
		}

		if (spec.t === "check") {
			var cb = mkCheck(row, spec.k);
			var nm = el("div", "row__name", spec.n);
			nm.addEventListener("click", cb.toggle);
			row.appendChild(cb.node);
			row.appendChild(nm);
			if (spec.color) {
				row.appendChild(mkColorbox(spec.color, { rainbowKey: spec.rainbow }).node);
			}
			return row;
		}

		if (spec.t === "color") {
			row.appendChild(el("div", "row__name", spec.n));
			row.appendChild(mkColorbox(spec.k, {}).node);
			return row;
		}

		if (spec.t === "select" || spec.t === "selectcolor") {
			row.appendChild(el("div", "row__name", spec.n));
			row.appendChild(mkDropdown(spec).node);
			return row;
		}

		if (spec.t === "text") {
			row.appendChild(el("div", "row__name", spec.n));
			var inp = el("input", "ti");
			inp.type = "text";
			inp.spellcheck = false;
			inp.value = get(spec.k);
			if (spec.max) inp.maxLength = spec.max;
			inp.addEventListener("input", function () {
				set(spec.k, inp.value);
				changed();
			});
			inp.addEventListener("pointerdown", function (e) {
				e.stopPropagation();
			});
			row.appendChild(inp);
			return row;
		}

		return row;
	}

	function buildTab(key) {
		var tab = SPEC[key];
		var cols = el("div", "cols");
		tab.cols.forEach(function (colSpec) {
			var col = el("div", "col");
			colSpec.forEach(function (b) {
				if (b.esp) {
					col.appendChild(buildEsp());
					return;
				}
				var block = el("div", "block");
				var title = el("div", "block__title");
				var titleTxt = el("span", null, b.block);
				title.appendChild(titleTxt);
				block.appendChild(title);
				if (key === "player" && b.block === "Enemy") {
					onState(function () {
						titleTxt.textContent = S.esp.team;
					});
				}
				b.rows.forEach(function (r) {
					block.appendChild(buildRow(r));
				});
				col.appendChild(block);
			});
			cols.appendChild(col);
		});
		return cols;
	}

	function buildMenu() {
		var menu = el("div", "menu");
		menuEl = menu;

		/* ---------------- sidebar ---------------- */
		var side = el("div", "side");

		var brand = el("div", "brand");
		var logo = el("img", "brand__logo");
		logo.src = "img/logo_rounded.png";
		logo.alt = "";
		var btxt = el("div", "brand__txt");
		var bname = el("div", "brand__name grad", "Keffaine");
		var bgame = el("div", "brand__game", "Standoff 2");
		btxt.appendChild(bname);
		btxt.appendChild(bgame);
		brand.appendChild(logo);
		brand.appendChild(btxt);

		var nav = el("div", "nav");
		var navItems = [];

		function selectTab(t) {
			S.ui.tab = t;
			closePop();
			renderBody();
			paintNav();
		}

		NAV.forEach(function (entry) {
			if (entry.type === "label") {
				nav.appendChild(el("div", "nav__label", entry.n));
				return;
			}
			if (entry.type === "item") {
				var it = el("div", "nav__item", entry.n);
				it.addEventListener("click", function () {
					selectTab(entry.tab);
				});
				nav.appendChild(it);
				navItems.push({ node: it, tab: entry.tab });
				return;
			}
			/* expandable group: tapping it only opens the children */
			var head = el("div", "nav__item");
			head.appendChild(el("span", null, entry.n));
			var chev = el("span", "chev", "\u25B6");
			head.appendChild(chev);
			var group = el("div", "nav__group");
			entry.children.forEach(function (c) {
				var sub = el("div", "nav__item nav__sub", c.n);
				sub.addEventListener("click", function () {
					selectTab(c.tab);
				});
				group.appendChild(sub);
				navItems.push({ node: sub, tab: c.tab });
			});
			head.addEventListener("click", function () {
				S.ui.visualsOpen = !S.ui.visualsOpen;
				paintNav();
			});
			nav.appendChild(head);
			nav.appendChild(group);
			navItems.push({ node: head, group: group, isGroup: true, tabs: entry.children.map(function (c) { return c.tab; }) });
		});

		function paintNav() {
			navItems.forEach(function (n) {
				if (n.isGroup) {
					n.node.classList.toggle("open", !!S.ui.visualsOpen);
					n.group.classList.toggle("open", !!S.ui.visualsOpen);
					n.node.classList.toggle("on", n.tabs.indexOf(S.ui.tab) >= 0 && !S.ui.visualsOpen);
				} else {
					n.node.classList.toggle("on", n.tab === S.ui.tab);
				}
			});
		}

		/* user box */
		var ubox = el("div", "userbox");
		var uava = el("img", "userbox__ava");
		uava.src = "img/avatar_" + (S.profile.avatar || 1) + ".png";
		uava.alt = "";
		var utxt = el("div", "userbox__txt");
		var unick = el("div", "userbox__nick", S.profile.user);
		var udays = el("div", "userbox__days", S.profile.days + " Days left");
		utxt.appendChild(unick);
		utxt.appendChild(udays);
		ubox.appendChild(uava);
		ubox.appendChild(utxt);
		ubox.appendChild(el("div", "userbox__chev", "\u203A"));

		side.appendChild(brand);
		side.appendChild(nav);
		side.appendChild(ubox);

		/* ---------------- body ---------------- */
		var body = el("div", "body");
		var head2 = el("div", "body__head");
		var crumb = el("div", "body__crumb");
		var title = el("div", "body__title");
		var dots = el("div", "body__dots");
		dots.appendChild(el("i"));
		dots.appendChild(el("i"));
		dots.appendChild(el("i"));
		var closeBtn = el("div", "body__close", "\u2715");
		closeBtn.addEventListener("click", function (e) {
			e.stopPropagation();
			closeMenu();
		});
		head2.appendChild(crumb);
		head2.appendChild(title);
		head2.appendChild(el("div", "body__spacer"));
		head2.appendChild(dots);
		head2.appendChild(closeBtn);

		var holder = el("div", "body");
		holder.style.flex = "1 1 auto";
		holder.style.minHeight = "0";

		function renderBody() {
			var t = SPEC[S.ui.tab] ? S.ui.tab : "aimbot";
			crumb.textContent = SPEC[t].crumb;
			title.textContent = SPEC[t].title;
			while (holder.firstChild) holder.removeChild(holder.firstChild);
			holder.appendChild(buildTab(t));
			fire();
		}
		menu.__renderBody = renderBody;

		body.appendChild(head2);
		body.appendChild(holder);

		menu.appendChild(side);
		menu.appendChild(body);

		/* drag by header ------------------------------------------------- */
		enableDrag(head2, menu);

		/* tapping empty menu space closes popups */
		menu.addEventListener("click", function () {
			closePop();
		});

		renderBody();
		paintNav();
		return menu;
	}

	/* drag: native window move when embedded, CSS move in the browser */
	function enableDrag(handle, target) {
		var sx = 0,
			sy = 0,
			ox = 0,
			oy = 0,
			moved = false;
		handle.addEventListener("pointerdown", function (e) {
			if (e.target.classList && e.target.classList.contains("body__close")) return;
			sx = e.clientX;
			sy = e.clientY;
			moved = false;
			ox = parseFloat(target.style.left || 0) || 0;
			oy = parseFloat(target.style.top || 0) || 0;
			handle.setPointerCapture(e.pointerId);

			function mv(ev) {
				var dx = ev.clientX - sx,
					dy = ev.clientY - sy;
				if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
				if (NATIVE && NATIVE.drag) {
					NATIVE.drag(Math.round(dx), Math.round(dy));
					sx = ev.clientX;
					sy = ev.clientY;
				} else {
					target.style.left = ox + dx + "px";
					target.style.top = oy + dy + "px";
				}
			}
			function up() {
				handle.removeEventListener("pointermove", mv);
				handle.removeEventListener("pointerup", up);
				handle.removeEventListener("pointercancel", up);
			}
			handle.addEventListener("pointermove", mv);
			handle.addEventListener("pointerup", up);
			handle.addEventListener("pointercancel", up);
		});
		return function () {
			return moved;
		};
	}

	/* ========================================================== watermark */
	function buildWatermark() {
		var wm = el("div", "wm enter");

		var logo = el("img", "wm__logo");
		logo.src = "img/logo_rounded.png";
		logo.alt = "";
		var name = el("div", "wm__name grad", "Keffaine");

		function sep() {
			return el("div", "wm__sep");
		}
		function stat(label) {
			var d = el("div", "wm__stat");
			var l = el("span", null, label + " ");
			var b = el("b");
			d.appendChild(l);
			d.appendChild(b);
			return { node: d, val: b };
		}

		var fps = stat("FPS");
		var ping = stat("PING");
		var hwid = stat("HWID");
		var user = el("div", "wm__user");
		var ava = el("img", "wm__ava");
		ava.alt = "";

		wm.appendChild(logo);
		wm.appendChild(name);
		wm.appendChild(sep());
		wm.appendChild(fps.node);
		wm.appendChild(sep());
		wm.appendChild(ping.node);
		wm.appendChild(sep());
		wm.appendChild(hwid.node);
		wm.appendChild(sep());
		wm.appendChild(user);
		wm.appendChild(ava);

		var f = (S.profile.fpsMin + S.profile.fpsMax) / 2;
		var p = (S.profile.pingMin + S.profile.pingMax) / 2;

		function paint() {
			hwid.val.textContent = String(S.profile.hwid).substr(0, 9);
			user.textContent = S.profile.user;
			ava.src = "img/avatar_" + (S.profile.avatar || 1) + ".png";
		}
		function tick() {
			f += rnd(-4, 4);
			f = clamp(f, S.profile.fpsMin, S.profile.fpsMax);
			p += rnd(-3, 3);
			p = clamp(p, S.profile.pingMin, S.profile.pingMax);
			fps.val.textContent = Math.round(f);
			ping.val.textContent = Math.round(p);
		}
		onState(paint);
		paint();
		tick();
		setInterval(tick, 700);

		wm.addEventListener("click", function () {
			openMenu();
		});
		enableDrag(wm, wm);
		return wm;
	}

	/* ================================================================ HUD */
	function buildHud() {
		var hud = el("div", "hud");

		/* intro ------------------------------------------------------- */
		var intro = el("div", "intro");
		var word = el("div", "intro__word grad", "Keffaine");
		var rule = el("div", "intro__rule");
		var sub = el("div", "intro__sub", "STANDOFF 2");
		intro.appendChild(word);
		intro.appendChild(rule);
		intro.appendChild(sub);

		/* fake fov ---------------------------------------------------- */
		var fov = el("div", "fov");

		/* crosshair --------------------------------------------------- */
		var xh = el("div", "xhair");
		var bars = { top: el("i"), bottom: el("i"), left: el("i"), right: el("i"), dot: el("i") };
		for (var k in bars) xh.appendChild(bars[k]);

		/* gradient text ----------------------------------------------- */
		var gt = el("div", "gtext grad-anim");

		hud.appendChild(fov);
		hud.appendChild(xh);
		hud.appendChild(gt);
		hud.appendChild(intro);

		function render() {
			var w = S.world;

			/* fake fov */
			fov.style.display = w.fov ? "" : "none";
			if (w.fov) {
				var col = w.fovRainbow ? null : css(w.fovColor);
				fov.style.width = w.fovSize + "px";
				fov.style.height = w.fovSize + "px";
				fov.style.borderWidth = w.fovThick + "px";
				fov.style.background = css(w.fovFill);
				if (col) {
					fov.style.borderColor = col;
					fov.style.boxShadow = w.fovGlow ? "0 0 " + w.fovGlow + "px " + col + ", inset 0 0 " + w.fovGlow + "px " + col : "none";
				}
			}

			/* crosshair */
			xh.style.display = w.xhair ? "" : "none";
			if (w.xhair) {
				var t = w.xhairThick,
					l = w.xhairSize,
					g = w.xhairGap;
				var outline = w.xhairOutline ? "0 0 0 1px rgba(0,0,0,.85)" : "none";
				function put(n, x, y, ww, hh) {
					n.style.left = x + "px";
					n.style.top = y + "px";
					n.style.width = ww + "px";
					n.style.height = hh + "px";
					n.style.boxShadow = outline;
				}
				put(bars.top, -t / 2, -(g + l), t, l);
				put(bars.bottom, -t / 2, g, t, l);
				put(bars.left, -(g + l), -t / 2, l, t);
				put(bars.right, g, -t / 2, l, t);
				put(bars.dot, -t / 2, -t / 2, t, t);
				bars.dot.style.display = w.xhairDot ? "" : "none";
				if (!w.xhairRainbow) {
					var c2 = css(w.xhairColor);
					for (var kk in bars) bars[kk].style.background = c2;
				}
			}

			/* gradient text */
			gt.style.display = w.gtext ? "" : "none";
			if (w.gtext) {
				gt.textContent = w.gtextValue || "";
				gt.style.fontSize = w.gtextSize + "px";
				gt.style.marginTop = w.gtextGap + "px";
				var spd = clamp(w.gtextSpeed, 1, 100);
				gt.style.animationDuration = (9 - (spd / 100) * 8).toFixed(2) + "s";
			}
		}

		rainbow(function (h) {
			var w = S.world;
			if (w.xhair && w.xhairRainbow) {
				var c = css(toHex(hsv2rgb({ h: h, s: 0.85, v: 1, a: 1 })));
				for (var kk in bars) bars[kk].style.background = c;
			}
			if (w.fov && w.fovRainbow) {
				var c2 = css(toHex(hsv2rgb({ h: h + 40, s: 0.85, v: 1, a: 1 })));
				fov.style.borderColor = c2;
				fov.style.boxShadow = w.fovGlow ? "0 0 " + w.fovGlow + "px " + c2 + ", inset 0 0 " + w.fovGlow + "px " + c2 : "none";
			}
		});

		onState(render);
		render();

		/* intro playback */
		hud.__intro = function () {
			intro.classList.remove("play");
			/* keep the live hud out of the way while the splash plays */
			hud.classList.add("hud--intro");
			clearTimeout(hud.__introT);
			hud.__introT = setTimeout(function () {
				hud.classList.remove("hud--intro");
			}, 2250);
			/* force reflow so the animation restarts */
			void intro.offsetWidth;
			intro.classList.add("play");
		};
		window.kfPlayIntro = hud.__intro;

		if (OPTS.introHold) {
			hud.classList.add("hud--intro");
			intro.style.opacity = 1;
			rule.style.width = "78%";
			sub.style.opacity = 1;
		} else if (OPTS.intro !== false) {
			setTimeout(hud.__intro, OPTS.introDelay == null ? 500 : OPTS.introDelay);
		}
		return hud;
	}

	/* ======================================================== menu toggle */
	var previewMenu = null;
	var previewRoot = null;

	function openMenu() {
		if (NATIVE && NATIVE.openMenu) {
			NATIVE.openMenu();
			return;
		}
		if (previewMenu) return;
		previewMenu = buildMenu();
		previewMenu.classList.add("enter");
		previewMenu.style.left = Math.max(10, (window.innerWidth - 780) / 2) + "px";
		previewMenu.style.top = Math.max(10, (window.innerHeight - 510) / 2) + "px";
		previewRoot.appendChild(previewMenu);
	}
	function closeMenu() {
		if (NATIVE && NATIVE.closeMenu) {
			NATIVE.closeMenu();
			return;
		}
		if (!previewMenu) return;
		var m = previewMenu;
		previewMenu = null;
		m.classList.remove("enter");
		m.classList.add("leave");
		setTimeout(function () {
			if (m.parentNode) m.parentNode.removeChild(m);
		}, 220);
	}
	window.kfCloseMenu = closeMenu;

	/* ============================================================== boot */
	function boot() {
		var root = el("div", "kf-root");
		document.body.appendChild(root);
		previewRoot = root;

		if (LAYER === "hud") {
			root.appendChild(buildHud());
		} else if (LAYER === "watermark") {
			var wl = el("div", "wm-layer");
			wl.appendChild(buildWatermark());
			root.appendChild(wl);
		} else if (LAYER === "menu") {
			var m = buildMenu();
			m.classList.add("enter");
			root.appendChild(m);
		} else {
			/* browser preview: everything at once */
			root.appendChild(buildHud());
			var wl2 = el("div", "wm-layer");
			var wm = buildWatermark();
			wm.style.left = (OPTS.wmX == null ? 18 : OPTS.wmX) + "px";
			wm.style.top = (OPTS.wmY == null ? 16 : OPTS.wmY) + "px";
			wl2.appendChild(wm);
			root.appendChild(wl2);
			if (OPTS.openMenu) openMenu();
		}

		document.addEventListener("click", function (e) {
			if (curPop && !curPop.contains(e.target)) closePop();
		});
		fire();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", boot);
	} else {
		boot();
	}
})();
