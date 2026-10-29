@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Сайт откроется в браузере через пару секунд.
echo Пока это окно открыто, сайт работает. Закройте окно, когда закончите.
start "" cmd /c "timeout /t 2 >/dev/null & start http://localhost:8790/"
python -m http.server 8790 --bind 127.0.0.1
