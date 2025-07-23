TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJlZDc0OGIzYi0xNjBlLTRhYjItYmUwYi1mNmM5NzNkNjVlYmEiLCJpYXQiOjE3NTMyNjU1NjMsImV4cCI6MTc1MzM1MTk2M30.gpW3l71Ln8UvIrKOd7qT5_s-XUVA7WMK04CxrX7C-6U"
CENTER_ID="efe6b507-ecd3-4eac-bd21-82cbe1125cc0"

for i in {1..4}; do
  curl -X POST http://localhost:5000/api/v1/alerts/sos \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"center_id\":\"$CENTER_ID\",\"message\":\"Test alert\",\"location\":{\"lat\":36.831740,\"lng\":10.233038}}"
done