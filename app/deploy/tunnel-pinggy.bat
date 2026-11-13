@echo off
REM Montelien online — Pinggy tunel pres SSH:443 (zadna instalace, zadny ucet).
REM Free limit: relace expiruje po ~60 minutach, pak se tunel sam obnovi s NOVOU adresou.
REM Adresa tunelu se vypise nize (hledej https://...pinggy.net).
:tunnel
ssh -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -p 443 -R0:localhost:8001 a.pinggy.io
echo Tunel spadl — obnovuji za 5 s...
timeout /t 5 >nul
goto tunnel
