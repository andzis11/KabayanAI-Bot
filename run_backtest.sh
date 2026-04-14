#!/bin/bash
# Quick backtest script for Kabayan Agent
cd /root/kabayan/kabayan-fixed

echo "Running backtest..."
npx ts-node src/backtest.ts
