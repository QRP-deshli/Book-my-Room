import qrcode

link = "https://example.com"   # vlož svoj link
qr = qrcode.make(link)
qr.save("qr.png")

print("QR kód uložený ako qr.png")
