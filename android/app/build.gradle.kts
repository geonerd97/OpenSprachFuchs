import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
}

android {
    namespace = "de.opensprachfuchs.app"
    compileSdk {
        version = release(36)
    }

    defaultConfig {
        applicationId = "de.opensprachfuchs.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 29
        versionName = "0.1.9"
        // Friend links (QR codes) open the app: the backend's host, see CONFIG.BACKEND_URL in app/js/config.js.
        manifestPlaceholders["linkHost"] = "app.opensprachfuchs.workers.dev"
        // The backend's earlier address, still in friend links shared before 0.0.15.
        manifestPlaceholders["linkHostOld"] = "opensprachfuchs.opensprachfuchs.workers.dev"
    }

    // Release signing: android/keystore.properties (not in Git), see README "Release bauen".
    val keystore = Properties().apply {
        val f = rootProject.file("keystore.properties")
        if (f.exists()) f.inputStream().use { load(it) }
    }
    signingConfigs {
        if (keystore.isNotEmpty()) create("release") {
            storeFile = rootProject.file(keystore.getProperty("storeFile"))
            storePassword = keystore.getProperty("storePassword")
            keyAlias = keystore.getProperty("keyAlias")
            keyPassword = keystore.getProperty("keyPassword")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_17
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}

// The game lives in ../app (plain HTML, CSS and JavaScript) and the language packs in ../packs.
// Before every build the packs are checked and built with Node (../tools/packs.mjs): `build` writes all of them for
// the backend, `bundle` writes the ones that go into the app's assets, so the app also works offline. Only the main
// languages are bundled; dialects (group "dialects", packs/README.md) come from the backend, unless the build is
// run with -PbundleDialects=true. Node's path can be set with -PnodePath=...
val nodeBin: String = (findProperty("nodePath") as String?)
    ?: listOf("/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node").firstOrNull { File(it).exists() }
    ?: "node"
val bundleDialects: Boolean = (findProperty("bundleDialects") as String?).toBoolean()
val bundledPacksDir = layout.buildDirectory.dir("bundledPacks")
val buildPacks by tasks.registering(Exec::class) {
    description = "Checks the language packs and builds them into ../worker/public/packs."
    workingDir = rootProject.file("..")
    commandLine(nodeBin, "tools/packs.mjs", "build")
    inputs.dir(rootProject.file("../packs"))
    inputs.file(rootProject.file("../tools/packs.mjs"))
    outputs.dir(rootProject.file("../worker/public/packs"))
}
val bundlePacks by tasks.registering(Exec::class) {
    description = "Writes the packs that ship inside the APK (main languages, dialects with -PbundleDialects=true)."
    dependsOn(buildPacks)
    val out = bundledPacksDir.get().asFile
    workingDir = rootProject.file("..")
    commandLine(listOf(nodeBin, "tools/packs.mjs", "bundle", out.absolutePath) + (if (bundleDialects) listOf("--dialects") else emptyList()))
    inputs.dir(rootProject.file("../packs"))
    inputs.file(rootProject.file("../tools/packs.mjs"))
    inputs.property("bundleDialects", bundleDialects)
    outputs.dir(out)
}
val copyWeb by tasks.registering(Sync::class) {
    description = "Copies the game and the bundled packs into app/src/main/assets."
    dependsOn(bundlePacks)
    from(rootProject.file("../app"))
    from(bundledPacksDir) { into("packs") }
    into(layout.projectDirectory.dir("src/main/assets"))
}
tasks.named("preBuild") { dependsOn(copyWeb) }
