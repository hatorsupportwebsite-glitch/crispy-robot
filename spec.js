/* =========================================================================
 * Keffaine — state + declarative menu spec
 * Everything the menu renders is described here, so the renderer stays small.
 * ========================================================================= */

var HITBOXES = ["Head", "Neck", "Stomach", "Torso", "Arms", "Legs"];

/* ----------------------------------------------------------------- state */
var DEFAULTS = {
	/* profile / watermark ------------------------------------------------ */
	profile: {
		user: "wruhe",
		days: 15,
		hwid: "7F2A-91C4-D08B",
		avatar: 1, // 1 = random junk avatar, 2 = logo avatar
		fpsMin: 118,
		fpsMax: 144,
		pingMin: 12,
		pingMax: 38
	},

	/* aimbot ------------------------------------------------------------- */
	aim: {
		enable: true,
		silent: true,
		autofire: false,
		penetration: true,
		fov: 62,
		target: "Damage",
		hitboxes: ["Head", "Neck"],
		multipoint: ["Head"],
		hitchance: 74,
		mindamage: 28,
		quickstop: true,
		quickscope: false,
		history: "High",
		spread: "Seed",
		hitboxOverride: "",
		textureOverride: ["glass"],
		delayshot: false,
		wallshot: true,
		bulletTp: false,
		rapidfire: false,
		instareload: true,
		spam: false,
		backcam: false,
		autopistol: true,
		visualize: true,
		randomize: "Mid"
	},

	/* visuals → player --------------------------------------------------- */
	esp: {
		team: "Enemy", // Enemy | Team | Local
		enable: true,
		arrow: true,
		sounds: false,
		name: true,
		box: true,
		skeleton: true,
		weapon: true,
		health: true,
		flags: ["Reload", "Bomb"]
	},
	espc: {
		arrow: "#FFC46B",
		sounds: "#C9A2FF",
		name: "#FFFFFF",
		box: "#A9CDFF",
		skeleton: "#98A3B3",
		weapon: "#8FA6C8",
		health: "#7FE3A1",
		flagDevice: "#A9CDFF",
		flagReload: "#FFC46B",
		flagBomb: "#FF6B6B",
		flagDefuse: "#7FE3A1"
	},

	/* visuals → world ---------------------------------------------------- */
	world: {
		grenade: false,

		gtext: true,
		gtextValue: "Keffaine",
		gtextSize: 15,
		gtextSpeed: 42,
		gtextGap: 26,

		xhair: true,
		xhairColor: "#A9CDFF",
		xhairRainbow: false,
		xhairSize: 11,
		xhairGap: 5,
		xhairThick: 2,
		xhairDot: true,
		xhairOutline: true,

		fov: true,
		fovColor: "#A9CDFF",
		fovRainbow: false,
		fovSize: 148,
		fovThick: 2,
		fovGlow: 14,
		fovFill: "#A9CDFF14"
	},

	/* misc --------------------------------------------------------------- */
	misc: {
		bunnyhop: true,
		airstrafe: true,
		jumpbug: false,
		quickstop: false,
		strafeassist: true,
		movebefore: false,
		noclip: false,
		fly: false,
		fastladder: true,
		edgejump: false,
		fakelag: false,

		godmode: false,
		invisible: false,
		teleport: false,
		stoptime: false,
		instaswitch: true,
		antiafk: true,
		unlockchat: true,
		hitsound: true,
		autogrenade: false,
		autoaccept: true,
		logevents: ["Hit", "Spam"]
	},

	/* runtime ------------------------------------------------------------ */
	ui: {
		tab: "aimbot",
		visualsOpen: true
	}
};

/* --------------------------------------------------------------- spec
 * row types:
 *   check      — checkbox (+ optional `color` key → colorbox on the right)
 *   slider     — value slider, no checkbox
 *   select     — dropdown, single or multi, `empty` is the placeholder
 *   selectcolor— multi dropdown where every option carries its own colorbox
 *   text       — text field
 *   color      — standalone colorbox row
 *   soon       — muted "Soon…" style row
 *   esp        — the live ESP preview panel
 * ------------------------------------------------------------------- */
var SPEC = {
	aimbot: {
		title: "Aimbot",
		crumb: "combat",
		cols: [
			[
				{
					block: "Main",
					rows: [
						{ t: "check", k: "aim.enable", n: "Enable" },
						{ t: "check", k: "aim.silent", n: "Silent Aim" },
						{ t: "check", k: "aim.autofire", n: "Automatically fire" },
						{ t: "check", k: "aim.penetration", n: "Penetration" },
						{ t: "slider", k: "aim.fov", n: "Field of view", min: 0, max: 360, unit: "\u00b0" }
					]
				},
				{
					block: "Selection",
					rows: [
						{ t: "select", k: "aim.target", n: "Target", opts: ["Damage", "Crosshair", "Hit chance"], empty: "None" },
						{ t: "select", k: "aim.hitboxes", n: "Hitboxes", opts: HITBOXES, multi: true, empty: "Select" },
						{ t: "select", k: "aim.multipoint", n: "Multipoint", opts: HITBOXES, multi: true, empty: "Select" },
						{ t: "slider", k: "aim.hitchance", n: "Hit chance", min: 0, max: 100, unit: "%" },
						{ t: "slider", k: "aim.mindamage", n: "Min damage", min: 0, max: 115 },
						{ t: "check", k: "aim.quickstop", n: "Quick stop" },
						{ t: "check", k: "aim.quickscope", n: "Quick scope" }
					]
				}
			],
			[
				{
					block: "Exploits",
					rows: [
						{ t: "select", k: "aim.history", n: "History", opts: ["Low", "Medium", "High", "Maximum"], empty: "None" },
						{ t: "select", k: "aim.spread", n: "Remove spread", opts: ["Seed", "Full"], empty: "None" },
						{ t: "select", k: "aim.hitboxOverride", n: "Hitbox overide", opts: HITBOXES, empty: "None" },
						{
							t: "select",
							k: "aim.textureOverride",
							n: "Texture overide",
							opts: ["lightning", "grass", "rock", "blood", "glass", "explosion"],
							multi: true,
							empty: "None"
						},
						{ t: "check", k: "aim.delayshot", n: "Delay shot" },
						{ t: "check", k: "aim.wallshot", n: "Wallshot" },
						{ t: "check", k: "aim.bulletTp", n: "Bullet teleport" },
						{ t: "check", k: "aim.rapidfire", n: "Rapid fire" },
						{ t: "check", k: "aim.instareload", n: "Insta reload" },
						{ t: "check", k: "aim.spam", n: "Spam" }
					]
				},
				{
					block: "Other",
					rows: [
						{ t: "check", k: "aim.backcam", n: "Back camera" },
						{ t: "check", k: "aim.autopistol", n: "Automatic pistol" },
						{ t: "check", k: "aim.visualize", n: "Visualize" },
						{ t: "select", k: "aim.randomize", n: "Randomize", opts: ["Low", "Mid", "High"], empty: "None" }
					]
				}
			]
		]
	},

	player: {
		title: "Player",
		crumb: "visuals",
		cols: [
			[
				{
					block: "Enemy",
					rows: [
						{ t: "check", k: "esp.enable", n: "Enable" },
						{ t: "check", k: "esp.arrow", n: "Offscreen arrow", color: "espc.arrow" },
						{ t: "check", k: "esp.sounds", n: "Sounds", color: "espc.sounds" },
						{ t: "check", k: "esp.name", n: "Nickname", color: "espc.name" },
						{ t: "check", k: "esp.box", n: "Box", color: "espc.box" },
						{ t: "check", k: "esp.skeleton", n: "Skeleton", color: "espc.skeleton" },
						{ t: "check", k: "esp.weapon", n: "Weapon", color: "espc.weapon" },
						{ t: "check", k: "esp.health", n: "Health bar", color: "espc.health" },
						{
							t: "selectcolor",
							k: "esp.flags",
							n: "Flags",
							multi: true,
							empty: "None",
							opts: ["Device", "Reload", "Bomb", "Defuse"],
							colors: {
								Device: "espc.flagDevice",
								Reload: "espc.flagReload",
								Bomb: "espc.flagBomb",
								Defuse: "espc.flagDefuse"
							}
						}
					]
				}
			],
			[{ esp: true }]
		]
	},

	world: {
		title: "World",
		crumb: "visuals",
		cols: [
			[
				{ block: "Soon\u2026", rows: [{ t: "check", k: "world.grenade", n: "Grenade prediction" }] },
				{
					block: "Debug",
					rows: [
						{ t: "check", k: "world.gtext", n: "Gradient text" },
						{ t: "text", k: "world.gtextValue", n: "Text", max: 18 },
						{ t: "slider", k: "world.gtextSize", n: "Text size", min: 8, max: 40 },
						{ t: "slider", k: "world.gtextSpeed", n: "Shimmer speed", min: 0, max: 100, unit: "%" },
						{ t: "slider", k: "world.gtextGap", n: "Offset from crosshair", min: 0, max: 120 }
					]
				}
			],
			[
				{
					block: "Custom crosshair",
					rows: [
						{ t: "check", k: "world.xhair", n: "Enable", color: "world.xhairColor", rainbow: "world.xhairRainbow" },
						{ t: "slider", k: "world.xhairSize", n: "Length", min: 2, max: 40 },
						{ t: "slider", k: "world.xhairGap", n: "Gap", min: 0, max: 30 },
						{ t: "slider", k: "world.xhairThick", n: "Thickness", min: 1, max: 8 },
						{ t: "check", k: "world.xhairDot", n: "Center dot" },
						{ t: "check", k: "world.xhairOutline", n: "Outline" }
					]
				},
				{
					block: "Fake fov",
					rows: [
						{ t: "check", k: "world.fov", n: "Enable", color: "world.fovColor", rainbow: "world.fovRainbow" },
						{ t: "slider", k: "world.fovSize", n: "Size", min: 30, max: 400 },
						{ t: "slider", k: "world.fovThick", n: "Thickness", min: 1, max: 10 },
						{ t: "slider", k: "world.fovGlow", n: "Glow", min: 0, max: 40 },
						{ t: "color", k: "world.fovFill", n: "Fill" }
					]
				}
			]
		]
	},

	inventory: {
		title: "Inventory",
		crumb: "common",
		cols: [[{ block: "Soon\u2026", rows: [{ t: "soon", n: "Skin changer" }, { t: "soon", n: "Case predictor" }] }], []]
	},

	misc: {
		title: "Miscelenius",
		crumb: "common",
		cols: [
			[
				{
					block: "Movement",
					rows: [
						{ t: "check", k: "misc.bunnyhop", n: "Bunnyhop" },
						{ t: "check", k: "misc.airstrafe", n: "Airstrafe" },
						{ t: "check", k: "misc.jumpbug", n: "Jump bug" },
						{ t: "check", k: "misc.quickstop", n: "Quick stop" },
						{ t: "check", k: "misc.strafeassist", n: "Strafe assist" },
						{ t: "check", k: "misc.movebefore", n: "Move before timer" },
						{ t: "check", k: "misc.noclip", n: "Noclip" },
						{ t: "check", k: "misc.fly", n: "Fly" },
						{ t: "check", k: "misc.fastladder", n: "Fast ladder" },
						{ t: "check", k: "misc.edgejump", n: "Edge jump" },
						{ t: "check", k: "misc.fakelag", n: "Fake lag" }
					]
				}
			],
			[
				{
					block: "Features",
					rows: [
						{ t: "check", k: "misc.godmode", n: "God mode" },
						{ t: "check", k: "misc.invisible", n: "Invisible" },
						{ t: "check", k: "misc.teleport", n: "Teleport" },
						{ t: "check", k: "misc.stoptime", n: "Stop time" },
						{ t: "check", k: "misc.instaswitch", n: "Insta switch" },
						{ t: "check", k: "misc.antiafk", n: "Anti AFK kick" },
						{ t: "check", k: "misc.unlockchat", n: "Unlock chat" },
						{ t: "check", k: "misc.hitsound", n: "Hit sound" },
						{ t: "check", k: "misc.autogrenade", n: "Automatic greande release" },
						{ t: "check", k: "misc.autoaccept", n: "Auto-accept matchmaking" },
						{
							t: "select",
							k: "misc.logevents",
							n: "Log events",
							opts: ["Hit", "Miss", "Spam", "Purchase", "Kick"],
							multi: true,
							empty: "None"
						}
					]
				}
			]
		]
	}
};

/* sidebar ------------------------------------------------------------- */
var NAV = [
	{ type: "label", n: "combat" },
	{ type: "item", n: "Aimbot", tab: "aimbot" },
	{ type: "label", n: "common" },
	{ type: "group", n: "Visuals", children: [{ n: "Player", tab: "player" }, { n: "World", tab: "world" }] },
	{ type: "item", n: "Inventory", tab: "inventory" },
	{ type: "item", n: "Miscelenius", tab: "misc" }
];
