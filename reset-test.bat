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
rem Zet de usability-testomgeving terug naar een snapshot (database + logo's + video's).
rem
rem Gebruik:  reset-test.bat           de actieve snapshot terugzetten (vraagt eerst J/N)
rem           reset-test.bat v1        snapshot-v1 terugzetten; v1 wordt de actieve snapshot
rem           reset-test.bat /y        zonder bevestigingsvraag (ook: reset-test.bat v1 /y)
setlocal EnableExtensions
cd /d "%~dp0"
if not defined USABILITY_PROJECT set "USABILITY_PROJECT=usability"
set "DC=docker compose -p %USABILITY_PROJECT% -f docker-compose.yml -f docker-compose.usability.yml"
set "SNAPROOT=%~dp0snapshots-%USABILITY_PROJECT%"

set "VERSION="
set "ASK=1"
:args
if "%~1"=="" goto :argsdone
if /i "%~1"=="/y" (set "ASK=0") else (set "VERSION=%~1")
shift
goto :args
:argsdone

if "%VERSION%"=="" if exist "%SNAPROOT%\actief.txt" set /p VERSION=<"%SNAPROOT%\actief.txt"
if "%VERSION%"=="" (
  echo Er is nog geen snapshot. Maak er eerst een met: snapshot-test.bat v1
  exit /b 1
)
set "SNAP=%SNAPROOT%\snapshot-%VERSION%"
for %%f in (database.sql logos.tar videos.tar) do (
  if not exist "%SNAP%\%%f" (
    echo snapshot-%VERSION% is onvolledig of bestaat niet: %SNAP%\%%f ontbreekt.
    exit /b 1
  )
)

set "DBID="
for /f %%i in ('%DC% ps --status running -q db 2^>nul') do set "DBID=%%i"
if not defined DBID (
  echo De testdatabase draait niet. Start eerst start-test.bat.
  exit /b 1
)

if "%ASK%"=="1" (
  choice /c JN /m "Testomgeving '%USABILITY_PROJECT%' terugzetten naar snapshot-%VERSION%? Alle wijzigingen sinds de snapshot gaan verloren"
  if errorlevel 2 exit /b 1
)

for /f %%t in ('powershell -NoProfile -Command "[DateTimeOffset]::Now.ToUnixTimeSeconds()"') do set "T0=%%t"

echo [1/5] App stoppen...
%DC% stop api web
if errorlevel 1 goto :fail

echo [2/5] Database terugzetten (oude database wordt eerst helemaal verwijderd)...
%DC% exec -T db sh -c "MYSQL_PWD=$MARIADB_ROOT_PASSWORD mariadb -uroot" < "%SNAP%\database.sql"
if errorlevel 1 goto :fail

echo [3/5] Logo's terugzetten...
docker run --rm -v %USABILITY_PROJECT%_logos:/data -v "%SNAP%:/backup:ro" alpine:3 sh -c "find /data -mindepth 1 -delete && tar -xf /backup/logos.tar -C /data"
if errorlevel 1 goto :fail

echo [4/5] Video's en thumbnails terugzetten...
docker run --rm -v %USABILITY_PROJECT%_videos:/data -v "%SNAP%:/backup:ro" alpine:3 sh -c "find /data -mindepth 1 -delete && tar -xf /backup/videos.tar -C /data"
if errorlevel 1 goto :fail

echo [5/5] App starten...
%DC% start api web
if errorlevel 1 goto :fail
> "%SNAPROOT%\actief.txt" echo %VERSION%

for /f %%t in ('powershell -NoProfile -Command "[DateTimeOffset]::Now.ToUnixTimeSeconds()"') do set "T1=%%t"
set /a DUUR=T1-T0
echo.
echo Klaar: teruggezet naar snapshot-%VERSION% in %DUUR% seconden.
echo Iedereen is uitgelogd; log opnieuw in. Ververs open browsertabbladen.
exit /b 0

:fail
echo.
echo FOUT: reset mislukt. De app wordt weer gestart, maar de toestand kan half teruggezet zijn.
echo Voer reset-test.bat nog een keer uit.
%DC% start api web
exit /b 1
