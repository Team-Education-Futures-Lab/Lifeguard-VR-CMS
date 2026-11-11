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
rem Maakt een snapshot van de usability-testomgeving: database-dump + kopie van de logo's
rem (volume uploads) en video's/thumbnails (volume videos).
rem
rem Gebruik:  snapshot-test.bat        (dubbelklik: kiest zelf v1, v2, ...)
rem           snapshot-test.bat v1     (zelf een versienaam kiezen)
rem Resultaat: snapshots-usability\snapshot-v1\ met database.sql, uploads.tar en videos.tar.
rem De nieuwe snapshot wordt de actieve snapshot voor reset-test.bat.
setlocal EnableExtensions
cd /d "%~dp0"
if not defined USABILITY_PROJECT set "USABILITY_PROJECT=usability"
set "DC=docker compose -p %USABILITY_PROJECT% -f docker-compose.yml -f docker-compose.usability.yml"
set "SNAPROOT=%~dp0snapshots-%USABILITY_PROJECT%"

set "VERSION=%~1"
if not "%VERSION%"=="" goto :haveversion
rem Geen versienaam opgegeven (bijvoorbeeld bij dubbelklikken): neem het eerste vrije nummer.
set /a N=1
:nextversion
if exist "%SNAPROOT%\snapshot-v%N%\" (
  set /a N+=1
  goto :nextversion
)
set "VERSION=v%N%"
:haveversion
set "SNAP=%SNAPROOT%\snapshot-%VERSION%"
if exist "%SNAP%\" (
  echo snapshot-%VERSION% bestaat al. Kies een nieuwe versienaam, bijvoorbeeld de volgende v-nummer.
  exit /b 1
)

set "DBID="
for /f %%i in ('%DC% ps --status running -q db 2^>nul') do set "DBID=%%i"
if not defined DBID (
  echo De testdatabase draait niet. Start eerst start-test.bat.
  exit /b 1
)

for /f %%t in ('powershell -NoProfile -Command "[DateTimeOffset]::Now.ToUnixTimeSeconds()"') do set "T0=%%t"
mkdir "%SNAP%" || exit /b 1

echo [1/4] App stoppen, zodat er tijdens de snapshot niets verandert...
%DC% stop api web
if errorlevel 1 goto :fail

echo [2/4] Database dumpen...
rem Sessies (inlogtokens) worden bewust niet bewaard: na een reset begint iedereen uitgelogd.
rem --skip-dump-date: dezelfde toestand geeft byte voor byte dezelfde dump (handig voor verify-test.bat).
%DC% exec -T db sh -c "MYSQL_PWD=$MARIADB_ROOT_PASSWORD mariadb-dump -uroot --single-transaction --routines --triggers --events --skip-dump-date --add-drop-database --ignore-table-data=$MARIADB_DATABASE.Session --databases $MARIADB_DATABASE" > "%SNAP%\database.sql"
if errorlevel 1 goto :fail

echo [3/4] Logo's kopieren (volume %USABILITY_PROJECT%_uploads)...
docker run --rm -v %USABILITY_PROJECT%_uploads:/data:ro -v "%SNAP%:/backup" alpine:3 tar -cf /backup/uploads.tar -C /data .
if errorlevel 1 goto :fail

echo [4/4] Video's en thumbnails kopieren (volume %USABILITY_PROJECT%_videos)...
rem incoming\ bevat alleen half afgemaakte uploads; die horen niet in de begintoestand.
docker run --rm -v %USABILITY_PROJECT%_videos:/data:ro -v "%SNAP%:/backup" alpine:3 tar -cf /backup/videos.tar -C /data --exclude ./incoming .
if errorlevel 1 goto :fail

%DC% start api web
if errorlevel 1 goto :fail
> "%SNAPROOT%\actief.txt" echo %VERSION%

for /f %%t in ('powershell -NoProfile -Command "[DateTimeOffset]::Now.ToUnixTimeSeconds()"') do set "T1=%%t"
set /a DUUR=T1-T0
echo.
echo Snapshot %VERSION% gemaakt in %DUUR% seconden: %SNAP%
dir /-c "%SNAP%" | findstr /i "database.sql uploads.tar videos.tar"
echo reset-test.bat zet voortaan snapshot-%VERSION% terug.
exit /b 0

:fail
echo.
echo FOUT: snapshot mislukt. De onvolledige map wordt verwijderd en de app weer gestart.
rmdir /s /q "%SNAP%" 2>nul
%DC% start api web
exit /b 1
