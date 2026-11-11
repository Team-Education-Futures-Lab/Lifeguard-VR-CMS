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
rem Vult de videobibliotheek van de usability-testomgeving met veel video's (unieke namen,
rem willekeurig openbaar / selectief / prive). Ongeveer de helft gaat naar de "grote"
rem organisatie, de rest wordt verdeeld over alle andere organisaties.
rem
rem Gebruik:  vul-videos-test.bat                                   (Yonder, 500 video's)
rem           vul-videos-test.bat YONDER-SPORT-EN-BEWEGING 300      (andere organisatie/aantal)
rem Elke keer dat je dit uitvoert komen er video's BIJ. Dus maar een keer doen.
setlocal EnableExtensions
cd /d "%~dp0"
if not defined USABILITY_PROJECT set "USABILITY_PROJECT=usability"
set "DC=docker compose -p %USABILITY_PROJECT% -f docker-compose.yml -f docker-compose.usability.yml"
set "GROOT=%~1"
if "%GROOT%"=="" set "GROOT=YONDER-SPORT-EN-BEWEGING"
set "AANTAL=%~2"
if "%AANTAL%"=="" set "AANTAL=500"

choice /c JN /m "%AANTAL% video's toevoegen aan testomgeving '%USABILITY_PROJECT%' (de helft bij %GROOT%)"
if errorlevel 2 exit /b 1

rem Het script zit nog niet in de gebouwde image; daarom eerst naar de container kopieren.
%DC% cp backend/scripts/seed-usability-videos.js api:/app/scripts/seed-usability-videos.js
if errorlevel 1 goto :fail
%DC% exec -T -e NODE_ENV=development api node scripts/seed-usability-videos.js %GROOT% %AANTAL%
if errorlevel 1 goto :fail
exit /b 0

:fail
echo.
echo FOUT: video's toevoegen mislukt. Draait de testomgeving (start-test.bat)?
exit /b 1
