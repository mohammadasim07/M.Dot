@REM -------------------------------------------------------------------
@REM Maven Wrapper startup batch script for Windows
@REM -------------------------------------------------------------------
@echo off
setlocal enabledelayedexpansion

set "MAVEN_PROJECTBASEDIR=%~dp0"
if "%MAVEN_PROJECTBASEDIR:~-1%"=="\" set "MAVEN_PROJECTBASEDIR=%MAVEN_PROJECTBASEDIR:~0,-1%"
set "WRAPPER_JAR=%MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.jar"

@REM Check if maven-wrapper.jar exists
if not exist "%WRAPPER_JAR%" (
    echo Error: Could not find maven-wrapper.jar at "%WRAPPER_JAR%"
    exit /b 1
)

@REM Find java.exe
if defined JAVA_HOME (
    set "JAVACMD=%JAVA_HOME%\bin\java.exe"
) else (
    set "JAVACMD=java"
)

@REM Execute Maven wrapper with required Java 25 flags
"%JAVACMD%" --enable-native-access=ALL-UNNAMED "-Dmaven.multiModuleProjectDirectory=%MAVEN_PROJECTBASEDIR%" -classpath "%WRAPPER_JAR%" org.apache.maven.wrapper.MavenWrapperMain %*

