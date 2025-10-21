export async function fetchPrice(symbol: string): Promise<number> {
  // Replace with your actual Pricely endpoint and API key if needed.
  const url = `https://api.pricely.example/v1/price?symbol=${encodeURIComponent(symbol)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Price fetch failed');
    const data = await res.json();
    return Number(data.price || 0);
  } catch (e) {
    console.error('pricely.fetchPrice error', e);
    return 0;
  }
}
