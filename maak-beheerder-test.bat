@echo off
rem Maakt een beheeraccount aan in de usability-testomgeving (niet in de ontwikkelomgeving).
rem Gebruik: dubbelklik, of: maak-beheerder-test.bat <gebruikersnaam>   (standaard: beheer)
rem Het wachtwoord wordt gevraagd en is tijdens het typen niet zichtbaar (minimaal 10 tekens).
setlocal EnableExtensions
cd /d "%~dp0"
if not defined USABILITY_PROJECT set "USABILITY_PROJECT=usability"
set "NAAM=%~1"
if "%NAAM%"=="" set "NAAM=beheer"
echo Beheeraccount "%NAAM%" aanmaken in de testomgeving.
echo Typ het wachtwoord en druk op Enter (je ziet niets verschijnen tijdens het typen).
docker compose -p %USABILITY_PROJECT% -f docker-compose.yml -f docker-compose.usability.yml exec api node scripts/create-admin.js %NAAM%
echo.
pause
