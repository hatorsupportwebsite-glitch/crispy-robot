# the overlay talks to Kotlin through @JavascriptInterface, keep those members
-keepclassmembers class com.keffaine.showcase.** {
	@android.webkit.JavascriptInterface <methods>;
}
