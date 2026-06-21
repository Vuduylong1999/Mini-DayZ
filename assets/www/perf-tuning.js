/* =====================================================================
   Mini DAYZ - Performance tuning
   ---------------------------------------------------------------------
   Reduces the INTERNAL render resolution (draw_width/draw_height) without
   changing the visible game area. The scene is rendered at a lower
   resolution and the engine upscales it to the window. This cuts fillrate
   / overdraw dramatically on weak/integrated GPUs (the main cause of lag
   in busy outdoor scenes). Works for both WebGL and Canvas2D renderers.

   Tune the scale with a URL param, e.g.:
       play-web.html?scale=0.5      (lower = faster + blurrier)
   Default is 0.65. Does NOT affect input/aim coordinates.
   ===================================================================== */
(function () {
	"use strict";

	var RENDER_SCALE = 0.65;
	var m = location.search.match(/[?&]scale=([0-9.]+)/);
	if (m) {
		var v = parseFloat(m[1]);
		if (v >= 0.2 && v <= 1.0) RENDER_SCALE = v;
	}

	var hooked = false;

	function applyScale(rt) {
		var s = RENDER_SCALE;
		rt.draw_width  = Math.max(64, Math.round(rt.draw_width  * s));
		rt.draw_height = Math.max(64, Math.round(rt.draw_height * s));
		rt.redraw = true;
	}

	function tryHook() {
		var rt = window.cr_getC2Runtime && window.cr_getC2Runtime();
		if (!rt || hooked || typeof rt.setSize !== "function") return false;

		var orig = rt.setSize;
		rt.setSize = function (w, h, force) {
			orig.call(this, w, h, force);   // engine computes draw_width = original size
			try { applyScale(this); } catch (e) {}
		};
		hooked = true;

		// Apply immediately to the current size.
		try {
			var w = rt.lastWindowWidth || window.innerWidth;
			var h = rt.lastWindowHeight || window.innerHeight;
			rt.setSize(w, h, true);
		} catch (e) {}

		console.log("[perf] render-scale hook installed (scale=" + RENDER_SCALE + ")");
		return true;
	}

	var iv = setInterval(function () {
		if (tryHook()) clearInterval(iv);
	}, 150);
})();
