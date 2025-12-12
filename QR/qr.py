import qrcode

link = "http://localhost:3000/schedule/1?date=2025-12-09"   # vlož svoj link
qr = qrcode.make(link)
qr.save("qr.png")

print("QR kód uložený ako qr.png")
