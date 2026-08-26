package com.keffaine.showcase

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView

/**
 * The settings screen is itself a WebView, so it shares the exact fonts,
 * colours and controls the overlay uses.
 */
class MainActivity : Activity() {

	private lateinit var web: WebView
	private lateinit var prefs: Prefs

	override fun onCreate(savedInstanceState: Bundle?) {
		super.onCreate(savedInstanceState)
		prefs = Prefs(this)

		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
			// the overlay runs as a foreground service, which wants a notification
			if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
				!= android.content.pm.PackageManager.PERMISSION_GRANTED
			) {
				requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 11)
			}
		}

		web = WebView(this)
		web.setBackgroundColor(Color.parseColor("#0A0C11"))
		web.overScrollMode = View.OVER_SCROLL_NEVER
		val s = web.settings
		s.javaScriptEnabled = true
		s.domStorageEnabled = true
		s.allowFileAccess = true
		web.addJavascriptInterface(Api(), "KfApp")
		web.loadUrl("file:///android_asset/overlay/settings.html")
		setContentView(web)
	}

	override fun onResume() {
		super.onResume()
		// permission or service state may have changed while we were away
		web.evaluateJavascript("window.kfRefresh && window.kfRefresh()", null)
	}

	inner class Api {

		@JavascriptInterface
		fun getConfig(): String = prefs.config

		@JavascriptInterface
		fun save(json: String) {
			prefs.config = json
		}

		@JavascriptInterface
		fun canOverlay(): Boolean = Settings.canDrawOverlays(this@MainActivity)

		@JavascriptInterface
		fun requestOverlay() {
			runOnUiThread {
				startActivity(
					Intent(
						Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
						Uri.parse("package:" + packageName)
					)
				)
			}
		}

		@JavascriptInterface
		fun isRunning(): Boolean = OverlayService.running

		@JavascriptInterface
		fun start(json: String) {
			prefs.config = json
			runOnUiThread {
				startForegroundService(
					Intent(this@MainActivity, OverlayService::class.java)
						.setAction(OverlayService.ACTION_START)
				)
				// get out of the way so the overlay sits on top of the game
				moveTaskToBack(true)
			}
		}

		@JavascriptInterface
		fun stop() {
			runOnUiThread {
				startService(
					Intent(this@MainActivity, OverlayService::class.java)
						.setAction(OverlayService.ACTION_STOP)
				)
			}
		}

		/** wipe the remembered cheat-menu toggles */
		@JavascriptInterface
		fun resetState() {
			prefs.state = null
		}
	}
}
