@echo off
rem Bij dubbelklikken het venster openhouden tot je op een toets drukt.
if defined USABILITY_NESTED goto :main
echo %cmdcmdline% | find /i "%~nx0" >nul
if errorlevel 1 goto :main
set "USABILITY_NESTED=1"
call "%~f0" %*
pause
exit /b
:main
rem Start de usability-testomgeving (los van de ontwikkelomgeving) op https://localhost:8443
rem De eerste keer worden de images gebouwd; daarna wordt steeds dezelfde versie van de app
rem gebruikt. Nieuwe code in de testomgeving zetten: start-test.bat --build
setlocal EnableExtensions
cd /d "%~dp0"
if not defined USABILITY_PROJECT set "USABILITY_PROJECT=usability"
if not defined USABILITY_HTTPS_PORT set "USABILITY_HTTPS_PORT=8443"
set "DC=docker compose -p %USABILITY_PROJECT% -f docker-compose.yml -f docker-compose.usability.yml"

%DC% up -d %1 db api web
if errorlevel 1 goto :fail

rem Migraties zijn idempotent: alleen ontbrekende migraties worden uitgevoerd.
%DC% exec -T api npx knex migrate:latest
if errorlevel 1 goto :fail

echo.
echo Testomgeving draait: https://localhost:%USABILITY_HTTPS_PORT%/admin/login
echo Eerste keer? Dubbelklik maak-beheerder-test.bat om een beheeraccount aan te maken.
exit /b 0

:fail
echo.
echo FOUT: de testomgeving kon niet worden gestart. Draait Docker Desktop?
exit /b 1
