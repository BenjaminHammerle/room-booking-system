#!/bin/bash


# 1. Build (entweder lokal oder via CircleCI)
docker build -t room-booking-system .

# 2. Run
docker run -d -p 3000:3000 -e NEXT_PUBLIC_SUPABASE_URL="https://wwhbkfatevjhrgegxzhx.supabase.co" -e NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_5Wx9ZQItlO148NP8CLB8tQ_ZDo13oWD" --name room-booking room-booking-system

