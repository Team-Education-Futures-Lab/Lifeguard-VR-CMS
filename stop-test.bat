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
rem Stopt de usability-testomgeving. Data en bestanden blijven bewaard in de volumes.
setlocal EnableExtensions
cd /d "%~dp0"
if not defined USABILITY_PROJECT set "USABILITY_PROJECT=usability"
docker compose -p %USABILITY_PROJECT% -f docker-compose.yml -f docker-compose.usability.yml stop
