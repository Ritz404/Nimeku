// Kunci API Omnify dibaca dari .env.local (OMNIFY_API_KEY). Spasi, tanda kutip, atau karakter CR di ujung nilai
// (sering terbawa saat menyalin/menempel) dibuang supaya tidak membuat API menjawab 401.
export const omnifyKey = () => String(process.env.OMNIFY_API_KEY || '').trim().replace(/^["']+|["']+$/g, '').trim();
