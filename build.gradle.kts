plugins {
	id("com.android.application")
	id("org.jetbrains.kotlin.android")
}

android {
	namespace = "com.keffaine.showcase"
	compileSdk = 34

	defaultConfig {
		applicationId = "com.keffaine.showcase"
		minSdk = 26
		targetSdk = 34
		versionCode = 1
		versionName = "1.0"
	}

	buildTypes {
		release {
			isMinifyEnabled = false
			proguardFiles(
				getDefaultProguardFile("proguard-android-optimize.txt"),
				"proguard-rules.pro"
			)
			// so `assembleRelease` produces an installable file without a keystore
			signingConfig = signingConfigs.getByName("debug")
		}
	}

	compileOptions {
		sourceCompatibility = JavaVersion.VERSION_17
		targetCompatibility = JavaVersion.VERSION_17
	}

	kotlinOptions {
		jvmTarget = "17"
	}

	// keep the html/css/js/ttf overlay assets byte-identical
	aaptOptions {
		noCompress += listOf("ttf")
	}
}
