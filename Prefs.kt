package com.keffaine.showcase

import android.content.Context
import org.json.JSONObject

/**
 * Every user-facing setting lives in one JSON blob so the WebView settings
 * screen and the overlay can share a single schema.
 */
class Prefs(ctx: Context) {

	private val sp = ctx.getSharedPreferences("keffaine", Context.MODE_PRIVATE)

	/** settings written by the settings screen */
	var config: String
		get() = sp.getString(KEY_CONFIG, "{}") ?: "{}"
		set(v) {
			sp.edit().putString(KEY_CONFIG, v).apply()
		}

	/** last cheat-menu state, so a restart keeps the same toggles */
	var state: String?
		get() = sp.getString(KEY_STATE, null)
		set(v) {
			sp.edit().putString(KEY_STATE, v).apply()
		}

	private fun cfg(): JSONObject = try {
		JSONObject(config)
	} catch (e: Exception) {
		JSONObject()
	}

	val startDelaySec: Int get() = cfg().optInt("startDelaySec", 3)
	val introDelayMs: Int get() = cfg().optInt("introDelayMs", 500)
	val showIntro: Boolean get() = cfg().optBoolean("showIntro", true)
	val wmX: Int get() = cfg().optInt("wmX", 12)
	val wmY: Int get() = cfg().optInt("wmY", 12)
	val wmScale: Float get() = cfg().optDouble("wmScale", 1.0).toFloat()
	val menuScale: Float get() = cfg().optDouble("menuScale", 1.0).toFloat()

	/** the slice of the config the watermark cares about */
	fun profileJson(): JSONObject {
		val c = cfg()
		val p = JSONObject()
		p.put("user", c.optString("user", "wruhe"))
		p.put("days", c.optInt("days", 15))
		p.put("hwid", c.optString("hwid", "7F2A-91C4-D08B"))
		p.put("avatar", c.optInt("avatar", 1))
		p.put("fpsMin", c.optInt("fpsMin", 118))
		p.put("fpsMax", c.optInt("fpsMax", 144))
		p.put("pingMin", c.optInt("pingMin", 12))
		p.put("pingMax", c.optInt("pingMax", 38))
		return p
	}

	/** remember where the user dragged the watermark */
	fun saveWatermarkPos(x: Int, y: Int) {
		val c = cfg()
		c.put("wmX", x)
		c.put("wmY", y)
		config = c.toString()
	}

	private companion object {
		const val KEY_CONFIG = "config"
		const val KEY_STATE = "state"
	}
}
