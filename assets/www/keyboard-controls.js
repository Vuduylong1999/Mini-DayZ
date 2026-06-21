/* =====================================================================
   Mini DAYZ - Keyboard / Mouse control layer for PC
   ---------------------------------------------------------------------
   Injects synthetic touch (PointerEvent, pointerType "touch") into the
   Construct 2 runtime so keyboard keys drive the on-screen virtual
   joystick and action buttons. The game's own code is NOT modified.

   Toggle the on-screen key hints with  H .
   Edit KEYMAP below to rebind keys.
   ===================================================================== */
(function () {
	"use strict";

	// --- Object-type aliases for each control (extracted from data.js) ---
	var BTN_TYPE = {
		dpad_field:  "t670",
		attack:      "t498",
		reload:      "t515",
		interact:    "t505",
		inventory:   "t490",
		switch:      "t502",
		talk:        "t730",
		zoom:        "t795",
		perks:       "t595",
		builder:     "t561",
		flare:       "t636",
		car_forward: "t802",
		car_backward:"t803",
		car_left:    "t800",
		car_right:   "t801",
		car_leave:   "t804"
	};

	// --- Key bindings -> action name. Use lowercase event.key values. ---
	// Movement keys are handled separately (WASD + arrows).
	var KEYMAP = {
		" ":        "attack",     // Space
		"r":        "reload",
		"e":        "interact",
		"f":        "interact",
		"tab":      "inventory",
		"i":        "inventory",
		"q":        "switch",
		"t":        "talk",
		"shift":    "zoom",
		"b":        "builder",
		"g":        "flare",
		"p":        "perks",
		"escape":   "inventory"   // also opens/closes inventory-style menu
	};

	// In a car, WASD / Space drive these instead of moving the player.
	var CAR_KEYMAP = {
		"w": "car_forward",
		"s": "car_backward",
		"a": "car_left",
		"d": "car_right",
		" ": "car_leave",
		"g": "car_leave"
	};

	// Pointer IDs (each simulated finger needs a unique id).
	var PID_DPAD = 1;
	var pidCounter = 100;
	var actionPid = {}; // action -> pointerId currently held

	var runtime = null;
	var canvas = null;

	// ------------------------------------------------------------------
	function getRuntime() {
		if (runtime && runtime.running_layout) return runtime;
		if (window.cr_getC2Runtime) {
			var rt = window.cr_getC2Runtime();
			if (rt) { runtime = rt; canvas = rt.canvas || document.getElementById("c2canvas"); }
		}
		return runtime;
	}

	function getType(alias) {
		var rt = getRuntime();
		if (!rt) return null;
		var name = BTN_TYPE[alias];
		var t = rt.types ? rt.types[name] : null;
		if (!t && rt.types_by_index) {
			var idx = parseInt(name.slice(1), 10);
			t = rt.types_by_index[idx];
		}
		return t || null;
	}

	// Return a *visible* instance of the control, or null if none present.
	function getInstance(alias) {
		var t = getType(alias);
		if (!t || !t.instances || !t.instances.length) return null;
		for (var i = 0; i < t.instances.length; i++) {
			var inst = t.instances[i];
			if (inst && inst.visible !== false && inst.opacity !== 0) return inst;
		}
		return t.instances[0];
	}

	// Convert layer coords -> viewport client coords.
	// layerToCanvas returns positions in canvas-backing-store pixels; the
	// canvas may be displayed at a different CSS size (letterbox / scaling),
	// so scale by (displayed size / backing size).
	function canvasToClient(layer, lx, ly) {
		var bx = layer.layerToCanvas(lx, ly, true);
		var by = layer.layerToCanvas(lx, ly, false);
		var rect = canvas.getBoundingClientRect();
		var sx = canvas.width ? rect.width / canvas.width : 1;
		var sy = canvas.height ? rect.height / canvas.height : 1;
		return { x: rect.left + bx * sx, y: rect.top + by * sy };
	}

	function instClientXY(inst) {
		return canvasToClient(inst.layer, inst.x, inst.y);
	}

	function fireInClient(cx, cy, inst) {
		// client coords offset (cx,cy in layer units) from an instance center
		return canvasToClient(inst.layer, inst.x + cx, inst.y + cy);
	}

	function dispatchPointer(type, id, clientX, clientY) {
		if (!canvas) return;
		var ev;
		try {
			ev = new PointerEvent(type, {
				bubbles: true, cancelable: true, composed: true,
				pointerId: id, pointerType: "touch", isPrimary: id === PID_DPAD,
				clientX: clientX, clientY: clientY,
				width: 1, height: 1, pressure: type === "pointerup" ? 0 : 0.5,
				view: window
			});
		} catch (e) {
			// Fallback for engines without PointerEvent constructor
			ev = document.createEvent("Event");
			ev.initEvent(type, true, true);
			ev.pointerId = id; ev.pointerType = "touch";
			ev.clientX = clientX; ev.clientY = clientY;
			ev.pageX = clientX + window.scrollX; ev.pageY = clientY + window.scrollY;
			ev.pressure = 0.5; ev.width = 1; ev.height = 1;
		}
		canvas.dispatchEvent(ev);
	}

	// ===================== MOVEMENT (virtual joystick) =================
	var keysDown = {};
	var dpadActive = false;
	var inCar = false;          // set true while car controls are present

	function detectCar() {
		var f = getType("car_forward");
		inCar = !!(f && f.instances && f.instances.length);
		return inCar;
	}

	function movementVector() {
		var x = 0, y = 0;
		if (keysDown["w"] || keysDown["arrowup"])    y -= 1;
		if (keysDown["s"] || keysDown["arrowdown"])  y += 1;
		if (keysDown["a"] || keysDown["arrowleft"])  x -= 1;
		if (keysDown["d"] || keysDown["arrowright"]) x += 1;
		return { x: x, y: y };
	}

	function updateMovement() {
		if (inCar) return; // car handled via action presses
		var field = getInstance("dpad_field");
		var v = movementVector();
		var active = (v.x !== 0 || v.y !== 0) && !!field;

		if (active) {
			var len = Math.sqrt(v.x * v.x + v.y * v.y) || 1;
			var radius = (field.width ? field.width * 0.5 : 60) * 0.8;
			var ox = (v.x / len) * radius;
			var oy = (v.y / len) * radius;
			var center = instClientXY(field);
			var target = fireInClient(ox, oy, field);
			if (!dpadActive) {
				dispatchPointer("pointerdown", PID_DPAD, center.x, center.y);
				dpadActive = true;
			}
			dispatchPointer("pointermove", PID_DPAD, target.x, target.y);
		} else if (dpadActive) {
			var f2 = getInstance("dpad_field");
			var c = f2 ? instClientXY(f2) : { x: 0, y: 0 };
			dispatchPointer("pointerup", PID_DPAD, c.x, c.y);
			dpadActive = false;
		}
	}

	// ===================== ACTION BUTTONS ==============================
	function pressAction(action) {
		if (actionPid[action] != null) return; // already held
		var inst = getInstance(action);
		if (!inst) return;
		var p = instClientXY(inst);
		var id = ++pidCounter;
		actionPid[action] = id;
		dispatchPointer("pointerdown", id, p.x, p.y);
	}

	function releaseAction(action) {
		var id = actionPid[action];
		if (id == null) return;
		var inst = getInstance(action);
		var p = inst ? instClientXY(inst) : { x: 0, y: 0 };
		dispatchPointer("pointerup", id, p.x, p.y);
		actionPid[action] = null;
	}

	// ===================== KEY EVENT HANDLING ==========================
	function norm(e) {
		var k = e.key ? e.key.toLowerCase() : "";
		return k;
	}
	var MOVE_KEYS = { "w":1,"a":1,"s":1,"d":1,"arrowup":1,"arrowdown":1,"arrowleft":1,"arrowright":1 };

	window.addEventListener("keydown", function (e) {
		var k = norm(e);
		if (k === "h") { toggleHints(); e.preventDefault(); return; }
		if (e.repeat) { if (MOVE_KEYS[k] || KEYMAP[k]) e.preventDefault(); return; }

		detectCar();

		if (inCar && CAR_KEYMAP[k]) {
			pressAction(CAR_KEYMAP[k]);
			e.preventDefault();
			return;
		}

		if (MOVE_KEYS[k]) {
			keysDown[k] = true;
			e.preventDefault();
			return;
		}
		var action = KEYMAP[k];
		if (action) {
			pressAction(action);
			e.preventDefault();
		}
	}, true);

	window.addEventListener("keyup", function (e) {
		var k = norm(e);
		if (inCar && CAR_KEYMAP[k]) { releaseAction(CAR_KEYMAP[k]); e.preventDefault(); return; }
		if (MOVE_KEYS[k]) { keysDown[k] = false; e.preventDefault(); return; }
		var action = KEYMAP[k];
		if (action) { releaseAction(action); e.preventDefault(); }
	}, true);

	// Lose focus -> release everything (prevents stuck movement)
	window.addEventListener("blur", function () {
		keysDown = {};
		for (var a in actionPid) if (actionPid[a] != null) releaseAction(a);
	});

	// ===================== MOUSE -> attack / zoom ======================
	canvas_ready_then(function (cv) {
		cv.addEventListener("mousedown", function (e) {
			if (e.button === 0) pressAction("attack");
			else if (e.button === 2) pressAction("zoom");
		});
		window.addEventListener("mouseup", function (e) {
			if (e.button === 0) releaseAction("attack");
			else if (e.button === 2) releaseAction("zoom");
		});
		cv.addEventListener("contextmenu", function (e) { e.preventDefault(); });
	});

	function canvas_ready_then(cb) {
		var iv = setInterval(function () {
			var rt = getRuntime();
			if (rt && canvas) { clearInterval(iv); cb(canvas); }
		}, 200);
	}

	// ===================== MAIN LOOP ===================================
	var lastCarCheck = 0;
	function loop(ts) {
		if (getRuntime()) {
			// car state rarely changes; check ~4x/sec instead of every frame
			if (!ts || ts - lastCarCheck > 250) { detectCar(); lastCarCheck = ts || 0; }
			updateMovement();
		}
		requestAnimationFrame(loop);
	}
	requestAnimationFrame(loop);

	// ===================== HINT OVERLAY ================================
	var hintEl = null;
	function buildHints() {
		hintEl = document.createElement("div");
		hintEl.style.cssText = [
			"position:fixed", "top:10px", "left:10px", "z-index:99999",
			"background:rgba(0,0,0,0.78)", "color:#e8e8e8", "font:12px/1.5 monospace",
			"padding:10px 14px", "border:1px solid #555", "border-radius:6px",
			"pointer-events:none", "white-space:pre", "max-width:280px"
		].join(";");
		hintEl.textContent =
			"MINI DAYZ - PHIM TAT  (H de an/hien)\n" +
			"-----------------------------\n" +
			"W A S D / mui ten : Di chuyen\n" +
			"Space / Chuot trai: Tan cong\n" +
			"Shift / Chuot phai: Ngam (zoom)\n" +
			"R                 : Nap dan\n" +
			"E / F             : Tuong tac\n" +
			"Tab / I / Esc     : Tui do\n" +
			"Q                 : Doi vu khi\n" +
			"T                 : Noi chuyen\n" +
			"B                 : Xay dung\n" +
			"G                 : Phao sang\n" +
			"P                 : Perks\n" +
			"-----------------------------\n" +
			"Tren xe: W/S ga-lui, A/D lai,\n" +
			"         Space/G ra khoi xe";
		document.body.appendChild(hintEl);
	}
	var hintsVisible = true;
	function toggleHints() {
		if (!hintEl) buildHints();
		hintsVisible = !hintsVisible;
		hintEl.style.display = hintsVisible ? "block" : "none";
	}
	// Show hints shortly after load, then auto-hide after 12s.
	window.addEventListener("load", function () {
		setTimeout(function () {
			buildHints();
			setTimeout(function () { if (hintsVisible) toggleHints(); }, 12000);
		}, 1500);
	});

	console.log("[kb-controls] Mini DAYZ keyboard layer loaded. Press H for key hints.");
})();
