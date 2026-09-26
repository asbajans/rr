/**
 * IndexNow anahtar doğrulama dosyası.
 * indexnow.org kaydı için `https://{host}/{INDEXNOW_KEY}.txt` adresi
 * anahtarı düz metin olarak dönmelidir.
 *
 * Kurulum: INDEXNOW_KEY env değişkenini core + frontend'de aynı değere ayarlayın
 * (örn. `openssl rand -hex 16`). Key yoksa bu route 404 döner.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ keytxt: string }> },
) {
  const { keytxt } = await params;
  const key = (process.env.INDEXNOW_KEY || '').trim();
  if (!key || keytxt !== `${key}.txt`) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(key, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
