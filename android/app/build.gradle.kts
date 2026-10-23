import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
}

android {
    namespace = "de.openlingo.app"
    compileSdk {
        version = release(36)
    }

    defaultConfig {
        applicationId = "de.openlingo.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 3
        versionName = "0.0.1"
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
// Before every build the packs are checked and built with Node (../tools/packs.mjs), then the game and a copy of
// all packs go into the app's assets, so the app also works offline. Node's path can be set with -PnodePath=...
val nodeBin: String = (findProperty("nodePath") as String?)
    ?: listOf("/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node").firstOrNull { File(it).exists() }
    ?: "node"
val buildPacks by tasks.registering(Exec::class) {
    description = "Checks the language packs and builds them into ../worker/public/packs."
    workingDir = rootProject.file("..")
    commandLine(nodeBin, "tools/packs.mjs", "build")
    inputs.dir(rootProject.file("../packs"))
    inputs.file(rootProject.file("../tools/packs.mjs"))
    outputs.dir(rootProject.file("../worker/public/packs"))
}
val copyWeb by tasks.registering(Sync::class) {
    description = "Copies the game and the built packs into app/src/main/assets."
    dependsOn(buildPacks)
    from(rootProject.file("../app"))
    from(rootProject.file("../worker/public/packs")) { into("packs") }
    into(layout.projectDirectory.dir("src/main/assets"))
}
tasks.named("preBuild") { dependsOn(copyWeb) }
