allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
// Isar 3.1.0 は AGP 7 時代のプラグインで、AGP 8 以降で必須の namespace を宣言していない
// （マニフェストの package 属性のみ）。ビルドが通らないため、プラグインの group から補う。
// 下の evaluationDependsOn より前に登録すること（後だと評価済みで afterEvaluate を追加できない）
subprojects {
    afterEvaluate {
        val androidExtension = extensions.findByName("android") ?: return@afterEvaluate
        androidExtension.withGroovyBuilder {
            if (getProperty("namespace") == null) {
                setProperty("namespace", project.group.toString())
            }
            // Isar は compileSdk 30 固定だが、依存する androidx が 34 以降を要求するため引き上げる
            val compileSdk = getProperty("compileSdk") as? Int
            if (compileSdk != null && compileSdk < 36) {
                setProperty("compileSdk", 36)
            }
        }
    }
}

subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
