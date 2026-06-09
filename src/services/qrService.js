// src/services/qrService.js
const QRCode = require("qrcode");

/**
 * Generate a QR code PNG buffer from a VPN config link.
 */
async function generateQR(text) {
  return QRCode.toBuffer(text, {
    errorCorrectionLevel: "M",
    type: "png",
    width: 512,
    margin: 2,
    color: { dark: "#1a1a2e", light: "#f0f0f0" },
  });
}

module.exports = { generateQR };
