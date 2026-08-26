package com.keffaine.showcase

import android.webkit.JavascriptInterface

/**
 * Exposed to every overlay WebView as `window.KfBridge`.
 * Called on a WebView worker thread, so the host must hop to the main looper.
 */
class JsBridge(private val tag: String, private val host: Host) {

	interface Host {
		/** a layer changed the shared state tree */
		fun onPush(from: String, json: String)

		fun onOpenMenu()
		fun onCloseMenu()

		/** watermark drag, in css pixels */
		fun onDrag(dx: Int, dy: Int)
	}

	@JavascriptInterface
	fun push(json: String) {
		host.onPush(tag, json)
	}

	@JavascriptInterface
	fun openMenu() {
		host.onOpenMenu()
	}

	@JavascriptInterface
	fun closeMenu() {
		host.onCloseMenu()
	}

	@JavascriptInterface
	fun drag(dx: Int, dy: Int) {
		host.onDrag(dx, dy)
	}
}
