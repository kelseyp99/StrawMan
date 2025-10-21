export async function redeemPoints(email: string, points: number, sku?: string) {
  const url = `/functions/redeemGift`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, points, sku }),
    });
    if (!res.ok) throw new Error('Redeem failed');
    return await res.json();
  } catch (e) {
    console.error('rewards.redeemPoints error', e);
    return { ok: false, error: String(e) };
  }
}
