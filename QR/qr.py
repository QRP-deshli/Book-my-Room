import qrcode

link = "https://book-my-room-front.onrender.com/schedule/2?"   # vlož svoj link
qr = qrcode.make(link)
qr.save("qr.png")

print("QR kód uložený ako qr.png")
