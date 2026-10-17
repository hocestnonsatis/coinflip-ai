#!/bin/bash
# Resumable: re-running continues each config from ck/<name>/last.npz until its minute budget is spent.
cd "$(dirname "$0")"
M=${1:-80}
run() { nohup python3 td.py "$@" > logs/run-$1.out 2>&1 & }
mkdir -p logs
run a 0.05 0.005 0.7 0.05 $M 0
run b 0.1 0.01 0.7 0.05 $M 0
run c 0.05 0.005 0.9 0.05 $M 0
run d 0.05 0.005 0.7 0.05 $M 0.5
run e 0.02 0.002 0.7 0.02 $M 0.5
run f 0.1 0.01 0.9 0.1 $M 0.3
run g 0.05 0.005 0.5 0.05 $M 0.5
