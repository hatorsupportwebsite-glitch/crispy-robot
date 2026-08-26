package com.keffaine.showcase

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject

/**
 * Holds the three overlay windows:
 *
 *   hud.html        full screen, never touchable  - intro, crosshair, fake fov
 *   watermark.html  small chip, draggable         - opens the menu on tap
 *   menu.html       the cheat menu, on demand
 *
 * Each one is a WebView pointed at file:///android_asset/overlay/. State is
 * mirrored between them so the menu can drive what the hud paints.
 */
class OverlayService : Service(), JsBridge.Host {

	companion object {
		const val ACTION_START = "com.keffaine.showcase.action.START"
		const val ACTION_STOP = "com.keffaine.showcase.action.STOP"

		/** menu artboard in dp - must match .menu in style.css */
		private const val MENU_W = 780f
		private const val MENU_H = 510f

		/** watermark artboard in dp - must match .wm in watermark.html */
		private const val MARK_W = 400f
		private const val MARK_H = 36f

		private const val CHANNEL = "keffaine_overlay"
		private const val NOTE_ID = 7

		@Volatile
		var running = false
			private set
	}

	private val ui = Handler(Looper.getMainLooper())

	private lateinit var wm: WindowManager
	private lateinit var prefs: Prefs

	private var hud: WebView? = null
	private var mark: WebView? = null
	private var menu: WebView? = null
	private var markLp: WindowManager.LayoutParams? = null

	private var state: String? = null
	private var attached = false

	override fun onCreate() {
		super.onCreate()
		wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
		prefs = Prefs(this)
	}

	override fun onBind(intent: Intent?): IBinder? = null

	override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
		if (intent?.action == ACTION_STOP) {
			shutdown()
			return START_NOT_STICKY
		}

		startForeground(NOTE_ID, notification())
		running = true
		state = prefs.state

		// "time until the overlay shows up", straight from the settings screen
		val wait = prefs.startDelaySec.coerceIn(0, 300) * 1000L
		ui.removeCallbacksAndMessages(null)
		ui.postDelayed({ attach() }, wait)
		return START_STICKY
	}

	override fun onDestroy() {
		detach()
		running = false
		super.onDestroy()
	}

	private fun shutdown() {
		detach()
		running = false
		stopForeground(STOP_FOREGROUND_REMOVE)
		stopSelf()
	}

	/* ---------------------------------------------------------- notification */

	private fun notification(): Notification {
		val nm = getSystemService(NotificationManager::class.java)
		if (nm.getNotificationChannel(CHANNEL) == null) {
			val ch = NotificationChannel(
				CHANNEL,
				getString(R.string.channel_name),
				NotificationManager.IMPORTANCE_LOW
			)
			ch.setShowBadge(false)
			ch.enableVibration(false)
			nm.createNotificationChannel(ch)
		}

		val stop = PendingIntent.getService(
			this,
			1,
			Intent(this, OverlayService::class.java).setAction(ACTION_STOP),
			PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
		)
		val open = PendingIntent.getActivity(
			this,
			2,
			Intent(this, MainActivity::class.java),
			PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
		)

		return Notification.Builder(this, CHANNEL)
			.setContentTitle(getString(R.string.note_title))
			.setContentText(getString(R.string.note_text))
			.setSmallIcon(Icon.createWithResource(this, R.mipmap.ic_launcher))
			.setContentIntent(open)
			.setOngoing(true)
			.addAction(
				Notification.Action.Builder(
					Icon.createWithResource(this, R.mipmap.ic_launcher),
					getString(R.string.note_stop),
					stop
				).build()
			)
			.build()
	}

	/* --------------------------------------------------------------- windows */

	private fun density(): Float = resources.displayMetrics.density

	private fun dp(v: Float): Int = Math.round(v * density())

	private fun params(
		w: Int,
		h: Int,
		gravity: Int,
		touchable: Boolean,
		focusable: Boolean,
		noLimits: Boolean
	): WindowManager.LayoutParams {
		var flags = 0
		if (!focusable) flags = flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
		if (!touchable) flags = flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
		if (noLimits) flags = flags or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS

		val lp = WindowManager.LayoutParams(
			w,
			h,
			WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
			flags,
			PixelFormat.TRANSLUCENT
		)
		lp.gravity = gravity
		return lp
	}

	/** real OS blur behind the panel, so translucency never looks muddy */
	private fun blurBehind(lp: WindowManager.LayoutParams, radiusDp: Int) {
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
			lp.flags = lp.flags or WindowManager.LayoutParams.FLAG_BLUR_BEHIND
			lp.blurBehindRadius = dp(radiusDp.toFloat())
		}
	}

	private fun blurAvailable(): Boolean =
		Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && wm.isCrossWindowBlurEnabled

	/** config handed to the page before its first paint */
	private fun cfgJson(): String {
		val o = JSONObject()
		o.put("introDelay", prefs.introDelayMs)
		o.put("intro", prefs.showIntro)
		o.put("profile", prefs.profileJson())
		val s = state
		if (s != null) {
			try {
				o.put("state", JSONObject(s))
			} catch (e: Exception) {
				// stale blob, ignore
			}
		}
		return o.toString()
	}

	private fun web(file: String, tag: String, fixedWidth: Boolean): WebView {
		val v = WebView(this)
		v.setBackgroundColor(Color.TRANSPARENT)
		v.setLayerType(View.LAYER_TYPE_HARDWARE, null)
		v.isVerticalScrollBarEnabled = false
		v.isHorizontalScrollBarEnabled = false
		v.overScrollMode = View.OVER_SCROLL_NEVER

		val s = v.settings
		s.javaScriptEnabled = true
		s.domStorageEnabled = true
		s.allowFileAccess = true
		s.mediaPlaybackRequiresUserGesture = false
		if (fixedWidth) {
			// the document declares a fixed viewport width; let the WebView
			// scale it to whatever the window size ends up being
			s.useWideViewPort = true
			s.loadWithOverviewMode = true
		}

		v.addJavascriptInterface(JsBridge(tag, this), "KfBridge")
		v.webViewClient = object : WebViewClient() {
			override fun onPageFinished(view: WebView, url: String) {
				if (!blurAvailable()) {
					view.evaluateJavascript(
						"document.documentElement.classList.add('no-native-blur')",
						null
					)
				}
				val s2 = state
				if (s2 != null) pushTo(view, s2)
			}
		}

		v.loadUrl("file:///android_asset/overlay/" + file + "?cfg=" + Uri.encode(cfgJson()))
		return v
	}

	private fun pushTo(view: WebView, json: String) {
		view.evaluateJavascript(
			"window.kfState && window.kfState(" + JSONObject.quote(json) + ")",
			null
		)
	}

	private fun attach() {
		if (attached || !running) return
		attached = true

		// hud: covers everything, swallows nothing
		val hudLp = params(
			WindowManager.LayoutParams.MATCH_PARENT,
			WindowManager.LayoutParams.MATCH_PARENT,
			Gravity.TOP or Gravity.START,
			touchable = false,
			focusable = false,
			noLimits = true
		)
		val h = web("hud.html", "hud", false)
		hud = h
		try {
			wm.addView(h, hudLp)
		} catch (e: Exception) {
			hud = null
		}

		// watermark: tap to open the menu, drag to move it
		val scale = prefs.wmScale.coerceIn(0.6f, 2.5f)
		val lp = params(
			dp(MARK_W * scale),
			dp(MARK_H * scale),
			Gravity.TOP or Gravity.START,
			touchable = true,
			focusable = false,
			noLimits = false
		)
		lp.x = dp(prefs.wmX.toFloat())
		lp.y = dp(prefs.wmY.toFloat())
		blurBehind(lp, 18)
		markLp = lp

		val m = web("watermark.html", "mark", true)
		mark = m
		try {
			wm.addView(m, lp)
		} catch (e: Exception) {
			mark = null
		}
	}

	private fun detach() {
		ui.removeCallbacksAndMessages(null)
		dropMenu()
		mark?.let { drop(it) }
		hud?.let { drop(it) }
		mark = null
		hud = null
		markLp = null
		attached = false
	}

	private fun drop(v: WebView) {
		try {
			wm.removeViewImmediate(v)
		} catch (e: Exception) {
			// already gone
		}
		v.destroy()
	}

	private fun raiseMenu() {
		if (menu != null) return
		val scale = prefs.menuScale.coerceIn(0.5f, 2.0f)
		val lp = params(
			dp(MENU_W * scale),
			dp(MENU_H * scale),
			Gravity.CENTER,
			touchable = true,
			// focusable so the text fields can raise the keyboard
			focusable = true,
			noLimits = false
		)
		lp.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
		blurBehind(lp, 26)

		val v = web("menu.html", "menu", true)
		menu = v
		try {
			wm.addView(v, lp)
		} catch (e: Exception) {
			menu = null
		}
	}

	private fun dropMenu() {
		val v = menu ?: return
		menu = null
		drop(v)
	}

	/* ----------------------------------------------------------- JsBridge.Host */

	override fun onPush(from: String, json: String) {
		state = json
		prefs.state = json
		ui.post {
			if (from != "hud") hud?.let { pushTo(it, json) }
			if (from != "mark") mark?.let { pushTo(it, json) }
			if (from != "menu") menu?.let { pushTo(it, json) }
		}
	}

	override fun onOpenMenu() {
		ui.post { raiseMenu() }
	}

	override fun onCloseMenu() {
		// let the close animation finish inside the WebView first
		ui.postDelayed({ dropMenu() }, 240)
	}

	override fun onDrag(dx: Int, dy: Int) {
		ui.post {
			val lp = markLp
			val v = mark
			if (lp != null && v != null) {
				// the page reports css pixels; the window lives in real pixels
				val k = density() * prefs.wmScale.coerceIn(0.6f, 2.5f)
				val dm = resources.displayMetrics
				lp.x = (lp.x + Math.round(dx * k)).coerceIn(0, Math.max(0, dm.widthPixels - lp.width))
				lp.y = (lp.y + Math.round(dy * k)).coerceIn(0, Math.max(0, dm.heightPixels - lp.height))
				try {
					wm.updateViewLayout(v, lp)
					prefs.saveWatermarkPos(
						Math.round(lp.x / density()),
						Math.round(lp.y / density())
					)
				} catch (e: Exception) {
					// window went away mid-drag
				}
			}
		}
	}
}
