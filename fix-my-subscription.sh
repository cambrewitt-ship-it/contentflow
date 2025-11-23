#!/bin/bash
# Fix subscription by calling the API endpoint
# Replace YOUR_ACCESS_TOKEN with your actual auth token

curl -X POST http://localhost:3000/api/admin/fix-subscription \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{}'
