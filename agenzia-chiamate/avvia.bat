@echo off
REM Doppio clic per avviare: resta in ascolto e aggiorna candidati.xlsx a ogni nuova chiamata.
cd /d "%~dp0"
python chiamate.py --continuo
pause
