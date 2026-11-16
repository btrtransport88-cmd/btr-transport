import QRCode from 'qrcode';

export const generateQRCodeDataUrl = async (payload: string): Promise<string> => {
  try {
    const dataUrl = await QRCode.toDataURL(payload, {
      width: 256,
      margin: 2,
      color: {
        dark: '#0f3d48',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
    return dataUrl;
  } catch (err) {
    console.error('Failed to generate QR code', err);
    return '';
  }
};
