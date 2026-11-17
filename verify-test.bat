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
rem Controleert of de usability-testomgeving exact gelijk is aan een snapshot.
rem Vergelijkt een verse database-dump byte voor byte met de dump in de snapshot, en de
rem MD5-controlesom van elk logo-, video- en thumbnailbestand met de bestanden in de snapshot.
rem
rem Gebruik:  verify-test.bat        (actieve snapshot)
rem           verify-test.bat v1
setlocal EnableExtensions
cd /d "%~dp0"
if not defined USABILITY_PROJECT set "USABILITY_PROJECT=usability"
set "DC=docker compose -p %USABILITY_PROJECT% -f docker-compose.yml -f docker-compose.usability.yml"
set "SNAPROOT=%~dp0snapshots-%USABILITY_PROJECT%"

set "VERSION=%~1"
if "%VERSION%"=="" if exist "%SNAPROOT%\actief.txt" set /p VERSION=<"%SNAPROOT%\actief.txt"
set "SNAP=%SNAPROOT%\snapshot-%VERSION%"
if not exist "%SNAP%\database.sql" (
  echo snapshot-%VERSION% niet gevonden.
  exit /b 1
)
set "RESULT=0"

echo Database vergelijken...
set "CUR=%TEMP%\usability-verify-%RANDOM%.sql"
%DC% exec -T db sh -c "MYSQL_PWD=$MARIADB_ROOT_PASSWORD mariadb-dump -uroot --single-transaction --routines --triggers --events --skip-dump-date --add-drop-database --ignore-table-data=$MARIADB_DATABASE.Session --databases $MARIADB_DATABASE" > "%CUR%"
fc /b "%SNAP%\database.sql" "%CUR%" >nul
if errorlevel 1 (
  echo   VERSCHIL: de database wijkt af van snapshot-%VERSION%.
  set "RESULT=1"
) else (
  echo   Database identiek.
)
del "%CUR%" 2>nul

for %%v in (uploads videos) do call :files %%v
echo.
if "%RESULT%"=="0" (echo RESULTAAT: identiek aan snapshot-%VERSION%.) else (echo RESULTAAT: NIET identiek aan snapshot-%VERSION%.)
exit /b %RESULT%

:files
echo Bestanden in volume %USABILITY_PROJECT%_%1 vergelijken...
docker run --rm -v %USABILITY_PROJECT%_%1:/data:ro -v "%SNAP%:/backup:ro" alpine:3 sh -c "mkdir /tmp/s && tar -xf /backup/%1.tar -C /tmp/s && (cd /tmp/s && find . -type f ! -path './incoming/*' -exec md5sum {} + | sort -k2) > /tmp/a && (cd /data && find . -type f ! -path './incoming/*' -exec md5sum {} + | sort -k2) > /tmp/b && echo '  aantal bestanden (snapshot / testomgeving):' $(wc -l < /tmp/a) / $(wc -l < /tmp/b) && { diff /tmp/a /tmp/b > /tmp/d; r=$?; head -20 /tmp/d; exit $r; }"
if errorlevel 1 (
  echo   VERSCHIL in %1.
  set "RESULT=1"
) else (
  echo   %1 identiek.
)
exit /b 0
